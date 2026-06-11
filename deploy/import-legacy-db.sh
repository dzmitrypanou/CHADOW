#!/bin/bash
# Импорт дампа со старого хостинга в БД chadow на VPS.
#
# Рекомендуется готовый файл:
#   bash deploy/replace-db.sh
#
# Или из исходного дампа:
#   python3 deploy/prepare_db_import.py /tmp/u2668592_abs.sql deploy/chadow_import.sql
#   bash deploy/replace-db.sh
#
# Старый вариант (на лету через perl):
#   bash deploy/import-legacy-db.sh /tmp/u2668592_abs.sql
set -euo pipefail

DUMP_PATH="${1:-}"
DB_USER="${DB_USER:-chadow}"
DB_NAME="${DB_NAME:-chadow}"

if [ -z "$DUMP_PATH" ] || [ ! -f "$DUMP_PATH" ]; then
    echo "Укажите путь к SQL-дампу: bash deploy/import-legacy-db.sh /tmp/u2668592_abs.sql" >&2
    exit 1
fi

shift || true
while [ $# -gt 0 ]; do
    case "$1" in
        --user) DB_USER="$2"; shift 2 ;;
        --database) DB_NAME="$2"; shift 2 ;;
        *) echo "Неизвестный аргумент: $1" >&2; exit 1 ;;
    esac
done

PREPARED="/tmp/chadow_import_prepared.sql"

echo "==> Готовим дамп (без FK и устаревших ads/ad_images)"
perl -0777 -pe '
    s/-- Table structure for table `ad_images`.*?-- Table structure for table `/-- Table structure for table `/s;
    s/-- Table structure for table `ads`.*?-- Table structure for table `/-- Table structure for table `/s;
    s/,?\s*CONSTRAINT `[^`]+` FOREIGN KEY \([^)]+\) REFERENCES `[^`]+` \([^)]+\)( ON DELETE (CASCADE|RESTRICT|SET NULL))?//g;
    s/,\s*\n\s*\)/\n)/g;
' "$DUMP_PATH" > "$PREPARED"

echo "==> Пересоздаём базу ${DB_NAME}"
mysql -u "$DB_USER" -p -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "==> Импорт"
mysql -u "$DB_USER" -p "$DB_NAME" < "$PREPARED"

echo "==> Миграции схемы нового кода"
cd "$(dirname "$0")/.."
php scripts/warmup_schema.php

echo "==> Проверка"
mysql -u "$DB_USER" -p "$DB_NAME" -e "
SELECT 'site_users' AS tbl, COUNT(*) AS cnt FROM site_users
UNION ALL SELECT 'cms_pages', COUNT(*) FROM cms_pages
UNION ALL SELECT 'recruiting_posts', COUNT(*) FROM recruiting_posts
UNION ALL SELECT 'tournament_brackets', COUNT(*) FROM tournament_brackets;
"

echo "Готово."
