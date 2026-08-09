require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const SERVICE_PAGES = require('./content/services');
const { resolvePortfolioVisual } = require('./content/portfolioVisuals');
const JsonDB = require('./db');
const requestContext = require('./middleware/requestContext');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set in .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 1995;

// Сервер за nginx proxy — довіряємо одному рівню проксі для коректного IP в rate-limit
app.set('trust proxy', 1);
app.use(requestContext);

app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true },
  xContentTypeOptions: false, // встановлюється nginx — уникаємо дубля
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],
      connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: function(origin, callback) {
    // Дозволяємо: домен, localhost, прямий IP-доступ і відсутність origin (мобільні)
    const allowed = [
      'https://zvirycholeksandr.com.ua',
      'http://zvirycholeksandr.com.ua',
      'http://localhost:3000',
      'http://localhost:1995',
    ];
    if (!origin || allowed.includes(origin) || origin === 'http://78.27.236.157') {
      callback(null, true);
    } else {
      callback(null, false); // відмовляємо без кидання помилки (не спамить Telegram)
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // Upload йде через multipart, не JSON
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function checkDataStorage({ validateJson = true } = {}) {
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../data');
  const requiredFiles = ['admin.json', 'blog.json', 'orders.json', 'portfolio.json', 'settings.json'];
  const optionalFiles = ['analytics.json', 'reviews.json'];
  const checks = { storage: 'ok', json: 'ok' };
  try {
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    checks.storage = 'unavailable';
  }
  if (!validateJson) {
    return { storage: checks.storage };
  }
  if (checks.storage === 'ok') {
    try {
      const presentOptionalFiles = optionalFiles.filter(filename => fs.existsSync(path.join(dataDir, filename)));
      [...requiredFiles, ...presentOptionalFiles].forEach(filename => {
        JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
      });
    } catch {
      checks.json = 'invalid';
    }
  } else {
    checks.json = 'unavailable';
  }
  return checks;
}

app.get('/api/health', (req, res) => {
  const { storage } = checkDataStorage({ validateJson: false });
  const healthy = storage === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { storage },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/ready', (req, res) => {
  const checks = checkDataStorage();
  const ready = Object.values(checks).every(value => value === 'ok');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// Rate limit для публічних форм (5 запитів на годину)
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Забагато запитів, спробуйте пізніше' }
});

// Rate limit для відгуків (3 на день)
const reviewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { error: 'Ви вже залишили відгук сьогодні' }
});

const analyticsEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Забагато аналітичних подій' },
});

