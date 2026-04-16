import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";

interface HardDeleteRequest {
  userId: string;
  reason?: string;
  confirmationCode?: string;
}

export const POST = withAuthApi(async (request, { supabase, profile }) => {
  let body: HardDeleteRequest;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "BAD_REQUEST", 400);
  }

  const { userId, reason } = body;

  if (!userId) {
    return apiError("userId is required", "ID_REQUIRED", 400);
  }

  // Verify the user exists
  const { data: targetUser, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .single();

  if (targetError || !targetUser) {
    return apiError("User not found", "USER_NOT_FOUND", 404);
  }

  // Execute hard delete via database function
  const { data, error } = await supabase.rpc(
    "hard_delete_user_profile",
    {
      p_user_id: userId,
      p_reason: reason || `Deletion requested by ${String(profile.id)}`,
    }
  );

  if (error) {
    return apiError(error.message || "Hard delete failed", "HARD_DELETE_FAILED", 500);
  }

  const rpcSuccess = Boolean(
    data && 
    typeof data === "object" && 
    "success" in data && 
    (data as { success?: boolean }).success
  );
  
  if (!rpcSuccess) {
    const message =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : "Deletion procedure did not complete";
    return apiError(message, "DELETE_FAILED", 400);
  }

  // Log the deletion action in our app
  await supabase.from("audit_logs").insert([
    {
      admin_id: profile.id,
      entity_type: "profile_deletion",
      entity_id: userId,
      action: "hard_delete",
      reason: `GDPR RTE: ${reason || "User-initiated deletion"}`,
    },
  ]);

  return apiSuccess({
    message: "User profile anonymized successfully",
    result: data,
  });
}, { allowedRoles: ['admin'] });

