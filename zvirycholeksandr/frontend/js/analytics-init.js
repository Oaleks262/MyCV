(function initAnalytics() {
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-46YFL5WZ82');

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-46YFL5WZ82';
    document.head.appendChild(script);
  }

  if (window.__zvContactTracking) return;
  window.__zvContactTracking = true;

  window.trackConversionIntent = function trackConversionIntent(type) {
    if (!['order_open', 'demo_view', 'price_estimate'].includes(type)) return;
    const pagePath = window.location.pathname;
    window.gtag('event', type, { page_path: pagePath });
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'conversion_intent', type, page: pagePath }),
      keepalive: true,
    }).catch(() => {});
  };

  function contactMethod(link) {
    const explicit = link.dataset.contact;
    if (['telegram', 'phone', 'email'].includes(explicit)) return explicit;
    const href = String(link.getAttribute('href') || '');
    if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(href)) return 'telegram';
    if (/^tel:/i.test(href)) return 'phone';
    if (/^mailto:/i.test(href)) return 'email';
    return null;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const method = contactMethod(link);
    if (!method) return;

    const pagePath = window.location.pathname;
    window.gtag('event', 'contact_click', {
      contact_method: method,
      page_path: pagePath,
    });
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'contact_click', method, page: pagePath }),
      keepalive: true,
    }).catch(() => {});
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-concept-id], .ready-product-image')) {
      window.trackConversionIntent('demo_view');
    }
  });

  if (document.body?.dataset.pageType === '404') {
    window.gtag('event', 'page_not_found', {
      page_path: window.location.pathname,
      page_referrer: document.referrer || '',
    });
  }
})();
