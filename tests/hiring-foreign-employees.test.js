'use strict';

/**
 * Focused regression gate for the B2B employer guide
 * (/blog/posts/hiring-foreign-employees-japan-relocation-support).
 *
 * The article makes claims about Specified Skilled Worker (i) support duties,
 * employer obligations and official verification routes. Those claims are
 * pinned to official sources fetched and confirmed reachable on 2026-11-20.
 * VERIFIED_EXTERNAL records the exact set — adding a new outbound source must
 * force a human to verify it first.
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
const SLUG = 'hiring-foreign-employees-japan-relocation-support';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-11-20';
const TITLE = 'Hiring Foreign Employees in Japan? A Practical Guide to Relocation, Housing and Settling-In Support';
const BUSINESS_MAILTO = 'mailto:dineshbista123@outlook.com?subject=Move%20Out%20Japan%20-%20Business%20Partnership%20Enquiry';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Every outbound source, each confirmed reachable on 2026-11-20. */
const VERIFIED_EXTERNAL = new Set([
  'https://ssw.go.jp/en/about/support',
  'https://ssw.go.jp/en/about/visa',
  'https://www.moj.go.jp/isa/policies/ssw/supportssw.html',
  'https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00205.html',
  'https://www.moj.go.jp/isa/content/001474665.xlsx',
  'https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html',
  'https://www.moj.go.jp/isa/applications/status/gijinkoku.html',
  'https://www.moj.go.jp/isa/applications/status/designatedactivities02_00004.html',
  'https://www.moj.go.jp/isa/support/portal/guidebook_all.html',
  'https://www.moj.go.jp/isa/content/001450885.pdf',
  'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/zairyu/english/move-in_move-out.html',
  'https://www.mhlw.go.jp/bunya/koyou/gaikokujin13/sisin01.html',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/gaikokujin/todokede/index.html',
  'https://jsite.mhlw.go.jp/tokyo-roudoukyoku/gaikokujin_00001.html',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000056460.html',
  'https://www.jetro.go.jp/en/hrportal/living.html',
  'https://www.metro.tokyo.lg.jp/english/guide/guide01.html',
  'https://www.keishicho.metro.tokyo.lg.jp/multilingual/english/for_residents/index.files/04_english.pdf',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000017.html',
  'https://www.mlit.go.jp/common/001317844.pdf',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr7_000024.html',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr7_000031.html',
  'https://etsuran2.mlit.go.jp/TAKKEN/takkenKensaku.do'
]);

const REQUIRED_SECTIONS = [
  'quick-answer',
  'before-arrival',
  'housing',
  'first-week',
  'ssw-support',
  'internal-vs-outsourced',
  'choosing-partner',
  'mistakes',
  'timeline',
  'service-providers',
  'partnership',
  'faq-section',
  'conclusion',
  'sources'
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
// 1. File and metadata
// ============================================================

test('the employer guide exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 30000, `article is only ${size} bytes — too small for a full B2B guide`);
});

test('title, meta description, canonical and H1 are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.match(title[1], /Hiring Foreign Employees in Japan/);
  assert.match(title[1], /Move Out Japan$/);

  const desc = articleHtml.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(desc, 'missing meta description');
  assert.ok(desc[1].length >= 80 && desc[1].length <= 170,
    `meta description length ${desc[1].length} outside 80-170`);

  const canonical = articleHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, 'missing canonical');
  assert.equal(canonical[1], CANONICAL);
  assert.ok(!canonical[1].endsWith('.html'), 'canonical must be extensionless');

  const robots = articleHtml.match(/<meta name="robots" content="([^"]+)">/);
  assert.ok(robots && /index/.test(robots[1]), 'article must be indexable');
  assert.ok(articleHtml.includes(`<h1>${TITLE}</h1>`), 'H1 must be the full working title');
});

