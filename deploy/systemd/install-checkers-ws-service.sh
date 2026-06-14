#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_SRC="$ROOT/deploy/systemd/chadow-checkers-ws.service"
SERVICE_DST="/etc/systemd/system/chadow-checkers-ws.service"

RUN_USER="${SUDO_USER:-$(whoami)}"
RUN_GROUP="$(id -gn "$RUN_USER")"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH" >&2
  exit 1
fi

if [[ ! -d "$ROOT/deploy/checkers-ws/node_modules" ]]; then
  echo "Installing npm dependencies in deploy/checkers-ws..."
  (cd "$ROOT/deploy/checkers-ws" && npm install --omit=dev)
fi

TMP="$(mktemp)"
sed \
  -e "s|@RUN_USER@|$RUN_USER|g" \
  -e "s|@RUN_GROUP@|$RUN_GROUP|g" \
  -e "s|@CHADOW_ROOT@|$ROOT|g" \
  -e "s|@NODE_BIN@|$NODE_BIN|g" \
  "$SERVICE_SRC" > "$TMP"

sudo cp "$TMP" "$SERVICE_DST"
rm -f "$TMP"

sudo systemctl daemon-reload
sudo systemctl enable chadow-checkers-ws.service
sudo systemctl restart chadow-checkers-ws.service
sudo systemctl status chadow-checkers-ws.service --no-pager || true

echo "Installed chadow-checkers-ws.service"

ENV_FILE="$ROOT/deploy/checkers-ws/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(php -r "require '$ROOT/includes/user_bootstrap.php'; require '$ROOT/includes/checkers_helpers.php'; echo checkers_ws_secret(\\Database::getInstance());")"
  printf 'CHECKERS_WS_SECRET=%s\n' "$SECRET" > "$ENV_FILE"
  echo "Created $ENV_FILE with secret from site_settings (PHP and Node will use the same value)."
else
  echo "Ensure $ENV_FILE CHECKERS_WS_SECRET matches site_settings checkers_ws_secret (PHP also reads this file)."
fi
