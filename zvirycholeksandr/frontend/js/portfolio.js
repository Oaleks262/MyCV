/* ===== PORTFOLIO PAGE ===== */
let portfolioItems = [];

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

  grid.innerHTML = items.map(item => {
    const isDemo = item.siteType === 'demo';
    const clickAttr = isDemo && item.liveUrl
      ? `onclick="window.open('${item.liveUrl}','_blank')"`
      : `onclick="openPortfolioPopup(${JSON.stringify(item).replace(/"/g, '&quot;')})"`;
    return `
    <div class="portfolio-card fade-in" ${clickAttr}>
      <div class="portfolio-card-img-wrap">
        ${item.screenshotUrl
          ? `<img class="portfolio-card-img" src="${item.screenshotUrl}" alt="${item.title}" loading="lazy">`
          : `<div class="portfolio-card-placeholder">🖥️</div>`
        }
        <div class="portfolio-card-overlay">${isDemo ? 'Відкрити демо →' : 'Переглянути →'}</div>
      </div>
      <div class="portfolio-card-body">
        <div class="portfolio-card-type">${siteTypeLabel(item.siteType)}</div>
        <div class="portfolio-card-title">${item.title}</div>
        <div class="portfolio-card-niche">${item.niche}</div>
      </div>
    </div>`;
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

  const screenshotEl = popup.querySelector('.popup-screenshot');
  const screenshotPlaceholder = popup.querySelector('.popup-screenshot-placeholder');

  if (item.screenshotUrl) {
    if (screenshotEl) { screenshotEl.src = item.screenshotUrl; screenshotEl.style.display = 'block'; }
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
    techsEl.innerHTML = (item.technologies || []).map(t => `<span class="popup-tech">${t}</span>`).join('');
  }
  if (liveBtn) {
    liveBtn.href = item.liveUrl || '#';
    liveBtn.target = '_blank';
  }
  if (orderBtn) {
    orderBtn.onclick = () => {
      closePortfolioPopup();
      if (typeof openOrderPopup === 'function') openOrderPopup();
    };
  }

  popup.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePortfolioPopup() {
  const popup = document.getElementById('portfolio-popup');
  popup?.classList.remove('active');
  document.body.style.overflow = '';
}

// Закрити при кліку на overlay
document.getElementById('portfolio-popup')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closePortfolioPopup();
});

// Закрити по Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePortfolioPopup();
});

/* ===== UTILS ===== */
function siteTypeLabel(type) {
  const map = { landing: 'Лендінг', business_card: 'Візитка', menu: 'Меню', demo: 'Демо' };
  return map[type] || type;
}

// Ініціалізація
loadPortfolio();
