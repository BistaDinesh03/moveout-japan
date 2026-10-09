# 🏠 Move Out Japan

**English-speaking furniture disposal and moving support for foreigners in Japan.**

[![Website](https://img.shields.io/badge/website-moveoutjapan.pages.dev-111827?style=flat-square)](https://moveoutjapan.pages.dev)
[![Status](https://img.shields.io/badge/status-live-success?style=flat-square)](https://moveoutjapan.pages.dev)
[![License](https://img.shields.io/badge/license-private-red?style=flat-square)]()

---

## Table of Contents

- [About](#about)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [URL & Routing Rules](#url--routing-rules)
- [Contact Form Setup](#contact-form-setup)
- [Testing](#testing)
- [Local Preview](#local-preview)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Contact](#contact)

---

## About

Move Out Japan helps **international students, foreign workers, and expats** dispose of furniture and appliances legally and affordably when moving out in Japan.

### Why Foreigners Choose Us:

- 🗣️ **English communication** — no Japanese required
- ⚖️ **Legal disposal** — aligned with Japan's Home Appliance Recycling Law
- 💰 **Transparent pricing** — fixed quotes, no hidden fees
- 🚛 **Coverage** — Fukuoka, Saga, Tokyo, Osaka, Nagoya and other major cities
- ⚡ **Fast response** — quotes within 24 hours, pickup within 2–7 days

---

## Services

| Service | Description |
|---------|-------------|
| 🪑 Furniture Disposal | Legal disposal of beds, desks, chairs, sofas, tables, shelves |
| 🔌 Appliance Recycling | Fridges, washing machines, microwaves, TVs, AC units |
| 🏠 Apartment Clearing | Complete apartment clearing for move-out inspection |
| 📋 Move-Out Consultation | Utility cancellation guidance, deposit protection, checkout help |
| 📦 Packing Assistance | Help packing belongings for moving or shipping |
| 🗑️ Bulk Trash Disposal | Large quantities of mixed items handled efficiently |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (no framework, no bundler) |
| **Hosting** | Cloudflare Pages |
| **Fonts** | Google Fonts (Inter) |
| **Forms** | EmailJS (browser-side only) |
| **SEO** | Schema.org structured data, Open Graph, Twitter Cards |
| **Tests** | Node.js built-in test runner (`node --test`) — **no dependencies** |
| **Analytics** | **None.** No analytics or tracking of any kind is implemented. |

> **Correction:** an earlier version of this README claimed *Cloudflare Web
> Analytics*. No analytics script has ever existed in this repository. If
> analytics are added later, this table and `privacy.html` must both be
> updated.

---

## Architecture

This is a **fully static site**. There is no server runtime, no database, no
authentication, no build step, and no bundler.

Three things happen at runtime, all in the browser:

1. **Header/footer injection** — `assets/js/main.js` writes the shared
   navigation and footer into `<div id="site-header">` / `<div id="site-footer">`.
   *Consequence: without JavaScript there is no navigation or footer.*
2. **Client-side blog catalogue** — `BLOG_POSTS` in `main.js` drives the blog
   preview, listing, and search. Blog articles themselves are plain HTML files.
3. **Quote form** — `assets/js/quote-form.js` validates the input, then
   `main.js` delivers it through EmailJS to the owner's inbox.

### Two JavaScript modules

| File | Responsibility | Runs in Node? |
|------|----------------|---------------|
| `assets/js/quote-form.js` | Pure validation + submission orchestration. **Contains no DOM access and no reference to any email provider.** | Yes |
| `assets/js/main.js` | DOM behaviour, header/footer, blog rendering, EmailJS transports | No (needs `document`) |

`quote-form.js` deliberately cannot send an email on its own: delivery only
happens through a `transport` function that the caller injects. The browser
injects the real EmailJS transport; tests inject a mock. This is what makes the
test suite safe to run.

---

## Project Structure

```
moveout-japan/
├── index.html                 Homepage (hero, process, pricing, FAQ, quote form)
├── contact.html               Standalone quote form page  → /contact
├── privacy.html               Privacy notice              → /privacy
├── 404.html                   Not-found page (served with a real 404 status)
├── sitemap.html               Human-readable sitemap      → /sitemap
├── sitemap.xml                XML sitemap
├── robots.txt                 Allow-all + sitemap pointer
├── _headers                   Cloudflare Pages response headers (incl. CSP)
├── _redirects                 Cloudflare Pages rewrites for short URLs
├── google8ffd0ae5f931d1e6.html  Google Search Console verification
├── assets/
│   ├── css/style.css          Single stylesheet
│   └── js/
│       ├── quote-form.js      Validation + submission core (testable, pure)
│       └── main.js            All DOM behaviour
├── blog/
│   ├── index.html             Blog listing + client-side search
│   └── posts/
│       └── how-to-dispose-furniture-japan.html   (the only published article)
├── pages/                     how-it-works, services, pricing, faq
├── favicon/                   icons + site.webmanifest
├── tests/                     Regression tests (node --test, no packages)
└── scripts/                   Local preview server (no packages)
```

Three 0-byte files (`_includes/header.html`, `_includes/head.html`,
`_includes/footer.html`) were also removed. They had been empty in every
commit that ever contained them, were referenced by nothing, and — being
served as real files — produced blank 200 responses.

---

## URL & Routing Rules

Cloudflare Pages **automatically 308-redirects `/path.html` to `/path`** and
serves the extensionless URL directly. This has two consequences:

- **Canonical URLs are extensionless.** `rel="canonical"`, `og:url`,
  `sitemap.xml`, and every internal link must use `/pages/pricing`, not
  `/pages/pricing.html`. Otherwise the canonical tag points at a URL that
  redirects.
- **Never write a `_redirects` rule whose target normalises back to its own
  source.** The original `/contact → /contact.html 200` rule did exactly that
  and produced an infinite 308 loop that made every contact CTA on the site
  dead. `contact.html` is served at `/contact` natively, so **no rule is
  needed or allowed for it.**

`_redirects` currently maps only the four short URLs (`/how-it-works`,
`/services`, `/pricing`, `/faq`) and `/blog`.

`404.html` is served by Cloudflare Pages for unmatched routes **with an HTTP
404 status**, provided the project's "Single Page Application (SPA) fallback"
setting is disabled in the Cloudflare dashboard. That setting is not stored in
this repository.

---

## Contact Form Setup

EmailJS is configured with these identifiers (all public, client-side values —
**not secrets**):

| Purpose | Value |
|---------|-------|
| Public key | `Hx0NbUvVMgUQ2odp_` |
| Service ID | `service_sbebnme` |
| Owner notification template | `template_73vpqgp` |
| Visitor confirmation template | `template_a6nc3t4` |
| Owner inbox | `bistadinesh642@gmail.com` |

**Required EmailJS dashboard configuration (cannot be set from this repo):**

1. **Allowed domains** → `moveoutjapan.pages.dev`. Without this, anyone can
   call the EmailJS API with these public identifiers and send mail in the
   site's name, exhausting the quota.
2. Enable **reCAPTCHA / Turnstile** if available on the plan.

Input limits enforced by `quote-form.js` (and mirrored as `maxlength`
attributes in the HTML):

| Field | Rule |
|-------|------|
| `name` | 1–100 chars after trimming |
| `email` | 5–254 chars, must match `name@domain.tld` |
| `location` | must be one of the published service areas |
| `items` | 5–2000 chars after trimming |

---

## Testing

Tests use **only the Node.js built-in test runner**. No packages are
installed, and there is no `package.json`.

```powershell
cd D:\Dev\Projects\moveout-japan

# Run the whole suite
node --test tests/

# Run one file
node --test tests/quote-form.test.js
```

Available test files:

| File | What it covers |
|------|----------------|
| `tests/quote-form.test.js` | Validation rules, boundary/overlong/malformed input, mocked delivery success & failure, duplicate-submission guard |
| `tests/email-safety.test.js` | Proves the form core cannot reach the live email provider |
| `tests/blog.test.js` | Every `BLOG_POSTS` slug has a real, non-empty article file; no 0-byte files anywhere |
| `tests/sitemap.test.js` | Every sitemap URL maps to a real file and is canonical/extensionless; `robots.txt` wiring |
| `tests/routes.test.js` | `_redirects` sanity (no self-looping rule, nothing for `/contact`), real `404.html`, internal links resolve, security headers present and CSP covers every origin the site loads, manifest/icons, form markup, and the `main.js` ↔ HTML element-ID contract |

**Email safety:** no test can send an email. `quote-form.js` contains no
reference to EmailJS or any network API, and `main.js` cannot even be loaded in
Node because it requires `document`. `tests/email-safety.test.js` asserts both
of those facts and runs with `globalThis.fetch` replaced by a function that
throws.

---

## Local Preview

```powershell
node scripts/serve-local.js          # http://127.0.0.1:8080
```

A dependency-free static server that also parses `_headers` and `_redirects`,
so response headers and routing can be inspected before deploying. It does not
send email and does not contact EmailJS.

---

## Deployment

Pushing to `main` on the GitHub repository deploys the site through the
connected Cloudflare Pages project. There is no build step.

**After any deploy, verify:**

```powershell
# 1. Contact page must not redirect more than once
curl.exe -s -o NUL -w "%{http_code} %{num_redirects}`n" -L --max-redirs 5 "https://moveoutjapan.pages.dev/contact"
# PASS = "200 0" or "200 1"

# 2. Unknown URL must return a real 404
curl.exe -s -o NUL -w "%{http_code}`n" "https://moveoutjapan.pages.dev/definitely-not-a-page"
# PASS = 404   FAIL = 200

# 3. Security headers must be present
curl.exe -s -o NUL -D - "https://moveoutjapan.pages.dev/" | Select-String -Pattern '^(content-security-policy|strict-transport|x-frame|permissions-policy)'
# PASS = all four present
```

---

## Known Limitations

Be aware of these — they are documented rather than hidden:

- **Client-side validation is not a security boundary.** EmailJS is called
  straight from the browser with a public key, so the send endpoint can be
  invoked directly by anyone. Server-side validation and rate limiting would
  require a Cloudflare Pages Function or Worker, which would be an
  architectural change.
- **Navigation and footer require JavaScript.**
- **The site claims no analytics and runs none.** Privacy is preserved at the
  cost of having no traffic data.
- **Blog content is thin by design:** only one article has ever been written.
  Nine previously advertised posts never existed and were unpublished rather
  than fabricated.
- **Legal/pricing claims in the article are not cited to official sources.**
  This is an outstanding content task.

---

## Contact

| Channel | Details |
|---------|---------|
| 📧 Email | bistadinesh642@gmail.com |
| 📱 LINE | @704xslsr |
| 🌐 Website | moveoutjapan.pages.dev |

## License

© 2024 Move Out Japan. All rights reserved.

Built with ❤️ for foreigners living in Japan.
