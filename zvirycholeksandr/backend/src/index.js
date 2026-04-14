require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 1995;

// Сервер за nginx proxy — довіряємо одному рівню проксі для коректного IP в rate-limit
app.set('trust proxy', 1);

app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true },
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
    if (!origin || allowed.includes(origin) || /^http:\/\/78\.27\.236\.157/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false); // відмовляємо без кидання помилки (не спамить Telegram)
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // Upload йде через multipart, не JSON

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

// Публічні роути
app.use('/api/orders', formLimiter, require('./routes/orders'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/reviews', reviewLimiter, require('./routes/reviews'));
app.use('/api/settings', require('./routes/settings'));

// Адмін роути (JWT захищені)
app.use('/api/admin', require('./routes/admin'));

const { analyticsMiddleware } = require('./services/analytics');
app.use(analyticsMiddleware);
app.get('/sitemap.xml', (req, res) => {
  const JsonDB = require('./db');
  const blog = new JsonDB('blog.json');
  const DOMAIN = 'https://zvirycholeksandr.com.ua';
  const now = new Date().toISOString().split('T')[0];

  const staticPages = [
    { url: '/', priority: '1.0', freq: 'weekly' },
    { url: '/portfolio', priority: '0.8', freq: 'monthly' },
    { url: '/blog', priority: '0.8', freq: 'daily' },
    { url: '/terms', priority: '0.3', freq: 'yearly' },
    { url: '/privacy', priority: '0.3', freq: 'yearly' },
  ];

  const posts = blog.all({ isPublished: true });

  const urls = [
    ...staticPages.map(p => `
  <url>
    <loc>${DOMAIN}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
    ...posts.map(p => `
  <url>
    <loc>${DOMAIN}/blog/${p.slug}</loc>
    <lastmod>${(p.updatedAt || p.createdAt || now).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),
  ];

  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`);
});

// Статичні файли — завантажені зображення
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Фронтенд — extensions дозволяє відкривати сторінки без .html
app.use(express.static(path.join(__dirname, '../../frontend'), {
  extensions: ['html'],
}));

// Blog post — server-side OG meta tags для коректних превʼю в Telegram/Facebook
const BLOG_POST_TEMPLATE = path.join(__dirname, '../../frontend/blog-post.html');
const JsonDB = require('./db');
const blogDB = new JsonDB('blog.json');
const DOMAIN = 'https://zvirycholeksandr.com.ua';

function escAttr(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

app.get('/blog/:slug', (req, res) => {
  try {
    const post = blogDB.findOne({ slug: req.params.slug, isPublished: true });
    if (!post) return res.status(404).sendFile(path.join(__dirname, '../../frontend/404.html'));

    let html = fs.readFileSync(BLOG_POST_TEMPLATE, 'utf-8');
    const title  = escAttr(post.title);
    const desc   = escAttr(post.excerpt || '');
    const image  = post.coverUrl ? (post.coverUrl.startsWith('http') ? post.coverUrl : DOMAIN + post.coverUrl) : DOMAIN + '/og-image.jpg';
    const url    = `${DOMAIN}/blog/${escAttr(post.slug)}`;

    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title} — zvirycholeksandr</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/,        `$1${desc}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${title}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${desc}$2`)
      .replace(/(<meta property="og:image" content=")[^"]*(")/,        `$1${image}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/,          `$1${url}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/,               `$1${url}$2`);

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
  console.error('Express error:', err);
  notifyError(err, `${req.method} ${req.path}`);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
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
