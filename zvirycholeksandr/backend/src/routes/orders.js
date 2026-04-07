const router = require('express').Router();
const JsonDB = require('../db');
const { generatePrompt } = require('../services/aiBuilder');
const { notifyTelegram } = require('../services/telegram');
const { sendOrderConfirmation } = require('../services/mailer');

const orders = new JsonDB('orders.json');

// POST /api/orders/submit — прийом нового замовлення
router.post('/submit', async (req, res) => {
  const { siteType, formData } = req.body;

  const validTypes = ['landing', 'business_card', 'menu'];
  if (!validTypes.includes(siteType)) {
    return res.status(400).json({ error: 'Невірний тип сайту' });
  }
  if (!formData?.name || !formData?.email || !formData?.phone) {
    return res.status(400).json({ error: 'Заповніть обовʼязкові поля' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) {
    return res.status(400).json({ error: 'Невірний формат email' });
  }
  const phoneDigits = formData.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return res.status(400).json({ error: 'Невірний формат телефону' });
  }

  const order = orders.insert({ siteType, formData, status: 'new' });

  // Відповідаємо одразу — не чекаємо AI
  res.json({ success: true, orderId: order.id });

  // Email-підтвердження клієнту (фонове, не блокує)
  sendOrderConfirmation(order).catch(err =>
    console.error('Email confirmation error:', err.message)
  );

  // Фонова обробка: AI генерує промт → Telegram
  try {
    const prompt = await generatePrompt(siteType, formData);
    orders.update(order.id, { generatedPrompt: prompt, status: 'prompted' });
    await notifyTelegram(order, prompt);
  } catch (err) {
    console.error('AI/Telegram error:', err.message);
    // Залишаємо статус 'new' — замовлення валідне, тільки AI не спрацював
    orders.update(order.id, { aiError: err.message });
  }
});

module.exports = router;
