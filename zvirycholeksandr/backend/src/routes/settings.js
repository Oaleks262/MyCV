const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'settings.json');
const COLOR_KEYS = new Set(['accent', 'accentHover', 'bg', 'bg2', 'bg3', 'text', 'textMuted', 'border']);

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
    if (colors) {
      if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
        return res.status(400).json({ error: 'Некоректна кольорова схема' });
      }
      const sanitizedColors = {};
      for (const [key, value] of Object.entries(colors)) {
        if (!COLOR_KEYS.has(key) || !/^#[0-9a-f]{6}$/i.test(String(value))) {
          return res.status(400).json({ error: 'Кольори мають бути у форматі #RRGGBB' });
        }
        sanitizedColors[key] = String(value).toLowerCase();
      }
      current.colors = { ...current.colors, ...sanitizedColors };
    }
    if (about)    current.about    = { ...current.about,    ...about };

    write(current);
    res.json(current);
  } catch {
    res.status(500).json({ error: 'Помилка збереження' });
  }
});

module.exports = router;
