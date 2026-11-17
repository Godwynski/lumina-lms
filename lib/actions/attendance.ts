"use server";

import { getMe } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "./action-utils";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { isValidPolicyValue } from "./policy-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AttendanceRecord {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  user_id: string;
  notes?: string | null;
  profiles?: {
    full_name: string | null;
    student_id?: string | null;
  };
}

export type AttendanceActionStatus = "IN" | "OUT" | "ALREADY_IN" | "NOT_CHECKED_IN";
export type AttendanceActionOutcome =
  | "CHECKED_IN"
  | "UPDATED"
  | "ALREADY_IN"
  | "CHECKED_OUT"
  | "NOT_CHECKED_IN";

export interface AttendanceActionResult {
  status: AttendanceActionStatus;
  outcome: AttendanceActionOutcome;
  recordedAt: string | null;
  message: string;
  description: string;
  userName: string;
  userId: string;
}

const RECENT_CHECKIN_WINDOW_MS = 60_000;
const DEFAULT_CLOSING_TIME = "17:00";
const STALE_CHECKOUT_NOTES = "No Log Out";

function getManilaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function getLibraryClosingTime(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "library_closing_time")
    .maybeSingle();

  const raw = typeof data?.value === "string" ? data.value.trim() : "";
  if (!error && raw && isValidPolicyValue("library_closing_time", raw)) {
    return raw;
  }
  return DEFAULT_CLOSING_TIME;
}

/**
 * Determines whether an open attendance session is stale (from an earlier Manila day) and
 * computes GREATEST(check_in_at, closing_time) for it. A same-day session stays open after
 * closing time so evening check-outs and repeat scans behave normally (P4-ATT-003/006).
 */
function computeStaleAttendanceState(
  checkInIso: string,
  nowMs: number,
  closingTimeHHMM: string
): { isStale: boolean; staleCheckOutAt: string } {
  const checkInDate = new Date(checkInIso);
  const checkInManilaDate = getManilaDateString(checkInDate);
  const nowManilaDate = getManilaDateString(new Date(nowMs));
  const closingAtMs = new Date(`${checkInManilaDate}T${closingTimeHHMM}:00+08:00`).getTime();
  const staleCheckOutAt = new Date(Math.max(checkInDate.getTime(), closingAtMs)).toISOString();
  const isStale = checkInManilaDate < nowManilaDate;
  return { isStale, staleCheckOutAt };
}

/**
 * Records an explicit check-in or check-out for a patron by library card or student ID.
 * Identical rules apply for QR camera scans and manual entries.
 */
