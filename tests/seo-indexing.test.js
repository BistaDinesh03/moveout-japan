'use strict';

/**
 * Technical indexing gate.
 *
 * Background: the blog listing previously contained zero server-rendered
 * article links — every card was injected by main.js. Crawlers that do not run
 * JavaScript saw an empty hub page, and discovery of the newest guides relied
 * entirely on the XML sitemap. The listing now ships a static fallback set of
 * cards which main.js replaces on load. This suite keeps that progressive
 * enhancement in place and pins the other indexing-critical contracts:
 * robots.txt, canonical uniqueness, sitemap hygiene, redirect rules and
 * structured-data validity.
 *
 * This suite makes no network calls (enforced by tests/email-safety.test.js).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function collectHtml(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function readBlogPosts() {
  const src = read('assets/js/main.js');
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

/** Extensionless canonical URL a published file should declare. */
function expectedPath(rel) {
  if (rel === 'index.html') return '/';
  if (rel === 'contact.html') return '/contact';
  if (rel === 'privacy.html') return '/privacy';
  if (rel === 'partners.html') return '/partners';
  if (rel === '404.html') return '/404';
  if (rel === 'sitemap.html') return '/sitemap';
  if (rel === 'blog/index.html') return '/blog/';
  return '/' + rel.replace(/\.html$/, '');
}

// ============================================================
// 1. Discovery from the blog hub
// ============================================================

test('blog index ships server-rendered links to every published guide', () => {
  const html = read('blog/index.html');
  assert.match(html, /id="blog-listing-container"/, 'JS needs its render container');
  assert.match(html, /src="\/assets\/js\/main\.js"/, 'JS must still render the interactive cards');

  const hrefs = [...html.matchAll(/<a class="card blog-card" href="(\/blog\/posts\/[^"]+)"/g)]
    .map((m) => m[1]);
  const expected = [...readBlogPosts()].map((p) => `/blog/posts/${p.slug}`).sort();
  assert.deepEqual(hrefs.sort(), expected,
    'static fallback cards must match BLOG_POSTS exactly');
  assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate fallback cards');
  assert.match(html, /main\.js replaces this container/i,
    'keep the note explaining why static and JS cards do not conflict');
});

test('blog hub links are canonical, extensionless and unique', () => {
  const html = read('blog/index.html');
  for (const href of [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1])) {
    assert.ok(!href.endsWith('.html'), `non-canonical link in blog index: ${href}`);
    assert.notEqual(href, '/blog', 'use /blog/ rather than the redirecting /blog');
  }
});

// ============================================================
// 2. Robots and sitemap
// ============================================================

test('robots.txt allows crawling and declares the canonical sitemap', () => {
  const txt = read('robots.txt');
  assert.match(txt, /User-agent:\s*\*/i);
  assert.match(txt, /Allow:\s*\/\s*$/im);
  assert.ok(txt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
  assert.ok(!/Disallow:\s*\/(blog|pages|assets)/i.test(txt),
    'important paths must not be disallowed');
  assert.ok(!/User-agent:\s*Googlebot[\s\S]*?Disallow/im.test(txt),
    'Googlebot must not have stricter rules than other crawlers');
});

test('sitemap.xml contains unique, canonical, indexable URLs only', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 10, 'sitemap unexpectedly small');
  assert.equal(new Set(locs).size, locs.length, 'duplicate sitemap URLs');

  for (const url of locs) {
    assert.ok(url.startsWith(ORIGIN + '/') || url === ORIGIN, `off-origin URL: ${url}`);
    assert.ok(!url.includes('.html'), `redirecting .html URL in sitemap: ${url}`);
    assert.ok(!url.endsWith('/sitemap') && !url.endsWith('/404'),
      `noindex page in sitemap: ${url}`);

    const urlPath = new URL(url).pathname;
    const rel = urlPath === '/' ? 'index.html'
      : urlPath === '/blog/' ? 'blog/index.html'
      : `${urlPath.replace(/^\//, '')}.html`;
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `sitemap URL has no file: ${url} -> ${rel}`);
    const html = read(rel);
    assert.ok(!/<meta name="robots"[^>]*noindex/i.test(html),
      `noindex page should not be in sitemap: ${url}`);
  }

  const files = fs.readdirSync(path.join(ROOT, 'blog', 'posts')).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    assert.ok(locs.includes(`${ORIGIN}/blog/posts/${f.replace(/\.html$/, '')}`),
      `published article missing from sitemap: ${f}`);
  }
});

