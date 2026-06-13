<?php

if (!function_exists('ensure_aim_scores_table')) {
    require_once __DIR__ . '/../config/ensure_aim.php';
}

const AIM_TRAINERS = ['flick', 'tracking', 'reaction', 'lead', 'gridshot', 'duckhunt'];

const AIM_PLAYER_NAME_MIN = 2;
const AIM_PLAYER_NAME_MAX = 32;

const AIM_SUBMIT_RATE_SEC = 30;

const AIM_SCORE_RANGES = [
    'flick' => [0, 15000],
    'tracking' => [0, 1000],
    'reaction' => [0, 10000],
    'lead' => [0, 55000],
    'gridshot' => [0, 5000],
    'duckhunt' => [0, 12000],
];

const AIM_GRADE_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];

const AIM_GRADE_THRESHOLDS = [
    'flick' => ['SSS' => 9000, 'SS' => 7000, 'S' => 5000, 'A' => 3500, 'B' => 2000, 'C' => 800, 'D' => 0],
    'tracking' => ['SSS' => 900, 'SS' => 850, 'S' => 780, 'A' => 620, 'B' => 420, 'C' => 180, 'D' => 0],
    'reaction' => ['SSS' => 9900, 'SS' => 9600, 'S' => 9200, 'A' => 8500, 'B' => 7500, 'C' => 6000, 'D' => 0],
    'lead' => ['SSS' => 38000, 'SS' => 28000, 'S' => 18000, 'A' => 10000, 'B' => 5000, 'C' => 1500, 'D' => 0],
    'gridshot' => ['SSS' => 125, 'SS' => 105, 'S' => 85, 'A' => 65, 'B' => 45, 'C' => 20, 'D' => 0],
    'duckhunt' => ['SSS' => 7500, 'SS' => 5500, 'S' => 4000, 'A' => 2800, 'B' => 1500, 'C' => 500, 'D' => 0],
];

function aim_device_sniff_script(): string
{
    return '<script>(function(){var d=document.documentElement,ua=navigator.userAgent||"",ss=Math.min(screen.width||0,screen.height||0,innerWidth,innerHeight),m=(navigator.userAgentData&&navigator.userAgentData.mobile===true)||/iPhone|iPod/i.test(ua)||(/Android/i.test(ua)&&(/Mobile/i.test(ua)||ss<=940))||/Windows Phone|IEMobile|Opera Mini/i.test(ua)||(ss<=1024&&matchMedia("(hover:none) and (pointer:coarse)").matches);if(m){d.classList.add("aim-device-mobile");d.classList.remove("aim-device-desktop");}})();</script>';
}

function aim_normalize_device(string $device): string {
    $device = strtolower(trim($device));
    return $device === 'mobile' ? 'mobile' : 'desktop';
}

function aim_detect_request_device(): string {
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '') {
        return 'desktop';
    }
    if (preg_match('/iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile|Opera Mini|webOS|BlackBerry/i', $ua)) {
        return 'mobile';
    }
    if (preg_match('/Android/i', $ua)) {
        return 'mobile';
    }
    if (preg_match('/iPad/i', $ua) || (stripos($ua, 'Macintosh') !== false && stripos($ua, 'Mobile') !== false)) {
        return 'mobile';
    }
    return 'desktop';
}

function aim_trainer_valid(string $trainer): bool {
    return in_array($trainer, AIM_TRAINERS, true);
}

