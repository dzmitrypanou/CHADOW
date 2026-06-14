<?php

const ABS_IMAGE_UPLOAD_WEBP_QUALITY = 88;

const ABS_IMAGE_ALLOWED_MIMES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

function abs_image_webp_supported(): bool {
    return extension_loaded('gd') && function_exists('imagewebp');
}

/**
 * @return array{ok:bool, error?:string, mime?:string, width?:int, height?:int}
 */
function abs_image_inspect_file(string $path): array {
    $info = @getimagesize($path);
    if ($info === false) {
        return ['ok' => false, 'error' => 'invalid_image'];
    }

    $mime = (string) ($info['mime'] ?? '');
    if (!isset(ABS_IMAGE_ALLOWED_MIMES[$mime])) {
        return ['ok' => false, 'error' => 'invalid_type'];
    }

    return [
        'ok' => true,
        'mime' => $mime,
        'width' => (int) ($info[0] ?? 0),
        'height' => (int) ($info[1] ?? 0),
    ];
}

/**
 * @param resource|GdImage|false $image
 * @return resource|GdImage|false
 */
function abs_image_prepare_webp_resource($image) {
    if (!is_resource($image) && !($image instanceof GdImage)) {
        return false;
    }

    if (!imageistruecolor($image)) {
        $width = imagesx($image);
        $height = imagesy($image);
        $truecolor = imagecreatetruecolor($width, $height);
        if ($truecolor === false) {
            return $image;
        }
        imagealphablending($truecolor, false);
        imagesavealpha($truecolor, true);
        $transparent = imagecolorallocatealpha($truecolor, 0, 0, 0, 127);
        imagefilledrectangle($truecolor, 0, 0, $width, $height, $transparent);
        imagecopy($truecolor, $image, 0, 0, 0, 0, $width, $height);
        imagedestroy($image);

        return $truecolor;
    }

    imagesavealpha($image, true);
    imagealphablending($image, true);

    return $image;
}

/**
 * @return resource|GdImage|false
 */
function abs_image_load_resource(string $path, string $mime) {
    switch ($mime) {
        case 'image/jpeg':
            return @imagecreatefromjpeg($path);
        case 'image/png':
            $image = @imagecreatefrompng($path);
            if ($image !== false) {
                imagealphablending($image, true);
                imagesavealpha($image, true);
            }

            return $image;
        case 'image/webp':
            return @imagecreatefromwebp($path);
        default:
            return false;
    }
}

/**
 * @param resource|GdImage $image
 */
function abs_image_save_webp($image, string $destPath, int $quality = ABS_IMAGE_UPLOAD_WEBP_QUALITY): bool {
    $image = abs_image_prepare_webp_resource($image);
    if ($image === false) {
        return false;
    }

    $quality = max(0, min(100, $quality));
    $ok = @imagewebp($image, $destPath, $quality);
    imagedestroy($image);

    if (!$ok || !is_file($destPath)) {
        return false;
    }

    @chmod($destPath, 0644);

    return true;
}

function abs_image_persist_temp_file(string $tmpPath, string $destPath, bool $mustBeUploaded): bool {
    if ($mustBeUploaded && @move_uploaded_file($tmpPath, $destPath)) {
        return true;
    }
    if (@copy($tmpPath, $destPath)) {
        if ($mustBeUploaded && is_uploaded_file($tmpPath)) {
            @unlink($tmpPath);
        }

        return is_file($destPath);
    }

    return false;
}

function abs_image_cleanup_temp(string $tmpPath, bool $mustBeUploaded): void {
    if ($mustBeUploaded && is_uploaded_file($tmpPath)) {
        @unlink($tmpPath);
    }
}

/**
 * @param resource|GdImage $image
 * @return resource|GdImage
 */
function abs_image_limit_dimensions($image, int $maxDimension) {
    if ($maxDimension <= 0 || (!is_resource($image) && !($image instanceof GdImage))) {
        return $image;
    }

    $width = imagesx($image);
    $height = imagesy($image);
    if ($width <= 0 || $height <= 0 || ($width <= $maxDimension && $height <= $maxDimension)) {
        return $image;
    }

    $scale = min($maxDimension / $width, $maxDimension / $height);
    $newW = max(1, (int) round($width * $scale));
    $newH = max(1, (int) round($height * $scale));
    $resized = imagecreatetruecolor($newW, $newH);
    if ($resized === false) {
        return $image;
    }

    imagealphablending($resized, false);
    imagesavealpha($resized, true);
    $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
    imagefilledrectangle($resized, 0, 0, $newW, $newH, $transparent);
    imagealphablending($resized, true);
    imagecopyresampled($resized, $image, 0, 0, 0, 0, $newW, $newH, $width, $height);
    imagedestroy($image);

    return $resized;
}

