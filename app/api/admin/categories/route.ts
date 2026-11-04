import { NextResponse } from "next/server";
import { isAbortError } from "@/lib/error-utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { withAuthApi } from "@/lib/api-utils";
import { logAuditActivity } from "@/lib/audit";
import { toSlug } from "@/lib/utils";
import { CategoryCreateSchema } from "@/lib/validations/api";

const MANAGERS = { allowedRoles: ["super_admin" as const, "librarian" as const] };

export const GET = withAuthApi(async (_req, { supabase }) => {
  try {
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
}, MANAGERS);

export const POST = withAuthApi(async (request, { user, supabase }) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = CategoryCreateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "name and slug are required" },
        { status: 400 }
      );
    }

    const { name, slug: rawSlug, description } = parseResult.data;
    const slug = toSlug(rawSlug || name);

    const { data, error } = await supabase
      .from("categories")
      .insert([{ name, slug, description, is_active: true }])
      .select()
      .single();

    if (error) throw error;

    await logAuditActivity(
      user.id,
      "category",
      data.id,
      "category_created",
      `Created book category: ${name}`,
      { slug, description },
      null,
      data
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
}, MANAGERS);
