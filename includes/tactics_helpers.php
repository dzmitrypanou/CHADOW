<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
require_once __DIR__ . '/image_helpers.php';

const TACTICS_PUBLIC_ID_LEN = 8;
const TACTICS_TITLE_MAX_LEN = 120;
const TACTICS_NICKNAME_MAX_LEN = 32;
const TACTICS_PASSWORD_MAX_LEN = 64;
const TACTICS_ROOM_DATA_MAX_BYTES = 2097152;
const TACTICS_MAP_UPLOAD_MAX_BYTES = 16 * 1024 * 1024;
const TACTICS_MAP_UPLOAD_MAX_DIMENSION = 4096;

function tactics_map_upload_max_bytes(): int {
    return TACTICS_MAP_UPLOAD_MAX_BYTES;
}

function tactics_map_upload_max_mb(): int {
    return (int) (TACTICS_MAP_UPLOAD_MAX_BYTES / (1024 * 1024));
}

function tactics_map_upload_size_error(string $lang = 'ru'): string {
    $mb = tactics_map_upload_max_mb();
    return $lang === 'en'
        ? "File too large (max {$mb} MB)"
        : "Файл слишком большой (макс. {$mb} МБ)";
}

function tactics_map_upload_php_error_message(int $code, string $lang = 'ru'): string {
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return tactics_map_upload_size_error($lang);
        case UPLOAD_ERR_PARTIAL:
            return $lang === 'en'
                ? 'Upload interrupted — try again'
                : 'Загрузка прервана — попробуйте ещё раз';
        case UPLOAD_ERR_NO_FILE:
            return $lang === 'en'
                ? 'No file selected'
                : 'Файл не выбран';
        default:
            return $lang === 'en'
                ? 'Upload failed — check file format and size'
                : 'Ошибка загрузки файла — проверьте формат и размер';
    }
}
const TACTICS_GUEST_CREATE_WINDOW_SEC = 3600;
const TACTICS_GUEST_CREATE_MAX = 10;
const TACTICS_TOKEN_TTL_OWNER_SEC = 86400 * 30;
const TACTICS_TOKEN_TTL_GUEST_SEC = 86400 * 7;
const TACTICS_WS_TOKEN_TTL_SEC = 86400;
const TACTICS_MAX_PARTICIPANTS = 20;
const TACTICS_GUEST_ROOM_INACTIVE_DAYS = 7;

function tactics_public_id_valid(string $publicId): bool {
    return (bool) preg_match('/^[a-zA-Z0-9]{6,8}$/', $publicId);
}

function tactics_visibility_valid(string $visibility): bool {
    return in_array($visibility, ['open', 'closed'], true);
}

function tactics_generate_public_id($db): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $len = strlen($chars);

    for ($attempt = 0; $attempt < 30; $attempt++) {
        $id = '';
        for ($i = 0; $i < TACTICS_PUBLIC_ID_LEN; $i++) {
            $id .= $chars[random_int(0, $len - 1)];
        }
        $existing = $db->fetchOne(
            'SELECT id FROM tactics_rooms WHERE public_id = ?',
            [$id]
        );
        if (!$existing) {
            return $id;
        }
    }

    throw new RuntimeException('Unable to generate unique tactics public_id');
}

function tactics_generate_slide_id(): string {
    return 's' . bin2hex(random_bytes(4));
}

function tactics_default_room_data(string $mapCode, string $game = 'wot', string $battleMode = 'random'): array {
    $slideId = tactics_generate_slide_id();

    return [
        'slides' => [
            [
                'id' => $slideId,
                'map_code' => tactics_sanitize_map_code($mapCode),
                'game' => tactics_sanitize_game($game),
                'battle_mode' => tactics_sanitize_battle_mode($battleMode, tactics_sanitize_game($game)),
                'canvas' => null,
                'view' => [
                    'show_grid' => true,
                ],
            ],
        ],
        'active_slide_id' => $slideId,
        'settings' => [
            'show_grid' => true,
            'draw_mode' => 'restricted',
            'cursors_mode' => 'open',
            'editors' => [],
        ],
    ];
}

function tactics_ws_secret($db): string {
    $secret = getenv('TACTICS_WS_SECRET');
    if (is_string($secret) && trim($secret) !== '') {
        return trim($secret);
    }

    $stored = get_site_setting($db, 'tactics_ws_secret', '');
    if (is_string($stored) && trim($stored) !== '') {
        return trim($stored);
    }

    $generated = bin2hex(random_bytes(32));
    set_site_setting($db, 'tactics_ws_secret', $generated);

    return $generated;
}

function tactics_b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function tactics_b64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }

    return (string) base64_decode(strtr($data, '-_', '+/'), true);
}

function tactics_verify_signed_token($db, string $token, ?string $expectedPublicId = null): ?array {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return null;
    }

    [$payloadB64, $sig] = $parts;
    $secret = tactics_ws_secret($db);
    $expectedSig = hash_hmac('sha256', $payloadB64, $secret);
    if (!hash_equals($expectedSig, $sig)) {
        return null;
    }

    $json = tactics_b64url_decode($payloadB64);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }

    $exp = (int) ($payload['exp'] ?? 0);
    if ($exp > 0 && $exp < time()) {
        return null;
    }

    $publicId = trim((string) ($payload['pid'] ?? ''));
    if (!tactics_public_id_valid($publicId)) {
        return null;
    }

    if ($expectedPublicId !== null && $publicId !== $expectedPublicId) {
        return null;
    }

    return $payload;
}

function tactics_issue_token($db, string $publicId, string $clientId, string $nickname, string $role, int $ttlSec, array $extraClaims = []): string {
    $payload = array_merge([
        'pid' => $publicId,
        'cid' => $clientId,
        'nick' => $nickname,
        'role' => $role,
        'exp' => time() + max(60, $ttlSec),
    ], $extraClaims);
    $payloadB64 = tactics_b64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $sig = hash_hmac('sha256', $payloadB64, tactics_ws_secret($db));

    return $payloadB64 . '.' . $sig;
}

function tactics_room_password_fingerprint(array $row): string {
    if (!tactics_password_required($row)) {
        return '';
    }
    $hash = (string) ($row['password_hash'] ?? '');
    if ($hash === '') {
        return '';
    }

    return substr(hash('sha256', $hash), 0, 16);
}

function tactics_token_extra_for_room(array $row): array {
    $fp = tactics_room_password_fingerprint($row);

    return $fp !== '' ? ['pwd_fp' => $fp] : [];
}

function tactics_token_password_fingerprint_valid(array $row, ?array $payload): bool {
    $expected = tactics_room_password_fingerprint($row);
    if ($expected === '') {
        return true;
    }
    if (!is_array($payload)) {
        return false;
    }
    $got = trim((string) ($payload['pwd_fp'] ?? ''));

    return $got !== '' && hash_equals($expected, $got);
}

function tactics_verify_room_token($db, string $token, array $row): ?array {
    $publicId = (string) ($row['public_id'] ?? '');
    $payload = tactics_verify_signed_token($db, $token, $publicId);
    if ($payload === null) {
        return null;
    }
    if (!tactics_token_password_fingerprint_valid($row, $payload)) {
        return null;
    }

    return $payload;
}

function tactics_issue_ws_token($db, string $publicId, string $clientId, string $nickname, string $role, array $row): string {
    return tactics_issue_token(
        $db,
        $publicId,
        $clientId,
        $nickname,
        $role,
        TACTICS_WS_TOKEN_TTL_SEC,
        tactics_token_extra_for_room($row)
    );
}

function tactics_issue_access_token($db, string $publicId, string $clientId, string $nickname, bool $isOwner, array $row): string {
    $ttl = $isOwner ? TACTICS_TOKEN_TTL_OWNER_SEC : TACTICS_TOKEN_TTL_GUEST_SEC;
    $role = $isOwner ? 'owner' : 'guest';

    return tactics_issue_token(
        $db,
        $publicId,
        $clientId,
        $nickname,
        $role,
        $ttl,
        tactics_token_extra_for_room($row)
    );
}

function tactics_sanitize_nickname(string $nickname): string {
    $nickname = trim(preg_replace('/\s+/u', ' ', $nickname) ?? '');
    if ($nickname === '') {
        return 'Guest';
    }
    if (function_exists('mb_substr')) {
        return mb_substr($nickname, 0, TACTICS_NICKNAME_MAX_LEN);
    }

    return substr($nickname, 0, TACTICS_NICKNAME_MAX_LEN);
}

function tactics_nick_color_palette(): array {
    return [
        '#b388ff', '#ff8a80', '#82b1ff', '#69f0ae', '#ffd180',
        '#ea80fc', '#84ffff', '#f48fb1', '#a7ffeb', '#ffe57f',
        '#8c9eff', '#ff9e80', '#80d8ff', '#ccff90', '#ea80fc',
        '#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#818cf8',
    ];
}

function tactics_default_nick_color(string $clientId): string {
    $colors = tactics_nick_color_palette();
    $hash = 0;
    $len = strlen($clientId);
    for ($i = 0; $i < $len; $i++) {
        $hash = (($hash << 5) - $hash) + ord($clientId[$i]);
        $hash = $hash & 0xFFFFFFFF;
        if ($hash > 0x7FFFFFFF) {
            $hash -= 0x100000000;
        }
    }

    return $colors[abs($hash) % count($colors)];
}

function tactics_sanitize_nick_color(string $color): ?string {
    $color = trim($color);
    if (!preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $color, $matches)) {
        return null;
    }
    $hex = strtolower($matches[1]);
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }

    return '#' . $hex;
}

