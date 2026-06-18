#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PHP_BIN="${PHP_BIN:-php}"

cd "$ROOT"
exec "$PHP_BIN" "$ROOT/scripts/activate_clan_reserves.php"
