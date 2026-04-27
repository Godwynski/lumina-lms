import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await request.json();

    // Update status to archived instead of hard delete
    const { error } = await supabase
      .from("profiles")
      .update({ 
        status: "archived",
        updated_at: new Date().toISOString()
      })
      .eq("id", user.user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Sign out the user after deletion
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Your account has been archived successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
