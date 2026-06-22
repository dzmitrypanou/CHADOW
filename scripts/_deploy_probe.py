#!/usr/bin/env python3
import shlex
import paramiko

PW = "X64Market-site@#$"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)

def sudo(cmd):
    full = f"sudo -S bash -lc {shlex.quote(cmd)}"
    stdin, stdout, stderr = ssh.exec_command(full, timeout=120)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    print(f"=== exit {code}: {cmd[:80]} ===")
    print(out)
    if err.strip():
        print("STDERR:", err)

sudo("which caddy php node mysql; caddy version 2>/dev/null || true")
sudo("apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl 2>&1 | tail -5")
sudo("curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>&1")
sudo("curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list")
sudo("apt-get update 2>&1 | tail -10")
sudo("apt-get install -y caddy 2>&1 | tail -20")

ssh.close()
