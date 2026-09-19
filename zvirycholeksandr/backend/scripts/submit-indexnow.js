const { notifyUrls } = require('../src/services/indexNow');

const DOMAIN = 'https://zvirycholeksandr.com.ua';

async function main() {
  const response = await fetch(`${DOMAIN}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Sitemap returned HTTP ${response.status}`);
  const sitemap = await response.text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim());
  if (!urls.length) throw new Error('Sitemap contains no URLs');
  const result = await notifyUrls(urls);
  console.log(`IndexNow accepted ${result.submitted} URL(s), HTTP ${result.status}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
