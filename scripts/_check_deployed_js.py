#!/usr/bin/env python3
import paramiko
import shlex

PW = "X64Market-site@#$"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)
for cmd in [
    "grep -n mapCodeForUrl /var/www/chadow.ru/js/services/tactics/maps.js | head -3",
    "grep -n reloadMapBackground /var/www/chadow.ru/js/services/tactics/canvas.js | head -3",
    "grep -n setSlidePreviewUrl /var/www/chadow.ru/js/services/tactics/room.js | head -5",
]:
    stdin, stdout, stderr = ssh.exec_command(f"sudo -S bash -lc {shlex.quote(cmd)}", timeout=30)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    print(stdout.read().decode())
ssh.close()
