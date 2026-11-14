'use server';

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFilterInput } from "@/lib/utils";
import { isAbortError } from "../error-utils";
import { createSafeAction } from "./action-utils";
import { SupabaseClient } from "@supabase/supabase-js";

type BookInfo = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

export type BorrowStatus = "ACTIVE" | "RETURNED" | "OVERDUE";

export type BorrowingRecord = {
  id: string;
  book_copy_id: string;
  user_id: string;
  status: BorrowStatus;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  copy_qr?: string | null;
  fine_amount?: number;
  fine_settled_at?: string | null;

  books: BookInfo | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    student_id: string | null;
  } | null;
};

interface HistoryRpcRow {
  id: string;
  book_copy_id: string;
  user_id: string;
  status: BorrowStatus;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  fine_amount?: number | string | null;
  fine_settled_at?: string | null;
  copy_qr?: string | null;
  total_count?: number | string;
  book_id?: string | null;
  book_title?: string | null;
  book_author?: string | null;
  book_cover_url?: string | null;
  profile_id?: string | null;
  profile_name?: string | null;
  profile_email?: string | null;
  profile_student_id?: string | null;
}

function manilaDateDayNumber(value: string | number | Date): number {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  const [y, m, d] = formatted.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function computeOverdueFine(
  record: { due_date: string; returned_at: string | null; status?: string; fine_amount?: number | string | null },
  fineRate = 5
): number {
  if (record.fine_amount != null) return Number(record.fine_amount);
  if (record.returned_at != null) return 0;
  const dueMs = new Date(record.due_date).getTime();
  if (Number.isNaN(dueMs)) return 0;
  const now = Date.now();
  if (now <= dueMs && record.status?.toUpperCase() !== "OVERDUE") return 0;
  const days = Math.max(1, manilaDateDayNumber(now) - manilaDateDayNumber(dueMs));
  return Number((days * fineRate).toFixed(2));
}

export async function getBorrowingHistory(
  userId: string | null,
  page: number = 1,
  pageSize: number = 10,
  statusFilter?: string,
  searchQuery?: string,
  preFetchedSupabase?: SupabaseClient
) {
  const supabase = preFetchedSupabase || await createClient();

  // Fast path: PostgreSQL RPC covering all fields (timeline dates, status, barcodes, books, patrons) in 1 query
  if (typeof supabase.rpc === 'function') {
    try {
      const sanitized = searchQuery ? sanitizeFilterInput(searchQuery) : '';
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_borrowing_history_v2', {
        p_user_id: userId,
        p_page: page,
        p_page_size: pageSize,
        p_status: statusFilter && statusFilter !== 'all' ? statusFilter : null,
        p_search: sanitized || null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const totalCount = rpcData.length > 0 ? Number(rpcData[0].total_count) : 0;
        const enriched: BorrowingRecord[] = rpcData.map((row: HistoryRpcRow) => ({
          id: row.id,
          book_copy_id: row.book_copy_id,
          user_id: row.user_id,
          status: row.status,
          borrowed_at: row.borrowed_at,
          due_date: row.due_date,
          returned_at: row.returned_at,
          copy_qr: row.copy_qr ?? null,
          fine_amount: computeOverdueFine(row),
          fine_settled_at: row.fine_settled_at ?? null,
          books: row.book_id ? {
            id: row.book_id,
            title: row.book_title || 'Unknown Title',
            author: row.book_author || 'Unknown Author',
            cover_url: row.book_cover_url || null,
          } : null,
          profiles: row.profile_id ? {
            id: row.profile_id,
            full_name: row.profile_name ?? null,
            email: row.profile_email ?? null,
            student_id: row.profile_student_id ?? null,
          } : null,
        }));

        return {
          records: enriched,
          totalCount,
        };
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Fallback to table builder if RPC fails or in mock test environment
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("borrowing_records")
    .select(`
      id, book_copy_id, user_id, status, borrowed_at, due_date, returned_at, fine_amount, fine_settled_at,
      book_copies!inner (
        qr_string,
        books!inner (
          id, title, author, cover_url
        )
      ),
      profiles:profiles!borrowing_records_user_id_fkey (
        id, full_name, email, student_id
      )
    `, { count: "exact" });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (statusFilter && statusFilter !== "all") {
    // Normalize to uppercase to match BorrowStatus enum in Postgres
    query = query.eq("status", statusFilter.toUpperCase());
  }

  if (searchQuery) {
    const sanitized = sanitizeFilterInput(searchQuery);
    if (!userId) {
      const { data: matchingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${sanitized}%,student_id.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
      const userIds = matchingProfiles?.map((p: { id: string }) => p.id) || [];

      const { data: matchingBooks } = await supabase
        .from("books")
        .select("id")
        .or(`title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`);
      const bookIds = matchingBooks?.map((b: { id: string }) => b.id) || [];

      let copyIds: string[] = [];
      if (bookIds.length > 0) {
        const { data: matchingCopies } = await supabase
          .from("book_copies")
          .select("id")
          .in("book_id", bookIds);
        copyIds = matchingCopies?.map((c: { id: string }) => c.id) || [];
      }

      if (userIds.length > 0 && copyIds.length > 0) {
        query = query.or(`user_id.in.(${userIds.join(",")}),book_copy_id.in.(${copyIds.join(",")})`);
      } else if (userIds.length > 0) {
        query = query.in("user_id", userIds);
      } else if (copyIds.length > 0) {
        query = query.in("book_copy_id", copyIds);
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    } else {
      query = query.or(`title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`, { referencedTable: 'book_copies.books' });
    }
  }

  const { data, error, count } = await query
    .order("borrowed_at", { ascending: false })
    .range(from, to);

  if (error) {
    if (isAbortError(error)) {
      throw error;
    }
    console.error("Failed to fetch borrowing history:", error);
    throw error;
  }

  const enriched = (data || []).map((record: Record<string, unknown>) => ({
    id: record.id as string,
    book_copy_id: record.book_copy_id as string,
    user_id: record.user_id as string,
    status: record.status as BorrowingRecord["status"],
    borrowed_at: record.borrowed_at as string,
    due_date: record.due_date as string,
    returned_at: record.returned_at as string | null,
    copy_qr: (record.book_copies as { qr_string?: string | null } | null)?.qr_string ?? null,
    // shortcut: fallback uses default rate 5 without querying system_settings when RPC is unavailable
    fine_amount: computeOverdueFine({
      due_date: record.due_date as string,
      returned_at: (record.returned_at as string | null) ?? null,
      status: record.status as string,
      fine_amount: (record.fine_amount as number | string | null | undefined) ?? null,
    }),
    fine_settled_at: (record.fine_settled_at as string | null | undefined) ?? null,

    books: (record.book_copies as { books: BookInfo } | null)?.books || null,
    profiles: record.profiles as BorrowingRecord["profiles"],
  }));

  return {
    records: enriched as BorrowingRecord[],
    totalCount: count ?? 0,
  };
}

/**
 * Snapshots and settles an overdue fine on a borrowing record.
 */
export const settleBorrowingFine = createSafeAction(
  z.object({
    recordId: z.string().uuid(),
    mode: z.enum(["settle", "return_and_settle", "return_only"]).optional().default("settle"),
  }),
  async ({ recordId, mode }, { userId }) => {
    const admin = createAdminClient();
    const { data: record, error: fetchError } = await admin
      .from("borrowing_records")
      .select("id, book_copy_id, due_date, returned_at, status, fine_amount, fine_settled_at")
      .eq("id", recordId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!record) throw new Error("Borrowing record not found.");
    if (record.fine_settled_at) throw new Error("Overdue penalty is already settled.");

    let returnedAt = record.returned_at;
    let snapshotFine: number | null =
      record.fine_amount != null ? Number(record.fine_amount) : null;

    if (!returnedAt) {
      if (mode === "settle") {
        throw new Error("Book must be returned before settling the penalty.");
      }

      const { data: copy, error: copyError } = await admin
        .from("book_copies")
        .select("qr_string")
        .eq("id", record.book_copy_id)
        .maybeSingle();

      if (copyError) throw new Error(copyError.message);
      if (!copy?.qr_string) throw new Error("Book copy QR code not found.");

      const { data: rpcRaw, error: rpcError } = await admin.rpc("process_qr_return", {
        p_librarian_id: userId,
        p_book_qr: copy.qr_string,
        p_idempotency_key: null,
        p_preview_only: false,
      });

      if (rpcError) throw new Error(rpcError.message);
      const rpcRes = rpcRaw as {
        ok?: boolean;
        message?: string;
        returned_at?: string;
        fine_amount?: number | string | null;
      } | null;

      if (!rpcRes?.ok) {
        throw new Error(rpcRes?.message || "Failed to return overdue book.");
      }

      returnedAt = rpcRes.returned_at || new Date().toISOString();
      if (rpcRes.fine_amount != null) {
        snapshotFine = Number(rpcRes.fine_amount);
      }
    } else if (mode === "return_only") {
      throw new Error("Book is already returned.");
    }

    if (mode === "return_only") {
      revalidatePath("/history");
      revalidatePath("/circulation");
      return [
        { id: recordId, fine_amount: snapshotFine ?? 0, fine_settled_at: null as string | null },
        { entityId: recordId, reason: `Returned overdue book with unpaid fine (PHP ${snapshotFine ?? 0})` },
      ];
    }

    const { data: setting } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "overdue_fine_per_day")
      .maybeSingle();

    const parsedRate = setting?.value != null && setting.value !== "" ? Number(setting.value) : 5;
    const fineRate = Number.isNaN(parsedRate) ? 5 : parsedRate;
    const finalFine =
      snapshotFine != null
        ? snapshotFine
        : computeOverdueFine({ ...record, returned_at: returnedAt }, fineRate);

    if (finalFine <= 0) {
      throw new Error("This record has no overdue penalty to settle.");
    }

    const settledAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("borrowing_records")
      .update({
        fine_amount: finalFine,
        fine_settled_at: settledAt,
        updated_at: settledAt,
      })
      .eq("id", recordId);

    if (updateError) throw new Error(updateError.message);

    revalidatePath("/history");
    revalidatePath("/circulation");

    return [
      { id: recordId, fine_amount: finalFine, fine_settled_at: settledAt },
      { entityId: recordId, reason: `Settled overdue fine (PHP ${finalFine})` },
    ];
  },
  {
    allowedRoles: ["super_admin", "librarian", "student_assistant"],
    allowedPermissions: ["manage_circulation"],
    auditAction: "settle_fine",
    auditEntity: "borrowing_record",
  }
);
