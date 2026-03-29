const router = require('express').Router();
const JsonDB = require('../db');
const { generatePrompt } = require('../services/aiBuilder');
const { notifyTelegram } = require('../services/telegram');

const orders = new JsonDB('orders.json');

// POST /api/orders/submit — прийом нового замовлення
router.post('/submit', async (req, res) => {
  const { siteType, formData } = req.body;

  if (!formData?.name || !formData?.email || !formData?.phone) {
    return res.status(400).json({ error: 'Заповніть обовʼязкові поля' });
  }

  const order = orders.insert({ siteType, formData, status: 'new' });

  // Відповідаємо одразу — не чекаємо AI
  res.json({ success: true, orderId: order.id });

  // Фонова обробка: Claude Haiku генерує промт → Telegram
  try {
    const prompt = await generatePrompt(siteType, formData);
    orders.update(order.id, { generatedPrompt: prompt, status: 'prompted' });
    await notifyTelegram(order, prompt);
  } catch (err) {
    console.error('AI/Telegram error:', err.message);
    orders.update(order.id, { status: 'error', error: err.message });
  }
});

module.exports = router;
