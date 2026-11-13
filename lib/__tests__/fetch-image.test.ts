// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { fetchImage } from '@/lib/fetch-image';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const imageResponse = (bytes: number, type = 'image/png', headers: Record<string, string> = {}) =>
  new Response(new Uint8Array(bytes), { headers: { 'content-type': type, ...headers } });

describe('fetchImage (C6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
  });

  it('downloads a public HTTPS image using manual redirect validation', async () => {
    fetchMock.mockResolvedValue(imageResponse(10));
    const { buffer, contentType } = await fetchImage('https://example.com/a.png');
    expect(buffer.length).toBe(10);
    expect(contentType).toBe('image/png');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it.each([
    ['45', 45000],
    [new Date(2030, 0, 1).toUTCString(), new Date(2030, 0, 1).getTime() - new Date(2029, 11, 31, 23, 59).getTime()],
  ])('exposes HTTP status and Retry-After %s to import retries', async (retryAfter, delay) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date(2029, 11, 31, 23, 59).getTime());
    fetchMock.mockResolvedValueOnce(new Response(null, {status:429,headers:{'retry-after':retryAfter}}));
    await expect(fetchImage('https://example.com/cover')).rejects.toMatchObject({status:429,retryAfterMs:delay});
    clock.mockRestore();
  });

  it.each([
    ['http://example.com/a.png', 'HTTPS'],
    ['https://127.0.0.1/a.png', 'Restricted'],
    ['https://[::1]/a.png', 'Restricted'],
    ['https://[::ffff:10.0.0.1]/a.png', 'Restricted'],
    ['not a url', 'Invalid'],
  ])('rejects %s', async (url, message) => {
    await expect(fetchImage(url)).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a public name that resolves to a private address', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
    await expect(fetchImage('https://metadata.evil.test/x')).rejects.toThrow('Restricted');
  });

  it('follows a public HTTPS cover redirect', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://covers.example.com/final.jpg' } })).mockResolvedValueOnce(imageResponse(10));
    expect((await fetchImage('https://example.com/cover')).buffer.length).toBe(10);
    expect(lookup).toHaveBeenCalledWith('covers.example.com', { all: true });
  });
  it.each(['https://127.0.0.1/private', 'http://example.com/insecure'])('rejects unsafe redirect destination %s', async location => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));
    await expect(fetchImage('https://example.com/cover')).rejects.toThrow(/Restricted|HTTPS/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('limits redirect loops', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/loop' } }));
    await expect(fetchImage('https://example.com/cover')).rejects.toThrow('redirects');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock.mockReset();
  });

  it('rejects non-images and SVG', async () => {
    fetchMock.mockResolvedValueOnce(imageResponse(10, 'text/html'));
    await expect(fetchImage('https://example.com/a')).rejects.toThrow('supported image');
    fetchMock.mockResolvedValueOnce(imageResponse(10, 'image/svg+xml'));
    await expect(fetchImage('https://example.com/a.svg')).rejects.toThrow('supported image');
  });

  it('stops reading a body over 5 MB even without a content-length header', async () => {
    fetchMock.mockResolvedValue(imageResponse(5 * 1024 * 1024 + 1));
    await expect(fetchImage('https://example.com/big.png')).rejects.toThrow('5 MB');
  });
});
