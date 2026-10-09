'use strict';

/**
 * Routing, redirect, header and link integrity.
 *
 * The single most damaging bug found in the audit was a `_redirects` rule of
 * `/contact  /contact.html  200`. Cloudflare Pages normalises `.html` URLs to
 * extensionless ones, so that rule redirected a request for `/contact` to
 * `/contact` — an infinite 308 loop that killed every contact CTA on the
 * site. The first suite below encodes that exact failure mode so it cannot
 * return.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** What Cloudflare Pages does to a `.html` path before serving it. */
function normalizeHtml(p) {
  if (p.endsWith('/index.html')) return p.slice(0, -'index.html'.length);
  if (p.endsWith('.html')) return p.slice(0, -'.html'.length);
  return p;
}

function readRedirects() {
  const text = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((line) => {
      const parts = line.split(/\s+/);
      assert.ok(parts.length >= 2, `malformed _redirects line: "${line}"`);
      return {
        raw: line,
        source: parts[0],
        target: parts[1],
        status: parts.length >= 3 ? Number(parts[2]) : 301
      };
    });
}

// --------------------------------------------------------------------------
// _redirects
// --------------------------------------------------------------------------

test('_redirects contains only well-formed rules', () => {
  const rules = readRedirects();
  assert.ok(rules.length > 0, '_redirects should not be empty');
  for (const r of rules) {
    assert.ok(r.source.startsWith('/'), `source must be absolute: ${r.raw}`);
    assert.ok(r.target.startsWith('/'), `target must be absolute: ${r.raw}`);
    assert.ok(!Number.isNaN(r.status), `status must be numeric: ${r.raw}`);
  }
});

test('NO rule can normalise back onto itself (the /contact infinite loop)', () => {
  for (const r of readRedirects()) {
    const normalized = normalizeHtml(r.target);
    assert.notEqual(
      normalized,
      r.source,
      `SELF-LOOP: "${r.raw}" resolves back to "${r.source}" and would 308 forever`
    );
  }
});

test('no rewrite rule exists for /contact', () => {
  // contact.html is served at /contact natively; any rule reintroduces the loop.
  for (const r of readRedirects()) {
    assert.notEqual(r.source, '/contact', `the /contact rule must not exist: "${r.raw}"`);
  }
});

test('every rewrite target maps to an existing file', () => {
  for (const r of readRedirects()) {
    const rel = r.target.replace(/^\//, '');
    const full = path.join(ROOT, rel);
    assert.ok(fs.existsSync(full), `rewrite target missing on disk: ${r.target}`);
    assert.ok(fs.statSync(full).size > 0, `rewrite target is empty: ${r.target}`);
  }
});

test('the short URLs the site advertises are all covered', () => {
  const sources = new Set(readRedirects().map((r) => r.source));
  for (const s of ['/how-it-works', '/services', '/pricing', '/faq']) {
    assert.ok(sources.has(s), `expected a short-URL rule for ${s}`);
  }
});

// --------------------------------------------------------------------------
// 404 handling
// --------------------------------------------------------------------------

test('a real 404 page exists and is not indexable', () => {
  const file = path.join(ROOT, '404.html');
  assert.ok(fs.existsSync(file), '404.html is required for real 404 responses');
  assert.ok(fs.statSync(file).size > 500, '404.html is suspiciously small');

  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex/, '404 page must not be indexed');
  assert.match(html, /404/, '404 page should show the status');
  assert.match(html, /href="\/"/, '404 page should offer a way home');
  assert.match(html, /<title>/);
});

// --------------------------------------------------------------------------
// Internal links
// --------------------------------------------------------------------------

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
  return false; // resolved nothing -> broken
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

test('every internal link in the site resolves to a real file', () => {
  const sources = [
    ...collectHtmlFiles(ROOT).map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') })),
    { file: path.join(ROOT, 'assets', 'js', 'main.js'), text: fs.readFileSync(path.join(ROOT, 'assets', 'js', 'main.js'), 'utf8') }
  ];

  const broken = [];

  for (const src of sources) {
    const hrefs = [
      ...[...src.text.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
      ...[...src.text.matchAll(/href='([^']*)'/g)].map((m) => m[1])
    ].filter((h) => !h.includes('${')); // template placeholders are resolved at runtime, not here

    for (const href of hrefs) {
      const result = resolveHref(href);
      if (result === false) {
        broken.push(`${path.relative(ROOT, src.file)} -> ${href}`);
      }
    }
  }

  assert.deepEqual(broken, [], `broken internal links:\n  ${broken.join('\n  ')}`);
});

test('no internal link uses a .html variant', () => {
  const files = [...collectHtmlFiles(ROOT), path.join(ROOT, 'assets', 'js', 'main.js')];
  const offenders = [];

  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const hrefs = [
      ...[...text.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/href='([^']*)'/g)].map((m) => m[1])
    ];
    for (const href of hrefs) {
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) continue;
      if (href.includes('${')) continue;
      if (/\.html($|#|\?)/.test(href)) offenders.push(`${path.relative(ROOT, f)} -> ${href}`);
    }
  }

  assert.deepEqual(offenders, [], `internal links should use canonical extensionless URLs:\n  ${offenders.join('\n  ')}`);
});

