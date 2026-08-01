#!/usr/bin/env bash
set -Eeuo pipefail

# Сумісний entrypoint для старого cron-шляху.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/../../scripts/backup.sh" "$@"
