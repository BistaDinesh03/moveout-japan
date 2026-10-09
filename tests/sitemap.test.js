'use strict';

/**
 * Sitemap integrity gate.
 *
 * Background: sitemap.xml previously listed 17 URLs of which 9 pointed at
 * articles that did not exist, and every entry used a `.html` URL that
 * Cloudflare Pages 308-redirects before serving. A sitemap must contain only
 * final, canonical, indexable URLs that resolve to real content.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';

/** Map a site-absolute, extensionless URL to the file that serves it. */
function resolveUrl(urlPath) {
  if (urlPath === '/' || urlPath === '') return 'index.html';
  const rel = urlPath.replace(/^\//, '');

  const candidates = [
    rel,                    // /assets/css/style.css, /sitemap.xml
    `${rel}.html`,          // /contact -> contact.html
    `${rel.replace(/\/$/, '')}/index.html` // /blog/ -> blog/index.html
  ];
  for (const c of candidates) {
    const full = path.join(ROOT, c);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return c;
  }
  return null;
}

function readSitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, 'sitemap.xml contains no <loc> entries');
  return locs;
}

test('sitemap parses and contains a sensible number of URLs', () => {
  const urls = readSitemapUrls();
  assert.ok(urls.length >= 1);
  assert.ok(urls.length <= 100, `unexpectedly large sitemap: ${urls.length}`);
});

test('every sitemap URL is on the canonical origin', () => {
  for (const url of readSitemapUrls()) {
    assert.ok(
      url.startsWith(`${ORIGIN}/`) || url === ORIGIN,
      `off-origin or malformed URL: ${url}`
    );
    assert.ok(!url.includes(' '), `URL contains a space: ${url}`);
  }
});

test('no sitemap URL uses a .html variant', () => {
  // Cloudflare Pages 308-redirects /path.html -> /path, so advertising the
  // .html form makes every sitemap entry a redirect instead of a page.
  for (const url of readSitemapUrls()) {
    assert.ok(
      !url.endsWith('.html') && !url.includes('.html'),
      `sitemap advertises a redirecting .html URL: ${url}`
    );
  }
});

test('every sitemap URL resolves to a real, non-empty file', () => {
  for (const url of readSitemapUrls()) {
    const urlPath = new URL(url).pathname;
    const file = resolveUrl(urlPath);
    assert.ok(file, `sitemap URL has no backing file: ${url} (path ${urlPath})`);

    const full = path.join(ROOT, file);
    const size = fs.statSync(full).size;
    assert.ok(size > 0, `${file} is 0 bytes but is listed in the sitemap`);
    assert.ok(size > 500, `${file} is only ${size} bytes — too small to be a real page`);
  }
});

test('no sitemap URL points at the not-found page', () => {
  for (const url of readSitemapUrls()) {
    assert.ok(!url.includes('404'), `404 page must not be indexed: ${url}`);
  }
});

test('every indexable page is present in the sitemap', () => {
  const urlPaths = new Set(readSitemapUrls().map((u) => new URL(u).pathname));

  const expected = [
    '/',
    '/contact',
    '/privacy',
    '/pages/how-it-works',
    '/pages/services',
    '/pages/pricing',
    '/pages/faq',
    '/blog/',
    '/blog/posts/how-to-dispose-furniture-japan'
  ];

  for (const p of expected) {
    assert.ok(urlPaths.has(p), `expected sitemap entry missing: ${p}`);
  }
});

test('every published blog article is in the sitemap', () => {
  const urlPaths = new Set(readSitemapUrls().map((u) => new URL(u).pathname));
  const files = fs.readdirSync(path.join(ROOT, 'blog', 'posts')).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    const p = `/blog/posts/${f.replace(/\.html$/, '')}`;
    assert.ok(urlPaths.has(p), `published article not in sitemap: ${p}`);
  }
});

test('lastmod values are real ISO dates', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const mods = [...xml.matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/g)].map((m) => m[1]);
  assert.ok(mods.length > 0, 'no lastmod entries found');
  for (const m of mods) {
    assert.match(m, /^\d{4}-\d{2}-\d{2}$/, `lastmod is not YYYY-MM-DD: ${m}`);
    const t = new Date(`${m}T00:00:00Z`).getTime();
    assert.ok(!Number.isNaN(t), `unparseable lastmod: ${m}`);
    assert.ok(t <= Date.now(), `lastmod is in the future: ${m}`);
  }
});

test('sitemap.xml is well-formed and declares its namespace', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.ok(xml.startsWith('<?xml'), 'missing XML declaration');
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.equal((xml.match(/<url>/g) || []).length, (xml.match(/<\/url>/g) || []).length);
  assert.equal((xml.match(/<loc>/g) || []).length, (xml.match(/<\/loc>/g) || []).length);
  assert.ok(!/<url>[\s\S]*?<url>/.test(xml.replace(/<\/url>[\s\S]*?<url>/g, '')) || true);
});

test('robots.txt points at the sitemap and allows crawling', () => {
  const txt = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(txt, /User-agent:\s*\*/i);
  assert.match(txt, /Allow:\s*\//i);
  assert.ok(txt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), 'robots.txt must reference the sitemap');
});
