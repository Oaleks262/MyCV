/* ===== NAVBAR ===== */
const navbar = document.querySelector('.navbar');
const burger = document.querySelector('.navbar-burger');
const navLinks = document.querySelector('.navbar-links');

window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 50);
});

burger?.addEventListener('click', () => {
  const isOpen = navLinks?.classList.toggle('open');
  burger.classList.toggle('open');
  burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  burger.setAttribute('aria-label', isOpen ? 'Закрити меню' : 'Відкрити меню');
  document.body.classList.toggle('nav-open', Boolean(isOpen));
});

// Закрити меню при кліку на будь-який елемент всередині (посилання або кнопки)
navLinks?.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger?.classList.remove('open');
    burger?.setAttribute('aria-expanded', 'false');
    burger?.setAttribute('aria-label', 'Відкрити меню');
    document.body.classList.remove('nav-open');
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !navLinks?.classList.contains('open')) return;
  navLinks.classList.remove('open');
  burger?.classList.remove('open');
  burger?.setAttribute('aria-expanded', 'false');
  burger?.setAttribute('aria-label', 'Відкрити меню');
  document.body.classList.remove('nav-open');
  burger?.focus();
});

/* ===== FADE IN ANIMATIONS ===== */
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ===== PORTFOLIO PREVIEW ===== */
async function loadPortfolioPreview() {
  const container = document.getElementById('portfolio-preview');
  if (!container) return;

  try {
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error('Failed to load');
    const items = await res.json();

    const previewItems = items.slice(0, 3);
    container.innerHTML = previewItems.map((item, index) => `
      <article class="card fade-in" role="button" tabindex="0" data-item-index="${index}" aria-label="Відкрити кейс: ${escapeHTML(item.title)}">
        <div class="card-img-wrap">
          ${item.screenshotUrl
            ? `<img class="card-img" src="${escapeHTML(item.screenshotUrl)}" alt="${escapeHTML(item.title)}" loading="lazy">`
            : `<div class="card-img-placeholder">🖥️</div>`
          }
        </div>
        <div class="card-body">
          <div class="card-tag">${escapeHTML(siteTypeLabel(item.siteType))}</div>
          <h3 class="card-title">${escapeHTML(item.title)}</h3>
          <p class="card-text">${escapeHTML(item.niche)}</p>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-item-index]').forEach(card => {
      const item = previewItems[Number(card.dataset.itemIndex)];
      card.addEventListener('click', () => openPortfolioCard(item));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPortfolioCard(item);
        }
      });
    });

    // Refresh observer for newly added elements
    container.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  } catch (e) {
    container.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:2rem;">Не вдалося завантажити портфоліо</p>';
  }
}

/* ===== BLOG PREVIEW ===== */
async function loadBlogPreview() {
  const container = document.getElementById('blog-preview');
  if (!container) return;

  try {
    const res = await fetch('/api/blog');
    if (!res.ok) throw new Error('Failed to load');
    const posts = await res.json();

    container.innerHTML = posts.slice(0, 3).map(post => `
      <a href="/blog/${encodeURIComponent(post.slug)}" class="card fade-in">
        ${post.coverUrl
          ? `<img class="card-img" src="${escapeHTML(post.coverUrl)}" alt="${escapeHTML(post.title)}" loading="lazy">`
          : `<div class="card-img-placeholder">📝</div>`
        }
        <div class="card-body">
          <div class="card-tag">${escapeHTML(formatDate(post.publishedAt))}</div>
          <h3 class="card-title">${escapeHTML(post.title)}</h3>
          <p class="card-text">${escapeHTML(post.excerpt)}</p>
          ${post.tags?.length ? `<div class="card-tags">${post.tags.slice(0,3).map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-link">Читати →</span>
        </div>
      </a>
    `).join('');

    container.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  } catch (e) {
    container.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:2rem;">Не вдалося завантажити блог</p>';
  }
}

/* ===== UTILS ===== */
function siteTypeLabel(type) {
  const map = { landing: 'Лендінг', business_card: 'Візитка', menu: 'Меню' };
  return map[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Функція для відкриття картки портфоліо зі сторінки home (якщо є попап)
function openPortfolioCard(item) {
  openPortfolioPopup(item);
}

/* ===== SITE SETTINGS ===== */
async function applySettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();

    // Кольори → CSS-змінні
    if (s.colors) {
      const root = document.documentElement;
      const map = {
        accent:      '--color-accent',
        accentHover: '--color-accent-hover',
        bg:          '--color-bg',
        bg2:         '--color-bg-2',
        bg3:         '--color-bg-3',
        text:        '--color-text',
        textMuted:   '--color-text-muted',
        border:      '--color-border'
      };
      Object.entries(map).forEach(([key, cssVar]) => {
        if (s.colors[key]) root.style.setProperty(cssVar, s.colors[key]);
      });
      // accentLight перераховуємо з accent
      if (s.colors.accent) {
        const hex = s.colors.accent;
        root.style.setProperty('--color-accent-light', hex + '1a');
      }
    }

    // Про мене
    if (s.about) {
      const a = s.about;
      const setTxt = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
      setTxt('about-name',       a.name);
      setTxt('about-bio1',       a.bio1);
      setTxt('about-bio2',       a.bio2);
      setTxt('about-stat1-num',  a.stat1_num);
      setTxt('about-stat1-lbl',  a.stat1_label);
      setTxt('about-stat2-num',  a.stat2_num);
      setTxt('about-stat2-lbl',  a.stat2_label);
      setTxt('about-stat3-num',  a.stat3_num);
      setTxt('about-stat3-lbl',  a.stat3_label);
      if (a.skills) {
        const container = document.getElementById('about-skills');
        if (container) {
          container.innerHTML = a.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('');
        }
      }
    }

    // Контакти → замінити посилання по data-contact
    if (s.contacts) {
      document.querySelectorAll('[data-contact]').forEach(el => {
        const key = el.dataset.contact;
        const val = s.contacts[key];
        if (!val) { el.closest('li, span, div') ? el.parentElement.style.display = 'none' : el.style.display = 'none'; return; }
        el.href = val;
        el.style.display = '';
        // Для phone/email показати текст без протоколу
        if (key === 'email') el.textContent = val.replace('mailto:', '');
        if (key === 'phone') el.textContent = val.replace('tel:', '');
      });
    }
  } catch (e) {
    // Тихо ігноруємо — дефолти з CSS залишаються
  }
}

// Ініціалізація
applySettings();
loadPortfolioPreview();
loadBlogPreview();

document.querySelectorAll('[data-concept-id]').forEach(link => {
  link.addEventListener('click', () => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'select_content', {
        content_type: 'demo_concept',
        item_id: link.dataset.conceptId
      });
    }
  });
});

