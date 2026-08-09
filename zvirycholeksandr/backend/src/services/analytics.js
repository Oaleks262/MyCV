/**
 * Легка server-side аналітика без персональних даних.
 *
 * Поля human* належать до чистого обліку v2. Старі total/pages/referrers
 * залишаються у файлі як архів, але більше не потрапляють у звіт.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');
const SESSION_COOKIE = 'zv_session';
const SESSION_MAX_AGE_SECONDS = 30 * 60;

const BOT_UA = /bot|crawler|spider|curl|wget|python|scanner|go-http-client|java|ruby|okhttp|libwww|zgrab|masscan|nmap|axios|node-fetch|undici|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|yandex|semrush|ahrefs|mj12bot|dotbot/i;
const SCANNER_PATH = /\.(php|asp|aspx|env|git|bak|sql|sh|cgi|old|bkp|backup|tmp|swp|ini|cfg|conf|log|zip|gz|tar|py|rb|yml|yaml|json|toml|lock|jar|war|ear)$/i;
const SENSITIVE_PATH = /\/(\.git|\.env|wp-admin|wp-login|wp-config|phpinfo|phpmyadmin|passwd|shadow|@fs|actuator|\.well-known\/sensitive|config|setup|install)/i;
const ENCODED_ATTACK = /%22|%27|%3[Cc]|%3[Ee]|%00|%0[Aa]|%0[Dd]/i;
const STATIC_OR_INTERNAL = /\.(css|js|png|jpg|jpeg|ico|svg|webp|woff2?|gif|map|txt|xml)$/i;

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}

function save(data) {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, DATA_FILE);
}

function ensureDay(data, date) {
  if (!data[date]) data[date] = {};
  const day = data[date];
  day.analyticsVersion = 2;
  day.humanPageviews ||= 0;
  day.humanPages ||= {};
  day.humanReferrers ||= {};
  day.sessions ||= 0;
  day.sessionIds ||= {};
  day.bots ||= {};
  day.notFound ||= {};
  day.contactClicks ||= 0;
  day.contactMethods ||= {};
  day.contactPages ||= {};
  day.leads ||= 0;
  day.leadSources ||= {};
  day.leadPages ||= {};
  return day;
}

function safeKey(value, fallback = 'Інше', max = 200) {
  const cleaned = String(value || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, max);
  return cleaned || fallback;
}

function increment(bucket, key, limit = 100) {
  const candidate = safeKey(key);
  const safe = ['__proto__', 'prototype', 'constructor'].includes(candidate) ? 'Інше' : candidate;
  if (!Object.prototype.hasOwnProperty.call(bucket, safe) && Object.keys(bucket).length >= limit) {
    bucket['Інші'] = (bucket['Інші'] || 0) + 1;
    return;
  }
  bucket[safe] = (bucket[safe] || 0) + 1;
}

function parseReferrer(ref) {
  if (!ref) return 'Прямий перехід';
  if (/zvirycholeksandr\.com\.ua|78\.27\.236\.157|localhost|127\.0\.0\.1/i.test(ref)) return null;
  if (/google/i.test(ref)) return 'Google';
  if (/instagram/i.test(ref)) return 'Instagram';
  if (/facebook|fb\.com/i.test(ref)) return 'Facebook';
  if (/t\.me|telegram/i.test(ref)) return 'Telegram';
  if (/linkedin/i.test(ref)) return 'LinkedIn';
  if (/medium\.com/i.test(ref)) return 'Medium';
  if (/chatgpt\.com|chat\.openai\.com/i.test(ref)) return 'ChatGPT';
  if (/youtube/i.test(ref)) return 'YouTube';
  if (/bing/i.test(ref)) return 'Bing';
  if (/scraperforce|semrush|ahrefs|moz\.com|majestic|similarweb|serpstat|spyfu/i.test(ref)) return null;
  try { return new URL(ref).hostname; }
  catch { return 'Інше'; }
}

function trafficSource(req) {
  const source = safeKey(req.query?.utm_source, '', 80).toLowerCase();
  const medium = safeKey(req.query?.utm_medium, '', 80).toLowerCase();
  if (source) return medium ? `${source} / ${medium}` : source;
  return parseReferrer(req.headers.referer || req.headers.referrer || '');
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(value => {
    const index = value.indexOf('=');
    if (index < 0) return ['', ''];
    return [value.slice(0, index).trim(), value.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

function sessionHash(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const current = /^[A-Za-z0-9_-]{20,80}$/.test(cookies[SESSION_COOKIE] || '')
    ? cookies[SESSION_COOKIE]
    : crypto.randomBytes(18).toString('base64url');
  const secure = req.secure || req.get('x-forwarded-proto') === 'https' ? '; Secure' : '';
  res.append('Set-Cookie', `${SESSION_COOKIE}=${current}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`);
  return crypto.createHash('sha256').update(current).digest('hex').slice(0, 24);
}

function isInternalOrStatic(req) {
  return req.method !== 'GET'
    || req.path.startsWith('/api')
    || req.path.startsWith('/uploads')
    || req.path.startsWith('/admin')
    || STATIC_OR_INTERNAL.test(req.path);
}

function isQaRequest(req) {
  return req.get('x-analytics-ignore') === '1'
    || /^qa$/i.test(String(req.query?.utm_source || ''))
    || /^browser$/i.test(String(req.query?.utm_medium || ''));
}

function isScannerRequest(req, ua) {
  return !ua || BOT_UA.test(ua) || SCANNER_PATH.test(req.path) || SENSITIVE_PATH.test(req.path) || ENCODED_ATTACK.test(req.url);
}

function recordBot(page) {
  try {
    const data = load();
    const day = ensureDay(data, new Date().toISOString().split('T')[0]);
    increment(day.bots, safeKey(page, '/', 200));
    save(data);
  } catch { /* аналітика не повинна ламати сайт */ }
}

