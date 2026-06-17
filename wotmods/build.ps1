param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = Join-Path $root '.build'
$py = Join-Path $root '.build-tools\python27-install\python.exe'
$outDir = Join-Path $root '..\downloads\wotmods'
$modName = 'chadow.battle-limit'
$entry = 'res\scripts\client\gui\mods\mod_chadow_battle_limit.py'

if (-not (Test-Path $py)) {
    throw "Python 2.7 not found at $py. Run build.bat once or extract python-2.7.18.msi with: msiexec /a ..."
}

if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Path $build | Out-Null
Copy-Item (Join-Path $root 'res') (Join-Path $build 'res') -Recurse -Force

$configPath = Join-Path $build $entry
(Get-Content $configPath -Raw -Encoding UTF8) -replace '\{\{VERSION\}\}', $Version | Set-Content $configPath -Encoding UTF8
& $py -m compileall $build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$meta = (Get-Content (Join-Path $root 'meta.xml') -Raw -Encoding UTF8) -replace '\{\{VERSION\}\}', $Version
Set-Content (Join-Path $build 'meta.xml') $meta -Encoding UTF8

$outFile = Join-Path $outDir ("{0}_{1}.mtmod" -f $modName, $Version)
if (Test-Path $outFile) { Remove-Item $outFile -Force }

python -c @"
import os, zipfile
build = r'$build'
out = r'$outFile'
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_STORED) as z:
    for root, dirs, files in os.walk(build):
        for name in files:
            if name.endswith('.pyc') or name == 'meta.xml':
                full = os.path.join(root, name)
                rel = os.path.relpath(full, build).replace('\\\\', '/')
                z.write(full, rel)
print('Built', out)
"@
