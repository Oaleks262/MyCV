const serviceForm = document.getElementById('service-lead-form');
const serviceFormStartedAt = Date.now();

function currentServiceType() {
  return document.body.dataset.serviceType || 'landing';
}

function readAttribution() {
  const key = 'mycv_lead_attribution';
  const params = new URLSearchParams(window.location.search);
  const current = {
    landingPage: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    referrer: document.referrer.slice(0, 500),
    utmSource: (params.get('utm_source') || '').slice(0, 120),
    utmMedium: (params.get('utm_medium') || '').slice(0, 120),
    utmCampaign: (params.get('utm_campaign') || '').slice(0, 160),
    utmContent: (params.get('utm_content') || '').slice(0, 160),
    utmTerm: (params.get('utm_term') || '').slice(0, 160),
    gclid: (params.get('gclid') || '').slice(0, 200),
  };
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved) return saved;
    sessionStorage.setItem(key, JSON.stringify(current));
  } catch { /* storage може бути вимкнений */ }
  return current;
}

function setServiceError(message) {
  const element = document.getElementById('service-form-error');
  if (element) element.textContent = message;
}

function buildFormData(data) {
  const serviceType = currentServiceType();
  const common = {
    name: String(data.get('name') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    email: String(data.get('email') || '').trim(),
    about: String(data.get('about') || '').trim(),
  };
  const business = String(data.get('business') || '').trim();
  return serviceType === 'menu'
    ? { ...common, cafeName: business }
    : { ...common, profession: business };
}

serviceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  setServiceError('');
  if (!serviceForm.reportValidity()) return;

  const button = serviceForm.querySelector('button[type="submit"]');
  const fallback = document.getElementById('service-form-fallback');
  const raw = new FormData(serviceForm);
  const serviceType = currentServiceType();
  const attribution = readAttribution();
  button.disabled = true;
  button.textContent = 'Надсилаю…';
  if (fallback) fallback.hidden = true;

  try {
    const response = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteType: serviceType,
        formData: buildFormData(raw),
        website: String(raw.get('website') || ''),
        meta: {
          ...attribution,
          currentPage: `${window.location.pathname}${window.location.search}`.slice(0, 500),
          formDurationMs: Date.now() - serviceFormStartedAt,
        },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не вдалося надіслати запит');

    serviceForm.hidden = true;
    const success = document.getElementById('service-form-success');
    success.hidden = false;
    success.focus();
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { currency: 'UAH', site_type: serviceType, form_variant: 'service_page' });
    }
  } catch (error) {
    setServiceError(error.message || 'Не вдалося надіслати форму.');
    if (fallback) fallback.hidden = false;
    button.disabled = false;
    button.textContent = 'Надіслати запит →';
  }
});
