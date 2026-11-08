'use strict';

/**
 * Partnership content gate.
 *
 * Covers the fifth article, the /partners enquiry page and the
 * /pages/affiliate-disclosure policy. The checks are deliberately strict about
 * the things that are easy to get wrong in commercial content: invented
 * partners, unpublished rates, undisclosed placements, broken internal links
 * and FAQ/JSON-LD drift.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';
const SLUG = 'partner-with-move-out-japan';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-11-08';
const PARTNERS = path.join(ROOT, 'partners.html');
const PARTNERS_URL = `${ORIGIN}/partners`;
const DISCLOSURE = path.join(ROOT, 'pages', 'affiliate-disclosure.html');
const DISCLOSURE_URL = `${ORIGIN}/pages/affiliate-disclosure`;

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);
const partnersHtml = read(PARTNERS);
const disclosureHtml = read(DISCLOSURE);

/** Public pages cited in the article, confirmed HTTP 200 on 2026-11-08. */
const VERIFIED_EXTERNAL = new Set([
  'https://www.oakhouse.jp/eng/affiliate/',
  'https://www.mobal.com/affiliate/',
  'https://www.japan-wireless.com/en/affiliate',
  'https://www.sakuramobile.jp/about-us/affiliate-program/',
  'https://safetywing.com/ambassador',
  'https://wise.com/partners/',
  'https://www.awin.com/gb/publishers',
  'https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing',
  'https://www.caa.go.jp/en/'
]);

function extractJsonLd(html, label) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1].trim());
  return blocks.map((b, i) => {
    try {
      return JSON.parse(b);
    } catch (err) {
      throw new Error(`JSON-LD block ${i} in ${label} is not valid JSON: ${err.message}`);
    }
  });
}

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: m[1], inner: m[2] }));
}

function resolveHref(href) {
  if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(href)) return null;
  if (href.startsWith('#')) return null;

  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return 'index.html';

  const rel = clean.replace(/^\//, '');
  const candidates = clean.endsWith('.html')
    ? [rel]
    : [rel, `${rel}.html`, `${rel.replace(/\/$/, '')}/index.html`];

  for (const c of candidates) {
    const full = path.join(ROOT, c);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return c;
  }
  return false;
}

function readBlogPosts() {
  const src = read(path.join(ROOT, 'assets', 'js', 'main.js'));
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

function assertNoRates(html, label) {
  // Check visible text, not CSS values such as `linear-gradient(... 100%)`.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  assert.ok(!/¥\s?\d/.test(text), `${label} publishes a fixed yen figure`);
  assert.ok(!/\b\d+(?:\.\d+)?\s?%/.test(text), `${label} publishes a percentage rate`);
  assert.ok(!/\bcommission (?:rate|fee) of \d/i.test(text), `${label} publishes a commission figure`);
}

// ============================================================
// 1. The article
// ============================================================

test('the partnership article exists, is substantial and has one h1', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  assert.ok(fs.statSync(ARTICLE).size > 8000, 'article is too small for a full guide');

  const h1s = [...articleHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1, `expected exactly one <h1>, found ${h1s.length}`);
});

test('the article metadata and canonical URL are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], 'Partner With Move Out Japan: Referrals, Content and Service Collaborations | Move Out Japan');

  const desc = articleHtml.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(desc, 'missing meta description');
  assert.ok(desc[1].length >= 80 && desc[1].length <= 170,
    `meta description length ${desc[1].length} outside 80-170`);

  const canonical = articleHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, 'missing canonical');
  assert.equal(canonical[1], CANONICAL);
  assert.ok(!CANONICAL.endsWith('.html'), 'canonical must be extensionless');

  const ogUrl = articleHtml.match(/<meta property="og:url" content="([^"]+)">/);
  assert.ok(ogUrl && ogUrl[1] === CANONICAL, 'og:url must equal the canonical URL');

  const pub = articleHtml.match(/<meta property="article:published_time" content="([^"]+)">/);
  const mod = articleHtml.match(/<meta property="article:modified_time" content="([^"]+)">/);
  assert.ok(pub && mod, 'published/modified meta tags required');
  assert.equal(pub[1], PUB_DATE);
  assert.equal(mod[1], PUB_DATE);
  assert.ok(new Date(pub[1]).getTime() <= Date.now(), 'published date is in the future');
});

