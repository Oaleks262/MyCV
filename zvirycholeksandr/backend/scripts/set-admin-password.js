/**
 * Скрипт для встановлення пароля адміна
 * Використання: node scripts/set-admin-password.js YOUR_PASSWORD
 */
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const password = process.argv[2];
if (!password) {
  console.error('Використання: node scripts/set-admin-password.js YOUR_PASSWORD');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '../data');
  fs.mkdirSync(dataDir, { recursive: true });
  const adminFile = path.join(dataDir, 'admin.json');
  const temporary = `${adminFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ passwordHash: hash }, null, 2), { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, adminFile);
  console.log('✓ Пароль встановлено успішно');
});
