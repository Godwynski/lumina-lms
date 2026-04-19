import { revalidatePath } from "next/cache";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { logAuditActivity } from "@/lib/audit";
import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";

function isValidPolicyValue(key: string, value: string) {
  const numberLikeKeys = ["days", "limit", "count", "years", "fine", "amount"];
  if (numberLikeKeys.some((token) => key.includes(token))) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }
  return value.trim().length > 0;
}

export const GET = withAuthApi(
  async (request, { supabase }) => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 400);
    }

    return apiSuccess(data);
  },
  { allowedRoles: ["admin", "librarian"] }
);

export const POST = withAuthApi(
  async (request, { supabase, user }) => {
    const body = await request.json();
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const value = typeof body.value === "string" ? body.value.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES]?.description;
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    if (!key || !value) {
      return apiError("key and value are required", "BAD_REQUEST", 400);
    }

    if (!isValidPolicyValue(key, value)) {
      return apiError("Invalid policy value", "BAD_REQUEST", 400);
    }

    // Check if exists
    const { data: existing } = await supabase
      .from("system_settings")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("system_settings")
        .update({
          value,
          description,
          updated_by: user.id,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("system_settings")
        .insert([{ key, value, description, updated_by: user.id }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Log the change
    await logAuditActivity(
      user.id,
      "system",
      result.id,
      `Updated policy: ${key}`,
      reason || `Updated ${key} to ${value}`
    );

    revalidatePath("/policies", "page");

    return apiSuccess(result);
  },
  { allowedRoles: ["admin"] }
);
