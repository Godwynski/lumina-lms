import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  IMPORT_COLUMNS,
  buildImportTemplateWorkbook,
  filterValidImportBooks,
  getImportTemplateHeaders,
  parseImportRows,
  parseImportSheet,
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
      rowNumber: 2,
      acquisition: { method: 'PURCHASED', acquiredOn: '2024-01-15', purchasePrice: '350.50' },
    });
  });

  it('preserves spreadsheet row numbers and keeps old templates without acquisition columns valid', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Title', 'Author', 'ISBN', 'Acquisition method', 'Acquisition date', 'Price per copy'],
      ['Legacy', 'Author', '0123456789'],
      [],
      ['Supply', 'Author', '0987654321', 'donated', 45351],
      ['Typo', 'Author', '', 'purchased', '2025-02-29', 12],
      ['Donation with price', 'Author', '', 'donated', '', 1],
      ['Price too precise', 'Author', '', 'purchased', '', 25.001],
    ]);
    sheet.E4.z = 'm/d/yy';
    sheet.F7.z = '0.00';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Books');
    const spreadsheet = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { cellDates: true });
    const rows = parseImportSheet(XLSX, spreadsheet.Sheets.Books);

    expect(rows[0]).toMatchObject({ title: 'Legacy', isbn: '0123456789', rowNumber: 2 });
    expect(rows[0]).not.toHaveProperty('acquisition');
    expect(rows[1]).toMatchObject({
      title: 'Supply',
      rowNumber: 4,
      acquisition: { method: 'DONATED', acquiredOn: '2024-02-29', purchasePrice: null },
    });
    expect(rows.slice(2).map(row => [row.rowNumber, row.acquisitionError])).toEqual([
      [5, expect.any(String)], [6, expect.any(String)], [7, expect.any(String)],
    ]);
    expect(filterValidImportBooks(rows).map(row => row.title)).toEqual(['Legacy', 'Supply']);
  });

  it('accepts the Bought label and records zero as a purchase price', () => {
    const [row] = parseImportRows([{ Title: 'A', Author: 'B', 'Acquisition method': ' bought ', 'Price per copy': 0 }]);
    expect(row.acquisition).toEqual({ method: 'PURCHASED', acquiredOn: null, purchasePrice: '0' });
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
