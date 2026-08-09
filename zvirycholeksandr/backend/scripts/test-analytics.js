const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zv-analytics-'));
process.env.DATA_DIR = tempDir;

const { analyticsMiddleware, getStats, trackContact } = require('../src/services/analytics');
const browserUa = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130 Safari/537.36';

class MockResponse extends EventEmitter {
  constructor(statusCode = 200, contentType = 'text/html; charset=utf-8') {
    super();
    this.statusCode = statusCode;
    this.headers = { 'content-type': contentType };
  }
  append(name, value) { this.headers[name.toLowerCase()] = value; }
  getHeader(name) { return this.headers[name.toLowerCase()]; }
}

function request(pathname, { ua = browserUa, cookie = '', query = {}, status = 200 } = {}) {
  const req = {
    method: 'GET', path: pathname, url: pathname, query, secure: true,
    headers: { 'user-agent': ua, cookie },
    get(name) { return this.headers[String(name).toLowerCase()] || ''; },
  };
  const res = new MockResponse(status);
  analyticsMiddleware(req, res, () => {});
  res.emit('finish');
  return res.headers['set-cookie'] || '';
}

try {
  const setCookie = request('/services/psychologist-site');
  const cookie = setCookie.split(';')[0];
  request('/demos/card-photo', { cookie });
  request('/', { ua: 'Googlebot/2.1' });
  request('/', { query: { utm_source: 'qa', utm_medium: 'browser' } });
  request('/missing-page', { cookie, status: 404 });
  trackContact({ method: 'telegram', page: '/services/psychologist-site' });

  const stats = getStats(7);
  assert.equal(stats.total, 2, 'рахуються лише успішні людські HTML-перегляди');
  assert.equal(stats.sessions, 1, 'два перегляди з одним cookie утворюють один сеанс');
  assert.equal(stats.pages['/services/psychologist-site'], 1, 'динамічна послуга не є ботом');
  assert.equal(stats.pages['/demos/card-photo'], 1, 'демо не є ботом');
  assert.equal(stats.botTotal, 1, 'Googlebot відокремлений від людей');
  assert.equal(stats.notFound['/missing-page'], 1, '404 зберігає конкретний URL');
  assert.equal(stats.contactMethods.telegram, 1, 'контактний клік враховано');
  console.log('✓ Analytics v2 tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
