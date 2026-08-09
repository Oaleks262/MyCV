const router = require('express').Router();
const crypto = require('crypto');
const JsonDB = require('../db');
const { generatePrompt } = require('../services/aiBuilder');
const { notifyTelegram } = require('../services/telegram');
const { sendOrderConfirmation } = require('../services/mailer');
const { trackLead } = require('../services/analytics');

const orders = new JsonDB('orders.json');

const TYPE_FIELDS = {
  landing: ['name', 'profession', 'city', 'phone', 'email', 'services', 'about', 'colorStyle', 'designStyle', 'referenceUrl'],
  business_card: ['name', 'profession', 'phone', 'email', 'about', 'skills', 'referenceUrl'],
  menu: ['cafeName', 'name', 'phone', 'email', 'address', 'about', 'colorStyle'],
};

const REQUIRED_FIELDS = {
  landing: ['name', 'profession', 'phone', 'email'],
  business_card: ['name', 'profession', 'phone', 'email'],
  menu: ['cafeName', 'name', 'phone', 'email'],
};

const LONG_FIELDS = new Set(['services', 'about']);
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function fail(res, status, code, error, fields) {
  return res.status(status).json({
    error,
    code,
    ...(fields?.length ? { fields } : {}),
    requestId: res.locals.requestId,
  });
}

function cleanValue(value, max = 240) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function sanitizeFormData(siteType, raw = {}) {
  return Object.fromEntries(TYPE_FIELDS[siteType].map(field => {
    const max = LONG_FIELDS.has(field) ? 4000 : field === 'email' ? 254 : field === 'referenceUrl' ? 500 : 240;
    return [field, cleanValue(raw[field], max)];
  }));
}

function sanitizeMeta(raw = {}, req) {
  const field = (key, max) => cleanValue(raw[key], max);
  const duration = Number(raw.formDurationMs);
  return {
    landingPage: field('landingPage', 500),
    currentPage: field('currentPage', 500),
    referrer: field('referrer', 500),
    utmSource: field('utmSource', 120),
    utmMedium: field('utmMedium', 120),
    utmCampaign: field('utmCampaign', 160),
    utmContent: field('utmContent', 160),
    utmTerm: field('utmTerm', 160),
    gclid: field('gclid', 200),
    formDurationMs: Number.isFinite(duration) ? Math.max(0, Math.min(duration, 24 * 60 * 60 * 1000)) : 0,
    userAgent: cleanValue(req.get('user-agent'), 300),
    requestId: req.requestId,
  };
}

function dedupeKey(siteType, formData) {
  const identity = [
    siteType,
    formData.email.toLowerCase(),
    formData.phone.replace(/\D/g, ''),
    formData.profession || formData.cafeName || '',
  ].join('|');
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function recentDuplicate(key) {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  return orders.all().find(order =>
    order.dedupeKey === key &&
    new Date(order.createdAt).getTime() >= cutoff &&
    !['spam', 'lost'].includes(order.status)
  );
}

// POST /api/orders/submit — прийом нового замовлення
router.post('/submit', async (req, res) => {
  if (!req.is('application/json')) {
    return fail(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Надішліть дані у форматі JSON');
  }
  const body = req.body || {};
  const { siteType } = body;

  const validTypes = ['landing', 'business_card', 'menu'];
  if (!validTypes.includes(siteType)) {
    return fail(res, 400, 'INVALID_SITE_TYPE', 'Невірний тип сайту', ['siteType']);
  }

  // Honeypot: бот отримує нейтральну відповідь, але заявка не зберігається.
  if (cleanValue(body.website, 200)) {
    return res.status(201).json({ success: true, requestId: req.requestId });
  }

  const formData = sanitizeFormData(siteType, body.formData);
  const missingRequired = REQUIRED_FIELDS[siteType].some(field => !formData[field]);
  if (missingRequired) {
    const fields = REQUIRED_FIELDS[siteType].filter(field => !formData[field]);
    return fail(res, 400, 'VALIDATION_ERROR', 'Заповніть обовʼязкові поля', fields);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) {
    return fail(res, 400, 'INVALID_EMAIL', 'Невірний формат email', ['email']);
  }
  const phoneDigits = formData.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return fail(res, 400, 'INVALID_PHONE', 'Невірний формат телефону', ['phone']);
  }

  if (formData.referenceUrl && !/^https?:\/\/[^\s]+$/i.test(formData.referenceUrl)) {
    return fail(res, 400, 'INVALID_REFERENCE_URL', 'Невірний формат посилання', ['referenceUrl']);
  }

  const meta = sanitizeMeta(body.meta, req);
  const leadDedupeKey = dedupeKey(siteType, formData);
  const duplicate = recentDuplicate(leadDedupeKey);
  if (duplicate) {
    return res.status(200).json({
      success: true,
      orderId: duplicate.id,
      deduplicated: true,
      requestId: req.requestId,
    });
  }

  const order = orders.insert({
    siteType,
    formData,
    meta,
    dedupeKey: leadDedupeKey,
    status: 'new',
    automationStatus: 'pending',
    confirmationEmail: { status: 'pending' },
    notification: { status: 'pending' },
  });
  trackLead(meta);

  // Відповідаємо одразу — не чекаємо AI
  res.status(201).json({ success: true, orderId: order.id, deduplicated: false, requestId: req.requestId });

  // Для локальних smoke-тестів: заявка й аналітика зберігаються, зовнішні інтеграції не викликаються.
  if (process.env.DISABLE_LEAD_AUTOMATION === 'true') return;

  // Email-підтвердження клієнту (фонове, не блокує)
  sendOrderConfirmation(order)
    .then(result => orders.update(order.id, {
      confirmationEmail: {
        status: result?.sent ? 'sent' : 'skipped',
        reason: result?.reason || '',
        updatedAt: new Date().toISOString(),
      },
    }))
    .catch(err => {
      console.error('Email confirmation error:', err.message);
      orders.update(order.id, {
        confirmationEmail: { status: 'failed', error: cleanValue(err.message, 500), updatedAt: new Date().toISOString() },
      });
    });

  // Фонова обробка: AI генерує промт → Telegram
  try {
    const prompt = await generatePrompt(siteType, formData);
    orders.update(order.id, { generatedPrompt: prompt, automationStatus: 'prompt_ready' });
    const notification = await notifyTelegram(order, prompt);
    orders.update(order.id, {
      automationStatus: notification?.sent ? 'complete' : 'notification_skipped',
      notification: {
        status: notification?.sent ? 'sent' : 'skipped',
        reason: notification?.reason || '',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('AI/Telegram error:', err.message);
    // Бізнес-статус залишається "new": збій автоматизації не має приховувати новий лід.
    orders.update(order.id, {
      automationStatus: 'failed',
      aiError: cleanValue(err.message, 500),
      notification: { status: 'failed', error: cleanValue(err.message, 500), updatedAt: new Date().toISOString() },
    });
  }
});

module.exports = router;
