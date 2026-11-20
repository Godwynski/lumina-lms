import { auditLogQuery, parseAuditFilters } from "@/lib/audit-log-query";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isAbortError } from "@/lib/error-utils";
import { withAuthApi } from "@/lib/api-utils";

export const GET = withAuthApi(async (request, { supabase }) => {
  await connection();
  try {
    const searchParams = new URL(request.url).searchParams;
    const { limit, offset } = parseAuditFilters(searchParams);
    const query = auditLogQuery(supabase, searchParams, true).range(offset, offset + limit - 1);

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
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid audit filters." }, { status: 400 });
    if (isAbortError(error)) {
      return new Response(null, { status: 499 }); // Client Closed Request
    }
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}, { allowedRoles: ["super_admin", "librarian"] });
