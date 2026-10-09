'use strict';

/**
 * Validation + delivery tests for assets/js/quote-form.js
 *
 * EMAIL SAFETY: every test in this file injects a mock transport. The module
 * under test contains no reference to any email provider or network API, so
 * no code path here can reach EmailJS. tests/email-safety.test.js asserts
 * that property independently.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const QF = require(path.join(__dirname, '..', 'assets', 'js', 'quote-form.js'));

const VALID = {
  name: 'Test User',
  email: 'tester@example.com',
  location: 'Fukuoka',
  items: 'A fridge, a desk and two chairs'
};

// --------------------------------------------------------------------------
// Field-level validation
// --------------------------------------------------------------------------

test('valid submission passes', () => {
  const r = QF.validate(VALID);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.deepEqual(r.errors, {});
  assert.equal(r.firstInvalid, null);
});

test('all fields missing are each reported', () => {
  const r = QF.validate({ name: '', email: '', location: '', items: '' });
  assert.equal(r.valid, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'items', 'location', 'name']);
  assert.equal(r.firstInvalid, 'name', 'firstInvalid must follow FIELD_ORDER');
});

test('whitespace-only values count as empty', () => {
  const r = QF.validate({ name: '   \t  ', email: '   ', location: '  ', items: '   ' });
  assert.equal(r.valid, false);
  assert.equal(r.values.name, '');
  assert.equal(r.values.items, '');
});

test('malformed emails are rejected', () => {
  const bad = [
    'not-an-email',
    'a@b.c',          // 1-char TLD
    'a@b@c.com',      // two @
    'a@localhost',    // no dot
    'no-at-sign.com',
    '@example.com',
    'user@',
    'user @example.com',
    '<img src=x onerror=alert(1)>'
  ];
  for (const email of bad) {
    const r = QF.validate({ ...VALID, email });
    assert.equal(r.valid, false, `should reject: ${email}`);
    assert.ok(r.errors.email, `expected email error for ${email}`);
  }
});

test('well-formed emails are accepted', () => {
  const good = ['a@b.co', 'user@example.com', 'first.last+tag@sub.domain.co.jp'];
  for (const email of good) {
    const r = QF.validate({ ...VALID, email });
    assert.equal(r.valid, true, `should accept: ${email} -> ${JSON.stringify(r.errors)}`);
  }
});

test('location must be one of the published service areas', () => {
  const r = QF.validate({ ...VALID, location: 'Atlantis' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.location);

  for (const loc of QF.ALLOWED_LOCATIONS) {
    const ok = QF.validate({ ...VALID, location: loc });
    assert.equal(ok.valid, true, `area should be accepted: ${loc}`);
  }
});

// --------------------------------------------------------------------------
// Boundary / length limits
// --------------------------------------------------------------------------

test('items: exact min and exact max pass, just outside fails', () => {
  assert.equal(QF.validate({ ...VALID, items: '12345' }).valid, true, 'min 5');
  assert.equal(QF.validate({ ...VALID, items: '1234' }).valid, false, '4 chars');

  assert.equal(QF.validate({ ...VALID, items: 'x'.repeat(2000) }).valid, true, 'max 2000');
  assert.equal(QF.validate({ ...VALID, items: 'x'.repeat(2001) }).valid, false, '2001 chars');
});

test('email: exact max 254 passes, 255 fails', () => {
  // Build an address of an exact total length using a real TLD.
  const make = (total) => {
    const tld = '.com';        // 4 chars
    const at = 1;              // 1 char
    const local = 'a';         // 1 char
    const domainLen = total - local.length - at - tld.length;
    return `${local}@${'b'.repeat(domainLen)}${tld}`;
  };

  assert.equal(make(254).length, 254, 'helper must produce a 254-char address');
  assert.equal(QF.validate({ ...VALID, email: make(254) }).valid, true, '254 chars is allowed');
  assert.equal(make(255).length, 255);
  assert.equal(QF.validate({ ...VALID, email: make(255) }).valid, false, '255 chars is too long');
});

test('name: single character is allowed, empty is not', () => {
  assert.equal(QF.validate({ ...VALID, name: 'A' }).valid, true);
  assert.equal(QF.validate({ ...VALID, name: '' }).valid, false);
  assert.equal(QF.validate({ ...VALID, name: 'x'.repeat(100) }).valid, true, 'max 100');
  assert.equal(QF.validate({ ...VALID, name: 'x'.repeat(101) }).valid, false, '101 chars');
});

// --------------------------------------------------------------------------
// Safe input handling
// --------------------------------------------------------------------------

test('control characters and repeated whitespace are normalised', () => {
  const r = QF.validate({ ...VALID, name: '  Ann\u0000e   \n  Lee  ' });
  assert.equal(r.valid, true);
  assert.equal(r.values.name, 'Ann e Lee');
  assert.ok(!/[\u0000-\u001F\u007F]/.test(r.values.name));
});

test('long input is reported, not silently truncated', () => {
  const r = QF.validate({ ...VALID, items: 'x'.repeat(5000) });
  assert.equal(r.valid, false);
  assert.ok(r.errors.items.includes('2000'));
  assert.equal(r.values.items.length, 5000, 'raw length preserved so the user can fix it');
});

test('missing / undefined input does not throw', () => {
  assert.doesNotThrow(() => QF.validate({}));
  assert.doesNotThrow(() => QF.validate(null));
  const r = QF.validate(undefined);
  assert.equal(r.valid, false);
});

test('validateField returns a stable shape', () => {
  const r = QF.validateField('email', 'nope');
  assert.deepEqual(Object.keys(r).sort(), ['message', 'valid', 'value']);
  assert.equal(r.valid, false);
  assert.equal(typeof r.message, 'string');
});

// --------------------------------------------------------------------------
// Delivery: mocked transports only
// --------------------------------------------------------------------------

test('delivery succeeds when both transports succeed', async () => {
  const calls = [];
  const out = await QF.deliver({
    transport: async (p) => { calls.push(['owner', p]); return { status: 200, text: 'OK' }; },
    confirmTransport: async (p) => { calls.push(['confirm', p]); return { status: 200, text: 'OK' }; },
    ownerPayload: { a: 1 },
    confirmPayload: { b: 2 }
  });
  assert.deepEqual(out, { sent: true, confirmationSent: true, confirmationSkipped: false });
  assert.equal(calls.length, 2);
});

test('owner failure aborts and is surfaced', async () => {
  await assert.rejects(
    () => QF.deliver({
      transport: async () => { const e = new Error('nope'); e.status = 422; throw e; },
      confirmTransport: async () => { throw new Error('must not be called'); },
      ownerPayload: {},
      confirmPayload: {}
    }),
    (err) => {
      const info = QF.classifyError(err);
      assert.equal(info.code, 'provider');
      assert.equal(info.status, 422);
      assert.match(info.userMessage, /Nothing was sent/);
      return true;
    }
  );
});

test('confirmation failure does NOT turn a real success into a failure', async () => {
  const out = await QF.deliver({
    transport: async () => ({ status: 200 }),
    confirmTransport: async () => { const e = new Error('template missing'); e.status = 422; throw e; },
    ownerPayload: {},
    confirmPayload: {}
  });
  // The owner WAS notified: this is a genuine success, but we must not claim
  // a confirmation email went out.
  assert.equal(out.sent, true);
  assert.equal(out.confirmationSent, false);
  assert.equal(out.confirmationSkipped, false);
});

test('no confirmation claim when the confirm step is not supplied', async () => {
  const out = await QF.deliver({ transport: async () => ({ status: 200 }), ownerPayload: {} });
  assert.equal(out.sent, true);
  assert.equal(out.confirmationSent, false);
  assert.equal(out.confirmationSkipped, true);
});

test('missing transport is a malformed error, not a silent success', async () => {
  await assert.rejects(
    () => QF.deliver({ ownerPayload: {} }),
    (err) => err.code === 'malformed'
  );
  await assert.rejects(
    () => QF.deliver({ transport: 'not-a-function', ownerPayload: {} }),
    (err) => err.code === 'malformed'
  );
});

// --------------------------------------------------------------------------
// Response-shape handling
// --------------------------------------------------------------------------

test('acceptable provider responses pass', () => {
  assert.doesNotThrow(() => QF.assertProviderSuccess(undefined));
  assert.doesNotThrow(() => QF.assertProviderSuccess(null));
  assert.doesNotThrow(() => QF.assertProviderSuccess(200));
  assert.doesNotThrow(() => QF.assertProviderSuccess({ status: 200, text: 'OK' }));
  assert.doesNotThrow(() => QF.assertProviderSuccess({ text: 'OK' }));
  assert.doesNotThrow(() => QF.assertProviderSuccess('OK'));
});

test('non-2xx responses are rejected', () => {
  assert.throws(() => QF.assertProviderSuccess(422), (e) => e.code === 'provider' && e.status === 422);
  assert.throws(() => QF.assertProviderSuccess({ status: 403 }), (e) => e.code === 'provider');
  assert.throws(() => QF.assertProviderSuccess('error: quota exceeded'), (e) => e.code === 'provider');
});

test('5xx is classified as a retryable service problem', () => {
  assert.throws(() => QF.assertProviderSuccess(503), (e) => e.code === 'network');
  assert.throws(() => QF.assertProviderSuccess({ status: 500 }), (e) => e.code === 'network');
  const info = QF.classifyError(Object.assign(new Error('x'), { code: 'network', status: 503 }));
  assert.equal(info.code, 'network');
  assert.match(info.userMessage, /unavailable|reach the network/i);
});

test('malformed responses are rejected rather than treated as success', () => {
  // Non-HTTP-shaped values are unusable as a receipt.
  assert.throws(() => QF.assertProviderSuccess(true), (e) => e.code === 'malformed');
  assert.throws(() => QF.assertProviderSuccess(false), (e) => e.code === 'malformed');
  assert.throws(() => QF.assertProviderSuccess(() => {}), (e) => e.code === 'malformed');
  assert.throws(() => QF.assertProviderSuccess(Symbol('x')), (e) => e.code === 'malformed');

  // An object with no usable status field is accepted (EmailJS often returns
  // just { text }); it is not treated as proof of success by the caller, but
  // it is also not an error shape worth rejecting.
  assert.doesNotThrow(() => QF.assertProviderSuccess({ unexpected: 'shape' }));
});

test('classifyError maps network, unavailable and unknown safely', () => {
  assert.equal(QF.classifyError(new TypeError('Failed to fetch')).code, 'network');
  assert.equal(QF.classifyError(Object.assign(new Error('x'), { code: 'unavailable' })).code, 'unavailable');
  assert.equal(QF.classifyError(new Error('boom')).code, 'unknown');
  const info = QF.classifyError(new Error('boom'));
  assert.ok(!info.userMessage.includes('boom'), 'raw error text must not leak to the UI');
});

// --------------------------------------------------------------------------
// Duplicate-submission guard
// --------------------------------------------------------------------------

test('guard blocks a second submission while one is in flight', async () => {
  const guard = QF.createSubmitGuard();
  let ran = 0;
  let release;
  const gate = new Promise((r) => { release = r; });

  const first = guard.run(async () => { ran++; await gate; return 'first'; });
  assert.equal(guard.isBusy(), true);

  const second = await guard.run(async () => { ran++; return 'second'; });
  assert.deepEqual(second, { skipped: true });
  assert.equal(ran, 1, 'second submission must not have executed');

  release();
  const firstResult = await first;
  assert.deepEqual(firstResult, { skipped: false, result: 'first' });

  assert.equal(guard.isBusy(), false, 'guard must be released after completion');
});

test('guard releases after a failure so the user can retry', async () => {
  const guard = QF.createSubmitGuard();
  await assert.rejects(() => guard.run(async () => { throw new Error('x'); }));
  assert.equal(guard.isBusy(), false);
  const retry = await guard.run(async () => 'ok');
  assert.deepEqual(retry, { skipped: false, result: 'ok' });
});

// --------------------------------------------------------------------------
// Published limits are actually enforced
// --------------------------------------------------------------------------

test('documented limits are internally consistent', () => {
  assert.deepEqual(QF.LIMITS, {
    name: { min: 1, max: 100 },
    email: { min: 5, max: 254 },
    location: { min: 1, max: 60 },
    items: { min: 5, max: 2000 }
  });
  assert.deepEqual(QF.FIELD_ORDER, ['name', 'email', 'location', 'items']);
});