// Публічні роути
app.use('/api/orders', formLimiter, require('./routes/orders'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/analytics', analyticsEventLimiter, require('./routes/analytics'));

// Адмін роути (JWT захищені)
app.use('/api/admin', require('./routes/admin'));

const { analyticsMiddleware } = require('./services/analytics');
app.use(analyticsMiddleware);
app.get('/sitemap.xml', (req, res) => {
  const blog = new JsonDB('blog.json');
  const portfolio = new JsonDB('portfolio.json');
  const DOMAIN = 'https://zvirycholeksandr.com.ua';
  const xml = value => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const dateOnly = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };
  const frontendDir = path.join(__dirname, '../../frontend');
  const staticPages = [
    { url: '/', file: 'index.html' },
    { url: '/portfolio', file: 'portfolio.html' },
    { url: '/ready-sites', file: 'ready-sites.html' },
    { url: '/blog', file: 'blog.html' },
    { url: '/reviews', file: 'reviews.html' },
    ...Object.values(SERVICE_PAGES).map(service => ({ url: `/services/${service.slug}`, file: 'service.html' })),
  ];

  const posts = blog.all({ isPublished: true });
  const cases = portfolio.all({ isVisible: true }).filter(item => item.slug);

  const urls = [
    ...staticPages.map(p => {
      let lastmod = null;
      try { lastmod = dateOnly(fs.statSync(path.join(frontendDir, p.file)).mtime); } catch {}
      return `
  <url>
    <loc>${xml(DOMAIN + p.url)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
  </url>`;
    }),
    ...posts.map(p => {
      const lastmod = dateOnly(p.updatedAt || p.publishedAt || p.createdAt);
      return `
  <url>
    <loc>${xml(`${DOMAIN}/blog/${encodeURIComponent(p.slug)}`)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
      </url>`;
    }),
    ...cases.map(item => {
      const lastmod = dateOnly(item.updatedAt || item.createdAt);
      return `
  <url>
    <loc>${xml(`${DOMAIN}/portfolio/${encodeURIComponent(item.slug)}`)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
  </url>`;
    }),
  ];

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`);
});

// Захист HTML-файлів адмінки — перевіряємо httpOnly cookie до видачі статики
const jwt = require('jsonwebtoken');
app.use('/admin', (req, res, next) => {
  if (req.path === '/login' || req.path === '/login.html') return next();
  const raw = req.headers.cookie || '';
  const match = raw.split(';').find(c => c.trim().startsWith('admin_auth='));
  const token = match?.trim().slice('admin_auth='.length);
  if (!token) return res.redirect('/admin/login');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.setHeader('Set-Cookie', 'admin_auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return res.redirect('/admin/login');
  }
});

// Статичні файли — завантажені зображення (кеш 30 днів)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '30d',
  immutable: true,
}));

// 301 redirect: trailing slash → без слешу (напр. /blog/ → /blog)
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const withoutSlash = req.path.slice(0, -1);
    const htmlFile = path.join(__dirname, '../../frontend', withoutSlash + '.html');
    if (fs.existsSync(htmlFile)) {
      const query = req.url.slice(req.path.length);
      return res.redirect(301, withoutSlash + query);
    }
  }
  next();
});

// 301 redirect: старий /blog-post?slug=X → новий /blog/X (SEO: прибираємо дублі)
app.get('/blog-post', (req, res) => {
  const slug = req.query.slug;
  if (slug) return res.redirect(301, `/blog/${slug}`);
  return res.redirect(301, '/blog');
});

// SEO-посадкові сторінки послуг — HTML генерується на сервері.
const SERVICE_PAGE_TEMPLATE = path.join(__dirname, '../../frontend/service.html');

function renderServicePage(service) {
  const DOMAIN = 'https://zvirycholeksandr.com.ua';
  const canonical = `${DOMAIN}/services/${service.slug}`;
  const deliverables = service.deliverables.map((item, index) =>
    `<li><span>${String(index + 1).padStart(2, '0')}</span>${escAttr(item)}</li>`
  ).join('');
  const idealFor = service.idealFor.map((item, index) =>
    `<article><span>${String(index + 1).padStart(2, '0')}</span><h3>${escAttr(item)}</h3></article>`
  ).join('');
  const steps = service.steps.map(([number, title, text]) =>
    `<li><span>${escAttr(number)}</span><h3>${escAttr(title)}</h3><p>${escAttr(text)}</p></li>`
  ).join('');
  const faqVisible = service.faqs.map(([question, answer]) =>
    `<details><summary>${escAttr(question)}</summary><p>${escAttr(answer)}</p></details>`
  ).join('');
  const relatedLinks = (service.relatedLinks || []).map(([href, label]) =>
    `<a href="${escAttr(href)}">${escAttr(label)} <span aria-hidden="true">→</span></a>`
  ).join('');
  const minPrice = service.price.replace(/\D/g, '');
  const schema = safeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: service.eyebrow.split('/')[0].trim(),
        description: service.metaDescription,
        url: canonical,
        provider: { '@type': 'ProfessionalService', '@id': `${DOMAIN}/#business`, name: 'Олександр Звірич — створення сайтів' },
        areaServed: ['Львів', 'Україна'],
        offers: { '@type': 'Offer', priceSpecification: { '@type': 'PriceSpecification', minPrice, priceCurrency: 'UAH' } },
      },
      {
        '@type': 'FAQPage',
        mainEntity: service.faqs.map(([question, answer]) => ({
          '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: service.eyebrow.split('/')[0].trim(), item: canonical },
        ],
      },
    ],
  });

  const replacements = {
    '{{TITLE}}': escAttr(service.title),
    '{{ROBOTS}}': 'index, follow',
    '{{DESCRIPTION}}': escAttr(service.metaDescription),
    '{{CANONICAL}}': canonical,
    '{{SCHEMA}}': `<script type="application/ld+json">${schema}</script>`,
    '{{SITE_TYPE}}': escAttr(service.siteType),
    '{{EYEBROW}}': escAttr(service.eyebrow),
    '{{H1}}': escAttr(service.h1),
    '{{LEAD}}': escAttr(service.lead),
    '{{PRICE}}': escAttr(service.price),
    '{{DURATION}}': escAttr(service.duration),
    '{{BUSINESS_LABEL}}': escAttr(service.businessLabel),
    '{{DELIVERABLES}}': deliverables,
    '{{IDEAL_FOR}}': idealFor,
    '{{STEPS}}': steps,
    '{{FAQ_VISIBLE}}': faqVisible,
    '{{RELATED_LINKS}}': relatedLinks,
  };

  let html = fs.readFileSync(SERVICE_PAGE_TEMPLATE, 'utf-8');
  for (const [token, value] of Object.entries(replacements)) html = html.split(token).join(value);
  return html;
}

