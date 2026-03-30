import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat, readFile, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";

const UPLOAD_ROOT = process.env.UPLOAD_PATH || "C:/uploads/resources";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const { fileName: rawFileName } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sanitize fileName to prevent path traversal
  const fileName = path.basename(rawFileName);
  const filePath = path.join(UPLOAD_ROOT, fileName);

  try {
    const fileStat = await stat(filePath);
    
    // Check if user has access to this resource
    const { data: resource } = await supabase
      .from("digital_resources")
      .select("title, access_level, type")
      .eq("file_path", fileName)
      .single();

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Access control logic
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    type Role = "admin" | "librarian" | "staff" | "student";
    const rolesPriority: Record<Role, number> = { "admin": 4, "librarian": 3, "staff": 2, "student": 1 };
    
    const userRole = (profile?.role || "student") as Role;
    const resourceAccessLevel = resource.access_level.toLowerCase() as Role;
    
    const userPriority = rolesPriority[userRole] || 1;
    const requiredPriority = rolesPriority[resourceAccessLevel] || 1;

    if (userPriority < requiredPriority) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const safeTitle = resource.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const extension = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";

    // --- NEW LOGIC: Truncate and obscure Capstone/Thesis PDFs ---
    const resourceType = (resource.type || "").toLowerCase();
    const isRestrictedTarget = extension === "pdf" && (resourceType.includes("capstone") || resourceType.includes("thesis"));

    let servePath = filePath;
    let serveSize = fileStat.size;

    if (isRestrictedTarget) {
      const restrictedFileName = `restricted_${fileName}`;
      const restrictedFilePath = path.join(UPLOAD_ROOT, restrictedFileName);

      try {
        // If cached truncated version exists, serve that directly
        const restrictedStat = await stat(restrictedFilePath);
        servePath = restrictedFilePath;
        serveSize = restrictedStat.size;
      } catch {
        // Cached restricted version does not exist, let's generate it
        try {
          const pdfBytes = await readFile(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const numPages = pdfDoc.getPageCount();

          const newPdf = await PDFDocument.create();

          // 1. Copy first 5 pages (Indices 0 to 4)
          const pagesToCopy = Math.min(5, numPages);
          if (pagesToCopy > 0) {
            const copiedPages = await newPdf.copyPages(
              pdfDoc,
              Array.from({ length: pagesToCopy }, (_, i) => i)
            );
            copiedPages.forEach((p) => newPdf.addPage(p));
          }

          // 2. Obscure the next 2 pages (Indices 5 to 6)
          if (numPages > 5) {
            const blurPagesCount = Math.min(2, numPages - 5);
            const blurredPages = await newPdf.copyPages(
              pdfDoc,
              Array.from({ length: blurPagesCount }, (_, i) => i + 5)
            );

            blurredPages.forEach((p) => {
              const { width, height } = p.getSize();
              // Draw an opaque rectangle over the entire page to hide content completely
              p.drawRectangle({
                x: 0,
                y: 0,
                width,
                height,
                color: rgb(0.95, 0.95, 0.95), // Light gray blanking out
                opacity: 0.98,
              });
              
              // Draw Watermark
              p.drawText("You can only view it inside the library physically", {
                x: width / 2 - 250, // crude centering
                y: height / 2,
                size: 20,
                color: rgb(0.2, 0.2, 0.2), // Dark text
              });
              // Draw smaller subtitle
              p.drawText("(Remaining content is fully restricted online.)", {
                x: width / 2 - 180, // crude centering
                y: height / 2 - 40,
                size: 14,
                color: rgb(0.4, 0.4, 0.4), // Darker gray
              });

              newPdf.addPage(p);
            });
          }

          // 3. Drop remaining pages (>= 7) internally by just not copying them!

          const modifiedPdfBytes = await newPdf.save();
          await writeFile(restrictedFilePath, modifiedPdfBytes);
          
          servePath = restrictedFilePath;
          serveSize = modifiedPdfBytes.length;
        } catch (genError) {
          console.error("PDF Truncation Generation Error:", genError);
          // If truncation somehow breaks, fail securely by throwing an error
          return NextResponse.json({ error: "Failed to load safe resource preview" }, { status: 500 });
        }
      }
    }
    // --- END NEW LOGIC ---

    const nodeStream = createReadStream(servePath);
    const stream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": extension === "pdf" ? "application/pdf" : "application/epub+zip",
        "Content-Length": serveSize.toString(),
        "Content-Disposition": `inline; filename="${safeTitle}.${extension}"`,
      },
    });
  } catch (error) {
    console.error("Streaming error:", error);
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }
}
