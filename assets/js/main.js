/* ============================================
   MOVE OUT JAPAN - MAIN JAVASCRIPT v3.0
   Fixed: All internal links now use .html extension
   for consistency with sitemap.xml and canonical URLs
   ============================================ */

// ========== BLOG DATA STORE ==========
// Add new posts here - they auto-appear everywhere!
//
// REPAIR NOTE: this catalogue previously advertised 10 articles. Only
// `how-to-dispose-furniture-japan` had ever existed as real content in this
// repository (verified across every commit in git history). The other nine
// entries linked to files that were either never created or were committed
// as 0-byte placeholders, so they rendered as blank pages or silently
// returned the homepage. Unpublished entries have been removed rather than
// replaced with invented articles.
//
// UPDATE: `moving-out-checklist-japan` was added as a new, genuinely written
// article — it is not a restoration of any of the nine unpublished entries.
//
// IMPORTANT: `slug` must match a real file at /blog/posts/<slug>.html.
// `tests/blog.test.js` enforces this — do not add an entry without a file.
const BLOG_POSTS = [
  {
    slug: 'moving-out-checklist-japan',
    title: 'The Complete Moving Out Checklist in Japan for Foreigners',
    excerpt: 'From contract review to key return — a practical, ordered moving-out checklist for foreign residents in Japan.',
    category: 'Moving Out',
    date: '2026-10-09',
    image: '/favicon/web-app-manifest-512x512.png'
  },
  {
    slug: 'how-to-dispose-furniture-japan',
    title: 'How to Dispose of Furniture in Japan Legally and Affordably',
    excerpt: 'Navigating Japan\'s complex waste disposal laws is hard. Our guide for foreigners simplifies large-item disposal.',
    category: 'Furniture Disposal',
    date: '2024-01-10',
    image: '/favicon/web-app-manifest-512x512.png'
  }
];

// ========== HEADER INJECTION ==========
function loadHeader() {
  const headerContainer = document.getElementById('site-header');
  if (!headerContainer) return;
  
  const currentPath = window.location.pathname;
  
  const headerHTML = `
    <header>
      <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="container nav-container">
          <a href="/" class="nav-logo" aria-label="Move Out Japan Home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Move Out Japan
          </a>
          <button class="hamburger" onclick="toggleMenu()" aria-label="Toggle menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
          <div class="nav-links" id="navLinks" role="menubar">
            <a href="/pages/how-it-works" role="menuitem" class="${currentPath.includes('/how-it-works') ? 'active' : ''}">How It Works</a>
            <a href="/pages/services" role="menuitem" class="${currentPath.includes('/services') ? 'active' : ''}">Services</a>
            <a href="/pages/pricing" role="menuitem" class="${currentPath.includes('/pricing') ? 'active' : ''}">Pricing</a>
            <a href="/pages/faq" role="menuitem" class="${currentPath.includes('/faq') ? 'active' : ''}">FAQ</a>
            <a href="/blog" role="menuitem" class="${currentPath.includes('/blog') ? 'active' : ''}">Blog</a>
            <a href="/contact" class="nav-cta" role="menuitem">Get Free Quote</a>
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
  
  const footerHTML = `
    <footer role="contentinfo">
      <div class="container">
        <p>📧 bistadinesh642@gmail.com &nbsp;|&nbsp; 📱 LINE: @704xslsr</p>
        <p style="font-size:0.9rem; margin-top:8px;">💳 PayPay · Bank Transfer · LINE Pay · Cash</p>
        <nav aria-label="Footer navigation" class="footer-nav">
          <a href="/">Home</a>
          <a href="/pages/how-it-works">How It Works</a>
          <a href="/pages/services">Services</a>
          <a href="/pages/pricing">Pricing</a>
          <a href="/pages/faq">FAQ</a>
          <a href="/blog">Blog</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/sitemap">Sitemap</a>
          <a href="/sitemap.xml">XML</a>
        </nav>
        <p class="footer-copyright">© 2024 Move Out Japan — Foreigner-friendly furniture disposal & moving support in Japan</p>
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
  
  navLinks.classList.toggle('active');
  hamburger.setAttribute('aria-expanded', navLinks.classList.contains('active'));
}

