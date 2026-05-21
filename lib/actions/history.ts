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

export type BorrowingRecord = {
  id: string;
  book_copy_id: string;
  user_id: string;
  status: "ACTIVE" | "RETURNED" | "OVERDUE" | "LOST";
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

export async function getBorrowingHistory(
  userId: string | null,
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
    query = query.or(`title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`, { referencedTable: 'book_copies.books' });
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

