import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "node:crypto";

const ALLOWED_MIMES = ["application/pdf", "application/epub+zip"];
const UPLOAD_ROOT = process.env.UPLOAD_PATH || "C:/uploads/resources";

function parsePublishedYear(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const year = Number.parseInt(raw, 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1000 || year > currentYear + 1) {
    throw new Error("Invalid published year.");
  }
  return year;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role - only librarians and admins can upload
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const author = formData.get("author") as string;
    const type = formData.get("type") as string;
    const categoryId = formData.get("categoryId") as string;
    const accessLevel = formData.get("accessLevel") as string;
    const publishedYear = parsePublishedYear(formData.get("publishedYear"));

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only PDF and EPUB are allowed." }, { status: 400 });
    }

    const fileExtension = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    const filePath = path.join(UPLOAD_ROOT, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);

    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(2);

    const { data: resource, error: dbError } = await supabase
      .from("digital_resources")
      .insert({
        title,
        author,
        file_path: fileName, // Store only the base name
        file_size_mb: parseFloat(fileSizeMb),
        type,
        category_id: categoryId || null,
        access_level: accessLevel || "STUDENT",
        published_year: publishedYear,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ success: true, resource });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload resource";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