/**
 * Save an uploaded JPEG/PNG/WebP as WebP (re-encode or copy when already WebP).
 *
 * @return array{ok:bool, error?:string, ext?:string, mime?:string, size?:int}
 */
function abs_save_uploaded_image_as_webp(
    string $tmpPath,
    string $destPath,
    int $quality = ABS_IMAGE_UPLOAD_WEBP_QUALITY,
    bool $mustBeUploaded = true,
    int $maxDimension = 0
): array {
    if ($mustBeUploaded && !is_uploaded_file($tmpPath)) {
        return ['ok' => false, 'error' => 'upload_failed'];
    }
    if (!is_readable($tmpPath)) {
        return ['ok' => false, 'error' => 'upload_failed'];
    }

    if (!preg_match('/\.webp$/i', $destPath)) {
        $destPath = preg_replace('/\.[^.]+$/', '', $destPath) . '.webp';
    }

    $inspect = abs_image_inspect_file($tmpPath);
    if (!$inspect['ok']) {
        return $inspect;
    }

    $mime = $inspect['mime'];
    $destDir = dirname($destPath);
    if (!is_dir($destDir) && !@mkdir($destDir, 0775, true) && !is_dir($destDir)) {
        return ['ok' => false, 'error' => 'mkdir_failed'];
    }

    if ($mime === 'image/webp') {
        if ($maxDimension > 0) {
            $image = abs_image_load_resource($tmpPath, $mime);
            if ($image === false) {
                return ['ok' => false, 'error' => 'invalid_image'];
            }
            $image = abs_image_limit_dimensions($image, $maxDimension);
            if (!abs_image_save_webp($image, $destPath, $quality)) {
                abs_image_cleanup_temp($tmpPath, $mustBeUploaded);

                return ['ok' => false, 'error' => 'save_failed'];
            }
            abs_image_cleanup_temp($tmpPath, $mustBeUploaded);

            return [
                'ok' => true,
                'ext' => 'webp',
                'mime' => 'image/webp',
                'size' => (int) filesize($destPath),
            ];
        }

        if (!abs_image_persist_temp_file($tmpPath, $destPath, $mustBeUploaded)) {
            return ['ok' => false, 'error' => 'save_failed'];
        }
        @chmod($destPath, 0644);

        return [
            'ok' => true,
            'ext' => 'webp',
            'mime' => 'image/webp',
            'size' => (int) filesize($destPath),
        ];
    }

    if (!abs_image_webp_supported()) {
        return ['ok' => false, 'error' => 'webp_unsupported'];
    }

    $image = abs_image_load_resource($tmpPath, $mime);
    if ($image === false) {
        return ['ok' => false, 'error' => 'invalid_image'];
    }

    if ($maxDimension > 0) {
        $image = abs_image_limit_dimensions($image, $maxDimension);
    }

    if (!abs_image_save_webp($image, $destPath, $quality)) {
        abs_image_cleanup_temp($tmpPath, $mustBeUploaded);

        return ['ok' => false, 'error' => 'save_failed'];
    }

    abs_image_cleanup_temp($tmpPath, $mustBeUploaded);

    return [
        'ok' => true,
        'ext' => 'webp',
        'mime' => 'image/webp',
        'size' => (int) filesize($destPath),
    ];
}

/**
 * Convert an existing image file on disk to WebP.
 *
 * @return array{ok:bool, error?:string, skipped?:bool, ext?:string, size?:int, saved_bytes?:int, src?:string, dest?:string}
 */
