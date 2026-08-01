const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.argv[2] || process.env.DATA_DIR || '');
if ((!process.argv[2] && !process.env.DATA_DIR) || !fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
  console.error('Передайте директорію з JSON-даними або встановіть DATA_DIR');
  process.exit(2);
}

const transliteration = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
  ю: 'yu', я: 'ya',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .split('')
    .map(char => transliteration[char] ?? char)
    .join('')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function readArray(filename) {
  const filepath = path.join(dataDir, filename);
  const records = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (!Array.isArray(records)) throw new Error(`${filename} має містити масив`);
  return { filepath, records };
}

function atomicWrite(filepath, records) {
  const temporary = `${filepath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, filepath);
}

function migratePortfolio() {
  const { filepath, records } = readArray('portfolio.json');
  const used = new Set(records.map(record => record.slug).filter(Boolean));
  let changed = 0;

  for (const record of records) {
    if (record.slug) continue;
    const base = slugify(record.title) || `work-${String(record.id || changed + 1).slice(0, 8)}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    record.slug = slug;
    used.add(slug);
    changed += 1;
  }

  if (changed) atomicWrite(filepath, records);
  else fs.chmodSync(filepath, 0o600);
  console.log(`portfolio.json: додано slug для ${changed} записів`);
}

function migrateBlog() {
  const { filepath, records } = readArray('blog.json');
  let changed = 0;
  for (const record of records) {
    if (record.slug === 'yak-zrobyty-lending-dlya-masozhysta') {
      record.slug = 'yak-zrobyty-lending-dlya-masazhysta';
      changed += 1;
    }
  }
  if (changed) atomicWrite(filepath, records);
  else fs.chmodSync(filepath, 0o600);
  console.log(`blog.json: виправлено slug для ${changed} записів`);
}

try {
  migratePortfolio();
  migrateBlog();
  console.log('Міграцію контенту завершено');
} catch (error) {
  console.error(`Помилка міграції: ${error.message}`);
  process.exit(1);
}
