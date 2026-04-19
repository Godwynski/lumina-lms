import { NextRequest, NextResponse } from "next/server";
import { isAbortError } from "@/lib/error-utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertRole } from "@/lib/auth-helpers";
import { logAuditActivity } from "@/lib/audit";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  try {
    const { supabase } = await assertRole(["admin", "librarian"]);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    if (isAbortError(error)) {
      return new Response(null, { status: 499 });
    }
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await assertRole(["admin", "librarian"]);

    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const name = rawName;
    const slug = toSlug(rawSlug || rawName);

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("categories")
      .insert([{ name, slug, description, is_active: true }])
      .select()
      .single();

    if (error) throw error;

    await logAuditActivity(
      user.id,
      "system",
      data.id,
      "category_created",
      `Created book category: ${name}`
    );

    revalidateTag("categories", "default");
    revalidatePath("/catalog", "page");

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (isAbortError(error)) {
      return new Response(null, { status: 499 });
    }
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
