'use strict';

/**
 * Focused regression gate for the rental deposit deductions article.
 *
 * The article makes legal claims about ordinary wear, special clauses,
 * cleaning fees, inspection signatures and deposit return. Those claims are
 * pinned to official sources that were fetched and confirmed HTTP 200 on
 * 2026-10-23. The catalogue, sitemap.xml and sitemap.html must all advertise
 * the article, and the visible FAQ must stay in sync with its JSON-LD.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';
const SLUG = 'rental-deposit-deductions-japan';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-10-23';
const TITLE = 'Rental Deposit Deductions in Japan: What Landlords Can and Cannot Charge';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);

/** Every outbound source in the article, confirmed HTTP 200 on 2026-10-23. */
const VERIFIED_EXTERNAL = new Set([
  'https://www.japaneselawtranslation.go.jp/en/laws/view/3494/en',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000020.html',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000021.html',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000024.html',
  'https://www.kokusen.go.jp/news/data/n-20260217_1.html',
  'https://www.kokusen.go.jp/soudan_topics/data/chintai.html',
  'https://www.city.kawasaki.jp/280/page/0000120315.html'
]);

const REQUIRED_SECTIONS = [
  'quick-answer',
  'legal-start',
  'normal-wear',
  'depreciation',
  'special-clauses',
  'cleaning-fees',
  'inspection',
  'itemised',
  'deposit-return',
  'disputes',
  'leaving-japan',
  'checklist',
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

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function readBlogPosts() {
  const src = read(path.join(ROOT, 'assets', 'js', 'main.js'));
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

// ============================================================
// 1. File and page metadata
// ============================================================

test('the deposit article exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 8000, `article is only ${size} bytes — too small for a full guide`);
});

test('title, meta description and canonical URL are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], `${TITLE} | Move Out Japan`);

  const desc = articleHtml.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(desc, 'missing meta description');
  assert.ok(desc[1].length >= 80 && desc[1].length <= 170,
    `meta description length ${desc[1].length} outside 80-170`);

  const canonical = articleHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, 'missing canonical');
  assert.equal(canonical[1], CANONICAL);
  assert.ok(!CANONICAL.endsWith('.html'), 'canonical must be the extensionless URL');

  const ogUrl = articleHtml.match(/<meta property="og:url" content="([^"]+)">/);
  assert.ok(ogUrl && ogUrl[1] === CANONICAL, 'og:url must equal the canonical URL');
});

test('Open Graph and Twitter metadata agree with the page', () => {
  for (const prop of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:alt']) {
    assert.match(articleHtml, new RegExp(`<meta property="${prop}" content="[^"]+">`), `missing ${prop}`);
  }
  assert.match(articleHtml, /<meta property="og:type" content="article">/);

  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.match(articleHtml, new RegExp(`<meta name="${name}" content="[^"]+">`), `missing ${name}`);
  }
});

test('publication dates are the real publication date', () => {
  const pub = articleHtml.match(/<meta property="article:published_time" content="([^"]+)">/);
  const mod = articleHtml.match(/<meta property="article:modified_time" content="([^"]+)">/);
  assert.ok(pub && mod, 'published/modified meta tags required');
  assert.equal(pub[1], PUB_DATE, 'published date must be the actual publication date');
  assert.equal(mod[1], PUB_DATE);
  assert.ok(new Date(pub[1]).getTime() <= Date.now(), 'published date is in the future');
  assert.ok(new Date(mod[1]).getTime() <= Date.now(), 'modified date is in the future');
  assert.match(articleHtml, /Published October 23, 2026/);
});

test('document is mobile-ready and accessible', () => {
  assert.match(articleHtml, /<html lang="en">/, 'lang must be declared');
  assert.match(articleHtml, /<meta name="viewport" content="width=device-width/,
    'viewport meta is required for mobile');
  assert.match(articleHtml, /class="skip-nav"[^>]*>Skip to main content/,
    'skip link is required');
  assert.match(articleHtml, /<main id="main-content">/, 'main landmark is required');

  const h1s = articleHtml.match(/<h1[\s>]/g) || [];
  assert.equal(h1s.length, 1, `expected exactly one <h1>, found ${h1s.length}`);
  assert.match(articleHtml, new RegExp(`<h1>${TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`));

  assert.match(articleHtml, /<span aria-hidden="true">/, 'decorative glyphs must be hidden from assistive tech');
});

