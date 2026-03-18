import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RenewalRequest {
  borrowingRecordId: string;
}

async function getSystemSetting(supabase: any, key: string): Promise<string | null> {
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
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (!["librarian", "staff"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: RenewalRequest = await request.json();
    const { borrowingRecordId } = body;

    if (!borrowingRecordId) {
      return NextResponse.json(
        { ok: false, message: "borrowingRecordId is required" },
        { status: 400 }
      );
    }

    // Fetch policy settings
    const maxRenewalCount = parseInt(
      (await getSystemSetting(supabase, "max_renewal_count")) || "3"
    );
    const renewalPeriodDays = parseInt(
      (await getSystemSetting(supabase, "renewal_period_days")) || "14"
    );

    // Get borrowing record
    const { data: borrow, error: borrowError } = await supabase
      .from("borrowing_records")
      .select("*")
      .eq("id", borrowingRecordId)
      .single();

    if (borrowError) {
      return NextResponse.json(
        { ok: false, message: "Borrowing record not found" },
        { status: 404 }
      );
    }

    if (borrow.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: `Cannot renew a ${borrow.status} borrowing record` },
        { status: 400 }
      );
    }

    if (borrow.renewal_count >= maxRenewalCount) {
      return NextResponse.json(
        { ok: false, message: `Maximum renewal count of ${maxRenewalCount} exceeded` },
        { status: 400 }
      );
    }

    // Calculate new due date
    const newDueDate = new Date(borrow.due_date);
    newDueDate.setDate(newDueDate.getDate() + renewalPeriodDays);

    // Create renewal record
    const { data: renewal, error: renewalError } = await supabase
      .from("renewals")
      .insert([
        {
          borrowing_record_id: borrowingRecordId,
          renewed_by: user.user.id,
          new_due_date: newDueDate.toISOString(),
        },
      ])
      .select()
      .single();

    if (renewalError) throw renewalError;

    // Update borrowing record
    const { error: updateError } = await supabase
      .from("borrowing_records")
      .update({
        due_date: newDueDate.toISOString(),
        renewal_count: borrow.renewal_count + 1,
      })
      .eq("id", borrowingRecordId);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      renewal_id: renewal.id,
      new_due_date: newDueDate.toISOString(),
      renewal_count: borrow.renewal_count + 1,
    });
  } catch (error) {
    console.error("Renewal error:", error);
    return NextResponse.json(
      { error: "Renewal failed", ok: false },
      { status: 500 }
    );
  }
}
