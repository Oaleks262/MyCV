/* ===== ADMIN PANEL ===== */
const API = '/api';

function escapeAdminHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isAwaitingFirstResponse(order) {
  return !order.firstContactAt && ['new', 'prompted'].includes(order.status);
}

function responseSla(order) {
  const started = new Date(order.createdAt).getTime();
  if (!Number.isFinite(started)) return { label: '—', className: '' };
  const end = order.firstContactAt ? new Date(order.firstContactAt).getTime() : Date.now();
  const hours = Math.max(0, (end - started) / 36e5);
  if (order.firstContactAt) return { label: `Відповідь за ${hours < 1 ? '<1' : Math.round(hours)} год`, className: 'sla-ok' };
  if (!isAwaitingFirstResponse(order)) return { label: '—', className: '' };
  if (hours >= 24) return { label: `${Math.floor(hours)} год без відповіді`, className: 'sla-overdue' };
  return { label: `${Math.max(0, 24 - Math.floor(hours))} год до дедлайну`, className: hours >= 16 ? 'sla-warning' : '' };
}

/* ===== AUTH ===== */
function getToken() { return localStorage.getItem('admin_token'); }
function setToken(t) { localStorage.setItem('admin_token', t); }
function removeToken() { localStorage.removeItem('admin_token'); }

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/admin/login';
  }
}

async function apiRequest(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...opts.headers,
      ...(!(opts.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });
  if (res.status === 401) {
    removeToken();
    window.location.href = '/admin/login';
    return null;
  }
  return res;
}

/* ===== TOAST ===== */
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  existing?.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ===== LOGIN PAGE — логіка в login.html (2FA flow) ===== */

/* ===== MOBILE SIDEBAR TOGGLE ===== */
(function () {
  const burger  = document.getElementById('admin-burger');
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  }

  burger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('active');
  });

  overlay?.addEventListener('click', closeSidebar);

  // Закрити при кліку на пункт меню
  sidebar?.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.addEventListener('click', closeSidebar);
  });
})();

/* ===== LOGOUT ===== */
document.getElementById('logout-btn')?.addEventListener('click', () => {
  removeToken();
  window.location.href = '/admin/login';
});

