'use strict';

/**
 * Focused regression gate for the "Complete Moving Out Checklist" article,
 * its catalogue/sitemap consistency, and the quote CTA links.
 *
 * Background:
 *  - The site previously advertised 10 blog articles, only one of which ever
 *    existed. tests/blog.test.js already stops phantom articles coming back.
 *    This file covers the article that was added afterwards, plus the
 *    metadata and structured-data correctness that blog.test.js does not look at.
 *  - Every "Get Free Quote" CTA pointed at /contact, but a _redirects rule
 *    normalised /contact back onto itself and produced an infinite 308 loop in
 *    production. The CTA shape is locked down here so the navigation cannot
 *    silently pick up a .html path, a hash target or a JS click handler again.
 *
 * NOTE ON EXTERNAL LINKS: this suite cannot make network calls (enforced by
 * tests/email-safety.test.js). VERIFIED_EXTERNAL therefore records the exact
 * set of outbound sources that returned HTTP 200 when the article was written.
 * Adding a new outbound source forces a human to verify it first — which is
 * the point. Do not add an entry without re-checking it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://moveoutjapan.pages.dev';
const SLUG = 'moving-out-checklist-japan';
const ARTICLE = path.join(ROOT, 'blog', 'posts', `${SLUG}.html`);
const CANONICAL = `${ORIGIN}/blog/posts/${SLUG}`;
const PUB_DATE = '2026-10-09';

const read = (p) => fs.readFileSync(p, 'utf8');
const articleHtml = read(ARTICLE);

/** Every outbound <a> source that was confirmed to return HTTP 200. */
const VERIFIED_EXTERNAL = new Set([
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000026.html',
  'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000024.html',
  'https://www.mlit.go.jp/jutakukentiku/house/content/001595154.pdf',
  'https://www.env.go.jp/recycle/waste/index.html',
  'https://www.kokusen.go.jp/news/data/n-20250221_1.html',
  'https://www.kokusen.go.jp/soudan_topics/data/chintai.html',
  'https://www.kokusen.go.jp/soudan/',
  'https://www.caa.go.jp/',
  'https://www.soumu.go.jp/',
  'https://www.digital.go.jp/',
  'https://www.houterasu.or.jp/',
  'https://www.tepco.co.jp/index-j.html',
  'https://www.tokyo-gas.co.jp/index.html',
  'https://flets.com/',
  'https://www.ntt-east.co.jp/',
  'https://www.ntt-west.co.jp/',
  'https://www.post.japanpost.jp/'
]);

/** The eight topics the article is required to cover. */
const REQUIRED_SECTIONS = [
  'contract',      // review the rental contract
  'notice',        // notify the landlord or management company
  'utilities',     // arrange utilities
  'internet-address', // internet and address changes
  'belongings',    // sort belongings and oversized waste
  'clean',         // clean the apartment
  'inspection',    // attend the final inspection
  'keys'           // return the keys
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

/** All <a> anchors as { href, inner } pairs (inner still contains child tags). */
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
// 1. Article file, page metadata and accessibility basics
// ============================================================

test('the new article exists and is substantial', () => {
  assert.ok(fs.existsSync(ARTICLE), `missing: ${SLUG}.html`);
  const size = fs.statSync(ARTICLE).size;
  assert.ok(size > 8000, `article is only ${size} bytes — too small for a full guide`);
});

test('page title, meta description and canonical URL are correct', () => {
  const title = articleHtml.match(/<title>([^<]+)<\/title>/);
  assert.ok(title, 'missing <title>');
  assert.equal(title[1], 'The Complete Moving Out Checklist in Japan for Foreigners | Move Out Japan');

  const desc = articleHtml.match(/<meta name="description" content="([^"]+)">/);
  assert.ok(desc, 'missing meta description');
  assert.ok(desc[1].length >= 80 && desc[1].length <= 170,
    `meta description length ${desc[1].length} outside 80-170`);

  const canonical = articleHtml.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, 'missing canonical');
  assert.equal(canonical[1], CANONICAL);
  assert.ok(!CANONICAL.endsWith('.html'), 'canonical must be the extensionless URL');
});

test('Open Graph and Twitter metadata all agree with the canonical URL', () => {
  const ogUrl = articleHtml.match(/<meta property="og:url" content="([^"]+)">/);
  assert.ok(ogUrl, 'missing og:url');
  assert.equal(ogUrl[1], CANONICAL, 'og:url must equal the canonical URL');

  for (const prop of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:alt']) {
    assert.match(articleHtml, new RegExp(`<meta property="${prop}" content="[^"]+">`), `missing ${prop}`);
  }
  assert.match(articleHtml, /<meta property="og:type" content="article">/);

  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.match(articleHtml, new RegExp(`<meta name="${name}" content="[^"]+">`), `missing ${name}`);
  }
});

