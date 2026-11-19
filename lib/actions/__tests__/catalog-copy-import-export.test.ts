import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockQueryBuilder, createMockSupabaseClient } from '@/test/mocks/supabase';
import { batchImportBooks, getCopyRecordsForExport } from '@/lib/actions/catalog/import-export';

let server: ReturnType<typeof createMockSupabaseClient>;
let admin: ReturnType<typeof createMockSupabaseClient>;
const afterCallbacks: Array<() => Promise<void>> = [];
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => server.client }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin.client }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => afterCallbacks.push(callback) }));
vi.mock('@/lib/catalog-import-scheduler', () => ({ scheduleCatalogImport: vi.fn() }));

const purchase = { method: 'PURCHASED', acquiredOn: '2025-06-17', purchasePrice: '350.50' } as const;
const donation = { method: 'DONATED', acquiredOn: '2025-06-18', purchasePrice: null } as const;

function signIn(role: string, status = 'ACTIVE') {
  server.auth.getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null });
  server.setTableResponse('profiles', { id: 'actor', role, status, permissions: { manage_inventory: true } });
}

describe('Copy records import and export', () => {
  beforeEach(() => {
    server = createMockSupabaseClient();
    admin = createMockSupabaseClient();
    afterCallbacks.length = 0;
    signIn('librarian');
  });

  it('keeps dates and prices scoped to the copies requested by each row, with audit and enrichment references', async () => {
    const existing = { id: 'old', title: 'Existing', author: 'Author', isbn: '978-0132350884' };
    const newCopyIds = ['copy-new-1', 'copy-new-2', 'copy-new-3'];
    server.setTableResponse('books', [existing]);
    admin.setRpcResponse({
      books: [{ id: 'new', title: 'Fresh', author: 'Author', isbn: null, cover_url: null, copyIds: newCopyIds }],
      copyIds: ['copy-old', ...newCopyIds],
    }, null, 'apply_catalog_spreadsheet');

    const result = await batchImportBooks([
      { title: 'Existing', author: 'Author', isbn: '9780132350884', stock: 1, acquisition: donation },
      { title: 'Fresh', author: 'Author', stock: 2, acquisition: purchase },
      { title: 'Fresh', author: 'Author', stock: 1 },
    ], { addCopiesToDuplicates: true });

    expect(result).toMatchObject({ imported: 1, copiesAdded: 4, duplicates: 2 });
    expect(admin.rpc).toHaveBeenCalledWith('apply_catalog_spreadsheet', {
      p_books: [{
        book: expect.objectContaining({ title: 'Fresh', author: 'Author' }),
        acquisitions: [purchase, purchase, null],
      }],
      p_copies: [{ book_id: 'old', acquisition: donation }],
    });
    expect(server.getTableBuilder('books').insert).not.toHaveBeenCalled();
    expect(server.from).not.toHaveBeenCalledWith('book_copies');
    expect(server.from).not.toHaveBeenCalledWith('book_copy_lifecycle');
    expect(admin.rpc).toHaveBeenCalledWith('catalog_import_enqueue', expect.objectContaining({
      p_items: [
        expect.objectContaining({ mode: 'enrich', book_id: 'old', requested_copies: 0 }),
        expect.objectContaining({ mode: 'enrich', book_id: 'new', requested_copies: 0 }),
      ],
    }));
    await Promise.all(afterCallbacks.map(callback => callback()));
    expect(admin.getTableBuilder('audit_logs').insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'batch_import',
      details: expect.objectContaining({
        bookIds: expect.arrayContaining(['old', 'new']),
        copyIds: ['copy-old', 'copy-new-1', 'copy-new-2', 'copy-new-3'],
      }),
    }));
  });

  it('skips copy writes on a re-import by default and still queues enrichment for the existing title', async () => {
    server.setTableResponse('books', [{ id: 'old', title: 'Existing', author: 'Author', isbn: '9780132350884' }]);

    expect(await batchImportBooks([
      { title: 'Existing', author: 'Author', isbn: '978-0132350884', acquisition: purchase, stock: 2 },
    ])).toMatchObject({ imported: 0, copiesAdded: 0, duplicates: 1 });
    expect(server.from).not.toHaveBeenCalledWith('book_copies');
    expect(admin.rpc).not.toHaveBeenCalledWith('apply_catalog_spreadsheet', expect.anything());
    expect(admin.rpc).toHaveBeenCalledWith('catalog_import_enqueue', expect.objectContaining({
      p_items: [expect.objectContaining({ mode: 'enrich', book_id: 'old', requested_copies: 0 })],
    }));
  });

  it('captures copy references for a legacy import without acquisition columns', async () => {
    server.setTableResponse('books', [{ id: 'old', title: 'Existing', author: 'Author' }]);
    admin.setRpcResponse({ books: [], copyIds: ['copy-legacy'] }, null, 'apply_catalog_spreadsheet');

    expect(await batchImportBooks([
      { title: 'Existing', author: 'Author', stock: 1 },
    ], { addCopiesToDuplicates: true })).toMatchObject({ copiesAdded: 1 });
    expect(admin.rpc).toHaveBeenCalledWith('apply_catalog_spreadsheet', { p_books: [], p_copies: [{ book_id: 'old' }] });
    await Promise.all(afterCallbacks.map(callback => callback()));
    expect(admin.getTableBuilder('audit_logs').insert).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({ bookIds: ['old'], copyIds: ['copy-legacy'] }),
    }));
  });

  it('rejects a failed batch without reporting success, doing independent writes, or queuing enrichment', async () => {
    server.setTableResponse('books', [{ id: 'old', title: 'Existing', author: 'Author' }]);
    admin.setRpcResponse(null, { message: 'Write failed' }, 'apply_catalog_spreadsheet');

    await expect(batchImportBooks([
      { title: 'Existing', author: 'Author', acquisition: purchase },
      { title: 'Fresh', author: 'Author', category: 'New category' },
    ], { addCopiesToDuplicates: true })).rejects.toThrow(/no books or copies were saved/i);

    expect(admin.rpc).toHaveBeenCalledExactlyOnceWith('apply_catalog_spreadsheet', {
      p_books: [{
        book: expect.objectContaining({ title: 'Fresh', author: 'Author', category_id: null }),
        acquisitions: [null],
        categoryName: 'New category',
      }],
      p_copies: [{ book_id: 'old', acquisition: purchase }],
    });
    expect(server.getTableBuilder('books').insert).not.toHaveBeenCalled();
    expect(server.getTableBuilder('categories').insert).not.toHaveBeenCalled();
    expect(server.from).not.toHaveBeenCalledWith('book_copies');
    expect(afterCallbacks).toHaveLength(0);
  });

  it('rejects invalid acquisition at its original spreadsheet row before any catalog writes', async () => {
    await expect(batchImportBooks([
      { title: 'Fine', author: 'Author' },
      { title: 'Invalid', author: 'Author', rowNumber: 8, acquisition: { ...donation, purchasePrice: '25' } },
    ])).rejects.toThrow(/Row 8/);
    expect(server.from).not.toHaveBeenCalledWith('books');
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['patron', 'ACTIVE'], ['library_staff', 'ACTIVE'], ['librarian', 'INACTIVE'], ['super_admin', 'INACTIVE'],
  ])('rejects %s with %s status for financial import and export', async (role, status) => {
    signIn(role, status);
    await expect(getCopyRecordsForExport()).rejects.toThrow();
    await expect(batchImportBooks([{ title: 'Title', author: 'Author', acquisition: purchase }])).rejects.toThrow();
    await expect(batchImportBooks([{ title: 'Title', author: 'Author' }])).rejects.toThrow();
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('returns each accession with optional fields, escaped titles and zero proceeds', async () => {
    signIn('super_admin');
    admin.setTableResponse('book_copies', [
      {
        id: 'copy-1', accession_number: 'ACC-00001', status: 'SOLD',
        books: { title: '=HYPERLINK("web")', author: 'Doe, Jane', isbn: '123' },
        book_copy_lifecycle: {
          acquisition_method: 'PURCHASED', acquired_on: '2025-06-17', purchase_price: 350.5,
          disposition_on: '2025-08-01', sale_amount: 0, last_lost_on: '2025-07-01',
        },
      },
      {
        id: 'copy-2', accession_number: 'ACC-00002', status: 'AVAILABLE',
        books: { title: 'Older Title', author: null, isbn: null }, book_copy_lifecycle: null,
      },
    ]);

    expect((await getCopyRecordsForExport()).split('\n')).toEqual([
      'Accession number,Title,Author,ISBN,Status,Acquisition method,Acquisition date,Price per copy,Disposition date,Proceeds,Last loss date',
      'ACC-00001,"\'=HYPERLINK(""web"")","Doe, Jane",123,SOLD,PURCHASED,2025-06-17,350.5,2025-08-01,0,2025-07-01',
      'ACC-00002,Older Title,,,AVAILABLE,,,,,,',
    ]);
  });

  it('paginates beyond the service row cap and rejects a failed subsequent page', async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({
      id: `copy-${i}`, accession_number: `ACC-${String(i).padStart(5, '0')}`, status: 'AVAILABLE',
    }));
    const second = [{ id: 'copy-final', accession_number: 'ACC-01000', status: 'LOST' }];
    const query = admin.getTableBuilder('book_copies');
    query.range.mockImplementation((from: number) => createMockQueryBuilder(from ? second : first));
    expect(await getCopyRecordsForExport()).toContain('ACC-01000,,,,LOST');
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);

    query.range.mockImplementation((from: number) => from
      ? createMockQueryBuilder(null, { message: 'Query failed' })
      : createMockQueryBuilder(first));
    await expect(getCopyRecordsForExport()).rejects.toThrow('Failed to export copy records');
  });
});
