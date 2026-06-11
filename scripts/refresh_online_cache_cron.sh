#!/bin/bash
# Запасной одноразовый запуск (если нет systemd --loop).
# Предпочтительно: deploy/systemd/install-online-cache-service.sh
# Cron: */1 * * * * (раз в минуту) или чаще — см. BACKGROUND_REFRESH_INTERVAL_SECONDS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PHP_BIN="${PHP_BIN:-php}"

cd "$ROOT"
exec "$PHP_BIN" "$ROOT/scripts/refresh_online_cache.php"
