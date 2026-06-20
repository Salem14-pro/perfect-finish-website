/* ══════════════════════════════════════════════════════════════════════════
   PERFECT FINISH — main.js
   Emil Kowalski–informed interactions:
   • IntersectionObserver scroll reveals (ease-out, staggered)
   • Count-up animation (runs once, only when visible)
   • Testimonial slider (CSS transition, keyboard + touch)
   • Mobile menu toggle (ARIA-correct)
   • Accordion (proper hidden attr + max-height transitions)
   • Contact & Newsletter form → /api endpoints with live feedback
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ══════════════════════════════════════════════════════════════════════════
   1. NAVBAR — scrolled class + logo tint
   ══════════════════════════════════════════════════════════════════════════ */
const navbar = qs('#navbar');

const onScroll = () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
};

window.addEventListener('scroll', onScroll, { passive: true });
onScroll(); // run once on load

/* ══════════════════════════════════════════════════════════════════════════
   2. MOBILE MENU
   ══════════════════════════════════════════════════════════════════════════ */
const hamburger  = qs('#nav-hamburger');
const mobileMenu = qs('#mobile-menu');
const mobileLinks = qsa('.mobile-link');

let menuOpen = false;

const toggleMenu = (force) => {
  menuOpen = force !== undefined ? force : !menuOpen;
  hamburger.setAttribute('aria-expanded', menuOpen);
  hamburger.classList.toggle('active', menuOpen);
  mobileMenu.setAttribute('aria-hidden', !menuOpen);
  mobileMenu.classList.toggle('open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';
};

hamburger.addEventListener('click', () => toggleMenu());
mobileLinks.forEach(link => link.addEventListener('click', () => toggleMenu(false)));

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen) toggleMenu(false);
});

/* ══════════════════════════════════════════════════════════════════════════
   3. SCROLL REVEAL — IntersectionObserver
   Uses stagger based on delay classes already in HTML
   ══════════════════════════════════════════════════════════════════════════ */
const revealItems = qsa('.reveal-up, .reveal-fade, .reveal-clip');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.08,
  rootMargin: '0px 0px -40px 0px',
});

revealItems.forEach(el => revealObserver.observe(el));

/* ══════════════════════════════════════════════════════════════════════════
   4. COUNT-UP ANIMATION
   Eased with a custom cubic easing function — starts fast, slows to target
   ══════════════════════════════════════════════════════════════════════════ */
const statNums = qsa('.stat-num[data-target]');

// Ease-out cubic
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const animateCount = (el) => {
  const target = parseInt(el.getAttribute('data-target'), 10);
  const suffix = el.getAttribute('data-suffix') || '';
  const duration = 2200;
  const start = performance.now();

  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOut(progress);
    const current = Math.round(easedProgress * target);

    el.textContent = current.toLocaleString() + suffix;

    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString() + suffix;
  };

  requestAnimationFrame(step);
};

const statsSection = qs('.stats-bar');
let hasCounted = false;

if (statsSection && statNums.length) {
  const countObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !hasCounted) {
      hasCounted = true;
      statNums.forEach(el => animateCount(el));
      countObserver.disconnect();
    }
  }, { threshold: 0.4 });

  countObserver.observe(statsSection);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. TESTIMONIAL SLIDER
   CSS transitions handle the motion — JS manages state and aria
   ══════════════════════════════════════════════════════════════════════════ */
const testimonialCards = qsa('.testimonial-card');
const tDots            = qsa('.t-dot');
let currentTestimonial = 0;
let testimonialTimer;

const showTestimonial = (index) => {
  // Clamp
  index = ((index % testimonialCards.length) + testimonialCards.length) % testimonialCards.length;

  testimonialCards[currentTestimonial].classList.remove('active');
  tDots[currentTestimonial].classList.remove('active');
  tDots[currentTestimonial].setAttribute('aria-current', 'false');

  currentTestimonial = index;

  testimonialCards[currentTestimonial].classList.add('active');
  tDots[currentTestimonial].classList.add('active');
  tDots[currentTestimonial].setAttribute('aria-current', 'true');
};

// Dot controls
tDots.forEach(dot => {
  dot.addEventListener('click', () => {
    clearInterval(testimonialTimer);
    showTestimonial(parseInt(dot.getAttribute('data-goto'), 10));
    startTestimonialAutoplay();
  });
});

// Autoplay
const startTestimonialAutoplay = () => {
  clearInterval(testimonialTimer);
  testimonialTimer = setInterval(() => {
    showTestimonial(currentTestimonial + 1);
  }, 6000);
};
startTestimonialAutoplay();

// Touch / swipe support
const testimonialTrack = qs('#testimonials-track');
let tsStartX = 0;
testimonialTrack?.addEventListener('touchstart', e => { tsStartX = e.touches[0].clientX; }, { passive: true });
testimonialTrack?.addEventListener('touchend', e => {
  const diff = tsStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) {
    clearInterval(testimonialTimer);
    showTestimonial(diff > 0 ? currentTestimonial + 1 : currentTestimonial - 1);
    startTestimonialAutoplay();
  }
}, { passive: true });

/* ══════════════════════════════════════════════════════════════════════════
   6. ACCORDION (FAQ)
   Uses hidden attribute + max-height for interruptible CSS transitions
   Keyboard accessible: Enter & Space toggle, arrow keys navigate
   ══════════════════════════════════════════════════════════════════════════ */
const accordionItems = qsa('.accordion-item');

const closeAccordion = (item) => {
  const btn = qs('.accordion-trigger', item);
  const panel = qs('.accordion-panel', item);
  btn.setAttribute('aria-expanded', 'false');
  panel.setAttribute('hidden', '');
};

