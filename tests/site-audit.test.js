'use strict';

/**
 * Site-wide regression gate for the 2026-10-11 audit round.
 *
 * Background:
 *  - BreadcrumbList JSON-LD on six pages pointed at short URLs (/pricing,
 *    /faq, /services, /how-it-works, /blog) that Cloudflare Pages 308-redirects
 *    before serving, contradicting each page's own canonical. Structured data
 *    and canonicals must now agree, so every breadcrumb item has to be a URL
 *    the site actually declares canonical somewhere.
 *  - The homepage and pricing page advertised fixed prices, payment methods,
 *    response times, a nationwide service area and other business claims that
 *    no source in this repository can verify. The site now quotes per job, so
 *    the invented figures and claims must not come back.
 *  - Internal links to the blog index used /blog, which 308-redirects to the
 *    canonical /blog/.
 *  - A third article was published (leaving-japan-administrative-checklist).
 *    Its facts are drawn from official sources that were fetched and confirmed
 *    HTTP 200 on 2026-10-11; VERIFIED_EXTERNAL pins that set, the same way
 *    tests/moving-checklist.test.js pins the first article's.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';
const SLUG = 'leaving-japan-administrative-checklist';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-10-11';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);

/** Every outbound <a> source in the new article, confirmed HTTP 200 on 2026-10-11. */
const VERIFIED_EXTERNAL = new Set([
  'https://www.post.japanpost.jp/service/tenkyo/index_en.html',
  'https://www.post.japanpost.jp/service/send/oversea/use/howto/students/intl_student/index_en.html',
  'https://www.nta.go.jp/english/taxes/individual/12004.htm',
  'https://www.nta.go.jp/english/taxes/individual/12021.htm',
  'https://www.nenkin.go.jp/international/english/japanese-system/benefit/payment.html',
  'https://www.city.sendai.jp/koryu/foreignlanguage/en/information/living-05-3.html',
  'https://www.osaka-u.ac.jp/en/international/inbound/support/support-office/procedure/cityhall'
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

function collectHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function readBlogPosts() {
  const src = read(path.join(ROOT, 'assets', 'js', 'main.js'));
  const m = src.match(/const BLOG_POSTS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'BLOG_POSTS array not found in main.js');
  return vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
}

// ============================================================
// 1. Structured data must agree with canonical URLs
// ============================================================

test('every BreadcrumbList item is a URL the site declares canonical', () => {
  // Collect the canonical URL of every page that has one.
  const canonicals = new Set([`${ORIGIN}/`]);
  for (const file of collectHtmlFiles(ROOT)) {
    const html = read(file);
    const m = html.match(/<link rel="canonical" href="([^"]+)">/);
    if (m) canonicals.add(m[1]);
  }

  const offenders = [];
  for (const file of collectHtmlFiles(ROOT)) {
    const html = read(file);
    for (const block of extractJsonLd(html, path.relative(ROOT, file))) {
      if (block['@type'] !== 'BreadcrumbList') continue;
      for (const item of block.itemListElement) {
        if (!('item' in item)) continue; // last crumb names the page only
        if (!canonicals.has(item.item)) {
          offenders.push(`${path.relative(ROOT, file)} -> ${item.item}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, [],
    `breadcrumb items must be canonical URLs (no 308-redirecting short forms):\n  ${offenders.join('\n  ')}`);
});

// ============================================================
// 2. Unverified claims must not return
// ============================================================

test('the commercial pages carry no invented fixed prices', () => {
  for (const rel of ['index.html', 'pages/pricing.html']) {
    const html = read(path.join(ROOT, rel));
    assert.ok(!/¥\s?\d/.test(html),
      `${rel} advertises a fixed yen price — pricing is quoted per job`);
    assert.ok(!/class="price"/.test(html),
      `${rel} still uses the fixed-price card markup`);
    // The quote CTA must survive the price removal.
    assert.ok(/href="\/contact"/.test(html),
      `${rel} must keep its /contact quote CTA`);
  }
});

test('unverifiable business claims are gone from the marketing pages', () => {
  const files = [
    'index.html',
    'contact.html',
    'pages/pricing.html',
    'pages/services.html',
    'pages/faq.html',
    'pages/how-it-works.html',
    'assets/js/main.js'
  ];

  const banned = [
    ['PayPay', 'payment methods we cannot verify'],
    ['LINE Pay', 'payment methods we cannot verify'],
    ['hidden fees', 'pricing language removed in the audit'],
    ['100% Legal', 'legal-guarantee language'],
    ['2-7 days', 'unverified response-time claim'],
    ['full deposit back', 'deposit guarantee we cannot make'],
    ['deposit-safe', 'deposit guarantee we cannot make'],
    ['© 2024 Move Out Japan', 'stale copyright year']
  ];

  const offenders = [];
  for (const rel of files) {
    const text = read(path.join(ROOT, rel));
    for (const [needle, why] of banned) {
      if (text.includes(needle)) offenders.push(`${rel} contains "${needle}" (${why})`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('the homepage no longer lists a fixed service-area city list', () => {
  const html = read(path.join(ROOT, 'index.html'));
  assert.ok(!/class="service-areas"/.test(html) || !/<span>Tokyo<\/span>/.test(html),
    'a city list on the homepage is a service-area claim we cannot verify — coverage is confirmed per quote');
});

test('internal links to the blog index use the canonical /blog/ URL', () => {
  const files = [...collectHtmlFiles(ROOT), path.join(ROOT, 'assets', 'js', 'main.js')];
  const offenders = [];
  for (const f of files) {
    const text = read(f);
    for (const m of text.matchAll(/href=(["'])\/blog\1/g)) {
      offenders.push(`${path.relative(ROOT, f)} -> href="/blog" (308-redirects; use /blog/)`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('sitemap.html is current — no stale date, correct copyright', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.match(html, /Last updated: October 11, 2026/,
    'sitemap.html must carry the date its content last changed');
  assert.ok(!/July 19, 2026/.test(html), 'stale "last updated" date');
});

// ============================================================
// 3. FAQ parity for every published article
// ============================================================

test('FAQPage JSON-LD and visible FAQs match in every article', () => {
  const files = fs.readdirSync(path.join(ROOT, 'blog', 'posts'))
    .filter((f) => f.endsWith('.html'));

  for (const f of files) {
    const html = read(path.join(ROOT, 'blog', 'posts', f));
    const faq = extractJsonLd(html, f).find((b) => b['@type'] === 'FAQPage');
    assert.ok(faq, `${f}: missing FAQPage JSON-LD`);

    const visible = [...html.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
      .map((m) => stripTags(m[1]));

    assert.equal(visible.length, faq.mainEntity.length,
      `${f}: visible FAQs (${visible.length}) != JSON-LD questions (${faq.mainEntity.length})`);
    for (const q of faq.mainEntity) {
      assert.ok(visible.includes(q.name), `${f}: JSON-LD question not rendered: ${q.name}`);
    }
  }
});

// ============================================================
// 4. The new article
// ============================================================

test('the new article exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 8000, `article is only ${size} bytes — too small for a full guide`);
});

test('metadata and canonical URLs are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], 'Moving Out of Japan: The Administrative Checklist Foreigners Often Miss | Move Out Japan');

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

  const pub = articleHtml.match(/<meta property="article:published_time" content="([^"]+)">/);
  const mod = articleHtml.match(/<meta property="article:modified_time" content="([^"]+)">/);
  assert.ok(pub && mod, 'published/modified meta tags required');
  assert.equal(pub[1], PUB_DATE, 'published date must be the actual publication date');
  assert.equal(mod[1], PUB_DATE);
  assert.ok(new Date(pub[1]).getTime() <= Date.now(), 'published date is in the future');
});

test('structured data parses and matches the page', () => {
  const blocks = extractJsonLd(articleHtml, SLUG);
  assert.ok(blocks.length >= 3, `expected BlogPosting + BreadcrumbList + FAQPage, found ${blocks.length}`);

  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');
  assert.equal(post.headline, 'Moving Out of Japan: The Administrative Checklist Foreigners Often Miss');
  assert.equal(post.datePublished, PUB_DATE);
  assert.equal(post.dateModified, PUB_DATE);
  assert.ok(post.mainEntityOfPage && post.mainEntityOfPage['@id'] === CANONICAL);

  const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');
  assert.equal(crumb.itemListElement.length, 3);
  assert.equal(crumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(crumb.itemListElement[1].item, `${ORIGIN}/blog/`);
  assert.ok(!('item' in crumb.itemListElement[2]), 'last crumb must not repeat the URL');

  // Visible breadcrumb navigation must agree.
  const nav = articleHtml.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/);
  assert.ok(nav, 'missing visible breadcrumb');
  assert.match(nav[1], /<a href="\/blog\/">Blog<\/a>/);
});

test('only verified official sources are cited', () => {
  const external = anchors(articleHtml)
    .map((a) => a.href)
    .filter((h) => /^https?:\/\//.test(h));

  assert.ok(external.length >= 7, `expected several official sources, found ${external.length}`);

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

test('the article cross-links both other published articles and the blog index', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  for (const slug of ['moving-out-checklist-japan', 'how-to-dispose-furniture-japan']) {
    assert.ok(hrefs.includes(`/blog/posts/${slug}`), `article should cross-link to ${slug}`);
  }
  assert.ok(hrefs.includes('/blog/'), 'article should link back to the blog index');
});

test('the catalogue, sitemap.xml and sitemap.html all carry the new article', () => {
  const post = readBlogPosts().find((p) => p.slug === SLUG);
  assert.ok(post, 'new article missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE, 'catalogue date must equal the publication date');
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');

  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const block = xml.split(/<url>/).find((b) => b.includes(CANONICAL));
  assert.ok(block, `sitemap.xml missing ${CANONICAL}`);
  const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/);
  assert.ok(lastmod && lastmod[1] === PUB_DATE, 'sitemap lastmod must be the publication date');

  const html = read(path.join(ROOT, 'sitemap.html'));
  assert.ok(html.includes(`/blog/posts/${SLUG}`), 'sitemap.html missing the new article');
});

test('the pages whose content changed on 2026-10-11 carry that lastmod', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const changed = [
    `${ORIGIN}/`,
    `${ORIGIN}/contact`,
    `${ORIGIN}/pages/how-it-works`,
    `${ORIGIN}/pages/services`,
    `${ORIGIN}/pages/pricing`,
    `${ORIGIN}/pages/faq`,
    `${ORIGIN}/blog/`
  ];

  for (const url of changed) {
    const block = xml.split(/<url>/).find((b) => b.includes(`<loc>${url}</loc>`));
    assert.ok(block, `sitemap.xml missing ${url}`);
    assert.match(block, /<lastmod>\s*2026-10-11\s*<\/lastmod>/,
      `${url} was edited on 2026-10-11, so its lastmod must say so`);
  }
});
