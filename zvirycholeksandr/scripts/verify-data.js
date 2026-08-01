const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
  console.error('Передайте директорію з JSON-даними');
  process.exit(2);
}

const files = fs.readdirSync(dataDir).filter(name => name.endsWith('.json')).sort();
if (!files.includes('orders.json')) {
  console.error('Backup не містить orders.json');
  process.exit(1);
}

for (const filename of files) {
  const fullPath = path.join(dataDir, filename);
  if (!fs.statSync(fullPath).isFile()) continue;
  try {
    JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    console.error(`Некоректний JSON: ${filename} (${error.message})`);
    process.exit(1);
  }
}

console.log(`JSON verified: ${files.length} file(s)`);
