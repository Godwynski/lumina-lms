export interface ISBNBook {
  isbn: string; title: string; author: string; cover_url: string; tags: string[];
  description: string; published_year: number | null; dewey_decimal: string;
}
type LookupResult = { success: true; book: ISBNBook } | { success: false; reason: 'invalid' | 'not_found' | 'unavailable'; error: string };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : typeof object(value).value === 'string' ? String(object(value).value).trim() : '';
const strings = (value: unknown) => array(value).map(text).filter(Boolean);
const names = (value: unknown) => array(value).map(item => text(object(item).name)).filter(Boolean);
function description(value: unknown): string { return text(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function year(value: unknown): number | null {
  const found = text(value).match(/\b(1\d{3}|20\d{2}|21\d{2})\b/);
  const result = found ? Number(found[1]) : null;
  return result && result <= new Date().getFullYear() + 1 ? result : null;
}
function coverUrl(value: unknown): string {
  try { const url = new URL(text(value)); if (!['http:', 'https:'].includes(url.protocol)) return ''; url.protocol = 'https:'; return url.toString(); } catch { return ''; }
}
export async function lookupISBN(input: string): Promise<LookupResult> {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(isbn)) return { success: false, reason: 'invalid', error: 'Enter a complete ISBN-10 or ISBN-13.' };
  let unavailable = false;
  const read = async (url: string) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
      if (!response.ok) { unavailable = true; return {}; }
      return object(await response.json());
    } catch { unavailable = true; return {}; }
  };
  const googleUrl = new URL('https://www.googleapis.com/books/v1/volumes');
  googleUrl.searchParams.set('q', `isbn:${isbn}`);
  if (process.env.GOOGLE_BOOKS_API_KEY) googleUrl.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  const [google, library] = await Promise.all([
    read(googleUrl.toString()), read(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`),
  ]);
  const g = object(object(array(google.items)[0]).volumeInfo);
  const o = object(library[`ISBN:${isbn}`]);
  const googleImages = object(g.imageLinks), covers = object(o.cover);
  const book: ISBNBook = {
    isbn, title: text(g.title) || text(o.title), author: strings(g.authors).join(', ') || names(o.authors).join(', '),
    cover_url: coverUrl(googleImages.extraLarge || googleImages.large || googleImages.thumbnail || googleImages.smallThumbnail) || coverUrl(covers.large || covers.medium || covers.small) || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    tags: [...new Set([...strings(g.categories), ...names(o.subjects)])],
    description: description(g.description) || description(o.description) || description(o.notes),
    published_year: year(g.publishedDate) || year(o.publish_date),
    dewey_decimal: strings(object(o.classifications).dewey_decimal)[0] || '',
  };
  // Edition/work records contain classifications and descriptions omitted by the Books API.
  if (!book.title || !book.author || !book.description || !book.published_year || !book.dewey_decimal) {
    const edition = await read(`https://openlibrary.org/isbn/${isbn}.json`);
    book.title ||= text(edition.title);
    book.description ||= description(edition.description);
    book.published_year ||= year(edition.publish_date);
    book.dewey_decimal ||= strings(edition.dewey_decimal)[0] || '';
    book.tags = [...new Set([...book.tags, ...strings(edition.subjects)])];
    if (!book.author) book.author = names(edition.authors).join(', ');
    const workKey = text(object(array(edition.works)[0]).key);
    const work = ((!book.description || !book.author) && /^\/works\/OL\d+W$/.test(workKey)) ? await read(`https://openlibrary.org${workKey}.json`) : {};
    book.description ||= description(work.description);
    book.tags = [...new Set([...book.tags, ...strings(work.subjects)])];
    const authorKeys = [...new Set([
      ...array(edition.authors).map(a => text(object(a).key)),
      ...array(work.authors).map(a => text(object(object(a).author).key)),
    ])].filter(key => /^\/authors\/OL\d+A$/.test(key)).slice(0, 5);
    if (!book.author && authorKeys.length) {
      const authors = await Promise.all(authorKeys.map(key => read(`https://openlibrary.org${key}.json`)));
      book.author = authors.map(a => text(a.name)).filter(Boolean).join(', ');
    }
  }
  if (book.title) return { success: true, book };
  return unavailable
    ? { success: false, reason: 'unavailable', error: 'Online book lookup is temporarily unavailable. Retry shortly or enter the details manually.' }
    : { success: false, reason: 'not_found', error: 'No online details found for this ISBN. You can enter the book manually.' };
}
