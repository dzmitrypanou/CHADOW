#!/bin/bash

set -euo pipefail

DB_NAME="${DB_NAME:-chadow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/chadow}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DATE="$(date +%F_%H%M)"
FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

mysqldump \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --default-character-set=utf8mb4 \
    "$DB_NAME" | gzip -9 > "$FILE"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete

echo "OK $(date -Is) $FILE ($(du -h "$FILE" | awk '{print $1}'))"
