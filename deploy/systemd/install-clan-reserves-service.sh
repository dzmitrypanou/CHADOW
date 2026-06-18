#!/bin/bash

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Запустите скрипт от root: sudo $0" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHADOW_ROOT="${CHADOW_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
RUN_USER="${RUN_USER:-www-data}"
RUN_GROUP="${RUN_GROUP:-$RUN_USER}"
UNIT_NAME="chadow-clan-reserves.service"
UNIT_PATH="/etc/systemd/system/$UNIT_NAME"
TEMPLATE="$SCRIPT_DIR/chadow-clan-reserves.service"

if [[ -z "$PHP_BIN" || ! -x "$PHP_BIN" ]]; then
    echo "PHP CLI не найден. Задайте PHP_BIN=/path/to/php" >&2
    exit 1
fi

if [[ ! -f "$CHADOW_ROOT/scripts/activate_clan_reserves.php" ]]; then
    echo "Не найден $CHADOW_ROOT/scripts/activate_clan_reserves.php" >&2
    exit 1
fi

if ! id "$RUN_USER" &>/dev/null; then
    echo "Пользователь $RUN_USER не существует" >&2
    exit 1
fi

escape_sed() {
    printf '%s' "$1" | sed -e 's/[\\/&|]/\\&/g'
}

CHADOW_ROOT_ESC="$(escape_sed "$CHADOW_ROOT")"
PHP_BIN_ESC="$(escape_sed "$PHP_BIN")"
RUN_USER_ESC="$(escape_sed "$RUN_USER")"
RUN_GROUP_ESC="$(escape_sed "$RUN_GROUP")"

sed \
    -e "s|@CHADOW_ROOT@|$CHADOW_ROOT_ESC|g" \
    -e "s|@PHP_BIN@|$PHP_BIN_ESC|g" \
    -e "s|@RUN_USER@|$RUN_USER_ESC|g" \
    -e "s|@RUN_GROUP@|$RUN_GROUP_ESC|g" \
    "$TEMPLATE" > "$UNIT_PATH"

chmod 644 "$UNIT_PATH"
systemctl daemon-reload
systemctl enable "$UNIT_NAME"
systemctl restart "$UNIT_NAME"

echo "Установлено: $UNIT_PATH"
echo "Статус:      systemctl status $UNIT_NAME"
echo "Логи:        journalctl -u $UNIT_NAME -f"
echo ""
echo "Если в журнале ACCESS_TOKEN_NOT_SPECIFIED — добавьте GAME_TOKEN_ENC_KEY"
echo "в /etc/chadow/env (тот же ключ, что у PHP-FPM) и выполните:"
echo "  sudo systemctl restart $UNIT_NAME"
