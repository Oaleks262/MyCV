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
      'https://zvirycholeksandr.com',
      'http://zvirycholeksandr.com',
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

app.listen(PORT, () => console.log(`✓ Server on port ${PORT}`));