// ============================================================
// 2. Structured data and FAQ parity
// ============================================================

test('all JSON-LD blocks parse', () => {
  const blocks = extractJsonLd(articleHtml);
  assert.ok(blocks.length >= 3, `expected BlogPosting + BreadcrumbList + FAQPage, found ${blocks.length}`);
  for (const b of blocks) assert.equal(typeof b, 'object');
});

test('BlogPosting structured data matches the page', () => {
  const post = extractJsonLd(articleHtml).find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, TITLE);
  assert.ok(post.description && post.description.length > 50, 'description missing or too short');
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.ok(post.mainEntityOfPage && post.mainEntityOfPage['@id'] === CANONICAL,
    'mainEntityOfPage must be the canonical URL');
  assert.equal(post.image, `${ORIGIN}/favicon/web-app-manifest-512x512.png`);
  assert.ok(post.author && post.author.name === 'Move Out Japan');
  assert.ok(post.publisher && post.publisher.name === 'Move Out Japan');
  assert.ok(post.publisher.logo && post.publisher.logo.url, 'publisher logo required');
  assert.ok(Array.isArray(post.keywords) && post.keywords.length >= 3, 'keywords expected');
});

test('BreadcrumbList has exactly three levels ending at the article', () => {
  const crumb = extractJsonLd(articleHtml).find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(crumb.itemListElement.length, 3);
  assert.deepEqual(crumb.itemListElement.map((i) => i.name), ['Home', 'Blog', TITLE]);
  assert.equal(crumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(crumb.itemListElement[1].item, `${ORIGIN}/blog/`);
  assert.ok(!('item' in crumb.itemListElement[2]), 'last crumb must not repeat the URL');
});

test('FAQPage questions and visible FAQ markup stay in sync', () => {
  const faq = extractJsonLd(articleHtml).find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');
  assert.ok(faq.mainEntity.length >= 5, 'expected several FAQ entries');

  for (const q of faq.mainEntity) {
    assert.equal(q['@type'], 'Question');
    assert.ok(q.name && q.name.trim().length > 10, `question text missing: ${q.name}`);
    assert.ok(q.acceptedAnswer && q.acceptedAnswer.text.trim().length > 40,
      `answer for "${q.name}" is missing or too short to be useful`);
  }

  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));
  assert.equal(visible.length, faq.mainEntity.length,
    `visible FAQs (${visible.length}) != JSON-LD questions (${faq.mainEntity.length})`);

  for (const q of faq.mainEntity) {
    assert.ok(visible.includes(q.name), `JSON-LD question not rendered on the page: ${q.name}`);
  }
});

// ============================================================
// 3. Required content and sources
// ============================================================

test('all required sections are present and ordered', () => {
  const positions = REQUIRED_SECTIONS.map((id) => {
    const idx = articleHtml.indexOf(`id="${id}"`);
    assert.ok(idx > -1, `missing id="${id}"`);
    return idx;
  });

  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1],
      `section "${REQUIRED_SECTIONS[i]}" should follow "${REQUIRED_SECTIONS[i - 1]}"`);
  }
});

test('the article states that it is general information, not legal advice', () => {
  const flat = stripTags(articleHtml);
  assert.match(flat, /General information, not legal advice/i);
  assert.match(flat, /consumer centre|consumer center/i);
});

test('the article covers the core legal tests and practical escalation routes', () => {
  const flat = stripTags(articleHtml);
  for (const phrase of ['Article 621', 'Article 622-2', 'ordinary wear', 'special clause', 'itemised', '188']) {
    assert.ok(flat.includes(phrase), `expected the article to mention "${phrase}"`);
  }
});