test('the article structured data parses and matches the page', () => {
  const blocks = extractJsonLd(articleHtml, SLUG);
  assert.ok(blocks.length >= 3, `expected BlogPosting + BreadcrumbList + FAQPage, found ${blocks.length}`);

  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, 'Partner With Move Out Japan: Referrals, Content and Service Collaborations');
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.ok(post.mainEntityOfPage && post.mainEntityOfPage['@id'] === CANONICAL);

  const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(crumb.itemListElement.length, 3);
  assert.equal(crumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(crumb.itemListElement[1].item, `${ORIGIN}/blog/`);
  assert.ok(!('item' in crumb.itemListElement[2]), 'last crumb must not repeat the URL');

  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');
  assert.ok(faq.mainEntity.length >= 6, 'expected at least six partnership FAQs');
});

test('the article FAQ JSON-LD and visible FAQ text match exactly', () => {
  const faq = extractJsonLd(articleHtml, SLUG).find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');

  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));

  assert.equal(visible.length, faq.mainEntity.length,
    `visible FAQs (${visible.length}) != JSON-LD questions (${faq.mainEntity.length})`);
  for (const q of faq.mainEntity) {
    assert.ok(visible.includes(q.name), `JSON-LD question not rendered: ${q.name}`);
  }
});

test('only verified public pages are cited, and all are HTTPS', () => {
  const external = anchors(articleHtml)
    .map((a) => a.href)
    .filter((h) => /^https?:\/\//.test(h));

  assert.ok(external.length >= 8, `expected several research sources, found ${external.length}`);
  for (const href of external) {
    assert.ok(href.startsWith('https://'), `insecure source link: ${href}`);
    assert.ok(VERIFIED_EXTERNAL.has(href),
      `unverified external source: ${href}\n` +
      'Fetch it, confirm it returns 200, then add it to VERIFIED_EXTERNAL.');
  }
});

test('the article internal links are extensionless and resolve', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);

  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(h)) continue;
    assert.ok(!/\.html($|#|\?)/.test(h), `internal link must be extensionless: ${h}`);
    assert.notEqual(resolveHref(h), false, `broken internal link: ${h}`);
  }

  const ids = new Set([...articleHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const hashLinks = hrefs.filter((h) => h.startsWith('#'));
  assert.ok(hashLinks.length >= 8, 'table of contents should link to each section');
  for (const h of hashLinks) {
    assert.ok(ids.has(h.slice(1)), `anchor target does not exist: ${h}`);
  }
});

test('the article links to the enquiry, disclosure and customer pages', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  for (const expected of [
    '/partners',
    '/pages/affiliate-disclosure',
    '/contact',
    '/privacy',
    '/blog/',
    '/blog/posts/rental-deposit-deductions-japan',
    '/blog/posts/moving-out-checklist-japan',
    '/pages/services',
    '/pages/pricing'
  ]) {
    assert.ok(hrefs.includes(expected), `article should link to ${expected}`);
  }
});

test('the article publishes no rates or invented partnership claims', () => {
  assertNoRates(articleHtml, 'the article');
  for (const banned of [
    'we have partnered with',
    'our official partner',
    'official partner of',
    'we are an approved partner'
  ]) {
    assert.ok(!articleHtml.toLowerCase().includes(banned),
      `article contains an unapproved partnership claim: "${banned}"`);
  }
});

// ============================================================
// 2. The /partners page
// ============================================================

