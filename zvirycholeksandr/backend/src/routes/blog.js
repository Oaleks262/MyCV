const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const JsonDB = require('../db');
const { convertToWebP } = require('../services/imageProcessor');

const blog = new JsonDB('blog.json');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/blog');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMime = /image\/(jpeg|jpg|png|webp|gif)/;
    const allowedExt  = /\.(jpe?g|png|webp|gif)$/i;
    if (allowedMime.test(file.mimetype) || allowedExt.test(file.originalname)) cb(null, true);
    else cb(new Error('Тільки зображення (JPEG, PNG, WebP, GIF)'));
  }
});

// GET /api/blog — публічний список опублікованих
router.get('/', (req, res) => {
  const posts = blog.all({ isPublished: true })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(posts);
});

// GET /api/blog/admin/all — всі статті для адміна
router.get('/admin/all', auth, (req, res) => {
  res.json(blog.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET /api/blog/:slug — одна стаття по slug
router.get('/:slug', (req, res) => {
  const post = blog.findOne({ slug: req.params.slug, isPublished: true });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

function handleUpload(req, res, next) {
  upload.single('cover')(req, res, async err => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Файл завеликий. Максимальний розмір — 15 МБ.'
        : err.message;
      return res.status(400).json({ error: msg });
    }
    if (req.file) {
      try { await convertToWebP(req.file); } catch (e) { console.warn('WebP conversion failed:', e.message); }
    }
    next();
  });
}

// POST /api/blog — створити статтю
router.post('/', auth, handleUpload, (req, res) => {
  try {
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const coverUrl = req.file ? `/uploads/blog/${req.file.filename}` : '';
    const post = blog.insert({
      ...data,
      coverUrl,
      isPublished: false,
      publishedAt: null
    });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/blog/:id
router.patch('/:id', auth, handleUpload, (req, res) => {
  try {
    const updates = req.body.data ? JSON.parse(req.body.data) : req.body;
    if (req.file) updates.coverUrl = `/uploads/blog/${req.file.filename}`;
    // Якщо публікуємо вперше — ставимо publishedAt
    if (updates.isPublished && !blog.findById(req.params.id)?.publishedAt) {
      updates.publishedAt = new Date().toISOString();
    }
    const updated = blog.update(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/blog/:id
router.delete('/:id', auth, (req, res) => {
  blog.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
