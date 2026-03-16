import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";

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
      .select("access_level")
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

    const nodeStream = createReadStream(filePath);
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
        "Content-Type": fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/epub+zip",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Streaming error:", error);
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }
}
