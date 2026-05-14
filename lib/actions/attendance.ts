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
  { 
    allowedRoles: ['admin', 'librarian', 'student_assistant'],
    allowedPermissions: ['manage_attendance']
  } // Only staff can use the scanner action? Or maybe public?
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
  
  const isStaff = me.role === 'admin' || 
                  me.role === 'librarian' || 
                  (me.role === 'student_assistant' && 
                   me.profile?.status?.toUpperCase() === 'ACTIVE' &&
                   me.profile.permissions?.manage_attendance);

  // If no userId provided and is staff, show all of today's records
  if (!userId && isStaff) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("attendance")
      .select("id, check_in_at, check_out_at, user_id, profiles(full_name)")
      .gte("check_in_at", today.toISOString())
      .order("check_in_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(record => ({
      ...record,
      profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
    })) as unknown as AttendanceRecord[];
  }

  // Otherwise show specific user's history (defaulting to current user)
  const targetId = userId || me.user.id;

  if (targetId !== me.user.id && !isStaff) {
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

/**
 * Updates an attendance record. Used by staff to fix errors.
 */
export const updateAttendance = createSafeAction(
  z.object({
    id: z.string(),
    updates: z.object({
      check_in_at: z.string().optional(),
      check_out_at: z.string().nullable().optional(),
      notes: z.string().nullable().optional()
    })
  }),
  async ({ id, updates }, { supabase }) => {
    const { data: oldData } = await supabase
      .from("attendance")
      .select("*")
      .eq("id", id)
      .single();

    if (!oldData) throw new Error("Attendance record not found.");

    const { data, error } = await supabase
      .from("attendance")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/attendance");
    
    return [data, {
      reason: `Updated attendance record for user ID: ${oldData.user_id}`,
      oldValue: oldData,
      newValue: data,
      details: { updatedFields: Object.keys(updates) }
    }];
  },
  {
    allowedRoles: ['admin', 'librarian'],
    allowedPermissions: ['manage_attendance'],
    auditAction: "update",
    auditEntity: "attendance"
  }
);

/**
 * Deletes an attendance record.
 */
export const deleteAttendance = createSafeAction(
  z.string(),
  async (id, { supabase }) => {
    const { data: oldData } = await supabase
      .from("attendance")
      .select("*")
      .eq("id", id)
      .single();

    if (!oldData) throw new Error("Attendance record not found.");

    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/attendance");

    return [{ success: true }, {
      reason: `Deleted attendance record for user ID: ${oldData.user_id}`,
      oldValue: oldData,
      auditAction: "delete",
      auditEntity: "attendance"
    }];
  },
  {
    allowedRoles: ['admin'],
    allowedPermissions: ['manage_attendance']
  }
);

/**
 * Gets attendance stats for the dashboard.
 */
export async function getAttendanceStats() {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  
  const { supabase } = me;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalToday, activeNow] = await Promise.all([
    supabase
      .from("attendance")
      .select("*", { count: 'exact', head: true })
      .gte("check_in_at", today.toISOString()),
    supabase
      .from("attendance")
      .select("*", { count: 'exact', head: true })
      .is("check_out_at", null)
  ]);

  return {
    todayCount: totalToday.count || 0,
    activeCount: activeNow.count || 0
  };
}
