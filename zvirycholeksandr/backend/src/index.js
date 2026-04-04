require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 1995;

// Helmet без CSP і HSTS — сайт поки без SSL/домену
app.use(helmet({
  contentSecurityPolicy: false,   // вимикаємо CSP (upgrade-insecure-requests ламав CSS)
  hsts: false,                    // вимикаємо HSTS (Safari блокував HTTP після першого відвіду)
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
      callback(null, true); // тимчасово дозволяємо всі origin до підключення домену
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limit для публічних форм (5 запитів на годину)
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Забагато запитів, спробуйте пізніше' }
});

// Публічні роути
app.use('/api/orders', formLimiter, require('./routes/orders'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/settings', require('./routes/settings'));

// Адмін роути (JWT захищені)
app.use('/api/admin', require('./routes/admin'));

// Sitemap — динамічний, включає блог-пости
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

// Fallback для SPA (blog-post)
app.get('/blog/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/blog-post.html'));
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
