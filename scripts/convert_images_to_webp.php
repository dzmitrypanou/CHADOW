#!/usr/bin/env php
<?php
/**
 * Пакетная конвертация уже загруженных изображений в WebP.
 *
 * Карты тактики (PNG/JPEG на диске):
 *   php scripts/convert_images_to_webp.php --maps
 *
 * Вставленные картинки в данных комнат (base64 в room_data):
 *   php scripts/convert_images_to_webp.php --rooms
 *
 * Всё сразу:
 *   php scripts/convert_images_to_webp.php --all
 *
 * Пробный прогон без записи:
 *   php scripts/convert_images_to_webp.php --all --dry-run
 *
 * Свой каталог:
 *   php scripts/convert_images_to_webp.php --path=/var/www/assets/tactics/maps
 */

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once __DIR__ . '/../includes/image_helpers.php';

$options = [
    'maps' => false,
    'rooms' => false,
    'all' => false,
    'dry_run' => false,
    'keep_source' => false,
    'quality' => ABS_IMAGE_UPLOAD_WEBP_QUALITY,
    'path' => dirname(__DIR__) . '/assets/tactics/maps',
];

foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--maps') {
        $options['maps'] = true;
        continue;
    }
    if ($arg === '--rooms') {
        $options['rooms'] = true;
        continue;
    }
    if ($arg === '--all') {
        $options['all'] = true;
        continue;
    }
    if ($arg === '--dry-run') {
        $options['dry_run'] = true;
        continue;
    }
    if ($arg === '--keep-source') {
        $options['keep_source'] = true;
        continue;
    }
    if (preg_match('/^--quality=(\d+)$/', $arg, $m)) {
        $options['quality'] = max(0, min(100, (int) $m[1]));
        continue;
    }
    if (preg_match('/^--path=(.+)$/', $arg, $m)) {
        $options['path'] = $m[1];
        continue;
    }
    if ($arg === '--help' || $arg === '-h') {
        fwrite(STDOUT, file_get_contents(__FILE__));
        exit(0);
    }

    fwrite(STDERR, "Unknown option: {$arg}\n");
    exit(1);
}

if (!$options['maps'] && !$options['rooms'] && !$options['all']) {
    $options['maps'] = true;
}
if ($options['all']) {
    $options['maps'] = true;
    $options['rooms'] = true;
}

if (!abs_image_webp_supported()) {
    fwrite(STDERR, "GD with imagewebp is required. Install/enable php-gd with WebP support.\n");
    exit(1);
}

$totals = [
    'converted' => 0,
    'skipped' => 0,
    'failed' => 0,
    'saved_bytes' => 0,
    'rooms_updated' => 0,
];

function convert_maps_tree(string $root, array $options, array &$totals): void {
    if (!is_dir($root)) {
        fwrite(STDERR, "Directory not found: {$root}\n");
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );

    /** @var SplFileInfo $file */
    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $path = $file->getPathname();
        $ext = strtolower($file->getExtension());
        if (!in_array($ext, ['png', 'jpg', 'jpeg'], true)) {
            continue;
        }

        $destPath = preg_replace('/\.[^.]+$/', '', $path) . '.webp';
        $srcSize = (int) $file->getSize();

        if ($options['dry_run']) {
            fwrite(STDOUT, "[dry-run] {$path} -> {$destPath}\n");
            $totals['converted']++;
            continue;
        }

        $result = abs_convert_file_to_webp(
            $path,
            $destPath,
            (int) $options['quality'],
            !$options['keep_source']
        );

        if (!$result['ok']) {
            $totals['failed']++;
            fwrite(STDERR, "FAIL {$path}: " . ($result['error'] ?? 'unknown') . "\n");
            continue;
        }

        if (!empty($result['skipped'])) {
            $totals['skipped']++;
            continue;
        }

        $saved = (int) ($result['saved_bytes'] ?? max(0, $srcSize - (int) ($result['size'] ?? 0)));
        $totals['converted']++;
        $totals['saved_bytes'] += $saved;
        fwrite(STDOUT, "OK {$path} -> {$destPath} (-" . format_bytes($saved) . ")\n");
    }
}

