/* ===== PORTFOLIO PAGE ===== */
let portfolioItems = [];
let portfolioTrigger = null;

function escapePortfolioHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

async function loadPortfolio() {
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error('Failed');
    portfolioItems = await res.json();
    renderGrid(portfolioItems);
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;grid-column:1/-1;">Не вдалося завантажити портфоліо</p>';
  }
}

function renderGrid(items) {
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;grid-column:1/-1;">Робіт ще немає</p>';
    return;
  }

  grid.innerHTML = items.map((item, idx) => {
    const isDemo = item.siteType === 'demo';
    const caseUrl = item.slug ? `/portfolio/${encodeURIComponent(item.slug)}` : safeExternalUrl(item.liveUrl || '');
    return `
    <article class="portfolio-card fade-in" data-idx="${idx}">
      <a class="portfolio-card-link" href="${escapePortfolioHTML(caseUrl)}" aria-label="Відкрити роботу: ${escapePortfolioHTML(item.title)}">
      <div class="portfolio-card-img-wrap">
        ${item.screenshotUrl
          ? `<img class="portfolio-card-img" src="${escapePortfolioHTML(item.screenshotUrl)}" alt="${escapePortfolioHTML(item.title)}" loading="lazy">`
          : `<div class="portfolio-card-placeholder">🖥️</div>`
        }
        <div class="portfolio-card-overlay">Переглянути роботу →</div>
      </div>
      <div class="portfolio-card-body">
        <div class="portfolio-card-type">${escapePortfolioHTML(siteTypeLabel(item.siteType))}</div>
        <div class="portfolio-card-title">${escapePortfolioHTML(item.title)}</div>
        <div class="portfolio-card-niche">${escapePortfolioHTML(item.niche)}</div>
      </div>
      </a>
    </article>`;
  }).join('');

  // Fade-in observer
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  grid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

/* ===== FILTERS ===== */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const type = btn.dataset.filter;
    const filtered = type === 'all' ? portfolioItems : portfolioItems.filter(i => i.siteType === type);
    renderGrid(filtered);
  });
});

/* ===== POPUP ===== */
function openPortfolioPopup(item) {
  const popup = document.getElementById('portfolio-popup');
  if (!popup) return;
  portfolioTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const screenshotEl = popup.querySelector('.popup-screenshot');
  const screenshotPlaceholder = popup.querySelector('.popup-screenshot-placeholder');

  if (item.screenshotUrl) {
    if (screenshotEl) {
      screenshotEl.src = item.screenshotUrl;
      screenshotEl.alt = `Скриншот проєкту ${item.title}`;
      screenshotEl.style.display = 'block';
    }
    if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'none';
  } else {
    if (screenshotEl) screenshotEl.style.display = 'none';
    if (screenshotPlaceholder) screenshotPlaceholder.style.display = 'flex';
  }

  const nicheEl = popup.querySelector('.popup-niche');
  const titleEl = popup.querySelector('.popup-title');
  const descEl = popup.querySelector('.popup-description');
  const techsEl = popup.querySelector('.popup-techs');
  const liveBtn = popup.querySelector('.popup-live-btn');
  const orderBtn = popup.querySelector('.popup-order-btn');

  if (nicheEl) nicheEl.textContent = `${item.niche} · ${siteTypeLabel(item.siteType)}`;
  if (titleEl) titleEl.textContent = item.title;
  if (descEl) descEl.textContent = item.description || '';
  if (techsEl) {
    techsEl.innerHTML = (item.technologies || []).map(t => `<span class="popup-tech">${escapePortfolioHTML(t)}</span>`).join('');
  }
  if (liveBtn) {
    liveBtn.href = safeExternalUrl(item.liveUrl || '');
    liveBtn.target = '_blank';
  }
  if (orderBtn) {
    orderBtn.onclick = () => {
      closePortfolioPopup();
      if (typeof openOrderPopup === 'function') openOrderPopup();
    };
  }

  popup.classList.add('active');
  popup.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => popup.querySelector('.popup-close')?.focus({ preventScroll: true }), 100);
}

function closePortfolioPopup() {
  const popup = document.getElementById('portfolio-popup');
  popup?.classList.remove('active');
  popup?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  portfolioTrigger?.focus();
  portfolioTrigger = null;
}

// Закрити при кліку на overlay
document.getElementById('portfolio-popup')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closePortfolioPopup();
});

// Закрити по Escape
document.addEventListener('keydown', e => {
  const popup = document.getElementById('portfolio-popup');
  if (!popup?.classList.contains('active')) return;
  if (e.key === 'Escape') {
    closePortfolioPopup();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = [...popup.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

/* ===== UTILS ===== */
function siteTypeLabel(type) {
  const map = { landing: 'Лендінг', business_card: 'Візитка', menu: 'Меню', demo: 'Демо' };
  return map[type] || type;
}

// Ініціалізація
loadPortfolio();
