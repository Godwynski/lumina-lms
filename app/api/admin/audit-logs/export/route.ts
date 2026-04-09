import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
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
    const entityType = searchParams.get("entityType");
    const queryParam = searchParams.get("query");

    let query = supabase
      .from("audit_logs")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });

    if (entityType && entityType !== "all") {
      query = query.eq("entity_type", entityType);
    }
    
    if (queryParam) {
      const safe = sanitizeFilterInput(queryParam);
      query = query.or(`entity_type.ilike.%${safe}%,action.ilike.%${safe}%`);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Build CSV content
    const headers = ["Timestamp", "Admin", "Email", "Entity", "Action", "Reason", "Old Value", "New Value"];
    const rows = (logs || []).map((log) => [
      log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "",
      log.profiles?.full_name || "Unknown",
      log.profiles?.email || "",
      log.entity_type,
      log.action,
      `"${(log.reason || "").replace(/"/g, '""')}"`,
      `"${(log.old_value || "").replace(/"/g, '""')}"`,
      `"${(log.new_value || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit_logs_${format(new Date(), "yyyyMMdd_HHmm")}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: 500 }
    );
  }
}
