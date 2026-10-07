import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toSlug } from "@/lib/utils";
import { CategoryUpdateSchema } from "@/lib/validations/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!profile || !["super_admin", "librarian"].includes(String(profile.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!["super_admin", "librarian"].includes(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = CategoryUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid category update" },
        { status: 400 }
      );
    }

    const body = parseResult.data;
    const { id } = await params;

    // Fetch existing record for partial update
    const { data: existing, error: fetchError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const name = body.name !== undefined ? body.name : existing.name;
    const rawSlug = body.slug !== undefined ? body.slug : existing.slug;
    const slug = toSlug(rawSlug || name);
    const description = body.description !== undefined ? body.description : existing.description;
    const is_active = body.is_active !== undefined ? body.is_active : existing.is_active;

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("categories")
      .update({
        name,
        slug,
        description,
        is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
