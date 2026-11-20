import type * as XLSXTypes from "xlsx";
import type { AnalyticsSummary } from "@/lib/actions/analytics";
import type { AnalyticsDates } from "@/lib/analytics-dates";

export interface AnalyticsSnapshotStats {
  activeBorrows: number;
  attendanceToday: number;
  totalBooks: number;
  totalUsers: number;
}

export interface AnalyticsSummarySheetRow {
  Metric: string;
  Value: string | number;
  Scope: string;
}

export interface AnalyticsHighDemandSheetRow {
  Rank: number;
  Title: string;
  Author: string;
  ISBN: string;
  Borrows: number;
}

export function buildAnalyticsExportSheets(
  stats: AnalyticsSnapshotStats,
  summary: AnalyticsSummary,
  dates: AnalyticsDates
): {
  summaryRows: AnalyticsSummarySheetRow[];
  highDemandRows: AnalyticsHighDemandSheetRow[];
} {
  const periodVisits = summary.attendanceTrends.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const periodBorrows = summary.borrowingTrends.reduce((sum, item) => sum + Number(item.count || 0), 0);

  const summaryRows: AnalyticsSummarySheetRow[] = [
    { Metric: "Date Range", Value: `${dates.from} to ${dates.to}`, Scope: "Selected Range" },
    { Metric: "Daily Traffic", Value: stats.attendanceToday, Scope: "Today" },
    { Metric: "Active Borrows", Value: stats.activeBorrows, Scope: "Current" },
    { Metric: "Total Inventory", Value: stats.totalBooks, Scope: "Catalog" },
    { Metric: "Registered Members", Value: stats.totalUsers, Scope: "Directory" },
    { Metric: "Attendance Visits", Value: periodVisits, Scope: `${dates.from} to ${dates.to}` },
    { Metric: "Circulation Borrows", Value: periodBorrows, Scope: `${dates.from} to ${dates.to}` },
    ...summary.categoryDistribution.map((cat) => ({
      Metric: `Genre: ${cat.name}`,
      Value: cat.value,
      Scope: `${dates.from} to ${dates.to}`,
    })),
  ];

  const highDemandRows: AnalyticsHighDemandSheetRow[] = summary.popularBooks.map((book, index) => ({
    Rank: index + 1,
    Title: book.title,
    Author: book.author || "Unknown author",
    ISBN: book.isbn || "—",
    Borrows: book.count,
  }));

  return { summaryRows, highDemandRows };
}

export function buildAnalyticsWorkbook(
  XLSX: typeof XLSXTypes,
  stats: AnalyticsSnapshotStats,
  summary: AnalyticsSummary,
  dates: AnalyticsDates
): XLSXTypes.WorkBook {
  const { summaryRows, highDemandRows } = buildAnalyticsExportSheets(stats, summary, dates);

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: ["Metric", "Value", "Scope"],
  });
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 24 }];

  const highDemandSheet = XLSX.utils.json_to_sheet(highDemandRows, {
    header: ["Rank", "Title", "Author", "ISBN", "Borrows"],
  });
  highDemandSheet["!cols"] = [{ wch: 8 }, { wch: 36 }, { wch: 24 }, { wch: 18 }, { wch: 10 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, highDemandSheet, "High Demand");
  return workbook;
}
