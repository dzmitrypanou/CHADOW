#!/usr/bin/env python3
import paramiko
import shlex
from pathlib import Path

PW = "X64Market-site@#$"
ROOT = Path(r"d:\chadow.ru")
FILES = ["config/version.json", "includes/site_header.php"]
REMOTE_ROOT = "/var/www/chadow.ru"
TMP = "/tmp/chadow-deploy-cssfix"


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)
    ssh.exec_command(f"mkdir -p {TMP}/includes {TMP}/config")[1].channel.recv_exit_status()
    sftp = ssh.open_sftp()
    for rel in FILES:
        print("upload", rel)
        sftp.put(str(ROOT / rel), f"{TMP}/{rel.replace(chr(92), '/')}")
    sftp.close()
    copy_cmd = (
        f"cp -a {TMP}/config/version.json {REMOTE_ROOT}/config/version.json && "
        f"cp -a {TMP}/includes/site_header.php {REMOTE_ROOT}/includes/site_header.php && "
        f"chown www-data:www-data {REMOTE_ROOT}/config/version.json {REMOTE_ROOT}/includes/site_header.php && "
        f"rm -rf {TMP}"
    )
    stdin, stdout, stderr = ssh.exec_command(f"sudo -S bash -lc {shlex.quote(copy_cmd)}", timeout=60)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    exit_code = stdout.channel.recv_exit_status()
    ssh.close()
    print("exit", exit_code)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