function aim_trainer_meta(string $trainer, string $lang = 'ru'): ?array {
    if (!aim_trainer_valid($trainer)) {
        return null;
    }

    $meta = [
        'flick' => [
            'icon' => 'fa-bullseye',
            'duration_sec' => 60,
            'ru' => [
                'title' => 'Снайперский клик',
                'desc' => 'Кликайте по появляющимся целям как можно быстрее и точнее.',
            ],
            'en' => [
                'title' => 'Flick',
                'desc' => 'Click targets as they appear — speed and accuracy matter.',
            ],
        ],
        'tracking' => [
            'icon' => 'fa-circle-notch',
            'duration_sec' => 30,
            'ru' => [
                'title' => 'Сопровождение',
                'desc' => 'Держите прицел на движущейся цели как можно дольше.',
            ],
            'en' => [
                'title' => 'Tracking',
                'desc' => 'Keep your crosshair on the moving target as long as possible.',
            ],
        ],
        'reaction' => [
            'icon' => 'fa-bolt',
            'duration_sec' => null,
            'ru' => [
                'title' => 'Реакция',
                'desc' => '10 раундов: дождитесь зелёного сигнала и кликните.',
            ],
            'en' => [
                'title' => 'Reaction',
                'desc' => '10 rounds: wait for green, then click as fast as you can.',
            ],
        ],
        'lead' => [
            'icon' => 'fa-arrows-alt-h',
            'duration_sec' => 60,
            'ru' => [
                'title' => 'Упреждение',
                'desc' => 'Попадайте в зону упреждения перед движущейся целью (нажимайте ЛКМ по зеленому кругу).',
            ],
            'en' => [
                'title' => 'Lead Shot',
                'desc' => 'Hit the lead zone ahead of the moving target (left-click the green circle).',
            ],
        ],
        'gridshot' => [
            'icon' => 'fa-th',
            'duration_sec' => 45,
            'ru' => [
                'title' => 'Точечная серия',
                'desc' => 'Три мелкие цели одновременно — сбивайте их подряд.',
            ],
            'en' => [
                'title' => 'Gridshot',
                'desc' => 'Three small targets at once — clear them as fast as you can.',
            ],
        ],
        'duckhunt' => [
            'icon' => 'fa-dove',
            'duration_sec' => 60,
            'ru' => [
                'title' => 'Утиная охота',
                'desc' => 'Стреляйте по уткам, пролетающим через поле. Чем быстрее и точнее — тем выше счёт.',
            ],
            'en' => [
                'title' => 'Duck Hunt',
                'desc' => 'Shoot ducks flying across the field. Speed and accuracy raise your score.',
            ],
        ],
    ];

    $item = $meta[$trainer];
    $labels = $item[$lang] ?? $item['ru'];

    return [
        'id' => $trainer,
        'icon' => $item['icon'],
        'duration_sec' => $item['duration_sec'],
        'title' => $labels['title'],
        'desc' => $labels['desc'],
        'grade_thresholds' => AIM_GRADE_THRESHOLDS[$trainer],
        'score_range' => AIM_SCORE_RANGES[$trainer],
    ];
}

function aim_all_trainers_meta(string $lang = 'ru'): array {
    $out = [];
    foreach (AIM_TRAINERS as $trainer) {
        $meta = aim_trainer_meta($trainer, $lang);
        if ($meta !== null) {
            $out[] = $meta;
        }
    }
    return $out;
}

function aim_normalize_player_name(string $name): string {
    $name = trim($name);
    $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
    if (function_exists('mb_substr')) {
        return mb_substr($name, 0, AIM_PLAYER_NAME_MAX, 'UTF-8');
    }
    return substr($name, 0, AIM_PLAYER_NAME_MAX);
}

function aim_player_name_valid(string $name): bool {
    $name = aim_normalize_player_name($name);
    $len = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($len < AIM_PLAYER_NAME_MIN || $len > AIM_PLAYER_NAME_MAX) {
        return false;
    }
    return (bool) preg_match('/^[\p{L}\p{N}_\-\.\s]+$/u', $name);
}

function aim_grade_label(string $code, string $lang = 'ru'): string {
    $labels = [
        'ru' => [
            'D' => 'D Tier',
            'C' => 'C Tier',
            'B' => 'B Tier',
            'A' => 'A Tier',
            'S' => 'S Tier',
            'SS' => 'SS Tier',
            'SSS' => 'SSS Tier',
        ],
        'en' => [
            'D' => 'D Tier',
            'C' => 'C Tier',
            'B' => 'B Tier',
            'A' => 'A Tier',
            'S' => 'S Tier',
            'SS' => 'SS Tier',
            'SSS' => 'SSS Tier',
        ],
    ];
    $code = strtoupper(trim($code));
    $dict = $labels[$lang] ?? $labels['ru'];
    return $dict[$code] ?? $code;
}

function aim_grade_valid(string $code): bool {
    return in_array(strtoupper(trim($code)), AIM_GRADE_ORDER, true);
}

function aim_compute_grade(string $trainer, int $score): string {
    if (!aim_trainer_valid($trainer)) {
        return 'D';
    }
    $thresholds = AIM_GRADE_THRESHOLDS[$trainer];
    foreach (AIM_GRADE_ORDER as $grade) {
        if ($score >= (int) $thresholds[$grade]) {
            return $grade;
        }
    }
    return 'D';
}

