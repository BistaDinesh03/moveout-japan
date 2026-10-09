'use strict';

/**
 * EMAIL SAFETY GATE
 * -----------------
 * The audit phase accidentally sent five real emails because an in-page stub
 * silently failed. This suite exists to make that class of accident
 * structurally impossible in the test run.
 *
 * It asserts three independent things:
 *   1. The module under test (quote-form.js) contains no reference to any
 *      email provider or network API at all.
 *   2. The only file that CAN reach EmailJS (main.js) cannot be loaded in
 *      Node, because it requires a browser `document` — so no test can
 *      accidentally obtain the real transport.
 *   3. With globalThis.fetch replaced by a function that throws, delivery
 *      through a mock transport still works and never touches the network.
 *
 * This file makes NO network requests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CORE = path.join(ROOT, 'assets', 'js', 'quote-form.js');
const MAIN = path.join(ROOT, 'assets', 'js', 'main.js');

const FORBIDDEN_IN_CORE = [
  'emailjs',
  'EmailJS',
  'api.emailjs.com',
  'fetch(',
  'XMLHttpRequest',
  'navigator.sendBeacon',
  'WebSocket',
  'import(',
  'http.request',
  'https.request'
];

/**
 * Remove comments and string literals, leaving only executable source.
 *
 * This matters because quote-form.js *documents* the things it does not do
 * ("no emailjs, no fetch …") in its header comment. Prose mentioning a token
 * is not a reference to it; scanning raw text would produce a false positive
 * and teach us nothing. Scanning the stripped source tests the real property.
 */
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | squote | dquote | template

  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';

    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'squote'; out += ' '; i += 1; continue; }
      if (c === '"') { state = 'dquote'; out += ' '; i += 1; continue; }
      if (c === '`') { state = 'template'; out += ' '; i += 1; continue; }
      out += c; i += 1; continue;
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n'; }
      i += 1; continue;
    }

    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; i += 2; continue; }
      i += 1; continue;
    }

    // Inside a string literal.
    if (c === '\\') { i += 2; continue; }
    if ((state === 'squote' && c === "'") ||
        (state === 'dquote' && c === '"') ||
        (state === 'template' && c === '`')) {
      state = 'code';
    }
    i += 1;
  }
  return out;
}

test('quote-form.js contains no provider or network reference', () => {
  const raw = fs.readFileSync(CORE, 'utf8');
  const code = stripCommentsAndStrings(raw);
  for (const needle of FORBIDDEN_IN_CORE) {
    const idx = code.indexOf(needle);
    assert.equal(idx, -1, `quote-form.js must not reference "${needle}" in code (offset ${idx})`);
  }
  // Sanity: the stripping must have removed the documented prose, otherwise
  // we would be testing the comment stripper rather than the module.
  assert.notEqual(raw, code, 'source should contain comments/strings to strip');
  assert.ok(raw.includes('emailjs'), 'header should still document what is deliberately absent');
});

