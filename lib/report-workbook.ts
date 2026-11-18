import type * as SheetJS from "xlsx";
import type { ReportResult } from "@/lib/report-builder";

export function buildReportWorkbook(xlsx: typeof SheetJS, report: ReportResult) {
  const workbook = xlsx.utils.book_new();
  for (const [index, section] of report.sections.entries()) {
    const sheet = xlsx.utils.aoa_to_sheet([[section.title], [section.scope], [], section.headers, ...section.rows]);
    sheet["!cols"] = section.headers.map(header => ({ wch: Math.max(18, header.length + 4) }));
    const name = section.title.replace(/[\\/?*\[\]:]/g, "").trim();
    xlsx.utils.book_append_sheet(workbook, sheet, `${index + 1}. ${name}`.slice(0, 31));
  }
  return workbook;
}