test('the partners page exists, is substantial and has correct metadata', () => {
  assert.ok(fs.existsSync(PARTNERS), 'missing partners.html');
  assert.ok(fs.statSync(PARTNERS).size > 5000, 'partners page is too small');

  const title = partnersHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], 'Partner With Move Out Japan | Referral, Content and Service Enquiries');

  const canonical = partnersHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical && canonical[1] === PARTNERS_URL, 'partners canonical is wrong');

  const h1s = [...partnersHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1, 'partners page needs exactly one h1');
});

test('the partners page has WebPage and BreadcrumbList JSON-LD', () => {
  const blocks = extractJsonLd(partnersHtml, 'partners');
  const page = blocks.find((b) => b['@type'] === 'WebPage');
  assert.ok(page, 'missing WebPage JSON-LD');
  assert.equal(page.url, PARTNERS_URL);

  const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(crumb.itemListElement.length, 2);
  assert.equal(crumb.itemListElement[1].item, PARTNERS_URL);
});

test('the partners page explains how to enquire and links to the policy', () => {
  assert.match(partnersHtml, /mailto:bistadinesh642@gmail\.com\?subject=Partnership%20enquiry/,
    'partners page needs a prefilled partnership email link');
  assert.match(partnersHtml, /https:\/\/line\.me\/ti\/p\/@704xslsr/,
    'partners page needs the LINE contact');

  const hrefs = anchors(partnersHtml).map((a) => a.href);
  for (const expected of [
    '/blog/posts/partner-with-move-out-japan',
    '/pages/affiliate-disclosure',
    '/pages/services',
    '/pages/pricing',
    '/privacy',
    '/contact'
  ]) {
    assert.ok(hrefs.includes(expected), `partners page should link to ${expected}`);
  }

  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(h)) continue;
    assert.ok(!/\.html($|#|\?)/.test(h), `internal link must be extensionless: ${h}`);
    assert.notEqual(resolveHref(h), false, `broken internal link: ${h}`);
  }
});

test('the partners page publishes no rates or response-time promises', () => {
  assertNoRates(partnersHtml, 'the partners page');
  assert.ok(!/\bwithin \d+ (?:hours?|days?)\b/i.test(partnersHtml),
    'partners page must not promise a response time');
  assert.ok(!/guaranteed (?:response|reply|partnership)/i.test(partnersHtml),
    'partners page must not guarantee an outcome');
});

// ============================================================
// 3. The disclosure page
// ============================================================

test('the disclosure page exists and has correct metadata', () => {
  assert.ok(fs.existsSync(DISCLOSURE), 'missing pages/affiliate-disclosure.html');
  assert.ok(fs.statSync(DISCLOSURE).size > 5000, 'disclosure page is too small');

  const title = disclosureHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], 'Affiliate and Sponsorship Disclosure | Move Out Japan');

  const canonical = disclosureHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical && canonical[1] === DISCLOSURE_URL, 'disclosure canonical is wrong');

  const h1s = [...disclosureHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1, 'disclosure page needs exactly one h1');
});

test('the disclosure page has WebPage and BreadcrumbList JSON-LD', () => {
  const blocks = extractJsonLd(disclosureHtml, 'disclosure');
  const page = blocks.find((b) => b['@type'] === 'WebPage');
  assert.ok(page, 'missing WebPage JSON-LD');
  assert.equal(page.url, DISCLOSURE_URL);

  const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(crumb.itemListElement.length, 2);
  assert.equal(crumb.itemListElement[1].item, DISCLOSURE_URL);
});

