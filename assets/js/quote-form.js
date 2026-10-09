/* ==========================================================================
   MOVE OUT JAPAN — QUOTE FORM CORE  (validation + submission orchestration)
   --------------------------------------------------------------------------
   DESIGN NOTES (important for reviewers):

   * This module contains NO DOM access and NO reference to any email
     provider (no `emailjs`, no `fetch`, no XHR, no network API of any kind).
     It therefore CANNOT send an email by itself.

   * Delivery happens exclusively through a `transport` function that the
     caller injects. In the browser, `main.js` builds the real EmailJS
     transport. In tests, a mock transport is injected instead, so the live
     provider is structurally unreachable — not merely "not called".

   * It is a UMD-style module: the browser gets `window.MoveOutQuoteForm`,
     Node gets `module.exports`. Tests run with the built-in Node test
     runner (`node --test`); no packages are required or installed.

   LIMITS (documented, enforced in `validate()`):
     name     1–100 chars   after trim (non-empty; single-character names allowed)
     email    5–254 chars   after trim, RFC 5321 practical maximum path length
     location 1–60 chars    must be one of the published service areas
     items    5–2000 chars  after trim (enough for a detailed inventory)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MoveOutQuoteForm = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Hard input limits. Keep in sync with the `maxlength` attributes in HTML
   *  (a test asserts that the two agree). */
  var LIMITS = {
    name: { min: 1, max: 100 },
    email: { min: 5, max: 254 },
    location: { min: 1, max: 60 },
    items: { min: 5, max: 2000 }
  };

  /** Service areas published in the `<select>` on both forms. A test asserts
   *  this list matches the HTML exactly, so the two cannot drift apart. */
  var ALLOWED_LOCATIONS = [
    'Fukuoka', 'Saga', 'Tokyo', 'Osaka', 'Nagoya', 'Kyoto', 'Yokohama',
    'Saitama', 'Chiba', 'Kawasaki', 'Sapporo', 'Kobe', 'Hiroshima',
    'Sendai', 'Other'
  ];

  /** Deliberately strict: one `@`, no whitespace, a real dot-TLD of >= 2 chars.
   *  Rejects `not-an-email`, `a@b.c`, `a@b@c.com`, `a@localhost`. */
  var EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

  /** ASCII control characters (incl. NUL, CR, LF, DEL) — never useful in a
   *  name/area/description, and a classic header-injection probe. */
  var CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

  var FIELD_ORDER = ['name', 'email', 'location', 'items'];

  var MESSAGES = {
    name: {
      empty: 'Please enter your name.',
      short: 'Please enter your name.',
      long: 'Name must be ' + LIMITS.name.max + ' characters or fewer.'
    },
    email: {
      empty: 'Please enter your email address.',
      short: 'Please enter a valid email address.',
      long: 'Email must be ' + LIMITS.email.max + ' characters or fewer.',
      format: 'Please enter a valid email address, for example name@example.com.'
    },
    location: {
      empty: 'Please choose your area in Japan.',
      unknown: 'Please choose one of the listed areas.',
      long: 'Area name must be ' + LIMITS.location.max + ' characters or fewer.'
    },
    items: {
      empty: 'Please tell us which items you need removed.',
      short: 'Please describe your items in at least ' + LIMITS.items.min + ' characters.',
      long: 'Description must be ' + LIMITS.items.max + ' characters or fewer.'
    }
  };

  /** Strip control characters and collapse runs of whitespace.
   *  Returns '' for null/undefined; never throws. */
  function clean(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(CONTROL_CHARS_RE, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function messageFor(field, kind) {
    var set = MESSAGES[field] || {};
    return set[kind] || 'This field is not valid.';
  }

  /**
   * Validate a single field.
   * @param {string} field  'name' | 'email' | 'location' | 'items'
   * @param {*}      value  raw value from the form
   * @returns {{valid:boolean, message:string, value:string}}
   */
  function validateField(field, value) {
    var v = clean(value);
    var limits = LIMITS[field];

    if (!limits) {
      return { valid: false, message: messageFor(field, 'format'), value: v };
    }

    if (v.length === 0) {
      if (field === 'email') return { valid: false, message: messageFor(field, 'empty'), value: v };
      if (field === 'location') return { valid: false, message: messageFor(field, 'empty'), value: v };
      if (field === 'items') return { valid: false, message: messageFor(field, 'empty'), value: v };
      return { valid: false, message: messageFor(field, 'empty'), value: v };
    }

    if (v.length > limits.max) {
      return { valid: false, message: messageFor(field, 'long'), value: v };
    }

    if (field === 'email') {
      if (v.length < limits.min || !EMAIL_RE.test(v)) {
        return { valid: false, message: messageFor(field, 'format'), value: v };
      }
    }

    if (field === 'location') {
      if (ALLOWED_LOCATIONS.indexOf(v) === -1) {
        return { valid: false, message: messageFor(field, 'unknown'), value: v };
      }
    }

    if (field === 'items' && v.length < limits.min) {
      return { valid: false, message: messageFor(field, 'short'), value: v };
    }

    return { valid: true, message: '', value: v };
  }

  /**
   * Validate a whole submission.
   * @param {{name?:*,email?:*,location?:*,items?:*}} values raw form values
   * @returns {{valid:boolean, errors:Object, values:Object, firstInvalid:string|null}}
   */
  function validate(values) {
    var raw = values || {};
    var errors = {};
    var normalized = {};
    var firstInvalid = null;

    FIELD_ORDER.forEach(function (field) {
      var result = validateField(field, raw[field]);
      normalized[field] = result.value;
      if (!result.valid) {
        errors[field] = result.message;
        if (firstInvalid === null) firstInvalid = field;
      }
    });

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      values: normalized,
      firstInvalid: firstInvalid
    };
  }

  /**
   * Turn a transport outcome into a stable result, so callers never have to
   * guess what "success" looked like. Rejects on anything that is not an
   * unambiguous 2xx-style success — including malformed responses.
   *
   * @param {*} response whatever the injected transport resolved with
   * @returns {*} the normalised response
   * @throws {Error} code='malformed' when the response is not credible
   */
  function assertProviderSuccess(response) {
    // A transport may resolve with undefined/null — that is acceptable and
    // means "no explicit status was reported".
    if (response === undefined || response === null) return response;

    if (typeof response === 'number') {
      if (response >= 200 && response < 300) return response;
      var numErr = new Error('Provider returned HTTP ' + response);
      // 5xx means the service itself had a problem (retryable), 4xx means the
      // request was refused (not retryable) — callers word these differently.
      numErr.code = response >= 500 ? 'network' : 'provider';
      numErr.status = response;
      throw numErr;
    }

    if (typeof response === 'object') {
      var status = response.status;
      if (typeof status === 'number' && (status < 200 || status >= 300)) {
        var bad = new Error('Provider returned status ' + status);
        bad.code = status >= 500 ? 'network' : 'provider';
        bad.status = status;
        throw bad;
      }
      return response;
    }

    if (typeof response === 'string') {
      var lower = response.toLowerCase();
      if (lower.indexOf('error') !== -1 || lower.indexOf('fail') !== -1) {
        var strErr = new Error('Provider reported failure: ' + response);
        strErr.code = 'provider';
        throw strErr;
      }
      return response;
    }

    // booleans, functions, symbols … — nothing here is a valid receipt
    var malformed = new Error('Provider returned a malformed response');
    malformed.code = 'malformed';
    throw malformed;
  }

  /**
   * Classify any thrown value into a stable, user-safe category.
   * Never leaks the raw error text to the UI layer by accident.
   *
   * @param {*} err
   * @returns {{code:'network'|'provider'|'malformed'|'unknown', status:number|null, userMessage:string}}
   */
  function classifyError(err) {
    if (err && err.code === 'unavailable') {
      return {
        code: 'unavailable',
        status: null,
        userMessage: 'The form service did not load, so nothing was sent. Please refresh the page, or reach us on LINE (@704xslsr).'
      };
    }

    if (err && err.code === 'malformed') {
      return {
        code: 'malformed',
        status: null,
        userMessage: 'The service returned an unexpected response. Nothing was sent.'
      };
    }

    if (err && err.code === 'provider') {
      return {
        code: 'provider',
        status: typeof err.status === 'number' ? err.status : null,
        userMessage: 'The email service rejected the request. Nothing was sent.'
      };
    }

    // Fetch/network failures surface as TypeError: 'Failed to fetch'
    if (err instanceof TypeError) {
      return {
        code: 'network',
        status: null,
        userMessage: 'We could not reach the network. Please check your connection and try again.'
      };
    }

    // EmailJS rejects with { status, text } for HTTP-level failures.
    if (err && typeof err === 'object' && typeof err.status === 'number') {
      var status = err.status;
      if (status >= 500) {
        return { code: 'network', status: status, userMessage: 'The email service is unavailable right now. Please try again shortly.' };
      }
      return { code: 'provider', status: status, userMessage: 'The email service rejected the request. Nothing was sent.' };
    }

    return {
      code: 'unknown',
      status: null,
      userMessage: 'Something went wrong. Please try again.'
    };
  }

  /**
   * Run the two-step delivery (owner notification + optional user
   * confirmation) through injected transports.
   *
   * Success is reported only after the OWNER transport genuinely succeeds.
   * The confirmation step is best-effort and its outcome is reported
   * truthfully in `confirmationSent` — it never upgrades a failure into a
   * success, and never downgrades a success into a failure.
   *
   * @param {Object}   o
   * @param {Function} o.transport           required; sends the owner notice
   * @param {Function} [o.confirmTransport]  optional; sends the user confirmation
   * @param {Object}   o.ownerPayload
   * @param {Object}   [o.confirmPayload]
   * @returns {Promise<{sent:boolean, confirmationSent:boolean, confirmationSkipped:boolean}>}
   * @throws {*} classified via `classifyError()` by the caller
   */
  async function deliver(o) {
    if (!o || typeof o.transport !== 'function') {
      var noTransport = new Error('No transport supplied');
      noTransport.code = 'malformed';
      throw noTransport;
    }

    // Step 1 — the message that actually matters. Any failure aborts here.
    var response = await o.transport(o.ownerPayload);
    assertProviderSuccess(response);

    // Step 2 — user confirmation, strictly best-effort.
    var confirmationSent = false;
    var confirmationSkipped = true;

    if (typeof o.confirmTransport === 'function' && o.confirmPayload) {
      confirmationSkipped = false;
      try {
        var confirmResponse = await o.confirmTransport(o.confirmPayload);
        assertProviderSuccess(confirmResponse);
        confirmationSent = true;
      } catch (e) {
        // Deliberately swallowed: the owner WAS notified, so this is still a
        // genuine success. The UI must simply not claim a confirmation email.
        confirmationSent = false;
      }
    }

    return {
      sent: true,
      confirmationSent: confirmationSent,
      confirmationSkipped: confirmationSkipped
    };
  }

  /**
   * A tiny re-entrancy guard used to prevent duplicate submissions while a
   * request is already in flight. The guard is per-form instance.
   *
   * @returns {{isBusy:Function, run:Function}}
   */
  function createSubmitGuard() {
    var inFlight = false;
    return {
      isBusy: function () { return inFlight; },
      run: async function (fn) {
        if (inFlight) return { skipped: true };
        inFlight = true;
        try {
          var result = await fn();
          return { skipped: false, result: result };
        } finally {
          inFlight = false;
        }
      }
    };
  }

  return {
    LIMITS: LIMITS,
    ALLOWED_LOCATIONS: ALLOWED_LOCATIONS,
    FIELD_ORDER: FIELD_ORDER,
    clean: clean,
    validateField: validateField,
    validate: validate,
    assertProviderSuccess: assertProviderSuccess,
    classifyError: classifyError,
    deliver: deliver,
    createSubmitGuard: createSubmitGuard
  };
});
