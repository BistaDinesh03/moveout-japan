'use strict';

/**
 * Dependency-free local preview server for Move Out Japan.
 *
 * WHAT IT IS FOR
 * --------------
 * The security headers in `_headers` and the routing behaviour of `_redirects`
 * only take effect on Cloudflare Pages. This server reimplements enough of
 * those rules to inspect them locally *before* deploying, so a bad CSP or a
 * self-looping redirect can be caught on this machine.
 *
 * It deliberately mimics the two behaviours that caused real bugs:
 *   1. `/path.html` is 308-redirected to `/path`, and `/path` is then served
 *      from `path.html`. Reproducing this is what revealed the `/contact`
 *      infinite redirect loop.
 *   2. Unmatched paths return the body of `404.html` with a genuine HTTP 404
 *      status, not a 200.
 *
 * WHAT IT IS NOT
 * --------------
 * It is NOT a production server, NOT Cloudflare, and NOT a test of either.
 * It does not run JavaScript, so it cannot exercise the quote form. It has no
 * connection to EmailJS and cannot send email under any circumstance: it
 * imports nothing but `node:http`, `node:fs`, `node:path` and `node:url`.
 *
 * USAGE
 *   node scripts/serve-local.js            # http://127.0.0.1:8080
 *   node scripts/serve-local.js --port=3000
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// This file is CommonJS (there is no package.json setting "type": "module"),
// so __dirname is available and import.meta would be a syntax error.
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2'
};

// ---------------------------------------------------------------------------
// _headers parsing
// ---------------------------------------------------------------------------

function loadHeaderRules() {
  const file = path.join(ROOT, '_headers');
  if (!fs.existsSync(file)) return [];

  const rules = [];
  let current = null;

  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (raw.trim() === '' || raw.startsWith('#')) continue;

    if (/^\s/.test(raw)) {
      if (!current) continue; // malformed; ignore rather than crash
      const idx = raw.indexOf(':');
      if (idx === -1) continue;
      current.headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
    } else {
      current = { path: raw.trim(), headers: {} };
      rules.push(current);
    }
  }
  return rules;
}

/** Cloudflare Pages applies every matching rule; later rules win on a clash. */
function headersFor(rules, urlPath) {
  const out = {};
  for (const rule of rules) {
    const p = rule.path;
    let matched = false;

    if (p === '/*') matched = true;
    else if (p.endsWith('/*')) matched = urlPath === p.slice(0, -2) || urlPath.startsWith(p.slice(0, -1));
    else if (p.includes(':')) {
      const rx = new RegExp('^' + p.split('/').map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '$');
      matched = rx.test(urlPath);
    } else matched = p === urlPath;

    if (matched) Object.assign(out, rule.headers);
  }
  return out;
}

// ---------------------------------------------------------------------------
// _redirects parsing
// ---------------------------------------------------------------------------

function loadRedirectRules() {
  const file = path.join(ROOT, '_redirects');
  if (!fs.existsSync(file)) return [];

  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .map((l) => {
      const parts = l.split(/\s+/);
      return { source: parts[0], target: parts[1], status: Number(parts[2] || 301) };
    });
}

// ---------------------------------------------------------------------------
// Path resolution — mirrors Cloudflare Pages' normalisation
// ---------------------------------------------------------------------------

/** `/contact.html` -> `/contact`, `/blog/index.html` -> `/blog/` */
function stripHtmlExtension(p) {
  if (p.endsWith('/index.html')) return p.slice(0, -'index.html'.length);
  if (p.endsWith('.html')) return p.slice(0, -'.html'.length);
  return p;
}

function statOrNull(p) {
  try {
    const s = fs.statSync(p);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

/** Returns { file, status, location } or null. */
function resolve(urlPath) {
  const rel = urlPath.replace(/^\/+/, '');

  // 1. A literal .html request normalises to its extensionless form.
  if (urlPath.endsWith('.html')) {
    return { redirect: stripHtmlExtension(urlPath) };
  }

  // 2. Direct hit on a real asset (css/js/images/xml/...).
  const direct = statOrNull(path.join(ROOT, rel));
  if (direct) return { file: path.join(ROOT, rel), size: direct.size };

  // 3. Extensionless URL backed by `<path>.html`.
  const asHtml = statOrNull(path.join(ROOT, `${rel}.html`));
  if (asHtml) return { file: path.join(ROOT, `${rel}.html`), size: asHtml.size };

  // 4. Directory index.
  const asIndex = statOrNull(path.join(ROOT, rel, 'index.html'));
  if (asIndex) return { file: path.join(ROOT, rel, 'index.html'), size: asIndex.size };

  return null;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const headerRules = loadHeaderRules();
const redirectRules = loadRedirectRules();

function applyHeaders(res, urlPath) {
  for (const [name, value] of Object.entries(headersFor(headerRules, urlPath))) {
    res.setHeader(name, value);
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  // Security headers apply to every response, including redirects and 404s.
  applyHeaders(res, urlPath);

  // 1. Cloudflare normalises .html URLs before consulting _redirects.
  if (urlPath.endsWith('.html')) {
    const to = stripHtmlExtension(urlPath);
    res.writeHead(308, { Location: to, 'X-Preview-Rule': 'html-normalise' });
    res.end();
    return;
  }

  // 2. _redirects (3xx redirect or 200 rewrite).
  for (const rule of redirectRules) {
    const exact = rule.source === urlPath;
    const splat = rule.source.endsWith('/*') && urlPath.startsWith(rule.source.slice(0, -1));
    if (!exact && !splat) continue;

    if (rule.status === 200) {
      urlPath = rule.target;
      res.setHeader('X-Preview-Rule', `rewrite ${rule.source} -> ${rule.target}`);
      break;
    }
    res.writeHead(rule.status, { Location: rule.target, 'X-Preview-Rule': `${rule.source} -> ${rule.target}` });
    res.end();
    return;
  }

  // 3. Trailing-slash normalisation for directories.
  const resolved = resolve(urlPath);
  if (resolved && resolved.redirect) {
    res.writeHead(308, { Location: resolved.redirect, 'X-Preview-Rule': 'redirect' });
    res.end();
    return;
  }

  // 4. Serve the file.
  if (resolved) {
    const ext = path.extname(resolved.file).toLowerCase();
    // _headers overrides the guessed content type where it specifies one.
    if (!headersFor(headerRules, urlPath)['Content-Type']) {
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    }
    res.writeHead(200, { 'Content-Length': resolved.size });
    fs.createReadStream(resolved.file).pipe(res);
    return;
  }

  // 5. A genuine 404, using 404.html as the body.
  const notFound = statOrNull(path.join(ROOT, '404.html'));
  if (notFound) {
    res.setHeader('Content-Type', MIME['.html']);
    res.writeHead(404, { 'Content-Length': notFound.size });
    fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

const arg = process.argv.find((a) => a.startsWith('--port='));
const port = arg ? Number(arg.slice(7)) : 8080;

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `Move Out Japan preview: http://127.0.0.1:${port}\n` +
    `  serving ${ROOT}\n` +
    `  ${headerRules.length} _headers rule(s), ${redirectRules.length} _redirects rule(s)\n` +
    `  security headers are applied; no JavaScript runs; no network calls are made\n`
  );
});
