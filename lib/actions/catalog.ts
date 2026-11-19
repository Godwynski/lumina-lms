/**
 * Catalog Server Actions Facade
 * 
 * Modular domain implementations:
 * - @/lib/actions/catalog/auth: Staff access authorization guards
 * - @/lib/actions/catalog/categories: Category query and auto-creation
 * - @/lib/actions/catalog/books: Book search, creation, updates, and soft-delete/restore
 * - @/lib/actions/catalog/copies: Physical copy management, status updates, and detail views
 * - @/lib/actions/catalog/import-export: External ISBN lookups, batch import, and catalog export
 *
 */

// Categories
export {
  getCategories,
  getOrCreateCategoryByName,
} from './catalog/categories';

// Books
export {
  getBooks,
  createBook,
  updateBook,
  softDeleteBook,
  restoreBook,
} from './catalog/books';

// Copies
export {
  updateBookCopyStatus,
  updateCopyAcquisition,
  recordCopyDisposition,
  addBookCopies,
  getBookPublicDetails,
  getBookAdminDetails,
} from './catalog/copies';

// Import / Export
export {
  getBooksForExport,
  getCopyRecordsForExport,
  batchImportBooks,
  lookupAndImportISBN,
} from './catalog/import-export';

export type { ImportBookRow, GoogleOrOpenLibraryBookDetails } from './catalog/import-export';
export type { AdminReservationQueueEntry } from './catalog/copies';