test('publication dates are real and consistent across meta tags', () => {
  const pub = articleHtml.match(/<meta property="article:published_time" content="([^"]+)">/);
  const mod = articleHtml.match(/<meta property="article:modified_time" content="([^"]+)">/);
  assert.ok(pub && mod, 'published/modified meta tags required');

  assert.match(pub[1], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(mod[1], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(pub[1], PUB_DATE, 'published date must be the actual publication date');
  assert.equal(mod[1], PUB_DATE);
  assert.ok(new Date(pub[1]).getTime() <= Date.now(), 'published date is in the future');
  assert.ok(new Date(mod[1]).getTime() <= Date.now(), 'modified date is in the future');
});

test('document is mobile-ready and accessible', () => {
  assert.match(articleHtml, /<html lang="en">/, 'lang must be declared');
  assert.match(articleHtml, /<meta name="viewport" content="width=device-width/,
    'viewport meta is required for mobile');
  assert.match(articleHtml, /class="skip-nav"[^>]*>Skip to main content/,
    'skip link is required');

  const h1s = articleHtml.match(/<h1[\s>]/g) || [];
  assert.equal(h1s.length, 1, `expected exactly one <h1>, found ${h1s.length}`);

  // The article header must carry the real H1 text, not just a placeholder.
  assert.match(articleHtml, /<h1>The Complete Moving Out Checklist in Japan for Foreigners<\/h1>/);

  // Decorative emoji spans inside the highlight boxes must stay out of the
  // accessibility tree.
  assert.match(articleHtml, /<span aria-hidden="true">/);
});

// ============================================================
// 2. Structured data
// ============================================================

test('all JSON-LD blocks parse', () => {
  const blocks = extractJsonLd(articleHtml);
  assert.ok(blocks.length >= 3, `expected BlogPosting + BreadcrumbList + FAQPage, found ${blocks.length}`);
  for (const b of blocks) assert.equal(typeof b, 'object');
});

test('BlogPosting structured data matches the page', () => {
  const blocks = extractJsonLd(articleHtml);
  const post = blocks.find((b) => b['@type'] === 'BlogPosting');
  assert.ok(post, 'missing BlogPosting JSON-LD');

  assert.equal(post.headline, 'The Complete Moving Out Checklist in Japan for Foreigners');
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
  const blocks = extractJsonLd(articleHtml);
  const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.ok(crumb, 'missing BreadcrumbList JSON-LD');

  assert.equal(crumb.itemListElement.length, 3);
  assert.deepEqual(crumb.itemListElement.map((i) => i.name),
    ['Home', 'Blog', 'The Complete Moving Out Checklist in Japan for Foreigners']);
  assert.equal(crumb.itemListElement[0].item, `${ORIGIN}/`);
  assert.equal(crumb.itemListElement[1].item, `${ORIGIN}/blog`);

  // The final crumb names the page rather than linking a second time.
  assert.ok(!('item' in crumb.itemListElement[2]), 'last crumb must not repeat the URL');
});

test('FAQPage questions and visible FAQ markup stay in sync', () => {
  const blocks = extractJsonLd(articleHtml);
  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'missing FAQPage JSON-LD');

  assert.ok(faq.mainEntity.length >= 3, 'expected several FAQ entries');
  for (const q of faq.mainEntity) {
    assert.equal(q['@type'], 'Question');
    assert.ok(q.name && q.name.trim().length > 10, `question text missing: ${q.name}`);
    assert.ok(q.acceptedAnswer && q.acceptedAnswer.text.trim().length > 40,
      `answer for "${q.name}" is missing or too short to be useful`);
  }

  // Every structured-data question must actually be on the page, and every
  // rendered FAQ must have structured data — the two cannot drift apart.
  const visible = [...articleHtml.matchAll(/<div class="faq-question"[^>]*>([\s\S]*?)<span aria-hidden="true">/g)]
    .map((m) => stripTags(m[1]));
  assert.equal(visible.length, faq.mainEntity.length,
    `visible FAQs (${visible.length}) != JSON-LD questions (${faq.mainEntity.length})`);

  for (const q of faq.mainEntity) {
    assert.ok(visible.includes(q.name), `JSON-LD question not rendered on the page: ${q.name}`);
  }
});

// ============================================================
// 3. Required content
// ============================================================

test('all eight required checklist sections are present and ordered', () => {
  const positions = REQUIRED_SECTIONS.map((id) => {
    const idx = articleHtml.indexOf(`<h2 id="${id}"`);
    assert.ok(idx > -1, `missing <h2 id="${id}"> — a required checklist topic`);
    return idx;
  });

  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1],
      `section "${REQUIRED_SECTIONS[i]}" should follow "${REQUIRED_SECTIONS[i - 1]}"`);
  }
});

