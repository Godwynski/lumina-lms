/** Neutralize spreadsheet formulas: cells starting with = + - @ tab or CR get a leading apostrophe. */
export function escapeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Formula-safe, RFC 4180 quoted CSV cell. */
export function toCsvCell(value: unknown): string {
  const raw = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = escapeCsvFormula(raw);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
}
