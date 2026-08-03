const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:1995').replace(/\/$/, '');

const staticChecks = [
  ['Головна', '/', 200, 'чому варто обрати вас'],
  ['Послуга', '/services/landing', 200, 'application/ld+json'],
  ['Нішева послуга', '/services/psychologist-site', 200, 'Сайт психолога'],
  ['QR-меню', '/services/qr-menu', 200, 'Створення QR-меню для кафе'],
  ['Sitemap', '/sitemap.xml', 200, '/services/psychologist-site'],
  ['AI robots', '/robots.txt', 200, 'User-agent: OAI-SearchBot'],
  ['LLM index', '/llms.txt', 200, 'Олександр Звірич — створення сайтів'],
  ['Favicon', '/brand-signal.svg', 200, '<svg'],
  ['Social preview', '/og-image-2026.jpg', 200, null, 'image/jpeg'],
  ['Демо психолога', '/demos/landing-psycho', 200, '/assets/demos/psychologist-hero.webp'],
  ['Демо фотографа', '/demos/card-photo', 200, '/assets/demos/photographer-hero.webp'],
  ['Демо QR-меню', '/demos/menu-cafe', 200, '/assets/demos/cafe-hero.webp'],
  ['Демо масажу', '/demos/landing-massage', 200, '/assets/demos/massage-hero.webp'],
  ['Демо нутриціолога', '/demos/card-nutri', 200, '/assets/demos/nutritionist-hero.webp'],
  ['Демо пабу', '/demos/menu-pub', 200, '/assets/demos/pub-hero.webp'],
  ['Візуал психолога', '/assets/demos/psychologist-hero.webp', 200, null, 'image/webp'],
  ['Візуал фотографа', '/assets/demos/photographer-hero.webp', 200, null, 'image/webp'],
  ['Візуал кафе', '/assets/demos/cafe-hero.webp', 200, null, 'image/webp'],
  ['Візуал масажу', '/assets/demos/massage-hero.webp', 200, null, 'image/webp'],
  ['Візуал нутриціолога', '/assets/demos/nutritionist-hero.webp', 200, null, 'image/webp'],
  ['Візуал пабу', '/assets/demos/pub-hero.webp', 200, null, 'image/webp'],
];

async function check(name, pathname, expectedStatus, expectedText, expectedContentType) {
  try {
    const response = await fetch(baseUrl + pathname);
    const body = await response.text();
    const textOk = !expectedText || body.includes(expectedText);
    const contentTypeOk = !expectedContentType || String(response.headers.get('content-type')).includes(expectedContentType);
    const ok = response.status === expectedStatus && textOk && contentTypeOk;
    const details = `${textOk ? '' : ' · відсутній контрольний текст'}${contentTypeOk ? '' : ' · неправильний Content-Type'}`;
    console.log(`${ok ? '✓' : '✗'} ${name}: HTTP ${response.status}${details}`);
    return ok ? 0 : 1;
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    return 1;
  }
}

async function run() {
  let failed = 0;
  for (const args of staticChecks) failed += await check(...args);

  try {
    const portfolioResponse = await fetch(baseUrl + '/api/portfolio');
    const portfolio = await portfolioResponse.json();
    const item = Array.isArray(portfolio) && portfolio.find(entry => entry.slug);
    if (!item) throw new Error('немає опублікованої роботи з slug');
    failed += await check('Портфоліо SSR', '/portfolio', 200, `href="/portfolio/${item.slug}"`);
    failed += await check('Сторінка роботи', `/portfolio/${encodeURIComponent(item.slug)}`, 200, 'CreativeWork');
  } catch (error) {
    console.log(`✗ Портфоліо SSR: ${error.message}`);
    failed += 2;
  }

  try {
    const blogResponse = await fetch(baseUrl + '/api/blog');
    const posts = await blogResponse.json();
    const post = Array.isArray(posts) && posts.find(entry => entry.slug);
    if (!post) throw new Error('немає опублікованої статті з slug');
    failed += await check('Блог SSR', `/blog/${encodeURIComponent(post.slug)}`, 200, 'article:published_time');
    failed += await check('Блог SEO schema', `/blog/${encodeURIComponent(post.slug)}`, 200, 'BreadcrumbList');
    failed += await check('Блог внутрішні посилання', `/blog/${encodeURIComponent(post.slug)}`, 200, 'post-service-link');
  } catch (error) {
    console.log(`✗ Блог SSR: ${error.message}`);
    failed += 3;
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

  try {
    const legacyMenu = await fetch(baseUrl + '/blog/online-menu-qr-cafe-reasons', { redirect: 'manual' });
    const ok = legacyMenu.status === 301 && legacyMenu.headers.get('location') === '/blog/online-menu-qr-cafe-5-prychyn';
    console.log(`${ok ? '✓' : '✗'} Старий URL QR-статті: HTTP ${legacyMenu.status}`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`✗ Старий URL QR-статті: ${error.message}`);
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
