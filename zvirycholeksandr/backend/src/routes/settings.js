const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'settings.json');

function read() {
  return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

function write(data) {
  const temporary = `${FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, FILE);
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
