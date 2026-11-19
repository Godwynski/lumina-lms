import type * as XLSXTypes from "xlsx";
import { copyAcquisitionSchema, hasCopyAcquisition, type CopyAcquisition } from "@/lib/copy-acquisition";

export interface ParsedBook {
  title: string;
  author: string;
  isbn: string;
  category: string;
  published_year: string;
  description: string;
  stock: number;
  location: string;
  section: string;
  dewey_decimal: string;
  tags: string;
  rowNumber: number;
  acquisition?: CopyAcquisition;
  acquisitionError?: string;
}

export interface ImportColumnDef {
  field: keyof ParsedBook | "acquisition_method" | "acquisition_date" | "price_per_copy";
  header: string;
  aliases: readonly string[];
  sample: string | number;
}

/**
 * Single source of truth for accepted catalog import columns, header aliases,
 * and template sample values so the downloadable template always matches the parser.
 */
const ACQUISITION_COLUMNS = [
  { field: "acquisition_method", header: "Acquisition method", aliases: ["acquisition_method"], sample: "Bought" },
  { field: "acquisition_date", header: "Acquisition date", aliases: ["acquisition_date", "acquired_on"], sample: "2024-01-15" },
  { field: "price_per_copy", header: "Price per copy", aliases: ["price_per_copy", "purchase_price"], sample: "350.50" },
] as const satisfies readonly ImportColumnDef[];

export const IMPORT_COLUMNS: readonly ImportColumnDef[] = [
  { field: "title", header: "Title", aliases: ["title", "book_title", "name"], sample: "Clean Code" },
  { field: "author", header: "Author", aliases: ["author", "writer", "authors"], sample: "Robert C. Martin" },
  { field: "isbn", header: "ISBN", aliases: ["isbn", "isbn_number", "code"], sample: "9780132350884" },
  { field: "category", header: "Category", aliases: ["category", "category_name", "genre"], sample: "Computer Science" },
  { field: "published_year", header: "Published Year", aliases: ["published_year", "year", "pub_year"], sample: "2008" },
  {
    field: "description",
    header: "Description",
    aliases: ["description", "desc", "summary"],
    sample: "A handbook of agile software craftsmanship.",
  },
  { field: "stock", header: "Copies", aliases: ["stock", "copies", "quantity", "copies_count"], sample: 3 },
  { field: "location", header: "Location", aliases: ["location", "shelving", "shelf"], sample: "Main Hall" },
  { field: "section", header: "Section", aliases: ["section"], sample: "CS-A" },
  { field: "dewey_decimal", header: "Dewey Decimal", aliases: ["dewey", "dewey_decimal", "call_number"], sample: "005.1" },
  { field: "tags", header: "Tags", aliases: ["tags", "subjects", "keywords"], sample: "software, craftsmanship" },
  ...ACQUISITION_COLUMNS,
] as const;

export function normalizeImportKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function pickAliasValue(cleanRow: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    if (cleanRow[alias] !== undefined && cleanRow[alias] !== "") {
      return cleanRow[alias];
    }
  }
  return undefined;
}

export function parseImportRows(jsonArray: Record<string, unknown>[]): ParsedBook[] {
  return jsonArray.map((row, index) => {
    const cleanRow: Record<string, unknown> = {};
    Object.keys(row).forEach((key) => {
      cleanRow[normalizeImportKey(key)] = row[key];
    });

    const parsed: Record<string, string | number> = {};
    for (const col of IMPORT_COLUMNS) {
      const raw = pickAliasValue(cleanRow, col.aliases);
      if (col.field === "stock") {
        const numeric = raw === undefined ? 1 : Number(raw);
        parsed.stock = Number.isNaN(numeric) ? 1 : Math.min(50, Math.max(0, numeric));
      } else if (col.field === "tags") {
        parsed.tags = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
      } else if (col.field === "acquisition_date" && raw instanceof Date) {
        parsed.acquisition_date = Number.isNaN(raw.getTime()) ? "Invalid date" : raw.toISOString().split("T")[0];
      } else {
        parsed[col.field] = String(raw ?? "");
      }
    }

    const { acquisition_method, acquisition_date, price_per_copy, ...book } = parsed;
    const rowNumber = typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : index + 1;
    const method = String(acquisition_method ?? "").trim().toUpperCase();
    const acquisition = copyAcquisitionSchema.safeParse({
      method: method === "BOUGHT" ? "PURCHASED" : method || null,
      acquiredOn: String(acquisition_date ?? "").trim() || null,
      purchasePrice: String(price_per_copy ?? "").trim() || null,
    });
    const normalized = { ...book, rowNumber } as ParsedBook;
    if (!acquisition.success) normalized.acquisitionError = acquisition.error.issues[0].message;
    else if (hasCopyAcquisition(acquisition.data)) normalized.acquisition = acquisition.data;
    return normalized;
  });
}

export function parseImportSheet(XLSX: typeof XLSXTypes, sheet: XLSXTypes.WorkSheet): ParsedBook[] {
  const formatted = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" });
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: "", UTC: true });
  const rawByRow = new Map(raw.map(row => [row.__rowNum__, row]));
  const acquisitionKeys = new Set<string>(ACQUISITION_COLUMNS.flatMap(column => column.aliases));
  for (const row of formatted) {
    // Formatted stock/ISBN fields retain their spreadsheet representation. Use the
    // date and price cells' underlying values so display formatting cannot round them.
    for (const [key, value] of Object.entries(rawByRow.get(row.__rowNum__) ?? {})) {
      if (acquisitionKeys.has(normalizeImportKey(key))) row[key] = value;
    }
  }
  return parseImportRows(formatted);
}

export function filterValidImportBooks(rows: ParsedBook[]): ParsedBook[] {
  return rows.filter((b) => Boolean(b.title && b.author && !b.acquisitionError));
}

export function getImportTemplateHeaders(): string[] {
  return IMPORT_COLUMNS.map((col) => col.header);
}

export function getImportTemplateSampleRow(): Record<string, string | number> {
  return Object.fromEntries(IMPORT_COLUMNS.map((col) => [col.header, col.sample]));
}

export function buildImportTemplateWorkbook(XLSX: typeof XLSXTypes): XLSXTypes.WorkBook {
  const headers = getImportTemplateHeaders();
  const sampleRow = getImportTemplateSampleRow();
  const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
  worksheet["!cols"] = headers.map((header) => {
    const valLen = String(sampleRow[header] ?? "").length;
    return { wch: Math.min(Math.max(header.length, valLen) + 4, 48) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Import Template");
  return workbook;
}