function tactics_fetch_presence_nick_color($db, string $publicId, string $clientId): ?string {
    ensure_tactics_realtime_tables($db);
    $stmt = $db->getConnection()->prepare(
        'SELECT nick_color FROM tactics_room_presence
         WHERE public_id = ? AND client_id = ?
         LIMIT 1'
    );
    $stmt->execute([$publicId, $clientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    $color = tactics_sanitize_nick_color((string) ($row['nick_color'] ?? ''));

    return $color;
}

function tactics_sanitize_map_code(string $mapCode): string {
    $mapCode = trim(strtolower($mapCode));
    if ($mapCode === '' || !preg_match('/^[a-z0-9_\-]{1,64}$/', $mapCode)) {
        return 'cliff';
    }

    return $mapCode;
}

function tactics_sanitize_side_length($value): ?int {
    if ($value === null || $value === '') {
        return null;
    }
    $n = (int) $value;
    if ($n < 100 || $n > 20000) {
        return null;
    }

    return $n;
}

function tactics_map_asset_path(string $mapCode, string $game = 'wot', string $battleMode = 'random'): string {
    $mapCode = tactics_sanitize_map_code($mapCode);
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode);
    $root = dirname(__DIR__);
    $relPaths = [
        "assets/tactics/maps/{$game}/{$battleMode}/{$mapCode}",
        "assets/tactics/maps/{$game}/{$mapCode}",
        "assets/tactics/maps/{$mapCode}",
    ];
    foreach ($relPaths as $rel) {
        foreach (['webp', 'png', 'jpg', 'jpeg', 'svg'] as $ext) {
            $path = $root . '/' . $rel . '.' . $ext;
            if (is_file($path)) {
                return '/' . $rel . '.' . $ext;
            }
        }
    }

    return '/assets/tactics/maps/placeholder.svg';
}

function tactics_map_has_uploaded_asset(string $mapCode, string $game = 'wot', string $battleMode = 'random'): bool {
    return tactics_map_asset_path($mapCode, $game, $battleMode) !== '/assets/tactics/maps/placeholder.svg';
}

function tactics_map_url(string $mapCode, string $game = 'wot', string $battleMode = 'random'): string {
    return tactics_map_asset_path($mapCode, $game, $battleMode);
}

function tactics_slide_map_url(array $slide, ?string $publicId = null): string {
    if ($publicId !== null && tactics_is_custom_room_slide($slide)) {
        $rel = tactics_custom_room_map_rel_path(
            $publicId,
            (string) ($slide['id'] ?? ''),
            (string) ($slide['game'] ?? '')
        );
        if ($rel !== '') {
            $root = dirname(__DIR__);
            foreach (['webp', 'png', 'jpg', 'jpeg'] as $ext) {
                $path = $root . '/' . $rel . '.' . $ext;
                if (is_file($path)) {
                    return '/' . $rel . '.' . $ext;
                }
            }
        }

        return '/assets/tactics/maps/placeholder.svg';
    }

    return tactics_map_url(
        (string) ($slide['map_code'] ?? 'cliff'),
        (string) ($slide['game'] ?? 'wot'),
        (string) ($slide['battle_mode'] ?? 'random')
    );
}

function tactics_build_slide_map_urls(array $roomData, string $publicId): array {
    $urls = [];
    foreach (($roomData['slides'] ?? []) as $slide) {
        if (!is_array($slide)) {
            continue;
        }
        $slideId = (string) ($slide['id'] ?? '');
        if ($slideId === '') {
            continue;
        }
        $urls[$slideId] = tactics_slide_map_url($slide, $publicId);
    }

    return $urls;
}

function tactics_parse_room_data($raw): array {
    if (is_array($raw)) {
        return tactics_normalize_room_data($raw);
    }
    if (!is_string($raw) || trim($raw) === '') {
        return tactics_default_room_data('cliff');
    }
    $decoded = json_decode($raw, true);

    return is_array($decoded) ? tactics_normalize_room_data($decoded) : tactics_default_room_data('cliff');
}

function tactics_sql_select_columns(string $alias = 'r'): string {
    return implode(', ', [
        "{$alias}.id",
        "{$alias}.public_id",
        "{$alias}.user_id",
        "{$alias}.title",
        "{$alias}.visibility",
        "{$alias}.room_data",
        "{$alias}.revision",
        "{$alias}.last_active_at",
        "{$alias}.created_at",
        "{$alias}.updated_at",
    ]);
}

function tactics_room_has_password(array $row): bool {
    return isset($row['password_hash']) && is_string($row['password_hash']) && $row['password_hash'] !== '';
}

function tactics_password_required(array $row): bool {
    return ($row['visibility'] ?? '') === 'closed' && tactics_room_has_password($row);
}

function tactics_verify_room_password(array $row, ?string $password): bool {
    if (!tactics_password_required($row)) {
        return true;
    }
    if ($password === null || $password === '') {
        return false;
    }
    $hash = (string) ($row['password_hash'] ?? '');

    return $hash !== '' && password_verify($password, $hash);
}

function tactics_assert_can_access_room(
    array $row,
    ?string $password,
    ?int $userId,
    ?string $accessToken = null,
    $db = null
): array {
    if (($row['visibility'] ?? '') === 'open') {
        return ['ok' => true];
    }

    if ($userId !== null && isset($row['user_id']) && (int) $row['user_id'] === $userId) {
        return ['ok' => true];
    }

    if (!tactics_password_required($row)) {
        return ['ok' => true];
    }

    if (tactics_verify_room_password($row, $password)) {
        return ['ok' => true];
    }

    if ($db !== null && $accessToken !== null && $accessToken !== '') {
        $payload = tactics_verify_room_token($db, $accessToken, $row);
        if ($payload !== null) {
            return ['ok' => true];
        }
    }

    if ($password !== null && $password !== '') {
        return [
            'ok' => false,
            'error' => 'wrong_password',
            'needs_password' => true,
        ];
    }

    return [
        'ok' => false,
        'error' => 'password_required',
        'needs_password' => true,
    ];
}

function tactics_assert_can_edit(array $row, ?string $accessToken, ?int $userId, $db): array {
    if ($userId !== null && isset($row['user_id']) && (int) $row['user_id'] === $userId) {
        return ['ok' => true, 'role' => 'owner'];
    }

    if ($accessToken !== null && $accessToken !== '') {
        $payload = tactics_verify_room_token($db, $accessToken, $row);
        if ($payload !== null) {
            return ['ok' => true, 'role' => (string) ($payload['role'] ?? 'guest')];
        }
    }

    return ['ok' => false, 'error' => 'forbidden'];
}

function tactics_token_client_id(?string $accessToken, $db, string $publicId, array $row): string {
    if ($accessToken === null || $accessToken === '') {
        return '';
    }
    $payload = tactics_verify_room_token($db, $accessToken, $row);
    if ($payload === null) {
        return '';
    }

    return trim((string) ($payload['cid'] ?? ''));
}

function tactics_resolve_is_owner(array $row, ?string $accessToken, ?int $userId, $db): bool {
    if ($userId !== null && isset($row['user_id']) && (int) $row['user_id'] === $userId) {
        return true;
    }
    if ($accessToken !== null && $accessToken !== '') {
        $payload = tactics_verify_room_token($db, $accessToken, $row);
        if ($payload !== null && ($payload['role'] ?? '') === 'owner') {
            return true;
        }
    }

    return false;
}

function tactics_normalize_draw_settings(array $settings): array {
    $mode = trim((string) ($settings['draw_mode'] ?? 'restricted'));
    $settings['draw_mode'] = $mode === 'open' ? 'open' : 'restricted';

    $editors = $settings['editors'] ?? [];
    if (!is_array($editors)) {
        $editors = [];
    }
    $clean = [];
    foreach ($editors as $editorId) {
        $editorId = trim((string) $editorId);
        if ($editorId !== '' && preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $editorId)) {
            $clean[$editorId] = $editorId;
        }
    }
    $settings['editors'] = array_values($clean);

    $mode = trim((string) ($settings['cursors_mode'] ?? 'open'));
    $settings['cursors_mode'] = $mode === 'off' ? 'off' : 'open';

    $settings['presentation_mode'] = !empty($settings['presentation_mode']);
    if ($settings['presentation_mode']) {
        $hostId = trim((string) ($settings['presentation_host_id'] ?? ''));
        if ($hostId !== '' && preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $hostId)) {
            $settings['presentation_host_id'] = $hostId;
        } else {
            unset($settings['presentation_host_id']);
        }
        $hostNick = trim((string) ($settings['presentation_host_nickname'] ?? ''));
        if ($hostNick !== '') {
            $settings['presentation_host_nickname'] = mb_substr($hostNick, 0, 32);
        } else {
            unset($settings['presentation_host_nickname']);
        }
    } else {
        unset($settings['presentation_mode'], $settings['presentation_host_id'], $settings['presentation_host_nickname']);
    }

    if (array_key_exists('show_grid', $settings)) {
        $settings['show_grid'] = ($settings['show_grid'] !== false);
    }

    return $settings;
}

function tactics_presentation_settings(array $roomData): array {
    $settings = tactics_normalize_draw_settings(is_array($roomData['settings'] ?? null) ? $roomData['settings'] : []);

    return [
        'presentation_mode' => !empty($settings['presentation_mode']),
        'presentation_host_id' => trim((string) ($settings['presentation_host_id'] ?? '')),
    ];
}

function tactics_presentation_settings_changed(array $old, array $new): bool {
    $oldPres = tactics_presentation_settings($old);
    $newPres = tactics_presentation_settings($new);

    if ($oldPres['presentation_mode'] !== $newPres['presentation_mode']) {
        return true;
    }

    return $oldPres['presentation_host_id'] !== $newPres['presentation_host_id'];
}

function tactics_can_change_presentation_settings(array $old, array $new, string $clientId, bool $isOwner): bool {
    if ($isOwner) {
        return true;
    }

    if ($clientId === '') {
        return false;
    }

    $oldPres = tactics_presentation_settings($old);
    $newPres = tactics_presentation_settings($new);

    if (!$oldPres['presentation_mode'] && $newPres['presentation_mode']) {
        $newHost = $newPres['presentation_host_id'] !== '' ? $newPres['presentation_host_id'] : $clientId;

        return $newHost === $clientId;
    }

    if ($oldPres['presentation_mode']) {
        $hostId = $oldPres['presentation_host_id'];

        if (!$newPres['presentation_mode']) {
            if ($isOwner) {
                return true;
            }
            if ($hostId === '') {
                return tactics_user_can_draw($old, $clientId, $isOwner);
            }

            return $hostId === $clientId;
        }

        if ($isOwner) {
            return true;
        }

        return $hostId !== '' && $hostId === $clientId;
    }

    return true;
}