app.get(['/service', '/service.html'], (req, res) => res.redirect(301, '/services/landing'));
app.get('/services/:slug', (req, res) => {
  const service = SERVICE_PAGES[req.params.slug];
  if (!service) return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderServicePage(service));
});

// Окремі індексовані сторінки робіт — без вигаданих метрик або відгуків.
const PORTFOLIO_CASE_TEMPLATE = path.join(__dirname, '../../frontend/portfolio-case.html');
const portfolioDB = new JsonDB('portfolio.json');

function caseTypeLabel(item) {
  if (item.siteType === 'landing') return 'Лендінг';
  if (item.siteType === 'business_card') return 'Сайт-візитка';
  if (item.siteType === 'menu') return 'Онлайн-меню';
  return 'Демо-концепт';
}

function caseServiceUrl(item) {
  const text = `${item.niche} ${item.description}`.toLowerCase();
  if (/психолог|психотерап/.test(text)) return '/services/psychologist-site';
  if (item.siteType === 'landing') return '/services/landing';
  if (item.siteType === 'business_card') return '/services/business-site';
  if (item.siteType === 'menu') return '/services/qr-menu';
  if (/меню|кафе|бар/.test(text)) return '/services/qr-menu';
  if (/масаж|лендінг/.test(text)) return '/services/landing';
  return '/services/business-site';
}

function caseFeatures(item) {
  const common = ['Адаптивна структура для мобільних і десктопних екранів'];
  if (item.siteType === 'landing') return [...common, 'Послідовна подача послуги та переваг', 'Сценарій переходу до запису або заявки', 'Технічна SEO-основа для локального пошуку'];
  if (item.siteType === 'business_card') return [...common, 'Структура послуг, робіт і контактів', 'Зрозумілий маршрут до звернення', 'Компоненти, які можна розширювати новими матеріалами'];
  if (item.siteType === 'menu') return [...common, 'Зручне групування позицій меню', 'Швидкий перегляд пропозиції з телефона', 'Контактна інформація та сценарій для гостя'];
  return [...common, 'Демонстрація структури для обраної ніші', 'Інтерфейс ключових блоків і сценаріїв', 'Основа для адаптації під реальний контент бізнесу'];
}

function safeCaseLink(value) {
  const link = String(value || '');
  if (link.startsWith('/')) return link;
  try {
    const parsed = new URL(link);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '/portfolio';
  } catch {
    return '/portfolio';
  }
}

function renderPortfolioCase(item) {
  const DOMAIN = 'https://zvirycholeksandr.com.ua';
  const canonical = `${DOMAIN}/portfolio/${item.slug}`;
  const type = caseTypeLabel(item);
  const isDemo = item.siteType === 'demo';
  const kind = isDemo ? 'Демо' : 'Проєкт';
  const portfolioVisual = resolvePortfolioVisual(item);
  const image = portfolioVisual.startsWith('http') ? portfolioVisual : DOMAIN + portfolioVisual;
  const schema = safeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        name: item.title,
        description: item.description,
        url: canonical,
        image,
        creator: { '@type': 'Person', '@id': `${DOMAIN}/#person`, name: 'Олександр Звірич' },
        keywords: [item.niche, type, ...(item.technologies || [])],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Роботи', item: `${DOMAIN}/portfolio` },
          { '@type': 'ListItem', position: 3, name: item.title, item: canonical },
        ],
      },
    ],
  });
  const replacements = {
    '{{TITLE}}': escAttr(`${item.title} — ${type}`),
    '{{DESCRIPTION}}': escAttr(String(item.description || '').slice(0, 180)),
    '{{DESCRIPTION_TEXT}}': escAttr(item.description),
    '{{CANONICAL}}': canonical,
    '{{IMAGE}}': escAttr(image),
    '{{SCHEMA}}': `<script type="application/ld+json">${schema}</script>`,
    '{{KIND}}': kind,
    '{{TYPE}}': escAttr(type),
    '{{H1}}': escAttr(item.title),
    '{{NICHE}}': escAttr(item.niche),
    '{{TECH_TEXT}}': escAttr((item.technologies || []).join(' / ')),
    '{{LIVE_URL}}': escAttr(safeCaseLink(item.liveUrl)),
    '{{LIVE_LABEL}}': isDemo ? 'демо' : 'сайт',
    '{{SERVICE_URL}}': caseServiceUrl(item),
    '{{FEATURES}}': caseFeatures(item).map(feature => `<li>${escAttr(feature)}</li>`).join(''),
  };
  let html = fs.readFileSync(PORTFOLIO_CASE_TEMPLATE, 'utf8');
  for (const [token, value] of Object.entries(replacements)) html = html.split(token).join(value);
  return html;
}

