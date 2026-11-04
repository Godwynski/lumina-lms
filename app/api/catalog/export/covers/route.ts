import { NextResponse } from "next/server";
import JSZip from "jszip";
import { withAuthApi } from "@/lib/api-utils";
import { fetchImage } from "@/lib/fetch-image";

export const GET = withAuthApi(async (_req, { supabase }) => {
  try {
    // Fetch all books that have cover URLs
    const { data: books, error } = await supabase
      .from("books")
      .select("title, cover_url, isbn")
      .not("cover_url", "is", null);

    if (error) {
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    const booksWithCovers = (books || []).filter(b => b.cover_url && b.cover_url.startsWith("http"));

    if (booksWithCovers.length === 0) {
      return NextResponse.json({ error: "No book covers found to export" }, { status: 404 });
    }

    const zip = new JSZip();
    const folder = zip.folder("book-covers");

    // Download images and add to zip
    const downloadPromises = booksWithCovers.map(async (book, index) => {
      try {
        const { buffer, contentType } = await fetchImage(book.cover_url!);

        // Build a safe filename using ISBN or title
        let safeName = book.isbn 
          ? book.isbn.trim() 
          : book.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
          
        if (!safeName) {
          safeName = `cover-${index + 1}`;
        }

        // Get extension from the content type
        let ext = "webp";
        if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
        
        folder?.file(`${safeName}.${ext}`, buffer);
      } catch (err) {
        console.error(`Failed to download cover for book "${book.title}":`, err);
      }
    });

    await Promise.all(downloadPromises);

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="lumina_book_covers.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("Failed to generate covers ZIP:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${errMsg}` }, { status: 500 });
  }
}, { allowedRoles: ["super_admin", "librarian", "student_assistant"] });
