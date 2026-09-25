const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.argv[2] || process.env.DATA_DIR || '');
if (!dataDir || !fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
  console.error('Передайте директорію з JSON-даними або встановіть DATA_DIR');
  process.exit(2);
}

const demoUrls = {
  'kafe-horobyna': 'https://cafe.zvirycholeksandr.com.ua',
  'bar-berloha': 'https://pub.zvirycholeksandr.com.ua',
  'masazhnyy-kabinet-spokiy': 'https://massage.zvirycholeksandr.com.ua',
  'psykholoh-mariya-dorosh': 'https://psycho.zvirycholeksandr.com.ua',
  'fotohraf-maksym-koval': 'https://photo.zvirycholeksandr.com.ua',
  'nutrytsioloh-alina-dorosh': 'https://nutrition.zvirycholeksandr.com.ua',
};

const filepath = path.join(dataDir, 'portfolio.json');
const records = JSON.parse(fs.readFileSync(filepath, 'utf8'));
if (!Array.isArray(records)) throw new Error('portfolio.json має містити масив');

let changed = 0;
for (const record of records) {
  const liveUrl = demoUrls[record.slug];
  if (!liveUrl || record.liveUrl === liveUrl) continue;
  record.liveUrl = liveUrl;
  record.updatedAt = new Date().toISOString();
  changed += 1;
}

const missing = Object.keys(demoUrls).filter(slug => !records.some(record => record.slug === slug));
if (missing.length) throw new Error(`Не знайдено демо-проєкти: ${missing.join(', ')}`);

if (changed) {
  const temporary = `${filepath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, filepath);
}

console.log(`Оновлено адреси ${changed} демо-проєктів`);