test('Open Graph, Twitter and social image metadata are complete', () => {
  for (const [prop, value] of [
    ['og:type', 'article'],
    ['og:site_name', 'Move Out Japan'],
    ['og:title', TITLE],
    ['og:url', CANONICAL],
    ['og:image', `${ORIGIN}/assets/images/blog/hiring-foreign-employees-social.png`],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['article:published_time', PUB_DATE],
    ['article:modified_time', PUB_DATE],
    ['article:section', 'For Employers']
  ]) {
    const m = articleHtml.match(new RegExp(`<meta property="${prop}" content="([^"]+)">`));
    assert.ok(m, `missing ${prop}`);
    assert.equal(m[1], value, `${prop} mismatch`);
  }
  assert.match(articleHtml, /<meta property="og:image:alt" content="[^"]+">/);
  assert.match(articleHtml, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(articleHtml, /<meta name="twitter:image" content="[^"]+">/);
});

test('hero image exists, has descriptive alt text and is credited', () => {
  const img = articleHtml.match(/<img src="(\/assets\/images\/blog\/[^"]+)"[^>]*>/);
  assert.ok(img, 'missing in-article hero image');
  assert.ok(fs.existsSync(path.join(ROOT, img[1].slice(1))), `missing image file ${img[1]}`);
  assert.match(img[0], /alt="[^"]{30,}"/, 'hero image needs descriptive alt text');
  assert.match(img[0], /width="1200"/);
  assert.match(img[0], /height="520"/);
  assert.ok(articleHtml.includes('Illustration by Move Out Japan.'));

  const social = path.join(ROOT, 'assets', 'images', 'blog', 'hiring-foreign-employees-social.png');
  assert.ok(fs.existsSync(social), 'social share image is missing');
});

test('every required section is present and linked from the table of contents', () => {
  for (const id of REQUIRED_SECTIONS) {
    assert.ok(articleHtml.includes(`id="${id}"`), `missing section #${id}`);
    assert.ok(articleHtml.includes(`href="#${id}"`), `TOC does not link to #${id}`);
  }
});

// ============================================================
// 2. Structured data and FAQ parity
// ============================================================

test('BlogPosting, BreadcrumbList and FAQPage schema are valid and consistent', () => {
  const blocks = extractJsonLd(articleHtml);

  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, TITLE);
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.equal(post.mainEntityOfPage['@id'], CANONICAL);
  assert.equal(post.articleSection, 'For Employers');
  assert.equal(post.inLanguage, 'en');

  const breadcrumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(breadcrumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(breadcrumb.itemListElement.length, 3);
  assert.equal(breadcrumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(breadcrumb.itemListElement[1].item, `${ORIGIN}/blog/`);
  assert.ok(!breadcrumb.itemListElement[2].item, 'current page must not repeat the URL');

  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');
  assert.ok(faq.mainEntity.length >= 8, 'expected a useful FAQ set');

  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));
  assert.deepEqual(faq.mainEntity.map((q) => q.name), visible);
});

// ============================================================
// 3. Sources, links and commercial honesty
// ============================================================