/* ===== ORDERS LIST PAGE ===== */
async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  requireAuth();

  const filter = document.getElementById('status-filter')?.value || '';

  try {
    const res = await apiRequest('/admin/orders');
    if (!res) return;
    const all = await res.json();

    // Stats
    document.getElementById('stat-total').textContent = all.length;
    document.getElementById('stat-new').textContent = all.filter(o => o.status === 'new').length;
    document.getElementById('stat-overdue').textContent = all.filter(o => {
      if (!isAwaitingFirstResponse(o)) return false;
      return Date.now() - new Date(o.createdAt).getTime() >= 24 * 60 * 60 * 1000;
    }).length;
    document.getElementById('stat-done').textContent = all.filter(o => o.status === 'done').length;

    const orders = filter ? all.filter(o => o.status === filter) : all;

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888">Замовлень немає</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const name = escapeAdminHTML(order.formData?.name || order.formData?.cafeName || '—');
      const phone = String(order.formData?.phone || '');
      const email = String(order.formData?.email || '');
      const telHref = phone.replace(/[^+\d]/g, '');
      const sla = responseSla(order);
      const status = safeStatus(order.status);
      return `<tr>
        <td>${formatDate(order.createdAt)}</td>
        <td>${name}</td>
        <td class="contact-links">
          ${telHref ? `<a href="tel:${escapeAdminHTML(telHref)}">${escapeAdminHTML(phone)}</a>` : ''}
          ${email ? `<a href="mailto:${encodeURIComponent(email)}">${escapeAdminHTML(email)}</a>` : ''}
        </td>
        <td>${siteTypeLabel(order.siteType)}</td>
        <td><span class="badge badge-${status}">${statusLabel(status)}</span></td>
        <td><span class="sla ${sla.className}">${escapeAdminHTML(sla.label)}</span></td>
        <td>
          <a href="/admin/order?id=${encodeURIComponent(order.id)}" class="btn btn-secondary btn-sm">Відкрити</a>
          <button class="btn btn-danger btn-sm" onclick="deleteOrder('${escapeAdminHTML(order.id)}')">✕</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">Помилка завантаження</td></tr>';
  }
}

async function deleteOrder(id) {
  if (!confirm('Видалити замовлення?')) return;
  await apiRequest(`/admin/orders/${id}`, { method: 'DELETE' });
  showToast('Замовлення видалено');
  loadOrders();
}

document.getElementById('status-filter')?.addEventListener('change', loadOrders);

/* ===== ORDER DETAIL PAGE ===== */
async function loadOrderDetail() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;
  requireAuth();

  try {
    const res = await apiRequest(`/admin/orders/${id}`);
    if (!res) return;
    const order = await res.json();

    document.getElementById('order-id').textContent = order.id;
    const detailStatus = safeStatus(order.status);
    document.getElementById('order-status-badge').innerHTML = `<span class="badge badge-${detailStatus}">${statusLabel(detailStatus)}</span>`;
    document.getElementById('order-type').textContent = siteTypeLabel(order.siteType);
    document.getElementById('order-date').textContent = formatDate(order.createdAt);
    document.getElementById('order-first-contact').textContent = order.firstContactAt ? formatDate(order.firstContactAt) : 'Ще не зафіксована';
    const emailStatus = order.confirmationEmail?.status || 'невідомо';
    const notificationStatus = order.notification?.status || 'невідомо';
    document.getElementById('order-delivery').textContent = `Email: ${deliveryLabel(emailStatus)} · Telegram: ${deliveryLabel(notificationStatus)}`;
    document.getElementById('order-landing').textContent = order.meta?.landingPage || order.meta?.currentPage || '—';
    document.getElementById('order-source').textContent = [order.meta?.utmSource, order.meta?.utmMedium, order.meta?.utmCampaign].filter(Boolean).join(' / ') || 'Прямий перехід';
    document.getElementById('order-referrer').textContent = order.meta?.referrer || '—';
    document.getElementById('order-notes').value = order.notes || '';
    document.getElementById('order-follow-up').value = toLocalDateTimeValue(order.nextFollowUpAt);

    // Form data — редаговані поля
    const formDataEl = document.getElementById('order-form-data');
    if (formDataEl) {
      const fieldLabels = { name:'Імʼя', cafeName:'Назва закладу', email:'Email', phone:'Телефон', city:'Місто', description:'Опис', budget:'Бюджет', deadline:'Дедлайн', address:'Адреса', about:'Про заклад', colorStyle:'Стиль кольору', pages:'Сторінки', features:'Функції', language:'Мова' };
      formDataEl.innerHTML = Object.entries(order.formData || {}).map(([k, v]) =>
        `<div class="form-group" style="margin-bottom:.6rem">
          <label class="form-label" style="font-size:.75rem">${escapeAdminHTML(fieldLabels[k] || k)}</label>
          <input type="text" class="form-control" data-field="${escapeAdminHTML(k)}" value="${escapeAdminHTML(v)}" style="padding:.45rem .65rem;font-size:.85rem">
        </div>`
      ).join('');
    }

    // Prompt
    document.getElementById('order-prompt').value = order.generatedPrompt || '';

    // Status select
    const statusSelect = document.getElementById('order-status-select');
    if (statusSelect) statusSelect.value = order.status;
  } catch (e) {
    showToast('Помилка завантаження', 'error');
  }
}

async function saveClientData() {
  const id = new URLSearchParams(window.location.search).get('id');
  const formData = {};
  document.querySelectorAll('#order-form-data [data-field]').forEach(input => {
    formData[input.dataset.field] = input.value;
  });
  const res = await apiRequest(`/admin/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ formData })
  });
  if (res?.ok) showToast('Дані клієнта збережено');
  else showToast('Помилка', 'error');
}