function convert_tactics_rooms(array $options, array &$totals): void {
    require_once __DIR__ . '/../includes/user_bootstrap.php';
    require_once __DIR__ . '/../config/ensure_tactics.php';
    require_once __DIR__ . '/../includes/tactics_helpers.php';

    ensure_tactics_table($userDb);

    $stmt = $userDb->query('SELECT public_id, room_data FROM tactics_rooms');
    if ($stmt === false) {
        fwrite(STDERR, "Could not read tactics_rooms\n");
        return;
    }

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $publicId = (string) ($row['public_id'] ?? '');
        $roomData = tactics_parse_room_data($row['room_data'] ?? null);
        $changed = false;
        $beforeSize = strlen(json_encode($roomData, JSON_UNESCAPED_UNICODE) ?: '');

        $roomData = abs_convert_structure_image_data_urls($roomData, (int) $options['quality'], $changed);
        if (!$changed) {
            continue;
        }

        $encoded = json_encode($roomData, JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            $totals['failed']++;
            fwrite(STDERR, "FAIL room {$publicId}: json_encode error\n");
            continue;
        }

        if (strlen($encoded) > TACTICS_ROOM_DATA_MAX_BYTES) {
            $totals['failed']++;
            fwrite(STDERR, "FAIL room {$publicId}: room_data too large after conversion\n");
            continue;
        }

        $saved = max(0, $beforeSize - strlen($encoded));
        if ($options['dry_run']) {
            fwrite(STDOUT, "[dry-run] room {$publicId} (-" . format_bytes($saved) . " in JSON)\n");
            $totals['rooms_updated']++;
            $totals['saved_bytes'] += $saved;
            continue;
        }

        $update = $userDb->prepare('UPDATE tactics_rooms SET room_data = ?, updated_at = CURRENT_TIMESTAMP WHERE public_id = ?');
        if ($update === false || !$update->execute([$encoded, $publicId])) {
            $totals['failed']++;
            fwrite(STDERR, "FAIL room {$publicId}: database update error\n");
            continue;
        }

        $totals['rooms_updated']++;
        $totals['saved_bytes'] += $saved;
        fwrite(STDOUT, "OK room {$publicId} (-" . format_bytes($saved) . " in JSON)\n");
    }
}

function format_bytes(int $bytes): string {
    if ($bytes < 1024) {
        return $bytes . ' B';
    }
    if ($bytes < 1024 * 1024) {
        return round($bytes / 1024, 1) . ' KB';
    }

    return round($bytes / (1024 * 1024), 2) . ' MB';
}

fwrite(STDOUT, "WebP quality: {$options['quality']}\n");
if ($options['dry_run']) {
    fwrite(STDOUT, "Dry run — no files or database rows will be changed.\n");
}

if ($options['maps']) {
    fwrite(STDOUT, "\n== Map files: {$options['path']} ==\n");
    convert_maps_tree($options['path'], $options, $totals);
}

if ($options['rooms']) {
    fwrite(STDOUT, "\n== Tactics room_data embedded images ==\n");
    convert_tactics_rooms($options, $totals);
}

fwrite(STDOUT, "\nDone.\n");
fwrite(STDOUT, "Converted files: {$totals['converted']}\n");
fwrite(STDOUT, "Skipped: {$totals['skipped']}\n");
fwrite(STDOUT, "Rooms updated: {$totals['rooms_updated']}\n");
fwrite(STDOUT, "Failed: {$totals['failed']}\n");
fwrite(STDOUT, 'Saved: ' . format_bytes($totals['saved_bytes']) . "\n");

exit($totals['failed'] > 0 ? 1 : 0);
