<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../../config/tactics_map_catalog.php';
require_once __DIR__ . '/../../config/ensure_tactics.php';
require_once __DIR__ . '/../../includes/tactics_helpers.php';

header('Content-Type: application/json; charset=utf-8');

admin_require_ajax();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
    exit();
}

ensure_map_dictionary_table($db);
ensure_tactics_map_assignments_table($db);

try {
    $dictionary = $db->fetchAll(
        'SELECT map_code, display_name_ru, display_name_en, side_length FROM map_dictionary ORDER BY display_name_ru'
    );
    $assets = tactics_scan_map_assets();

    $gameModes = [];
    foreach (TACTICS_GAMES as $game) {
        $gameModes[$game] = array_map(static fn (string $mode) => [
            'id' => $mode,
            'label' => tactics_battle_mode_label($mode, 'ru', $game),
        ], tactics_game_modes($game));
    }

    $allModes = [];
    foreach ($gameModes as $modes) {
        foreach ($modes as $modeRow) {
            $allModes[$modeRow['id']] = $modeRow['label'];
        }
    }

    echo json_encode([
        'success' => true,
        'dictionary' => $dictionary,
        'assets' => $assets,
        'games' => array_map(static fn (string $g) => [
            'id' => $g,
            'label' => tactics_game_label($g),
        ], TACTICS_GAMES),
        'modes' => array_map(static fn (string $id) => [
            'id' => $id,
            'label' => $allModes[$id] ?? $id,
        ], array_keys($allModes)),
        'game_modes' => $gameModes,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Ошибка сервера'], JSON_UNESCAPED_UNICODE);
}
