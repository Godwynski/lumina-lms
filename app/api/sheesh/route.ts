import { createAdminClient } from "@/lib/supabase/admin";
import { 
  clearDatabase, 
  seedDatabase, 
  clearLogsAndBorrows, 
  seedLogsAndBorrows, 
  clearCatalog, 
  seedCatalog 
} from "@/lib/db-actions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    const adminClient = createAdminClient();

    let logs: string[] = [];

    switch (action) {
      case "seed":
      case "seed-all":
        logs = await seedDatabase(adminClient);
        break;
      case "clear":
      case "clear-all":
        logs = await clearDatabase(adminClient);
        break;
      case "clear-logs-borrows":
        logs = await clearLogsAndBorrows(adminClient);
        break;
      case "seed-logs-borrows":
        logs = await seedLogsAndBorrows(adminClient);
        break;
      case "clear-catalog":
        logs = await clearCatalog(adminClient);
        break;
      case "seed-catalog":
        logs = await seedCatalog(adminClient);
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Error in /api/sheesh route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
export const dynamic = "force-dynamic";
