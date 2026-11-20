import type * as XLSXTypes from "xlsx";

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
}

export interface ImportColumnDef {
  field: keyof ParsedBook;
  header: string;
  aliases: readonly string[];
  sample: string | number;
}

/**
 * Single source of truth for accepted catalog import columns, header aliases,
 * and template sample values so the downloadable template always matches the parser.
 */
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
  return jsonArray.map((row) => {
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
      } else {
        parsed[col.field] = String(raw ?? "");
      }
    }

    return parsed as unknown as ParsedBook;
  });
}

export function filterValidImportBooks(rows: ParsedBook[]): ParsedBook[] {
  return rows.filter((b) => Boolean(b.title && b.author));
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
