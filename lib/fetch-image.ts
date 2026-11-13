import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Loopback, private, link-local, carrier-grade NAT, multicast and reserved ranges.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isBlockedAddress(address: string) {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/** Thrown with a message that is safe to show to the user. */
export class ImageFetchError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfterMs?: number) {
    super(message);
  }
}

/**
 * Downloads a remote image for server-side processing. Only public HTTPS hosts, up to three validated redirects,
 * raster images only, at most 5 MB (checked while streaming, so a huge body is never buffered).
 */
export async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  let currentUrl = url;
  let res!: Response;
  const signal = AbortSignal.timeout(10_000);
  for (let redirects = 0; ; redirects++) {
    let parsed: URL;
    try { parsed = new URL(currentUrl); } catch { throw new ImageFetchError("Invalid image URL."); }
    if (parsed.protocol !== "https:") throw new ImageFetchError("Only HTTPS image URLs are allowed.");
    if (parsed.username || parsed.password) throw new ImageFetchError("Image URLs cannot contain credentials.");
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
    if (!addresses.length) throw new ImageFetchError("Image host could not be found.");
    if (addresses.some(a => isBlockedAddress(a.address))) throw new ImageFetchError("Restricted remote image host.");
    // shortcut: DNS is resolved again by fetch; pin validated addresses if accepting untrusted DNS hosts becomes necessary.
    try { res = await fetch(parsed, { redirect: "manual", signal }); }
    catch { throw new ImageFetchError("Could not download the image. The image host may be unavailable or timed out."); }
    if (![301, 302, 303, 307, 308].includes(res.status)) break;
    await res.body?.cancel();
    if (redirects >= 3) throw new ImageFetchError("Image has too many redirects.");
    const location = res.headers.get("location");
    if (!location) throw new ImageFetchError("Image redirect has no destination.");
    try { currentUrl = new URL(location, parsed).toString(); }
    catch { throw new ImageFetchError("Invalid image redirect URL."); }
  }
  if (!res.ok || !res.body) {
    const retryAfter = res.headers.get("retry-after")?.trim();
    const delay = retryAfter ? (/^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : NaN;
    await res.body?.cancel();
    throw new ImageFetchError(`Could not download the image (HTTP ${res.status}).`, res.status, Number.isFinite(delay) ? Math.max(0, delay) : undefined);
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // SVG is excluded: it can carry scripts and is parsed by librsvg inside sharp.
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    await res.body.cancel();
    throw new ImageFetchError("The URL does not point to a supported image.");
  }
  if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    await res.body.cancel();
    throw new ImageFetchError("Image is larger than 5 MB.");
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageFetchError("Image is larger than 5 MB.");
    }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks), contentType };
}
