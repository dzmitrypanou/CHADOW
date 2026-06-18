#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_SRC="$ROOT/deploy/systemd/chadow-battleship-ws.service"
SERVICE_DST="/etc/systemd/system/chadow-battleship-ws.service"

RUN_USER="${SUDO_USER:-$(whoami)}"
RUN_GROUP="$(id -gn "$RUN_USER")"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH" >&2
  exit 1
fi

if [[ ! -d "$ROOT/deploy/battleship-ws/node_modules" ]]; then
  echo "Installing npm dependencies in deploy/battleship-ws..."
  (cd "$ROOT/deploy/battleship-ws" && npm install --omit=dev)
fi

ENV_FILE="$ROOT/deploy/battleship-ws/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(php -r "require '$ROOT/includes/user_bootstrap.php'; require '$ROOT/includes/battleship_helpers.php'; echo battleship_ws_secret(\\Database::getInstance());")"
  if [[ -z "$SECRET" ]]; then
    echo "Failed to read battleship_ws_secret from PHP/site_settings" >&2
    exit 1
  fi
  printf 'BATTLESHIP_WS_SECRET=%s\nBATTLESHIP_WS_PORT=8793\n' "$SECRET" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE with secret from site_settings (PHP and Node will use the same value)."
else
  echo "Using existing $ENV_FILE (ensure BATTLESHIP_WS_SECRET matches site_settings battleship_ws_secret)."
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
sudo systemctl enable chadow-battleship-ws.service
sudo systemctl restart chadow-battleship-ws.service
sleep 1
sudo systemctl status chadow-battleship-ws.service --no-pager || true

echo "Installed chadow-battleship-ws.service"

if ! curl -fsS "http://127.0.0.1:8793/health" >/dev/null 2>&1; then
  echo "Health check failed. Recent logs:" >&2
  sudo journalctl -u chadow-battleship-ws -n 20 --no-pager >&2 || true
  echo "Port 8793 listeners:" >&2
  sudo ss -tlnp | grep 8793 >&2 || true
  exit 1
fi

echo "Health check OK: http://127.0.0.1:8793/health"
