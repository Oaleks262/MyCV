const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { invalidateToken } = require('../middleware/auth');
const JsonDB = require('../db');
const { getStats } = require('../services/analytics');
const { sendCompleteWorkEmail } = require('../services/mailer');

// Brute-force захист: 5 спроб на 15 хвилин
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Забагато спроб входу. Спробуйте через 15 хвилин.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orders = new JsonDB('orders.json');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
const adminFile = path.join(DATA_DIR, 'admin.json');
const ORDER_STATUSES = new Set(['new', 'prompted', 'contacted', 'qualified', 'in_progress', 'done', 'lost', 'spam', 'error']);

function cleanText(value, max) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function cleanFormData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, fieldValue]) => [
    cleanText(key, 80),
    cleanText(fieldValue, 4000),
  ]));
}

// In-memory store для 2FA кодів: { sessionId: { code, expires } }
const twoFACodes = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/admin/login — крок 1: перевірка пароля → надсилає 2FA код
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Пароль обовʼязковий' });

    const admin = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Невірний пароль' });

    // Генеруємо 2FA код
    const code = generateCode();
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    twoFACodes.set(sessionId, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 хвилин

    // Надсилаємо в Telegram
    const https = require('https');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const body = JSON.stringify({
        chat_id: chatId,
        text: `🔐 *Код входу в адмінку:*\n\n\`${code}\`\n\n_Діє 5 хвилин_`,
        parse_mode: 'Markdown'
      });
      const tgReq = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      });
      tgReq.write(body);
      tgReq.end();
    }

    res.json({ requireCode: true, sessionId });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// POST /api/admin/verify-code — крок 2: перевірка 2FA коду → видає JWT
router.post('/verify-code', loginLimiter, (req, res) => {
  const { sessionId, code } = req.body;
  if (!sessionId || !code) return res.status(400).json({ error: 'Невірний запит' });

  const entry = twoFACodes.get(sessionId);
  if (!entry) return res.status(401).json({ error: 'Сесія не знайдена або прострочена' });
  if (Date.now() > entry.expires) {
    twoFACodes.delete(sessionId);
    return res.status(401).json({ error: 'Код прострочений. Спробуйте увійти знову.' });
  }
  if (entry.code !== String(code).trim()) {
    return res.status(401).json({ error: 'Невірний код' });
  }

  twoFACodes.delete(sessionId);
  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });

  // httpOnly cookie — захист HTML-файлів адмінки на рівні сервера
  res.setHeader('Set-Cookie', [
    `admin_auth=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=604800',
    'Secure',
  ].join('; '));

  res.json({ token });
});

// POST /api/admin/logout — відкликаємо токен
router.post('/logout', auth, (req, res) => {
  invalidateToken(req.token);
  res.setHeader('Set-Cookie', 'admin_auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ success: true });
});

// POST /api/admin/change-password
router.post('/change-password', loginLimiter, auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Всі поля обов\'язкові' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Пароль мінімум 8 символів' });

    const admin = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Невірний поточний пароль' });

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    const temporary = `${adminFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(admin), { mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, adminFile);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// GET /api/admin/orders — всі замовлення
router.get('/orders', auth, (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const all = orders.all(filter).sort((a, b) =>
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
  const current = orders.findById(req.params.id);
  if (!current) return res.status(404).json({ error: 'Not found' });
  const { status, prompt, generatedPrompt, notes, formData, nextFollowUpAt } = req.body || {};
  const patch = {};
  if (status !== undefined) {
    if (!ORDER_STATUSES.has(status)) return res.status(400).json({ error: 'Невірний статус' });
    patch.status = status;
    const now = new Date().toISOString();
    if (!current.firstContactAt && ['contacted', 'qualified', 'in_progress', 'done'].includes(status)) patch.firstContactAt = now;
    if (['done', 'lost'].includes(status)) patch.closedAt = now;
  }
  const promptValue = generatedPrompt !== undefined ? generatedPrompt : prompt;
  if (promptValue !== undefined) patch.generatedPrompt = cleanText(promptValue, 12000);
  if (notes !== undefined) patch.notes = cleanText(notes, 4000);
  if (formData !== undefined) {
    const cleaned = cleanFormData(formData);
    if (!cleaned) return res.status(400).json({ error: 'Невірні дані клієнта' });
    patch.formData = cleaned;
  }
  if (nextFollowUpAt !== undefined) {
    if (nextFollowUpAt === '' || nextFollowUpAt === null) patch.nextFollowUpAt = null;
    else {
      const followUp = new Date(nextFollowUpAt);
      if (Number.isNaN(followUp.getTime())) return res.status(400).json({ error: 'Невірна дата нагадування' });
      patch.nextFollowUpAt = followUp.toISOString();
    }
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Немає полів для оновлення' });
  const updated = orders.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', auth, (req, res) => {
  orders.delete(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/orders/:id/complete — надіслати клієнту email з готовою роботою
router.post('/orders/:id/complete', auth, async (req, res) => {
  try {
    const { siteUrl, message, credentials } = req.body;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl обов\'язковий' });

    const order = orders.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });

    const result = await sendCompleteWorkEmail(order, { siteUrl, message: message || '', credentials: credentials || '' });
    if (!result?.sent) {
      return res.status(503).json({ error: 'Email не надіслано: перевірте SMTP-налаштування' });
    }
    orders.update(order.id, {
      completionEmail: { status: 'sent', sentAt: new Date().toISOString(), siteUrl: cleanText(siteUrl, 500) },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('complete email error:', err);
    res.status(500).json({ error: 'Помилка надсилання листа' });
  }
});

// GET /api/admin/analytics?days=30
router.get('/analytics', auth, (req, res) => {
  const days = Math.max(1, Math.min(parseInt(req.query.days) || 30, 365));
  res.json(getStats(days));
});

module.exports = router;