function tactics_apply_presentation_settings_policy(array $oldRoomData, array $newRoomData, string $clientId, bool $isOwner): array {
    if (!tactics_presentation_settings_changed($oldRoomData, $newRoomData)) {
        return $newRoomData;
    }

    if (tactics_can_change_presentation_settings($oldRoomData, $newRoomData, $clientId, $isOwner)) {
        return $newRoomData;
    }

    $oldPres = tactics_presentation_settings($oldRoomData);
    if (!isset($newRoomData['settings']) || !is_array($newRoomData['settings'])) {
        $newRoomData['settings'] = [];
    }

    $newRoomData['settings']['presentation_mode'] = $oldPres['presentation_mode'];
    if ($oldPres['presentation_host_id'] !== '') {
        $newRoomData['settings']['presentation_host_id'] = $oldPres['presentation_host_id'];
    } else {
        unset($newRoomData['settings']['presentation_host_id']);
    }

    return $newRoomData;
}

function tactics_user_can_draw(array $roomData, string $clientId, bool $isOwner): bool {
    if ($isOwner) {
        return true;
    }

    $settings = is_array($roomData['settings'] ?? null) ? $roomData['settings'] : [];
    if (($settings['draw_mode'] ?? 'restricted') === 'open') {
        return true;
    }

    if ($clientId === '') {
        return false;
    }

    $editors = $settings['editors'] ?? [];
    if (!is_array($editors)) {
        return false;
    }

    return in_array($clientId, $editors, true);
}

function tactics_user_can_share_cursor(array $roomData): bool {
    $settings = is_array($roomData['settings'] ?? null) ? $roomData['settings'] : [];

    return ($settings['cursors_mode'] ?? 'open') !== 'off';
}

function tactics_draw_settings_changed(array $old, array $new): bool {
    $oldSettings = tactics_normalize_draw_settings(is_array($old['settings'] ?? null) ? $old['settings'] : []);
    $newSettings = tactics_normalize_draw_settings(is_array($new['settings'] ?? null) ? $new['settings'] : []);

    if ($oldSettings['draw_mode'] !== $newSettings['draw_mode']) {
        return true;
    }

    if (($oldSettings['cursors_mode'] ?? 'open') !== ($newSettings['cursors_mode'] ?? 'open')) {
        return true;
    }

    $oldEditors = $oldSettings['editors'];
    $newEditors = $newSettings['editors'];
    sort($oldEditors);
    sort($newEditors);

    return $oldEditors !== $newEditors;
}

function tactics_room_slides_structure_changed(array $old, array $new): bool {
    $oldIds = [];
    foreach ($old['slides'] ?? [] as $slide) {
        if (is_array($slide) && isset($slide['id'])) {
            $oldIds[] = (string) $slide['id'];
        }
    }
    $newIds = [];
    foreach ($new['slides'] ?? [] as $slide) {
        if (is_array($slide) && isset($slide['id'])) {
            $newIds[] = (string) $slide['id'];
        }
    }
    sort($oldIds);
    sort($newIds);

    return $oldIds !== $newIds;
}

function tactics_room_slides_ids_removed(array $old, array $new): bool {
    $newIds = [];
    foreach ($new['slides'] ?? [] as $slide) {
        if (is_array($slide) && isset($slide['id'])) {
            $newIds[(string) $slide['id']] = true;
        }
    }

    foreach ($old['slides'] ?? [] as $slide) {
        if (!is_array($slide) || !isset($slide['id'])) {
            continue;
        }
        $slideId = (string) $slide['id'];
        if (!isset($newIds[$slideId])) {
            return true;
        }
    }

    return false;
}

function tactics_room_data_canvas_changed(array $old, array $new): bool {
    $oldMap = [];
    foreach ($old['slides'] ?? [] as $slide) {
        if (!is_array($slide) || !isset($slide['id'])) {
            continue;
        }
        $oldMap[(string) $slide['id']] = json_encode($slide['canvas'] ?? null);
    }

    foreach ($new['slides'] ?? [] as $slide) {
        if (!is_array($slide) || !isset($slide['id'])) {
            continue;
        }
        $slideId = (string) $slide['id'];
        $encoded = json_encode($slide['canvas'] ?? null);
        if (!array_key_exists($slideId, $oldMap) || $oldMap[$slideId] !== $encoded) {
            return true;
        }
    }

    foreach ($oldMap as $slideId => $_) {
        $found = false;
        foreach ($new['slides'] ?? [] as $slide) {
            if (is_array($slide) && (string) ($slide['id'] ?? '') === $slideId) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            return true;
        }
    }

    return false;
}

