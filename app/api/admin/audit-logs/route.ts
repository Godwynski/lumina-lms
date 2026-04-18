import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { isAbortError } from "@/lib/error-utils";


export async function GET(request: NextRequest) {
  await connection();
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

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const entityType = searchParams.get("entityType");
    const queryParam = searchParams.get("query");

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }
    
    if (queryParam) {
      const safe = sanitizeFilterInput(queryParam);
      query = query.or(`entity_type.ilike.%${safe}%,action.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const logs = data || [];
    const adminIds = [...new Set(logs.map((l) => l.admin_id).filter(Boolean))];

    let profilesMap = new Map<string, { full_name: string | null; email: string | null; role: string | null }>();
    if (adminIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", adminIds);
      profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
    }

    const enrichedLogs = logs.map((log) => ({
      ...log,
      profiles: log.admin_id ? profilesMap.get(log.admin_id) ?? null : null,
    }));

    return NextResponse.json({
      logs: enrichedLogs,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return new Response(null, { status: 499 }); // Client Closed Request
    }
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
