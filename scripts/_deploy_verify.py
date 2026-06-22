#!/usr/bin/env python3
import shlex
import urllib.request
import paramiko

PW = "X64Market-site@#$"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)

def sudo(cmd):
    full = f"sudo -S bash -lc {shlex.quote(cmd)}"
    stdin, stdout, stderr = ssh.exec_command(full, timeout=60)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    return stdout.read().decode()

print("=== Local HTTP check ===")
print(sudo("curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' -H Host:chadow.ru http://127.0.0.1/"))
print("=== Services ===")
print(sudo("systemctl is-active mariadb php8.3-fpm caddy chadow-tactics-ws"))
print("=== DB tables ===")
print(sudo("mysql -u chadow -phZ2wF3jR2mdL4wE0! chadow -N -e 'SHOW TABLES' | wc -l"))
print("=== Key files ===")
print(sudo("ls -la /var/www/chadow.ru/index.php /etc/chadow/env"))
ssh.close()

for url in ["http://chadow.ru/", "https://chadow.ru/"]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "deploy-verify/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            print(f"External {url}: {r.status}")
    except Exception as e:
        print(f"External {url}: {e}")
