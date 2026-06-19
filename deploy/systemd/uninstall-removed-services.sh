#!/usr/bin/env bash
# Останавливает и удаляет systemd-юниты снятых сервисов:
# шашки, морской бой, клановые резервы, кэш онлайна WoT.
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
    echo "Запустите с sudo: sudo bash $0" >&2
    exit 1
fi

ROOT="${CHADOW_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"

UNITS=(
    chadow-checkers-ws.service
    chadow-battleship-ws.service
    chadow-clan-reserves.service
    chadow-online-cache.service
)

for unit in "${UNITS[@]}"; do
    if systemctl list-unit-files "$unit" --no-legend 2>/dev/null | grep -q "$unit"; then
        systemctl stop "$unit" 2>/dev/null || true
        systemctl disable "$unit" 2>/dev/null || true
        rm -f "/etc/systemd/system/$unit"
        echo "Removed $unit"
    else
        echo "Skip $unit (not installed)"
    fi
done

systemctl daemon-reload
systemctl reset-failed 2>/dev/null || true

for port in 8792 8793; do
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
        echo "Warning: port $port is still in use:" >&2
        ss -tlnp | grep ":$port " >&2 || true
    fi
done

DEPLOY_DIRS=(
    "$ROOT/deploy/checkers-ws"
    "$ROOT/deploy/battleship-ws"
)

for dir in "${DEPLOY_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        rm -rf "$dir"
        echo "Deleted $dir"
    fi
done

if [[ -f /etc/caddy/Caddyfile ]] && grep -q 'checkers-ws' /etc/caddy/Caddyfile; then
    echo "Warning: /etc/caddy/Caddyfile still references checkers-ws or battleship-ws." >&2
    echo "Deploy updated deploy/caddy/Caddyfile from the repo and run: systemctl reload caddy" >&2
fi

echo "Done. Reload Caddy after deploying config: systemctl reload caddy"
