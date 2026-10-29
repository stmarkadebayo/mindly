#!/usr/bin/env bash
# Daily backup of the accounts database.
#   Local copies go to ./backups for 14 days.
#   If RCLONE_REMOTE is set (for example "b2:mindly-backups", after `rclone config`), each copy is also uploaded off the server.
# Cron (as the ubuntu user):  0 3 * * * /opt/mindly/app/deploy/backup.sh >> /opt/mindly/backup.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="$APP_DIR/data/accounts.db"
OUT="$APP_DIR/backups"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$OUT"

# .backup takes a consistent snapshot even while the app is writing. A plain file copy can be corrupt.
sqlite3 "$DB" ".backup '$OUT/accounts-$STAMP.db'"
gzip "$OUT/accounts-$STAMP.db"
echo "backup ok: $OUT/accounts-$STAMP.db.gz"

find "$OUT" -name 'accounts-*.db.gz' -mtime +14 -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT/accounts-$STAMP.db.gz" "$RCLONE_REMOTE"
  echo "uploaded to $RCLONE_REMOTE"
fi
