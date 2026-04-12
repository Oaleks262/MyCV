const router = require('express').Router();
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const reviews = new JsonDB('reviews.json');

// GET /api/reviews — публічний список схвалених відгуків
router.get('/', (req, res) => {
  const list = reviews.all({ approved: true })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// POST /api/reviews — відправити відгук (публічно, без авторизації)
router.post('/', (req, res) => {
  const { name, project, text, rating } = req.body;
  if (!name || !text) return res.status(400).json({ error: "Ім'я та текст обов'язкові" });
  if (name.length > 80 || text.length > 1000) return res.status(400).json({ error: 'Занадто довгий текст' });
  const r = Number(rating);
  if (r < 1 || r > 5) return res.status(400).json({ error: 'Оцінка від 1 до 5' });

  const record = reviews.insert({
    name: name.trim(),
    project: (project || '').trim(),
    text: text.trim(),
    rating: r,
    approved: false,
  });
  res.json({ success: true, id: record.id });
});

// ─── Адмін ──────────────────────────────────────────────────────────────────

// GET /api/reviews/admin — всі відгуки
router.get('/admin', auth, (req, res) => {
  res.json(reviews.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// PATCH /api/reviews/admin/:id/approve — схвалити
router.patch('/admin/:id/approve', auth, (req, res) => {
  const updated = reviews.update(req.params.id, { approved: true });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

// DELETE /api/reviews/admin/:id — видалити
router.delete('/admin/:id', auth, (req, res) => {
  reviews.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
