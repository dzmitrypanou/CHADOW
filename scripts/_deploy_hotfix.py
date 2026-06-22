#!/usr/bin/env python3
import paramiko
import shlex
from pathlib import Path

PW = "X64Market-site@#$"
ROOT = Path(r"d:\chadow.ru")
FILES = [
    "config/version.json",
    "includes/tactics_helpers.php",
    "js/services/tactics/maps.js",
    "js/services/tactics/canvas.js",
    "js/services/tactics/room.js",
    "js/services/tactics/slides.js",
]
REMOTE_ROOT = "/var/www/chadow.ru"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)
sftp = ssh.open_sftp()
for rel in FILES:
    local = ROOT / rel
    remote = f"{REMOTE_ROOT}/{rel.replace(chr(92), '/')}"
    print("upload", rel)
    sftp.put(str(local), remote)
sftp.close()

cmd = f"chown -R www-data:www-data {REMOTE_ROOT}/includes {REMOTE_ROOT}/admin/includes {REMOTE_ROOT}/js/services/tactics"
stdin, stdout, stderr = ssh.exec_command(f"sudo -S bash -lc {shlex.quote(cmd)}", timeout=60)
stdin.write(PW + "\n")
stdin.channel.shutdown_write()
stdout.channel.recv_exit_status()
ssh.close()
print("done")
