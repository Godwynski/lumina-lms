import { NextResponse } from "next/server";
import crypto from "crypto";
import sharp from "sharp";
import { withAuthApi } from "@/lib/api-utils";
import { fetchImage, ImageFetchError } from "@/lib/fetch-image";

// Allowed MIME types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const POST = withAuthApi(async (_req, { supabase }) => {
  try {
    const data = await _req.formData();
    const file: File | null = data.get("file") as unknown as File;
    const url: string | null = data.get("url") as string | null;

    let buffer: Buffer;

    if (file) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        return NextResponse.json({ error: "File too large. Maximum upload size is 5MB." }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
    } else if (url) {
      try {
        const remote = await fetchImage(url);
        if (!ALLOWED_MIME_TYPES.includes(remote.contentType)) {
          return NextResponse.json({ error: "Remote image is in an invalid format." }, { status: 400 });
        }
        buffer = remote.buffer;
      } catch (e) {
        if (e instanceof ImageFetchError) {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        console.error("Failed to fetch remote image:", e);
        return NextResponse.json({ error: "Failed to fetch remote image" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "No file or URL provided" }, { status: 400 });
    }

    // Convert to WebP using Sharp
    try {
      buffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      console.error("Sharp conversion error:", err);
      // Fallback to original if conversion fails, though it shouldn't for supported types
    }

    // Generate random UUID
    const uuid = crypto.randomUUID();
    const filename = `${uuid}.webp`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('book-covers')
      .upload(filename, buffer, {
        contentType: "image/webp",
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase storage error:", uploadError);
      return NextResponse.json({ error: "Failed to upload to cloud storage" }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('book-covers')
      .getPublicUrl(filename);

    return NextResponse.json({ 
      success: true, 
      cover_url: publicUrl 
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}, { allowedRoles: ["super_admin", "librarian", "student_assistant"] });
