/**
 * Легка server-side аналітика.
 * Зберігає щоденні агрегати в data/analytics.json:
 * { "2026-04-04": { total, pages: {"/":N}, referrers: {"Google":N} } }
 */
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/analytics.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}

function save(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DATA_FILE);
}

function parseReferrer(ref) {
  if (!ref) return 'Прямий перехід';
  // Ігноруємо внутрішні переходи з власного домену та локального IP
  if (/zvirycholeksandr\.com\.ua/i.test(ref)) return null;
  if (/78\.27\.236\.157/.test(ref)) return null;
  if (/localhost|127\.0\.0\.1/.test(ref)) return null;
  if (/google/i.test(ref))    return 'Google';
  if (/instagram/i.test(ref)) return 'Instagram';
  if (/facebook|fb\.com/i.test(ref)) return 'Facebook';
  if (/t\.me|telegram/i.test(ref))   return 'Telegram';
  if (/youtube/i.test(ref))   return 'YouTube';
  if (/bing/i.test(ref))      return 'Bing';
  try { return new URL(ref).hostname; }
  catch { return 'Інше'; }
}

// Middleware — записує перегляди сторінок
function analyticsMiddleware(req, res, next) {
  const skip = req.path.startsWith('/api')
    || req.path.startsWith('/uploads')
    || req.path.startsWith('/admin')
    || /\.(css|js|png|jpg|jpeg|ico|svg|webp|woff2?|gif|map|txt|xml)$/i.test(req.path)
    // Фільтруємо атаки сканерів і боти
    || /\.(php|asp|aspx|env|git|bak|sql|sh|cgi)$/i.test(req.path)
    || /\/(\.git|\.env|wp-admin|wp-login|phpinfo|phpmyadmin|passwd|shadow|@fs)/i.test(req.path)
    // URL з кодованими символами — ін'єкції (%22=лапки, %27=апостроф, %3C=<, %3E=>)
    || /%22|%27|%3[Cc]|%3[Ee]|%00|%0[Aa]|%0[Dd]/i.test(req.path)
    || /bot|crawler|spider|curl|wget|python|scanner|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|yandex|semrush|ahrefs|mj12bot|dotbot/i.test(req.headers['user-agent'] || '');

  if (!skip) {
    const today = new Date().toISOString().split('T')[0];
    const page  = req.path || '/';
    const src   = parseReferrer(req.headers.referer || req.headers.referrer || '');

    try {
      const data = load();
      if (!data[today]) data[today] = { total: 0, pages: {}, referrers: {} };
      data[today].total = (data[today].total || 0) + 1;
      data[today].pages[page] = (data[today].pages[page] || 0) + 1;
      if (src) data[today].referrers[src] = (data[today].referrers[src] || 0) + 1;
      save(data);
    } catch { /* не ламаємо сервер через статистику */ }
  }

  next();
}

// Повертає агреговані дані за останні N днів
function getStats(days = 30) {
  const data = load();
  const result = { daily: {}, pages: {}, referrers: {}, total: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  for (const [date, day] of Object.entries(data)) {
    if (new Date(date) < cutoff) continue;
    result.daily[date] = day.total || 0;
    result.total += day.total || 0;

    for (const [p, n] of Object.entries(day.pages || {}))
      result.pages[p] = (result.pages[p] || 0) + n;
    for (const [r, n] of Object.entries(day.referrers || {}))
      result.referrers[r] = (result.referrers[r] || 0) + n;
  }

  // Сортуємо
  result.pages = Object.fromEntries(Object.entries(result.pages).sort((a,b) => b[1]-a[1]).slice(0,10));
  result.referrers = Object.fromEntries(Object.entries(result.referrers).sort((a,b) => b[1]-a[1]));

  return result;
}

module.exports = { analyticsMiddleware, getStats };