function recordHumanPage(req, res, id) {
  const status = res.statusCode;
  const contentType = String(res.getHeader('content-type') || '');
  if (!contentType.includes('text/html')) return;

  const page = safeKey(req.path, '/', 200);
  try {
    const data = load();
    const day = ensureDay(data, new Date().toISOString().split('T')[0]);

    if (status === 404) {
      increment(day.notFound, page);
      save(data);
      return;
    }
    if (status < 200 || status >= 400) return;

    day.humanPageviews += 1;
    increment(day.humanPages, page);
    const source = trafficSource(req);
    if (source) increment(day.humanReferrers, source);

    if (!day.sessionIds[id] && Object.keys(day.sessionIds).length < 5000) {
      day.sessionIds[id] = true;
      day.sessions += 1;
    }
    save(data);
  } catch { /* аналітика не повинна ламати сайт */ }
}

function analyticsMiddleware(req, res, next) {
  if (isInternalOrStatic(req) || isQaRequest(req)) return next();

  const ua = req.headers['user-agent'] || '';
  if (isScannerRequest(req, ua)) {
    recordBot(req.path || '/');
    return next();
  }

  const id = sessionHash(req, res);
  res.on('finish', () => recordHumanPage(req, res, id));
  next();
}

function trackLead(meta = {}) {
  const today = new Date().toISOString().split('T')[0];
  const page = safeKey(String(meta.currentPage || meta.landingPage || '/').split('?')[0], '/');
  const source = safeKey(meta.utmSource || parseReferrer(meta.referrer) || 'Прямий перехід', 'Прямий перехід', 120);

  try {
    const data = load();
    const day = ensureDay(data, today);
    day.leads += 1;
    increment(day.leadPages, page);
    increment(day.leadSources, source);
    save(data);
  } catch { /* заявка не повинна падати через статистику */ }
}

function trackContact(meta = {}) {
  const method = ['telegram', 'phone', 'email'].includes(meta.method) ? meta.method : 'other';
  const page = safeKey(String(meta.page || '/').split('?')[0], '/');
  try {
    const data = load();
    const day = ensureDay(data, new Date().toISOString().split('T')[0]);
    day.contactClicks += 1;
    increment(day.contactMethods, method);
    increment(day.contactPages, page);
    save(data);
  } catch { /* контактна подія не повинна ламати сайт */ }
}

function addEntries(target, source) {
  for (const [key, value] of Object.entries(source || {})) target[key] = (target[key] || 0) + value;
}

function sortedObject(value, limit = Infinity) {
  return Object.fromEntries(Object.entries(value).sort((a, b) => b[1] - a[1]).slice(0, limit));
}

function getStats(days = 30) {
  const data = load();
  const result = {
    analyticsVersion: 2,
    daily: {}, pages: {}, referrers: {}, total: 0, sessions: 0,
    leads: 0, leadSources: {}, leadPages: {}, conversionRate: 0,
    bots: {}, botTotal: 0, notFound: {}, notFoundTotal: 0,
    contactClicks: 0, contactMethods: {}, contactPages: {}, legacyTotal: 0,
  };
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Math.max(1, days) + 1);

  for (const [date, day] of Object.entries(data)) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || parsed < cutoff) continue;
    const pageviews = day.humanPageviews || 0;
    result.daily[date] = pageviews;
    result.total += pageviews;
    result.sessions += day.sessions || 0;
    result.leads += day.leads || 0;
    result.contactClicks += day.contactClicks || 0;
    result.legacyTotal += day.total || 0;
    addEntries(result.pages, day.humanPages);
    addEntries(result.referrers, day.humanReferrers);
    addEntries(result.leadSources, day.leadSources);
    addEntries(result.leadPages, day.leadPages);
    addEntries(result.contactMethods, day.contactMethods);
    addEntries(result.contactPages, day.contactPages);
    addEntries(result.bots, day.bots);
    addEntries(result.notFound, day.notFound);
  }

  result.pages = sortedObject(result.pages, 100);
  result.referrers = sortedObject(result.referrers, 100);
  result.leadSources = sortedObject(result.leadSources, 100);
  result.leadPages = sortedObject(result.leadPages, 100);
  result.contactMethods = sortedObject(result.contactMethods, 20);
  result.contactPages = sortedObject(result.contactPages, 100);
  result.bots = sortedObject(result.bots, 100);
  result.notFound = sortedObject(result.notFound, 100);
  result.botTotal = Object.values(result.bots).reduce((sum, value) => sum + value, 0);
  result.notFoundTotal = Object.values(result.notFound).reduce((sum, value) => sum + value, 0);
  result.conversionRate = result.sessions ? Number(((result.leads / result.sessions) * 100).toFixed(1)) : 0;
  return result;
}

module.exports = { analyticsMiddleware, getStats, trackLead, trackContact };
