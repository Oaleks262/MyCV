const baseUrl = String(process.env.SEO_AUDIT_BASE_URL || 'https://zvirycholeksandr.com.ua').replace(/\/$/, '');
const origin = new URL(baseUrl).origin;
const publicOrigin = String(process.env.SEO_AUDIT_PUBLIC_ORIGIN || 'https://zvirycholeksandr.com.ua').replace(/\/$/, '');

function fetchTarget(url) {
  const parsed = new URL(url, publicOrigin);
  return parsed.origin === publicOrigin ? `${origin}${parsed.pathname}${parsed.search}` : parsed.href;
}

const fetchPage = url => fetch(fetchTarget(url), {
  headers: { 'user-agent': 'zvirycholeksandr-seo-audit/1.0', 'x-analytics-ignore': '1' },
  redirect: 'follow',
  signal: AbortSignal.timeout(15000),
});

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(url) {
  const parsed = new URL(url, publicOrigin);
  parsed.hash = '';
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.href;
}

function pageSignals(html) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const item = attrs(tag);
    const key = String(item.name || item.property || '').toLowerCase();
    if (key) meta[key] = item.content || '';
  }
  const links = (html.match(/<link\b[^>]*>/gi) || []).map(attrs);
  const canonical = links.find(item => String(item.rel || '').toLowerCase() === 'canonical')?.href || '';
  const title = stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const h1 = html.match(/<h1\b[^>]*>/gi) || [];
  const lang = attrs(html.match(/<html\b[^>]*>/i)?.[0] || '').lang || '';
  const jsonLd = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  const internalLinks = [];
  for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
    const href = attrs(tag).href;
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, publicOrigin);
      if (url.origin === publicOrigin && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api')) internalLinks.push(normalize(url));
    } catch {}
  }
  const missingAlt = (html.match(/<img\b[^>]*>/gi) || []).filter(tag => !Object.hasOwn(attrs(tag), 'alt')).length;
  return { meta, canonical, title, h1, lang, jsonLd, internalLinks, missingAlt, text: stripHtml(html) };
}

async function main() {
  const sitemapResponse = await fetchPage(`${baseUrl}/sitemap.xml`);
  if (!sitemapResponse.ok) throw new Error(`Sitemap: HTTP ${sitemapResponse.status}`);
  const sitemap = await sitemapResponse.text();
  const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => normalize(match[1].trim())))];
  if (!urls.length) throw new Error('Sitemap не містить URL');

  const pages = [];
  const errors = [];
  const warnings = [];
  const linkedUrls = new Set();

  for (const url of urls) {
    const response = await fetchPage(url);
    const html = await response.text();
    const page = { url, status: response.status, ...pageSignals(html) };
    pages.push(page);
    page.internalLinks.forEach(link => linkedUrls.add(link));

    if (response.status !== 200) errors.push(`${url}: HTTP ${response.status}`);
    if (!String(response.headers.get('content-type')).includes('text/html')) errors.push(`${url}: не HTML`);
    if (!/^uk(?:-|$)/i.test(page.lang)) errors.push(`${url}: lang не uk`);
    if (!page.title) errors.push(`${url}: немає title`);
    else if (page.title.length > 68) warnings.push(`${url}: title ${page.title.length} символів`);
    if (!page.meta.description) errors.push(`${url}: немає meta description`);
    else if (page.meta.description.length < 70 || page.meta.description.length > 180) warnings.push(`${url}: description ${page.meta.description.length} символів`);
    if (!page.canonical) errors.push(`${url}: немає canonical`);
    else if (normalize(page.canonical) !== normalize(url)) errors.push(`${url}: canonical веде на ${page.canonical}`);
    if (/noindex/i.test(page.meta.robots || '')) errors.push(`${url}: noindex у sitemap`);
    if (page.h1.length !== 1) errors.push(`${url}: H1 = ${page.h1.length}`);
    if (!page.meta['og:title'] || !page.meta['og:description'] || !page.meta['og:url'] || !page.meta['og:image']) errors.push(`${url}: неповний Open Graph`);
    if (page.missingAlt) warnings.push(`${url}: ${page.missingAlt} img без alt`);
    if (page.text.length < 450) warnings.push(`${url}: лише ${page.text.length} символів видимого тексту`);
    for (const item of page.jsonLd) {
      try { JSON.parse(item); } catch { errors.push(`${url}: невалідний JSON-LD`); }
    }
    if (!page.jsonLd.length) warnings.push(`${url}: немає JSON-LD`);
  }

  const duplicate = (field, label) => {
    const groups = new Map();
    for (const page of pages) {
      const value = field(page);
      if (!value) continue;
      groups.set(value, [...(groups.get(value) || []), page.url]);
    }
    for (const list of groups.values()) if (list.length > 1) errors.push(`Дубль ${label}: ${list.join(', ')}`);
  };
  duplicate(page => page.title, 'title');
  duplicate(page => page.meta.description, 'description');

  const sitemapSet = new Set(urls);
  const candidates = [...linkedUrls].filter(url => !sitemapSet.has(url) && !/\.(?:css|js|png|jpe?g|webp|svg|ico|pdf)$/i.test(new URL(url).pathname));
  for (const url of candidates) {
    const response = await fetchPage(url);
    if (response.status >= 400) errors.push(`Бите внутрішнє посилання: ${url} -> HTTP ${response.status}`);
  }

  console.log(`SEO audit: ${pages.length} URL у sitemap, ${linkedUrls.size} внутрішніх URL`);
  warnings.forEach(item => console.log(`WARN ${item}`));
  errors.forEach(item => console.log(`ERROR ${item}`));
  console.log(`Результат: ${errors.length} помилок, ${warnings.length} попереджень`);
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`SEO audit failed: ${error.message}`);
  process.exitCode = 1;
});
