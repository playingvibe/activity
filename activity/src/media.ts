/**
 * Rewrites a track's raw artwork URL to go through the bot's own thumbnail proxy
 * (`ThumbnailProxy`, `src/presentation/http/thumbnailProxy.js`), which is what actually gets
 * it past Discord's CSP.
 *
 * Discord's `img-src` allows only `'self'` and Discord's own CDNs — an `<img>` pointed
 * directly at `i.ytimg.com`/`i1.sndcdn.com`/etc. is blocked outright. Routing it through
 * `/.proxy/api/thumbnail?url=...` makes the request same-origin from the browser's
 * perspective; the bot fetches the real image server-side and re-serves it.
 */
export function thumbnailSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/.proxy/api/thumbnail?url=${encodeURIComponent(url)}`;
}