async function saveOrderPrompt() {
  const id = new URLSearchParams(window.location.search).get('id');
  const prompt = document.getElementById('order-prompt').value;
  const res = await apiRequest(`/admin/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ generatedPrompt: prompt })
  });
  if (res?.ok) showToast('Промт збережено');
  else showToast('Помилка збереження', 'error');
}

async function saveOrderStatus() {
  const id = new URLSearchParams(window.location.search).get('id');
  const status = document.getElementById('order-status-select').value;
  const res = await apiRequest(`/admin/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  if (res?.ok) { showToast('Статус оновлено'); loadOrderDetail(); }
  else showToast('Помилка', 'error');
}

async function saveLeadManagement() {
  const id = new URLSearchParams(window.location.search).get('id');
  const notes = document.getElementById('order-notes').value;
  const nextFollowUpAt = document.getElementById('order-follow-up').value;
  const res = await apiRequest(`/admin/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes, nextFollowUpAt })
  });
  if (res?.ok) { showToast('Наступний крок збережено'); loadOrderDetail(); }
  else showToast('Не вдалося зберегти', 'error');
}

async function deleteOrderDetail() {
  if (!confirm('Видалити замовлення? Цю дію не можна скасувати.')) return;
  const id = new URLSearchParams(window.location.search).get('id');
  await apiRequest(`/admin/orders/${id}`, { method: 'DELETE' });
  window.location.href = '/admin/index';
}

/* ===== PORTFOLIO ADMIN ===== */
async function loadAdminPortfolio() {
  const tbody = document.getElementById('portfolio-tbody');
  if (!tbody) return;
  requireAuth();

  try {
    const res = await apiRequest('/portfolio/all');
    if (!res) return;
    const items = await res.json();

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888">Робіт немає</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((item, idx) => `
      <tr>
        <td>${item.screenshotUrl ? `<img src="${item.screenshotUrl}" style="width:60px;height:40px;object-fit:cover;border-radius:4px">` : '—'}</td>
        <td>${item.title}</td>
        <td>${siteTypeLabel(item.siteType)}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${item.isVisible ? 'checked' : ''} onchange="togglePortfolioVisible('${item.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="movePortfolioItem('${item.id}', 'up')" ${idx === 0 ? 'disabled' : ''} title="Вище">↑</button>
          <button class="btn btn-secondary btn-sm" onclick="movePortfolioItem('${item.id}', 'down')" ${idx === items.length - 1 ? 'disabled' : ''} title="Нижче">↓</button>
          <button class="btn btn-secondary btn-sm" onclick="editPortfolioItem('${item.id}')">Редагувати</button>
          <button class="btn btn-danger btn-sm" onclick="deletePortfolioItem('${item.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888">Помилка</td></tr>';
  }
}

async function togglePortfolioVisible(id, val) {
  const res = await apiRequest(`/portfolio/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isVisible: val })
  });
  if (res?.ok) {
    showToast(val ? 'Показано' : 'Приховано');
    loadAdminPortfolio();
  } else {
    showToast('Помилка оновлення', 'error');
  }
}

async function movePortfolioItem(id, direction) {
  const res = await apiRequest('/portfolio/all');
  if (!res) return;
  const items = await res.json(); // вже відсортовані по sortOrder

  const idx = items.findIndex(i => i.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  // Міняємо місцями і призначаємо нові порядкові номери
  const [r1, r2] = await Promise.all([
    apiRequest(`/portfolio/${items[idx].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sortOrder: swapIdx })
    }),
    apiRequest(`/portfolio/${items[swapIdx].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sortOrder: idx })
    })
  ]);

  if (!r1 || !r2) { showToast('Помилка зміни порядку', 'error'); return; }
  loadAdminPortfolio();
}

async function deletePortfolioItem(id) {
  if (!confirm('Видалити роботу?')) return;
  await apiRequest(`/portfolio/${id}`, { method: 'DELETE' });
  showToast('Видалено');
  loadAdminPortfolio();
}

async function savePortfolioItem(e) {
  e.preventDefault();
  const form = document.getElementById('portfolio-form');
  const id = form.dataset.id;
  const formData = new FormData();

  const data = {
    title: form.title.value,
    niche: form.niche.value,
    siteType: form.siteType.value,
    description: form.description.value,
    technologies: form.technologies.value.split(',').map(t => t.trim()).filter(Boolean),
    liveUrl: form.liveUrl.value,
    sortOrder: parseInt(form.sortOrder?.value) || 0
  };

  formData.append('data', JSON.stringify(data));
  if (form.screenshot?.files[0]) {
    formData.append('screenshot', form.screenshot.files[0]);
  }

  const url = id ? `/portfolio/${id}` : '/portfolio';
  const method = id ? 'PATCH' : 'POST';

  const res = await apiRequest(url, { method, body: formData });
  if (res?.ok) {
    showToast(id ? 'Оновлено' : 'Додано');
    closeModal('portfolio-modal');
    loadAdminPortfolio();
  } else {
    showToast('Помилка', 'error');
  }
}

async function editPortfolioItem(id) {
  const res = await apiRequest(`/portfolio/${id}`);
  if (!res) return;
  const item = await res.json();
  const form = document.getElementById('portfolio-form');
  form.dataset.id = id;
  form.title.value = item.title || '';
  form.niche.value = item.niche || '';
  form.siteType.value = item.siteType || 'landing';
  form.description.value = item.description || '';
  form.technologies.value = (item.technologies || []).join(', ');
  form.liveUrl.value = item.liveUrl || '';
  if (form.sortOrder) form.sortOrder.value = item.sortOrder || 0;
  document.getElementById('portfolio-modal-title').textContent = 'Редагувати роботу';
  openModal('portfolio-modal');
}

function openAddPortfolio() {
  const form = document.getElementById('portfolio-form');
  form?.reset();
  delete form?.dataset.id;
  document.getElementById('portfolio-modal-title').textContent = 'Додати роботу';
  openModal('portfolio-modal');
}

/* ===== BLOG ADMIN ===== */
async function loadAdminBlog() {
  const tbody = document.getElementById('blog-tbody');
  if (!tbody) return;
  requireAuth();

  try {
    const res = await apiRequest('/blog/admin/all');
    if (!res) return;
    const posts = await res.json();

    if (!posts.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#888">Статей немає</td></tr>';
      return;
    }

    tbody.innerHTML = posts.map(post => `
      <tr>
        <td>${post.title}</td>
        <td>${formatDate(post.createdAt)}</td>
        <td style="text-align:center">${post.views ? `👁 ${post.views}` : '—'}</td>
        <td><span class="badge badge-${post.isPublished ? 'published' : 'draft'}">${post.isPublished ? 'Опубліковано' : 'Чернетка'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editBlogPost('${post.id}')">Редагувати</button>
          <button class="btn ${post.isPublished ? 'btn-warning' : 'btn-success'} btn-sm" onclick="togglePublish('${post.id}', ${!post.isPublished})">
            ${post.isPublished ? 'Зняти' : 'Опублікувати'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteBlogPost('${post.id}')">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888">Помилка</td></tr>';
  }
}

async function togglePublish(id, publish) {
  const res = await apiRequest(`/blog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublished: publish })
  });
  if (res?.ok) { showToast(publish ? 'Опубліковано' : 'Знято з публікації'); loadAdminBlog(); }
}

async function deleteBlogPost(id) {
  if (!confirm('Видалити статтю?')) return;
  await apiRequest(`/blog/${id}`, { method: 'DELETE' });
  showToast('Видалено');
  loadAdminBlog();
}

async function saveBlogPost(e) {
  e.preventDefault();
  const form = document.getElementById('blog-form');
  const id = form.dataset.id;
  const formData = new FormData();

  const faq = Array.from(document.querySelectorAll('#faq-rows .faq-row')).map(row => ({
    q: row.querySelector('.faq-q').value.trim(),
    a: row.querySelector('.faq-a').value.trim(),
  })).filter(item => item.q && item.a);

  const data = {
    slug: form.slug.value,
    title: form.title.value,
    excerpt: form.excerpt.value,
    content: form.content.value,
    tags: form.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    isPublished: form.isPublished.checked,
    faq,
  };

  formData.append('data', JSON.stringify(data));
  if (form.cover?.files[0]) {
    formData.append('cover', form.cover.files[0]);
  }

  const url = id ? `/blog/${id}` : '/blog';
  const method = id ? 'PATCH' : 'POST';

  const res = await apiRequest(url, { method, body: formData });
  if (res?.ok) {
    showToast(id ? 'Оновлено' : 'Статтю створено');
    closeModal('blog-modal');
    loadAdminBlog();
  } else {
    showToast('Помилка', 'error');
  }
}

async function editBlogPost(id) {
  const res = await apiRequest(`/blog/admin/${id}`);
  if (!res) return;
  const post = await res.json();
  if (!post || post.error) return;

  const form = document.getElementById('blog-form');
  form.dataset.id = id;
  form.slug.value = post.slug || '';
  form.title.value = post.title || '';
  form.excerpt.value = post.excerpt || '';
  form.content.value = post.content || '';
  form.tags.value = (post.tags || []).join(', ');
  form.isPublished.checked = post.isPublished;
  const faqContainer = document.getElementById('faq-rows');
  if (faqContainer) {
    faqContainer.innerHTML = '';
    (post.faq || []).forEach(item => addFaqRow(item.q, item.a));
  }
  document.getElementById('blog-modal-title').textContent = 'Редагувати статтю';
  openModal('blog-modal');
}

function openAddBlog() {
  const form = document.getElementById('blog-form');
  form?.reset();
  delete form?.dataset.id;
  const faqContainer = document.getElementById('faq-rows');
  if (faqContainer) faqContainer.innerHTML = '';
  document.getElementById('blog-modal-title').textContent = 'Нова стаття';
  openModal('blog-modal');
}

/* ===== MODAL HELPERS ===== */
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
  document.body.style.overflow = '';
}

// Закрити модал по оверлею
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

/* ===== UTILS ===== */
function siteTypeLabel(type) {
  const map = { landing: 'Лендінг', business_card: 'Візитка', menu: 'Меню', demo: 'Демо' };
  return map[type] || type;
}
function statusLabel(s) {
  const map = {
    new: 'Новий', prompted: 'Новий', contacted: 'Зв’язались', qualified: 'Кваліфікований',
    in_progress: 'В роботі', done: 'Виконано', lost: 'Не реалізовано', spam: 'Спам', error: 'Помилка'
  };
  return map[s] || s;
}
function safeStatus(status) {
  return ['new','prompted','contacted','qualified','in_progress','done','lost','spam','error'].includes(status) ? status : 'error';
}
function deliveryLabel(status) {
  return ({ sent:'надіслано', pending:'очікує', skipped:'не налаштовано', failed:'помилка' })[status] || status;
}
function toLocalDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// Авто-ініціалізація
loadOrders();
loadOrderDetail();
loadAdminPortfolio();
loadAdminBlog();
