# CLAUDE CODE — ФІНАЛЬНИЙ ПРОМТ v3.0

## Проєкт: zvirycholeksandr.com — Повноцінний персональний сайт розробника

-----

## 🎯 КОНЦЕПЦІЯ

Повноцінний сайт-агенція одного розробника з портфоліо, блогом, формою замовлення та адмін-панеллю.

**Флоу замовлення:**

```
Відвідувач → бачить портфоліо → натискає "Замовити сайт" →
Попап з формою → заповнює питання →
Backend → Claude Haiku генерує промт →
Зберігається в orders.json →
Telegram: повідомлення + промт
```

-----

## 📁 СТРУКТУРА ПРОЄКТУ

```
zvirycholeksandr/
│
├── frontend/
│   ├── index.html              # Головна (Hero, About, Portfolio preview, Blog preview, CTA)
│   ├── portfolio.html          # Всі роботи (grid + popup)
│   ├── blog.html               # Список статей
│   ├── blog-post.html          # Окрема стаття (шаблон)
│   ├── privacy.html            # Конфіденційність
│   ├── terms.html              # Умови використання
│   ├── 404.html                # Сторінка 404
│   │
│   ├── admin/
│   │   ├── index.html          # Адмін — список замовлень
│   │   ├── order.html          # Деталі замовлення + промт
│   │   ├── portfolio.html      # Керування портфоліо
│   │   └── blog.html           # Керування блогом
│   │
│   ├── css/
│   │   ├── style.css           # Глобальні стилі
│   │   ├── portfolio.css       # Стилі портфоліо і попапу
│   │   ├── blog.css            # Стилі блогу
│   │   └── admin.css           # Стилі адмін панелі
│   │
│   └── js/
│       ├── main.js             # Анімації, navbar, scroll
│       ├── portfolio.js        # Фільтрація, попап
│       ├── order.js            # Попап замовлення, форма, відправка
│       ├── blog.js             # Пошук по блогу
│       └── admin.js            # Адмін логіка (auth, CRUD)
│
├── backend/
│   ├── src/
│   │   ├── index.js            # Express, порт 1995
│   │   ├── routes/
│   │   │   ├── orders.js       # Публічні: submit форми
│   │   │   ├── admin.js        # Адмін: замовлення, авторизація
│   │   │   ├── portfolio.js    # Адмін: CRUD портфоліо
│   │   │   └── blog.js         # Публічний GET + адмін CRUD
│   │   ├── services/
│   │   │   ├── aiBuilder.js    # Claude Haiku → промт
│   │   │   └── telegram.js     # Telegram нотифікації
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT для адмінки
│   │   └── db/
│   │       └── index.js        # JSON DB engine
│   │
│   ├── data/
│   │   ├── orders.json
│   │   ├── portfolio.json
│   │   ├── blog.json
│   │   └── admin.json          # Хеш пароля адміна
│   │
│   ├── uploads/                # Фото портфоліо і блогу
│   ├── .env.example
│   ├── ecosystem.config.js
│   └── package.json
```

-----

## 🗄️ БАЗА ДАНИХ — JSON ФАЙЛИ

### `data/orders.json`

```json
[
  {
    "id": "uuid-v4",
    "status": "new",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "siteType": "landing",
    "formData": {
      "name": "Олена Коваль",
      "profession": "Масажист",
      "city": "Львів",
      "phone": "+38 067 123 4567",
      "email": "olena@gmail.com",
      "services": "Класичний масаж — 600 грн, Релакс масаж — 750 грн",
      "about": "5 років досвіду, сертифікований спеціаліст",
      "colorStyle": "warm",
      "designStyle": "classic",
      "referenceUrl": ""
    },
    "generatedPrompt": "Build a converting landing page..."
  }
]
```

**Статуси:** `new` → `prompted` → `done`

-----

### `data/portfolio.json`

```json
[
  {
    "id": "uuid-v4",
    "title": "Масаж Олени",
    "niche": "Масажист",
    "siteType": "landing",
    "description": "Лендінг для масажиста у Львові. Mobile-first, SEO під 'масаж Львів', Schema.org.",
    "technologies": ["HTML", "CSS", "JS", "Node.js"],
    "screenshotUrl": "/uploads/portfolio/massage-olena.webp",
    "liveUrl": "https://massage-olena.zvirycholeksandr.com",
    "isVisible": true,
    "sortOrder": 1,
    "createdAt": "2026-03-01T10:00:00.000Z"
  }
]
```

