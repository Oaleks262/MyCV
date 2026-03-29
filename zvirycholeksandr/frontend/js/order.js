/* ===== ORDER POPUP — підключається до всіх сторінок ===== */

const SITE_TYPES = {
  landing: {
    label: '🎯 Лендінг',
    desc: 'Продаючий сайт для місцевого спеціаліста',
    fields: [
      { name: 'name', label: "Ваше ім'я *", type: 'text', required: true },
      { name: 'profession', label: 'Ваша професія *', type: 'text', required: true },
      { name: 'city', label: 'Місто', type: 'text' },
      { name: 'phone', label: 'Телефон *', type: 'tel', required: true },
      { name: 'email', label: 'Email *', type: 'email', required: true },
      { name: 'services', label: 'Ваші послуги та ціни', type: 'textarea' },
      { name: 'about', label: 'Про себе (досвід, сертифікати)', type: 'textarea' },
      { name: 'colorStyle', label: 'Стиль кольорів', type: 'select',
        options: ['warm', 'cool', 'neutral', 'dark'],
        optionLabels: ['Теплий', 'Холодний', 'Нейтральний', 'Темний'] },
      { name: 'designStyle', label: 'Стиль дизайну', type: 'select',
        options: ['modern', 'classic', 'minimal'],
        optionLabels: ['Сучасний', 'Класичний', 'Мінімалістичний'] },
      { name: 'referenceUrl', label: 'Сайт-референс (посилання)', type: 'url' }
    ]
  },
  business_card: {
    label: '🪪 Сайт-візитка',
    desc: 'Персональне портфоліо або сторінка фахівця',
    fields: [
      { name: 'name', label: "Ваше ім'я *", type: 'text', required: true },
      { name: 'profession', label: 'Ваша професія *', type: 'text', required: true },
      { name: 'phone', label: 'Телефон *', type: 'tel', required: true },
      { name: 'email', label: 'Email *', type: 'email', required: true },
      { name: 'about', label: 'Розкажіть про себе', type: 'textarea' },
      { name: 'skills', label: 'Навички / технології', type: 'text' },
      { name: 'referenceUrl', label: 'Приклад для натхнення', type: 'url' }
    ]
  },
  menu: {
    label: '🍽️ Онлайн-меню',
    desc: 'Меню для кафе, ресторану або доставки',
    fields: [
      { name: 'cafeName', label: 'Назва закладу *', type: 'text', required: true },
      { name: 'name', label: 'Контактна особа *', type: 'text', required: true },
      { name: 'phone', label: 'Телефон *', type: 'tel', required: true },
      { name: 'email', label: 'Email *', type: 'email', required: true },
      { name: 'address', label: 'Адреса закладу', type: 'text' },
      { name: 'about', label: 'Опишіть заклад', type: 'textarea' },
      { name: 'colorStyle', label: 'Стиль оформлення', type: 'select',
        options: ['warm', 'cool', 'neutral', 'dark'],
        optionLabels: ['Теплий', 'Холодний', 'Нейтральний', 'Темний'] }
    ]
  }
};

let currentStep = 1;
let selectedType = null;

function openOrderPopup() {
  const overlay = document.getElementById('order-popup');
  if (!overlay) return;
  currentStep = 1;
  selectedType = null;
  showStep(1);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeOrderPopup() {
  const overlay = document.getElementById('order-popup');
  overlay?.classList.remove('active');
  document.body.style.overflow = '';
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll('.order-step').forEach(el => {
    el.style.display = el.dataset.step == step ? 'block' : 'none';
  });
  updateStepIndicator(step);
}

function updateStepIndicator(step) {
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 <= step);
  });
}

// Крок 1: вибір типу сайту
document.querySelectorAll('.site-type-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.site-type-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedType = card.dataset.type;
  });
});

function goToStep2() {
  if (!selectedType) {
    alert('Оберіть тип сайту');
    return;
  }
  buildStep2Form();
  showStep(2);
}

// Крок 2: динамічна форма
function buildStep2Form() {
  const container = document.getElementById('order-form-fields');
  if (!container || !selectedType) return;

  const config = SITE_TYPES[selectedType];
  container.innerHTML = config.fields.map(field => {
    if (field.type === 'textarea') {
      return `
        <div class="order-field">
          <label class="order-label">${field.label}</label>
          <textarea name="${field.name}" class="order-input" rows="3" ${field.required ? 'required' : ''}></textarea>
        </div>`;
    }
    if (field.type === 'select') {
      const options = field.options.map((val, i) =>
        `<option value="${val}">${field.optionLabels[i]}</option>`
      ).join('');
      return `
        <div class="order-field">
          <label class="order-label">${field.label}</label>
          <select name="${field.name}" class="order-input">
            ${options}
          </select>
        </div>`;
    }
    return `
      <div class="order-field">
        <label class="order-label">${field.label}</label>
        <input type="${field.type}" name="${field.name}" class="order-input" ${field.required ? 'required' : ''}>
      </div>`;
  }).join('');
}

function goToStep3() {
  const form = document.getElementById('order-form');
  const requiredFields = form?.querySelectorAll('[required]');
  let valid = true;

  requiredFields?.forEach(field => {
    if (!field.value.trim()) {
      field.classList.add('error');
      valid = false;
    } else {
      field.classList.remove('error');
    }
  });

  if (!valid) {
    alert('Заповніть усі обовʼязкові поля');
    return;
  }

  // Заповнюємо резюме
  const form_data = getFormData();
  const summary = document.getElementById('order-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="order-summary-type">${SITE_TYPES[selectedType].label}</div>
      <div class="order-summary-row"><b>Ім'я:</b> ${form_data.name || form_data.cafeName}</div>
      <div class="order-summary-row"><b>Телефон:</b> ${form_data.phone}</div>
      <div class="order-summary-row"><b>Email:</b> ${form_data.email}</div>
    `;
  }
  showStep(3);
}

function getFormData() {
  const form = document.getElementById('order-form');
  if (!form) return {};
  const data = {};
  form.querySelectorAll('[name]').forEach(el => {
    if (el.value.trim()) data[el.name] = el.value.trim();
  });
  return data;
}

async function submitOrder() {
  const btn = document.getElementById('submit-order-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Надсилання...'; }

  try {
    const formData = getFormData();
    const res = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteType: selectedType, formData })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Помилка сервера');
    }

    showStep(4); // Success step
  } catch (err) {
    alert(`Помилка: ${err.message}`);
    if (btn) { btn.disabled = false; btn.textContent = 'Надіслати замовлення'; }
  }
}

// Закриття popup
document.getElementById('order-popup')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeOrderPopup();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOrderPopup();
});

// Кнопки "Замовити сайт" з усіх сторінок
document.querySelectorAll('[data-open-order]').forEach(btn => {
  btn.addEventListener('click', openOrderPopup);
});
