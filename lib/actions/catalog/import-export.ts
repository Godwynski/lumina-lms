'use server';

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
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
  if (!url || !url.startsWith("http")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const bytes = await res.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);

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

/**
 * Processes a batch of book metadata rows for import.
 * Supports duplicate resolution (updates copy count) and auto-category creation.
 */
export async function batchImportBooks(books: ImportBookRow[]) {
  const supabase = await assertStaffCatalogAccess();
  
  let importedCount = 0;
  let copiesAddedCount = 0;
  let duplicateCount = 0;
  const logs: string[] = [];

  // Fetch all existing books to perform highly efficient in-memory duplicate checks
  const { data: existingBooks, error: fetchError } = await supabase
    .from('books')
    .select('id, isbn, title, author');

  if (fetchError) {
    throw new Error(`Failed to perform duplicate check database prep: ${fetchError.message}`);
  }

  // Build high-speed lookup maps
  const isbnMap = new Map<string, string>(); // cleanedIsbn -> bookId
  const titleAuthorMap = new Map<string, string>(); // "title|||author" -> bookId

  (existingBooks || []).forEach(b => {
    if (b.isbn) {
      const cleanIsbn = b.isbn.trim().replace(/[- ]/g, '');
      isbnMap.set(cleanIsbn, b.id);
    }
    if (b.title && b.author) {
      const key = `${b.title.trim().toLowerCase()}|||${b.author.trim().toLowerCase()}`;
      titleAuthorMap.set(key, b.id);
    }
  });

  // Resolve categories in batches to avoid duplicates
  const categoryCache = new Map<string, string>(); // categoryName -> categoryId

  for (let i = 0; i < books.length; i++) {
    const row = books[i];
    const indexStr = `Row ${i + 1}`;

    try {
      const title = row.title?.trim();
      const author = row.author?.trim();

      if (!title || !author) {
        logs.push(`[${indexStr}] Skipped: Missing title or author`);
        continue;
      }

      // Check duplicates
      let existingBookId: string | null = null;
      let duplicateReason = '';

      const isbn = row.isbn ? String(row.isbn).trim() : '';
      const cleanIsbn = isbn.replace(/[- ]/g, '');

      if (cleanIsbn && isbnMap.has(cleanIsbn)) {
        existingBookId = isbnMap.get(cleanIsbn)!;
        duplicateReason = `matching ISBN (${isbn})`;
      } else {
        const key = `${title.toLowerCase()}|||${author.toLowerCase()}`;
        if (titleAuthorMap.has(key)) {
          existingBookId = titleAuthorMap.get(key)!;
          duplicateReason = `matching Title & Author ("${title}" by ${author})`;
        }
      }

      const stock = parseInt(String(row.stock || row.copiesCount || '1'), 10);
      const copiesToCreate = isNaN(stock) || stock < 0 ? 1 : stock;

      if (existingBookId) {
        duplicateCount++;
        // Duplicate found: increment copies of existing book
        if (copiesToCreate > 0) {
          const copies = Array.from({ length: copiesToCreate }).map(() => ({
            book_id: existingBookId,
            status: 'AVAILABLE'
          }));

          const { error: copyError } = await supabase
            .from('book_copies')
            .insert(copies);

          if (copyError) {
            logs.push(`[${indexStr}] Warning: Book duplicate found (${duplicateReason}), but failed to add ${copiesToCreate} copies: ${copyError.message}`);
          } else {
            copiesAddedCount += copiesToCreate;
            logs.push(`[${indexStr}] Duplicate resolved: Combined copies with existing book (${duplicateReason}) and added ${copiesToCreate} copies.`);
          }
        } else {
          logs.push(`[${indexStr}] Skipped duplicate: Found matching book (${duplicateReason}) and copy count was 0.`);
        }
        continue;
      }

      // No duplicate: Resolve or create category
      let categoryId: string | null = null;
      const categoryName = row.category?.trim() || row.category_name?.trim();
      if (categoryName) {
        if (categoryCache.has(categoryName)) {
          categoryId = categoryCache.get(categoryName)!;
        } else {
          categoryId = await getOrCreateCategoryByName(supabase, categoryName);
          if (categoryId) {
            categoryCache.set(categoryName, categoryId);
          }
        }
      }

      // Process tags
      let tagsArray: string[] = [];
      if (row.tags) {
        if (Array.isArray(row.tags)) {
          tagsArray = row.tags.map((t: unknown) => String(t).trim());
        } else if (typeof row.tags === 'string') {
          tagsArray = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Insert new Book
      const bookInsert = {
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
        is_active: true
      };

      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert([bookInsert])
        .select()
        .single();

      if (insertError) {
        logs.push(`[${indexStr}] Failed to import: ${insertError.message}`);
        continue;
      }

      // Update lookup caches immediately
      if (isbn) isbnMap.set(cleanIsbn, newBook.id);
      titleAuthorMap.set(`${title.toLowerCase()}|||${author.toLowerCase()}`, newBook.id);

      importedCount++;

      // Create copies
      if (copiesToCreate > 0) {
        const copies = Array.from({ length: copiesToCreate }).map(() => ({
          book_id: newBook.id,
          status: 'AVAILABLE'
        }));

        const { error: copyError } = await supabase
          .from('book_copies')
          .insert(copies);

        if (copyError) {
          logs.push(`[${indexStr}] Imported new book "${title}" but failed to add copies: ${copyError.message}`);
        } else {
          copiesAddedCount += copiesToCreate;
          logs.push(`[${indexStr}] Successfully imported: "${title}" by ${author} (${copiesToCreate} copies).`);
        }
      } else {
        logs.push(`[${indexStr}] Successfully imported: "${title}" by ${author} (0 copies).`);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logs.push(`[${indexStr}] Failed due to system error: ${errMsg}`);
    }
  }

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
