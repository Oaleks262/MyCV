const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const FILE = path.join(__dirname, '../../data/settings.json');

function read() {
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/settings — публічний (фронтенд підвантажує при старті)
router.get('/', (req, res) => {
  try {
    res.json(read());
  } catch {
    res.status(500).json({ error: 'Помилка читання налаштувань' });
  }
});

// PUT /api/settings — тільки для адміна
router.put('/', auth, (req, res) => {
  try {
    const current = read();
    const { contacts, colors, about } = req.body;

    if (contacts) current.contacts = { ...current.contacts, ...contacts };
    if (colors)   current.colors   = { ...current.colors,   ...colors };
    if (about)    current.about    = { ...current.about,    ...about };

    write(current);
    res.json(current);
  } catch {
    res.status(500).json({ error: 'Помилка збереження' });
  }
});

module.exports = router;
