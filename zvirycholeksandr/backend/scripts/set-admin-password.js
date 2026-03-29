/**
 * Скрипт для встановлення пароля адміна
 * Використання: node scripts/set-admin-password.js YOUR_PASSWORD
 */
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const password = process.argv[2];
if (!password) {
  console.error('Використання: node scripts/set-admin-password.js YOUR_PASSWORD');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  const adminFile = path.join(__dirname, '../data/admin.json');
  fs.writeFileSync(adminFile, JSON.stringify({ passwordHash: hash }, null, 2));
  console.log('✓ Пароль встановлено успішно');
});
