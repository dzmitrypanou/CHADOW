#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="${SQL_FILE:-$ROOT/deploy/chadow_import.sql}"
DB_USER="${DB_USER:-chadow}"
DB_NAME="${DB_NAME:-chadow}"

while [ $
    case "$1" in
        --user) DB_USER="$2"; shift 2 ;;
        --database) DB_NAME="$2"; shift 2 ;;
        --sql) SQL_FILE="$2"; shift 2 ;;
        *) echo "Неизвестный аргумент: $1" >&2; exit 1 ;;
    esac
done

if [ ! -f "$SQL_FILE" ]; then
    echo "Не найден $SQL_FILE" >&2
    echo "Сгенерируйте: python3 deploy/prepare_db_import.py /path/u2668592_abs.sql deploy/chadow_import.sql" >&2
    exit 1
fi

echo "==> Пересоздаём базу ${DB_NAME}"
mysql -u "$DB_USER" -p -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "==> Импорт ${SQL_FILE}"
mysql -u "$DB_USER" -p "$DB_NAME" < "$SQL_FILE"

echo "==> Миграции схемы"
cd "$ROOT"
php scripts/warmup_schema.php

echo "==> Проверка"
mysql -u "$DB_USER" -p "$DB_NAME" -e "
SELECT 'site_users' AS tbl, COUNT(*) AS cnt FROM site_users
UNION ALL SELECT 'cms_pages', COUNT(*) FROM cms_pages
UNION ALL SELECT 'recruiting_posts', COUNT(*) FROM recruiting_posts
UNION ALL SELECT 'admin_users', COUNT(*) FROM admin_users;
"

echo "База ${DB_NAME} заменена."
