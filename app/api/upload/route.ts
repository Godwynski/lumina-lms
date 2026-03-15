import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

// Allowed MIME types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate random UUID
    const uuid = crypto.randomUUID();
    
    // Extract extension safely
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${uuid}.${ext}`;
    
    // Save to public/uploads/covers
    const path = join(process.cwd(), "public", "uploads", "covers", filename);
    await writeFile(path, buffer);

    return NextResponse.json({ 
      success: true, 
      cover_url: `/uploads/covers/${filename}` 
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
