<?php

if (!function_exists('ensure_aim_scores_table')) {
    require_once __DIR__ . '/../config/ensure_aim.php';
}

const AIM_TRAINERS = ['flick', 'tracking', 'reaction', 'lead', 'gridshot'];

const AIM_PLAYER_NAME_MIN = 2;
const AIM_PLAYER_NAME_MAX = 32;

const AIM_SUBMIT_RATE_SEC = 30;

const AIM_SCORE_RANGES = [
    'flick' => [0, 15000],
    'tracking' => [0, 1000],
    'reaction' => [0, 10000],
    'lead' => [0, 55000],
    'gridshot' => [0, 5000],
];

const AIM_GRADE_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];

const AIM_GRADE_THRESHOLDS = [
    'flick' => ['SSS' => 9000, 'SS' => 7000, 'S' => 5000, 'A' => 3500, 'B' => 2000, 'C' => 800, 'D' => 0],
    'tracking' => ['SSS' => 900, 'SS' => 850, 'S' => 780, 'A' => 620, 'B' => 420, 'C' => 180, 'D' => 0],
    'reaction' => ['SSS' => 9900, 'SS' => 9600, 'S' => 9200, 'A' => 8500, 'B' => 7500, 'C' => 6000, 'D' => 0],
    'lead' => ['SSS' => 38000, 'SS' => 28000, 'S' => 18000, 'A' => 10000, 'B' => 5000, 'C' => 1500, 'D' => 0],
    'gridshot' => ['SSS' => 125, 'SS' => 105, 'S' => 85, 'A' => 65, 'B' => 45, 'C' => 20, 'D' => 0],
];

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

    if (aim_submit_rate_limited($db, $ipHash)) {
        return ['success' => false, 'error' => 'rate_limited'];
    }

    $pdo = $db->getConnection();
    $stmt = $pdo->prepare(
        'INSERT INTO aim_scores (trainer, player_name, user_id, score, grade, metrics, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $trainer,
        $playerName,
        $userId,
        $score,
        $grade,
        $metricsJson,
        $ipHash,
    ]);

    $entry = [
        'trainer' => $trainer,
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
function aim_fetch_leaderboard($db, string $trainer, int $limit = 50): array {
    ensure_aim_scores_table($db);

    $trainer = strtolower(trim($trainer));
    if (!aim_trainer_valid($trainer)) {
        return ['success' => false, 'error' => 'invalid_trainer'];
    }

    $limit = max(1, min(100, $limit));
    $pdo = $db->getConnection();

    $stmt = $pdo->prepare(
        'SELECT s.player_name, s.score, s.grade, s.metrics, s.created_at
         FROM aim_scores AS s
         INNER JOIN (
            SELECT player_name, MAX(score) AS max_score
            FROM aim_scores
            WHERE trainer = ?
            GROUP BY player_name
         ) AS best ON best.player_name = s.player_name AND best.max_score = s.score
         WHERE s.trainer = ?
           AND s.id = (
               SELECT MIN(s2.id)
               FROM aim_scores AS s2
               WHERE s2.trainer = ?
                 AND s2.player_name = s.player_name
                 AND s2.score = s.score
           )
         ORDER BY s.score DESC, s.created_at ASC
         LIMIT ' . (int) $limit
    );
    $stmt->execute([$trainer, $trainer, $trainer]);
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
        'items' => $items,
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
