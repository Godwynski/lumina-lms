import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";

function isValidPolicyValue(key: string, value: string) {
  const numberLikeKeys = ["days", "limit", "count", "years", "fine", "amount"];
  if (numberLikeKeys.some((token) => key.includes(token))) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }
  return value.trim().length > 0;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "librarian"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.from("system_settings").select("*").order("key", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const value = typeof body.value === "string" ? body.value.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES]?.description;

    if (!key || !value) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 }
      );
    }

    if (!isValidPolicyValue(key, value)) {
      return NextResponse.json({ error: "Invalid policy value" }, { status: 400 });
    }

    // Check if exists
    const { data: existing } = await supabase
      .from("system_settings")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("system_settings")
        .update({
          value,
          description,
          updated_by: user.user.id,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("system_settings")
        .insert([{ key, value, description, updated_by: user.user.id }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
