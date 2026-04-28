#!/bin/bash
#
# Interactive setup for the daily Sanctum Transport backup on macOS.
#
# Run this ONCE on the user's Mac. It:
#   1. Asks for the Railway URL, the BACKUP_TOKEN, and a Drive folder
#   2. Writes ~/.sanctum-backup-config with chmod 600 (so other users
#      on the Mac can't read the token)
#   3. Tests the connection by hitting the endpoint once
#   4. Installs a launchd plist that runs backup-to-gdrive.sh every day
#      at 02:30 local time (and catches up if the Mac was asleep)
#   5. Loads launchd so it starts immediately
#
# Re-running this is safe — it'll overwrite the existing config + plist.

set -euo pipefail

CONFIG="$HOME/.sanctum-backup-config"
PLIST="$HOME/Library/LaunchAgents/com.sanctum.transport.backup.plist"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-to-gdrive.sh"

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true
fi

echo "Sanctum Transport — daily backup setup"
echo "======================================"
echo

# 1. Collect inputs
read -rp "Railway URL [https://transport-app-production-2353.up.railway.app]: " URL
URL="${URL:-https://transport-app-production-2353.up.railway.app}"
URL="${URL%/}"  # strip trailing slash
ENDPOINT="$URL/api/admin/backup"

read -rsp "BACKUP_TOKEN (paste from Railway → Variables): " TOKEN
echo
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: token cannot be empty."
  exit 1
fi

# Default to a Sanctum Backups folder inside the current user's Drive
DEFAULT_DIR="$HOME/Library/CloudStorage/GoogleDrive-*/My Drive/Sanctum Backups"
read -rp "Backup folder [$HOME/Google Drive/My Drive/Sanctum Backups]: " DIR
DIR="${DIR:-$HOME/Google Drive/My Drive/Sanctum Backups}"

# 2. Write the config
cat > "$CONFIG" <<EOF
BACKUP_URL=$ENDPOINT
BACKUP_TOKEN=$TOKEN
BACKUP_DIR=$DIR
EOF
chmod 600 "$CONFIG"
echo "✓ wrote $CONFIG (chmod 600)"

# 3. Test the connection
echo
echo "Testing connection to $ENDPOINT ..."
HTTP_CODE=$(curl --silent --max-time 30 \
  --header "Authorization: Bearer $TOKEN" \
  --output /tmp/sanctum-backup-test.db \
  --write-out '%{http_code}' \
  "$ENDPOINT" || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  HEADER=$(head -c 16 /tmp/sanctum-backup-test.db)
  rm -f /tmp/sanctum-backup-test.db
  if [[ "$HEADER" == "SQLite format 3"* ]]; then
    echo "✓ test download OK"
  else
    echo "✗ endpoint responded but the file isn't a SQLite database. Check BACKUP_TOKEN."
    exit 1
  fi
else
  rm -f /tmp/sanctum-backup-test.db
  echo "✗ HTTP $HTTP_CODE — check the URL and BACKUP_TOKEN."
  exit 1
fi

# 4. Write the launchd plist
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.sanctum.transport.backup</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$BACKUP_SCRIPT</string>
    </array>

    <!-- Run daily at 02:30 local time. -->
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>2</integer>
      <key>Minute</key><integer>30</integer>
    </dict>

    <!-- If the Mac was asleep at 02:30, run as soon as it wakes. -->
    <key>RunAtLoad</key>
    <false/>

    <key>StandardOutPath</key>
    <string>$HOME/.sanctum-backup.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.sanctum-backup.log</string>
  </dict>
</plist>
EOF
chmod 600 "$PLIST"
echo "✓ wrote $PLIST"

# 5. Reload launchd
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✓ launchd job loaded"

echo
echo "All set. Next backup runs at 02:30 every day."
echo "  - log file:        $HOME/.sanctum-backup.log"
echo "  - manual run:      bash $BACKUP_SCRIPT"
echo "  - disable:         launchctl unload $PLIST"
echo "  - re-run setup:    bash $0"
