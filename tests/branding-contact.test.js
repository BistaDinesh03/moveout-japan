'use strict';

/**
 * Branding, homepage and contact-reliability gate.
 *
 * These tests cover the 2026-11 brand/UX work:
 *   - original logo, favicon and social assets exist and are referenced;
 *   - the public contact address is the Outlook address, never the old Gmail;
 *   - the contact form has an honest failure path and a pre-filled mailto
 *     fallback, and never claims success when delivery failed;
 *   - the homepage keeps its required headline, description, CTAs and real
 *     article links, and carries no form;
 *   - the honeypot is present and checked before anything is sent.
 *
 * No test here loads main.js or makes a network request.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EMAIL = 'dineshbista123@outlook.com';
const GENERAL_SUBJECT = 'Move Out Japan - General Enquiry';
const PARTNERSHIP_SUBJECT = 'Move Out Japan - Partnership Enquiry';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
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

// --------------------------------------------------------------------------
// Brand assets
// --------------------------------------------------------------------------

test('original brand assets exist and are non-empty', () => {
  const assets = [
    'assets/images/brand/move-out-japan-logo.svg',
    'assets/images/brand/move-out-japan-logo-light.svg',
    'assets/images/brand/move-out-japan-symbol.svg',
    'assets/images/brand/move-out-japan-social.svg',
    'assets/images/brand/move-out-japan-social.png',
    'favicon/favicon.svg',
    'favicon/favicon.ico',
    'favicon/favicon-32x32.png',
    'favicon/favicon-96x96.png',
    'favicon/apple-touch-icon.png',
    'favicon/web-app-manifest-192x192.png',
    'favicon/web-app-manifest-512x512.png'
  ];

  for (const rel of assets) {
    assert.ok(exists(rel), `missing brand asset: ${rel}`);
    assert.ok(fs.statSync(path.join(ROOT, rel)).size > 0, `empty brand asset: ${rel}`);
  }
});

test('the manifest points at the new icons and brand theme', () => {
  const manifest = JSON.parse(read('favicon/site.webmanifest'));

  assert.equal(manifest.name, 'Move Out Japan');
  assert.equal(manifest.short_name, 'Move Out Japan');
  assert.equal(manifest.theme_color, '#0b1f3a');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

  for (const icon of manifest.icons) {
    assert.ok(exists(icon.src.replace(/^\//, '')), `manifest icon missing: ${icon.src}`);
  }
});

test('the shared header and footer use the original logo, not a generic icon', () => {
  const main = read('assets/js/main.js');

  assert.match(main, /\/assets\/images\/brand\/move-out-japan-logo\.svg/, 'header logo missing');
  assert.match(main, /\/assets\/images\/brand\/move-out-japan-logo-light\.svg/, 'footer logo missing');
  assert.match(main, /alt="Move Out Japan"/, 'logo must keep its accessible name');

  const homepage = read('index.html');
  assert.match(homepage, /\/favicon\/favicon-32x32\.png/, 'homepage must reference the 32px favicon');
  assert.match(homepage, /\/assets\/images\/brand\/move-out-japan-social\.png/, 'homepage must use the social card');
});

// --------------------------------------------------------------------------
// Contact address and subjects
// --------------------------------------------------------------------------

test('the public contact address is the Outlook address everywhere', () => {
  const files = [
    ...collectHtmlFiles(ROOT),
    path.join(ROOT, 'assets', 'js', 'main.js')
  ];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/@gmail\.com/i.test(text), `${path.relative(ROOT, file)} still contains a Gmail address`);
  }

  for (const rel of [
    'contact.html',
    'privacy.html',
    'partners.html',
    'pages/affiliate-disclosure.html',
    'assets/js/main.js'
  ]) {
    assert.ok(read(rel).includes(EMAIL), `${rel} must publish ${EMAIL}`);
  }
});

test('the general and partnership subjects are exact', () => {
  const main = read('assets/js/main.js');
  assert.ok(
    main.includes(`const GENERAL_SUBJECT = '${GENERAL_SUBJECT}';`),
    'general enquiry subject is wrong'
  );

  const partners = read('partners.html');
  const encoded = encodeURIComponent(PARTNERSHIP_SUBJECT).replace(/%20/g, '%20');
  assert.ok(
    partners.includes(`subject=${encoded}`),
    'partners page must prefill the exact partnership subject'
  );

  const contact = read('contact.html');
  assert.ok(
    contact.includes(`subject=${encodeURIComponent(GENERAL_SUBJECT)}`),
    'contact page must prefill the exact general subject'
  );
});

// --------------------------------------------------------------------------
// Honest contact behaviour
// --------------------------------------------------------------------------

test('the contact form has an honest failure path and a pre-filled Outlook fallback', () => {
  const main = read('assets/js/main.js');
  const contact = read('contact.html');

  assert.match(main, /function buildMailtoFallback/, 'mailto fallback builder missing');
  assert.match(main, /'mailto:' \+ CONTACT_EMAIL/, 'fallback must use the public contact address');
  assert.match(main, /encodeURIComponent\(GENERAL_SUBJECT\)/, 'fallback must prefill the general subject');

  assert.match(contact, /id="formError"/, 'failure panel missing');
  assert.match(contact, /id="emailFallback"/, 'fallback link missing');
  assert.match(contact, /We couldn't send that automatically/i, 'failure heading must be honest');
  assert.match(contact, /Your details are still in the form above/i, 'failure copy must reassure without faking success');

  // The catch branch must surface the failure, not the success panel.
  assert.match(main, /catch \(err\) \{[\s\S]*showFailure\(/, 'failure must be shown on error');
  assert.ok(
    !/catch \(err\) \{[\s\S]*showSuccess\(/.test(main),
    'the error branch must never call showSuccess'
  );

  // The confirmation claim is only shown when a confirmation was actually sent.
  assert.match(main, /result && result\.confirmationSent/, 'confirmation note must be conditional');
  assert.match(contact, /id="confirmationNote"[^>]*display:none/, 'confirmation note must start hidden');
});

test('the honeypot is present and checked before sending', () => {
  const contact = read('contact.html');
  const main = read('assets/js/main.js');

  assert.match(contact, /class="hp-field"/, 'honeypot wrapper missing');
  assert.match(contact, /id="website"/, 'honeypot field missing');
  assert.match(contact, /id="website"[^>]*tabindex="-1"/, 'honeypot must be skipped by keyboard users');

  assert.match(main, /function honeypotFilled\(\)/, 'honeypot check missing');
  assert.match(main, /if \(honeypotFilled\(\)\)/, 'honeypot must be checked before delivery');
});

// --------------------------------------------------------------------------
// Homepage content
// --------------------------------------------------------------------------

test('the homepage carries the required headline, description and CTAs', () => {
  const html = read('index.html');

  assert.ok(
    html.includes('Moving and Living in Japan, Made Easier.'),
    'required homepage headline missing'
  );
  assert.ok(
    html.includes('Practical English-language guides and helpful resources for moving, settling in, and managing everyday life in Japan.'),
    'required homepage description missing'
  );
  assert.ok(html.includes('Explore Guides'), 'primary CTA missing');
  assert.ok(html.includes('Get in Touch'), 'secondary CTA missing');
});

test('the homepage links only to real, published content', () => {
  const html = read('index.html');
  const required = [
    '/blog/',
    '/contact',
    '/pages/services',
    '/pages/affiliate-disclosure',
    '/privacy',
    '/blog/posts/moving-out-checklist-japan',
    '/blog/posts/how-to-dispose-furniture-japan',
    '/blog/posts/rental-deposit-deductions-japan',
    '/blog/posts/leaving-japan-administrative-checklist'
  ];

  for (const href of required) {
    assert.ok(html.includes(`href="${href}"`), `homepage missing link: ${href}`);
  }

  // Every article link must resolve to a real file.
  for (const href of required.filter((h) => h.startsWith('/blog/posts/'))) {
    const file = path.join(ROOT, `${href.replace(/^\//, '')}.html`);
    assert.ok(fs.existsSync(file), `homepage links to a missing article: ${href}`);
  }
});

test('the homepage is guide-led: no form and no EmailJS dependency', () => {
  const html = read('index.html');

  assert.ok(!/<form\b/.test(html), 'homepage must not carry a form');
  assert.ok(!/emailjs/i.test(html), 'homepage must not load the EmailJS client');
  assert.ok(!/quote-form\.js/.test(html), 'homepage must not load the form core');
  assert.match(html, /\/assets\/js\/main\.js/, 'homepage still needs the shared header/footer script');
});

// --------------------------------------------------------------------------
// Secret hygiene
// --------------------------------------------------------------------------

test('public files contain no private credential material', () => {
  const files = [
    ...collectHtmlFiles(ROOT),
    path.join(ROOT, 'assets', 'js', 'main.js'),
    path.join(ROOT, 'assets', 'js', 'quote-form.js')
  ];

  const forbidden = ['BEGIN PRIVATE KEY', 'client_secret', 'api_key', 'API_KEY', 'password'];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const needle of forbidden) {
      assert.ok(!text.includes(needle), `${path.relative(ROOT, file)} contains "${needle}"`);
    }
  }
});
