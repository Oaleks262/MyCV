#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C
export LANG=C

# Безпечний backup JSON-бази. Усі шляхи можна перевизначити через env:
# PROJECT_DIR, DATA_DIR, BACKUP_DIR, KEEP_DAYS, NODE_BIN.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DATA_DIR="${DATA_DIR:-$PROJECT_DIR/backend/data}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
NODE_BIN="${NODE_BIN:-node}"

if [[ ! "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  echo "KEEP_DAYS має бути цілим невід’ємним числом" >&2
  exit 2
fi
if [[ ! -d "$DATA_DIR" ]]; then
  echo "DATA_DIR не існує: $DATA_DIR" >&2
  exit 2
fi
case "$BACKUP_DIR" in
  ""|"/"|"$PROJECT_DIR"|"$DATA_DIR")
    echo "Небезпечний BACKUP_DIR: $BACKUP_DIR" >&2
    exit 2
    ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)-$$"
FINAL_ARCHIVE="$BACKUP_DIR/data-$STAMP.tar.gz"
TMP_ARCHIVE="$(mktemp "$BACKUP_DIR/.data-$STAMP.XXXXXX.tar.gz")"
VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mycv-backup-verify.XXXXXX")"

cleanup() {
  rm -f "$TMP_ARCHIVE"
  rm -rf "$VERIFY_DIR"
}
trap cleanup EXIT

# Перевіряємо вихідні JSON до архівації.
"$NODE_BIN" "$SCRIPT_DIR/verify-data.js" "$DATA_DIR"

# Архів містить лише вміст data/, без .env, коду та інших секретів проєкту.
tar -czf "$TMP_ARCHIVE" -C "$DATA_DIR" .
tar -tzf "$TMP_ARCHIVE" >/dev/null

# Реальна перевірка відновлення: розпаковуємо і повторно читаємо кожен JSON.
tar -xzf "$TMP_ARCHIVE" -C "$VERIFY_DIR"
"$NODE_BIN" "$SCRIPT_DIR/verify-data.js" "$VERIFY_DIR"

mv "$TMP_ARCHIVE" "$FINAL_ARCHIVE"
chmod 600 "$FINAL_ARCHIVE"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$FINAL_ARCHIVE" > "$FINAL_ARCHIVE.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$FINAL_ARCHIVE" > "$FINAL_ARCHIVE.sha256"
fi
[[ -f "$FINAL_ARCHIVE.sha256" ]] && chmod 600 "$FINAL_ARCHIVE.sha256"

# Видаляємо лише архіви з нашим точним шаблоном у визначеній backup-директорії.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'data-*.tar.gz' -o -name 'data-*.tar.gz.sha256' \) -mtime "+$KEEP_DAYS" -delete

SIZE="$(du -h "$FINAL_ARCHIVE" | awk '{print $1}')"
COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'data-*.tar.gz' | wc -l | tr -d ' ')"
echo "[$(date -u +%FT%TZ)] Backup verified: $FINAL_ARCHIVE ($SIZE), total: $COUNT"