function tactics_purge_stale_guest_rooms($db, int $days = TACTICS_GUEST_ROOM_INACTIVE_DAYS, bool $throttle = true): int {
    static $lastRun = 0;
    if ($throttle && time() - $lastRun < 300) {
        return 0;
    }
    if ($throttle) {
        $lastRun = time();
    }

    $days = max(1, $days);

    try {
        $rows = $db->fetchAll(
            'SELECT public_id FROM tactics_rooms
             WHERE user_id IS NULL
               AND COALESCE(last_active_at, created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [$days]
        );
        foreach ($rows as $row) {
            tactics_delete_room_custom_map_assets((string) ($row['public_id'] ?? ''));
        }

        return $db->delete(
            'DELETE FROM tactics_rooms
             WHERE user_id IS NULL
               AND COALESCE(last_active_at, created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [$days]
        );
    } catch (Throwable $e) {
        error_log('tactics_purge_stale_guest_rooms: ' . $e->getMessage());

        return 0;
    }
}

function tactics_room_map_codes(array $row): array {
    $data = tactics_parse_room_data($row['room_data'] ?? null);
    $codes = [];
    foreach ($data['slides'] ?? [] as $slide) {
        if (!is_array($slide)) {
            continue;
        }
        $code = trim((string) ($slide['map_code'] ?? ''));
        if ($code !== '') {
            $codes[] = $code;
        }
    }

    return array_values(array_unique($codes));
}

function tactics_format_item(array $row, bool $includeRoomData = true, bool $includePasswordFlag = true): array {
    $item = [
        'public_id' => (string) ($row['public_id'] ?? ''),
        'title' => (string) ($row['title'] ?? ''),
        'visibility' => (string) ($row['visibility'] ?? 'open'),
        'revision' => (int) ($row['revision'] ?? 1),
        'last_active_at' => $row['last_active_at'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'user_id' => isset($row['user_id']) ? (int) $row['user_id'] : null,
    ];

    if ($includePasswordFlag) {
        $item['has_password'] = tactics_room_has_password($row);
    }

    if ($includeRoomData) {
        $item['room_data'] = tactics_parse_room_data($row['room_data'] ?? null);
    }

    return $item;
}

function tactics_strip_inactive_slide_canvas(array $roomItem): array {
    $roomData = $roomItem['room_data'] ?? null;
    if (!is_array($roomData) || !is_array($roomData['slides'] ?? null)) {
        return $roomItem;
    }

    $activeId = (string) ($roomData['active_slide_id'] ?? '');
    foreach ($roomItem['room_data']['slides'] as &$slide) {
        if (!is_array($slide)) {
            continue;
        }
        $slideId = (string) ($slide['id'] ?? '');
        if ($activeId !== '' && $slideId !== '' && $slideId !== $activeId) {
            unset($slide['canvas']);
        }
    }
    unset($slide);

    return $roomItem;
}

function tactics_format_profile_item(array $row, string $lang): array {
    $item = tactics_format_item($row, false, true);
    $roomData = tactics_parse_room_data($row['room_data'] ?? null);
    $item['slides_count'] = count(is_array($roomData['slides'] ?? null) ? $roomData['slides'] : []);
    $item['room_href'] = tactics_build_href($lang, (string) ($row['public_id'] ?? ''));

    return $item;
}

function tactics_fetch_user_rooms($db, int $userId): array {
    return $db->fetchAll(
        'SELECT ' . tactics_sql_select_columns('r') . ', r.password_hash
         FROM tactics_rooms r
         WHERE r.user_id = ?
         ORDER BY r.updated_at DESC, r.id DESC',
        [$userId]
    );
}

function tactics_fetch_row($db, string $publicId, bool $withPassword = false): ?array {
    $cols = tactics_sql_select_columns('r');
    if ($withPassword) {
        $cols .= ', r.password_hash';
    }

    $row = $db->fetchOne(
        "SELECT {$cols} FROM tactics_rooms r WHERE r.public_id = ?",
        [$publicId]
    );

    return is_array($row) ? $row : null;
}

function tactics_fetch_list($db, array $query): array {
    $page = max(1, (int) ($query['page'] ?? 1));
    $limit = max(1, min(50, (int) ($query['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    $search = trim((string) ($query['q'] ?? ''));

    $where = ["r.visibility = 'open'"];
    $params = [];

    if ($search !== '') {
        $where[] = 'r.title LIKE ?';
        $params[] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    try {
        $listParams = array_merge($params, [$limit + 1, $offset]);
        $rows = $db->fetchAll(
            'SELECT ' . tactics_sql_select_columns('r') . ',
                    r.password_hash,
                    u.username AS owner_username,
                    u.wg_nickname AS owner_wg_nickname
             FROM tactics_rooms r
             LEFT JOIN site_users u ON u.id = r.user_id
             WHERE ' . $whereSql . '
             ORDER BY r.last_active_at DESC, r.updated_at DESC, r.id DESC
             LIMIT ? OFFSET ?',
            $listParams
        );
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }

        $lang = ($query['lang'] ?? 'ru') === 'en' ? 'en' : 'ru';

        $items = array_map(static function (array $row) use ($lang): array {
            $item = tactics_format_item($row, false, true);
            $roomData = tactics_parse_room_data($row['room_data'] ?? null);
            $game = tactics_room_primary_game($roomData);
            $item['game'] = $game;
            $item['game_label'] = tactics_game_label($game, $lang);
            $item['game_icon'] = tactics_game_icon_url($game);

            $mapCodes = tactics_room_map_codes($row);
            if ($mapCodes !== []) {
                $item['map_codes'] = $mapCodes;
            }
            $owner = trim((string) ($row['owner_wg_nickname'] ?? ''));
            if ($owner === '') {
                $owner = trim((string) ($row['owner_username'] ?? ''));
            }
            if ($owner !== '') {
                $item['creator_name'] = $owner;
            }

            return $item;
        }, $rows);

        $rowCount = count($items);
        $total = $offset + $rowCount + ($hasMore ? 1 : 0);
        $pages = $hasMore ? ($page + 1) : $page;

        return [
            'success' => true,
            'data' => $items,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => $pages,
            ],
        ];
    } catch (Throwable $e) {
        return ['success' => false, 'error' => 'Ошибка сервера'];
    }
}

function tactics_guest_create_rate_check(string $lang = 'ru'): ?string {
    if (!isset($_SESSION)) {
        return null;
    }

    $now = time();
    $times = $_SESSION['tactics_create_times'] ?? [];
    if (!is_array($times)) {
        $times = [];
    }

    $times = array_values(array_filter($times, static function ($t) use ($now) {
        return is_int($t) && ($now - $t) < TACTICS_GUEST_CREATE_WINDOW_SEC;
    }));

    if (count($times) >= TACTICS_GUEST_CREATE_MAX) {
        return $lang === 'en'
            ? 'Too many rooms created. Try again later.'
            : 'Слишком много комнат за короткое время. Попробуйте позже.';
    }

    return null;
}

function tactics_guest_create_rate_register(): void {
    if (!isset($_SESSION)) {
        return;
    }

    $times = $_SESSION['tactics_create_times'] ?? [];
    if (!is_array($times)) {
        $times = [];
    }
    $times[] = time();
    $_SESSION['tactics_create_times'] = $times;
}

function tactics_build_href(string $lang, string $publicId): string {
    return abs_build_lang_href($lang, 'services/tactics/' . $publicId);
}

function tactics_game_icon_url(string $game): string {
    $game = tactics_sanitize_game($game);
    $icons = [
        'wot' => '/assets/icons/games/wot-white.png',
        'lesta' => '/assets/icons/games/mir-tankov.png',
        'dota2' => '/assets/icons/games/dota2.png',
        'cs2' => '/assets/icons/games/cs2.png',
    ];

    return $icons[$game] ?? $icons['wot'];
}

function tactics_is_custom_room_slide(array $slide): bool {
    $game = tactics_sanitize_game((string) ($slide['game'] ?? ''));
    $mode = tactics_sanitize_battle_mode((string) ($slide['battle_mode'] ?? ''), $game);
    $code = tactics_sanitize_map_code((string) ($slide['map_code'] ?? ''));
    $expected = tactics_custom_map_code_for_game($game);

    return $expected !== null && $mode === 'custom' && $code === $expected;
}

function tactics_custom_upload_params_valid(string $game, string $battleMode, string $mapCode): bool {
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode, $game);
    $mapCode = tactics_sanitize_map_code($mapCode);
    $expected = tactics_custom_map_code_for_game($game);
    if ($expected === null || $battleMode !== 'custom' || $mapCode !== $expected) {
        return false;
    }

    return tactics_is_custom_room_slide([
        'game' => $game,
        'battle_mode' => $battleMode,
        'map_code' => $mapCode,
    ]);
}

function tactics_slide_allows_custom_map_upload(?array $slide, string $game, string $battleMode, string $mapCode): bool {
    if (is_array($slide) && tactics_is_custom_room_slide($slide)) {
        return true;
    }

    return tactics_custom_upload_params_valid($game, $battleMode, $mapCode);
}

function tactics_is_cs2_custom_slide(array $slide): bool {
    return tactics_is_custom_room_slide($slide)
        && tactics_sanitize_game((string) ($slide['game'] ?? '')) === 'cs2';
}

function tactics_custom_room_map_rel_path(string $publicId, string $slideId, string $game = 'cs2'): string {
    $publicId = preg_replace('/[^a-zA-Z0-9]/', '', $publicId);
    $slideId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $slideId);
    $game = tactics_sanitize_game($game);
    if ($publicId === '' || $slideId === '' || !in_array($game, ['cs2', 'dota2'], true)) {
        return '';
    }

    return "assets/tactics/maps/{$game}/custom/rooms/{$publicId}/{$slideId}";
}

function tactics_delete_path_recursive(string $path): void {
    if (!file_exists($path)) {
        return;
    }
    if (is_file($path) || is_link($path)) {
        @unlink($path);

        return;
    }

    $items = scandir($path);
    if (!is_array($items)) {
        @rmdir($path);

        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        tactics_delete_path_recursive($path . DIRECTORY_SEPARATOR . $item);
    }

    @rmdir($path);
}

function tactics_delete_room_custom_map_assets(string $publicId): void {
    $publicId = preg_replace('/[^a-zA-Z0-9]/', '', $publicId);
    if ($publicId === '' || !tactics_public_id_valid($publicId)) {
        return;
    }

    $root = dirname(__DIR__);
    foreach (['cs2', 'dota2'] as $game) {
        tactics_delete_path_recursive($root . '/assets/tactics/maps/' . $game . '/custom/rooms/' . $publicId);
    }
}

function tactics_delete_room($db, string $publicId): bool {
    if (!tactics_public_id_valid($publicId)) {
        return false;
    }

    tactics_delete_room_custom_map_assets($publicId);

    return $db->delete('DELETE FROM tactics_rooms WHERE public_id = ?', [$publicId]) > 0;
}

function tactics_room_primary_game(array $roomData): string {
    $slides = $roomData['slides'] ?? null;
    if (!is_array($slides) || $slides === []) {
        return 'wot';
    }

    $activeId = trim((string) ($roomData['active_slide_id'] ?? ''));
    if ($activeId !== '') {
        foreach ($slides as $slide) {
            if (!is_array($slide)) {
                continue;
            }
            if (trim((string) ($slide['id'] ?? '')) === $activeId) {
                return tactics_sanitize_game((string) ($slide['game'] ?? 'wot'));
            }
        }
    }

    $first = $slides[0];

    return tactics_sanitize_game((string) (is_array($first) ? ($first['game'] ?? 'wot') : 'wot'));
}

function tactics_game_nickname_from_profile(?array $profile, string $game): ?string {
    if (!is_array($profile)) {
        return null;
    }

    if (!function_exists('user_game_nicknames_state')) {
        require_once __DIR__ . '/user_auth.php';
    }

    $game = tactics_sanitize_game($game);
    $nickState = user_game_nicknames_state($profile);
    $pickNick = static function (?string $nick): ?string {
        $nick = trim((string) $nick);
        if ($nick === '' || preg_match('/^#\d+$/', $nick)) {
            return null;
        }

        return $nick;
    };

    if ($game === 'lesta') {
        $nick = $pickNick($nickState['ru']['value'] ?? null);
        if ($nick !== null) {
            return $nick;
        }

        return $pickNick($profile['lesta_nickname'] ?? null);
    }

    if ($game === 'wot') {
        if (function_exists('user_normalize_wg_realm')) {
            $wgRealm = user_normalize_wg_realm((string) ($profile['wg_realm'] ?? ''));
            if ($wgRealm !== '' && $wgRealm !== 'ru' && isset($nickState[$wgRealm])) {
                $nick = $pickNick($nickState[$wgRealm]['value'] ?? null);
                if ($nick !== null) {
                    return $nick;
                }
            }
        }

        $wgNick = $pickNick($profile['wg_nickname'] ?? null);
        if ($wgNick !== null) {
            return $wgNick;
        }

        foreach (['eu', 'na', 'asia'] as $realm) {
            $nick = $pickNick($nickState[$realm]['value'] ?? null);
            if ($nick !== null) {
                return $nick;
            }
        }
    }

    return null;
}

function tactics_default_nickname_for_user(?array $profile, string $lang = 'ru', ?string $game = null): string {
    if (!is_array($profile)) {
        return $lang === 'en' ? 'Guest' : 'Гость';
    }

    if ($game !== null && $game !== '') {
        $gameNick = tactics_game_nickname_from_profile($profile, $game);
        if ($gameNick !== null && $gameNick !== '') {
            return tactics_sanitize_nickname($gameNick);
        }
    }

    $username = trim((string) ($profile['username'] ?? ''));
    if ($username !== '') {
        return tactics_sanitize_nickname($username);
    }

    return $lang === 'en' ? 'Guest' : 'Гость';
}

function tactics_game_nicknames_for_user(?array $profile, string $lang = 'ru'): array {
    $nicknames = [];
    foreach (TACTICS_GAMES as $game) {
        $nicknames[$game] = tactics_default_nickname_for_user($profile, $lang, $game);
    }

    return $nicknames;
}

function tactics_resolve_user_nickname(
    ?array $profile,
    string $lang,
    ?string $game,
    string $inputNickname,
    bool $useProfileOnly = false
): string {
    if ($useProfileOnly && is_array($profile)) {
        return tactics_default_nickname_for_user($profile, $lang, $game);
    }

    $nickname = tactics_sanitize_nickname($inputNickname);

    return $nickname !== '' ? $nickname : ($lang === 'en' ? 'Guest' : 'Гость');
}

function tactics_guest_nickname_prefix(string $lang): string {
    return $lang === 'en' ? 'Guest' : 'Гость';
}

function tactics_parse_guest_nickname_number(string $nickname): ?int {
    $nickname = trim($nickname);
    if ($nickname === 'Guest' || $nickname === 'Гость') {
        return 0;
    }
    if (preg_match('/^(?:Guest|Гость)\s+(\d+)$/u', $nickname, $matches)) {
        $number = (int) $matches[1];

        return $number > 0 ? $number : null;
    }

    return null;
}

function tactics_is_generic_guest_nickname(string $nickname): bool {
    return tactics_parse_guest_nickname_number($nickname) !== null;
}

function tactics_format_guest_nickname(int $number, string $lang): string {
    return tactics_guest_nickname_prefix($lang) . ' ' . max(1, $number);
}

function tactics_fetch_presence_nickname($db, string $publicId, string $clientId): ?string {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return null;
    }

    ensure_tactics_realtime_tables($db);
    $stmt = $db->getConnection()->prepare(
        'SELECT nickname FROM tactics_room_presence WHERE public_id = ? AND client_id = ? LIMIT 1'
    );
    $stmt->execute([$publicId, $clientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }

    $nickname = trim((string) ($row['nickname'] ?? ''));

    return $nickname !== '' ? $nickname : null;
}

function tactics_allocate_guest_nickname($db, string $publicId, string $clientId, string $lang): string {
    $existing = tactics_fetch_presence_nickname($db, $publicId, $clientId);
    if ($existing !== null) {
        $existingNumber = tactics_parse_guest_nickname_number($existing);
        if ($existingNumber !== null && $existingNumber > 0) {
            return tactics_format_guest_nickname($existingNumber, $lang);
        }
    }

    $used = [];
    foreach (tactics_fetch_presence_participants($db, $publicId) as $participant) {
        if (($participant['clientId'] ?? '') === $clientId) {
            continue;
        }
        $number = tactics_parse_guest_nickname_number((string) ($participant['nickname'] ?? ''));
        if ($number !== null && $number > 0) {
            $used[$number] = true;
        }
    }

    $number = 1;
    while (isset($used[$number])) {
        $number++;
    }

    return tactics_format_guest_nickname($number, $lang);
}

function tactics_sanitize_slide_title(string $title): string {
    $title = trim(preg_replace('/\s+/u', ' ', $title) ?? '');
    if ($title === '') {
        return '';
    }
    if (function_exists('mb_strlen') && mb_strlen($title) > 64) {
        return mb_substr($title, 0, 64);
    }

    return strlen($title) > 64 ? substr($title, 0, 64) : $title;
}

function tactics_normalize_room_data(array $roomData): array {
    if (!is_array($roomData['slides'] ?? null)) {
        return $roomData;
    }

    foreach ($roomData['slides'] as $index => $slide) {
        if (!is_array($slide)) {
            continue;
        }
        if (array_key_exists('title', $slide)) {
            $title = tactics_sanitize_slide_title((string) ($slide['title'] ?? ''));
            if ($title === '') {
                unset($roomData['slides'][$index]['title']);
            } else {
                $roomData['slides'][$index]['title'] = $title;
            }
        }
        if (!is_array($slide['view'] ?? null)) {
            $roomData['slides'][$index]['view'] = [];
        }
        if (!array_key_exists('show_grid', $roomData['slides'][$index]['view'])) {
            $roomData['slides'][$index]['view']['show_grid'] = true;
        } else {
            $roomData['slides'][$index]['view']['show_grid'] = ($roomData['slides'][$index]['view']['show_grid'] !== false);
        }
        foreach (['map_width_m', 'map_height_m'] as $scaleKey) {
            if (!array_key_exists($scaleKey, $slide)) {
                continue;
            }
            $meters = tactics_sanitize_side_length($slide[$scaleKey]);
            if ($meters === null) {
                unset($roomData['slides'][$index][$scaleKey]);
            } else {
                $roomData['slides'][$index][$scaleKey] = $meters;
            }
        }
    }

    if (!is_array($roomData['settings'] ?? null)) {
        $roomData['settings'] = [];
    }
    $roomData['settings'] = tactics_normalize_draw_settings($roomData['settings']);
    if (!array_key_exists('show_grid', $roomData['settings'])) {
        $roomData['settings']['show_grid'] = true;
    }

    return $roomData;
}

function tactics_validate_room_data($roomData): array {
    if (!is_array($roomData)) {
        return ['ok' => false, 'error' => 'invalid_room_data'];
    }

    $roomData = tactics_normalize_room_data($roomData);

    $encoded = json_encode($roomData, JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) > TACTICS_ROOM_DATA_MAX_BYTES) {
        return ['ok' => false, 'error' => 'room_data_too_large'];
    }

    $slides = $roomData['slides'] ?? null;
    if (!is_array($slides) || count($slides) === 0) {
        return ['ok' => false, 'error' => 'invalid_slides'];
    }

    if (tactics_room_slides_have_mixed_games($roomData)) {
        return ['ok' => false, 'error' => 'mixed_games'];
    }

    return ['ok' => true, 'data' => $roomData];
}

function tactics_room_slides_have_mixed_games(array $roomData): bool {
    $slides = $roomData['slides'] ?? null;
    if (!is_array($slides) || $slides === []) {
        return false;
    }

    $game = null;
    foreach ($slides as $slide) {
        if (!is_array($slide)) {
            continue;
        }
        $slideGame = tactics_sanitize_game((string) ($slide['game'] ?? 'wot'));
        if ($game === null) {
            $game = $slideGame;
            continue;
        }
        if ($slideGame !== $game) {
            return true;
        }
    }

    return false;
}

function tactics_validate_create_input(array $input, string $lang = 'ru'): array {
    $rawTitle = trim((string) ($input['title'] ?? ''));
    $title = $rawTitle === '' ? ($lang === 'en' ? 'Untitled' : 'Без названия') : $rawTitle;
    if (function_exists('mb_strlen') ? mb_strlen($title) > TACTICS_TITLE_MAX_LEN : strlen($title) > TACTICS_TITLE_MAX_LEN) {
        return ['ok' => false, 'error' => $lang === 'en' ? 'Title too long' : 'Слишком длинное название'];
    }

    $visibility = trim((string) ($input['visibility'] ?? 'closed'));
    if (!tactics_visibility_valid($visibility)) {
        $visibility = 'closed';
    }

    $game = tactics_sanitize_game((string) ($input['game'] ?? 'wot'));
    $battleMode = tactics_sanitize_battle_mode((string) ($input['battle_mode'] ?? 'random'), $game);
    $customMapCode = tactics_custom_map_code_for_game($game);
    if ($battleMode === 'custom' && $customMapCode !== null) {
        $mapCode = tactics_sanitize_map_code($customMapCode);
    } else {
        $mapCode = tactics_sanitize_map_code((string) ($input['map_code'] ?? 'cliff'));
    }
    $password = isset($input['password']) ? (string) $input['password'] : '';
    $passwordHash = null;

    if ($visibility === 'closed' && $password !== '') {
        if (strlen($password) > TACTICS_PASSWORD_MAX_LEN) {
            return ['ok' => false, 'error' => $lang === 'en' ? 'Password too long' : 'Слишком длинный пароль'];
        }
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    }

    $nickname = tactics_sanitize_nickname((string) ($input['nickname'] ?? 'Guest'));
    $clientId = trim((string) ($input['client_id'] ?? ''));
    if ($clientId === '' || !preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $clientId)) {
        $clientId = 'c' . bin2hex(random_bytes(8));
    }

    $roomData = tactics_default_room_data($mapCode, $game, $battleMode);

    return [
        'ok' => true,
        'data' => [
            'title' => $title,
            'visibility' => $visibility,
            'map_code' => $mapCode,
            'game' => $game,
            'battle_mode' => $battleMode,
            'password_hash' => $passwordHash,
            'nickname' => $nickname,
            'client_id' => $clientId,
            'room_data' => $roomData,
        ],
    ];
}

function tactics_touch_room($db, string $publicId): void {
    $db->query(
        'UPDATE tactics_rooms SET last_active_at = CURRENT_TIMESTAMP WHERE public_id = ?',
        [$publicId]
    );
}

function tactics_visibility_label(string $visibility, string $lang = 'ru'): string {
    if ($visibility === 'closed') {
        return $lang === 'en' ? 'Closed' : 'Закрытая';
    }

    return $lang === 'en' ? 'Open' : 'Открытая';
}

function tactics_room_view_path(string $publicId): string {
    return '/services/tactics/' . rawurlencode($publicId);
}

function tactics_admin_fetch_rooms($db, array $query): array {
    $search = trim((string) ($query['q'] ?? ''));
    $visibility = trim((string) ($query['visibility'] ?? ''));

    $where = ['1=1'];
    $params = [];

    if ($visibility !== '' && tactics_visibility_valid($visibility)) {
        $where[] = 'r.visibility = ?';
        $params[] = $visibility;
    }

    if ($search !== '') {
        $where[] = '(r.title LIKE ? OR r.public_id LIKE ?)';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }

    $whereSql = implode(' AND ', $where);

    try {
        $stats = $db->fetchOne(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN visibility = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN visibility = 'closed' THEN 1 ELSE 0 END) AS closed_count
             FROM tactics_rooms"
        );

        $rows = $db->fetchAll(
            'SELECT ' . tactics_sql_select_columns('r') . ',
                    r.password_hash,
                    u.username AS owner_username,
                    u.wg_nickname AS owner_wg_nickname,
                    u.email AS owner_email
             FROM tactics_rooms r
             LEFT JOIN site_users u ON u.id = r.user_id
             WHERE ' . $whereSql . '
             ORDER BY r.last_active_at DESC, r.updated_at DESC, r.id DESC
             LIMIT 500',
            $params
        );

        $items = array_map(static function (array $row): array {
            $roomData = tactics_parse_room_data($row['room_data'] ?? null);
            $slides = is_array($roomData['slides'] ?? null) ? $roomData['slides'] : [];
            $owner = trim((string) ($row['owner_wg_nickname'] ?? ''));
            if ($owner === '') {
                $owner = trim((string) ($row['owner_username'] ?? ''));
            }

            return [
                'id' => (int) ($row['id'] ?? 0),
                'public_id' => (string) ($row['public_id'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'visibility' => (string) ($row['visibility'] ?? 'open'),
                'visibility_label' => tactics_visibility_label((string) ($row['visibility'] ?? 'open')),
                'has_password' => tactics_room_has_password($row),
                'revision' => (int) ($row['revision'] ?? 1),
                'slide_count' => count($slides),
                'map_codes' => tactics_room_map_codes($row),
                'last_active_at' => $row['last_active_at'] ?? null,
                'created_at' => $row['created_at'] ?? null,
                'updated_at' => $row['updated_at'] ?? null,
                'user_id' => isset($row['user_id']) ? (int) $row['user_id'] : null,
                'owner_name' => $owner,
                'owner_email' => (string) ($row['owner_email'] ?? ''),
                'view_url' => tactics_room_view_path((string) ($row['public_id'] ?? '')),
            ];
        }, $rows);

        return [
            'success' => true,
            'data' => $items,
            'stats' => [
                'total' => (int) ($stats['total'] ?? 0),
                'open' => (int) ($stats['open_count'] ?? 0),
                'closed' => (int) ($stats['closed_count'] ?? 0),
            ],
        ];
    } catch (Throwable $e) {
        return ['success' => false, 'error' => 'server_error'];
    }
}

function tactics_admin_delete_room($db, int $id): bool {
    if ($id <= 0) {
        return false;
    }

    $existing = $db->fetchOne('SELECT public_id FROM tactics_rooms WHERE id = ?', [$id]);
    if (!$existing) {
        return false;
    }

    return tactics_delete_room($db, (string) ($existing['public_id'] ?? ''));
}

function tactics_scan_map_assets(): array {
    $root = dirname(__DIR__) . '/assets/tactics/maps';
    $items = [];
    $seen = [];

    $scanDir = static function (string $dir, string $game, string $mode) use (&$items, &$seen): void {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            if (!preg_match('/^([a-z0-9_\-]+)\.(webp|png|jpe?g)$/i', $file, $m)) {
                continue;
            }
            $mapCode = strtolower($m[1]);
            $ext = strtolower($m[2]);
            if ($ext === 'jpeg') {
                $ext = 'jpg';
            }
            $rel = $game === '' || $mode === ''
                ? '/assets/tactics/maps/' . $file
                : '/assets/tactics/maps/' . $game . '/' . $mode . '/' . $file;
            $key = $game . '|' . $mode . '|' . $mapCode;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $full = $dir . '/' . $file;
            $items[] = [
                'game' => $game,
                'battle_mode' => $mode,
                'map_code' => $mapCode,
                'ext' => $ext,
                'url' => $rel,
                'size' => is_file($full) ? (int) filesize($full) : 0,
                'mtime' => is_file($full) ? (int) filemtime($full) : null,
            ];
        }
    };

    $scanDir($root, '', '');
    foreach (TACTICS_GAMES as $game) {
        foreach (tactics_game_modes($game) as $mode) {
            $scanDir($root . '/' . $game . '/' . $mode, $game, $mode);
        }
    }

    usort($items, static function (array $a, array $b): int {
        return [$a['game'], $a['battle_mode'], $a['map_code']] <=> [$b['game'], $b['battle_mode'], $b['map_code']];
    });

    return $items;
}

function tactics_admin_ensure_writable_dir(string $dir): bool {
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }
    @chmod($dir, 0775);

    return is_writable($dir);
}

function tactics_admin_persist_uploaded_file(string $tmp, string $destPath): bool {
    if (@move_uploaded_file($tmp, $destPath)) {
        return true;
    }

    if (@copy($tmp, $destPath)) {
        @unlink($tmp);

        return is_file($destPath);
    }

    return false;
}

function tactics_remove_map_image_variants(string $destBasePath): void {
    foreach (['webp', 'png', 'jpg', 'jpeg'] as $oldExt) {
        $oldPath = $destBasePath . '.' . $oldExt;
        if (!is_file($oldPath)) {
            continue;
        }
        @chmod($oldPath, 0664);
        @unlink($oldPath);
    }
}

function tactics_save_uploaded_map_image(array $fileInfo, string $destBasePath, int $maxBytes): array {
    $error = (int) ($fileInfo['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            return ['ok' => false, 'error' => 'file_too_large'];
        }

        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $tmp = (string) ($fileInfo['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        return ['ok' => false, 'error' => 'upload_failed'];
    }

    $size = (int) ($fileInfo['size'] ?? 0);
    if ($size <= 0 || $size > $maxBytes) {
        return ['ok' => false, 'error' => 'file_too_large'];
    }

    tactics_remove_map_image_variants($destBasePath);

    $destPath = $destBasePath . '.webp';
    $saved = abs_save_uploaded_image_as_webp($tmp, $destPath, ABS_IMAGE_UPLOAD_WEBP_QUALITY, true, TACTICS_MAP_UPLOAD_MAX_DIMENSION);
    if (!$saved['ok']) {
        $map = [
            'invalid_image' => 'invalid_image',
            'invalid_type' => 'invalid_type',
            'webp_unsupported' => 'save_failed',
            'save_failed' => 'save_failed',
            'upload_failed' => 'upload_failed',
            'mkdir_failed' => 'mkdir_failed',
        ];

        return ['ok' => false, 'error' => $map[$saved['error'] ?? ''] ?? 'save_failed'];
    }

    return [
        'ok' => true,
        'ext' => 'webp',
        'path' => $destPath,
        'size' => (int) ($saved['size'] ?? filesize($destPath)),
    ];
}

function tactics_admin_save_map_upload(string $game, string $battleMode, string $mapCode, array $fileInfo): array {
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode, $game);
    $mapCode = tactics_sanitize_map_code($mapCode);

    $destDir = dirname(__DIR__) . '/assets/tactics/maps/' . $game . '/' . $battleMode;
    if (!tactics_admin_ensure_writable_dir($destDir)) {
        return ['ok' => false, 'error' => 'mkdir_failed'];
    }

    $destBasePath = $destDir . '/' . $mapCode;
    $saved = tactics_save_uploaded_map_image($fileInfo, $destBasePath, tactics_map_upload_max_bytes());
    if (!$saved['ok']) {
        return ['ok' => false, 'error' => $saved['error'] ?? 'save_failed'];
    }

    return [
        'ok' => true,
        'data' => [
            'game' => $game,
            'battle_mode' => $battleMode,
            'map_code' => $mapCode,
            'ext' => 'webp',
            'url' => '/assets/tactics/maps/' . $game . '/' . $battleMode . '/' . $mapCode . '.webp',
            'size' => (int) ($saved['size'] ?? 0),
        ],
    ];
}

function tactics_slug_from_display_name(string $name): string {
    $name = trim($name);
    if ($name === '') {
        return '';
    }

    static $cyr = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e',
        'ж' => 'zh', 'з' => 'z', 'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm',
        'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u',
        'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'sch',
        'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
    ];

    $lower = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
    $out = '';
    $len = function_exists('mb_strlen') ? mb_strlen($lower, 'UTF-8') : strlen($lower);
    for ($i = 0; $i < $len; $i++) {
        $ch = function_exists('mb_substr') ? mb_substr($lower, $i, 1, 'UTF-8') : $lower[$i];
        if (isset($cyr[$ch])) {
            $out .= $cyr[$ch];
        } elseif (preg_match('/[a-z0-9]/', $ch)) {
            $out .= $ch;
        } elseif ($ch === ' ' || $ch === '-' || $ch === '_') {
            $out .= '_';
        }
    }

    $slug = trim(preg_replace('/_+/', '_', $out), '_');
    if ($slug === '') {
        $translit = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        if (is_string($translit) && $translit !== '') {
            $slug = trim(preg_replace('/[^a-z0-9]+/', '_', strtolower($translit)), '_');
        }
    }
    if ($slug === '') {
        $slug = 'map_' . substr(md5($name), 0, 8);
    }

    return substr($slug, 0, 48);
}

function tactics_map_code_suffix_for_mode(string $battleMode, string $game = 'wot'): string {
    $game = tactics_sanitize_game($game);
    $mode = tactics_sanitize_battle_mode($battleMode, $game);
    if ($game === 'cs2') {
        $map = ['defuse' => 'def', 'hostage' => 'hos', 'wingman' => 'win', 'custom' => 'cus'];

        return $map[$mode] ?? $mode;
    }
    if ($game === 'dota2') {
        return '';
    }
    $map = [
        'random' => '',
        'encounter' => 'enc',
        'assault' => 'att',
        'custom' => 'oth',
    ];

    return $map[$mode] ?? $mode;
}

function tactics_propose_map_code(string $displayName, string $battleMode, string $game = 'wot'): string {
    $slug = tactics_slug_from_display_name($displayName);
    $suffix = tactics_map_code_suffix_for_mode($battleMode, $game);
    if ($suffix === '') {
        return $slug;
    }

    return substr($slug . '_' . $suffix, 0, 64);
}

function tactics_generate_unique_map_code($db, string $baseCode): string {
    $code = tactics_sanitize_map_code($baseCode);
    if ($code === 'cliff' && strtolower(trim($baseCode)) !== 'cliff') {
        $code = 'map_' . substr(md5($baseCode), 0, 8);
    }

    $candidate = $code;
    $n = 2;
    while ($db->fetchOne('SELECT map_code FROM map_dictionary WHERE map_code = ?', [$candidate])) {
        $suffix = '_' . $n;
        $candidate = substr($code, 0, max(1, 64 - strlen($suffix))) . $suffix;
        $n++;
    }

    return $candidate;
}

function tactics_fetch_map_assignment_index($db): array {
    require_once __DIR__ . '/../config/ensure_tactics.php';
    ensure_tactics_map_assignments_table($db);

    try {
        $rows = $db->fetchAll('SELECT map_code, game, battle_mode FROM tactics_map_assignments');
    } catch (Throwable $e) {
        return [];
    }

    $index = [];
    foreach ($rows as $row) {
        $code = (string) ($row['map_code'] ?? '');
        $game = tactics_sanitize_game((string) ($row['game'] ?? ''));
        $mode = tactics_sanitize_battle_mode((string) ($row['battle_mode'] ?? ''), $game);
        if ($code === '') {
            continue;
        }
        $index[$code][$game][$mode] = true;
    }

    return $index;
}

function tactics_admin_ensure_map_assignment($db, string $mapCode, string $game, string $battleMode): void {
    require_once __DIR__ . '/../config/ensure_tactics.php';
    ensure_tactics_map_assignments_table($db);
    $mapCode = tactics_sanitize_map_code($mapCode);
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode, $game);
    $db->query(
        'INSERT IGNORE INTO tactics_map_assignments (map_code, game, battle_mode) VALUES (?, ?, ?)',
        [$mapCode, $game, $battleMode]
    );
}

