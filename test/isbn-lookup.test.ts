import { afterEach, expect, it, vi } from 'vitest';
import { lookupISBN } from '@/lib/isbn-lookup';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('does not mistake denied provider requests for a missing book', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}', {status:403})));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:false,reason:'unavailable'});
});
it('retains the longest provider Retry-After delay on partial metadata', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
  if (String(url).includes('googleapis')) return new Response('{}', {status:429,headers:{'retry-after':'15'}});
  if (String(url).includes('/api/books')) return new Response(JSON.stringify({'ISBN:9780451524935':{title:'1984'}}));
  return new Response('{}', {status:503,headers:{'retry-after':'30'}});
 }));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:true,transient:true,retryAfterMs:30000,book:{title:'1984',author:''}});
});
it('parses date Retry-After for outages and ignores ordinary missing editions', async () => {
 const now = Date.now();
 vi.spyOn(Date, 'now').mockReturnValue(now);
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}', {status:503,headers:{'retry-after':new Date(now + 60000).toUTCString()}})));
 const result = await lookupISBN('9780451524935');
 expect(result).toMatchObject({success:false,reason:'unavailable',retryAfterMs:expect.any(Number)});
 expect('retryAfterMs' in result && result.retryAfterMs).toBeGreaterThan(59000);
 vi.restoreAllMocks();
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}', {status:404})));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:false,reason:'not_found'});
});
it('keeps ordered secure cover candidates for fallback', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(String(url).includes('googleapis')
  ? {items:[{volumeInfo:{title:'1984',imageLinks:{large:'http://books.google.com/large.jpg',thumbnail:'http://books.google.com/small.jpg'}}}]}
  : {'ISBN:9780451524935':{cover:{large:'http://covers.openlibrary.org/cover.jpg'}}}))));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:true,covers:[
  'https://books.google.com/large.jpg','https://books.google.com/small.jpg','https://covers.openlibrary.org/cover.jpg',
  'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg?default=false',
 ]});
});
it('skips a mismatched Google edition and accepts its matching ISBN-10 equivalent', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(String(url).includes('googleapis') ? {items:[
  {volumeInfo:{title:'Wrong edition',industryIdentifiers:[{type:'ISBN_13',identifier:'9780141036144'}],imageLinks:{thumbnail:'https://wrong.test/cover'}}},
  {volumeInfo:{title:'1984',industryIdentifiers:[{type:'ISBN_10',identifier:'0451524934'}]}},
 ]} : {}))));
 const result = await lookupISBN('9780451524935');
 expect(result).toMatchObject({success:true,book:{title:'1984'}});
 expect(result.success && result.book.cover_url).not.toContain('wrong.test');
});
it('falls back to Open Library when Google quota is exhausted', async () => {
 const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', {status:429})).mockResolvedValueOnce(new Response(JSON.stringify({ 'ISBN:9780451524935': { title:'1984', authors:[{name:'George Orwell'}], cover:{large:'http://covers.openlibrary.org/cover.jpg'} } })));
 vi.stubGlobal('fetch', fetcher);
 const result = await lookupISBN('978-0451524935');
 expect(result).toMatchObject({success:true, book:{isbn:'9780451524935',title:'1984',author:'George Orwell',cover_url:'https://covers.openlibrary.org/cover.jpg'}});
});
it('distinguishes an outage from a genuine missing book', async () => {
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:false, reason:'unavailable'});
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}')));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:false, reason:'not_found'});
});
it('rejects malformed ISBNs before contacting providers', async () => {
 const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher);
 expect(await lookupISBN('123')).toMatchObject({success:false,reason:'invalid'});
 expect(fetcher).not.toHaveBeenCalled();
});

it('combines provider metadata including Dewey classification, description and publication year', async () => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
  if (String(url).includes('googleapis')) return new Response(JSON.stringify({items:[{volumeInfo:{title:'Example',authors:['Author'],description:'<p>About this book</p>',publishedDate:'2020-03',categories:['Computer Science']}}]}));
  return new Response(JSON.stringify({'ISBN:9780451524935':{title:'Example',classifications:{dewey_decimal:['005.1']},subjects:[{name:'Programming'}],cover:{large:'https://covers.openlibrary.org/x.jpg'}}}));
 }));
 expect(await lookupISBN('9780451524935')).toMatchObject({success:true,book:{title:'Example',description:'About this book',published_year:2020,dewey_decimal:'005.1',tags:expect.arrayContaining(['Computer Science','Programming'])}});
});

it.each([
 ['A story about freedom.\n\n----------\nAlso contained in: [Collected novels](https://openlibrary.org/works/OL1W)', 'A story about freedom.'],
 ['<p>A practical guide.</p><p>Source: Open Library</p>', 'A practical guide.'],
 ['A thoughtful novel. — From Wikipedia', 'A thoughtful novel.'],
 ['A novel by George Orwell about truth and power.', 'A novel by George Orwell about truth and power.'],
])('keeps the synopsis and removes trailing source credits', async (raw, expected) => {
 vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({items:[{volumeInfo:{title:'Book',description:raw}}]}))));
 const result = await lookupISBN('9780451524935');
 expect(result.success && result.book.description).toBe(expected);
});