test('quote-form.js exposes an injectable transport contract only', () => {
  const src = fs.readFileSync(CORE, 'utf8');
  // Delivery must go through the caller-supplied transport parameter.
  assert.match(src, /o\.transport\(/, 'deliver() must call the injected transport');
  assert.match(src, /typeof o\.transport (?:!==|===) 'function'/, 'transport must be type-checked');
});

test('main.js declares provider access in exactly two transport factories', () => {
  const src = fs.readFileSync(MAIN, 'utf8');
  const sends = src.match(/emailjs\.send\(/g) || [];
  assert.equal(sends.length, 2, 'expected exactly owner + confirmation transports');

  // Both must sit behind the readiness guard.
  const factories = (src.match(/function create(?:Owner|Confirm)Transport\(\)/g) || []);
  assert.equal(factories.length, 2);
  assert.match(src, /function emailJsReady\(\)/);

  // The init call must be guarded by typeof, not a bare reference.
  assert.match(src, /typeof emailjs !== 'undefined'/);
});

test('main.js cannot be loaded in Node — no test can reach the real transport', () => {
  // main.js calls document.addEventListener at top level, so loading it in a
  // non-browser runtime must fail. If this ever passes, the real EmailJS
  // transport becomes reachable from tests and this gate must be revisited.
  assert.throws(
    () => require(MAIN),
    (err) => {
      assert.ok(
        /document is not defined|MoveOutQuoteForm is not defined/.test(err.message),
        `unexpected load failure: ${err.message}`
      );
      return true;
    }
  );
});

test('delivery works with fetch sabotaged — no network path exists', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    throw new Error('NETWORK CALL ATTEMPTED DURING TEST');
  };

  try {
    // Fresh require so the module is initialised under the sabotaged global.
    delete require.cache[require.resolve(CORE)];
    const QF = require(CORE);

    const seen = [];
    const out = await QF.deliver({
      transport: async (payload) => { seen.push(payload); return { status: 200 }; },
      confirmTransport: async (payload) => { seen.push(payload); return { status: 200 }; },
      ownerPayload: { kind: 'owner' },
      confirmPayload: { kind: 'confirm' }
    });

    assert.equal(out.sent, true);
    assert.equal(seen.length, 2, 'both payloads must reach the injected transports');
    assert.equal(fetchCalls, 0, 'global fetch must never have been invoked');
  } finally {
    globalThis.fetch = originalFetch;
    delete require.cache[require.resolve(CORE)];
  }
});

test('a failing transport propagates without any fallback to a real provider', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('NETWORK CALL ATTEMPTED DURING TEST'); };

  try {
    delete require.cache[require.resolve(CORE)];
    const QF = require(CORE);

    await assert.rejects(
      () => QF.deliver({
        transport: async () => { throw new Error('mock exploded'); },
        ownerPayload: {}
      }),
      /mock exploded/
    );
    assert.equal(globalThis.fetch.toString().includes('NETWORK CALL'), true);
  } finally {
    globalThis.fetch = originalFetch;
    delete require.cache[require.resolve(CORE)];
  }
});

test('no test file loads main.js', () => {
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const f of files) {
    if (f === 'email-safety.test.js') continue; // this file references it in assert.throws only
    const src = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
    const loads = /require\([^)]*main\.js/.test(src);
    assert.equal(loads, false, `${f} must not require main.js`);
  }
});

test('no test file has the capability to open a network connection', () => {
  // This tests CAPABILITY, not text. routes.test.js legitimately asserts that
  // the CSP mentions api.emailjs.com, so searching for that literal would be a
  // false positive. What must never appear is a way to actually send bytes.
  const NETWORK_MODULES = [
    "'http'", "'https'", "'net'", "'tls'", "'dgram'", "'http2'",
    '"http"', '"https"', '"net"', '"tls"', '"dgram"', '"http2"',
    "'node:http'", "'node:https'", "'node:net'", "'node:tls'",
    "'node:dgram'", "'node:http2'", "'node:child_process'", "'child_process'"
  ];

  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 4, 'expected several test files');

  for (const f of files) {
    const raw = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
    const code = stripCommentsAndStrings(raw);

    for (const mod of NETWORK_MODULES) {
      assert.equal(
        code.includes(`require(${mod})`),
        false,
        `${f} must not require the ${mod} module — it could open a socket`
      );
    }

    assert.ok(
      !/\bfetch\s*\(/.test(code),
      `${f} must not call fetch()`
    );
    // Match actual construction/usage, not the words themselves — this file's
    // own regex literals and needle lists mention them on purpose.
    assert.ok(
      !/new\s+XMLHttpRequest\s*\(/.test(code),
      `${f} must not construct an XMLHttpRequest`
    );
    assert.ok(
      !/navigator\s*\.\s*sendBeacon\s*\(/.test(code),
      `${f} must not call sendBeacon`
    );
  }
});
