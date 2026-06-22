#!/usr/bin/env python3
"""Deploy chadow.ru to remote server via SSH."""
from __future__ import annotations

import os
import shlex
import stat
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = "95.52.245.112"
PORT = 51022
USER = "x64-site"
PASSWORD = "X64Market-site@#$"
ROOT = Path(__file__).resolve().parents[1]
BACKUP = Path(r"d:\chadow_full_backup_20260622_091340.tar.gz")
REMOTE_TMP = "/tmp/chadow_deploy"
SITE_ROOT = "/var/www/chadow.ru"
TEST_ROOT = "/var/www/test.chadow.ru"
DB_NAME = "chadow"
DB_USER = "chadow"
DB_PASS = "hZ2wF3jR2mdL4wE0!"


def log(msg: str) -> None:
    print(msg, flush=True)


def connect() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=60)
    return ssh


def run(ssh: paramiko.SSHClient, cmd: str, sudo: bool = False, timeout: int = 3600) -> tuple[int, str, str]:
    if sudo:
        full = f"sudo -S bash -lc {shlex.quote(cmd)}"
    else:
        full = cmd
    stdin, stdout, stderr = ssh.exec_command(full, timeout=timeout)
    if sudo:
        stdin.write(PASSWORD + "\n")
        stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    err_lines = [
        ln for ln in err.splitlines()
        if not ln.startswith("[sudo]") and "пароль" not in ln.lower() and "password" not in ln.lower()
    ]
    err = "\n".join(err_lines).strip()
    return code, out, err


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    log(f"Uploading {local.name} -> {remote}")
    sftp.put(str(local), remote)


def make_site_tar() -> Path:
    """Pack current repo (excluding dev junk) for upload."""
    fd, path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    tar_path = Path(path)
    exclude_dirs = {
        ".git", "node_modules", "__pycache__", ".cursor",
        "scripts/_wot_extract/.git",
    }
    exclude_prefixes = ("scripts/_",)

    def filt(info: tarfile.TarInfo) -> tarfile.TarInfo | None:
        parts = Path(info.name).parts
        for part in parts:
            if part in exclude_dirs:
                return None
        base = parts[-1] if parts else info.name
        if any(base.startswith(p.rstrip("/").split("/")[-1]) for p in exclude_prefixes):
            if info.name.startswith("scripts/_"):
                return None
        return info

    log("Creating site tarball from repo...")
    with tarfile.open(tar_path, "w:gz") as tar:
        for item in ROOT.iterdir():
            if item.name.startswith(".") and item.name != ".htaccess":
                continue
            tar.add(item, arcname=item.name, filter=filt)
    log(f"Site tarball: {tar_path} ({tar_path.stat().st_size / 1024 / 1024:.1f} MB)")
    return tar_path


