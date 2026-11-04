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
  popularBooks: { id: string; title: string; count: number }[];
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

  const summary = (data ?? {}) as Partial<AnalyticsSummary>;
  return {
    attendanceTrends: summary.attendanceTrends ?? [],
    borrowingTrends: summary.borrowingTrends ?? [],
    categoryDistribution: summary.categoryDistribution ?? [],
    peakHours: summary.peakHours ?? [],
    popularBooks: summary.popularBooks ?? [],
  };
}
