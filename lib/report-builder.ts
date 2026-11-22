import { z } from "zod";
import { toCsv } from "@/lib/csv";

export const REPORT_DATASETS = {
  attendance: {
    label: "Attendance",
    metrics: { visits: "Check-ins", visitors: "Distinct visitors", records: "Attendance records" },
    columns: { check_in_at: "Check-in", check_out_at: "Check-out", full_name: "Patron", student_id: "Patron ID", status: "Status", notes: "Notes" },
    defaults: ["check_in_at", "check_out_at", "status"],
    filters: { all: "All visits", Active: "Active", Completed: "Completed", "No Log Out": "No log-out" },
    search: "Patron name or ID",
  },
  borrowing: {
    label: "Borrowing",
    metrics: { loans: "Loans issued", returns: "Returns", records: "Borrowing records" },
    columns: { title: "Book title", author: "Author", borrowed_at: "Borrowed", due_date: "Due", returned_at: "Returned", status: "Status", full_name: "Borrower", student_id: "Patron ID", email: "Email", qr_string: "Copy QR", fine_amount: "Fine amount (PHP)", fine_resolution: "Fine resolution", fine_settled_at: "Settled", fine_remarks: "Fine remarks" },
    defaults: ["title", "borrowed_at", "due_date", "returned_at", "status"],
    filters: { all: "All loans", ACTIVE: "Active", OVERDUE: "Overdue & receivables", RETURNED: "Returned", SETTLED: "Settled", PAID: "Fine paid", CONDONED: "Fine condoned" },
    search: "Book, borrower, or copy QR",
  },
  inventory: {
    label: "Books & Inventory",
    metrics: { titles: "Catalog titles", copies: "Total copies", available: "Available copies", records: "Book list" },
    columns: { title: "Title", author: "Author", isbn: "ISBN", category: "Category", location: "Location", section: "Section", dewey_decimal: "Dewey Decimal", published_year: "Publication year", total_copies: "Total copies", available_copies: "Available copies", status: "Catalog status" },
    defaults: ["title", "author", "category", "total_copies", "available_copies"],
    filters: { ACTIVE: "Active titles", ARCHIVED: "Archived titles", all: "All titles" },
    search: "Title, author, ISBN, category, or location",
  },
  users: {
    label: "Users",
    metrics: { registrations: "New registrations", records: "User list" },
    columns: { created_at: "Registered", full_name: "Name", email: "Email", student_id: "Patron ID", role: "Role", status: "Account status", department: "Department", patron_type: "Patron type" },
    defaults: ["created_at", "role", "status", "department"],
    filters: { all: "All accounts", ACTIVE: "Active", PENDING: "Pending", INACTIVE: "Inactive", SUSPENDED: "Suspended", ARCHIVED: "Archived" },
    search: "Name, email, ID, or department",
  },
} as const;

export const REPORT_GROUPS = {
  day: "Day", week: "Week", month: "Month", year: "Year", category: "Category", location: "Location",
} as const;
export const REPORT_SECTION_LIMIT = 8;
export const REPORT_PREVIEW_ROWS = 8;

const datasets = z.enum(["attendance", "borrowing", "inventory", "users"]);
const metrics = z.enum(["visits", "visitors", "loans", "returns", "titles", "copies", "available", "registrations", "records"]);
const groups = z.enum(["day", "week", "month", "year", "category", "location"]);
const display = z.enum(["line", "bar", "table"]);
const dates = z.object({ from: z.iso.date(), to: z.iso.date() }).refine(({ from, to }) =>
  from >= "1900-01-01" && to <= "2199-12-31" && from <= to && Date.parse(to) - Date.parse(from) <= 1827 * 86_400_000,
);
const sectionSchema = z.object({
  id: z.string().min(1).max(50),
  dataset: datasets,
  metric: metrics,
  group: groups,
  display,
  columns: z.array(z.string()).min(1).max(16),
  filter: z.string().max(20),
  search: z.string().max(120),
  dates: dates.nullable(),
});

export const reportConfigSchema = z.object({
  ...dates.shape,
  title: z.string().trim().min(1).max(100),
  sections: z.array(sectionSchema).min(1).max(REPORT_SECTION_LIMIT),
}).refine(report => dates.safeParse(report).success
  && new Set(report.sections.map(({ id }) => id)).size === report.sections.length
  && report.sections.every(section => {
    const dataset = REPORT_DATASETS[section.dataset];
    const isSnapshot = section.dataset === "inventory";
    return Object.hasOwn(dataset.metrics, section.metric)
      && Object.hasOwn(dataset.filters, section.filter)
      && section.columns.every(column => Object.hasOwn(dataset.columns, column))
      && new Set(section.columns).size === section.columns.length
      && (isSnapshot === (section.group === "category" || section.group === "location"))
      && (!isSnapshot || (!section.dates && section.display !== "line"))
      && (section.metric !== "records" || section.display === "table");
  }), "Choose a valid date range of up to five years, with valid sections and columns.");

export type ReportDataset = z.infer<typeof datasets>;
export type ReportSection = z.infer<typeof sectionSchema>;
export type ReportConfig = z.infer<typeof reportConfigSchema>;
export type ReportOutput = "pdf" | "excel" | "csv";
export type ReportCell = string | number | null;
export type ReportResultSection = {
  id: string;
  title: string;
  scope: string;
  display: ReportSection["display"];
  headers: string[];
  rows: ReportCell[][];
  rowCount: number;
};
export type ReportResult = { title: string; sections: ReportResultSection[] };

export function createReportSection(dataset: ReportDataset, id: string): ReportSection {
  const definition = REPORT_DATASETS[dataset];
  return {
    id, dataset, metric: Object.keys(definition.metrics)[0] as ReportSection["metric"],
    group: dataset === "inventory" ? "category" : "month",
    display: dataset === "inventory" ? "bar" : "line",
    filter: Object.keys(definition.filters)[0],
    columns: [...definition.defaults], dates: null, search: "",
  };
}

export function reportCsv(section: ReportResultSection): string {
  return toCsv(section.headers, section.rows);
}
