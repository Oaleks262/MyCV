const router = require('express').Router();
const bcrypt = require('bcrypt');
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
const adminFile = path.join(__dirname, '../../data/admin.json');

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Пароль обовʼязковий' });

    const admin = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Невірний пароль' });

    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// POST /api/admin/logout — відкликаємо токен
router.post('/logout', auth, (req, res) => {
  invalidateToken(req.token);
  res.json({ success: true });
});

// POST /api/admin/change-password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Всі поля обов\'язкові' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Пароль мінімум 8 символів' });

    const admin = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Невірний поточний пароль' });

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    fs.writeFileSync(adminFile, JSON.stringify(admin));
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
  const updated = orders.update(req.params.id, req.body);
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

    await sendCompleteWorkEmail(order, { siteUrl, message: message || '', credentials: credentials || '' });
    res.json({ ok: true });
  } catch (err) {
    console.error('complete email error:', err);
    res.status(500).json({ error: 'Помилка надсилання листа' });
  }
});

// GET /api/admin/analytics?days=30
router.get('/analytics', auth, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json(getStats(days));
});

module.exports = router;