function tactics_admin_create_tactics_map(
    $db,
    string $game,
    string $battleMode,
    string $displayNameRu,
    string $displayNameEn,
    ?string $mapCodeInput,
    $sideLength,
    array $fileInfo
): array {
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode, $game);
    if (in_array($game, ['cs2', 'dota2'], true) && $battleMode === 'custom') {
        return ['ok' => false, 'error' => 'custom_in_room'];
    }
    $displayNameRu = trim($displayNameRu);
    $displayNameEn = trim($displayNameEn);

    if ($displayNameRu === '' && $displayNameEn !== '') {
        $displayNameRu = $displayNameEn;
    }

    if ($displayNameRu === '') {
        return ['ok' => false, 'error' => 'empty_name'];
    }
    if (function_exists('mb_strlen') && mb_strlen($displayNameRu, 'UTF-8') > 255) {
        $displayNameRu = mb_substr($displayNameRu, 0, 255, 'UTF-8');
    } elseif (strlen($displayNameRu) > 255) {
        $displayNameRu = substr($displayNameRu, 0, 255);
    }
    if ($displayNameEn === '') {
        $displayNameEn = $displayNameRu;
    }
    if (function_exists('mb_strlen') && mb_strlen($displayNameEn, 'UTF-8') > 255) {
        $displayNameEn = mb_substr($displayNameEn, 0, 255, 'UTF-8');
    } elseif (strlen($displayNameEn) > 255) {
        $displayNameEn = substr($displayNameEn, 0, 255);
    }

    $meters = tactics_sanitize_side_length($sideLength);
    if ($meters === null) {
        return ['ok' => false, 'error' => 'invalid_side_length'];
    }

    ensure_map_dictionary_table($db);
    ensure_map_dictionary_admin_columns($db);

    $mapCodeRaw = trim((string) $mapCodeInput);
    if ($mapCodeRaw !== '') {
        $mapCode = tactics_sanitize_map_code($mapCodeRaw);
        if ($mapCode === 'cliff' && strtolower($mapCodeRaw) !== 'cliff') {
            return ['ok' => false, 'error' => 'invalid_map_code'];
        }
    } else {
        $proposed = tactics_propose_map_code($displayNameRu, $battleMode, $game);
        $mapCode = tactics_generate_unique_map_code($db, $proposed);
    }

    $existing = $db->fetchOne(
        'SELECT map_code FROM map_dictionary WHERE map_code = ?',
        [$mapCode]
    );
    try {
        if ($existing) {
            $db->query(
                'UPDATE map_dictionary SET display_name_ru = ?, display_name_en = ?, side_length = ? WHERE map_code = ?',
                [$displayNameRu, $displayNameEn, $meters, $mapCode]
            );
        } else {
            $db->query(
                'INSERT INTO map_dictionary (map_code, display_name_ru, display_name_en, side_length, is_moderated) VALUES (?, ?, ?, ?, 1)',
                [$mapCode, $displayNameRu, $displayNameEn, $meters]
            );
        }

        tactics_admin_ensure_map_assignment($db, $mapCode, $game, $battleMode);
    } catch (Throwable $e) {
        return ['ok' => false, 'error' => 'db_error'];
    }

    $upload = tactics_admin_save_map_upload($game, $battleMode, $mapCode, $fileInfo);
    if (!$upload['ok']) {
        return $upload;
    }

    return [
        'ok' => true,
        'data' => array_merge($upload['data'] ?? [], [
            'map_code' => $mapCode,
            'display_name_ru' => $displayNameRu,
            'display_name_en' => $displayNameEn,
            'side_length' => $meters,
            'game' => $game,
            'battle_mode' => $battleMode,
        ]),
    ];
}

