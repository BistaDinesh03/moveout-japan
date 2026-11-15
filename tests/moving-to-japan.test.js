'use strict';

/**
 * Focused regression gate for the "Moving to Japan in 2026" guide
 * (/blog/posts/moving-to-japan-housing-services-support).
 *
 * The article is an arrival-side guide: housing, connectivity, furniture,
 * the first 14 days of administration and provider verification. Its factual
 * claims are pinned to official sources that were fetched and confirmed
 * HTTP 200 on 2026-11-15. VERIFIED_EXTERNAL records the exact set, the same
 * way tests/moving-checklist.test.js and tests/deposit-deductions.test.js pin
 * their articles. Adding a new outbound source forces a human to verify it
 * first — do not add an entry without re-checking it.
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
const SLUG = 'moving-to-japan-housing-services-support';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-11-15';
const TITLE = 'Moving to Japan in 2026: How to Find Housing, Essential Services, and Reliable Local Support';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Outbound sources in the article, each confirmed HTTP 200 on 2026-11-15. */
const VERIFIED_EXTERNAL = new Set([
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000017.html',
  'https://www.mlit.go.jp/common/001317844.pdf',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr7_000024.html',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr7_000031.html',
  'https://etsuran2.mlit.go.jp/TAKKEN/takkenKensaku.do',
  'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/zairyu/english/move-in_move-out.html',
  'https://www.digital.go.jp/en/policies/moving_onestop_service',
  'https://www.digital.go.jp/en/policies/mynumber',
  'https://www.mhlw.go.jp/content/001764098.pdf',
  'https://www.nenkin.go.jp/international/english/index.html',
  'https://www.soumu.go.jp/menu_seisaku/ictseisaku/keitai_portal/',
  'https://www.soumu.go.jp/menu_seisaku/ictseisaku/keitai_portal/assets/pdf/kaijorule_r3_10.pdf',
  'https://www.env.go.jp/recycle/kaden/gaiyo.html',
  'https://www.env.go.jp/en/recycle/',
  'https://www.houjin-bangou.nta.go.jp/en/',
  'https://www.no-trouble.caa.go.jp/foreignlanguage/english/doortodoorsales/',
  'https://www.caa.go.jp/en/policy/local_cooperation',
  'https://www.kokusen.go.jp/ncac_index_e.html',
  'https://www.houterasu.or.jp/site/english/servicesinforeignresidentssupportcenter.html',
  'https://www.moj.go.jp/isa/support/portal/'
]);

const REQUIRED_SECTIONS = [
  'quick-answer',
  'before-you-move',
  'accommodation',
  'internet-mobile',
  'furniture-essentials',
  'administration',
  'choosing-provider',
  'for-businesses',
  'partnership',
  'next-steps',
  'glossary',
  'sources',
  'faq-section'
];

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1].trim());
  assert.ok(blocks.length > 0, 'no JSON-LD blocks found');
  return blocks.map((b, i) => {
    try {
      return JSON.parse(b);
    } catch (err) {
      throw new Error(`JSON-LD block ${i} is not valid JSON: ${err.message}`);
    }
  });
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: m[1], inner: m[2] }));
}

function readBlogPosts() {
  const src = read(path.join(ROOT, 'assets', 'js', 'main.js'));
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

// ============================================================
// 1. File and page metadata
// ============================================================

test('the guide exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 20000, `article is only ${size} bytes — too small for a full guide`);
});

test('title, meta description and canonical URL are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.match(title[1], /Moving to Japan in 2026/, 'title must name the guide');
  assert.match(title[1], /Move Out Japan$/, 'title must carry the site name');

  const desc = articleHtml.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(desc, 'missing meta description');
  assert.ok(desc[1].length >= 80 && desc[1].length <= 170,
    `meta description length ${desc[1].length} outside 80-170`);

  const canonical = articleHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, 'missing canonical');
  assert.equal(canonical[1], CANONICAL);
  assert.ok(!canonical[1].endsWith('.html'), 'canonical must be extensionless');

  const robots = articleHtml.match(/<meta name="robots" content="([^"]+)">/);
  assert.ok(robots, 'missing robots meta');
  assert.match(robots[1], /index/);

  assert.ok(articleHtml.includes(`<h1>${TITLE}</h1>`), 'H1 must be the full guide title');
});