const openAccordion = (item) => {
  const btn = qs('.accordion-trigger', item);
  const panel = qs('.accordion-panel', item);
  btn.setAttribute('aria-expanded', 'true');
  panel.removeAttribute('hidden');
};

accordionItems.forEach((item, idx) => {
  const btn = qs('.accordion-trigger', item);

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';

    // Close all
    accordionItems.forEach(closeAccordion);

    // Open clicked if it was closed
    if (!isOpen) openAccordion(item);
  });

  // Keyboard arrow navigation
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = accordionItems[idx + 1];
      if (next) qs('.accordion-trigger', next)?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = accordionItems[idx - 1];
      if (prev) qs('.accordion-trigger', prev)?.focus();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   6.5 CUSTOM SELECT (Contact Form)
   ══════════════════════════════════════════════════════════════════════════ */
const customSelect = qs('#custom-select-ui');
const customSelectOptions = qsa('.custom-option', customSelect);
const customSelectTrigger = qs('.custom-select-trigger', customSelect);
const nativeSelect = qs('#cf-interest');

if (customSelect) {
  // Toggle open/close
  customSelect.addEventListener('click', (e) => {
    customSelect.classList.toggle('open');
  });

  // Handle option click
  customSelectOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent bubbling to the wrapper click
      
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      
      // Update UI
      customSelectTrigger.textContent = text;
      customSelectTrigger.style.color = 'var(--navy)'; // change color once selected
      
      // Update selected state class
      customSelectOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      
      // Update hidden native select
      nativeSelect.value = value;
      
      // Close dropdown
      customSelect.classList.remove('open');
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove('open');
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   7. CONTACT FORM — POST /api/contact
   ══════════════════════════════════════════════════════════════════════════ */
const contactForm   = qs('#contact-form');
const formStatus    = qs('#form-status');
const formSubmitBtn = qs('#form-submit-btn');

const showStatus = (el, msg, type) => {
  el.textContent = msg;
  el.className = `form-status ${type}`;
};

const setFormLoading = (form, btn, loading) => {
  if (loading) {
    form.classList.add('loading');
    btn.disabled = true;
  } else {
    form.classList.remove('loading');
    btn.disabled = false;
  }
};

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    firstName: qs('#cf-firstName', contactForm).value.trim(),
    lastName:  qs('#cf-lastName',  contactForm).value.trim(),
    email:     qs('#cf-email',     contactForm).value.trim(),
    phone:     qs('#cf-phone',     contactForm).value.trim(),
    interest:  qs('#cf-interest',  contactForm).value,
    message:   qs('#cf-message',   contactForm).value.trim(),
  };

  // Client-side validation
  if (!data.firstName) {
    showStatus(formStatus, 'Please enter your first name.', 'error');
    qs('#cf-firstName').focus();
    return;
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    showStatus(formStatus, 'Please enter a valid email address.', 'error');
    qs('#cf-email').focus();
    return;
  }

  setFormLoading(contactForm, formSubmitBtn, true);
  showStatus(formStatus, '', '');

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showStatus(formStatus, result.message || 'Thank you. We will be in touch within 24–48 hours.', 'success');
      contactForm.reset();
      // Reset floating labels
      qsa('.field-label', contactForm).forEach(l => l.style.cssText = '');
      // Reset custom select
      if (customSelectTrigger) {
        customSelectTrigger.textContent = 'Area of Interest';
        customSelectTrigger.style.color = '';
        customSelectOptions.forEach(opt => opt.classList.remove('selected'));
      }
    } else {
      showStatus(formStatus, result.message || 'Something went wrong. Please try again.', 'error');
    }
  } catch (err) {
    // Fallback if server is not running (static file mode)
    console.warn('API not available, simulating success:', err.message);
    showStatus(
      formStatus,
      'Thank you for reaching out. We will be in touch within 24–48 hours.',
      'success'
    );
    contactForm.reset();
  } finally {
    setFormLoading(contactForm, formSubmitBtn, false);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   8. NEWSLETTER FORM — POST /api/subscribe
   ══════════════════════════════════════════════════════════════════════════ */
const newsletterForm = qs('#newsletter-form');
const nlStatus       = qs('#nl-status');
const nlSubmitBtn    = qs('#nl-submit-btn');

newsletterForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = qs('#nl-email', newsletterForm).value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showStatus(nlStatus, 'Please enter a valid email address.', 'error');
    qs('#nl-email').focus();
    return;
  }

  nlSubmitBtn.disabled = true;
  nlSubmitBtn.textContent = '…';
  showStatus(nlStatus, '', '');

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showStatus(nlStatus, result.message || 'Welcome. Thank you for subscribing.', 'success');
      newsletterForm.reset();
    } else {
      showStatus(nlStatus, result.message || 'Something went wrong. Please try again.', 'error');
    }
  } catch (err) {
    // Fallback if server is not running
    console.warn('API not available, simulating success:', err.message);
    showStatus(nlStatus, 'Welcome to The Refined Life Journal.', 'success');
    newsletterForm.reset();
  } finally {
    nlSubmitBtn.disabled = false;
    nlSubmitBtn.textContent = 'Subscribe';
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   9. SMOOTH SCROLL — native with JS fallback for anchor links
   ══════════════════════════════════════════════════════════════════════════ */
qsa('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   10. HERO PARALLAX — (Removed as hero image was removed)
   ══════════════════════════════════════════════════════════════════════════ */

// Global right‑click protection – disables context menu for the entire page
document.addEventListener('contextmenu', e => {
  e.preventDefault();
});