function tactics_admin_set_map_side_length($db, string $mapCode, $sideLength): array {
    $mapCode = tactics_sanitize_map_code($mapCode);
    $meters = tactics_sanitize_side_length($sideLength);
    if ($meters === null) {
        return ['ok' => false, 'error' => 'invalid_side_length'];
    }

    ensure_map_dictionary_table($db);
    $exists = $db->fetchOne('SELECT map_code FROM map_dictionary WHERE map_code = ?', [$mapCode]);
    if (!$exists) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    $db->query('UPDATE map_dictionary SET side_length = ? WHERE map_code = ?', [$meters, $mapCode]);

    return ['ok' => true, 'side_length' => $meters];
}

function tactics_admin_update_tactics_map(
    $db,
    string $mapCode,
    string $game,
    string $battleMode,
    string $displayNameRu,
    string $displayNameEn,
    $sideLength,
    ?array $fileInfo = null
): array {
    $mapCode = tactics_sanitize_map_code($mapCode);
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode, $game);

    $displayNameRu = trim($displayNameRu);
    $displayNameEn = trim($displayNameEn);
    if ($displayNameRu === '' && $displayNameEn !== '') {
        $displayNameRu = $displayNameEn;
    }
    if ($displayNameRu === '') {
        return ['ok' => false, 'error' => 'empty_name'];
    }
    if (function_exists('mb_strlen') && mb_strlen($displayNameRu, 'UTF-8') > 255) {
        $displayNameRu = mb_substr($displayNameRu, 0, 255, 'UTF-8');
    } elseif (strlen($displayNameRu) > 255) {
        $displayNameRu = substr($displayNameRu, 0, 255);
    }
    if ($displayNameEn === '') {
        $displayNameEn = $displayNameRu;
    }
    if (function_exists('mb_strlen') && mb_strlen($displayNameEn, 'UTF-8') > 255) {
        $displayNameEn = mb_substr($displayNameEn, 0, 255, 'UTF-8');
    } elseif (strlen($displayNameEn) > 255) {
        $displayNameEn = substr($displayNameEn, 0, 255);
    }

    $meters = tactics_sanitize_side_length($sideLength);
    if ($meters === null) {
        return ['ok' => false, 'error' => 'invalid_side_length'];
    }

    ensure_map_dictionary_table($db);
    ensure_map_dictionary_admin_columns($db);

    $exists = $db->fetchOne(
        'SELECT map_code FROM map_dictionary WHERE map_code = ?',
        [$mapCode]
    );
    if (!$exists) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    $assetPath = dirname(__DIR__) . '/assets/tactics/maps/' . $game . '/' . $battleMode . '/' . $mapCode;
    $hasAsset = false;
    foreach (['webp', 'png', 'jpg', 'jpeg'] as $ext) {
        if (is_file($assetPath . '.' . $ext)) {
            $hasAsset = true;
            break;
        }
    }
    if (!$hasAsset && $fileInfo === null) {
        return ['ok' => false, 'error' => 'asset_not_found'];
    }

    try {
        $db->query(
            'UPDATE map_dictionary SET display_name_ru = ?, display_name_en = ?, side_length = ? WHERE map_code = ?',
            [$displayNameRu, $displayNameEn, $meters, $mapCode]
        );
        tactics_admin_ensure_map_assignment($db, $mapCode, $game, $battleMode);
    } catch (Throwable $e) {
        return ['ok' => false, 'error' => 'db_error'];
    }

    $uploadData = null;
    if ($fileInfo !== null) {
        $upload = tactics_admin_save_map_upload($game, $battleMode, $mapCode, $fileInfo);
        if (!$upload['ok']) {
            return $upload;
        }
        $uploadData = $upload['data'] ?? null;
    }

    return [
        'ok' => true,
        'data' => array_merge([
            'map_code' => $mapCode,
            'game' => $game,
            'battle_mode' => $battleMode,
            'display_name_ru' => $displayNameRu,
            'display_name_en' => $displayNameEn,
            'side_length' => $meters,
        ], is_array($uploadData) ? $uploadData : []),
    ];
}

