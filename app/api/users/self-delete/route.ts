import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SelfDeleteRequest {
  reason?: string;
}

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

    const body: SelfDeleteRequest = await request.json();
    const { reason } = body;

    // Call the hard delete RPC function
    const { data, error } = await supabase.rpc(
      "hard_delete_user_profile",
      {
        p_user_id: user.user.id,
        p_reason: reason || `Self-deletion requested by user`,
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rpcSuccess = Boolean(data && typeof data === "object" && "success" in data && (data as { success?: boolean }).success);
    if (!rpcSuccess) {
      const message =
        data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : "Deletion procedure did not complete";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Sign out the user after deletion
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Your account has been deleted successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
