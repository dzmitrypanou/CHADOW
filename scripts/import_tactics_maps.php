<?php
if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

$sourceDir = $argv[1] ?? '';
if ($sourceDir === '' || !is_dir($sourceDir)) {
    fwrite(STDERR, "Usage: php scripts/import_tactics_maps.php /path/to/maps [game] [mode]\n");
    fwrite(STDERR, "Expected files: {map_code}.webp or {map_code}.png\n");
    fwrite(STDERR, "Optional: game=wot|lesta mode=random|encounter|assault\n");
    fwrite(STDERR, "  -> assets/tactics/maps/{game}/{mode}/{map_code}.webp\n");
    exit(1);
}

$game = isset($argv[2]) ? strtolower((string) $argv[2]) : '';
$mode = isset($argv[3]) ? strtolower((string) $argv[3]) : '';
$targetDir = dirname(__DIR__) . '/assets/tactics/maps';
if ($game !== '' && $mode !== '') {
    $targetDir .= '/' . preg_replace('/[^a-z0-9_-]/', '', $game)
        . '/' . preg_replace('/[^a-z0-9_-]/', '', $mode);
}
if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$imported = 0;
$iterator = new DirectoryIterator($sourceDir);
foreach ($iterator as $file) {
    if ($file->isDot() || !$file->isFile()) {
        continue;
    }
    $name = $file->getFilename();
    if (!preg_match('/^([a-z0-9_\-]+)\.(webp|png|jpe?g)$/i', $name, $m)) {
        continue;
    }
    $code = strtolower($m[1]);
    $ext = strtolower($m[2]);
    if ($ext === 'jpeg') {
        $ext = 'jpg';
    }
    $dest = $targetDir . '/' . $code . '.' . $ext;
    if (!copy($file->getPathname(), $dest)) {
        fwrite(STDERR, "Failed to copy {$name}\n");
        continue;
    }
    $imported++;
    fwrite(STDOUT, "Imported {$code}.{$ext}\n");
}

fwrite(STDOUT, "Done. Imported {$imported} map(s).\n");