test('Open Graph and Twitter metadata are complete', () => {
  for (const [prop, value] of [
    ['og:type', 'article'],
    ['og:site_name', 'Move Out Japan'],
    ['og:url', CANONICAL],
    ['og:image', `${ORIGIN}/assets/images/blog/moving-to-japan-2026-social.png`],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['article:published_time', PUB_DATE],
    ['article:section', 'Moving In']
  ]) {
    const re = new RegExp(`<meta property="${prop}" content="([^"]+)">`);
    const m = articleHtml.match(re);
    assert.ok(m, `missing ${prop}`);
    assert.equal(m[1], value, `${prop} mismatch`);
  }

  assert.match(articleHtml, /<meta property="og:image:alt" content="[^"]+">/, 'missing og:image:alt');
  assert.match(articleHtml, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(articleHtml, /<meta name="twitter:image" content="[^"]+">/);
});

test('the hero image exists, has alt text and declared dimensions', () => {
  const img = articleHtml.match(/<img src="(\/assets\/images\/blog\/[^"]+)"[^>]*>/);
  assert.ok(img, 'missing in-article hero image');
  assert.ok(fs.existsSync(path.join(ROOT, img[1].slice(1))), `missing image file ${img[1]}`);
  assert.match(img[0], /alt="[^"]{20,}"/, 'hero image needs descriptive alt text');
  assert.match(img[0], /width="1200"/);
  assert.match(img[0], /height="520"/);
  assert.ok(articleHtml.includes('Illustration by Move Out Japan.'), 'hero must credit the illustration');

  const social = path.join(ROOT, 'assets', 'images', 'blog', 'moving-to-japan-2026-social.png');
  assert.ok(fs.existsSync(social), 'social share image is missing');
});

test('every required section is present with a stable anchor', () => {
  for (const id of REQUIRED_SECTIONS) {
    assert.ok(articleHtml.includes(`id="${id}"`), `missing section #${id}`);
    assert.ok(articleHtml.includes(`href="#${id}"`), `table of contents does not link to #${id}`);
  }
});

// ============================================================
// 2. Structured data
// ============================================================

test('BlogPosting, BreadcrumbList and FAQPage schema are valid and consistent', () => {
  const blocks = extractJsonLd(articleHtml);

  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, TITLE);
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.equal(post.mainEntityOfPage['@id'], CANONICAL);
  assert.equal(post.inLanguage, 'en');
  assert.equal(post.articleSection, 'Moving In');
  assert.ok(Array.isArray(post.keywords) && post.keywords.length >= 4, 'keywords should be present');

  const breadcrumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(breadcrumb, 'missing BreadcrumbList JSON-LD');
  const crumbs = breadcrumb.itemListElement;
  assert.equal(crumbs.length, 3);
  assert.equal(crumbs[0].item, `${ORIGIN}/`);
  assert.equal(crumbs[1].item, `${ORIGIN}/blog/`);
  assert.ok(!crumbs[2].item, 'the current page must not be given a duplicate item URL');

  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');
  assert.ok(faq.mainEntity.length >= 6, 'expected a useful FAQ set');

  // Visible questions must match the structured data exactly (site-wide gate
  // also enforces this, but a focused failure here is easier to diagnose).
  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));
  assert.deepEqual(faq.mainEntity.map((q) => q.name), visible);
});

// ============================================================
// 3. Sources and internal links
// ============================================================

