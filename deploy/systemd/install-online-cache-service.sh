#!/bin/bash
# Устанавливает systemd-сервис фонового обновления кэша онлайна (цикл каждые 15 с).
#
# Использование (на сервере, от root):
#   sudo CHADOW_ROOT=/var/www/chadow.ru ./deploy/systemd/install-online-cache-service.sh
#
# Переменные:
#   CHADOW_ROOT  — корень сайта (по умолчанию: родитель deploy/systemd)
#   PHP_BIN      — php CLI (по умолчанию: which php)
#   RUN_USER     — пользователь веб-сервера (по умолчанию: www-data)
#   RUN_GROUP    — группа (по умолчанию: как RUN_USER)

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
UNIT_NAME="chadow-online-cache.service"
UNIT_PATH="/etc/systemd/system/$UNIT_NAME"
TEMPLATE="$SCRIPT_DIR/chadow-online-cache.service"

if [[ -z "$PHP_BIN" || ! -x "$PHP_BIN" ]]; then
    echo "PHP CLI не найден. Задайте PHP_BIN=/path/to/php" >&2
    exit 1
fi

if [[ ! -f "$CHADOW_ROOT/scripts/refresh_online_cache.php" ]]; then
    echo "Не найден $CHADOW_ROOT/scripts/refresh_online_cache.php" >&2
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