function abs_convert_file_to_webp(
    string $srcPath,
    ?string $destPath = null,
    int $quality = ABS_IMAGE_UPLOAD_WEBP_QUALITY,
    bool $deleteSource = false
): array {
    if (!is_readable($srcPath)) {
        return ['ok' => false, 'error' => 'not_readable', 'src' => $srcPath];
    }

    $inspect = abs_image_inspect_file($srcPath);
    if (!$inspect['ok']) {
        return array_merge($inspect, ['src' => $srcPath]);
    }

    if ($destPath === null || $destPath === '') {
        $destPath = preg_replace('/\.[^.]+$/', '', $srcPath) . '.webp';
    } elseif (!preg_match('/\.webp$/i', $destPath)) {
        $destPath = rtrim($destPath, '.') . '.webp';
    }

    $srcSize = (int) filesize($srcPath);
    $mime = $inspect['mime'];

    if ($mime === 'image/webp') {
        $srcReal = realpath($srcPath);
        $destReal = @realpath($destPath);
        if ($srcReal !== false && $destReal !== false && $srcReal === $destReal) {
            return [
                'ok' => true,
                'skipped' => true,
                'ext' => 'webp',
                'size' => $srcSize,
                'src' => $srcPath,
                'dest' => $destPath,
            ];
        }
    }

    $destDir = dirname($destPath);
    if (!is_dir($destDir) && !@mkdir($destDir, 0775, true) && !is_dir($destDir)) {
        return ['ok' => false, 'error' => 'mkdir_failed', 'src' => $srcPath, 'dest' => $destPath];
    }

    if ($mime === 'image/webp') {
        if (!@copy($srcPath, $destPath)) {
            return ['ok' => false, 'error' => 'save_failed', 'src' => $srcPath, 'dest' => $destPath];
        }
        @chmod($destPath, 0644);
        if ($deleteSource && realpath($srcPath) !== realpath($destPath)) {
            @unlink($srcPath);
        }

        return [
            'ok' => true,
            'ext' => 'webp',
            'size' => (int) filesize($destPath),
            'saved_bytes' => max(0, $srcSize - (int) filesize($destPath)),
            'src' => $srcPath,
            'dest' => $destPath,
        ];
    }

    if (!abs_image_webp_supported()) {
        return ['ok' => false, 'error' => 'webp_unsupported', 'src' => $srcPath];
    }

    $image = abs_image_load_resource($srcPath, $mime);
    if ($image === false) {
        return ['ok' => false, 'error' => 'invalid_image', 'src' => $srcPath];
    }

    if (!abs_image_save_webp($image, $destPath, $quality)) {
        return ['ok' => false, 'error' => 'save_failed', 'src' => $srcPath, 'dest' => $destPath];
    }

    $newSize = (int) filesize($destPath);
    if ($deleteSource && is_file($srcPath) && realpath($srcPath) !== realpath($destPath)) {
        @unlink($srcPath);
    }

    return [
        'ok' => true,
        'ext' => 'webp',
        'size' => $newSize,
        'saved_bytes' => max(0, $srcSize - $newSize),
        'src' => $srcPath,
        'dest' => $destPath,
    ];
}

function abs_convert_data_url_to_webp(string $dataUrl, int $quality = ABS_IMAGE_UPLOAD_WEBP_QUALITY): ?string {
    if (!preg_match('#^data:(image/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\r\n]+)$#i', $dataUrl, $matches)) {
        return null;
    }

    $mime = strtolower($matches[1]);
    if ($mime === 'image/webp') {
        return null;
    }

    $binary = base64_decode(str_replace(["\r", "\n"], '', $matches[2]), true);
    if ($binary === false || $binary === '') {
        return null;
    }

    $tmpBase = tempnam(sys_get_temp_dir(), 'absimg_');
    if ($tmpBase === false) {
        return null;
    }

    $ext = strpos($mime, 'png') !== false ? 'png' : 'jpg';
    $srcPath = $tmpBase . '.' . $ext;
    $destPath = $tmpBase . '.webp';
    @unlink($tmpBase);

    if (@file_put_contents($srcPath, $binary) === false) {
        @unlink($srcPath);

        return null;
    }

    $result = abs_convert_file_to_webp($srcPath, $destPath, $quality, true);
    if (!$result['ok'] || !is_file($destPath)) {
        @unlink($srcPath);
        @unlink($destPath);

        return null;
    }

    $webpBinary = file_get_contents($destPath);
    @unlink($destPath);

    if ($webpBinary === false || $webpBinary === '') {
        return null;
    }

    return 'data:image/webp;base64,' . base64_encode($webpBinary);
}

/**
 * @param mixed $data
 * @return mixed
 */
function abs_convert_structure_image_data_urls($data, int $quality = ABS_IMAGE_UPLOAD_WEBP_QUALITY, bool &$changed = false) {
    if (is_string($data)) {
        if (strncmp($data, 'data:image/', 11) !== 0 || stripos($data, 'image/webp') !== false) {
            return $data;
        }

        $converted = abs_convert_data_url_to_webp($data, $quality);
        if ($converted === null) {
            return $data;
        }

        $changed = true;

        return $converted;
    }

    if (!is_array($data)) {
        return $data;
    }

    foreach ($data as $key => $value) {
        $data[$key] = abs_convert_structure_image_data_urls($value, $quality, $changed);
    }

    return $data;
}

