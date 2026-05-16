"use server";

import { getMe } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "./action-utils";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";

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
  z.object({ 
    cardNumber: z.string(),
    isManual: z.boolean().default(false)
  }),
  async ({ cardNumber, isManual }, { supabase }) => {
    const cleanCardNumber = cardNumber.trim();
    
    // 1. Find user by card number
    const { data: card, error: cardError } = await supabase
      .from("library_cards")
      .select("user_id, profiles(full_name, status)")
      .eq("card_number", cleanCardNumber)
      .ilike("status", "active")
      .maybeSingle();

    if (cardError) {
      logger.error("Attendance", "Failed to query library card", { cardNumber: cleanCardNumber }, cardError);
      throw new Error("Database error while checking library card.");
    }

    let userId: string;
    let profile: { id?: string; full_name: string | null; status: string | null } | null;

    if (!card) {
      // Fallback: Check if it's a student ID in profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, status")
        .eq("student_id", cleanCardNumber)
        .maybeSingle();
      
      if (profileError) {
        logger.error("Attendance", "Failed to query profile by student ID", { studentId: cleanCardNumber }, profileError);
        throw new Error("Database error while checking student ID.");
      }

      if (!profileData) {
        const errorMessage = isManual
          ? "The identifier is not recognized by the system. Please ensure the user has an active account."
          : "Invalid or inactive library card. Please ensure the card is activated in the system.";
        throw new Error(errorMessage);
      }
      
      userId = profileData.id;
      profile = profileData;
    } else {
      userId = card.user_id;
      profile = Array.isArray(card.profiles) ? card.profiles[0] : card.profiles;
    }
    
    if (profile?.status?.toUpperCase() !== 'ACTIVE') {
      throw new Error(`User account is ${profile?.status?.toLowerCase() || 'inactive'}. Attendance restricted.`);
    }

    const fullName = profile?.full_name || "User";

    // 2. Check for active attendance record
    const { data: activeRecord, error: activeError } = await supabase
      .from("attendance")
      .select("id, check_in_at")
      .eq("user_id", userId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      logger.error("Attendance", "Failed to query active record", { userId }, activeError);
      throw new Error("Database error while checking active sessions.");
    }

    if (activeRecord) {
      // LOG OUT
      const { error: outError } = await supabase
        .from("attendance")
        .update({ check_out_at: new Date().toISOString() })
        .eq("id", activeRecord.id);

      if (outError) throw new Error("Failed to register Time Out.");

      // Notify the user
      await sendNotification({
        userId,
        title: "Attendance: Time Out",
        content: `You have successfully recorded your Time Out at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}.`,
        type: "SYSTEM",
        priority: "medium"
      });

      revalidatePath("/attendance", "page");
      revalidatePath("/dashboard", "page");
      
      return { 
        status: "OUT", 
        message: `Goodbye, ${fullName}!`,
        description: "Timed out successfully.",
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

      if (inError) throw new Error("Failed to register Time In.");

      // Notify the user
      await sendNotification({
        userId,
        title: "Attendance: Time In",
        content: `You have successfully recorded your Time In at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}.`,
        type: "SYSTEM",
        priority: "medium"
      });

      revalidatePath("/attendance", "page");
      revalidatePath("/dashboard", "page");
      
      return { 
        status: "IN", 
        message: `Welcome, ${fullName}!`,
        description: "Timed in successfully.",
        userName: fullName
      };
    }
  },
  { 
    allowedRoles: ['admin', 'librarian', 'student_assistant'],
    allowedPermissions: ['manage_attendance']
  }
);



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

    revalidatePath("/attendance", "page");
    
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

    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Attendance", "Failed to delete attendance", { id }, deleteError);
      throw new Error("Failed to delete attendance record.");
    }

    logger.info("Attendance", "Attendance record deleted", { id });
    revalidatePath("/attendance", "page");

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

