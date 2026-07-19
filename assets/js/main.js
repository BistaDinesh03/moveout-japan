/* ============================================
   MOVE OUT JAPAN - MAIN JAVASCRIPT v3.0
   Fixed: All internal links now use .html extension
   for consistency with sitemap.xml and canonical URLs
   ============================================ */

// ========== BLOG DATA STORE ==========
// Add new posts here - they auto-appear everywhere!
const BLOG_POSTS = [
  {
    slug: 'complete-moving-out-checklist-japan',
    title: 'The Complete Moving Out Checklist in Japan for Foreigners',
    excerpt: 'A step-by-step guide covering everything from utility cancellation to final inspection. Never miss a deadline again.',
    category: 'Moving Out',
    date: '2024-01-15',
    image: '/assets/images/blog/checklist.jpg'
  },
  {
    slug: 'how-to-dispose-furniture-japan',
    title: 'How to Dispose of Furniture in Japan Legally and Affordably',
    excerpt: 'Navigating Japan\'s complex waste disposal laws is hard. Our guide for foreigners simplifies large-item disposal.',
    category: 'Furniture Disposal',
    date: '2024-01-10',
    image: '/assets/images/blog/furniture.jpg'
  },
  {
    slug: 'cancel-electricity-japan',
    title: 'How to Cancel Electricity in Japan Before Moving Out',
    excerpt: 'A simple guide to closing your account with TEPCO, KEPCO, and other major providers before your move.',
    category: 'Utilities',
    date: '2024-01-08',
    image: '/assets/images/blog/electricity.jpg'
  },
  {
    slug: 'cancel-gas-service-japan',
    title: 'How to Cancel Gas Service in Japan: Complete Guide',
    excerpt: 'Don\'t forget gas! Learn how to schedule your final meter reading and close your city gas or propane account.',
    category: 'Utilities',
    date: '2024-01-05',
    image: '/assets/images/blog/gas.jpg'
  },
  {
    slug: 'apartment-checkout-guide-foreigners',
    title: 'Apartment Checkout Guide for Foreigners in Japan',
    excerpt: 'Avoid common deposit deductions. Master the pre-inspection, cleaning, and key return process.',
    category: 'Apartment Checkout',
    date: '2024-01-01',
    image: '/assets/images/blog/checkout.jpg'
  },
  {
    slug: 'sayonara-sale-guide-japan',
    title: 'Sayonara Sale Guide: How to Sell Your Stuff Before Leaving Japan',
    excerpt: 'Turn your unwanted items into cash. A complete guide to online and offline sayonara sales.',
    category: 'Relocation',
    date: '2023-12-28',
    image: '/assets/images/blog/sale.jpg'
  },
  {
    slug: 'avoid-moving-out-fees-japan',
    title: 'How to Avoid Unfair Moving-Out Fees in Japan',
    excerpt: 'Landlords asking for outrageous fees? Know your rights as a tenant in Japan.',
    category: 'Apartment Checkout',
    date: '2023-12-20',
    image: '/assets/images/blog/fees.jpg'
  },
  {
    slug: 'foreigner-relocation-guide-japan',
    title: 'The Ultimate Relocation Guide for Foreigners in Japan',
    excerpt: 'Moving cities or countries? This comprehensive guide covers every stage of your move.',
    category: 'Relocation',
    date: '2023-12-15',
    image: '/assets/images/blog/relocation.jpg'
  },
  {
    slug: 'best-packing-tips-japan',
    title: 'Best Packing Tips for Moving in Japan',
    excerpt: 'From finding the right-sized boxes to packing fragile items, learn how to pack like a pro.',
    category: 'Moving Out',
    date: '2023-12-10',
    image: '/assets/images/blog/packing.jpg'
  },
  {
    slug: 'utility-cancellation-checklist-japan',
    title: 'The Ultimate Utility Cancellation Checklist for Japan',
    excerpt: 'A complete checklist covering electricity, gas, water, internet, and NHK. Cancel everything on time.',
    category: 'Utilities',
    date: '2023-12-05',
    image: '/assets/images/blog/utilities.jpg'
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
            <!-- FIXED: Added .html to all links -->
            <a href="/pages/how-it-works.html" role="menuitem" class="${currentPath.includes('/how-it-works') ? 'active' : ''}">How It Works</a>
            <a href="/pages/services.html" role="menuitem" class="${currentPath.includes('/services') ? 'active' : ''}">Services</a>
            <a href="/pages/pricing.html" role="menuitem" class="${currentPath.includes('/pricing') ? 'active' : ''}">Pricing</a>
            <a href="/pages/faq.html" role="menuitem" class="${currentPath.includes('/faq') ? 'active' : ''}">FAQ</a>
            <a href="/blog/index.html" role="menuitem" class="${currentPath.includes('/blog') ? 'active' : ''}">Blog</a>
            <a href="/contact.html" class="nav-cta" role="menuitem">Get Free Quote</a>
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
          <!-- FIXED: Added .html to all links -->
          <a href="/">Home</a>
          <a href="/pages/how-it-works.html">How It Works</a>
          <a href="/pages/services.html">Services</a>
          <a href="/pages/pricing.html">Pricing</a>
          <a href="/pages/faq.html">FAQ</a>
          <a href="/blog/index.html">Blog</a>
          <a href="/contact.html">Contact</a>
          <a href="/sitemap.html">Sitemap</a>
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
function resetForm() {
  const form = document.getElementById('priceCheckForm');
  const successDiv = document.getElementById('formSuccess');
  const errorDiv = document.getElementById('formError');
  
  if (form) form.style.display = 'block';
  if (successDiv) successDiv.style.display = 'none';
  if (errorDiv) errorDiv.style.display = 'none';
  
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  if (submitBtn) submitBtn.disabled = false;
  if (btnText) btnText.textContent = 'Send for Free Price Check';
}

async function handleSubmit(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('priceCheckForm');
  const btnText = document.getElementById('btnText');
  
  if (!submitBtn || !form) return false;
  
  submitBtn.disabled = true;
  btnText.textContent = 'Sending...';
  
  const formData = {
    name: document.getElementById('name')?.value.trim() || '',
    email: document.getElementById('email')?.value.trim() || '',
    location: document.getElementById('location')?.value || '',
    items: document.getElementById('items')?.value.trim() || '',
    date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  };

  try {
    await emailjs.send('service_sbebnme', 'template_73vpqgp', {
      to_email: 'bistadinesh642@gmail.com',
      from_name: formData.name,
      from_email: formData.email,
      location: formData.location,
      items: formData.items,
      submission_date: formData.date,
      reply_to: formData.email
    });

    try {
      await emailjs.send('service_sbebnme', 'template_a6nc3t4', {
        to_email: formData.email,
        to_name: formData.name,
        items: formData.items,
        location: formData.location,
        reply_message: 'We received your request! We\'ll reply within 24 hours.\n\nThank you,\nMove Out Japan Team\n📱 LINE: @704xslsr',
        from_name: 'Move Out Japan'
      });
    } catch (e) {
      console.warn('User confirmation email non-critical:', e);
    }

    form.style.display = 'none';
    const successDiv = document.getElementById('formSuccess');
    const errorDiv = document.getElementById('formError');
    if (successDiv) successDiv.style.display = 'block';
    if (errorDiv) errorDiv.style.display = 'none';

  } catch (err) {
    console.error('Form submission failed:', err);
    form.style.display = 'none';
    const errorDiv = document.getElementById('formError');
    if (errorDiv) errorDiv.style.display = 'block';
  }

  submitBtn.disabled = false;
  btnText.textContent = 'Send for Free Price Check';
  return false;
}

// ========== BLOG FUNCTIONS ==========
function getSortedPosts() {
  return [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function createBlogCard(post) {
  // FIXED: Already uses .html - kept as is
  return `
    <div class="card blog-card" onclick="window.location.href='/blog/posts/${post.slug}.html'" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='/blog/posts/${post.slug}.html'">
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
  // Initialize EmailJS
  try {
    emailjs.init('Hx0NbUvVMgUQ2odp_');
    console.log('✅ EmailJS ready');
  } catch(e) {
    console.error('❌ EmailJS init failed:', e);
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
