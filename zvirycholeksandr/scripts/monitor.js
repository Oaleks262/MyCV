/**
 * Моніторинг сайту — перевіряє кожні 5 хвилин
 * Якщо сайт не відповідає — надсилає Telegram сповіщення
 * Запускати через PM2: pm2 start scripts/monitor.js --name monitor
 */
// Шукаємо .env в кількох місцях
const path = require('path');
const envPaths = [
  path.join(__dirname, '../zvirycholeksandr/backend/.env'),
  path.join(__dirname, '../backend/.env'),
  '/var/www/MyCV/zvirycholeksandr/zvirycholeksandr/backend/.env',
];
for (const p of envPaths) {
  if (require('fs').existsSync(p)) { require('dotenv').config({ path: p }); break; }
}
const https = require('https');

const SITE_URL = process.env.SITE_URL || 'https://zvirycholeksandr.com.ua';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 хвилин
const TIMEOUT = 10 * 1000; // 10 секунд

let lastStatus = 'up';
let downSince = null;

// --- Telegram ---
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, resolve);
    req.on('error', () => resolve());
    req.setTimeout(5000, () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

// --- Перевірка сайту ---
function checkSite() {
  return new Promise((resolve) => {
    const req = https.get(SITE_URL, { timeout: TIMEOUT }, (res) => {
      resolve({ ok: res.statusCode < 500, status: res.statusCode });
      res.resume();
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

// --- Головний цикл ---
async function monitor() {
  const result = await checkSite();
  const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

  if (!result.ok && lastStatus === 'up') {
    // Сайт впав
    lastStatus = 'down';
    downSince = now;
    console.error(`[${now}] SITE DOWN — status: ${result.status || result.error}`);
    await sendTelegram(
      `🔴 *Сайт недоступний!*\n\n` +
      `🌐 ${SITE_URL}\n` +
      `📋 Статус: ${result.status || result.error}\n` +
      `🕐 Час: ${now}`
    );
  } else if (result.ok && lastStatus === 'down') {
    // Сайт відновився
    lastStatus = 'up';
    console.log(`[${now}] SITE RECOVERED`);
    await sendTelegram(
      `🟢 *Сайт відновився!*\n\n` +
      `🌐 ${SITE_URL}\n` +
      `⬇️ Був недоступний з: ${downSince}\n` +
      `🕐 Відновлено: ${now}`
    );
    downSince = null;
  } else {
    console.log(`[${now}] OK — ${result.status}`);
  }
}

// Запуск
console.log(`Monitor started — checking ${SITE_URL} every 5 minutes`);
monitor();
setInterval(monitor, CHECK_INTERVAL);
