'use strict';

/**
 * FormSubmit configuration gate.
 *
 * The quote form used to deliver through EmailJS, which failed for real
 * visitors. This suite pins the parts of the new FormSubmit integration that
 * cannot be exercised in Node: the documented endpoint, the hidden control
 * fields, the Reply-To mapping, the honeypot, CAPTCHA staying enabled, and the
 * privacy notice. All behaviour in quote-form.js is tested with mocks in
 * quote-form.test.js; no test here sends anything.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const main = read('assets/js/main.js');
const contact = read('contact.html');
const privacy = read('privacy.html');

function collect(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'tests') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else out.push(full);
  }
  return out;
}

test('the documented FormSubmit endpoints are used', () => {
  assert.ok(main.includes('https://formsubmit.co/ajax/'));
  assert.ok(/const FORMSUBMIT_EMAIL = 'bistadinesh642@gmail\.com'/.test(main),
    'the registered FormSubmit recipient must be set');
  assert.ok(/FORMSUBMIT_ENDPOINT\s*=\s*'https:\/\/formsubmit\.co\/ajax\/' \+ FORMSUBMIT_EMAIL/.test(main),
    'AJAX endpoint must use the registered FormSubmit recipient, not the fallback contact address');
  assert.match(contact, /action="https:\/\/formsubmit\.co\/bistadinesh642@gmail\.com"/,
    'native fallback must post to the standard FormSubmit endpoint');
  assert.match(contact, /method="post"/);

  // The receiving address is public by design; no token or key is committed.
  assert.ok(!/api[_-]?key|client[_-]?secret|BEGIN (?:RSA |EC )?PRIVATE KEY/i.test(main + contact));
});

test('payload carries the visitor email as Reply-To, subject and all form context', () => {
  assert.match(main, /_replyto:\s*values\.email/, 'Reply-To must use the validated email');
  assert.match(main, /_subject:\s*FORMSUBMIT_SUBJECT/);
  assert.match(main, /FORMSUBMIT_SUBJECT\s*=\s*'[^']+quote request'/i, 'subject must describe a quote request');
  assert.match(main, /submission_type:\s*SUBMISSION_TYPE/);
  assert.match(main, /source_page:\s*typeof window/);
  assert.match(main, /submission_date:\s*new Date\(\)/);
  assert.match(main, /name:\s*values\.name/);
  assert.match(main, /email:\s*values\.email/);
  assert.match(main, /location:\s*values\.location/);
  assert.match(main, /items:\s*values\.items/);

  assert.match(contact, /name="_subject" value="[^"]+"/);
  assert.match(contact, /name="submission_type" value="Quote request"/);
  assert.match(contact, /name="source_page" value="\/contact"/);
});

test('honeypot is present and CAPTCHA is not disabled', () => {
  assert.match(contact, /name="_honey"/, 'FormSubmit honeypot missing');
  assert.match(contact, /class="hp-field"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="hp-field"/,
    'honeypot must be hidden from assistive tech');
  assert.match(main, /_honey:\s*''/, 'the outgoing honeypot value must be empty');
  assert.match(main, /function honeypotFilled\(\)/);

  const allText = collect().filter((f) => /\.(html|js)$/.test(f))
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/_captcha['"]?\s*[:=]\s*['"]?false/i.test(allText),
    'do not disable FormSubmit CAPTCHA');
});

test('EmailJS is fully removed from the site', () => {
  const htmlFiles = collect().filter((f) => f.endsWith('.html'));
  for (const file of htmlFiles) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/emailjs/i.test(src), `${path.relative(ROOT, file)} still references EmailJS`);
    assert.ok(!/cdn\.jsdelivr\.net\/npm\/@emailjs/.test(src),
      `${path.relative(ROOT, file)} still loads the EmailJS client`);
  }
  assert.ok(!/emailjs/i.test(main), 'main.js still contains EmailJS code');
  assert.ok(!/emailjs/i.test(privacy), 'privacy notice still describes EmailJS');
});

test('privacy notice describes FormSubmit and its policy', () => {
  assert.match(privacy, /FormSubmit/);
  assert.match(privacy, /https:\/\/formsubmit\.co\/privacy\.pdf/);
  assert.match(privacy, /Reply-To/i);
  assert.match(privacy, /Last updated: 20 November 2026/);
});

test('mailto fallback stays available and includes submission context', () => {
  assert.match(contact, /id="emailFallback"[^>]*href="mailto:/);
  assert.match(main, /function buildMailtoFallback\(values\)/);
  assert.match(main, /'Submission type: ' \+ SUBMISSION_TYPE/);
  assert.match(main, /'Source page: '/);
  assert.match(main, /showFailure\(info\.userMessage, readFormValues\(form\)\)/,
    'failures must surface the error message and keep the form visible');
  assert.ok(!/catch \(err\) \{[\s\S]{0,200}showSuccess\(/.test(main),
    'the error branch must never display success');
});
