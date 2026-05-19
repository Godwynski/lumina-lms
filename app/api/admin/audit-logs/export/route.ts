import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { isAbortError } from "@/lib/error-utils";
import { connection } from "next/server";


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

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get("entityType");
    const queryParam = searchParams.get("query");
    const actionType = searchParams.get("actionType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (entityType && entityType !== "all") query = query.eq("entity_type", entityType);
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

    const { data: logs, error } = await query;

    if (error) throw error;

    // Manual join since audit_logs has no FK to profiles
    const adminIds = [...new Set((logs || []).map(l => l.admin_id).filter(Boolean))];
    let profilesMap = new Map();

    if (adminIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", adminIds);
      
      profiles?.forEach(p => profilesMap.set(p.id, p));
    }

    const logsWithProfiles = (logs || []).map(log => ({
      ...log,
      profiles: profilesMap.get(log.admin_id) || null
    }));

    const formatParam = searchParams.get("format") || "csv";
    const columnsParam = searchParams.get("columns");

    // Build Export Content
    const selectedCols = columnsParam
      ? columnsParam.split(",")
      : ["created_at", "full_name", "email", "entity_type", "action", "reason", "old_value", "new_value", "details"];

    if (formatParam === "json") {
      const jsonLogs = (logsWithProfiles || []).map((log) => {
        const item: Record<string, unknown> = {};
        selectedCols.forEach((col) => {
          if (col === "created_at") item.created_at = log.created_at;
          else if (col === "full_name") item.admin_name = log.profiles?.full_name || "Unknown";
          else if (col === "email") item.admin_email = log.profiles?.email || "";
          else if (col === "entity_type") item.entity_type = log.entity_type;
          else if (col === "action") item.action = log.action;
          else if (col === "reason") item.reason = log.reason;
          else if (col === "old_value") item.old_value = log.old_value;
          else if (col === "new_value") item.new_value = log.new_value;
          else if (col === "details") item.details = log.details;
          else if (col in log) item[col] = log[col as keyof typeof log];
        });
        return item;
      });

      return new NextResponse(JSON.stringify(jsonLogs, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit_logs_${format(new Date(), "yyyyMMdd_HHmm")}.json"`,
        },
      });
    }

    // Default to CSV
    const headerMap: Record<string, string> = {
      created_at: "Timestamp",
      full_name: "Admin Name",
      email: "Email",
      entity_type: "Entity",
      action: "Action",
      reason: "Reason",
      old_value: "Old Value",
      new_value: "New Value",
      details: "Details",
    };

    const headers = selectedCols.map((col) => headerMap[col] || col);

    const rows = (logsWithProfiles || []).map((log) => {
      return selectedCols.map((col) => {
        let val: unknown = "";
        if (col === "created_at") {
          val = log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "";
        } else if (col === "full_name") {
          val = log.profiles?.full_name || "Unknown";
        } else if (col === "email") {
          val = log.profiles?.email || "";
        } else if (col === "old_value") {
          val = log.old_value ? JSON.stringify(log.old_value) : "";
        } else if (col === "new_value") {
          val = log.new_value ? JSON.stringify(log.new_value) : "";
        } else if (col === "details") {
          val = log.details ? JSON.stringify(log.details) : "";
        } else {
          val = log[col as keyof typeof log] || "";
        }

        const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n") || strVal.includes("\r")) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit_logs_${format(new Date(), "yyyyMMdd_HHmm")}.csv"`,
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      return new Response(null, { status: 499 });
    }
    console.error("Error exporting audit logs:", error);
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: 500 }
    );
  }
}