function aim_score_in_range(string $trainer, int $score): bool {
    if (!aim_trainer_valid($trainer)) {
        return false;
    }
    $range = AIM_SCORE_RANGES[$trainer];
    return $score >= (int) $range[0] && $score <= (int) $range[1];
}

function aim_client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
        $candidate = trim($parts[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
        }
    }
    return $ip;
}

function aim_ip_hash(): string {
    return hash('sha256', aim_client_ip());
}

function aim_submit_rate_limited($db, string $ipHash): bool {
    $pdo = $db->getConnection();
    $stmt = $pdo->prepare(
        'SELECT id FROM aim_scores
         WHERE ip_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
         LIMIT 1'
    );
    $stmt->execute([$ipHash, AIM_SUBMIT_RATE_SEC]);
    return (bool) $stmt->fetchColumn();
}

function aim_normalize_metrics($metrics): ?string {
    if ($metrics === null) {
        return null;
    }
    if (is_string($metrics)) {
        $decoded = json_decode($metrics, true);
        if (!is_array($decoded)) {
            return null;
        }
        $metrics = $decoded;
    }
    if (!is_array($metrics)) {
        return null;
    }
    $encoded = json_encode($metrics, JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) > 4096) {
        return null;
    }
    return $encoded;
}

/**
 * @return array{success:bool,error?:string,entry?:array}
 */
function aim_save_score($db, array $payload, ?int $userId = null): array {
    ensure_aim_scores_table($db);

    $trainer = strtolower(trim((string) ($payload['trainer'] ?? '')));
    $playerName = aim_normalize_player_name((string) ($payload['player_name'] ?? ''));
    $score = (int) ($payload['score'] ?? 0);
    $metricsJson = aim_normalize_metrics($payload['metrics'] ?? null);

    if (!aim_trainer_valid($trainer)) {
        return ['success' => false, 'error' => 'invalid_trainer'];
    }
    if (!aim_player_name_valid($playerName)) {
        return ['success' => false, 'error' => 'invalid_player_name'];
    }
    if (!aim_score_in_range($trainer, $score)) {
        return ['success' => false, 'error' => 'invalid_score'];
    }

    $grade = aim_compute_grade($trainer, $score);
    $ipHash = aim_ip_hash();
    $device = aim_detect_request_device();

    if (aim_submit_rate_limited($db, $ipHash)) {
        return ['success' => false, 'error' => 'rate_limited'];
    }

    $pdo = $db->getConnection();
    $stmt = $pdo->prepare(
        'INSERT INTO aim_scores (trainer, device, player_name, user_id, score, grade, metrics, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $trainer,
        $device,
        $playerName,
        $userId,
        $score,
        $grade,
        $metricsJson,
        $ipHash,
    ]);

    $entry = [
        'trainer' => $trainer,
        'device' => $device,
        'player_name' => $playerName,
        'score' => $score,
        'grade' => $grade,
        'metrics' => $metricsJson !== null ? json_decode($metricsJson, true) : null,
        'created_at' => date('Y-m-d H:i:s'),
        'rank' => null,
    ];

    return ['success' => true, 'entry' => $entry];
}

/**
 * @return array{success:bool,error?:string,items?:array,trainer?:string}
 */
