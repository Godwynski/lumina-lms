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

    if (!["admin", "librarian"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const entityType = searchParams.get("entityType");
    const queryParam = searchParams.get("query");
    const actionType = searchParams.get("actionType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) query = query.eq("entity_type", entityType);
    if (actionType) query = query.eq("action", actionType);
    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    if (userId) query = query.eq("admin_id", userId);
    
    if (queryParam) {
      const safe = sanitizeFilterInput(queryParam);
      
      // Lookup profiles that match the search query by name or email
      const { data: matchingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      
      const profileIds = matchingProfiles?.map(p => p.id) || [];
      
      let orConditions = [
        `entity_type.ilike.%${safe}%`,
        `action.ilike.%${safe}%`,
        `reason.ilike.%${safe}%`
      ];

      // Add matching profile IDs to the search if found
      if (profileIds.length > 0) {
        orConditions.push(`admin_id.in.(${profileIds.join(',')})`);
      }
      
      query = query.or(orConditions.join(','));
    }

    const { data: logs, error, count } = await query;

    if (error) throw error;

    // Manual join since audit_logs has no FK to profiles
    const adminIds = [...new Set((logs || []).map(l => l.admin_id).filter(Boolean))];
    let profilesMap = new Map();

    if (adminIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", adminIds);
      
      profiles?.forEach(p => profilesMap.set(p.id, p));
    }

    const logsWithProfiles = (logs || []).map(log => ({
      ...log,
      profiles: profilesMap.get(log.admin_id) || null
    }));

    return NextResponse.json({
      logs: logsWithProfiles,
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
