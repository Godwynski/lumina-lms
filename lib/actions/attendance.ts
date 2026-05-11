"use server";

import { getMe } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "./action-utils";
import { z } from "zod";

export interface AttendanceRecord {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  user_id: string;
  profiles?: {
    full_name: string | null;
  };
}

/**
 * Toggles attendance for a user based on their library card number.
 * If there's an open record (check_out_at is null), it logs them out.
 * Otherwise, it creates a new check-in record.
 */
export const toggleAttendanceByCard = createSafeAction(
  z.object({ cardNumber: z.string() }),
  async ({ cardNumber }, { supabase }) => {
    // 1. Find user by card number
    const { data: card, error: cardError } = await supabase
      .from("library_cards")
      .select("user_id, profiles(full_name)")
      .eq("card_number", cardNumber)
      .eq("status", "active")
      .single();

    if (cardError || !card) {
      throw new Error("Invalid or inactive library card.");
    }

    const userId = card.user_id;
    const profiles = card.profiles;
    const fullName = (Array.isArray(profiles) ? profiles[0] : profiles)?.full_name || "User";

    // 2. Check for active attendance record
    const { data: activeRecord } = await supabase
      .from("attendance")
      .select("id")
      .eq("user_id", userId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRecord) {
      // LOG OUT
      const { error: outError } = await supabase
        .from("attendance")
        .update({ check_out_at: new Date().toISOString() })
        .eq("id", activeRecord.id);

      if (outError) throw new Error("Failed to log out.");

      revalidatePath("/attendance");
      revalidatePath("/dashboard");
      return { 
        status: "OUT", 
        message: `Goodbye, ${fullName}! You have logged out.`,
        userName: fullName
      };
    } else {
      // LOG IN
      const { error: inError } = await supabase
        .from("attendance")
        .insert({
          user_id: userId,
          check_in_at: new Date().toISOString()
        });

      if (inError) throw new Error("Failed to log in.");

      revalidatePath("/attendance");
      revalidatePath("/dashboard");
      return { 
        status: "IN", 
        message: `Welcome to the Library, ${fullName}!`,
        userName: fullName
      };
    }
  },
  { allowedRoles: ['admin', 'librarian', 'student_assistant'] } // Only staff can use the scanner action? Or maybe public?
);

/**
 * Legacy/Simple check-in for the user themselves
 */
export async function logAttendance() {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");

  const { supabase, user } = me;

  // Check if already logged today and still in
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (existing) {
    // Log out
    await supabase.from("attendance").update({ check_out_at: new Date().toISOString() }).eq("id", existing.id);
    revalidatePath("/attendance");
    return { success: true, message: "Logged out successfully!" };
  }

  const { error } = await supabase
    .from("attendance")
    .insert({
      user_id: user.id,
      check_in_at: new Date().toISOString()
    });

  if (error) {
    return { success: false, message: "Failed to log attendance." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  
  return { success: true, message: "Checked in successfully!" };
}

export async function getAttendanceHistory(userId?: string) {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");

  const { supabase } = me;
  const targetId = userId || me.user.id;

  if (targetId !== me.user.id && !['admin', 'librarian', 'student_assistant'].includes(me.role)) {
    throw new Error("Forbidden");
  }

  const { data, error } = await supabase
    .from("attendance")
    .select("id, check_in_at, check_out_at, user_id, profiles(full_name)")
    .eq("user_id", targetId)
    .order("check_in_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(record => ({
    ...record,
    profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
  })) as unknown as AttendanceRecord[];
}
