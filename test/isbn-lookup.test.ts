import { afterEach, expect, it, vi } from 'vitest';
import { lookupISBN } from '@/lib/isbn-lookup';
afterEach(() => vi.unstubAllGlobals());
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
