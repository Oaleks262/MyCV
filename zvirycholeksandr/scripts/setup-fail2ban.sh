#!/bin/bash
# Налаштування Fail2ban для захисту nginx
# Запустити одноразово: bash /var/www/MyCV/zvirycholeksandr/scripts/setup-fail2ban.sh

set -e

echo "=== Встановлення Fail2ban ==="
apt-get install -y fail2ban

echo "=== Налаштування jail для nginx ==="
cat > /etc/fail2ban/jail.d/nginx.conf << 'EOF'
[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 5
bantime  = 3600

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 10
bantime  = 86400
filter   = nginx-botsearch

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
bantime  = 3600
EOF

echo "=== Фільтр для сканерів ==="
cat > /etc/fail2ban/filter.d/nginx-botsearch.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "(GET|POST|HEAD) /(\.git|\.env|wp-admin|phpinfo|\.php|phpmyadmin|passwd) .*" (404|403|400)
ignoreregex =
EOF

echo "=== Перезапуск Fail2ban ==="
systemctl enable fail2ban
systemctl restart fail2ban

echo ""
echo "✅ Fail2ban встановлено і запущено!"
echo ""
echo "Корисні команди:"
echo "  fail2ban-client status          — список jail'ів"
echo "  fail2ban-client status nginx-botsearch — заблоковані IP"
echo "  fail2ban-client unban IP        — розблокувати IP"
