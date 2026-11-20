/**
 * Appends a cache-busting query parameter to an avatar URL.
 * 
 * When avatar images are stored with deterministic filenames (e.g. profile_STU-001.webp)
 * and long cache-control headers, the browser will serve stale versions even after the
 * image content changes. This utility appends `?v=<timestamp>` derived from the profile's
 * `updated_at` field to force the browser to refetch.
 */
export function bustAvatarCache(
  url: string | null | undefined,
  updatedAt: string | null | undefined
): string | undefined {
  if (!url) return undefined;
  if (!updatedAt) return url;

  try {
    const ts = new Date(updatedAt).getTime();
    if (isNaN(ts)) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${ts}`;
  } catch {
    return url;
  }
}
