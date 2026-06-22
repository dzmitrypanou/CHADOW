#!/usr/bin/env python3
import paramiko
import shlex
from pathlib import Path

PW = "X64Market-site@#$"
ROOT = Path(r"d:\chadow.ru")
FILES = [
    "config/version.json",
    "includes/site_header.php",
    "css/landing-critical.css",
    "css/landing-critical.min.css",
    "css/vendor/fontawesome.min.css",
    "css/vendor/fontawesome-landing.min.css",
    "css/vendor/webfonts/fa-solid-900.woff2",
    "css/vendor/webfonts/fa-brands-400.woff2",
    "css/vendor/webfonts/fa-solid-landing.woff2",
    "css/vendor/webfonts/fa-brands-landing.woff2",
    "assets/icons/logo-header.webp",
    "llms.txt",
    "robots.txt",
    ".htaccess",
]
REMOTE_ROOT = "/var/www/chadow.ru"
TMP = "/tmp/chadow-deploy"


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)
    ssh.exec_command(
        f"mkdir -p {TMP}/css/vendor/webfonts {TMP}/includes {TMP}/config {TMP}/assets/icons"
    )[1].channel.recv_exit_status()

    sftp = ssh.open_sftp()
    for rel in FILES:
        local = ROOT / rel
        remote_tmp = f"{TMP}/{rel.replace(chr(92), '/')}"
        print("upload", rel)
        sftp.put(str(local), remote_tmp)
    sftp.close()

    copy_cmd = (
        f"cp -a {TMP}/config/version.json {REMOTE_ROOT}/config/version.json && "
        f"cp -a {TMP}/includes/site_header.php {REMOTE_ROOT}/includes/site_header.php && "
        f"cp -a {TMP}/css/landing-critical.css {REMOTE_ROOT}/css/landing-critical.css && "
        f"cp -a {TMP}/css/landing-critical.min.css {REMOTE_ROOT}/css/landing-critical.min.css && "
        f"cp -a {TMP}/css/vendor/fontawesome.min.css {REMOTE_ROOT}/css/vendor/fontawesome.min.css && "
        f"cp -a {TMP}/css/vendor/fontawesome-landing.min.css {REMOTE_ROOT}/css/vendor/fontawesome-landing.min.css && "
        f"mkdir -p {REMOTE_ROOT}/css/vendor/webfonts && "
        f"cp -a {TMP}/css/vendor/webfonts/. {REMOTE_ROOT}/css/vendor/webfonts/ && "
        f"cp -a {TMP}/assets/icons/logo-header.webp {REMOTE_ROOT}/assets/icons/logo-header.webp && "
        f"cp -a {TMP}/llms.txt {REMOTE_ROOT}/llms.txt && "
        f"cp -a {TMP}/robots.txt {REMOTE_ROOT}/robots.txt && "
        f"cp -a {TMP}/.htaccess {REMOTE_ROOT}/.htaccess && "
        f"chown -R www-data:www-data {REMOTE_ROOT}/includes {REMOTE_ROOT}/css {REMOTE_ROOT}/config "
        f"{REMOTE_ROOT}/assets/icons {REMOTE_ROOT}/llms.txt {REMOTE_ROOT}/robots.txt {REMOTE_ROOT}/.htaccess"
    )
    stdin, stdout, stderr = ssh.exec_command(f"sudo -S bash -lc {shlex.quote(copy_cmd)}", timeout=120)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    exit_code = stdout.channel.recv_exit_status()
    ssh.close()
    print("exit", exit_code)
    print("done")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