export const recordAttendanceByCard = createSafeAction(
  z.object({
    cardNumber: z.string(),
    mode: z.enum(["in", "out"]),
    isManual: z.boolean().default(false),
  }),
  async ({ cardNumber, mode, isManual }, { supabase }): Promise<AttendanceActionResult> => {
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

    if (profile?.status?.toUpperCase() !== "ACTIVE") {
      throw new Error(`User account is ${profile?.status?.toLowerCase() || "inactive"}. Attendance restricted.`);
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

    const nowMs = Date.now();
    const recordedAt = new Date(nowMs).toISOString();
    const staleState = activeRecord
      ? computeStaleAttendanceState(
          activeRecord.check_in_at,
          nowMs,
          await getLibraryClosingTime(supabase)
        )
      : null;

    if (mode === "in") {
      if (activeRecord && staleState?.isStale) {
        const { error: closeStaleError } = await supabase
          .from("attendance")
          .update({
            check_out_at: staleState.staleCheckOutAt,
            notes: STALE_CHECKOUT_NOTES,
          })
          .eq("id", activeRecord.id);

        if (closeStaleError) {
          throw new Error("Failed to close previous attendance session.");
        }
      } else if (activeRecord) {
        const ageMs = nowMs - new Date(activeRecord.check_in_at).getTime();
        if (ageMs < RECENT_CHECKIN_WINDOW_MS) {
          const { error: updateError } = await supabase
            .from("attendance")
            .update({ check_in_at: recordedAt })
            .eq("id", activeRecord.id);

          if (updateError) throw new Error("Failed to update Time In.");

          revalidatePath("/attendance", "page");
          revalidatePath("/dashboard", "page");

          return {
            status: "IN",
            outcome: "UPDATED",
            recordedAt,
            message: `Check-in updated for ${fullName}.`,
            description: "Check-in time updated.",
            userName: fullName,
            userId,
          };
        }

        return {
          status: "ALREADY_IN",
          outcome: "ALREADY_IN",
          recordedAt: activeRecord.check_in_at,
          message: "You are already checked in",
          description: `${fullName} is already checked in.`,
          userName: fullName,
          userId,
        };
      }

      const { error: inError } = await supabase
        .from("attendance")
        .insert({
          user_id: userId,
          check_in_at: recordedAt,
        });

      if (inError) {
        if (inError.code === "23505" || inError.message?.includes("duplicate key") || inError.message?.includes("attendance_user_active_idx")) {
          throw new Error("An active attendance session is already in progress for this card.");
        }
        throw new Error("Failed to register Time In.");
      }

      await sendNotification({
        userId,
        title: "Attendance: Time In",
        content: `You have successfully recorded your Time In at ${new Date(nowMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}.`,
        type: "SYSTEM",
        priority: "medium",
      });

      revalidatePath("/attendance", "page");
      revalidatePath("/dashboard", "page");

      return {
        status: "IN",
        outcome: "CHECKED_IN",
        recordedAt,
        message: `Welcome, ${fullName}!`,
        description: "Timed in successfully.",
        userName: fullName,
        userId,
      };
    }

    // mode === "out"
    if (!activeRecord) {
      return {
        status: "NOT_CHECKED_IN",
        outcome: "NOT_CHECKED_IN",
        recordedAt: null,
        message: `${fullName} is not currently checked in.`,
        description: "No active check-in session found.",
        userName: fullName,
        userId,
      };
    }

    if (staleState?.isStale) {
      const { error: outError } = await supabase
        .from("attendance")
        .update({
          check_out_at: staleState.staleCheckOutAt,
          notes: STALE_CHECKOUT_NOTES,
        })
        .eq("id", activeRecord.id);

      if (outError) throw new Error("Failed to register Time Out.");

      await sendNotification({
        userId,
        title: "Attendance: Time Out",
        content: `Your previous attendance session was closed as No Log Out at ${new Date(staleState.staleCheckOutAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}.`,
        type: "SYSTEM",
        priority: "medium",
      });

      revalidatePath("/attendance", "page");
      revalidatePath("/dashboard", "page");

      return {
        status: "OUT",
        outcome: "CHECKED_OUT",
        recordedAt: staleState.staleCheckOutAt,
        message: `Previous check-in for ${fullName} closed as No Log Out.`,
        description: "Closed previous session as No Log Out.",
        userName: fullName,
        userId,
      };
    }

    const { error: outError } = await supabase
      .from("attendance")
      .update({ check_out_at: recordedAt })
      .eq("id", activeRecord.id);

    if (outError) throw new Error("Failed to register Time Out.");

    await sendNotification({
      userId,
      title: "Attendance: Time Out",
      content: `You have successfully recorded your Time Out at ${new Date(nowMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}.`,
      type: "SYSTEM",
      priority: "medium",
    });

    revalidatePath("/attendance", "page");
    revalidatePath("/dashboard", "page");

    return {
      status: "OUT",
      outcome: "CHECKED_OUT",
      recordedAt,
      message: `Goodbye, ${fullName}!`,
      description: "Timed out successfully.",
      userName: fullName,
      userId,
    };
  },
  {
    allowedRoles: ["super_admin", "librarian", "library_staff"],
    allowedPermissions: ["manage_attendance"],
  }
);



export async function getAttendanceHistory(
  userId?: string, 
  options?: { range?: 'today' | 'all'; limit?: number; search?: string }
) {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");

  const { supabase } = me;
  
  const isStaff = me.role === 'super_admin' || 
                  me.role === 'librarian' || 
                  (me.role === 'library_staff' && 
                   me.profile?.status?.toUpperCase() === 'ACTIVE' &&
                   me.profile.permissions?.manage_attendance);

  const PAGE_SIZE = 1000;
  const MAX_ROWS = 10000;

  // If no userId provided and is staff, show system records (today or all)
  if (!userId && isStaff) {
    const range = options?.range || 'today';
    const manilaStr = range === 'today'
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
      : null;

    if (options?.limit) {
      // Strip characters that have meaning in PostgREST filter syntax.
      const search = options.search?.replace(/[,()%*\\:]/g, " ").trim();

      let query = supabase
        .from("attendance")
        .select(
          search
            ? "id, check_in_at, check_out_at, user_id, notes, profiles!inner(full_name, student_id)"
            : "id, check_in_at, check_out_at, user_id, notes, profiles(full_name, student_id)"
        );

      if (manilaStr) {
        query = query.gte("check_in_at", `${manilaStr}T00:00:00+08:00`);
      }

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`, {
          referencedTable: "profiles",
        });
      }

      const { data, error } = await query
        .order("check_in_at", { ascending: false })
        .limit(options.limit);

      if (error) throw error;
      return (data || []).map(record => ({
        ...record,
        profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
      })) as unknown as AttendanceRecord[];
    }

    const allData: Record<string, unknown>[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      let query = supabase
        .from("attendance")
        .select("id, check_in_at, check_out_at, user_id, notes, profiles(full_name, student_id)");

      if (manilaStr) {
        query = query.gte("check_in_at", `${manilaStr}T00:00:00+08:00`);
      }

      const { data: pageData, error } = await query
        .order("check_in_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const batch = (pageData || []) as Record<string, unknown>[];
      allData.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    return allData.map(record => ({
      ...record,
      profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
    })) as unknown as AttendanceRecord[];
  }

  // Otherwise show specific user's history (defaulting to current user)
  const targetId = userId || me.user.id;

  if (targetId !== me.user.id && !isStaff) {
    throw new Error("Forbidden");
  }

  if (options?.limit) {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, check_in_at, check_out_at, user_id, notes, profiles(full_name, student_id)")
      .eq("user_id", targetId)
      .order("check_in_at", { ascending: false })
      .limit(options.limit);

    if (error) throw error;
    return (data || []).map(record => ({
      ...record,
      profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
    })) as unknown as AttendanceRecord[];
  }

  const allUserRecords: Record<string, unknown>[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data: pageData, error } = await supabase
      .from("attendance")
      .select("id, check_in_at, check_out_at, user_id, notes, profiles(full_name, student_id)")
      .eq("user_id", targetId)
      .order("check_in_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (pageData || []) as Record<string, unknown>[];
    allUserRecords.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return allUserRecords.map(record => ({
    ...record,
    profiles: Array.isArray(record.profiles) ? record.profiles[0] : record.profiles
  })) as unknown as AttendanceRecord[];
}




