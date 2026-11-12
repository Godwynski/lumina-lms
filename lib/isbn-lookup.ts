export interface ISBNBook { isbn: string; title: string; author: string; cover_url: string; tags: string[] }
type LookupResult = { success: true; book: ISBNBook } | { success: false; reason: 'invalid' | 'not_found' | 'unavailable'; error: string };
function coverUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) return ''; url.protocol = 'https:'; return url.toString(); } catch { return ''; }
}
export async function lookupISBN(input: string): Promise<LookupResult> {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(isbn)) return { success: false, reason: 'invalid', error: 'Enter a complete ISBN-10 or ISBN-13.' };
  let unavailable = false;
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', `isbn:${isbn}`);
    if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) unavailable = true;
    else {
      const data = await response.json();
      const info = data.items?.[0]?.volumeInfo;
      if (typeof info?.title === 'string' && info.title.trim()) return { success: true, book: {
        isbn, title: info.title.trim(), author: Array.isArray(info.authors) ? info.authors.filter((a: unknown) => typeof a === 'string').join(', ') : '',
        cover_url: coverUrl(info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail) || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
        tags: Array.isArray(info.categories) ? info.categories.filter((c: unknown) => typeof c === 'string') : [],
      } };
    }
  } catch { unavailable = true; }
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) unavailable = true;
    else {
      const data = await response.json();
      const info = data[`ISBN:${isbn}`];
      if (typeof info?.title === 'string' && info.title.trim()) return { success: true, book: {
        isbn, title: info.title.trim(), author: Array.isArray(info.authors) ? info.authors.map((a: { name?: string }) => a?.name).filter((name: unknown) => typeof name === 'string').join(', ') : '',
        cover_url: coverUrl(info.cover?.large || info.cover?.medium || info.cover?.small) || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
        tags: Array.isArray(info.subjects) ? info.subjects.slice(0, 5).map((s: { name?: string }) => s?.name).filter((name: unknown) => typeof name === 'string') : [],
      } };
    }
  } catch { unavailable = true; }
  return unavailable
    ? { success: false, reason: 'unavailable', error: 'Online book lookup is temporarily unavailable. Retry shortly or enter the details manually.' }
    : { success: false, reason: 'not_found', error: 'No online details found for this ISBN. You can enter the book manually.' };
}