test('the disclosure page explains the policy and links to the official guidance', () => {
  assert.match(disclosureHtml, /do not currently publish affiliate links or paid placements/i,
    'disclosure must state the current position clearly');
  assert.match(disclosureHtml, /https:\/\/www\.caa\.go\.jp\/policies\/policy\/representation\/fair_labeling\/faq\/stealth_marketing/,
    'disclosure should link to the CAA stealth-marketing guidance');

  const hrefs = anchors(disclosureHtml).map((a) => a.href);
  for (const expected of [
    '/partners',
    '/blog/posts/partner-with-move-out-japan',
    '/privacy',
    '/contact'
  ]) {
    assert.ok(hrefs.includes(expected), `disclosure page should link to ${expected}`);
  }

  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(h)) continue;
    assert.ok(!/\.html($|#|\?)/.test(h), `internal link must be extensionless: ${h}`);
    assert.notEqual(resolveHref(h), false, `broken internal link: ${h}`);
  }
});

test('the disclosure page publishes no rates', () => {
  assertNoRates(disclosureHtml, 'the disclosure page');
});

// ============================================================
// 4. Catalogue, sitemap and shared navigation
// ============================================================

test('the article is in BLOG_POSTS with the right date and category', () => {
  const post = readBlogPosts().find((p) => p.slug === SLUG);
  assert.ok(post, 'article missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE);
  assert.equal(post.category, 'Partnerships');
  assert.match(post.slug, /^[a-z0-9-]+$/);
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');
});

test('sitemap.xml lists the article, partners page and disclosure with the right lastmod', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  for (const url of [CANONICAL, PARTNERS_URL, DISCLOSURE_URL]) {
    const block = xml.split(/<url>/).find((b) => b.includes(`<loc>${url}</loc>`));
    assert.ok(block, `sitemap.xml missing ${url}`);
    assert.match(block, /<lastmod>\s*2026-11-08\s*<\/lastmod>/,
      `${url} must carry the publication date as lastmod`);
  }
});

test('sitemap.html lists all three pages and the updated counts', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  for (const href of [`/blog/posts/${SLUG}`, '/partners', '/pages/affiliate-disclosure']) {
    assert.ok(html.includes(`href="${href}"`), `sitemap.html missing ${href}`);
  }
  assert.match(html, /Main Pages <span class="total-pages">9 pages<\/span>/);
  assert.match(html, /Blog &(?:amp;)? Guides <span class="total-pages">6 pages<\/span>/);
  assert.match(html, /Last updated: November 8, 2026/);
});

test('the shared footer and contact page link to the new pages', () => {
  const main = read(path.join(ROOT, 'assets', 'js', 'main.js'));
  assert.ok(main.includes('<a href="/partners">Partners</a>'), 'footer missing /partners');
  assert.ok(main.includes('<a href="/pages/affiliate-disclosure">Disclosure</a>'),
    'footer missing the disclosure link');

  const contact = read(path.join(ROOT, 'contact.html'));
  assert.ok(contact.includes('href="/partners"'), 'contact page should link to /partners');
});

test('internal paths are blocked and research notes are gitignored', () => {
  const redirects = read(path.join(ROOT, '_redirects'));
  for (const source of ['/tests/*', '/scripts/*', '/research/*', '/README.md']) {
    assert.ok(redirects.includes(source), `_redirects missing protection for ${source}`);
  }

  const headers = read(path.join(ROOT, '_headers'));
  assert.match(headers, /\/tests\/\*\s*\n\s*X-Robots-Tag: noindex/, 'tests need noindex header');
  assert.match(headers, /\/research\/\*\s*\n\s*X-Robots-Tag: noindex/, 'research needs noindex header');

  const ignore = read(path.join(ROOT, '.gitignore'));
  assert.match(ignore, /^research\/$/m, 'research/ must be gitignored');
});

test('the new public files contain no secret material', () => {
  const files = [ARTICLE, PARTNERS, DISCLOSURE];
  for (const file of files) {
    const text = read(file);
    for (const needle of ['api_key', 'API_KEY', 'client_secret', 'password', 'BEGIN PRIVATE KEY']) {
      assert.ok(!text.includes(needle), `${path.relative(ROOT, file)} contains "${needle}"`);
    }
  }
});
