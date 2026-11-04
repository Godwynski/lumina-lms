'use server';

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { fetchImage } from '@/lib/fetch-image';
import { logAuditActivity } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { assertStaffCatalogAccess } from './auth';
import { getOrCreateCategoryByName } from './categories';

export interface ImportBookRow {
  title?: string;
  author?: string;
  isbn?: string | number;
  category?: string;
  category_name?: string;
  published_year?: string;
  description?: string;
  stock?: string | number;
  copiesCount?: string | number;
  cover_url?: string;
  tags?: string | string[];
  location?: string;
  section?: string;
  dewey_decimal?: string | number;
}

export interface GoogleOrOpenLibraryBookDetails {
  title: string;
  author: string;
  publisher: string | null;
  published_year: number | null;
  description: string | null;
  dewey_decimal: string | null;
  tags: string[];
}

/**
 * Downloads a remote book cover image, converts it to WebP format, and uploads to Supabase storage.
 */
async function uploadCoverFromUrl(supabase: SupabaseClient, url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let { buffer } = await fetchImage(url);

    // Convert to WebP using Sharp (dynamically imported to prevent serverless module resolution issues)
    try {
      const sharp = (await import("sharp")).default;
      buffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      logger.error('catalog', 'Sharp conversion failed, uploading raw buffer', { error: err });
    }

    const crypto = await import("crypto");
    const uuid = crypto.randomUUID();
    const filename = `${uuid}.webp`;

    const { error: uploadError } = await supabase
      .storage
      .from('book-covers')
      .upload(filename, buffer, {
        contentType: "image/webp",
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error('catalog', `Supabase cover upload failed: ${uploadError.message}`);
      return null;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('book-covers')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    logger.error('catalog', `Failed to upload cover from URL: ${url}`, { error });
    return null;
  }
}

/**
 * Fetches all books with their categories for high-performance client-side Excel/CSV export.
 */
export async function getBooksForExport() {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, author, isbn, dewey_decimal, description, 
      published_year, cover_url, tags, location, section, is_active, created_at,
      categories(name)
    `)
    .order('title');

  if (error) {
    logger.error('catalog', 'Failed to fetch books for export', { error: error.message });
    throw new Error(`Failed to fetch books for export: ${error.message}`);
  }

  return data;
}

const MAX_BATCH_SIZE = 500;
const MAX_COPIES_PER_ROW = 50;
const PAGE_SIZE = 1000; // PostgREST returns at most 1,000 rows per request
const COPY_INSERT_CHUNK = 1000;

/**
 * Imports catalog rows in bulk: one insert for the new books, then their copies in chunks.
 * Books that already exist (same ISBN, or same title + author) are skipped unless
 * `addCopiesToDuplicates` is set, so running the same file twice never doubles the stock.
 */
export async function batchImportBooks(
  books: ImportBookRow[],
  options: { addCopiesToDuplicates?: boolean } = {}
) {
  const supabase = await assertStaffCatalogAccess();

  if (books.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum batch size is ${MAX_BATCH_SIZE} rows per import.`);
  }

  // Every existing book, page by page, so the duplicate check also sees books past the first 1,000.
  const existingBooks: { id: string; isbn: string | null; title: string | null; author: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, isbn, title, author')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to perform duplicate check database prep: ${error.message}`);
    }
    const page = Array.isArray(data) ? data : [];
    existingBooks.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // Lookup maps: value is an existing book id, or a pending row index (new in this file).
  const cleanIsbnOf = (isbn: string) => isbn.replace(/[- ]/g, '');
  const titleKey = (title: string, author: string) => `${title.trim().toLowerCase()}|||${author.trim().toLowerCase()}`;
  const isbnMap = new Map<string, string | number>();
  const titleAuthorMap = new Map<string, string | number>();
  for (const b of existingBooks) {
    if (b.isbn) isbnMap.set(cleanIsbnOf(b.isbn.trim()), b.id);
    if (b.title && b.author) titleAuthorMap.set(titleKey(b.title, b.author), b.id);
  }

  const categoryCache = new Map<string, string>(); // lowerCategoryName -> categoryId
  const { data: existingCategories } = await supabase.from('categories').select('id, name');
  if (Array.isArray(existingCategories)) {
    existingCategories.forEach(c => {
      if (c && c.name) categoryCache.set(c.name.trim().toLowerCase(), c.id);
    });
  }

  const logs: string[] = [];
  let duplicateCount = 0;
  const newBooks: { row: string; key: string; copies: number; insert: Record<string, unknown> }[] = [];
  const copiesForExisting: { book_id: string; status: string }[] = [];

  for (let i = 0; i < books.length; i++) {
    const row = books[i];
    const indexStr = `Row ${i + 1}`;
    const title = row.title?.trim();
    const author = row.author?.trim();

    if (!title || !author) {
      logs.push(`[${indexStr}] Skipped: Missing title or author`);
      continue;
    }

    const isbn = row.isbn ? String(row.isbn).trim() : '';
    const cleanIsbn = cleanIsbnOf(isbn);
    const key = titleKey(title, author);
    const stock = parseInt(String(row.stock ?? row.copiesCount ?? '1'), 10);
    const copies = isNaN(stock) ? 1 : Math.min(Math.max(stock, 0), MAX_COPIES_PER_ROW);
    if (!isNaN(stock) && stock > MAX_COPIES_PER_ROW) {
      logs.push(`[${indexStr}] Stock capped at ${MAX_COPIES_PER_ROW} copies (file said ${stock}).`);
    }

    const match = (cleanIsbn ? isbnMap.get(cleanIsbn) : undefined) ?? titleAuthorMap.get(key);
    if (match !== undefined) {
      duplicateCount++;
      const reason = cleanIsbn && isbnMap.has(cleanIsbn) ? `matching ISBN (${isbn})` : `matching Title & Author ("${title}" by ${author})`;
      if (!options.addCopiesToDuplicates || copies === 0) {
        logs.push(`[${indexStr}] Skipped duplicate (${reason}).`);
      } else if (typeof match === 'number') {
        newBooks[match].copies = Math.min(newBooks[match].copies + copies, MAX_COPIES_PER_ROW);
        logs.push(`[${indexStr}] Duplicate of an earlier row (${reason}): copies added to it.`);
      } else {
        for (let c = 0; c < copies; c++) copiesForExisting.push({ book_id: match, status: 'AVAILABLE' });
        logs.push(`[${indexStr}] Duplicate (${reason}): adding ${copies} copies to the existing book.`);
      }
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = row.category?.trim() || row.category_name?.trim();
    if (categoryName) {
      const lowerCat = categoryName.toLowerCase();
      categoryId = categoryCache.get(lowerCat) ?? (await getOrCreateCategoryByName(supabase, categoryName));
      if (categoryId) categoryCache.set(lowerCat, categoryId);
    }

    let tagsArray: string[] = [];
    if (Array.isArray(row.tags)) {
      tagsArray = row.tags.map((t: unknown) => String(t).trim());
    } else if (typeof row.tags === 'string') {
      tagsArray = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    const index = newBooks.length;
    if (cleanIsbn) isbnMap.set(cleanIsbn, index);
    titleAuthorMap.set(key, index);
    newBooks.push({
      row: indexStr,
      key,
      copies,
      insert: {
        title,
        author,
        isbn: isbn || null,
        category_id: categoryId || null,
        description: row.description || null,
        published_year: row.published_year ? parseInt(row.published_year, 10) : null,
        cover_url: row.cover_url || null,
        tags: tagsArray,
        location: row.location || null,
        section: row.section || null,
        dewey_decimal: row.dewey_decimal ? String(row.dewey_decimal).trim() : null,
        is_active: true,
      },
    });
  }

  // One insert for all new books; match the returned ids back by title + author (unique in this batch).
  const copyRows = [...copiesForExisting];
  let importedCount = 0;
  if (newBooks.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert(newBooks.map(b => b.insert))
      .select('id, title, author');
    if (insertError) throw new Error(`Import failed, no books were added: ${insertError.message}`);

    const idByKey = new Map((inserted ?? []).map((b: { id: string; title: string; author: string }) => [titleKey(b.title, b.author), b.id]));
    for (const b of newBooks) {
      const id = idByKey.get(b.key);
      if (!id) continue;
      importedCount++;
      for (let c = 0; c < b.copies; c++) copyRows.push({ book_id: id, status: 'AVAILABLE' });
      logs.push(`[${b.row}] Imported "${b.insert.title}" by ${b.insert.author} (${b.copies} copies).`);
    }
  }

  let copiesAddedCount = 0;
  for (let i = 0; i < copyRows.length; i += COPY_INSERT_CHUNK) {
    const chunk = copyRows.slice(i, i + COPY_INSERT_CHUNK);
    const { error: copyError } = await supabase.from('book_copies').insert(chunk);
    if (copyError) {
      logs.push(`Failed to add ${chunk.length} copies: ${copyError.message}`);
    } else {
      copiesAddedCount += chunk.length;
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  await logAuditActivity(
    authData?.user?.id,
    'book',
    null,
    'batch_import',
    `Batch import: ${importedCount} books created, ${copiesAddedCount} copies added, ${duplicateCount} duplicates.`,
    { rows: books.length, imported: importedCount, copiesAdded: copiesAddedCount, duplicates: duplicateCount, addCopiesToDuplicates: Boolean(options.addCopiesToDuplicates) }
  );

  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');

  return {
    success: true,
    imported: importedCount,
    copiesAdded: copiesAddedCount,
    duplicates: duplicateCount,
    logs
  };
}

/**
 * Searches a single ISBN from Google Books and Open Library.
 * If found, downloads and compresses its cover, inserts the book, creates 1 copy, and returns details.
 */
export async function lookupAndImportISBN(isbn: string) {
  const supabase = await assertStaffCatalogAccess();
  const cleanIsbn = isbn.trim().replace(/[- ]/g, '');

  if (!cleanIsbn) {
    return { success: false, isbn, error: 'Invalid ISBN number provided' };
  }

  // 1. Check if ISBN already exists in the database
  const { data: existingBook, error: checkError } = await supabase
    .from('books')
    .select('id, title, author')
    .eq('isbn', cleanIsbn)
    .maybeSingle();

  if (checkError) {
    return { success: false, isbn, error: `Database duplicate lookup failed: ${checkError.message}` };
  }

  if (existingBook) {
    // If the book already exists, just add 1 copy
    const { error: copyError } = await supabase
      .from('book_copies')
      .insert([{ book_id: existingBook.id, status: 'AVAILABLE' }]);

    if (copyError) {
      return { success: false, isbn, error: `Book already exists, but failed to create new copy: ${copyError.message}` };
    }

    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');

    return { 
      success: true, 
      isbn, 
      status: 'exists', 
      bookId: existingBook.id, 
      title: existingBook.title, 
      author: existingBook.author,
      message: `Book already exists ("${existingBook.title}"). Added 1 new copy to inventory.`
    };
  }

  // 2. Fetch from Google Books API
  let bookDetails: GoogleOrOpenLibraryBookDetails | null = null;
  let externalCoverUrl: string | null = null;
  let categoryName: string | null = null;

  try {
    const googleBooksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
    if (googleBooksRes.ok) {
      const data = await googleBooksRes.json();
      if (data.items && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        bookDetails = {
          title: info.title,
          author: info.authors ? info.authors.join(', ') : 'Unknown Author',
          publisher: info.publisher || null,
          published_year: info.publishedDate ? parseInt(info.publishedDate.split('-')[0], 10) : null,
          description: info.description || null,
          dewey_decimal: info.industryIdentifiers?.find((id: { type: string; identifier: string }) => id.type === 'OTHER')?.identifier || null,
          tags: info.categories || []
        };
        categoryName = info.categories && info.categories.length > 0 ? info.categories[0] : null;
        if (info.imageLinks) {
          externalCoverUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || null;
        }
      }
    }
  } catch (err) {
    logger.warn('catalog', `Google Books API check failed for ISBN: ${cleanIsbn}`, { error: err });
  }

  // 3. Fallback to Open Library API
  if (!bookDetails) {
    try {
      const openLibRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
      if (openLibRes.ok) {
        const data = await openLibRes.json();
        const bookKey = `ISBN:${cleanIsbn}`;
        if (data[bookKey]) {
          const info = data[bookKey];
          bookDetails = {
            title: info.title,
            author: info.authors ? (info.authors as Array<{ name: string }>).map((a) => a.name).join(', ') : 'Unknown Author',
            publisher: info.publishers ? (info.publishers as Array<{ name: string }>).map((p) => p.name).join(', ') : null,
            published_year: info.published_date ? parseInt(info.published_date.split(' ').pop() || '', 10) : null,
            description: info.notes || null,
            dewey_decimal: null,
            tags: info.subjects ? (info.subjects as Array<{ name: string }>).map((s) => s.name) : []
          };
          if (info.subjects && info.subjects.length > 0) {
            categoryName = info.subjects[0].name;
          }
          if (info.cover) {
            externalCoverUrl = info.cover.large || info.cover.medium || info.cover.small || null;
          }
        }
      }
    } catch (err) {
      logger.warn('catalog', `Open Library API check failed for ISBN: ${cleanIsbn}`, { error: err });
    }
  }

  if (!bookDetails) {
    return { success: false, isbn, error: 'Book metadata not found in any public APIs' };
  }

  // 4. Resolve or create category
  let categoryId: string | null = null;
  if (categoryName) {
    try {
      categoryId = await getOrCreateCategoryByName(supabase, categoryName);
    } catch (catErr) {
      logger.error('catalog', `Failed to create category during ISBN import: ${categoryName}`, { error: catErr });
    }
  }

  // 5. Ingest cover image into Supabase Storage
  let finalCoverUrl: string | null = null;
  if (externalCoverUrl) {
    finalCoverUrl = await uploadCoverFromUrl(supabase, externalCoverUrl);
  }

  // 6. Insert book record
  const bookInsert = {
    title: bookDetails.title,
    author: bookDetails.author,
    isbn: cleanIsbn,
    category_id: categoryId,
    description: bookDetails.description,
    published_year: bookDetails.published_year,
    cover_url: finalCoverUrl,
    tags: bookDetails.tags,
    dewey_decimal: bookDetails.dewey_decimal,
    is_active: true
  };

  const { data: newBook, error: insertError } = await supabase
    .from('books')
    .insert([bookInsert])
    .select()
    .single();

  if (insertError) {
    return { success: false, isbn, error: `Failed to insert new book record: ${insertError.message}` };
  }

  // 7. Create 1 copy
  const { error: copyError } = await supabase
    .from('book_copies')
    .insert([{ book_id: newBook.id, status: 'AVAILABLE' }]);

  if (copyError) {
    // Soft roll-back
    await supabase.from('books').delete().eq('id', newBook.id);
    return { success: false, isbn, error: `Book record was created, but copy generation failed: ${copyError.message}. Rolled back.` };
  }

  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');

  return {
    success: true,
    isbn,
    status: 'imported',
    bookId: newBook.id,
    title: newBook.title,
    author: newBook.author,
    message: `Successfully imported "${newBook.title}" by ${newBook.author} with 1 copy.`
  };
}
