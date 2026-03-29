const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const JsonDB = require('../db');

const blog = new JsonDB('blog.json');

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../../uploads/blog')),
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

// POST /api/blog — створити статтю
router.post('/', auth, upload.single('cover'), (req, res) => {
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
router.patch('/:id', auth, upload.single('cover'), (req, res) => {
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