function renderPortfolioIndex() {
  const items = portfolioDB.all({ isVisible: true }).filter(item => item.slug);
  const cards = items.map(item => {
    const portfolioVisual = resolvePortfolioVisual(item);
    return `
    <article class="portfolio-card fade-in visible">
      <a class="portfolio-card-link" href="/portfolio/${encodeURIComponent(item.slug)}" aria-label="Відкрити роботу: ${escAttr(item.title)}">
        <div class="portfolio-card-img-wrap">
          <img class="portfolio-card-img" src="${escAttr(portfolioVisual)}" alt="${escAttr(item.title)}" loading="lazy">
          <div class="portfolio-card-overlay">Переглянути роботу →</div>
        </div>
        <div class="portfolio-card-body">
          <div class="portfolio-card-type">${escAttr(caseTypeLabel(item))}</div>
          <div class="portfolio-card-title">${escAttr(item.title)}</div>
          <div class="portfolio-card-niche">${escAttr(item.niche)}</div>
        </div>
      </a>
    </article>`;
  }).join('');
  const template = fs.readFileSync(path.join(__dirname, '../../frontend/portfolio.html'), 'utf8');
  return template.replace('<div class="spinner" style="grid-column:1/-1"></div>', cards);
}

app.get('/portfolio', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderPortfolioIndex());
});

app.get('/portfolio/:slug', (req, res) => {
  if (!/^[a-z0-9-]+$/.test(req.params.slug)) return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));
  const item = portfolioDB.findOne({ slug: req.params.slug, isVisible: true });
  if (!item) return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderPortfolioCase(item));
});

app.get(['/portfolio-case', '/portfolio-case.html'], (req, res) => res.redirect(301, '/portfolio'));
app.get('/blog-post.html', (req, res) => res.redirect(301, '/blog'));

