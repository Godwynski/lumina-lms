'use server';

import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { isAbortError } from "../error-utils";
import { SupabaseClient } from "@supabase/supabase-js";

export type BookInfo = {
  id: string;
  title: string;
  author: string;
};

export type BorrowingRecord = {
  id: string;
  book_copy_id: string;
  user_id: string;
  status: "ACTIVE" | "RETURNED" | "OVERDUE" | "LOST";
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  renewal_count: number;
  books: BookInfo | null;
};

export async function getBorrowingHistory(
  userId: string,
  page: number = 1,
  pageSize: number = 10,
  statusFilter?: string,
  searchQuery?: string,
  preFetchedSupabase?: SupabaseClient
) {
  const supabase = preFetchedSupabase || await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("borrowing_records")
    .select(`
      id, book_copy_id, user_id, status, borrowed_at, due_date, returned_at, renewal_count,
      book_copies!inner (
        books!inner (
          id, title, author
        )
      )
    `, { count: "exact" })
    .eq("user_id", userId);

  if (statusFilter && statusFilter !== "all") {
    // Normalize to uppercase to match BorrowStatus enum in Postgres
    query = query.eq("status", statusFilter.toUpperCase());
  }

  if (searchQuery) {
    query = query.or(`title.ilike.%${sanitizeFilterInput(searchQuery)}%,author.ilike.%${sanitizeFilterInput(searchQuery)}%`, { referencedTable: 'book_copies.books' });
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
    id: record.id,
    book_copy_id: record.book_copy_id,
    user_id: record.user_id,
    status: record.status,
    borrowed_at: record.borrowed_at,
    due_date: record.due_date,
    returned_at: record.returned_at,
    renewal_count: record.renewal_count,
    books: (record.book_copies as { books: unknown })?.books || null,
  }));

  return {
    records: enriched as BorrowingRecord[],
    totalCount: count ?? 0,
  };
}

// Cached version for high-performance repeat reads
export const getCachedBorrowingHistory = async (userId: string, page: number, statusFilter: string, searchQuery: string) => 
  unstable_cache(
    () => getBorrowingHistory(userId, page, 10, statusFilter, searchQuery),
    [`history-${userId}-${page}-${statusFilter}-${searchQuery}`],
    { revalidate: 60, tags: [`history-${userId}`] }
  )();
