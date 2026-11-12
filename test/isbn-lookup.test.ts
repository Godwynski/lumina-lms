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