function aim_fetch_leaderboard($db, string $trainer, int $limit = 50, string $device = 'desktop'): array {
    ensure_aim_scores_table($db);

    $trainer = strtolower(trim($trainer));
    if (!aim_trainer_valid($trainer)) {
        return ['success' => false, 'error' => 'invalid_trainer'];
    }

    $device = aim_normalize_device($device);
    $limit = max(1, min(100, $limit));
    $pdo = $db->getConnection();

    $stmt = $pdo->prepare(
        'SELECT s.player_name, s.score, s.grade, s.metrics, s.created_at
         FROM aim_scores AS s
         INNER JOIN (
            SELECT player_name, MAX(score) AS max_score
            FROM aim_scores
            WHERE trainer = ? AND device = ?
            GROUP BY player_name
         ) AS best ON best.player_name = s.player_name AND best.max_score = s.score
         WHERE s.trainer = ?
           AND s.device = ?
           AND s.id = (
               SELECT MIN(s2.id)
               FROM aim_scores AS s2
               WHERE s2.trainer = ?
                 AND s2.device = ?
                 AND s2.player_name = s.player_name
                 AND s2.score = s.score
           )
         ORDER BY s.score DESC, s.created_at ASC
         LIMIT ' . (int) $limit
    );
    $stmt->execute([$trainer, $device, $trainer, $device, $trainer, $device]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $items = [];
    $rank = 1;
    foreach ($rows as $row) {
        $metrics = null;
        if (!empty($row['metrics'])) {
            $decoded = json_decode((string) $row['metrics'], true);
            if (is_array($decoded)) {
                $metrics = $decoded;
            }
        }
        $items[] = [
            'rank' => $rank,
            'player_name' => (string) $row['player_name'],
            'score' => (int) $row['score'],
            'grade' => (string) $row['grade'],
            'metrics' => $metrics,
            'created_at' => (string) $row['created_at'],
        ];
        $rank++;
    }

    return [
        'success' => true,
        'trainer' => $trainer,
        'device' => $device,
        'items' => $items,
    ];
}

/**
 * @param array<int, string> $trainerIds
 * @return array<string, array<int, array<string, mixed>>>
 */
function aim_fetch_mini_leaderboards($db, array $trainerIds, int $limit = 3, string $device = 'desktop'): array {
    $device = aim_normalize_device($device);
    $out = [];
    foreach ($trainerIds as $trainerId) {
        $trainerId = strtolower(trim((string) $trainerId));
        if ($trainerId === '') {
            continue;
        }
        $result = aim_fetch_leaderboard($db, $trainerId, $limit, $device);
        if (!empty($result['success'])) {
            $out[$trainerId] = is_array($result['items'] ?? null) ? $result['items'] : [];
        }
    }
    return $out;
}

/**
 * @param array<int, string> $trainerIds
 * @return array{desktop: array<string, array<int, array<string, mixed>>>, mobile: array<string, array<int, array<string, mixed>>>}
 */
function aim_fetch_mini_leaderboards_by_device($db, array $trainerIds, int $limit = 3): array {
    return [
        'desktop' => aim_fetch_mini_leaderboards($db, $trainerIds, $limit, 'desktop'),
        'mobile' => aim_fetch_mini_leaderboards($db, $trainerIds, $limit, 'mobile'),
    ];
}

function aim_error_message(string $code, string $lang = 'ru'): string {
    $messages = [
        'ru' => [
            'invalid_trainer' => 'Неизвестный тренажёр.',
            'invalid_player_name' => 'Ник должен быть от 2 до 32 символов (буквы, цифры, _-.).',
            'invalid_score' => 'Некорректный результат.',
            'rate_limited' => 'Слишком частые отправки. Подождите 30 секунд.',
            'method_not_allowed' => 'Метод не поддерживается.',
            'server_error' => 'Ошибка сервера.',
        ],
        'en' => [
            'invalid_trainer' => 'Unknown trainer.',
            'invalid_player_name' => 'Nickname must be 2–32 characters (letters, digits, _-.).',
            'invalid_score' => 'Invalid score.',
            'rate_limited' => 'Too many submissions. Wait 30 seconds.',
            'method_not_allowed' => 'Method not allowed.',
            'server_error' => 'Server error.',
        ],
    ];
    $dict = $messages[$lang] ?? $messages['ru'];
    return $dict[$code] ?? $code;
}

/**
 * @return array{total:int, leaderboard_slots:int, last24h:int}
 */
function aim_admin_fetch_stats($db): array {
    ensure_aim_scores_table($db);

    try {
        $row = $db->fetchOne(
            'SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT CONCAT(trainer, \'|\', device, \'|\', player_name)) AS leaderboard_slots,
                SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS last24h
             FROM aim_scores'
        );
        return [
            'total' => (int) ($row['total'] ?? 0),
            'leaderboard_slots' => (int) ($row['leaderboard_slots'] ?? 0),
            'last24h' => (int) ($row['last24h'] ?? 0),
        ];
    } catch (Throwable $e) {
        return ['total' => 0, 'leaderboard_slots' => 0, 'last24h' => 0];
    }
}

/**
 * @return array{success:bool,error?:string,data?:array,stats?:array,pagination?:array}
 */
function aim_admin_fetch_scores($db, array $filters = []): array {
    ensure_aim_scores_table($db);

    $trainer = isset($filters['trainer']) ? strtolower(trim((string) $filters['trainer'])) : '';
    $device = isset($filters['device']) ? trim((string) $filters['device']) : '';
    $search = isset($filters['q']) ? trim((string) $filters['q']) : '';
    $view = (($filters['view'] ?? 'all') === 'leaderboard') ? 'leaderboard' : 'all';
    $page = max(1, (int) ($filters['page'] ?? 1));
    $perPage = max(10, min(100, (int) ($filters['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;

    if ($trainer !== '' && !aim_trainer_valid($trainer)) {
        return ['success' => false, 'error' => 'invalid_trainer'];
    }
    if ($device !== '' && !in_array($device, ['desktop', 'mobile'], true)) {
        return ['success' => false, 'error' => 'invalid_device'];
    }

    $pdo = $db->getConnection();

    if ($view === 'leaderboard') {
        $leaderTrainer = $trainer !== '' ? $trainer : 'flick';
        $leaderDevice = $device !== '' ? aim_normalize_device($device) : 'desktop';

        $whereExtra = '';
        $params = [$leaderTrainer, $leaderDevice, $leaderTrainer, $leaderDevice, $leaderTrainer, $leaderDevice];
        if ($search !== '') {
            $whereExtra = ' AND s.player_name LIKE ?';
            $params[] = '%' . $search . '%';
        }

        $countParams = [$leaderTrainer, $leaderDevice];
        $countSql = 'SELECT COUNT(*) FROM (
            SELECT player_name
            FROM aim_scores
            WHERE trainer = ? AND device = ?
            GROUP BY player_name
        ) AS lb';
        if ($search !== '') {
            $countSql = 'SELECT COUNT(*) FROM (
                SELECT player_name
                FROM aim_scores
                WHERE trainer = ? AND device = ? AND player_name LIKE ?
                GROUP BY player_name
            ) AS lb';
            $countParams[] = '%' . $search . '%';
        }

        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($countParams);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT s.id, s.trainer, s.device, s.player_name, s.user_id, s.score, s.grade, s.created_at
            FROM aim_scores AS s
            INNER JOIN (
                SELECT player_name, MAX(score) AS max_score
                FROM aim_scores
                WHERE trainer = ? AND device = ?
                GROUP BY player_name
            ) AS best ON best.player_name = s.player_name AND best.max_score = s.score
            WHERE s.trainer = ?
              AND s.device = ?
              AND s.id = (
                  SELECT MIN(s2.id)
                  FROM aim_scores AS s2
                  WHERE s2.trainer = ?
                    AND s2.device = ?
                    AND s2.player_name = s.player_name
                    AND s2.score = s.score
              )' . $whereExtra . '
            ORDER BY s.score DESC, s.created_at ASC
            LIMIT ' . (int) $perPage . ' OFFSET ' . (int) $offset;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $rank = $offset + 1;
        $data = [];
        foreach ($rows as $row) {
            $data[] = [
                'id' => (int) $row['id'],
                'rank' => $rank,
                'trainer' => (string) $row['trainer'],
                'device' => (string) $row['device'],
                'player_name' => (string) $row['player_name'],
                'user_id' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
                'score' => (int) $row['score'],
                'grade' => (string) $row['grade'],
                'created_at' => (string) $row['created_at'],
            ];
            $rank++;
        }

        return [
            'success' => true,
            'data' => $data,
            'stats' => aim_admin_fetch_stats($db),
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'pages' => max(1, (int) ceil($total / $perPage)),
            ],
            'view' => 'leaderboard',
            'trainer' => $leaderTrainer,
            'device' => $leaderDevice,
        ];
    }

    $where = ['1=1'];
    $params = [];
    if ($trainer !== '') {
        $where[] = 's.trainer = ?';
        $params[] = $trainer;
    }
    if ($device !== '') {
        $where[] = 's.device = ?';
        $params[] = aim_normalize_device($device);
    }
    if ($search !== '') {
        $where[] = 's.player_name LIKE ?';
        $params[] = '%' . $search . '%';
    }
    $whereSql = implode(' AND ', $where);

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM aim_scores AS s WHERE ' . $whereSql);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql = 'SELECT s.id, s.trainer, s.device, s.player_name, s.user_id, s.score, s.grade, s.created_at
        FROM aim_scores AS s
        WHERE ' . $whereSql . '
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT ' . (int) $perPage . ' OFFSET ' . (int) $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = [];
    foreach ($rows as $row) {
        $data[] = [
            'id' => (int) $row['id'],
            'trainer' => (string) $row['trainer'],
            'device' => (string) $row['device'],
            'player_name' => (string) $row['player_name'],
            'user_id' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'score' => (int) $row['score'],
            'grade' => (string) $row['grade'],
            'created_at' => (string) $row['created_at'],
        ];
    }

    return [
        'success' => true,
        'data' => $data,
        'stats' => aim_admin_fetch_stats($db),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'pages' => max(1, (int) ceil($total / $perPage)),
        ],
        'view' => 'all',
    ];
}

function aim_admin_delete_score($db, int $id): bool {
    ensure_aim_scores_table($db);
    if ($id <= 0) {
        return false;
    }
    $stmt = $db->getConnection()->prepare('DELETE FROM aim_scores WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

function aim_admin_delete_player_scores($db, string $trainer, string $device, string $playerName): int {
    ensure_aim_scores_table($db);
    $trainer = strtolower(trim($trainer));
    $playerName = aim_normalize_player_name($playerName);
    if (!aim_trainer_valid($trainer) || !aim_player_name_valid($playerName)) {
        return 0;
    }
    $device = aim_normalize_device($device);
    $stmt = $db->getConnection()->prepare(
        'DELETE FROM aim_scores WHERE trainer = ? AND device = ? AND player_name = ?'
    );
    $stmt->execute([$trainer, $device, $playerName]);
    return $stmt->rowCount();
}

function aim_admin_renamed_user_prefix(): string {
    return 'RenamedUser_';
}

function aim_admin_is_renamed_user_name(string $playerName): bool {
    return (bool) preg_match('/^RenamedUser_\d+$/', aim_normalize_player_name($playerName));
}

function aim_admin_allocate_renamed_user_name(PDO $pdo): string {
    $prefix = aim_admin_renamed_user_prefix();
    $stmt = $pdo->query(
        "SELECT player_name FROM aim_scores WHERE player_name LIKE 'RenamedUser\\_%'"
    );
    $max = 0;
    if ($stmt) {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $name = (string) ($row['player_name'] ?? '');
            if (preg_match('/^RenamedUser_(\d+)$/', $name, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }
    }
    return $prefix . ($max + 1);
}

/**
 * @return array{success:bool,error?:string,old_name?:string,new_name?:string,updated?:int}
 */
function aim_admin_rename_player($db, string $oldName): array {
    ensure_aim_scores_table($db);

    $oldName = aim_normalize_player_name($oldName);
    if (!aim_player_name_valid($oldName)) {
        return ['success' => false, 'error' => 'invalid_player_name'];
    }
    if (aim_admin_is_renamed_user_name($oldName)) {
        return ['success' => false, 'error' => 'already_renamed'];
    }

    $pdo = $db->getConnection();
    $check = $pdo->prepare('SELECT COUNT(*) FROM aim_scores WHERE player_name = ?');
    $check->execute([$oldName]);
    if ((int) $check->fetchColumn() <= 0) {
        return ['success' => false, 'error' => 'not_found'];
    }

    try {
        $pdo->beginTransaction();
        $newName = aim_admin_allocate_renamed_user_name($pdo);
        if (!aim_player_name_valid($newName)) {
            $pdo->rollBack();
            return ['success' => false, 'error' => 'invalid_new_name'];
        }

        $update = $pdo->prepare('UPDATE aim_scores SET player_name = ? WHERE player_name = ?');
        $update->execute([$newName, $oldName]);
        $updated = $update->rowCount();
        if ($updated <= 0) {
            $pdo->rollBack();
            return ['success' => false, 'error' => 'not_found'];
        }

        $pdo->commit();
        return [
            'success' => true,
            'old_name' => $oldName,
            'new_name' => $newName,
            'updated' => $updated,
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return ['success' => false, 'error' => 'server_error'];
    }
}

function aim_admin_trainer_label(string $trainer, string $lang = 'ru'): string {
    $meta = aim_trainer_meta($trainer, $lang);
    return $meta['title'] ?? $trainer;
}

function aim_admin_device_label(string $device, string $lang = 'ru'): string {
    $device = aim_normalize_device($device);
    if ($lang === 'en') {
        return $device === 'mobile' ? 'Mobile' : 'PC';
    }
    return $device === 'mobile' ? 'Телефон' : 'ПК';
}
