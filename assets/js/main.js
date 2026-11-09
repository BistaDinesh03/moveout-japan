/* ============================================
   MOVE OUT JAPAN - MAIN JAVASCRIPT
   Shared header/footer, blog catalogue, form orchestration.
   ============================================ */

// ========== BLOG DATA STORE ==========
// Add new posts here - they auto-appear everywhere.
//
// IMPORTANT: `slug` must match a real file at /blog/posts/<slug>.html.
// `tests/blog.test.js` enforces this — do not add an entry without a file.
const BLOG_POSTS = [
  {
    slug: 'partner-with-move-out-japan',
    title: 'Partner With Move Out Japan: Referrals, Content and Service Collaborations',
    excerpt: 'How partnership enquiries work, what we assess, what we will and will not publish, and how affiliate or sponsored links are disclosed.',
    category: 'Partnerships',
    date: '2026-11-08',
    image: '/assets/images/brand/move-out-japan-social.png'
  },
  {
    slug: 'rental-deposit-deductions-japan',
    title: 'Rental Deposit Deductions in Japan: What Landlords Can and Cannot Charge',
    excerpt: 'Normal wear vs damage, special clauses, cleaning fees, inspection signatures and itemised statements — a source-based guide to shikikin deductions.',
    category: 'Moving Out',
    date: '2026-10-23',
    image: '/assets/images/brand/move-out-japan-social.png'
  },
  {
    slug: 'leaving-japan-administrative-checklist',
    title: 'Moving Out of Japan: The Administrative Checklist Foreigners Often Miss',
    excerpt: 'Mail forwarding, tax, pension, health insurance, and municipal notifications — the official steps to handle before you leave Japan or move cities.',
    category: 'Moving Out',
    date: '2026-10-11',
    image: '/assets/images/brand/move-out-japan-social.png'
  },
  {
    slug: 'moving-out-checklist-japan',
    title: 'The Complete Moving Out Checklist in Japan for Foreigners',
    excerpt: 'From contract review to key return — a practical, ordered moving-out checklist for foreign residents in Japan.',
    category: 'Moving Out',
    date: '2026-10-09',
    image: '/assets/images/brand/move-out-japan-social.png'
  },
  {
    slug: 'how-to-dispose-furniture-japan',
    title: 'How to Dispose of Furniture in Japan Legally and Affordably',
    excerpt: 'Navigating Japan\'s complex waste disposal laws is hard. Our guide for foreigners simplifies large-item disposal.',
    category: 'Furniture Disposal',
    date: '2024-01-10',
    image: '/assets/images/brand/move-out-japan-social.png'
  }
];

// ========== PUBLIC CONTACT DETAILS ==========
const CONTACT_EMAIL = 'dineshbista123@outlook.com';
const GENERAL_SUBJECT = 'Move Out Japan - General Enquiry';

// ========== HEADER INJECTION ==========
function navActive(currentPath, href) {
  if (href === '/') return currentPath === '/' || currentPath === '/index.html';
  const clean = href.replace(/\/$/, '');
  return currentPath === clean || currentPath.startsWith(clean + '/');
}

function loadHeader() {
  const headerContainer = document.getElementById('site-header');
  if (!headerContainer) return;

  const currentPath = window.location.pathname;

  const headerHTML = `
    <header>
      <nav class="navbar" aria-label="Main navigation">
        <div class="container nav-container">
          <a href="/" class="nav-logo" aria-label="Move Out Japan home">
            <img src="/assets/images/brand/move-out-japan-logo.svg" alt="Move Out Japan" width="220" height="47">
          </a>
          <button class="hamburger" type="button" onclick="toggleMenu()" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
            <span></span><span></span><span></span>
          </button>
          <div class="nav-links" id="navLinks">
            <a href="/" class="${navActive(currentPath, '/') ? 'active' : ''}">Home</a>
            <a href="/blog/" class="${navActive(currentPath, '/blog') ? 'active' : ''}">Guides</a>
            <a href="/pages/services" class="${navActive(currentPath, '/pages/services') ? 'active' : ''}">Services</a>
            <a href="/pages/how-it-works" class="${navActive(currentPath, '/pages/how-it-works') ? 'active' : ''}">How It Works</a>
            <a href="/contact" class="${navActive(currentPath, '/contact') ? 'active' : ''}">Contact</a>
            <a href="/contact" class="nav-cta">Get in Touch</a>
          </div>
        </div>
      </nav>
    </header>
  `;

  headerContainer.innerHTML = headerHTML;
}