REMOTE_SETUP = r"""#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="__REMOTE_TMP__"
SITE_ROOT="__SITE_ROOT__"
TEST_ROOT="__TEST_ROOT__"
DB_NAME="__DB_NAME__"
DB_USER="__DB_USER__"
DB_PASS="__DB_PASS__"
BACKUP_TAR="$DEPLOY_DIR/backup.tar.gz"
SITE_TAR="$DEPLOY_DIR/site.tar.gz"

step() { echo "==> $*"; }

step "[1/8] System packages"
export DEBIAN_FRONTEND=noninteractive
rm -f /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq \
  curl git pv mariadb-server mariadb-client \
  php8.3-fpm php8.3-cli php8.3-mysql php8.3-curl php8.3-gd \
  php8.3-mbstring php8.3-xml php8.3-zip \
  rsync unzip

if ! command -v node >/dev/null 2>&1; then
  step "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  step "Installing Caddy"
  apt-get install -y -qq caddy
fi

step "[2/8] MariaDB"
systemctl enable --now mariadb
mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"

step "[3/8] Extract backup and import database"
mkdir -p "$DEPLOY_DIR/extract"
tar -xzf "$BACKUP_TAR" -C "$DEPLOY_DIR/extract"
BACKUP_ROOT="$(find "$DEPLOY_DIR/extract" -maxdepth 1 -type d -name 'chadow_full_backup_*' | head -1)"
if [[ -z "$BACKUP_ROOT" ]]; then echo "Backup root not found" >&2; exit 1; fi

if [[ -f "$BACKUP_ROOT/database/chadow.sql.gz" ]]; then
  step "Importing database dump"
  gunzip -c "$BACKUP_ROOT/database/chadow.sql.gz" | mysql "$DB_NAME"
fi

step "[4/8] Deploy site files"
mkdir -p "$SITE_ROOT" "$TEST_ROOT"
tar -xzf "$SITE_TAR" -C "$SITE_ROOT"
chown -R www-data:www-data "$SITE_ROOT"

# Restore uploads from backup (launcher etc.)
if [[ -d "$BACKUP_ROOT/site/uploads" ]]; then
  rsync -a "$BACKUP_ROOT/site/uploads/" "$SITE_ROOT/uploads/"
fi

# Restore tactics-ws .env from backup if present
if [[ -f "$BACKUP_ROOT/site/deploy/tactics-ws/.env" ]]; then
  cp "$BACKUP_ROOT/site/deploy/tactics-ws/.env" "$SITE_ROOT/deploy/tactics-ws/.env"
fi

# Test site
if [[ -d "$BACKUP_ROOT/test_site" ]]; then
  rsync -a "$BACKUP_ROOT/test_site/" "$TEST_ROOT/"
  chown -R www-data:www-data "$TEST_ROOT"
fi

step "[5/8] Environment and PHP config"
mkdir -p /etc/chadow
if [[ -f "$BACKUP_ROOT/config/chadow_env" ]]; then
  cp "$BACKUP_ROOT/config/chadow_env" /etc/chadow/env
  chmod 640 /etc/chadow/env
  chown root:www-data /etc/chadow/env
fi

# Minecraft upload limits
if [[ -f "$SITE_ROOT/deploy/php/99-minecraft-upload.ini" ]]; then
  cp "$SITE_ROOT/deploy/php/99-minecraft-upload.ini" /etc/php/8.3/fpm/conf.d/99-minecraft-upload.ini
  cp "$SITE_ROOT/deploy/php/99-minecraft-upload.ini" /etc/php/8.3/cli/conf.d/99-minecraft-upload.ini
fi

step "[6/8] Caddy"
cp "$SITE_ROOT/deploy/caddy/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

step "[7/8] Tactics WebSocket service"
if [[ ! -d "$SITE_ROOT/deploy/tactics-ws/node_modules" ]]; then
  cd "$SITE_ROOT/deploy/tactics-ws" && npm install --omit=dev
  chown -R www-data:www-data "$SITE_ROOT/deploy/tactics-ws/node_modules"
fi
NODE_BIN="$(command -v node)"
sed \
  -e "s|@RUN_USER@|www-data|g" \
  -e "s|@RUN_GROUP@|www-data|g" \
  -e "s|@CHADOW_ROOT@|$SITE_ROOT|g" \
  -e "s|@NODE_BIN@|$NODE_BIN|g" \
  -e "s|@PHP_BIN@|$(command -v php)|g" \
  "$SITE_ROOT/deploy/systemd/chadow-tactics-ws.service" > /etc/systemd/system/chadow-tactics-ws.service
systemctl daemon-reload
systemctl enable chadow-tactics-ws.service
systemctl restart chadow-tactics-ws.service

step "[8/8] Schema warmup and service checks"
cd "$SITE_ROOT" && sudo -u www-data php scripts/warmup_schema.php || true
systemctl restart php8.3-fpm
systemctl restart chadow-tactics-ws || true

echo ""
echo "=== Deploy complete ==="
echo "Site root: $SITE_ROOT"
curl -sS -o /dev/null -w "HTTP localhost: %{http_code}\n" -H 'Host: chadow.ru' http://127.0.0.1/ || true
systemctl is-active mariadb php8.3-fpm caddy chadow-tactics-ws 2>/dev/null || true
"""


def main() -> int:
    if not BACKUP.is_file():
        log(f"Backup not found: {BACKUP}")
        return 1

    site_tar = make_site_tar()
    try:
        log(f"Connecting to {HOST}:{PORT}...")
        ssh = connect()
        sftp = ssh.open_sftp()

        run(ssh, f"mkdir -p {REMOTE_TMP}")

        upload_file(sftp, BACKUP, f"{REMOTE_TMP}/backup.tar.gz")
        upload_file(sftp, site_tar, f"{REMOTE_TMP}/site.tar.gz")

        script = REMOTE_SETUP
        for k, v in {
            "__REMOTE_TMP__": REMOTE_TMP,
            "__SITE_ROOT__": SITE_ROOT,
            "__TEST_ROOT__": TEST_ROOT,
            "__DB_NAME__": DB_NAME,
            "__DB_USER__": DB_USER,
            "__DB_PASS__": DB_PASS,
        }.items():
            script = script.replace(k, v)

        remote_script = f"{REMOTE_TMP}/setup.sh"
        with sftp.file(remote_script, "w") as f:
            f.write(script)
        sftp.chmod(remote_script, stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH)

        log("Running remote deploy script (this may take several minutes)...")
        code, out, err = run(ssh, f"bash {remote_script}", sudo=True, timeout=7200)
        if out:
            print(out, end="" if out.endswith("\n") else "\n")
        if err:
            print(err, file=sys.stderr, end="" if err.endswith("\n") else "\n")

        sftp.close()
        ssh.close()

        if code != 0:
            log("Deploy finished with errors.")
            return code
        log("Deploy finished successfully.")
        return 0
    finally:
        try:
            site_tar.unlink(missing_ok=True)
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
