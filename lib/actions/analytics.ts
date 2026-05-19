'use server';

import { getMe } from "@/lib/auth-helpers";
import { startOfDay, subDays, format, startOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth } from "date-fns";

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

export async function getAnalyticsSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  if (!['super_admin', 'librarian'].includes(me.role)) throw new Error("Forbidden");

  const { supabase } = me;
  const now = new Date();
  let startDate: Date;
  let groupBy: 'day' | 'month';

  switch (range) {
    case '7d':
      startDate = startOfDay(subDays(now, 6));
      groupBy = 'day';
      break;
    case '30d':
      startDate = startOfDay(subDays(now, 29));
      groupBy = 'day';
      break;
    case '1y':
      startDate = startOfMonth(subDays(now, 364));
      groupBy = 'month';
      break;
    default:
      startDate = startOfDay(subDays(now, 29));
      groupBy = 'day';
  }

  // Fire all queries in parallel
  const [
    { data: attendanceData },
    { data: borrowingData },
    { data: popularBooksData }
  ] = await Promise.all([
    supabase
      .from('attendance')
      .select('check_in_at')
      .gte('check_in_at', startDate.toISOString()),
    supabase
      .from('borrowing_records')
      .select('borrowed_at, status, book_copies(books(categories(name)))')
      .gte('borrowed_at', startDate.toISOString()),
    supabase
      .from('borrowing_records')
      .select('book_copies(books(id, title))')
      .limit(100)
  ]);

  // Process Trends
  const attendanceTrends = processTrends(attendanceData?.map(d => d.check_in_at) || [], startDate, now, groupBy);
  const borrowingTrends = processTrends(borrowingData?.map(d => d.borrowed_at) || [], startDate, now, groupBy);

  // Process Peak Visiting Hours (8 AM to 6 PM)
  const hourCounts: Record<number, number> = {};
  for (let h = 8; h <= 18; h++) {
    hourCounts[h] = 0;
  }
  attendanceData?.forEach(record => {
    if (record.check_in_at) {
      const date = new Date(record.check_in_at);
      const hour = date.getHours();
      if (hour >= 8 && hour <= 18) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
  });

  const peakHours = Object.entries(hourCounts).map(([hStr, count]) => {
    const h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return {
      hour: `${displayHour} ${ampm}`,
      count
    };
  });

  const categoryCounts: Record<string, number> = {};
  borrowingData?.forEach(record => {
    const bookCopy = record.book_copies as unknown as {
      books: {
        categories: {
          name: string;
        } | null;
      } | null;
    } | null;
    const categoryName = bookCopy?.books?.categories?.name || 'General';
    categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
  });
  const categoryDistribution = Object.entries(categoryCounts).map(([name, value]) => ({ 
    name, 
    value 
  })).sort((a, b) => b.value - a.value);

  // Process Popular Books
  const bookCounts: Record<string, { title: string; count: number }> = {};
  popularBooksData?.forEach(record => {
    const bookData = record.book_copies as unknown as { books: { id: string; title: string } | null } | null;
    const id = bookData?.books?.id;
    const title = bookData?.books?.title;
    if (id && title) {
      if (!bookCounts[id]) {
        bookCounts[id] = { title, count: 0 };
      }
      bookCounts[id].count += 1;
    }
  });
  const popularBooks = Object.entries(bookCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id, { title, count }]) => ({ id, title, count }));

  return {
    attendanceTrends,
    borrowingTrends,
    categoryDistribution,
    peakHours,
    popularBooks
  };
}



function processTrends(timestamps: string[], startDate: Date, endDate: Date, groupBy: 'day' | 'month'): TrendDataPoint[] {
  const dates = timestamps.map(ts => new Date(ts));
  
  if (groupBy === 'day') {
    const interval = eachDayOfInterval({ start: startDate, end: endDate });
    return interval.map(day => ({
      label: format(day, 'MMM dd'),
      count: dates.filter(d => isSameDay(d, day)).length
    }));
  } else {
    const interval = eachMonthOfInterval({ start: startDate, end: endDate });
    return interval.map(month => ({
      label: format(month, 'MMM yyyy'),
      count: dates.filter(d => isSameMonth(d, month)).length
    }));
  }
}
