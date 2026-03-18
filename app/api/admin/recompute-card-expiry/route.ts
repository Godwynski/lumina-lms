import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RecomputeRequest {
  dryRun?: boolean;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getSystemSetting(supabase: SupabaseServerClient, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: RecomputeRequest = await request.json();
    const { dryRun = false } = body;

    // Get policy: card_validity_years
    const validityYears = parseInt(
      (await getSystemSetting(supabase, "card_validity_years")) || "4"
    );

    // Get all active library cards
    const { data: cards, error: cardsError } = await supabase
      .from("library_cards")
      .select("id, user_id, issued_at, expires_at, status")
      .eq("status", "active");

    if (cardsError) throw cardsError;

    const updated: Array<{
      cardId: string;
      userId: string;
      oldExpiry: string;
      newExpiry: string;
    }> = [];

    if (!dryRun) {
      // Update expiry dates
      for (const card of cards || []) {
        const newExpiry = new Date(card.issued_at);
        newExpiry.setFullYear(newExpiry.getFullYear() + validityYears);

        const { error: updateError } = await supabase
          .from("library_cards")
          .update({ expires_at: newExpiry.toISOString() })
          .eq("id", card.id);

        if (updateError) {
          console.error(`Failed to update card ${card.id}:`, updateError);
          continue;
        }

        updated.push({
          cardId: card.id,
          userId: card.user_id,
          oldExpiry: card.expires_at,
          newExpiry: newExpiry.toISOString(),
        });

        // Log audit entry
        await supabase.from("audit_logs").insert([
          {
            admin_id: user.id,
            entity_type: "library_card",
            entity_id: card.id,
            action: "update",
            old_value: JSON.stringify({ expires_at: card.expires_at }),
            new_value: JSON.stringify({ expires_at: newExpiry.toISOString() }),
            reason: "Batch recompute from card_validity_years policy",
          },
        ]);
      }
    } else {
      // Dry run: calculate what would change
      for (const card of cards || []) {
        const newExpiry = new Date(card.issued_at);
        newExpiry.setFullYear(newExpiry.getFullYear() + validityYears);

        if (newExpiry.toISOString() !== card.expires_at) {
          updated.push({
            cardId: card.id,
            userId: card.user_id,
            oldExpiry: card.expires_at,
            newExpiry: newExpiry.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      validityYears,
      cardsAffected: updated.length,
      updates: updated.slice(0, 10), // Return first 10 for preview
      totalCards: cards?.length || 0,
    });
  } catch (error) {
    console.error("Recompute expiry error:", error);
    return NextResponse.json(
      { error: "Recompute failed", success: false },
      { status: 500 }
    );
  }
}
