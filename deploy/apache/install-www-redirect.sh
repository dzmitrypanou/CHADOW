#!/bin/bash
# www.chadow.ru → https://chadow.ru/
# Запуск на VPS от root: bash /var/www/chadow.ru/deploy/apache/install-www-redirect.sh
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/chadow.ru}"
APACHE_AVAILABLE="/etc/apache2/sites-available"
APACHE_ENABLED="/etc/apache2/sites-enabled"

echo "==> Копируем vhost редиректа www"
cp "$SITE_ROOT/deploy/apache/www-chadow-redirect.conf" "$APACHE_AVAILABLE/"
a2ensite www-chadow-redirect.conf 2>/dev/null || true

echo "==> Убираем www из основного SSL-vhost (иначе он отдаёт сайт вместо редиректа)"
for conf in "$APACHE_ENABLED"/* "$APACHE_AVAILABLE"/*; do
    [ -f "$conf" ] || continue
    case "$conf" in
        *www-chadow-redirect*) continue ;;
        *abs-chadow-redirect*) continue ;;
    esac
    if grep -q 'www\.chadow\.ru' "$conf"; then
        echo "    правим: $conf"
        sed -i '/ServerAlias/{
            s/\bwww\.chadow\.ru\b\s*//g
            s/[[:space:]]\+/ /g
            s/ServerAlias[[:space:]]*$//
        }' "$conf"
        sed -i '/^[[:space:]]*ServerAlias[[:space:]]*$/d' "$conf"
    fi
done

echo "==> Исправляем синтаксис Redirect (если остался старый формат)"
sed -i 's|Redirect permanent https://chadow.ru/|Redirect permanent / https://chadow.ru/|g' \
    "$APACHE_AVAILABLE/abs-chadow-redirect.conf" \
    "$APACHE_ENABLED/abs-chadow-redirect.conf" 2>/dev/null || true

echo "==> Проверка конфигурации Apache"
apache2ctl configtest

echo "==> Перезагрузка Apache"
systemctl reload apache2

echo "==> Проверка редиректа"
curl -sI https://www.chadow.ru/ | tr -d '\r' | grep -E '^(HTTP|Location):' || true

echo "Готово. Ожидается: HTTP/1.1 301 + Location: https://chadow.ru/"