// --------------------------------------------------------------------------
// _headers
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// HTML / JavaScript contract
// --------------------------------------------------------------------------

test('every element ID main.js looks up actually exists in the markup', () => {
  // main.js cannot be required in Node (it needs `document`), so instead of
  // executing it we assert statically that its getElementById() contract is
  // satisfied. This catches the realistic failure of renaming an id in HTML
  // and silently breaking the JavaScript that writes to it.
  const main = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'main.js'), 'utf8');

  const ids = new Set(
    [...main.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1])
  );
  assert.ok(ids.size >= 10, `expected several getElementById lookups, found ${ids.size}`);

  // The markup can come from a static HTML file OR from a header/footer
  // template string inside main.js itself (that is how #navLinks is created).
  // Both end up in the DOM at runtime, so both satisfy the contract.
  const html = [
    ...collectHtmlFiles(ROOT).map((f) => fs.readFileSync(f, 'utf8')),
    main
  ].join('\n');

  const missing = [...ids].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(
    missing,
    [],
    `main.js references ids that are created nowhere: ${missing.join(', ')}`
  );
});

test('every form element main.js queries exists in both form pages', () => {
  const main = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'main.js'), 'utf8');

  const selectors = new Set(
    [...main.matchAll(/querySelector\('#([^']+)'\)/g)].map((m) => m[1])
  );
  assert.ok(selectors.size >= 4, 'expected the four form field lookups');

  for (const file of ['index.html', 'contact.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const s of selectors) {
      assert.ok(html.includes(`id="${s}"`), `${file}: missing element #${s}`);
    }
  }
});

test('each form field sits inside a .form-group (required by error rendering)', () => {
  for (const file of ['index.html', 'contact.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const field of ['name', 'email', 'location', 'items']) {
      const idx = html.indexOf(`id="${field}"`);
      assert.ok(idx !== -1, `${file}: field #${field} missing`);

      // Walk back to the nearest opening div and require .form-group, which is
      // what setFieldError() traverses to in order to insert the message.
      const before = html.slice(Math.max(0, idx - 600), idx);
      const lastOpen = before.lastIndexOf('<div');
      assert.ok(
        lastOpen !== -1 && /class="form-group"/.test(before.slice(lastOpen)),
        `${file}: #${field} is not inside a .form-group — inline errors would not render`
      );
    }
  }
});

test('the CSS classes the new error rendering relies on exist', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'style.css'), 'utf8');

  // Assigned dynamically by main.js; if the rule is dropped the messages
  // render as unstyled text and are easy to miss.
  assert.match(css, /\.field-error\s*\{/, 'style.css must define .field-error');
  assert.match(css, /\.form-status\s*\{/, 'style.css must define .form-status');
  assert.match(css, /\[aria-invalid="true"\]/, 'invalid fields need a visible state');

  // #b91c1c on the #fafafa input background is ~5.9:1, above the 4.5:1
  // WCAG AA floor for normal text.
  assert.match(css, /#b91c1c/, 'error colour not found');
});

function parseHeadersFile() {
  const lines = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').split(/\r?\n/);
  const rules = [];
  let current = null;

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    if (line.trim() === '' || line.startsWith('#')) continue;

    if (/^\s/.test(line)) {
      assert.ok(current, `header line outside any rule at line ${lineNo}: "${line}"`);
      assert.match(
        line,
        /^\s+[A-Za-z0-9-]+:\s*\S/,
        `malformed header line ${lineNo}: "${line}" (a stray comment or bad indent here can invalidate the whole file)`
      );
      const idx = line.indexOf(':');
      current.headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    } else {
      current = { path: line.trim(), headers: {}, line: lineNo };
      rules.push(current);
    }
  }
  return rules;
}

test('_headers is well-formed (no stray lines inside rule blocks)', () => {
  const rules = parseHeadersFile();
  assert.ok(rules.length >= 3, 'expected a catch-all rule plus the cache rules');
  for (const r of rules) {
    assert.ok(Object.keys(r.headers).length > 0, `rule "${r.path}" sets no headers`);
  }
});

test('required security headers are configured', () => {
  const rules = parseHeadersFile();
  const all = Object.assign({}, ...rules.map((r) => r.headers));

  const required = [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security'
  ];
  for (const h of required) {
    assert.ok(all[h], `missing required header: ${h}`);
  }

  assert.equal(all['X-Content-Type-Options'], 'nosniff');
  assert.equal(all['X-Frame-Options'], 'DENY');
  assert.match(all['Strict-Transport-Security'], /^max-age=\d+/);
});

