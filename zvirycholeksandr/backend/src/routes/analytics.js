const router = require('express').Router();
const { trackContact, trackIntent } = require('../services/analytics');

router.post('/event', (req, res) => {
  const body = req.body || {};
  const userAgent = req.get('user-agent') || '';
  if (req.get('x-analytics-ignore') === '1' || !userAgent || /bot|crawler|spider|curl|wget|python|scanner|node-fetch|undici/i.test(userAgent)) {
    return res.status(204).end();
  }

  if (body.event === 'conversion_intent') {
    if (!['order_open', 'demo_view', 'price_estimate'].includes(body.type)) {
      return res.status(400).json({ error: 'Невідомий тип події' });
    }
    trackIntent({ type: body.type, page: String(body.page || '/').slice(0, 300) });
    return res.status(204).end();
  }

  if (body.event !== 'contact_click') return res.status(400).json({ error: 'Невідома подія' });
  if (!['telegram', 'phone', 'email'].includes(body.method)) return res.status(400).json({ error: 'Невідомий спосіб контакту' });

  trackContact({
    method: body.method,
    page: String(body.page || '/').slice(0, 300),
  });
  res.status(204).end();
});

module.exports = router;