// ========== FOOTER INJECTION ==========
function loadFooter() {
  const footerContainer = document.getElementById('site-footer');
  if (!footerContainer) return;

  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(GENERAL_SUBJECT)}`;

  const footerHTML = `
    <footer role="contentinfo">
      <div class="container footer-grid">
        <div class="footer-brand">
          <a href="/" class="footer-logo" aria-label="Move Out Japan home">
            <img src="/assets/images/brand/move-out-japan-logo-light.svg" alt="Move Out Japan" width="220" height="47">
          </a>
          <p>Practical English-language guides and resources for moving, settling in, and managing everyday life in Japan.</p>
          <p class="footer-contact"><a href="${mailto}">${CONTACT_EMAIL}</a></p>
        </div>
        <nav class="footer-col" aria-label="Guides">
          <h2>Guides</h2>
          <a href="/blog/">All guides</a>
          <a href="/blog/posts/moving-out-checklist-japan">Moving out checklist</a>
          <a href="/blog/posts/how-to-dispose-furniture-japan">Furniture disposal</a>
          <a href="/blog/posts/rental-deposit-deductions-japan">Rental deposits</a>
          <a href="/blog/posts/leaving-japan-administrative-checklist">Leaving Japan</a>
        </nav>
        <nav class="footer-col" aria-label="Move Out Japan">
          <h2>Move Out Japan</h2>
          <a href="/pages/how-it-works">How it works</a>
          <a href="/pages/services">Services</a>
          <a href="/pages/pricing">Pricing</a>
          <a href="/pages/faq">FAQ</a>
          <a href="/partners">Partners</a>
        </nav>
        <nav class="footer-col" aria-label="Site information">
          <h2>Site information</h2>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/pages/affiliate-disclosure">Affiliate disclosure</a>
          <a href="/sitemap">Sitemap</a>
          <a href="https://line.me/ti/p/@704xslsr" target="_blank" rel="noopener noreferrer">LINE @704xslsr</a>
        </nav>
      </div>
      <div class="container footer-bottom">
        <p class="footer-copyright">© 2024–2026 Move Out Japan</p>
        <p class="footer-note">General guidance only. Confirm official requirements with the relevant Japanese authorities.</p>
      </div>
    </footer>
  `;

  footerContainer.innerHTML = footerHTML;
}

// ========== MOBILE MENU ==========
function toggleMenu() {
  const navLinks = document.getElementById('navLinks');
  const hamburger = document.querySelector('.hamburger');
  if (!navLinks || !hamburger) return;

  const open = navLinks.classList.toggle('active');
  hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

// ========== FAQ TOGGLE ==========
function toggleFAQ(element) {
  const item = element.parentElement;
  const isOpen = item.classList.contains('open');

  document.querySelectorAll('.faq-item.open').forEach(openItem => {
    if (openItem !== item) {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    }
  });

  item.classList.toggle('open');
  element.setAttribute('aria-expanded', !isOpen);
}

// ========== FORM HANDLING ==========
//
// REPAIR NOTES
// ------------
// * The form carries `novalidate` on purpose. Validation is performed
//   explicitly inside `handleSubmit()` using the pure rules in quote-form.js.
// * Client-side validation is a UX guardrail, NOT a security boundary. The
//   email provider is called straight from the browser with a public key.
// * The ONLY code path that can reach the provider lives in
//   `createOwnerTransport()` / `createConfirmTransport()` below. Tests inject
//   a mock instead, so no test can ever produce a real email.
// * The provider (EmailJS) can fail independently of this site. When it does,
//   the UI must say so and offer a pre-filled mailto fallback. It must never
//   display the success panel.

const EMAILJS_CONFIG = {
  serviceId: 'service_sbebnme',
  ownerTemplateId: 'template_73vpqgp',
  confirmTemplateId: 'template_a6nc3t4',
  ownerEmail: CONTACT_EMAIL
};

// Lazily created so that a failure to load quote-form.js cannot break the
// rest of main.js (header/footer injection, blog rendering, FAQ toggles).
let quoteSubmitGuard = null;
function getSubmitGuard() {
  if (!quoteSubmitGuard) quoteSubmitGuard = MoveOutQuoteForm.createSubmitGuard();
  return quoteSubmitGuard;
}

function emailJsReady() {
  return typeof emailjs !== 'undefined' &&
         emailjs !== null &&
         typeof emailjs.send === 'function';
}

/** Sends the quote to the site owner. This is one of exactly two places in
 *  the codebase that can transmit data. */
function createOwnerTransport() {
  return function (payload) {
    if (!emailJsReady()) {
      const e = new Error('EmailJS is not available on this page');
      e.code = 'unavailable';
      throw e;
    }
    return emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.ownerTemplateId, payload);
  };
}

/** Best-effort confirmation copy to the visitor. Failure here must never be
 *  reported to the user as "we did not receive your request". */
function createConfirmTransport() {
  return function (payload) {
    if (!emailJsReady()) {
      const e = new Error('EmailJS is not available on this page');
      e.code = 'unavailable';
      throw e;
    }
    return emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.confirmTemplateId, payload);
  };
}

function buildOwnerPayload(values) {
  return {
    to_email: EMAILJS_CONFIG.ownerEmail,
    from_name: values.name,
    from_email: values.email,
    location: values.location,
    items: values.items,
    submission_date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
    reply_to: values.email
  };
}

function buildConfirmPayload(values) {
  return {
    to_email: values.email,
    to_name: values.name,
    items: values.items,
    location: values.location,
    reply_message: 'We received your request! We\'ll get back to you with a quote and next steps.\n\nThank you,\nMove Out Japan Team\n📱 LINE: @704xslsr',
    from_name: 'Move Out Japan'
  };
}

/** Pre-filled direct-email fallback. Used when the provider fails so the
 *  visitor's message is never silently lost. */
function buildMailtoFallback(values) {
  const v = values || {};
  const lines = [
    'Name: ' + (v.name || ''),
    'Email: ' + (v.email || ''),
    'Area in Japan: ' + (v.location || ''),
    '',
    'Items to dispose:',
    (v.items || '')
  ];
  return 'mailto:' + CONTACT_EMAIL +
    '?subject=' + encodeURIComponent(GENERAL_SUBJECT) +
    '&body=' + encodeURIComponent(lines.join('\n'));
}

function readFormValues(form) {
  return {
    name: form.querySelector('#name') ? form.querySelector('#name').value : '',
    email: form.querySelector('#email') ? form.querySelector('#email').value : '',
    location: form.querySelector('#location') ? form.querySelector('#location').value : '',
    items: form.querySelector('#items') ? form.querySelector('#items').value : ''
  };
}

/** Attach/remove the inline message for one field, keeping ARIA wiring valid. */
function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const group = input.closest('.form-group');
  if (!group) return;

  let errEl = group.querySelector('.field-error');

  if (!message) {
    if (errEl) errEl.remove();
    input.removeAttribute('aria-invalid');
    const kept = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(id => id && id !== fieldId + '-error');
    if (kept.length) input.setAttribute('aria-describedby', kept.join(' '));
    else input.removeAttribute('aria-describedby');
    return;
  }

  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'field-error';
    errEl.id = fieldId + '-error';
    group.appendChild(errEl);
  }
  errEl.textContent = message;

  input.setAttribute('aria-invalid', 'true');
  const describedBy = (input.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(id => id && id !== errEl.id);
  describedBy.push(errEl.id);
  input.setAttribute('aria-describedby', describedBy.join(' '));
}

function renderFieldErrors(form, errors) {
  MoveOutQuoteForm.FIELD_ORDER.forEach(function (field) {
    setFieldError(field, errors && errors[field] ? errors[field] : '');
  });
}

/** Form-level live region. `role="alert"` means it is announced on update. */
function setFormStatus(message) {
  const statusEl = document.getElementById('formStatus');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.style.display = message ? 'block' : 'none';
}

function setBusy(form, busy, label) {
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  if (submitBtn) submitBtn.disabled = !!busy;
  if (btnText) btnText.textContent = label;
}

function showSuccess(result) {
  const form = document.getElementById('priceCheckForm');
  const successDiv = document.getElementById('formSuccess');
  const errorDiv = document.getElementById('formError');
  const note = document.getElementById('confirmationNote');

  if (form) form.style.display = 'none';
  if (errorDiv) errorDiv.style.display = 'none';
  setFormStatus('');
  if (successDiv) successDiv.style.display = 'block';

  // Only claim a confirmation email went out when it genuinely did.
  if (note) note.style.display = (result && result.confirmationSent) ? 'block' : 'none';
}

/** Keep the form and every entered value visible; surface what went wrong and
 *  offer a pre-filled direct email so the request can still reach us. */
function showFailure(message, values) {
  const form = document.getElementById('priceCheckForm');
  const successDiv = document.getElementById('formSuccess');
  const errorDiv = document.getElementById('formError');
  const errorText = document.getElementById('errorMessage');
  const fallback = document.getElementById('emailFallback');

  if (form) form.style.display = 'block';
  if (successDiv) successDiv.style.display = 'none';
  if (errorText) errorText.textContent = message || '';
  if (fallback) fallback.setAttribute('href', buildMailtoFallback(values));
  if (errorDiv) errorDiv.style.display = 'block';
  setFormStatus('');
}

function resetForm() {
  const form = document.getElementById('priceCheckForm');
  const successDiv = document.getElementById('formSuccess');
  const errorDiv = document.getElementById('formError');
  const note = document.getElementById('confirmationNote');

  if (form) form.style.display = 'block';
  if (successDiv) successDiv.style.display = 'none';
  if (errorDiv) errorDiv.style.display = 'none';
  if (note) note.style.display = 'none';

  renderFieldErrors(form, {});
  setFormStatus('');
  if (form) {
    ['name', 'email', 'location', 'items'].forEach(function (field) {
      const el = document.getElementById(field);
      if (el) el.removeAttribute('aria-invalid');
    });
  }

  setBusy(form, false, 'Send for Free Price Check');
}

function focusFirstInvalid(firstInvalid) {
  if (!firstInvalid) return;
  const el = document.getElementById(firstInvalid);
  if (el && typeof el.focus === 'function') el.focus();
}

/** Honeypot: a hidden field real people never fill in. */
function honeypotFilled() {
  const trap = document.getElementById('website');
  return !!(trap && trap.value);
}

async function handleSubmit(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const form = document.getElementById('priceCheckForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  if (!form || !submitBtn || !btnText) return false;

  // The validation core failed to load. We must NOT send anything we have
  // not been able to validate — tell the user honestly instead.
  if (typeof MoveOutQuoteForm === 'undefined') {
    showFailure('The form could not be initialised, so nothing was sent. Please refresh the page, or email us directly.', readFormValues(form));
    return false;
  }

  const guard = getSubmitGuard();

  // A second click while a request is already in flight: ignore it.
  if (guard.isBusy()) return false;

  if (honeypotFilled()) {
    showFailure('We could not process this submission. Please email us directly instead.', readFormValues(form));
    return false;
  }

  // 1. Pure validation — no network of any kind happens here.
  const check = MoveOutQuoteForm.validate(readFormValues(form));
  renderFieldErrors(form, check.errors);

  if (!check.valid) {
    const count = Object.keys(check.errors).length;
    setFormStatus(count === 1
      ? 'There is 1 problem with the form below. Nothing has been sent.'
      : 'There are ' + count + ' problems with the form below. Nothing has been sent.');
    showFailureSummaryOnly();
    focusFirstInvalid(check.firstInvalid);
    return false;
  }

  setFormStatus('');

  // 2. Delivery through injected transports (mocked in tests).
  setBusy(form, true, 'Sending…');

  try {
    const outcome = await guard.run(function () {
      return MoveOutQuoteForm.deliver({
        transport: createOwnerTransport(),
        confirmTransport: createConfirmTransport(),
        ownerPayload: buildOwnerPayload(check.values),
        confirmPayload: buildConfirmPayload(check.values)
      });
    });

    if (outcome.skipped) return false;   // a concurrent submit already owns this
    showSuccess(outcome.result);
  } catch (err) {
    console.error('Quote submission failed:', err);
    const info = MoveOutQuoteForm.classifyError(err);
    showFailure(info.userMessage, readFormValues(form));
  } finally {
    setBusy(form, false, 'Send for Free Price Check');
  }

  return false;
}

/** Validation problems are reported inline, so the dedicated failure panel
 *  (which is about *sending*) stays hidden. */
function showFailureSummaryOnly() {
  const errorDiv = document.getElementById('formError');
  const successDiv = document.getElementById('formSuccess');
  if (errorDiv) errorDiv.style.display = 'none';
  if (successDiv) successDiv.style.display = 'none';
}


// ========== BLOG FUNCTIONS ==========
function getSortedPosts() {
  return [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createBlogCard(post) {
  // Canonical (extensionless) URL — Cloudflare Pages serves
  // /blog/posts/<slug> directly, so no 308 hop is needed.
  const href = `/blog/posts/${post.slug}`;
  return `
    <a class="card blog-card" href="${href}">
      <span class="blog-category">${escapeHtml(post.category)}</span>
      <span class="blog-date">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <h2 class="heading-card">${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.excerpt)}</p>
      <span class="blog-read-more">Read article <span aria-hidden="true">→</span></span>
    </a>
  `;
}

function loadBlogListing() {
  const container = document.getElementById('blog-listing-container');
  if (!container) return;

  const posts = getSortedPosts();
  container.innerHTML = posts.map(createBlogCard).join('');
}

function searchBlog() {
  const query = document.getElementById('blogSearchInput')?.value.toLowerCase().trim() || '';
  const container = document.getElementById('blog-listing-container');
  if (!container) return;

  const filtered = BLOG_POSTS.filter(post =>
    post.title.toLowerCase().includes(query) ||
    post.excerpt.toLowerCase().includes(query) ||
    post.category.toLowerCase().includes(query)
  );

  container.innerHTML = filtered.length > 0
    ? filtered.map(createBlogCard).join('')
    : '<p class="text-center blog-empty" style="grid-column:1/-1; padding:40px;">No articles found. Try a different search term.</p>';
}

// ========== ACTIVE NAV HIGHLIGHT ==========
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && navActive(currentPath, href)) link.classList.add('active');
  });
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
  // Initialize EmailJS only on pages that actually have a form to submit.
  if (document.getElementById('priceCheckForm')) {
    if (typeof emailjs !== 'undefined' && emailjs && typeof emailjs.init === 'function') {
      try {
        emailjs.init('Hx0NbUvVMgUQ2odp_');
      } catch (e) {
        console.error('EmailJS init failed:', e);
      }
    }
  }

  // Load shared components
  loadHeader();
  loadFooter();

  // Load blog content
  loadBlogListing();

  // Set active nav
  setActiveNavLink();

  // Close mobile menu on link click
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-links a')) {
      const navLinks = document.getElementById('navLinks');
      const hamburger = document.querySelector('.hamburger');
      if (navLinks) navLinks.classList.remove('active');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      }
    }
  });

  // Close the mobile menu with Escape.
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const navLinks = document.getElementById('navLinks');
    const hamburger = document.querySelector('.hamburger');
    if (navLinks && navLinks.classList.contains('active')) {
      navLinks.classList.remove('active');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.focus();
      }
    }
  });

  console.log('🏠 Move Out Japan - Ready to help foreigners in Japan!');
});
