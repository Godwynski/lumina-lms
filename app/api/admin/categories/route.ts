import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isAbortError } from "@/lib/error-utils";
import { revalidatePath, revalidateTag } from "next/cache";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

    if (!profile || !["admin", "librarian"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin/librarian role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (!["admin", "librarian"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
