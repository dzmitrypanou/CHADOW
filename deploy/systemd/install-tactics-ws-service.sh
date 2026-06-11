#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_SRC="$ROOT/deploy/systemd/chadow-tactics-ws.service"
SERVICE_DST="/etc/systemd/system/chadow-tactics-ws.service"

RUN_USER="${SUDO_USER:-$(whoami)}"
RUN_GROUP="$(id -gn "$RUN_USER")"
PHP_BIN="$(command -v php || true)"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH" >&2
  exit 1
fi

if [[ ! -d "$ROOT/deploy/tactics-ws/node_modules" ]]; then
  echo "Installing npm dependencies in deploy/tactics-ws..."
  (cd "$ROOT/deploy/tactics-ws" && npm install --omit=dev)
fi

TMP="$(mktemp)"
sed \
  -e "s|@RUN_USER@|$RUN_USER|g" \
  -e "s|@RUN_GROUP@|$RUN_GROUP|g" \
  -e "s|@CHADOW_ROOT@|$ROOT|g" \
  -e "s|@NODE_BIN@|$NODE_BIN|g" \
  -e "s|@PHP_BIN@|${PHP_BIN:-/usr/bin/php}|g" \
  "$SERVICE_SRC" > "$TMP"

sudo cp "$TMP" "$SERVICE_DST"
rm -f "$TMP"

sudo systemctl daemon-reload
sudo systemctl enable chadow-tactics-ws.service
sudo systemctl restart chadow-tactics-ws.service
sudo systemctl status chadow-tactics-ws.service --no-pager || true

echo "Installed chadow-tactics-ws.service"
echo "Create $ROOT/deploy/tactics-ws/.env with TACTICS_WS_SECRET matching site_settings tactics_ws_secret"