// ========== FAQ TOGGLE ==========
function toggleFAQ(element) {
  const item = element.parentElement;
  const isOpen = item.classList.contains('open');
  
  // Close all other FAQs
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
// REPAIR NOTES (Phase 2)
// ----------------------
// * The form carries `novalidate` on purpose. Removing it would make the
//   browser show its own blocking bubbles and would fire no `submit` event,
//   which prevents the accessible inline errors this fix adds. Validation is
//   therefore performed explicitly inside `handleSubmit()` using the pure
//   rules in quote-form.js (`required`, format, length, safe-input).
// * Client-side validation is a UX guardrail, NOT a security boundary. The
//   email provider is called straight from the browser with a public key, so
//   a determined caller can bypass this page entirely. That limitation is
//   documented in the repair report; closing it needs a server-side relay.
// * The ONLY code path that can reach the provider lives in
//   `createOwnerTransport()` / `createConfirmTransport()` below. Tests inject
//   a mock instead, so no test can ever produce a real email.

const EMAILJS_CONFIG = {
  serviceId: 'service_sbebnme',
  ownerTemplateId: 'template_73vpqgp',
  confirmTemplateId: 'template_a6nc3t4',
  ownerEmail: 'bistadinesh642@gmail.com'
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
    reply_message: 'We received your request! We\'ll reply within 24 hours.\n\nThank you,\nMove Out Japan Team\n📱 LINE: @704xslsr',
    from_name: 'Move Out Japan'
  };
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

/** Keep the form and every entered value visible; surface what went wrong. */
function showFailure(message) {
  const form = document.getElementById('priceCheckForm');
  const successDiv = document.getElementById('formSuccess');
  const errorDiv = document.getElementById('formError');
  const errorText = document.getElementById('errorMessage');

  if (form) form.style.display = 'block';
  if (successDiv) successDiv.style.display = 'none';
  if (errorText) errorText.textContent = message || '';
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

async function handleSubmit(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const form = document.getElementById('priceCheckForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  if (!form || !submitBtn || !btnText) return false;

  // The validation core failed to load. We must NOT send anything we have
  // not been able to validate — tell the user honestly instead.
  if (typeof MoveOutQuoteForm === 'undefined') {
    showFailure('The form could not be initialised, so nothing was sent. Please refresh the page, or reach us on LINE (@704xslsr).');
    return false;
  }

  const guard = getSubmitGuard();

  // A second click while a request is already in flight: ignore it.
  if (guard.isBusy()) return false;

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
    showFailure(info.userMessage);
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

function createBlogCard(post) {
  // Canonical (extensionless) URL — Cloudflare Pages serves
  // /blog/posts/<slug> directly, so no 308 hop is needed.
  const href = `/blog/posts/${post.slug}`;
  return `
    <div class="card blog-card" onclick="window.location.href='${href}'" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='${href}'">
      <span class="blog-category">${post.category}</span>
      <span class="blog-date">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <h3>${post.title}</h3>
      <p>${post.excerpt}</p>
      <span class="blog-read-more">Read Article →</span>
    </div>
  `;
}

function loadBlogPreview() {
  const container = document.getElementById('blog-preview-container');
  if (!container) return;
  
  const preview = getSortedPosts().slice(0, 3);
  container.innerHTML = preview.map(createBlogCard).join('');
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
    : '<p class="text-center" style="grid-column:1/-1; padding:40px;">No articles found. Try a different search term.</p>';
}

// ========== ACTIVE NAV HIGHLIGHT ==========
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === '/') {
      if (currentPath === '/' || currentPath === '/index.html') {
        link.classList.add('active');
      }
    } else if (href && currentPath.includes(href.replace('/pages/', '/'))) {
      link.classList.add('active');
    }
  });
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
  // Initialize EmailJS only on pages that actually have a form to submit.
  // Initialising it elsewhere produced "emailjs is not defined" console
  // errors on 7 of 9 pages, and a page without a form has no reason to
  // contact the provider at all.
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
  loadBlogPreview();
  loadBlogListing();
  
  // Set active nav
  setActiveNavLink();
  
  // Close mobile menu on link click
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-links a')) {
      const navLinks = document.getElementById('navLinks');
      const hamburger = document.querySelector('.hamburger');
      if (navLinks) navLinks.classList.remove('active');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    }
  });
  
  console.log('🏠 Move Out Japan - Ready to help foreigners in Japan!');
});
