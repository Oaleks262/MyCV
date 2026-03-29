const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Екранування спецсимволів для MarkdownV2
function esc(t) {
  return String(t || '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function send(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function notifyTelegram(order, prompt) {
  const f = order.formData;
  const typeMap = {
    landing: '🎯 Лендінг',
    business_card: '🪪 Візитка',
    menu: '🍽️ Меню'
  };

  // Перше повідомлення — загальна інформація про замовлення
  await send(
    `🛎 *Нове замовлення*\n\n` +
    `📋 *Тип:* ${esc(typeMap[order.siteType] || order.siteType)}\n` +
    `👤 *Клієнт:* ${esc(f.name || f.cafeName)}\n` +
    `📱 *Телефон:* ${esc(f.phone)}\n` +
    `📧 *Email:* ${esc(f.email)}\n` +
    `🕐 *Час:* ${esc(new Date(order.createdAt).toLocaleString('uk-UA'))}`
  );

  // Промт розбиваємо якщо > 4000 символів
  const header = `⚡ *Промт для Claude Code:*\n\n`;
  const chunks = [];
  let cur = header;
  for (const line of prompt.split('\n')) {
    const escaped = esc(line) + '\n';
    if ((cur + escaped).length > 4000) {
      chunks.push(cur);
      cur = escaped;
    } else {
      cur += escaped;
    }
  }
  if (cur) chunks.push(cur);

  for (const chunk of chunks) {
    await send(chunk);
    await new Promise(r => setTimeout(r, 400));
  }
}

module.exports = { notifyTelegram };
