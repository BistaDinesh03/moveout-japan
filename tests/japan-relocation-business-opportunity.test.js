'use strict';

/**
 * Focused regression gate for the business-opportunity guide
 * (/blog/posts/japan-relocation-support-business-opportunities).
 *
 * The article describes the platform as it is and invites serious commercial
 * enquiries. It must not invent revenue, traffic, customer numbers, partners,
 * valuations or asking prices. VERIFIED_EXTERNAL pins the exact set of
 * outbound sources, each confirmed reachable on 2026-11-24.
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
const SLUG = 'japan-relocation-support-business-opportunities';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-11-24';
const TITLE = 'Japan Relocation Support for Foreign Residents: An Opportunity for Agencies and Business Partners';
const BUSINESS_MAILTO = 'mailto:dineshbista123@outlook.com?subject=Move%20Out%20Japan%20%E2%80%93%20Business%20Partnership%20or%20Acquisition%20Enquiry';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const VERIFIED_EXTERNAL = new Set([
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000017.html',
  'https://www.mlit.go.jp/common/001317844.pdf',
  'https://www.jetro.go.jp/en/invest/setting_up/living/',
  'https://www.jpm.jp/foreign/en/',
  'https://www.moj.go.jp/isa/support/portal/guidebook_all.html'
]);

const REQUIRED_SECTIONS = [
  'short-answer',
  'information-gap',
  'why-support',
  'platform',
  'agencies',
  'property',
  'providers',
  'business',
  'due-diligence',
  'next-steps',
  'faq-section',
  'conclusion',
  'sources'
];

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1].trim());
  assert.ok(blocks.length > 0, 'no JSON-LD blocks found');
  return blocks.map((b, i) => {
    try { return JSON.parse(b); }
    catch (err) { throw new Error(`JSON-LD block ${i} is not valid JSON: ${err.message}`); }
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

test('the business-opportunity guide exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 20000, `article is only ${size} bytes — too small for a full guide`);
});

test('title, meta description, canonical and H1 are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.match(title[1], /Japan Relocation Support for Foreign Residents/);
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
  assert.ok(articleHtml.includes(`<h1>${TITLE}</h1>`), 'H1 must be the full title');
});

test('Open Graph and Twitter metadata are complete', () => {
  for (const [prop, value] of [
    ['og:type', 'article'],
    ['og:site_name', 'Move Out Japan'],
    ['og:title', TITLE],
    ['og:url', CANONICAL],
    ['og:image', `${ORIGIN}/assets/images/blog/japan-relocation-business-opportunities-social.png`],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['article:published_time', PUB_DATE],
    ['article:modified_time', PUB_DATE],
    ['article:section', 'Business Opportunities']
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

  const social = path.join(ROOT, 'assets', 'images', 'blog', 'japan-relocation-business-opportunities-social.png');
  assert.ok(fs.existsSync(social), 'social share image is missing');
});

test('every required section is present and linked from the table of contents', () => {
  for (const id of REQUIRED_SECTIONS) {
    assert.ok(articleHtml.includes(`id="${id}"`), `missing section #${id}`);
    assert.ok(articleHtml.includes(`href="#${id}"`), `TOC does not link to #${id}`);
  }
});

test('BlogPosting, BreadcrumbList and FAQPage schema are valid and consistent', () => {
  const blocks = extractJsonLd(articleHtml);

  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, TITLE);
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.equal(post.mainEntityOfPage['@id'], CANONICAL);
  assert.equal(post.articleSection, 'Business Opportunities');
  assert.equal(post.inLanguage, 'en');

  const breadcrumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(breadcrumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(breadcrumb.itemListElement.length, 3);
  assert.equal(breadcrumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(breadcrumb.itemListElement[1].item, `${ORIGIN}/blog/`);
  assert.ok(!breadcrumb.itemListElement[2].item, 'current page must not repeat the URL');

  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');
  assert.ok(faq.mainEntity.length >= 6, 'expected a useful FAQ set');

  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));
  assert.deepEqual(faq.mainEntity.map((q) => q.name), visible);
});

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
    '/partners',
    '/contact',
    '/pages/services',
    '/pages/affiliate-disclosure',
    '/blog/posts/moving-to-japan-housing-services-support',
    '/blog/posts/hiring-foreign-employees-japan-relocation-support',
    '/blog/posts/moving-out-checklist-japan',
    '/blog/posts/how-to-dispose-furniture-japan',
    '/blog/posts/rental-deposit-deductions-japan',
    '/blog/posts/leaving-japan-administrative-checklist',
    '/blog/posts/partner-with-move-out-japan'
  ]) {
    assert.ok(hrefs.includes(required), `article is missing internal link ${required}`);
  }

  assert.ok(hrefs.includes(BUSINESS_MAILTO),
    'business CTA must use the public contact address with the agreed subject');
});

test('quote CTAs point at the contact page and no fake system is advertised', () => {
  for (const a of anchors(articleHtml)) {
    if (!/quote/i.test(stripTags(a.inner))) continue;
    assert.equal(a.href, '/contact', `quote CTA must point at /contact, got ${a.href}`);
  }
  const banned = [
    /we have (?:\d+|many) (?:partners|clients|users|customers)/i,
    /guaranteed (?:leads|traffic|rankings|sales|revenue)/i,
    /(?:revenue|profit|traffic|valuation|asking price) (?:of|is|was) (?:¥|\$|€)/i,
    /(?:\d{2,}) (?:million|thousand) (?:users|visitors|customers)/i
  ];
  for (const re of banned) {
    assert.ok(!re.test(articleHtml), `article must not contain invented commercial claim: ${re}`);
  }
});

test('the article does not promise transferable assets or guaranteed outcomes', () => {
  assert.ok(!/guaranteed (?:transfer|sale|acquisition|investment)/i.test(articleHtml));
  assert.ok(!/asking price/i.test(articleHtml));
  assert.ok(/discussed during due diligence/i.test(articleHtml));
});

test('the catalogue lists the guide with the right date and category', () => {
  const posts = readBlogPosts();
  assert.equal(posts.length, 8, `expected 8 published articles, found ${posts.length}`);
  const post = posts.find((p) => p.slug === SLUG);
  assert.ok(post, 'the business-opportunity guide is missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE);
  assert.equal(post.category, 'Business Opportunities');
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
  check(`${ORIGIN}/blog/`, PUB_DATE);
  check(`${ORIGIN}/partners`, PUB_DATE);
});

test('sitemap.html advertises the guide and the current counts', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.ok(html.includes(`/blog/posts/${SLUG}`), 'sitemap.html missing the new guide');
  assert.match(html, /Blog &(?:amp;)? Guides <span class="total-pages">9 pages<\/span>/);
  assert.match(html, /Last updated: November 24, 2026/);
});

test('the partners page links to the business-opportunity guide', () => {
  const partners = read(path.join(ROOT, 'partners.html'));
  assert.ok(partners.includes(`href="/blog/posts/${SLUG}"`),
    'partners page should link to the business-opportunity guide');
  assert.match(partners, /Page updated 24 November 2026/);
});