test('every outbound source was verified and none is invented', () => {
  const outbound = new Set(
    anchors(articleHtml)
      .map((a) => a.href)
      .filter((h) => /^https?:\/\//.test(h))
      .filter((h) => !h.startsWith(ORIGIN) && !h.startsWith('https://fonts.'))
  );
  for (const url of outbound) {
    assert.ok(VERIFIED_EXTERNAL.has(url),
      `unverified outbound source: ${url} — check it, confirm it is live, then add it to VERIFIED_EXTERNAL`);
  }
  for (const url of VERIFIED_EXTERNAL) {
    assert.ok(outbound.has(url), `source was removed from the article: ${url}`);
  }
});

test('external links open safely', () => {
  const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const a of anchors(articleHtml)) {
    if (!/^https?:\/\//.test(a.href) || a.href.startsWith(ORIGIN)) continue;
    const tag = articleHtml.match(new RegExp(`<a\\b[^>]*href="${escaped(a.href)}"[^>]*>`));
    assert.ok(tag, `could not inspect link ${a.href}`);
    assert.match(tag[0], /target="_blank"/, `${a.href} should open in a new tab`);
    assert.match(tag[0], /rel="noopener noreferrer"/, `${a.href} needs rel="noopener noreferrer"`);
  }
});

test('internal links are extensionless and cover every conversion path', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  for (const internal of hrefs.filter((h) => h.startsWith('/'))) {
    assert.ok(!internal.endsWith('.html'), `internal link uses a .html URL: ${internal}`);
  }

  for (const required of [
    '/blog/',
    '/contact',
    '/partners',
    '/pages/services',
    '/blog/posts/moving-to-japan-housing-services-support',
    '/blog/posts/moving-out-checklist-japan',
    '/blog/posts/rental-deposit-deductions-japan',
    '/blog/posts/how-to-dispose-furniture-japan',
    '/blog/posts/partner-with-move-out-japan'
  ]) {
    assert.ok(hrefs.includes(required), `article is missing internal link ${required}`);
  }

  const businessLinks = hrefs.filter((h) => h === BUSINESS_MAILTO);
  assert.ok(businessLinks.length >= 3, 'each conversion path needs the business contact address');
});

test('quote CTAs point at the contact page and no fake system is advertised', () => {
  for (const a of anchors(articleHtml)) {
    if (!/quote/i.test(stripTags(a.inner))) continue;
    assert.equal(a.href, '/contact', `quote CTA must point at /contact, got ${a.href}`);
  }
  assert.ok(!/book (?:a|your) (?:call|demo)/i.test(articleHtml), 'no fake booking system');
  assert.ok(!/(?:we have|our) \d+ (?:partners|clients|countries)/i.test(articleHtml), 'no invented business network');
  assert.ok(!/href="\/(?:partners\/directory|booking|apply)"/.test(articleHtml), 'no fake directory or application route');
});

// ============================================================
// 4. Catalogue, sitemap and cross-site discovery
// ============================================================

test('the catalogue lists the guide with the right date and category', () => {
  const posts = readBlogPosts();
  assert.equal(posts.length, 8, `expected 8 published articles, found ${posts.length}`);
  const post = posts.find((p) => p.slug === SLUG);
  assert.ok(post, 'the employer guide is missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE);
  assert.equal(post.category, 'For Employers');
  assert.match(post.slug, /^[a-z0-9-]+$/, 'slug must be URL-safe');
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');
});

test('sitemap.xml lists the guide and refreshed blog and partner pages', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(CANONICAL), `sitemap missing ${CANONICAL}`);
  assert.ok(!locs.some((l) => l.endsWith('.html')), 'sitemap must not advertise .html URLs');
  const check = (url, date) => {
    const block = xml.split(/<url>/).find((b) => b.includes(`<loc>${url}</loc>`));
    assert.ok(block, `sitemap missing ${url}`);
    assert.match(block, new RegExp(`<lastmod>\\s*${date}\\s*</lastmod>`));
  };
  check(CANONICAL, PUB_DATE);
  check(`${ORIGIN}/blog/`, '2026-11-24');
  check(`${ORIGIN}/partners`, '2026-11-24');
});

test('sitemap.html advertises the guide and the current counts', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.ok(html.includes(`/blog/posts/${SLUG}`), 'sitemap.html missing the new guide');
  assert.match(html, /Blog &(?:amp;)? Guides <span class="total-pages">9 pages<\/span>/);
  assert.match(html, /Last updated: November 24, 2026/);
});

test('the partners page links to the employer guide', () => {
  const partners = read(path.join(ROOT, 'partners.html'));
  assert.ok(partners.includes(`href="/blog/posts/${SLUG}"`),
    'partners page should link to the employer guide');
  assert.match(partners, /Page updated 24 November 2026/);
});
