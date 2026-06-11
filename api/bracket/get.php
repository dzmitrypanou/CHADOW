<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    bracket_json_error('Метод не поддерживается', 405);
}

$publicId = trim((string) ($_GET['public_id'] ?? ''));
if (!bracket_public_id_valid($publicId)) {
    bracket_json_error('Некорректный идентификатор');
}

try {
    $row = bracket_fetch_by_public_id($userDb, $publicId, true);
    if (!$row) {
        bracket_json_error('Сетка не найдена', 404);
    }

    header('Cache-Control: public, max-age=30, stale-while-revalidate=60');
    echo json_encode([
        'success' => true,
        'data' => bracket_format_item($row, false, true),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    bracket_json_error('Ошибка сервера', 500);
}
