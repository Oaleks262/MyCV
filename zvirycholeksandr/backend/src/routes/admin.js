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

// POST /api/admin/logout (клієнт видаляє токен, але можна логувати)
router.post('/logout', auth, (req, res) => {
  res.json({ success: true });
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

module.exports = router;