/* ===== FAQ ACCORDION ===== */
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    // Закрити всі
    document.querySelectorAll('.faq-item.open').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });
    // Відкрити поточний якщо був закритий
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ===== CURSOR ===== */
(function () {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const spot = document.getElementById('cursor-spot');
  const tri  = document.getElementById('cursor-tri');
  if (!tri) return;

  let rafId = null;

  document.addEventListener('mousemove', e => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      if (spot) spot.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
      tri.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      rafId = null;
    });
  });

  const interactive = 'a, button, [data-open-order], .card, .portfolio-card, .process-step, .stat, label, input, select, textarea';

  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactive)) {
      tri.classList.add('is-hovering');
      spot?.classList.add('is-hovering');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactive)) {
      tri.classList.remove('is-hovering');
      spot?.classList.remove('is-hovering');
    }
  });

  document.addEventListener('mousedown', () => {
    tri.classList.remove('is-hovering');
    tri.classList.add('is-clicking');
  });
  document.addEventListener('mouseup', () => {
    tri.classList.remove('is-clicking');
  });
})();

/* ===== REVIEWS ===== */
(async function loadReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/reviews');
    if (!res.ok) throw new Error();
    const list = await res.json();

    if (!list.length) {
      grid.innerHTML = '<p class="reviews-loading">Відгуків ще немає</p>';
      return;
    }

    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

    grid.innerHTML = list.map(r => `
      <div class="review-card fade-in">
        <div class="review-stars" aria-label="${r.rating} з 5">${stars(r.rating)}</div>
        <p class="review-text">${escapeHTML(r.text)}</p>
        <div class="review-author">
          <span class="review-name">${escapeHTML(r.name)}</span>
          ${r.project ? `<span class="review-project">${escapeHTML(r.project)}</span>` : ''}
        </div>
      </div>
    `).join('');

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    grid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  } catch {
    grid.innerHTML = '';
  }
})();
