/* ===== NAVBAR ===== */
const navbar = document.querySelector('.navbar');
const burger = document.querySelector('.navbar-burger');
const navLinks = document.querySelector('.navbar-links');

window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 50);
});

burger?.addEventListener('click', () => {
  navLinks?.classList.toggle('open');
  burger.classList.toggle('open');
});

// Закрити меню при кліку на лінк
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger?.classList.remove('open');
  });
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

/* ===== PORTFOLIO PREVIEW ===== */
async function loadPortfolioPreview() {
  const container = document.getElementById('portfolio-preview');
  if (!container) return;

  try {
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error('Failed to load');
    const items = await res.json();

    container.innerHTML = items.slice(0, 4).map(item => `
      <div class="card fade-in" onclick="openPortfolioCard(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <div class="card-img-wrap">
          ${item.screenshotUrl
            ? `<img class="card-img" src="${item.screenshotUrl}" alt="${item.title}" loading="lazy">`
            : `<div class="card-img-placeholder">🖥️</div>`
          }
        </div>
        <div class="card-body">
          <div class="card-tag">${siteTypeLabel(item.siteType)}</div>
          <h3 class="card-title">${item.title}</h3>
          <p class="card-text">${item.niche}</p>
        </div>
      </div>
    `).join('');

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
      <a href="/blog-post.html?slug=${post.slug}" class="card fade-in">
        ${post.coverUrl
          ? `<img class="card-img" src="${post.coverUrl}" alt="${post.title}" loading="lazy">`
          : `<div class="card-img-placeholder">📝</div>`
        }
        <div class="card-body">
          <div class="card-tag">${formatDate(post.publishedAt)}</div>
          <h3 class="card-title">${post.title}</h3>
          <p class="card-text">${post.excerpt}</p>
          ${post.tags?.length ? `<div class="card-tags">${post.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}
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
  if (typeof openPortfolioPopup === 'function') {
    openPortfolioPopup(item);
  } else {
    // Редирект на сторінку портфоліо
    window.location.href = '/portfolio.html';
  }
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
