/**
 * Blocks repository-internal paths that Cloudflare Pages would otherwise
 * serve from the site root.
 *
 * The site is published from the repository root, so `tests/`, `scripts/`,
 * `research/` and the repository notes are uploaded as static assets.
 * `_redirects` handles the normal spellings of those paths, but a request
 * that percent-encodes the separator (for example `/tests%2Fblog.test.js`)
 * bypasses redirect matching and reaches the file directly.
 *
 * `_routes.json` limits this Function to the internal paths, so ordinary
 * page requests never invoke it and stay on the free static-asset path.
 */

const BLOCKED_DIRS = /^\/(?:tests|scripts|research|functions)(?:\/|$)/;
const BLOCKED_FILES = new Set(['/README.md', '/.gitignore', '/_routes.json']);

function normalize(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Keep the raw path when it is not valid percent-encoding.
  }
  // Collapse duplicate slashes so `//tests/...` is treated as `/tests/...`.
  return decoded.replace(/\/{2,}/g, '/');
}

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  const normalized = normalize(pathname);

  if (!BLOCKED_DIRS.test(normalized) && !BLOCKED_FILES.has(normalized)) {
    return context.next();
  }

  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow'
    }
  });
}