-----

### `data/blog.json`

```json
[
  {
    "id": "uuid-v4",
    "slug": "yak-zrobyty-lending-dlya-masozhysta",
    "title": "Як зробити лендінг для масажиста який приносить клієнтів",
    "excerpt": "Розбираємо структуру продаючого сайту для масажиста — від Hero до форми запису.",
    "content": "## Markdown контент статті...",
    "coverUrl": "/uploads/blog/landing-masazhyst.webp",
    "tags": ["лендінг", "масажист", "SEO"],
    "isPublished": true,
    "publishedAt": "2026-03-15T10:00:00.000Z",
    "createdAt": "2026-03-15T10:00:00.000Z"
  }
]
```

-----

### `data/admin.json`

```json
{
  "passwordHash": "bcrypt-hash-тут"
}
```

-----

## ⚙️ BACKEND

### `src/index.js` — Express на порту 1995

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 1995;

app.use(helmet());
app.use(cors({ origin: ['https://zvirycholeksandr.com', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));

// Rate limit для публічних форм
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Забагато запитів, спробуйте пізніше' }
});

// Публічні роути
app.use('/api/orders', formLimiter, require('./routes/orders'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/blog', require('./routes/blog'));

// Адмін роути (JWT захищені)
app.use('/api/admin', require('./routes/admin'));

// Статичні файли
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.listen(PORT, () => console.log(`✓ Server on port ${PORT}`));
```

-----

### `src/db/index.js` — JSON DB (атомарний запис)

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');

function readFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return []; }
}

function writeFile(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filepath);
}

class JsonDB {
  constructor(filename) {
    this.filename = filename;
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) writeFile(filename, []);
  }

  all(filter = {}) {
    const data = readFile(this.filename);
    if (!Object.keys(filter).length) return data;
    return data.filter(i => Object.entries(filter).every(([k, v]) => i[k] === v));
  }

  findById(id) {
    return readFile(this.filename).find(i => i.id === id) || null;
  }

  findOne(filter) {
    return readFile(this.filename).find(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v)
    ) || null;
  }

  insert(data) {
    const list = readFile(this.filename);
    const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...data };
    list.push(record);
    writeFile(this.filename, list);
    return record;
  }

  update(id, updates) {
    const list = readFile(this.filename);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(this.filename, list);
    return list[idx];
  }

  delete(id) {
    const list = readFile(this.filename);
    writeFile(this.filename, list.filter(i => i.id !== id));
  }
}

module.exports = JsonDB;
```

-----

### `src/middleware/auth.js` — JWT для адмінки

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

-----

### `src/routes/admin.js`

```javascript
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const orders = new JsonDB('orders.json');
const adminFile = path.join(__dirname, '../../data/admin.json');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const admin = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Невірний пароль' });
  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// GET /api/admin/orders — всі замовлення
router.get('/orders', auth, (req, res) => {
  const all = orders.all().sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(all);
});

// GET /api/admin/orders/:id
router.get('/orders/:id', auth, (req, res) => {
  const order = orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

// PATCH /api/admin/orders/:id — оновити статус або промт
router.patch('/orders/:id', auth, (req, res) => {
  const updated = orders.update(req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', auth, (req, res) => {
  orders.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

-----

### `src/routes/portfolio.js`

```javascript
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const portfolio = new JsonDB('portfolio.json');

// Multer для завантаження скріншотів
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/portfolio')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/portfolio — публічний (тільки visible)
router.get('/', (req, res) => {
  const items = portfolio.all({ isVisible: true })
    .sort((a, b) => a.sortOrder - b.sortOrder);
  res.json(items);
});

// GET /api/portfolio/all — адмін (всі)
router.get('/all', auth, (req, res) => {
  res.json(portfolio.all().sort((a, b) => a.sortOrder - b.sortOrder));
});

// POST /api/portfolio — додати роботу
router.post('/', auth, upload.single('screenshot'), (req, res) => {
  const data = JSON.parse(req.body.data);
  const screenshotUrl = req.file ? `/uploads/portfolio/${req.file.filename}` : '';
  const item = portfolio.insert({ ...data, screenshotUrl, isVisible: true });
  res.json(item);
});

// PATCH /api/portfolio/:id
router.patch('/:id', auth, upload.single('screenshot'), (req, res) => {
  const updates = req.body.data ? JSON.parse(req.body.data) : req.body;
  if (req.file) updates.screenshotUrl = `/uploads/portfolio/${req.file.filename}`;
  res.json(portfolio.update(req.params.id, updates));
});

// DELETE /api/portfolio/:id
router.delete('/:id', auth, (req, res) => {
  portfolio.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

-----

### `src/routes/blog.js`

```javascript
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const blog = new JsonDB('blog.json');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/blog')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/blog — публічний список опублікованих
router.get('/', (req, res) => {
  const posts = blog.all({ isPublished: true })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(posts);
});

// GET /api/blog/:slug — одна стаття по slug
router.get('/:slug', (req, res) => {
  const post = blog.findOne({ slug: req.params.slug, isPublished: true });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

// GET /api/blog/admin/all — всі статті для адміна
router.get('/admin/all', auth, (req, res) => {
  res.json(blog.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// POST /api/blog — створити статтю
router.post('/', auth, upload.single('cover'), (req, res) => {
  const data = JSON.parse(req.body.data);
  const coverUrl = req.file ? `/uploads/blog/${req.file.filename}` : '';
  const post = blog.insert({
    ...data,
    coverUrl,
    isPublished: false,
    publishedAt: null
  });
  res.json(post);
});

// PATCH /api/blog/:id
router.patch('/:id', auth, upload.single('cover'), (req, res) => {
  const updates = req.body.data ? JSON.parse(req.body.data) : req.body;
  if (req.file) updates.coverUrl = `/uploads/blog/${req.file.filename}`;
  if (updates.isPublished && !blog.findById(req.params.id)?.publishedAt) {
    updates.publishedAt = new Date().toISOString();
  }
  res.json(blog.update(req.params.id, updates));
});

// DELETE /api/blog/:id
router.delete('/:id', auth, (req, res) => {
  blog.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

-----

### `src/routes/orders.js`

```javascript
const router = require('express').Router();
const JsonDB = require('../db');
const { generatePrompt } = require('../services/aiBuilder');
const { notifyTelegram } = require('../services/telegram');

const orders = new JsonDB('orders.json');

// POST /api/orders/submit
router.post('/submit', async (req, res) => {
  const { siteType, formData } = req.body;

  if (!formData?.name || !formData?.email || !formData?.phone) {
    return res.status(400).json({ error: 'Заповніть обовʼязкові поля' });
  }

  const order = orders.insert({ siteType, formData, status: 'new' });

  // Відповідаємо одразу — не чекаємо AI
  res.json({ success: true, orderId: order.id });

  // Фонова обробка
  try {
    const prompt = await generatePrompt(siteType, formData);
    orders.update(order.id, { generatedPrompt: prompt, status: 'prompted' });
    await notifyTelegram(order, prompt);
  } catch (err) {
    console.error('AI/Telegram error:', err.message);
    orders.update(order.id, { status: 'error', error: err.message });
  }
});

module.exports = router;
```

-----

### `src/services/aiBuilder.js` — Claude Haiku

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const QUALITY_STANDARDS = `
UNIVERSAL QUALITY STANDARDS (apply to every site regardless of niche):

HERO H1: specific result for client, NOT a job title.
  Good: "Back pain relief after the first session"
  Bad: "Quality massage services"

ABOUT: max 5 sentences + bullet facts with numbers.

SERVICES: outcome + duration + price per each service.
  Good: "Deep tissue massage — relieves chronic tension · 60 min · 800 UAH"

REVIEWS: generate 3 realistic ones — quote + name + age + specific result.

CTA: action button after every 1-2 sections. Form: max 3 fields.
Messengers: Telegram + Viber buttons.

DESIGN: minimalism, generous spacing (section padding min 80px),
single accent color, large headings (H1 min 48px desktop / 32px mobile),
mobile-first.

SEO (mandatory):
- Title: "[Service] [City] — [Name] | [UVP]"
- Meta description: 120-160 chars with keyword + CTA
- Single H1 with "[service] [city]"
- Schema.org LocalBusiness JSON-LD
- Google Maps iframe if address provided
- Open Graph tags
- No heavy libraries, lazy load images

TECHNICAL:
- Pure HTML5 + CSS3 + Vanilla JS
- Files: index.html + style.css + script.js
- IntersectionObserver for fade-in, smooth scroll
- Breakpoints: 768px, 1024px
`.trim();

const SITE_STRUCTURES = {
  landing: `
SITE TYPE: Landing page for a local specialist. Adapt ALL content to the specific niche.
SECTIONS: NAV (sticky) → HERO (H1=result) → ABOUT (photo+bullet facts) →
SERVICES (outcome+duration+price cards) → HOW IT WORKS (3-4 steps) →
REVIEWS (3 realistic) → CONTACT (form + messengers + map)
`.trim(),

  business_card: `
SITE TYPE: Personal portfolio / business card. Adapt to the specific profession.
SECTIONS: NAV → HERO (name+specialization+UVP) → ABOUT (story+approach) →
PORTFOLIO (image grid with descriptions) → SKILLS (tags) → CONTACT
`.trim(),

  menu: `
SITE TYPE: Online menu for food establishment. Adapt categories to the specific place.
SECTIONS: HEADER (name+hours+phone) → HERO (atmospheric) →
MENU (sticky category tabs + item cards: photo+name+description+weight+price) →
ABOUT (place story) → CONTACT (map+hours)
`.trim()
};

const SYSTEM_PROMPT = `
You are a Senior web developer at zvirycholeksandr.com.
Based on client data, generate a detailed technical prompt for Claude Code.

${QUALITY_STANDARDS}

OUTPUT (prompt text only, no explanations):

DEPLOY: /var/www/clients/{slug} → {slug}.zvirycholeksandr.com

DESIGN:
Colors: [niche-appropriate hex palette based on colorStyle]
Fonts: [2 Google Fonts appropriate for niche]

STRUCTURE:
[Every section with exact Ukrainian content, headings, CTAs, measurements]

SEO:
[title] [meta description] [Schema.org JSON-LD] [Open Graph]

TECHNICAL:
[File structure and requirements]
`.trim();

function buildSlug(name = '') {
  const map = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
    'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
    'ю':'yu','я':'ya',' ':'-'
  };
  return name.toLowerCase()
    .split('').map(c => map[c] ?? c).join('')
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').substring(0, 30);
}

async function generatePrompt(siteType, formData) {
  const slug = buildSlug(formData.name || formData.cafeName);
  const structure = SITE_STRUCTURES[siteType] || SITE_STRUCTURES.landing;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `${structure}\n\nCLIENT DATA:\nslug: ${slug}\n${
        Object.entries(formData).map(([k, v]) => `${k}: ${v}`).join('\n')
      }\n\nGenerate the complete Claude Code prompt. All text in Ukrainian.`
    }]
  });

  return response.content[0].text.trim();
}

module.exports = { generatePrompt };
```

-----

### `src/services/telegram.js`

```javascript
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function esc(t) {
  return String(t || '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function send(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: CHAT_ID, text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function notifyTelegram(order, prompt) {
  const f = order.formData;
  const typeMap = { landing: '🎯 Лендінг', business_card: '🪪 Візитка', menu: '🍽️ Меню' };

  await send(`🛎 *Нове замовлення*\n\n📋 *Тип:* ${esc(typeMap[order.siteType] || order.siteType)}\n👤 *Клієнт:* ${esc(f.name || f.cafeName)}\n📱 *Телефон:* ${esc(f.phone)}\n📧 *Email:* ${esc(f.email)}\n🕐 *Час:* ${esc(new Date(order.createdAt).toLocaleString('uk-UA'))}`);

  // Промт розбиваємо якщо > 4000 символів
  const header = `⚡ *Промт для Claude Code:*\n\n`;
  const chunks = [];
  let cur = header;
  for (const line of prompt.split('\n')) {
    const escaped = esc(line) + '\n';
    if ((cur + escaped).length > 4000) { chunks.push(cur); cur = escaped; }
    else cur += escaped;
  }
  if (cur) chunks.push(cur);

  for (const chunk of chunks) {
    await send(chunk);
    await new Promise(r => setTimeout(r, 400));
  }
}

module.exports = { notifyTelegram };
```

-----

## 🌐 FRONTEND — СТОРІНКИ

### `index.html` — Головна

**Секції:**

1. **NAV** — лого `zvirycholeksandr`, посилання: Портфоліо / Блог / Контакти, кнопка “Замовити сайт” (відкриває попап)
1. **HERO** — темний фон, CSS grid анімація, заголовок, підзаголовок, CTA, tech теги
1. **ПРО МЕНЕ** — коротко, стек у вигляді тегів
1. **ПОРТФОЛІО PREVIEW** — 3-4 картки з `portfolio.json` (завантажуються через `fetch('/api/portfolio')`), кнопка “Всі роботи →” → `portfolio.html`
1. **БЛОГ PREVIEW** — 3 останніх статті з `blog.json` (через `fetch('/api/blog')`), кнопка “Всі статті →” → `blog.html`
1. **CTA СЕКЦІЯ** — “Готовий замовити сайт?” + велика кнопка
1. **FOOTER** — навігація, соцмережі, посилання на Privacy / Terms, © 2026

-----

### `portfolio.html` — Всі роботи

**Структура:**

- Заголовок сторінки
- Фільтри: Всі / Лендінг / Візитка / Меню (JS фільтрація по `siteType`)
- Grid карток — завантажується через `fetch('/api/portfolio')`
- Кожна картка: скріншот, назва, ніша, тип — при кліку відкриває **попап**

**Попап роботи (`portfolio.js`):**

```javascript
// Структура попапу:
// [X закрити]
// [Скріншот / фото сайту]
// [Назва проєкту]
// [Ніша і тип сайту]
// [Опис — що зроблено, які технології]
// [Кнопка "Переглянути сайт →" (liveUrl)]
// [Кнопка "Замовити схожий сайт" → відкриває ORDER попап]

function openPortfolioPopup(item) {
  const popup = document.getElementById('portfolio-popup');
  popup.querySelector('.popup-screenshot').src = item.screenshotUrl;
  popup.querySelector('.popup-title').textContent = item.title;
  popup.querySelector('.popup-niche').textContent = `${item.niche} · ${item.siteType}`;
  popup.querySelector('.popup-description').textContent = item.description;
  popup.querySelector('.popup-live-btn').href = item.liveUrl;
  popup.querySelector('.popup-order-btn').onclick = () => openOrderPopup();
  popup.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Закриття по кліку на overlay або [X]
// Закриття по Escape
```

-----

### `blog.html` — Список статей

- Заголовок “Блог”
- Пошук по статтях (JS, фільтрація по title і tags)
- Grid статей: обкладинка + дата + теги + заголовок + excerpt + “Читати →”
- При кліку → `blog-post.html?slug=xxx`

**`blog-post.html`** — шаблон статті:

- Зчитує `?slug=` з URL
- `fetch('/api/blog/' + slug)` → рендерить
- Markdown → HTML через `marked.js` (CDN)
- Обкладинка, дата, теги, заголовок, контент
- В кінці: CTA блок “Потрібен сайт? Замовте зараз” + кнопка

**SEO для блогу:**

- `<title>` і `<meta description>` заповнюються динамічно з даних статті
- Open Graph теги
- Статті мають бути індексовані Google → `sitemap.xml` генерується автоматично

-----

### ORDER ПОПАП — глобальний (у всіх сторінках)

```javascript
// order.js — підключається до всіх сторінок

// Кроки попапу:
// Крок 1: вибір типу сайту (3 картки)
// Крок 2: динамічна форма під тип (ті самі поля що в order.html)
// Крок 3: підтвердження + відправка

// Відправка:
async function submitOrder(formData) {
  const res = await fetch('/api/orders/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  if (res.ok) showSuccessStep(); // "Дякуємо! Зв'яжемось протягом 24 год"
}
```

-----

### `admin/index.html` — Адмінка: Список замовлень

**Авторизація:**

- Сторінка `/admin/login.html` — пароль → `POST /api/admin/login` → JWT в `localStorage`
- Кожен запит з `Authorization: Bearer <token>`
- При 401 → redirect на `/admin/login.html`

**Список замовлень:**

- Статистика: Всього / Нових / В обробці / Виконаних
- Таблиця: дата, клієнт, тип, статус, кнопка “Відкрити”
- Фільтр по статусу

### `admin/order.html` — Деталі замовлення

- Всі дані клієнта з форми
- Textarea з промтом (редагований)
- Кнопка “Зберегти промт” → `PATCH /api/admin/orders/:id`
- Кнопка “Змінити статус” (new / prompted / done)
- Кнопка “Видалити”

### `admin/portfolio.html` — Керування портфоліо

- Список всіх робіт (включно невидимі)
- Кнопка “Додати роботу”:
  - Форма: назва, ніша, тип, опис, технології (теги), URL сайту, завантаження скріншоту
  - `POST /api/portfolio`
- Редагувати / Видалити / Toggle видимості
- Drag-and-drop сортування (через `sortOrder`)

### `admin/blog.html` — Керування блогом

- Список статей з статусом (опубліковано / чернетка)
- Кнопка “Нова стаття”:
  - Поля: slug, заголовок, excerpt, теги, обкладинка (upload)
  - Textarea для Markdown контенту
  - Checkbox “Опублікувати”
  - `POST /api/blog`
- Редагувати / Видалити / Toggle публікації

-----

### `privacy.html` — Конфіденційність

Стандартна сторінка політики конфіденційності. Містить:

- Які дані збираємо (ім’я, email, телефон з форми)
- Як використовуємо (тільки для звʼязку)
- Не передаємо третім особам
- Контакт для запитів

### `terms.html` — Умови використання

- Опис послуг
- Порядок оплати і виконання
- Обмеження відповідальності
- Контакт

### `404.html` — Сторінка помилки

- Великий “404”
- Текст “Сторінку не знайдено”
- Кнопка “← На головну”
- Підключити через Nginx: `error_page 404 /404.html`

-----

## 📦 ЗАЛЕЖНОСТІ

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.0.0",
    "multer": "^1.4.5",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "@anthropic-ai/sdk": "^0.24.0"
  }
}
```

-----

## ⚙️ PM2 (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'zvirycholeksandr',
    script: 'src/index.js',
    cwd: './backend',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: { NODE_ENV: 'production', PORT: 1995 }
  }]
};
```

-----

## 🔑 `.env.example`

```env
PORT=1995
NODE_ENV=production

# Anthropic (Claude Haiku)
ANTHROPIC_API_KEY=sk-ant-...

# JWT для адмінки
JWT_SECRET=мінімум-64-символи-рандомний-рядок

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=your-chat-id
```

-----

## 🌐 NGINX

```nginx
server {
    listen 443 ssl;
    server_name zvirycholeksandr.com www.zvirycholeksandr.com;

    ssl_certificate /etc/letsencrypt/live/zvirycholeksandr.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zvirycholeksandr.com/privkey.pem;

    root /var/www/zvirycholeksandr/frontend;
    index index.html;

    # 404 сторінка
    error_page 404 /404.html;

    # API → Node.js
    location /api/ {
        proxy_pass http://localhost:1995;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:1995;
    }

    # SPA fallback для blog-post
    location /blog/ {
        try_files $uri /blog-post.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(css|js|jpg|png|webp|svg|woff2|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript text/html image/svg+xml;
}

server {
    listen 80;
    server_name zvirycholeksandr.com www.zvirycholeksandr.com;
    return 301 https://$host$request_uri;
}
```

-----

## ✅ КРИТЕРІЇ ГОТОВНОСТІ

**Backend:**

- [ ] Сервер стартує на порту 1995 через PM2
- [ ] `POST /api/orders/submit` → зберігає в JSON → Haiku генерує промт → Telegram
- [ ] CRUD портфоліо з upload скріншотів
- [ ] CRUD блогу з upload обкладинок
- [ ] JWT авторизація адмінки (логін/логаут)

**Frontend:**

- [ ] Головна: портфоліо preview (3-4 картки з API) + блог preview (3 статті з API)
- [ ] `portfolio.html`: grid + фільтр + popup з фото/описом/посиланням + кнопка замовити
- [ ] ORDER попап: 3 кроки, динамічна форма, відправка, success стан
- [ ] `blog.html`: список + пошук. `blog-post.html`: Markdown рендер, SEO теги
- [ ] Адмінка: список замовлень, деталі, портфоліо CRUD, блог CRUD
- [ ] `404.html`, `privacy.html`, `terms.html`
- [ ] Повністю адаптивний дизайн (mobile-first)

-----

## 🚀 ПОРЯДОК ВИКОНАННЯ

1. Backend: JsonDB, auth middleware, routes (orders, portfolio, blog, admin)
1. Multer upload налаштування, папки `uploads/portfolio/` і `uploads/blog/`
1. aiBuilder.js (Claude Haiku) + telegram.js
1. Frontend: `style.css` з design system (кольори, типографіка, компоненти)
1. `index.html` з fetch портфоліо і блогу
1. `portfolio.html` + попап логіка
1. ORDER попап (`order.js`) — підключається до всіх сторінок
1. `blog.html` + `blog-post.html` з marked.js
1. Адмінка: login, orders, portfolio, blog
1. `404.html`, `privacy.html`, `terms.html`
1. Nginx конфіг з `error_page 404`
1. PM2 + .env налаштування

*Починай з backend. Кожен файл з коментарями. try/catch скрізь де async.*
*Зберігати JWT в localStorage адмінки. Перевіряти при кожному запиті до /api/admin/*