// Фронтенд — CSS/JS/зображення кешуються на 7 днів, HTML — ні (щоб оновлення доходили)
app.use(express.static(path.join(__dirname, '../../frontend'), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(css|js|woff2?|png|jpg|jpeg|webp|svg|ico|gif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// Зберігаємо SEO-сигнали та старі зовнішні посилання після зміни slug.
const BLOG_LEGACY_REDIRECTS = {
  'yak-zrobyty-lending-dlya-masozhysta': 'yak-zrobyty-lending-dlya-masazhysta',
  'online-menu-qr-cafe-reasons': 'online-menu-qr-cafe-5-prychyn',
};

Object.entries(BLOG_LEGACY_REDIRECTS).forEach(([from, to]) => {
  app.get(`/blog/${from}`, (req, res) => res.redirect(301, `/blog/${to}`));
});

// Blog post — server-side OG meta tags для коректних превʼю в Telegram/Facebook
const BLOG_POST_TEMPLATE = path.join(__dirname, '../../frontend/blog-post.html');
const blogDB = new JsonDB('blog.json');
const DOMAIN = 'https://zvirycholeksandr.com.ua';

function escAttr(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderTextFormatting(value) {
  return escAttr(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderInlineMarkdown(value) {
  const source = String(value || '');
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
  let output = '';
  let cursor = 0;
  let match;

  while ((match = linkPattern.exec(source))) {
    output += renderTextFormatting(source.slice(cursor, match.index));
    output += `<a href="${escAttr(match[2])}">${renderTextFormatting(match[1])}</a>`;
    cursor = match.index + match[0].length;
  }

  return output + renderTextFormatting(source.slice(cursor));
}

function renderMarkdown(value) {
  const output = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) output.push('</ul>');
    listOpen = false;
  };

  for (const rawLine of String(value || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) { output.push('<ul>'); listOpen = true; }
      output.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  closeList();
  return output.join('\n');
}

function relatedBlogPosts(post) {
  const currentTags = new Set((Array.isArray(post.tags) ? post.tags : []).map(tag => String(tag).toLowerCase()));
  return blogDB.all({ isPublished: true })
    .filter(item => item.slug && item.slug !== post.slug)
    .sort((a, b) => {
      const score = item => (Array.isArray(item.tags) ? item.tags : [])
        .filter(tag => currentTags.has(String(tag).toLowerCase())).length;
      return score(b) - score(a) || new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0);
    })
    .slice(0, 3);
}

function renderRelatedBlogPosts(post) {
  const items = relatedBlogPosts(post);
  if (!items.length) return '';

  const cards = items.map(item => {
    const cover = item.coverUrl
      ? `<img class="related-card-img" src="${escAttr(item.coverUrl)}" alt="${escAttr(item.title)}" loading="lazy">`
      : '<div class="related-card-img related-card-placeholder" aria-hidden="true">Стаття</div>';
    const date = item.publishedAt || item.createdAt;
    const formattedDate = date
      ? new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `<a href="/blog/${encodeURIComponent(item.slug)}" class="related-card">
      ${cover}
      <div class="related-card-body">
        <p class="related-card-title">${escAttr(item.title)}</p>
        <span class="related-card-date">${escAttr(formattedDate)}</span>
      </div>
    </a>`;
  }).join('');

  return `<section class="related-posts" aria-labelledby="related-posts-title">
    <h2 class="related-posts-title" id="related-posts-title">Читайте також</h2>
    <div class="related-grid">${cards}</div>
    <div class="related-all"><a href="/blog" class="btn-secondary">Усі статті →</a></div>
  </section>`;
}

function relatedService(post) {
  const tagText = Array.isArray(post.tags) ? post.tags.join(' ') : '';
  const context = `${post.title || ''} ${tagText}`.toLowerCase();
  if (/психолог|психотерап/.test(context)) return { slug: 'psychologist-site', label: 'Переглянути сайт для психолога та ціни →' };
  if (/меню|кафе|ресторан|qr/.test(context)) return { slug: 'qr-menu', label: 'Переглянути QR-меню та ціни →' };
  if (/лендінг|landing|масаж/.test(context)) return { slug: 'landing', label: 'Переглянути лендінг та ціни →' };
  return { slug: 'business-site', label: 'Переглянути формати сайтів і ціни →' };
}

app.get('/blog/:slug', (req, res) => {
  try {
    if (!/^[a-zA-Z0-9\-_]+$/.test(req.params.slug)) {
      return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));
    }
    const post = blogDB.findOne({ slug: req.params.slug, isPublished: true });
    if (!post) return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));

    let html = fs.readFileSync(BLOG_POST_TEMPLATE, 'utf-8');
    const title  = escAttr(post.title);
    const desc   = escAttr(post.excerpt || '');
    const image  = post.coverUrl ? (post.coverUrl.startsWith('http') ? post.coverUrl : DOMAIN + post.coverUrl) : DOMAIN + '/og-image-2026.jpg';
    const url    = `${DOMAIN}/blog/${escAttr(post.slug)}`;

    const tags = Array.isArray(post.tags) ? post.tags : [];
    const wordCount = String(post.content || '').trim().split(/\s+/).filter(Boolean).length;

    // Article, Breadcrumb і FAQ schema.
    const articleSchema = safeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt || '',
      image: image,
      url: url,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt || post.publishedAt || post.createdAt,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'uk-UA',
      keywords: tags.join(', '),
      wordCount,
      author: { '@type': 'Person', name: 'Олександр Звірич', url: DOMAIN },
      publisher: { '@type': 'Person', name: 'Олександр Звірич', url: DOMAIN },
    });

    const breadcrumbSchema = safeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: DOMAIN },
        { '@type': 'ListItem', position: 2, name: 'Блог', item: `${DOMAIN}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    });

    const articleMeta = [
      (post.publishedAt || post.createdAt) ? `<meta property="article:published_time" content="${escAttr(post.publishedAt || post.createdAt)}">` : '',
      (post.updatedAt || post.publishedAt || post.createdAt) ? `<meta property="article:modified_time" content="${escAttr(post.updatedAt || post.publishedAt || post.createdAt)}">` : '',
      ...(Array.isArray(post.tags) ? post.tags.map(tag => `<meta property="article:tag" content="${escAttr(tag)}">`) : []),
    ].filter(Boolean).join('\n');
    let schemaBlock = `${articleMeta}\n<script type="application/ld+json">${articleSchema}</script>\n<script type="application/ld+json">${breadcrumbSchema}</script>`;

    if (Array.isArray(post.faq) && post.faq.length) {
      const faqSchema = safeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      });
      schemaBlock += `\n<script type="application/ld+json">${faqSchema}</script>`;
    }

    const publishedDate = post.publishedAt || post.createdAt;
    const renderedContent = renderMarkdown(post.content);
    const renderedRelatedPosts = renderRelatedBlogPosts(post);
    const service = relatedService(post);
    const renderedTags = tags.map(tag => `<span class="blog-tag">${escAttr(tag)}</span>`).join('');
    const renderedDate = publishedDate ? new Date(publishedDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title} — zvirycholeksandr</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/,        `$1${desc}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${title}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${desc}$2`)
      .replace(/(<meta property="og:image" content=")[^"]*(")/,        `$1${image}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/,          `$1${url}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${title}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/,       `$1${image}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/,               `$1${url}$2`)
      .replace('<div id="post-loading" class="post-wrap" style="text-align:center">', '<div id="post-loading" class="post-wrap hidden" style="text-align:center">')
      .replace('<div id="post-wrap" class="post-wrap hidden">', '<div id="post-wrap" class="post-wrap">')
      .replace('<div class="post-tags" id="post-tags"></div>', `<div class="post-tags" id="post-tags">${renderedTags}</div>`)
      .replace('<p class="post-date" id="post-date"></p>', `<p class="post-date" id="post-date">${escAttr(renderedDate)}</p>`)
      .replace('<h1 class="post-title" id="post-title"></h1>', `<h1 class="post-title" id="post-title">${title}</h1>`)
      .replace('<img class="post-cover" id="post-cover" src="" alt="" loading="lazy">', post.coverUrl
        ? `<img class="post-cover" id="post-cover" src="${image}" alt="${title}" loading="eager">`
        : '<img class="post-cover hidden" id="post-cover" src="" alt="">')
      .replace('<div class="post-content" id="post-content"></div>', `<div class="post-content" id="post-content">${renderedContent}</div>`)
      .replace('<a href="/services/business-site" class="post-service-link">Переглянути формати сайтів і ціни →</a>', `<a href="/services/${service.slug}" class="post-service-link">${service.label}</a>`)
      .replace('<div id="related-posts"></div>', `<div id="related-posts">${renderedRelatedPosts}</div>`)
      .replace('</head>', `${schemaBlock}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    res.sendFile(BLOG_POST_TEMPLATE);
  }
});

// 404 — відправляємо красиву сторінку
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));
});

// Global Express error handler → Telegram
const { notifyError } = require('./services/telegram');
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Невірний формат JSON', code: 'INVALID_JSON', requestId: req.requestId });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Запит перевищує допустимий розмір', code: 'PAYLOAD_TOO_LARGE', requestId: req.requestId });
  }
  console.error(`[${req.requestId || 'no-request-id'}] Express error:`, err);
  notifyError(err, `${req.method} ${req.path} [${req.requestId || 'no-request-id'}]`);
  res.status(500).json({ error: 'Внутрішня помилка сервера', code: 'INTERNAL_ERROR', requestId: req.requestId });
});

// Uncaught exceptions → Telegram (потім перезапуск через PM2)
process.on('uncaughtException', err => {
  console.error('uncaughtException:', err);
  notifyError(err, 'uncaughtException').finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('unhandledRejection:', err);
  notifyError(err, 'unhandledRejection');
});

app.listen(PORT, () => console.log(`✓ Server on port ${PORT}`));
