/**
 * Email-підтвердження замовлення клієнту.
 *
 * Налаштування в .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=oleksandrzvirich@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx   ← App Password (не звичайний пароль!)
 *   SMTP_FROM=Олександр Звірич <oleksandrzvirich@gmail.com>
 *
 * Для Gmail: Google Account → Security → 2-Step → App Passwords → "Mail"
 */
const nodemailer = require('nodemailer');

const ENABLED = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = ENABLED
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const typeLabels = {
  landing:      'Лендінг',
  business_card:'Сайт-візитка',
  menu:         'Онлайн-меню',
};

async function sendOrderConfirmation(order) {
  if (!ENABLED) return; // email не налаштовано — мовчки пропускаємо

  const name  = order.formData?.name || order.formData?.cafeName || 'Клієнт';
  const email = order.formData?.email;
  if (!email) return;

  const type  = typeLabels[order.siteType] || order.siteType;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      email,
    subject: `✅ Заявку прийнято — ${type} | Олександр Звірич`,
    html: `
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f5f5f5;padding:2rem 0;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0d0d1a;padding:2rem 2rem 1.5rem">
      <div style="font-size:1.3rem;font-weight:700;color:#fff;letter-spacing:-0.01em">
        zviry<span style="color:#8b5cf6">ch</span>oleksandr
      </div>
    </div>
    <div style="padding:2rem">
      <h2 style="margin:0 0 0.5rem;color:#0d0d1a;font-size:1.3rem">Дякуємо, ${name}! 🎉</h2>
      <p style="color:#555;margin:0 0 1.5rem;line-height:1.6">
        Ваша заявка на розробку <strong>${type}</strong> успішно прийнята.
        Я зв'яжусь з вами протягом <strong>24 годин</strong> для обговорення деталей.
      </p>
      <div style="background:#f8f7ff;border:1px solid #e5e0ff;border-radius:8px;padding:1rem 1.25rem;margin-bottom:1.5rem">
        <div style="font-size:0.8rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Ваша заявка</div>
        <div style="color:#0d0d1a;font-weight:600">${type}</div>
        <div style="color:#888;font-size:0.85rem;margin-top:0.25rem">№ ${order.id}</div>
      </div>
      <p style="color:#555;font-size:0.88rem;line-height:1.6;margin:0 0 1.5rem">
        Якщо виникнуть питання — пишіть у Telegram або відповідайте на цей лист.
      </p>
      <a href="https://zvirycholeksandr.com.ua"
         style="display:inline-block;background:#8b5cf6;color:#fff;padding:0.75rem 1.5rem;border-radius:6px;font-weight:600;font-size:0.88rem;text-decoration:none">
        Переглянути сайт
      </a>
    </div>
    <div style="border-top:1px solid #f0f0f0;padding:1rem 2rem;font-size:0.75rem;color:#aaa">
      © 2026 Олександр Звірич · zvirycholeksandr.com.ua
    </div>
  </div>
</body>
</html>`,
  });
}

module.exports = { sendOrderConfirmation };