function tactics_admin_delete_map_asset($db, string $game, string $battleMode, string $mapCode): array {
    $game = tactics_sanitize_game($game);
    $battleMode = tactics_sanitize_battle_mode($battleMode);
    $mapCode = tactics_sanitize_map_code($mapCode);

    $destDir = dirname(__DIR__) . '/assets/tactics/maps/' . $game . '/' . $battleMode;
    $deleted = false;
    foreach (['webp', 'png', 'jpg', 'jpeg'] as $ext) {
        $path = $destDir . '/' . $mapCode . '.' . $ext;
        if (is_file($path) && @unlink($path)) {
            $deleted = true;
        }
    }

    if (!$deleted) {
        return ['ok' => false, 'error' => 'not_found'];
    }

    require_once __DIR__ . '/../config/ensure_tactics.php';
    ensure_tactics_map_assignments_table($db);
    $db->query(
        'DELETE FROM tactics_map_assignments WHERE map_code = ? AND game = ? AND battle_mode = ?',
        [$mapCode, $game, $battleMode]
    );

    return ['ok' => true];
}

function tactics_ws_public_url(): string {
    $host = $_SERVER['HTTP_HOST'] ?? 'chadow.ru';
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $scheme = $secure ? 'wss' : 'ws';

    return $scheme . '://' . $host . '/tactics-ws';
}

function tactics_ws_internal_base_url(): string {
    $port = getenv('TACTICS_WS_PORT');
    if (!is_string($port) || trim($port) === '') {
        $port = '8791';
    }

    return 'http://127.0.0.1:' . trim($port);
}

function tactics_presence_ttl_sec(): int {
    return 45;
}