// ============================================================
// 3. Canonicals, directives and duplicates
// ============================================================

test('every published page has one matching canonical and the right robots directive', () => {
  for (const file of collectHtml()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)];
    const robots = (html.match(/<meta name="robots" content="([^"]+)">/i) || [])[1] || '';

    if (canonicals.length === 0) continue; // pages that intentionally lack one
    assert.equal(canonicals.length, 1, `${rel} has duplicate canonical tags`);
    assert.equal(canonicals[0][1], `${ORIGIN}${expectedPath(rel)}`,
      `${rel} declares the wrong canonical`);
    assert.ok(canonicals[0][1].startsWith('https://'), `${rel} canonical is not HTTPS`);
    assert.ok(!canonicals[0][1].endsWith('.html'), `${rel} canonical uses a redirecting URL`);

    const intentionalNoindex = rel === '404.html' || rel === 'sitemap.html';
    if (intentionalNoindex) {
      assert.match(robots, /noindex/, `${rel} must stay noindex`);
    } else {
      assert.doesNotMatch(robots, /noindex/, `${rel} must be indexable`);
      assert.match(robots, /index/, `${rel} should explicitly allow indexing`);
    }
  }
});

test('no two published pages share a title or a canonical URL', () => {
  const titles = new Map();
  const canonicals = new Map();
  for (const file of collectHtml()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    if (title) {
      assert.ok(!titles.has(title), `duplicate title "${title}" in ${rel} and ${titles.get(title)}`);
      titles.set(title, rel);
    }
    if (canonical) {
      assert.ok(!canonicals.has(canonical), `duplicate canonical ${canonical} in ${rel} and ${canonicals.get(canonical)}`);
      canonicals.set(canonical, rel);
    }
  }
});

test('all structured data blocks are valid JSON', () => {
  for (const file of collectHtml()) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [i, block] of [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].entries()) {
      assert.doesNotThrow(() => JSON.parse(block[1]),
        `${path.relative(ROOT, file)}: JSON-LD block ${i} is invalid`);
    }
  }
});

// ============================================================
// 4. Redirect rules and internal links
// ============================================================

test('redirect rules preserve working routes and never loop', () => {
  const rules = read('_redirects').split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/));

  for (const [from, to] of rules) {
    assert.notEqual(from.replace(/\/$/, ''), to.replace(/\/$/, ''),
      `self-looping redirect: ${from} -> ${to}`);
    assert.notEqual(from, '/contact', 'no redirect rule may touch /contact');
    if (to === '/index.html' || to === '/') {
      assert.ok(from.includes('/'), `internal path redirect targets the homepage: ${from}`);
    }
  }
});

test('internal links across the site use final, extensionless URLs', () => {
  const offenders = [];
  for (const file of collectHtml().concat([path.join(ROOT, 'assets/js/main.js')])) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      if (href.endsWith('.html')) offenders.push(`${rel} -> ${href}`);
      if (href === '/blog') offenders.push(`${rel} -> ${href} (use /blog/)`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('the two newest articles remain crawlable, canonical and linked', () => {
  for (const slug of [
    'moving-to-japan-housing-services-support',
    'hiring-foreign-employees-japan-relocation-support'
  ]) {
    const file = path.join(ROOT, 'blog', 'posts', `${slug}.html`);
    assert.ok(fs.existsSync(file), `missing article ${slug}`);
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.length > 20000, `${slug} is too small to be a real guide`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}/blog/posts/${slug}">`));
    assert.match(html, /<h1>/, `${slug} has no server-rendered H1`);
    assert.doesNotMatch(html, /<meta name="robots"[^>]*noindex/i);
  }
});
