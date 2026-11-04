import { sanitizeFilterInput } from "@/lib/utils";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { isAbortError } from "@/lib/error-utils";
import { connection } from "next/server";
import * as XLSX from "xlsx";
import { withAuthApi } from "@/lib/api-utils";

export const GET = withAuthApi(async (request, { supabase }) => {
  await connection();
  try {
    const searchParams = new URL(request.url).searchParams;
    const entityType = searchParams.get("entityType");
    const queryParam = searchParams.get("query");
    const actionType = searchParams.get("actionType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    let searchFilter: string | null = null;
    if (queryParam) {
      const safe = sanitizeFilterInput(queryParam);

      // Lookup profiles that match the search query by name or email
      const { data: matchingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);

      const profileIds = matchingProfiles?.map(p => p.id) || [];

      const orConditions = [
        `entity_type.ilike.%${safe}%`,
        `action.ilike.%${safe}%`,
        `reason.ilike.%${safe}%`
      ];

      // Add matching profile IDs to the search if found
      if (profileIds.length > 0) {
        orConditions.push(`admin_id.in.(${profileIds.join(',')})`);
      }

      searchFilter = orConditions.join(',');
    }

    // The API returns at most 1,000 rows per request, so page through everything that matches (M8).
    // Dates are whole days in Manila time, like the audit log screen (M9).
    const PAGE_SIZE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase rows, as before
    const logs: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (entityType && entityType !== "all") query = query.eq("entity_type", entityType);
      if (actionType) query = query.eq("action", actionType);
      if (startDate) query = query.gte("created_at", `${startDate}T00:00:00+08:00`);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999+08:00`);
      if (userId) query = query.eq("admin_id", userId);
      if (searchFilter) query = query.or(searchFilter);

      const { data: page, error } = await query;
      if (error) throw error;
      logs.push(...(page || []));
      if (!page || page.length < PAGE_SIZE) break;
    }

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
          // Manila wall-clock time ("sv-SE" gives yyyy-MM-dd HH:mm:ss); the server runs in UTC (M9).
          val = log.created_at ? new Date(log.created_at).toLocaleString("sv-SE", { timeZone: "Asia/Manila" }) : "";
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

        return val;
      });
    });

    if (formatParam === "xlsx") {
      const dataForXlsx = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(dataForXlsx);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="audit_logs_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx"`,
        },
      });
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(val => {
        let strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (/^[=+\-@\t\r]/.test(strVal)) {
          strVal = `'${strVal}`;
        }
        if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n") || strVal.includes("\r")) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(",")),
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
}, { allowedRoles: ["super_admin"] });
