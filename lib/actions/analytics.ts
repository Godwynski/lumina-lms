'use server';

import { validateDates, type AnalyticsDates } from "@/lib/analytics-dates";
import { getMe } from "@/lib/auth-helpers";

export type AnalyticsRange = '7d' | '30d' | '1y';

export interface TrendDataPoint {
  label: string;
  from?: string;
  to?: string;
  count: number;
}

export interface AnalyticsSummary {
  attendanceTrends: TrendDataPoint[];
  borrowingTrends: TrendDataPoint[];
  categoryDistribution: { name: string; value: number }[];
  peakHours: { hour: string; count: number }[];
  popularBooks: PopularBook[];
}

export interface PopularBook {
  id: string;
  title: string;
  count: number;
  author: string | null;
  isbn: string | null;
}

/**
 * Counts and groups in SQL (`get_analytics_summary`), in Manila time. Fetching the rows into the
 * app stopped at 1,000 per query, so busy ranges were undercounted (M8, M9).
 */
export async function getAnalyticsSummary(range: AnalyticsRange, dates?: AnalyticsDates): Promise<AnalyticsSummary> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  if (!['super_admin', 'librarian'].includes(me.role)) throw new Error("Forbidden");

  if (dates && !validateDates(dates)) throw new Error('Choose valid dates within one year.');
  const { data, error } = dates
    ? await me.supabase.rpc('get_analytics_summary_window', { p_from: dates.from, p_to: dates.to })
    : await me.supabase.rpc('get_analytics_summary', { p_range: range });
  if (error) throw new Error(error.message);

  const summary = (data ?? {}) as Partial<Omit<AnalyticsSummary, 'popularBooks'>> & {
    popularBooks?: { id: string; title: string; count: number }[];
  };

  // The RPC returns only id/title/count. Look up author and ISBN for the top books
  // so titles shared by different books can be told apart.
  const popular = summary.popularBooks ?? [];
  const details = new Map<string, { author: string | null; isbn: string | null }>();
  if (popular.length > 0) {
    const { data: books } = await me.supabase
      .from('books')
      .select('id, author, isbn')
      .in('id', popular.map((b) => b.id));
    for (const b of books ?? []) details.set(b.id, { author: b.author ?? null, isbn: b.isbn ?? null });
  }

  return {
    attendanceTrends: summary.attendanceTrends ?? [],
    borrowingTrends: summary.borrowingTrends ?? [],
    categoryDistribution: summary.categoryDistribution ?? [],
    peakHours: summary.peakHours ?? [],
    popularBooks: popular.map((b) => ({
      ...b,
      author: details.get(b.id)?.author ?? null,
      isbn: details.get(b.id)?.isbn ?? null,
    })),
  };
}

export type AnalyticsSelection = { kind: 'hour' | 'period' | 'genre'; key: string; title: string; from: string; to: string };
export type AnalyticsDetailRow = { id: string; occurred_at: string; borrower_id: string | null; borrower_name: string | null; email: string | null; student_id: string | null; book_id: string | null; book_title: string | null; status: string };
export async function getAnalyticsDetail(selection: AnalyticsSelection, page = 1): Promise<{ rows: AnalyticsDetailRow[]; total: number }> {
  const me = await getMe();
  if (!me) throw new Error('Unauthorized');
  if (!['super_admin', 'librarian'].includes(me.role)) throw new Error('Forbidden');
  if (!validateDates(selection) || !Number.isInteger(page) || page < 1 || !['hour','period','genre'].includes(selection.kind)) throw new Error('Invalid selection');
  const { data, error } = await me.supabase.rpc('get_analytics_detail', { p_from: selection.from, p_to: selection.to, p_kind: selection.kind, p_key: selection.key, p_page: page });
  if (error) throw new Error(error.message);
  return data;
}