function tactics_upsert_presence($db, string $publicId, string $clientId, string $nickname, ?string $nickColor = null): void {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return;
    }

    ensure_tactics_realtime_tables($db);
    $nickname = tactics_sanitize_nickname($nickname);
    $color = $nickColor !== null ? tactics_sanitize_nick_color($nickColor) : null;
    if ($color !== null) {
        $stmt = $db->getConnection()->prepare(
            'INSERT INTO tactics_room_presence (public_id, client_id, nickname, nick_color, last_seen_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), nick_color = VALUES(nick_color), last_seen_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$publicId, $clientId, $nickname, $color]);

        return;
    }
    $stmt = $db->getConnection()->prepare(
        'INSERT INTO tactics_room_presence (public_id, client_id, nickname, last_seen_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), last_seen_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$publicId, $clientId, $nickname]);
}

function tactics_update_presence_nick_color($db, string $publicId, string $clientId, string $nickname, string $nickColor): void {
    tactics_upsert_presence($db, $publicId, $clientId, $nickname, $nickColor);
}

function tactics_update_presence_cursor(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $slideId,
    array $payload
): void {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return;
    }

    ensure_tactics_realtime_tables($db);
    $nickname = tactics_sanitize_nickname($nickname);

    if (empty($payload['visible'])) {
        $stmt = $db->getConnection()->prepare(
            'INSERT INTO tactics_room_presence (public_id, client_id, nickname, last_seen_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
                nickname = VALUES(nickname),
                cursor_slide_id = NULL,
                cursor_payload = NULL,
                cursor_updated_at = NULL,
                last_seen_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([$publicId, $clientId, $nickname]);

        return;
    }

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if (!is_string($payloadJson)) {
        $payloadJson = '{}';
    }

    $stmt = $db->getConnection()->prepare(
        'INSERT INTO tactics_room_presence
            (public_id, client_id, nickname, cursor_slide_id, cursor_payload, cursor_updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
            nickname = VALUES(nickname),
            cursor_slide_id = VALUES(cursor_slide_id),
            cursor_payload = VALUES(cursor_payload),
            cursor_updated_at = CURRENT_TIMESTAMP(3),
            last_seen_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$publicId, $clientId, $nickname, $slideId, $payloadJson]);
}

function tactics_fetch_presence_participants($db, string $publicId): array {
    if (!tactics_public_id_valid($publicId)) {
        return [];
    }

    ensure_tactics_realtime_tables($db);
    $ttl = tactics_presence_ttl_sec();
    $stmt = $db->getConnection()->prepare(
        'SELECT client_id, nickname, nick_color, cursor_slide_id, cursor_payload, cursor_updated_at
         FROM tactics_room_presence
         WHERE public_id = ?
           AND last_seen_at >= (CURRENT_TIMESTAMP - INTERVAL ? SECOND)
         ORDER BY nickname ASC, client_id ASC'
    );
    $stmt->execute([$publicId, $ttl]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows)) {
        return [];
    }

    $participants = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $clientId = trim((string) ($row['client_id'] ?? ''));
        if ($clientId === '') {
            continue;
        }
        $item = [
            'clientId' => $clientId,
            'nickname' => trim((string) ($row['nickname'] ?? '')),
        ];
        $storedNickColor = tactics_sanitize_nick_color((string) ($row['nick_color'] ?? ''));
        if ($storedNickColor !== null) {
            $item['nickColor'] = $storedNickColor;
        }
        $cursorUpdatedAt = $row['cursor_updated_at'] ?? null;
        $cursorPayload = json_decode((string) ($row['cursor_payload'] ?? ''), true);
        if ($cursorUpdatedAt && is_array($cursorPayload) && !empty($cursorPayload['visible'])) {
            $item['cursor'] = [
                'slideId' => (string) ($row['cursor_slide_id'] ?? ''),
                'x' => (float) ($cursorPayload['x'] ?? 0),
                'y' => (float) ($cursorPayload['y'] ?? 0),
                'visible' => !empty($cursorPayload['visible']),
                'nickname' => (string) ($cursorPayload['nickname'] ?? $item['nickname']),
                'updatedAt' => (string) $cursorUpdatedAt,
            ];
        }
        $participants[] = $item;
    }

    return $participants;
}

function tactics_merge_presence_nick_colors($db, string $publicId, array $participants): array {
    if (!tactics_public_id_valid($publicId) || $participants === []) {
        return $participants;
    }

    $dbParticipants = tactics_fetch_presence_participants($db, $publicId);
    $colorByClient = [];
    foreach ($dbParticipants as $participant) {
        if (!is_array($participant)) {
            continue;
        }
        $clientId = trim((string) ($participant['clientId'] ?? ''));
        $nickColor = tactics_sanitize_nick_color((string) ($participant['nickColor'] ?? ''));
        if ($clientId !== '' && $nickColor !== null) {
            $colorByClient[$clientId] = $nickColor;
        }
    }
    if ($colorByClient === []) {
        return $participants;
    }

    $merged = [];
    foreach ($participants as $participant) {
        if (!is_array($participant)) {
            $merged[] = $participant;
            continue;
        }
        $clientId = trim((string) ($participant['clientId'] ?? ''));
        $existing = tactics_sanitize_nick_color((string) ($participant['nickColor'] ?? ''));
        if ($existing === null && $clientId !== '' && isset($colorByClient[$clientId])) {
            $participant['nickColor'] = $colorByClient[$clientId];
        }
        $merged[] = $participant;
    }

    return $merged;
}

function tactics_push_room_event(
    $db,
    string $publicId,
    string $clientId,
    string $eventType,
    string $slideId,
    array $payload
): int {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return 0;
    }

    ensure_tactics_realtime_tables($db);
    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if (!is_string($payloadJson)) {
        $payloadJson = '{}';
    }

    $stmt = $db->getConnection()->prepare(
        'INSERT INTO tactics_room_events (public_id, client_id, event_type, slide_id, payload)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$publicId, $clientId, $eventType, $slideId, $payloadJson]);

    return (int) $db->getConnection()->lastInsertId();
}

function tactics_fetch_room_events($db, string $publicId, int $sinceId): array {
    if (!tactics_public_id_valid($publicId)) {
        return [];
    }

    ensure_tactics_realtime_tables($db);
    $stmt = $db->getConnection()->prepare(
        'SELECT id, client_id, event_type, slide_id, payload, created_at
         FROM tactics_room_events
         WHERE public_id = ?
           AND id > ?
           AND created_at >= (CURRENT_TIMESTAMP(3) - INTERVAL 30 SECOND)
         ORDER BY id ASC
         LIMIT 200'
    );
    $stmt->execute([$publicId, max(0, $sinceId)]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows)) {
        return [];
    }

    $events = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $payload = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) {
            $payload = [];
        }
        $events[] = [
            'id' => (int) ($row['id'] ?? 0),
            'clientId' => (string) ($row['client_id'] ?? ''),
            'eventType' => (string) ($row['event_type'] ?? ''),
            'slideId' => (string) ($row['slide_id'] ?? ''),
            'payload' => $payload,
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ];
    }

    return $events;
}

function tactics_purge_room_realtime($db): void {
    static $lastPurgeAt = 0;
    if (time() - $lastPurgeAt < 60) {
        return;
    }
    $lastPurgeAt = time();

    ensure_tactics_realtime_tables($db);
    $pdo = $db->getConnection();
    $ttl = tactics_presence_ttl_sec();
    $pdo->prepare(
        'DELETE FROM tactics_room_presence
         WHERE last_seen_at < (CURRENT_TIMESTAMP - INTERVAL ? SECOND)'
    )->execute([$ttl * 4]);
    $pdo->exec(
        'DELETE FROM tactics_room_events
         WHERE created_at < (CURRENT_TIMESTAMP(3) - INTERVAL 30 SECOND)'
    );
}

function tactics_fetch_ws_presence($db, string $token): ?array {
    $url = tactics_ws_internal_base_url()
        . '/presence?token='
        . rawurlencode($token);

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 1,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !($data['success'] ?? false)) {
        return null;
    }

    $participants = $data['participants'] ?? null;
    if (!is_array($participants)) {
        return [];
    }

    return $participants;
}

function tactics_fetch_room_chat($db, string $publicId, int $sinceId = 0, int $limit = 100): array {
    if (!tactics_public_id_valid($publicId)) {
        return [];
    }

    ensure_tactics_realtime_tables($db);
    $limit = max(1, min(200, $limit));
    $stmt = $db->getConnection()->prepare(
        'SELECT id, client_id, nickname, message, created_at
         FROM tactics_room_chat
         WHERE public_id = ?
           AND id > ?
         ORDER BY id ASC
         LIMIT ' . (int) $limit
    );
    $stmt->execute([$publicId, max(0, $sinceId)]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows)) {
        return [];
    }

    $messages = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $messages[] = [
            'id' => (int) ($row['id'] ?? 0),
            'clientId' => (string) ($row['client_id'] ?? ''),
            'nickname' => (string) ($row['nickname'] ?? 'Guest'),
            'message' => (string) ($row['message'] ?? ''),
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ];
    }

    return $messages;
}

function tactics_insert_room_chat(
    $db,
    string $publicId,
    string $clientId,
    string $nickname,
    string $message
): int {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return 0;
    }

    ensure_tactics_realtime_tables($db);
    $cleanMessage = tactics_sanitize_chat_message($message);
    if ($cleanMessage === '') {
        return 0;
    }

    $nickname = tactics_sanitize_nickname($nickname);
    $stmt = $db->getConnection()->prepare(
        'INSERT INTO tactics_room_chat (public_id, client_id, nickname, message)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$publicId, $clientId, $nickname, $cleanMessage]);

    return (int) $db->getConnection()->lastInsertId();
}

function tactics_sanitize_chat_message(string $message): string {
    $clean = trim(preg_replace('/\s+/u', ' ', $message) ?? '');
    if ($clean === '') {
        return '';
    }

    return mb_substr($clean, 0, 500);
}

function tactics_chat_rate_limit_ok($db, string $publicId, string $clientId): bool {
    if (!tactics_public_id_valid($publicId) || $clientId === '') {
        return false;
    }

    ensure_tactics_realtime_tables($db);
    $stmt = $db->getConnection()->prepare(
        'SELECT id FROM tactics_room_chat
         WHERE public_id = ? AND client_id = ?
           AND created_at >= (NOW(3) - INTERVAL 1 SECOND)
         ORDER BY id DESC
         LIMIT 1'
    );
    $stmt->execute([$publicId, $clientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return !is_array($row);
}