test('only verified official sources are cited', () => {
  const external = anchors(articleHtml)
    .map((a) => a.href)
    .filter((h) => /^https?:\/\//.test(h));

  assert.ok(external.length >= 7, `expected the official sources, found ${external.length}`);

  for (const href of external) {
    assert.ok(href.startsWith('https://'), `insecure source link: ${href}`);
    assert.ok(VERIFIED_EXTERNAL.has(href),
      `unverified external source: ${href}\n` +
      'Fetch it, confirm it returns 200, then add it to VERIFIED_EXTERNAL.');
  }
});

test('internal links are extensionless and anchors resolve', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);

  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(h)) continue;
    assert.ok(!/\.html($|#|\?)/.test(h), `internal link must be extensionless: ${h}`);
    assert.ok(!h.includes('${'), `unresolved template in link: ${h}`);
  }

  const ids = new Set([...articleHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const hashLinks = hrefs.filter((h) => h.startsWith('#'));
  assert.ok(hashLinks.length >= 8, 'table of contents should link to each section');
  for (const h of hashLinks) {
    assert.ok(ids.has(h.slice(1)), `anchor target does not exist: ${h}`);
  }
});

test('the quote CTA is a plain link that needs no JavaScript to follow', () => {
  const ctas = anchors(articleHtml).filter((a) => /quote/i.test(stripTags(a.inner)));
  assert.ok(ctas.length >= 1, 'expected a quote CTA in the article');
  for (const cta of ctas) {
    assert.equal(cta.href, '/contact', `quote CTA must point at /contact, got ${cta.href}`);
  }

  const contactTags = [...articleHtml.matchAll(/<a\b[^>]*href="\/contact"[^>]*>/g)].map((m) => m[0]);
  assert.ok(contactTags.length >= 1, 'expected at least one <a href="/contact">');
  for (const t of contactTags) {
    assert.ok(!/\sonclick=/i.test(t), `/contact link must not depend on a click handler: ${t}`);
  }
});

test('the article cross-links every other published article and the blog index', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  for (const slug of [
    'moving-out-checklist-japan',
    'leaving-japan-administrative-checklist',
    'how-to-dispose-furniture-japan'
  ]) {
    assert.ok(hrefs.includes(`/blog/posts/${slug}`), `article should cross-link to ${slug}`);
  }
  assert.ok(hrefs.includes('/blog/'), 'article should link back to the blog index');
  assert.ok(hrefs.includes('/pages/pricing'), 'article should link to the pricing page');
});

// ============================================================
// 4. Catalogue and sitemap consistency
// ============================================================

test('the catalogue lists the article with the right date and category', () => {
  const posts = readBlogPosts();
  const post = posts.find((p) => p.slug === SLUG);
  assert.ok(post, 'new article missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE, 'catalogue date must equal the publication date');
  assert.equal(post.category, 'Moving Out');
  assert.match(post.slug, /^[a-z0-9-]+$/, 'slug must be URL-safe');
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');
  assert.equal(posts.length, 4, `expected 4 published articles, found ${posts.length}`);
});

test('sitemap.xml lists the article with the right URL and lastmod', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(CANONICAL), `sitemap missing ${CANONICAL}`);
  assert.ok(!locs.some((l) => l.endsWith('.html')), 'sitemap must not advertise .html URLs');

  const block = xml.split(/<url>/).find((b) => b.includes(CANONICAL));
  assert.ok(block, 'could not locate the article <url> entry');
  const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/);
  assert.ok(lastmod, 'article entry is missing <lastmod>');
  assert.equal(lastmod[1], PUB_DATE, 'lastmod must be the article publication date');
});

test('sitemap.html advertises the article and the correct blog count', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.ok(html.includes(`/blog/posts/${SLUG}`), 'sitemap.html missing the new article');

  const count = html.match(/Blog &amp; Guides <span class="total-pages">([^<]+)<\/span>/)
    || html.match(/Blog & Guides <span class="total-pages">([^<]+)<\/span>/);
  assert.ok(count, 'missing blog page count');
  assert.equal(count[1], '5 pages', 'page count must cover blog home + 4 articles');
});
