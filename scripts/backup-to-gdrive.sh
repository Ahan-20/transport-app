#!/bin/bash
#
# Daily backup of the Sanctum Transport SQLite database to Google Drive.
#
# Reads config from ~/.sanctum-backup-config:
#     BACKUP_URL=https://your-app.up.railway.app/api/admin/backup
#     BACKUP_TOKEN=<the-secret-token-set-on-railway>
#     BACKUP_DIR=$HOME/Google Drive/My Drive/Sanctum Backups
#
# Run by launchd daily (see scripts/com.sanctum.transport.backup.plist).
#
# What it does:
#   1. curl the /api/admin/backup endpoint with the bearer token
#   2. save the response as transport-YYYY-MM-DD.db in BACKUP_DIR
#   3. delete backups older than 60 days so the folder doesn't grow forever
#   4. log success / failure to ~/.sanctum-backup.log

set -euo pipefail

CONFIG="$HOME/.sanctum-backup-config"
LOG="$HOME/.sanctum-backup.log"

log() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG"
}

if [[ ! -f "$CONFIG" ]]; then
  log "FAIL: config file missing at $CONFIG — run scripts/setup-mac-backup.sh first"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG"

: "${BACKUP_URL:?BACKUP_URL not set in $CONFIG}"
: "${BACKUP_TOKEN:?BACKUP_TOKEN not set in $CONFIG}"
: "${BACKUP_DIR:?BACKUP_DIR not set in $CONFIG}"

mkdir -p "$BACKUP_DIR"

DATE="$(date '+%Y-%m-%d')"
DEST="$BACKUP_DIR/transport-$DATE.db"
TMP="$DEST.partial"

# Download to a .partial file first; only rename to the final name on
# success. Stops a half-downloaded backup from masquerading as a real one.
HTTP_CODE=$(curl --silent --show-error --fail-with-body \
  --max-time 120 \
  --header "Authorization: Bearer $BACKUP_TOKEN" \
  --output "$TMP" \
  --write-out '%{http_code}' \
  "$BACKUP_URL" 2>>"$LOG") || {
    log "FAIL: curl exited non-zero (HTTP $HTTP_CODE) — see above"
    rm -f "$TMP"
    exit 1
  }

if [[ "$HTTP_CODE" != "200" ]]; then
  log "FAIL: HTTP $HTTP_CODE from $BACKUP_URL"
  rm -f "$TMP"
  exit 1
fi

# Sanity check: SQLite files start with "SQLite format 3\0".
HEADER=$(head -c 16 "$TMP")
if [[ "$HEADER" != "SQLite format 3"* ]]; then
  log "FAIL: downloaded file isn't a SQLite database"
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$DEST"
SIZE=$(stat -f%z "$DEST" 2>/dev/null || stat -c%s "$DEST")
log "OK: saved $DEST (${SIZE} bytes)"

# Prune backups older than 60 days. Drive will keep them in its trash
# for 30 days after that, so worst-case recovery window is ~90 days.
find "$BACKUP_DIR" -name 'transport-*.db' -type f -mtime +60 -print -delete >> "$LOG" 2>&1 || true
