/**
 * Легка server-side аналітика.
 * Зберігає щоденні агрегати в data/analytics.json:
 * { "2026-04-04": { total, pages: {"/":N}, referrers: {"Google":N} } }
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}

function save(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, DATA_FILE);
}

function ensureDay(data, date) {
  if (!data[date]) data[date] = { total: 0, pages: {}, referrers: {}, leads: 0, leadSources: {}, leadPages: {} };
  data[date].pages ||= {};
  data[date].referrers ||= {};
  data[date].leadSources ||= {};
  data[date].leadPages ||= {};
  data[date].leads ||= 0;
  return data[date];
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
  // Фільтруємо відомі скрапери та спам-реферери
  if (/scraperforce|semrush|ahrefs|moz\.com|majestic|similarweb|serpstat|spyfu/i.test(ref)) return null;
  try { return new URL(ref).hostname; }
  catch { return 'Інше'; }
}

// Middleware — записує перегляди сторінок
function analyticsMiddleware(req, res, next) {
  const ua = req.headers['user-agent'] || '';
  const skip = req.path.startsWith('/api')
    || req.path.startsWith('/uploads')
    || req.path.startsWith('/admin')
    || req.path === '/blog-post'
    || /\.(css|js|png|jpg|jpeg|ico|svg|webp|woff2?|gif|map|txt|xml)$/i.test(req.path)
    // Розширений фільтр шляхів сканерів
    || /\.(php|asp|aspx|env|git|bak|sql|sh|cgi|old|bkp|backup|tmp|swp|ini|cfg|conf|log|zip|gz|tar|py|rb|yml|yaml|json|toml|lock|jar|war|ear)$/i.test(req.path)
    || /\/(\.git|\.env|wp-admin|wp-login|wp-config|phpinfo|phpmyadmin|passwd|shadow|@fs|actuator|\.well-known\/sensitive|config|setup|install)/i.test(req.path)
    || /%22|%27|%3[Cc]|%3[Ee]|%00|%0[Aa]|%0[Dd]/i.test(req.path)
    // Порожній або підозрілий UA — реальні браузери завжди надсилають UA
    || !ua
    || /bot|crawler|spider|curl|wget|python|scanner|go-http-client|java|ruby|okhttp|libwww|zgrab|masscan|nmap|axios|node-fetch|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|yandex|semrush|ahrefs|mj12bot|dotbot/i.test(ua);

  if (!skip) {
    const today = new Date().toISOString().split('T')[0];
    const page  = req.path || '/';
    const src   = parseReferrer(req.headers.referer || req.headers.referrer || '');

    try {
      const data = load();
      const day = ensureDay(data, today);
      day.total = (day.total || 0) + 1;
      day.pages[page] = (day.pages[page] || 0) + 1;
      if (src) day.referrers[src] = (day.referrers[src] || 0) + 1;
      save(data);
    } catch { /* не ламаємо сервер через статистику */ }
  }

  next();
}

function trackLead(meta = {}) {
  const today = new Date().toISOString().split('T')[0];
  const page = String(meta.currentPage || meta.landingPage || '/').split('?')[0].slice(0, 200) || '/';
  const source = String(meta.utmSource || parseReferrer(meta.referrer) || 'Прямий перехід').slice(0, 120);

  try {
    const data = load();
    const day = ensureDay(data, today);
    day.leads += 1;
    day.leadPages[page] = (day.leadPages[page] || 0) + 1;
    day.leadSources[source] = (day.leadSources[source] || 0) + 1;
    save(data);
  } catch { /* заявка не повинна падати через статистику */ }
}

// Повертає агреговані дані за останні N днів
function getStats(days = 30) {
  const data = load();
  const result = { daily: {}, pages: {}, referrers: {}, total: 0, leads: 0, leadSources: {}, leadPages: {}, conversionRate: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  for (const [date, day] of Object.entries(data)) {
    if (new Date(date) < cutoff) continue;
    result.daily[date] = day.total || 0;
    result.total += day.total || 0;
    result.leads += day.leads || 0;

    for (const [p, n] of Object.entries(day.pages || {}))
      result.pages[p] = (result.pages[p] || 0) + n;
    for (const [r, n] of Object.entries(day.referrers || {}))
      result.referrers[r] = (result.referrers[r] || 0) + n;
    for (const [r, n] of Object.entries(day.leadSources || {}))
      result.leadSources[r] = (result.leadSources[r] || 0) + n;
    for (const [p, n] of Object.entries(day.leadPages || {}))
      result.leadPages[p] = (result.leadPages[p] || 0) + n;
  }

  // Сортуємо
  result.pages = Object.fromEntries(Object.entries(result.pages).sort((a,b) => b[1]-a[1]).slice(0,10));
  result.referrers = Object.fromEntries(Object.entries(result.referrers).sort((a,b) => b[1]-a[1]));
  result.leadSources = Object.fromEntries(Object.entries(result.leadSources).sort((a,b) => b[1]-a[1]));
  result.leadPages = Object.fromEntries(Object.entries(result.leadPages).sort((a,b) => b[1]-a[1]));
  result.conversionRate = result.total ? Number(((result.leads / result.total) * 100).toFixed(1)) : 0;

  return result;
}

module.exports = { analyticsMiddleware, getStats, trackLead };