test('the article states that rules vary by municipality, provider and contract', () => {
  // This caveat is a hard requirement — an article that reads as universal
  // would mislead readers about legally and locally variable obligations.
  const flat = stripTags(articleHtml);
  assert.match(flat, /procedures, deadlines, fees and waste-disposal rules in Japan vary/i,
    'the variability caveat must be stated up front');
  assert.match(flat, /municipality/i);
  assert.match(flat, /provider/i);
  assert.match(flat, /contract/i);
});

test('only verified official sources are cited', () => {
  const external = anchors(articleHtml)
    .map((a) => a.href)
    .filter((h) => /^https?:\/\//.test(h));

  assert.ok(external.length >= 10, `expected several official sources, found ${external.length}`);

  for (const href of external) {
    assert.ok(href.startsWith('https://'), `insecure source link: ${href}`);
    assert.ok(VERIFIED_EXTERNAL.has(href),
      `unverified external source: ${href}\n` +
      'Fetch it, confirm it returns 200, then add it to VERIFIED_EXTERNAL.');
  }
});

test('the article is internally consistent — no .html links, no dead anchors', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);

  for (const h of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(h)) continue;
    assert.ok(!/\.html($|#|\?)/.test(h), `internal link must be extensionless: ${h}`);
    assert.ok(!h.includes('${'), `unresolved template in link: ${h}`);
  }

  // Every in-page anchor target must actually exist.
  const ids = new Set([...articleHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const hashLinks = hrefs.filter((h) => h.startsWith('#'));
  assert.ok(hashLinks.length >= 8, 'table of contents should link to each section');
  for (const h of hashLinks) {
    assert.ok(ids.has(h.slice(1)), `anchor target does not exist: ${h}`);
  }

  // The table of contents must point at every required section.
  for (const id of REQUIRED_SECTIONS) {
    assert.ok(hashLinks.includes(`#${id}`), `table of contents is missing #${id}`);
  }
});

test('the quote CTA is a plain link that needs no JavaScript to follow', () => {
  const ctas = anchors(articleHtml).filter((a) => /quote/i.test(stripTags(a.inner)));
  assert.ok(ctas.length >= 1, 'expected a quote CTA in the article');

  for (const cta of ctas) {
    assert.equal(cta.href, '/contact', `quote CTA must point at /contact, got ${cta.href}`);
  }

  // A CTA must navigate natively: the browser follows the href itself, so no
  // inline click handler may be required anywhere the site links to /contact.
  const contactTags = [...articleHtml.matchAll(/<a\b[^>]*href="\/contact"[^>]*>/g)].map((m) => m[0]);
  assert.ok(contactTags.length >= 1, 'expected at least one <a href="/contact">');
  for (const t of contactTags) {
    assert.ok(!/\sonclick=/i.test(t), `/contact link must not depend on a click handler: ${t}`);
  }
});

// ============================================================
// 4. Blog index / catalogue / sitemap consistency
// ============================================================

test('the catalogue advertises exactly the articles that exist', () => {
  const posts = readBlogPosts();
  const files = fs.readdirSync(path.join(ROOT, 'blog', 'posts'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))
    .sort();
  // BLOG_POSTS is evaluated in a vm sandbox, so its array comes from another
  // realm. Re-materialise it here or deepStrictEqual rejects it on prototype.
  const slugs = [...posts].map((p) => p.slug).sort();

  assert.deepEqual(slugs, files, 'catalogue and article files have diverged');
  assert.ok(slugs.includes(SLUG), `catalogue must list ${SLUG}`);
  assert.equal(slugs.length, 2, `expected exactly 2 published articles, found ${slugs.length}`);
});

test('catalogue date matches the article publication date', () => {
  const post = readBlogPosts().find((p) => p.slug === SLUG);
  assert.ok(post, 'new article missing from BLOG_POSTS');
  assert.equal(post.date, PUB_DATE, 'catalogue date must equal article:published_time');
  assert.equal(post.category, 'Moving Out');
  assert.match(post.slug, /^[a-z0-9-]+$/, 'slug must be URL-safe');
  assert.ok(post.image && fs.existsSync(path.join(ROOT, post.image.slice(1))),
    'catalogue image must point at a real file');
});

test('sitemap.xml lists the article with the right URL and lastmod', () => {
  const xml = read(path.join(ROOT, 'sitemap.xml'));

  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(CANONICAL), `sitemap missing ${CANONICAL}`);
  assert.ok(!locs.some((l) => l.endsWith('.html')), 'sitemap must not advertise .html URLs');

  // Pull the <url> block that contains the article and check its lastmod.
  const block = xml.split(/<url>/).find((b) => b.includes(CANONICAL));
  assert.ok(block, 'could not locate the article <url> entry');
  const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/);
  assert.ok(lastmod, 'article entry is missing <lastmod>');
  assert.equal(lastmod[1], PUB_DATE, 'lastmod must be the article publication date');
  assert.ok(new Date(lastmod[1]).getTime() <= Date.now(), 'lastmod is in the future');
});