test('CSP covers the origins the application actually uses', () => {
  const rules = parseHeadersFile();
  const csp = rules.map((r) => r.headers['Content-Security-Policy']).find(Boolean);
  assert.ok(csp, 'no Content-Security-Policy found');

  const directives = Object.fromEntries(
    csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...rest] = d.split(/\s+/);
      return [name, rest];
    })
  );

  // Required to keep the site working:
  assert.ok(directives['script-src'].includes('https://cdn.jsdelivr.net'), 'EmailJS CDN must be allowed in script-src');
  assert.ok(directives['script-src'].includes("'self'"));
  assert.ok(directives['style-src'].includes('https://fonts.googleapis.com'), 'Google Fonts CSS must be allowed');
  assert.ok(directives['font-src'].includes('https://fonts.gstatic.com'), 'Google Fonts files must be allowed');
  assert.ok(directives['connect-src'].includes('https://api.emailjs.com'), 'EmailJS API must be reachable');

  // Required to protect the site:
  assert.deepEqual(directives['frame-ancestors'], ["'none'"], 'clickjacking protection');
  assert.equal(directives['object-src'][0], "'none'");
  assert.equal(directives['base-uri'][0], "'self'");
  assert.equal(directives['form-action'][0], "'self'");

  // The inline handlers are a known, documented exception.
  assert.ok(
    directives['script-src'].includes("'unsafe-inline'"),
    'script-src must allow inline handlers (documented in _headers); if you remove the handlers, remove this too'
  );
});

test('existing cache rules are preserved', () => {
  const rules = parseHeadersFile();
  const byPath = Object.fromEntries(rules.map((r) => [r.path, r.headers]));

  assert.ok(byPath['/sitemap.xml'], 'sitemap cache rule removed');
  assert.match(byPath['/sitemap.xml']['Content-Type'], /application\/xml/);
  assert.ok(byPath['/robots.txt'], 'robots cache rule removed');
  assert.match(byPath['/robots.txt']['Content-Type'], /text\/plain/);
});

// --------------------------------------------------------------------------
// Manifest
// --------------------------------------------------------------------------

test('web manifest references real icons and real names', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'favicon', 'site.webmanifest'), 'utf8'));

  assert.equal(manifest.name, 'Move Out Japan');
  assert.equal(manifest.short_name, 'Move Out Japan');
  assert.ok(!/MyWebSite|MySite/.test(manifest.name + manifest.short_name), 'placeholder names must be gone');

  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    const full = path.join(ROOT, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(full), `manifest icon missing: ${icon.src}`);
  }

  assert.ok(manifest.start_url, 'start_url is required');
  assert.equal(manifest.start_url, '/');
  assert.ok(manifest.scope, 'scope is required');
});

test('every referenced favicon asset exists', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])
    .filter((h) => h.startsWith('/favicon/'));

  assert.ok(hrefs.length >= 4, 'expected several favicon links');
  for (const h of hrefs) {
    const full = path.join(ROOT, h.replace(/^\//, ''));
    assert.ok(fs.existsSync(full), `favicon asset missing: ${h}`);
  }
});

// --------------------------------------------------------------------------
// Forms
// --------------------------------------------------------------------------

test('both quote forms ship with matching markup', () => {
  for (const file of ['index.html', 'contact.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');

    assert.match(html, /<form id="priceCheckForm"/, `${file}: form missing`);
    assert.match(html, /novalidate/, `${file}: novalidate expected (custom inline validation)`);
    assert.match(html, /method="post"/, `${file}: method=post prevents PII in URLs without JS`);

    // Length limits in markup must match quote-form.js LIMITS.
    assert.match(html, /id="name"[^>]*maxlength="100"/, `${file}: name maxlength`);
    assert.match(html, /id="email"[^>]*maxlength="254"/, `${file}: email maxlength`);
    assert.match(html, /id="items"[^>]*maxlength="2000"/, `${file}: items maxlength`);

    // Accessible error plumbing.
    assert.match(html, /id="formStatus"[^>]*role="alert"/, `${file}: live region missing`);
    assert.match(html, /id="errorMessage"/, `${file}: failure message target missing`);
    assert.match(html, /id="confirmationNote"[^>]*display:none/, `${file}: confirmation claim must be conditional`);

    // The privacy notice must be reachable from the form.
    assert.match(html, /href="\/privacy"/, `${file}: privacy link missing`);

    // The core must load before main.js.
    const qf = html.indexOf('/assets/js/quote-form.js');
    const main = html.indexOf('/assets/js/main.js');
    assert.ok(qf !== -1, `${file}: quote-form.js not loaded`);
    assert.ok(main !== -1, `${file}: main.js not loaded`);
    assert.ok(qf < main, `${file}: quote-form.js must load before main.js`);
  }
});

test('the confirmation email claim exists in both success panels', () => {
  for (const file of ['index.html', 'contact.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(html, /<p id="confirmationNote"/, `${file}: confirmationNote element missing`);
    // The unconditional claim must be gone.
    assert.ok(
      !/<p[^>]*>.*A confirmation email has been sent to your inbox\./.test(html.replace(/<p id="confirmationNote"[^>]*>/, '')),
      `${file}: found an unconditional confirmation-email claim`
    );
  }
});
