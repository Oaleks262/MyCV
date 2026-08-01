const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:1995').replace(/\/$/, '');

const checks = [
  ['Головна', '/', 200, 'чому варто обрати вас'],
  ['Послуга', '/services/landing', 200, 'application/ld+json'],
  ['Портфоліо SSR', '/portfolio', 200, 'portfolio-card-link'],
  ['Сторінка роботи', '/portfolio/masazh-oleny', 200, 'CreativeWork'],
  ['Блог SSR', '/blog/yak-zrobyty-lending-dlya-masazhysta', 200, 'article:published_time'],
  ['Sitemap', '/sitemap.xml', 200, '/services/business-site'],
];

async function run() {
  let failed = 0;
  for (const [name, pathname, expectedStatus, expectedText] of checks) {
    try {
      const response = await fetch(baseUrl + pathname);
      const body = await response.text();
      const ok = response.status === expectedStatus && body.includes(expectedText);
      console.log(`${ok ? '✓' : '✗'} ${name}: HTTP ${response.status}${body.includes(expectedText) ? '' : ' · відсутній контрольний текст'}`);
      if (!ok) failed += 1;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
      failed += 1;
    }
  }

  try {
    const healthResponse = await fetch(baseUrl + '/api/health', { cache: 'no-store' });
    const health = await healthResponse.json();
    const ok = healthResponse.status === 200 && health.status === 'ok';
    console.log(`${ok ? '✓' : '✗'} Healthcheck: ${health.status || healthResponse.status}`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`✗ Healthcheck: ${error.message}`);
    failed += 1;
  }

  try {
    const redirect = await fetch(baseUrl + '/blog/yak-zrobyty-lending-dlya-masozhysta', { redirect: 'manual' });
    const ok = redirect.status === 301 && redirect.headers.get('location') === '/blog/yak-zrobyty-lending-dlya-masazhysta';
    console.log(`${ok ? '✓' : '✗'} Старий URL статті: HTTP ${redirect.status}`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`✗ Старий URL статті: ${error.message}`);
    failed += 1;
  }

  if (failed) {
    console.error(`\nSmoke-тест не пройдено: ${failed} перевірок.`);
    process.exitCode = 1;
  } else {
    console.log('\nУсі smoke-перевірки пройдено.');
  }
}

run();
