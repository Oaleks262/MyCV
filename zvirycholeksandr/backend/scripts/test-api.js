const baseUrl = String(process.env.API_TEST_BASE_URL || 'http://127.0.0.1:1995').replace(/\/$/, '');
const target = new URL(baseUrl);

if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
  console.error('API contract test дозволено запускати лише локально');
  process.exit(1);
}

async function request(pathname, options = {}) {
  return fetch(baseUrl + pathname, {
    ...options,
    headers: { 'x-analytics-ignore': '1', ...(options.headers || {}) },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(response) {
  return response.json().catch(() => ({}));
}

async function run() {
  const health = await request('/api/health');
  const healthBody = await json(health);
  assert(health.status === 200 && healthBody.status === 'ok', 'healthcheck не пройдено');
  assert(health.headers.get('x-request-id') === healthBody.requestId, 'request ID не збігається');
  console.log('✓ Health і request ID');

  const ready = await request('/api/ready');
  const readyBody = await json(ready);
  assert(ready.status === 200 && readyBody.status === 'ready' && readyBody.checks.json === 'ok', 'readiness не пройдено');
  console.log('✓ Readiness перевіряє JSON-сховища');

  const malformed = await request('/api/orders/submit', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken',
  });
  const malformedBody = await json(malformed);
  assert(malformed.status === 400 && malformedBody.code === 'INVALID_JSON', 'пошкоджений JSON не оброблено');
  console.log('✓ Malformed JSON validation');

  const wrongType = await request('/api/orders/submit', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  const wrongTypeBody = await json(wrongType);
  assert(wrongType.status === 415 && wrongTypeBody.code === 'UNSUPPORTED_MEDIA_TYPE', 'немає перевірки Content-Type');
  console.log('✓ Content-Type validation');

  const invalid = await request('/api/orders/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ siteType: 'landing', formData: { name: 'QA' } }),
  });
  const invalidBody = await json(invalid);
  assert(invalid.status === 400 && invalidBody.code === 'VALIDATION_ERROR' && invalidBody.fields.includes('email'), 'validation contract не пройдено');
  console.log('✓ Structured validation error');

  const suffix = Date.now();
  const payload = {
    siteType: 'landing',
    formData: {
      name: 'API QA', profession: 'Локальний тест', phone: '+380671234567',
      email: `api-qa-${suffix}@example.com`, about: 'Перевірка дедуплікації',
    },
    meta: { currentPage: '/api-contract-test', formDurationMs: 5000 },
  };
  const first = await request('/api/orders/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const firstBody = await json(first);
  const second = await request('/api/orders/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const secondBody = await json(second);
  assert(first.status === 201 && firstBody.deduplicated === false, 'перша заявка не створена');
  assert(second.status === 200 && secondBody.deduplicated === true && secondBody.orderId === firstBody.orderId, 'повторна заявка не дедуплікована');
  console.log('✓ Lead deduplication');

  console.log('\nAPI contract tests пройдено.');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
