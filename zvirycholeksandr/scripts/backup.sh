#!/bin/bash
# Щоденний бекап data/ та uploads/
# Запускається через cron: 0 3 * * * /var/www/MyCV/zvirycholeksandr/scripts/backup.sh

PROJECT_DIR="/var/www/MyCV/zvirycholeksandr"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y-%m-%d)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Архівуємо data/ та uploads/
tar -czf "$BACKUP_DIR/backup-$DATE.tar.gz" \
  -C "$PROJECT_DIR/zvirycholeksandr/backend" \
  data uploads \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup created: backup-$DATE.tar.gz"
else
  echo "[$(date)] Backup FAILED" >&2
  exit 1
fi

# Видаляємо бекапи старші за 30 днів
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups cleaned (kept last $KEEP_DAYS days)"
