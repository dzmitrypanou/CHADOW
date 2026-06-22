#!/usr/bin/env python3
import paramiko
import shlex
from pathlib import Path

PW = "X64Market-site@#$"
ROOT = Path(r"d:\chadow.ru")
FILES = [
    "config/version.json",
    "js/services/aim/trainers/vugich.js",
    "js/services/aim/trainers/duckhunt.js",
    "assets/aim/duckhunt-bgm.mp3",
    "assets/aim/duckhunt-quack.mp3",
    "assets/aim/duckhunt-shotgun.mp3",
    "assets/aim/ne-probil.mp3",
    "assets/aim/tank-unichtozhen.mp3",
    "assets/aim/vugich-sight.png",
    "assets/aim/vugich.m4a",
    "assets/aim/wot-boi-nachinaetsia.mp3",
    "assets/aim/wot_bigboom_in.mp3",
]
REMOTE_ROOT = "/var/www/chadow.ru"
TMP = "/tmp/chadow-deploy-aim"


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("95.52.245.112", port=51022, username="x64-site", password=PW, timeout=30)
    ssh.exec_command(f"mkdir -p {TMP}/assets/aim {TMP}/js/services/aim/trainers {TMP}/config")[1].channel.recv_exit_status()

    sftp = ssh.open_sftp()
    for rel in FILES:
        local = ROOT / rel
        remote_tmp = f"{TMP}/{rel.replace(chr(92), '/')}"
        print("upload", rel, f"({local.stat().st_size} bytes)")
        sftp.put(str(local), remote_tmp)
    sftp.close()

    copy_cmd = (
        f"mkdir -p {REMOTE_ROOT}/assets/aim && "
        f"cp -a {TMP}/assets/aim/. {REMOTE_ROOT}/assets/aim/ && "
        f"cp -a {TMP}/js/services/aim/trainers/vugich.js {REMOTE_ROOT}/js/services/aim/trainers/vugich.js && "
        f"cp -a {TMP}/js/services/aim/trainers/duckhunt.js {REMOTE_ROOT}/js/services/aim/trainers/duckhunt.js && "
        f"cp -a {TMP}/config/version.json {REMOTE_ROOT}/config/version.json && "
        f"chown -R www-data:www-data {REMOTE_ROOT}/assets/aim {REMOTE_ROOT}/js/services/aim {REMOTE_ROOT}/config && "
        f"rm -rf {TMP}"
    )
    stdin, stdout, stderr = ssh.exec_command(f"sudo -S bash -lc {shlex.quote(copy_cmd)}", timeout=300)
    stdin.write(PW + "\n")
    stdin.channel.shutdown_write()
    exit_code = stdout.channel.recv_exit_status()
    ssh.close()
    print("exit", exit_code)
    print("done")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
