import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["ebook", "journal", "thesis", "report", "other"];
const ALLOWED_ACCESS_LEVELS = ["STUDENT", "STAFF", "LIBRARIAN"];

function parsePublishedYear(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const year = Number.parseInt(raw, 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1000 || year > currentYear + 1) {
    throw new Error("Invalid published year.");
  }
  return year;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const title = String(body.title || "").trim();
    const author = String(body.author || "").trim();
    const type = String(body.type || "").trim().toLowerCase();
    const accessLevel = String(body.accessLevel || "").trim().toUpperCase();
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    const publishedYear = parsePublishedYear(body.publishedYear);

    if (!title || !author) {
      return NextResponse.json(
        { error: "Title and author are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid resource type." }, { status: 400 });
    }

    if (!ALLOWED_ACCESS_LEVELS.includes(accessLevel)) {
      return NextResponse.json({ error: "Invalid access level." }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("digital_resources")
      .update({
        title,
        author,
        type,
        category_id: categoryId,
        access_level: accessLevel,
        published_year: publishedYear,
      })
      .eq("id", resourceId)
      .select("id, title, author, type, category_id, access_level, published_year")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, resource: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Invalid request payload." },
      { status: 400 }
    );
  }
}
