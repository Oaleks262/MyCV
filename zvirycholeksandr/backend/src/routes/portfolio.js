const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const portfolio = new JsonDB('portfolio.json');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/portfolio');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer для завантаження скріншотів
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Тільки зображення дозволені'));
  }
});

// GET /api/portfolio — публічний (тільки visible)
router.get('/', (req, res) => {
  const items = portfolio.all({ isVisible: true })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.json(items);
});

// GET /api/portfolio/all — адмін (всі)
router.get('/all', auth, (req, res) => {
  res.json(portfolio.all().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
});

// GET /api/portfolio/:id — одна робота
router.get('/:id', (req, res) => {
  const item = portfolio.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// POST /api/portfolio — додати роботу
router.post('/', auth, upload.single('screenshot'), (req, res) => {
  try {
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const screenshotUrl = req.file ? `/uploads/portfolio/${req.file.filename}` : '';
    const item = portfolio.insert({ ...data, screenshotUrl, isVisible: true });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/portfolio/:id
router.patch('/:id', auth, upload.single('screenshot'), (req, res) => {
  try {
    const updates = req.body.data ? JSON.parse(req.body.data) : req.body;
    if (req.file) updates.screenshotUrl = `/uploads/portfolio/${req.file.filename}`;
    const updated = portfolio.update(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/portfolio/:id
router.delete('/:id', auth, (req, res) => {
  portfolio.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
