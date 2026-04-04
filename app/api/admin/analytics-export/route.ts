import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  total_copies: number | null;
  available_copies: number | null;
  categories?: { name?: string | null } | null;
};

function parseRangeDays(value: string | null): 30 | 90 | 180 {
  if (value === "30" || value === "90" || value === "180") return Number(value) as 30 | 90 | 180;
  return 180;
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !["admin", "librarian", "staff"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const type = request.nextUrl.searchParams.get("type") || "titles";
    const rangeDays = parseRangeDays(request.nextUrl.searchParams.get("range"));

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - rangeDays + 1);

    const { data: booksData, error: booksError } = await supabase
      .from("books")
      .select("id, title, author, total_copies, available_copies, categories(name)")
      .eq("is_active", true)
      .limit(1000);

    if (booksError) {
      return NextResponse.json({ error: booksError.message }, { status: 500 });
    }

    const books = (booksData ?? []) as BookRow[];

    let csv = "";
    let fileName = "analytics-export.csv";

    if (type === "categories") {
      const categoryMap = new Map<string, { name: string; total: number; borrowed: number }>();
      for (const book of books) {
        const name = book.categories?.name?.trim() || "Uncategorized";
        const total = Math.max(0, Number(book.total_copies ?? 0));
        const available = Math.max(0, Number(book.available_copies ?? 0));
        const borrowed = Math.max(0, total - available);
        const prev = categoryMap.get(name) ?? { name, total: 0, borrowed: 0 };
        prev.total += total;
        prev.borrowed += borrowed;
        categoryMap.set(name, prev);
      }

      const rows = Array.from(categoryMap.values())
        .map((c) => ({
          category: c.name,
          total: c.total,
          borrowed: c.borrowed,
          utilization: c.total > 0 ? Math.round((c.borrowed / c.total) * 100) : 0,
        }))
        .sort((a, b) => b.borrowed - a.borrowed);

      csv = toCsv([
        ["Category", "Borrowed Copies", "Total Copies", "Utilization %", "Range Days", "Generated At"],
        ...rows.map((r) => [r.category, r.borrowed, r.total, r.utilization, rangeDays, now.toISOString()]),
      ]);
      fileName = `analytics-categories-${rangeDays}d.csv`;
    } else {
      const rows = books
        .map((book) => {
          const total = Math.max(0, Number(book.total_copies ?? 0));
          const available = Math.max(0, Number(book.available_copies ?? 0));
          const borrowed = Math.max(0, total - available);
          return {
            title: book.title,
            author: book.author || "Unknown",
            borrowed,
            total,
            utilization: total > 0 ? Math.round((borrowed / total) * 100) : 0,
          };
        })
        .sort((a, b) => b.utilization - a.utilization);

      csv = toCsv([
        ["Title", "Author", "Borrowed Copies", "Total Copies", "Utilization %", "Range Days", "Generated At"],
        ...rows.map((r) => [r.title, r.author, r.borrowed, r.total, r.utilization, rangeDays, now.toISOString()]),
      ]);
      fileName = `analytics-titles-${rangeDays}d.csv`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Analytics export error:", error);
    return NextResponse.json({ error: "Failed to export analytics" }, { status: 500 });
  }
}
