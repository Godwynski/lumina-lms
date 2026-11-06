'use server';

import { getMe } from "@/lib/auth-helpers";

export type AnalyticsRange = '7d' | '30d' | '1y';

export interface TrendDataPoint {
  label: string;
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
export async function getAnalyticsSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  if (!['super_admin', 'librarian'].includes(me.role)) throw new Error("Forbidden");

  const { data, error } = await me.supabase.rpc('get_analytics_summary', { p_range: range });
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
