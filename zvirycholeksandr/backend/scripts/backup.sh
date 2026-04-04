#!/bin/bash
# Автобекап JSON-бази даних
# Зберігає останні 30 днів резервних копій
#
# Налаштування cron (щодня о 3:00):
#   crontab -e
#   0 3 * * * /var/www/MyCV/zvirycholeksandr/backend/scripts/backup.sh >> /var/log/zvirycholeksandr-backup.log 2>&1

SITE_DIR="/var/www/MyCV/zvirycholeksandr"
DATA_DIR="$SITE_DIR/backend/data"
BACKUP_DIR="$SITE_DIR/backups"
DATE=$(date +"%Y-%m-%d_%H-%M")
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Архівуємо data/
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" -C "$SITE_DIR/backend" data/

# Видаляємо бекапи старші за KEEP_DAYS днів
find "$BACKUP_DIR" -name "data_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[$DATE] Backup done → $BACKUP_DIR/data_$DATE.tar.gz"
echo "[$DATE] Total backups: $(ls $BACKUP_DIR/*.tar.gz 2>/dev/null | wc -l)"
