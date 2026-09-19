const DOMAIN = 'https://zvirycholeksandr.com.ua';
const HOST = 'zvirycholeksandr.com.ua';
const KEY = '6d2f840b92c647dba72d16d98f0e5c31';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function absoluteUrl(value) {
  try {
    const url = new URL(value, DOMAIN);
    return url.hostname === HOST && url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

async function notifyUrls(values) {
  if (process.env.DISABLE_INDEXNOW === 'true') return { skipped: true };
  const urlList = [...new Set((Array.isArray(values) ? values : [values]).map(absoluteUrl).filter(Boolean))];
  if (!urlList.length) return { skipped: true };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${DOMAIN}/${KEY}.txt`,
      urlList,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok && response.status !== 202) throw new Error(`IndexNow returned HTTP ${response.status}`);
  return { submitted: urlList.length, status: response.status };
}

function notifyInBackground(values) {
  notifyUrls(values).catch(error => console.warn('IndexNow notification failed:', error.message));
}

module.exports = { notifyUrls, notifyInBackground };
