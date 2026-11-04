import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { toSlug } from "@/lib/utils";
import { CategoryUpdateSchema } from "@/lib/validations/api";
import { logAuditActivity } from "@/lib/audit";
import { withAuthApi } from "@/lib/api-utils";

export const GET = withAuthApi(async (_request, { supabase, params }) => {
  try {
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
}, { allowedRoles: ["super_admin", "librarian"] });

export const PUT = withAuthApi(async (request, { supabase, user, params }) => {
  try {
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

    await logAuditActivity(
      user.id,
      "category",
      id,
      "category_updated",
      `Updated book category: ${data.name}`,
      { updates: body },
      existing,
      data
    );

    revalidateTag("categories", "default");
    revalidatePath("/catalog", "page");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}, { allowedRoles: ["super_admin", "librarian"] });

export const DELETE = withAuthApi(async (_request, { supabase, user, params }) => {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    await logAuditActivity(
      user.id,
      "category",
      id,
      "category_archived",
      `Archived book category ID: ${id}`,
      null,
      { is_active: true },
      { is_active: false }
    );

    revalidateTag("categories", "default");
    revalidatePath("/catalog", "page");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}, { allowedRoles: ["super_admin"] });
