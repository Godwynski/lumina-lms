'use server';

import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { isAbortError } from "../error-utils";
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
      id, book_copy_id, user_id, status, borrowed_at, due_date, returned_at,
      book_copies!inner (
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

    books: (record.book_copies as { books: BookInfo } | null)?.books || null,
    profiles: record.profiles as BorrowingRecord["profiles"],
  }));

  return {
    records: enriched as BorrowingRecord[],
    totalCount: count ?? 0,
  };
}