test('sitemap.html advertises every published article and no others', () => {
  const html = read(path.join(ROOT, 'sitemap.html'));
  const hrefs = anchors(html)
    .map((a) => a.href)
    .filter((h) => h.startsWith('/blog/posts/'));

  const expected = [...readBlogPosts()].map((p) => `/blog/posts/${p.slug}`).sort();
  assert.deepEqual([...hrefs].sort(), expected, 'sitemap.html has drifted from BLOG_POSTS');

  const count = html.match(/Blog &amp; Guides <span class="total-pages">([^<]+)<\/span>/)
    || html.match(/Blog & Guides <span class="total-pages">([^<]+)<\/span>/);
  assert.ok(count, 'missing blog page count');
  assert.equal(count[1], '3 pages', 'page count must cover blog home + 2 articles');
});

test('the blog index renders from the catalogue, so the article will appear', () => {
  const html = read(path.join(ROOT, 'blog', 'index.html'));
  assert.match(html, /id="blog-listing-container"/,
    'blog index must keep the container main.js fills from BLOG_POSTS');
  assert.match(html, /src="\/assets\/js\/main\.js"/,
    'blog index must load main.js or no cards render');
  assert.match(html, /id="blogSearchInput"/, 'search box is expected on the blog index');
});

test('the other published article is reachable from the new one', () => {
  const hrefs = anchors(articleHtml).map((a) => a.href);
  assert.ok(hrefs.includes('/blog/posts/how-to-dispose-furniture-japan'),
    'the new article should cross-link to the existing guide');
  assert.ok(hrefs.includes('/blog'), 'the new article should link back to the blog index');
});

// ============================================================
// 5. Quote CTA integrity across the whole site
// ============================================================

test('the shared navigation CTA points at /contact', () => {
  const mainJs = read(path.join(ROOT, 'assets', 'js', 'main.js'));

  const navCta = mainJs.match(/<a href="([^"]+)" class="nav-cta"[^>]*>([^<]+)</);
  assert.ok(navCta, 'nav CTA not found in main.js');
  assert.equal(navCta[1], '/contact', 'nav CTA must point at /contact');
  assert.equal(navCta[2].trim(), 'Get Free Quote');
});

test('every quote CTA in the site links to /contact with no click handler', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|js)$/.test(entry.name)) checkFile(full);
    }
  };

  function checkFile(file) {
    const src = read(file);
    for (const m of src.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const attrsText = m[1];
      const text = stripTags(m[2]);
      if (!/quote/i.test(text)) continue;

      const href = (attrsText.match(/href="([^"]*)"/) || [])[1];
      const rel = path.relative(ROOT, file);

      if (href !== '/contact') offenders.push(`${rel}: "${text}" -> ${href || '(none)'}`);
      if (/\sonclick=/i.test(attrsText)) offenders.push(`${rel}: "${text}" has an onclick handler`);
      if (/\.html/.test(href || '')) offenders.push(`${rel}: "${text}" uses a .html URL`);
    }
  }

  walk(ROOT);
  assert.deepEqual(offenders, [], `quote CTA problems:\n  ${offenders.join('\n  ')}`);
});

test('no page links to contact.html and no redirect rule touches /contact', () => {
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|js|xml|txt|md)$/.test(entry.name)) {
        const src = read(full);
        for (const h of [...src.matchAll(/href="([^"]*contact\.html[^"]*)"/g)].map((m) => m[1])) {
          offenders.push(`${path.relative(ROOT, full)} -> ${h}`);
        }
      }
    }
  };
  walk(ROOT);
  assert.deepEqual(offenders, [], `contact.html links found:\n  ${offenders.join('\n  ')}`);

  // _redirects must never contain a /contact rule: Cloudflare Pages normalises
  // `.html` away, so /contact -> /contact.html resolves straight back to
  // /contact and loops forever (this is what broke production).
  const redirects = read(path.join(ROOT, '_redirects'));
  const rules = redirects.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const rule of rules) {
    const from = rule.split(/\s+/)[0];
    assert.notEqual(from, '/contact', '_redirects must not contain a /contact rule');
    assert.ok(!/^\/contact(\/|\s|$)/.test(rule), `_redirects must not touch /contact: ${rule}`);
  }

  // And the contact page itself must exist to be served natively.
  const contact = path.join(ROOT, 'contact.html');
  assert.ok(fs.existsSync(contact), 'contact.html is required');
  assert.ok(fs.statSync(contact).size > 1000, 'contact.html looks too small to be a real page');
});