test('every outbound source was verified and none is invented', () => {
  const outbound = new Set(
    anchors(articleHtml)
      .map((a) => a.href)
      .filter((h) => /^https?:\/\//.test(h))
      // Site self-references and font preloads are not "sources".
      .filter((h) => !h.startsWith(ORIGIN) && !h.startsWith('https://fonts.'))
  );

  for (const url of outbound) {
    assert.ok(VERIFIED_EXTERNAL.has(url),
      `unverified outbound source: ${url} — fetch it, confirm HTTP 200, then add it to VERIFIED_EXTERNAL`);
  }
  for (const url of VERIFIED_EXTERNAL) {
    assert.ok(outbound.has(url), `source was removed from the article: ${url}`);
  }
});

test('external links open safely and carry the site link style', () => {
  for (const a of anchors(articleHtml)) {
    if (!/^https?:\/\//.test(a.href) || a.href.startsWith(ORIGIN)) continue;
    const tag = articleHtml.match(new RegExp(`<a\\b[^>]*href="${a.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`));
    assert.ok(tag, `could not inspect link ${a.href}`);
    assert.match(tag[0], /target="_blank"/, `${a.href} should open in a new tab`);
    assert.match(tag[0], /rel="noopener noreferrer"/, `${a.href} needs rel="noopener noreferrer"`);
  }
});

test('internal links are extensionless and cover the conversion paths', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  for (const internal of hrefs.filter((h) => h.startsWith('/'))) {
    assert.ok(!internal.endsWith('.html'), `internal link uses a .html URL: ${internal}`);
  }

  for (const required of [
    '/blog/',
    '/partners',
    '/contact',
    '/pages/services',
    '/pages/pricing',
    '/blog/posts/moving-out-checklist-japan',
    '/blog/posts/how-to-dispose-furniture-japan',
    '/blog/posts/rental-deposit-deductions-japan',
    '/blog/posts/partner-with-move-out-japan'
  ]) {
    assert.ok(hrefs.includes(required), `article is missing internal link ${required}`);
  }

  assert.ok(hrefs.includes('mailto:dineshbista123@outlook.com?subject=Move%20Out%20Japan%20-%20Partnership%20Enquiry'),
    'partnership section must use the public contact email');
});

// ============================================================
// 4. Catalogue, sitemap and cross-site discovery
// ============================================================

test('the catalogue lists the guide first with the right date and category', () => {
  const posts = readBlogPosts();
  assert.equal(posts.length, 6, `expected 6 published articles, found ${posts.length}`);

  const post = posts[0];
  assert.equal(post.slug, SLUG, 'the newest article should lead the catalogue');
  assert.equal(post.date, PUB_DATE);
  assert.equal(post.category, 'Moving In');
  assert.match(post.slug, /^[a-z0-9-]+$/, 'slug must be URL-safe');
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');
  assert.ok(post.excerpt.length >= 80, 'catalogue excerpt should be a sentence, not a stub');
});

test('sitemap.xml lists the guide and the refreshed blog and partner pages', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(CANONICAL), `sitemap missing ${CANONICAL}`);
  assert.ok(!locs.some((l) => l.endsWith('.html')), 'sitemap must not advertise .html URLs');

  for (const url of [CANONICAL, `${ORIGIN}/blog/`, `${ORIGIN}/partners`]) {
    const block = xml.split(/<url>/).find((b) => b.includes(`<loc>${url}</loc>`));
    assert.ok(block, `sitemap missing ${url}`);
    assert.match(block, /<lastmod>\s*2026-11-15\s*<\/lastmod>/,
      `${url} must carry the date its content last changed`);
  }
});

test('sitemap.html advertises the guide and the new counts', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.ok(html.includes(`/blog/posts/${SLUG}`), 'sitemap.html missing the new guide');
  assert.match(html, /Blog &(?:amp;)? Guides <span class="total-pages">7 pages<\/span>/);
  assert.match(html, /Last updated: November 15, 2026/);
});

test('the partners page links to the guide for arrival-side enquiries', () => {
  const partners = read(path.join(ROOT, 'partners.html'));
  assert.ok(partners.includes(`href="/blog/posts/${SLUG}"`),
    'partners page should link to the arrival-side guide');
  assert.match(partners, /Page updated 15 November 2026/);
});
