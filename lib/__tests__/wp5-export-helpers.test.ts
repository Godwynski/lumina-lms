import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  IMPORT_COLUMNS,
  buildImportTemplateWorkbook,
  filterValidImportBooks,
  getImportTemplateHeaders,
  parseImportRows,
} from '@/lib/catalog-import';
import { buildAnalyticsWorkbook } from '@/lib/analytics-export';

describe('WP5 Catalog Import Template & Analytics Export Helpers', () => {
  it('generates an xlsx import template whose headers and sample row round-trip through parseImportRows with zero errors', () => {
    const workbook = buildImportTemplateWorkbook(XLSX);
    expect(workbook.SheetNames).toEqual(['Import Template']);

    // Serialize to real .xlsx binary and read back as the importer does
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const parsedBook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = parsedBook.Sheets[parsedBook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });

    expect(rawRows).toHaveLength(1);
    expect(Object.keys(rawRows[0])).toEqual(getImportTemplateHeaders());
    expect(Object.keys(rawRows[0])).toHaveLength(IMPORT_COLUMNS.length);

    const normalized = parseImportRows(rawRows);
    const valid = filterValidImportBooks(normalized);

    expect(valid).toHaveLength(1);
    expect(valid[0]).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      category: 'Computer Science',
      published_year: '2008',
      description: 'A handbook of agile software craftsmanship.',
      stock: 3,
      location: 'Main Hall',
      section: 'CS-A',
      dewey_decimal: '005.1',
      tags: 'software, craftsmanship',
    });
  });

  it('builds analytics workbook with Summary and High Demand sheets for the selected date range', () => {
    const workbook = buildAnalyticsWorkbook(
      XLSX,
      {
        attendanceToday: 42,
        activeBorrows: 14,
        totalBooks: 520,
        totalUsers: 180,
      },
      {
        attendanceTrends: [
          { label: 'Nov 1', count: 10 },
          { label: 'Nov 2', count: 15 },
        ],
        borrowingTrends: [
          { label: 'Nov 1', count: 5 },
          { label: 'Nov 2', count: 7 },
        ],
        categoryDistribution: [{ name: 'Computer Science', value: 9 }],
        peakHours: [{ hour: '10:00', count: 8 }],
        popularBooks: [
          { id: 'b-1', title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719', count: 12 },
          { id: 'b-2', title: 'Untitled', author: null, isbn: null, count: 4 },
        ],
      },
      { from: '2026-11-01', to: '2026-11-15' }
    );

    expect(workbook.SheetNames).toEqual(['Summary', 'High Demand']);

    const summaryRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Summary']);
    expect(summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ Metric: 'Date Range', Value: '2026-11-01 to 2026-11-15' }),
        expect.objectContaining({ Metric: 'Daily Traffic', Value: 42 }),
        expect.objectContaining({ Metric: 'Active Borrows', Value: 14 }),
        expect.objectContaining({ Metric: 'Total Inventory', Value: 520 }),
        expect.objectContaining({ Metric: 'Registered Members', Value: 180 }),
        expect.objectContaining({ Metric: 'Attendance Visits', Value: 25 }),
        expect.objectContaining({ Metric: 'Circulation Borrows', Value: 12 }),
        expect.objectContaining({ Metric: 'Genre: Computer Science', Value: 9 }),
      ])
    );

    const highDemandRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['High Demand']);
    expect(highDemandRows).toEqual([
      {
        Rank: 1,
        Title: 'Dune',
        Author: 'Frank Herbert',
        ISBN: '9780441172719',
        Borrows: 12,
      },
      {
        Rank: 2,
        Title: 'Untitled',
        Author: 'Unknown author',
        ISBN: '—',
        Borrows: 4,
      },
    ]);
  });

  it('preserves High Demand column headers even when popularBooks is empty', () => {
    const workbook = buildAnalyticsWorkbook(
      XLSX,
      { attendanceToday: 0, activeBorrows: 0, totalBooks: 10, totalUsers: 5 },
      {
        attendanceTrends: [],
        borrowingTrends: [],
        categoryDistribution: [],
        peakHours: [],
        popularBooks: [],
      },
      { from: '2026-11-01', to: '2026-11-07' }
    );

    const headerRow = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['High Demand'], { header: 1 })[0];
    expect(headerRow).toEqual(['Rank', 'Title', 'Author', 'ISBN', 'Borrows']);
  });
});
