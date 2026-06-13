<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_aim.php';
require_once __DIR__ . '/../includes/aim_helpers.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$stats = ['total' => 0, 'leaderboard_slots' => 0, 'last24h' => 0];
$db_error = null;
$trainers = [];

try {
    ensure_aim_scores_table($db);
    $stats = aim_admin_fetch_stats($db);
    foreach (AIM_TRAINERS as $trainerId) {
        $trainers[] = [
            'id' => $trainerId,
            'title' => aim_admin_trainer_label($trainerId, 'ru'),
        ];
    }
} catch (Exception $e) {
    $db_error = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Аим: лидерборды | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .aim-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 768px) { .aim-stats-grid { grid-template-columns: 1fr; } }
        #aim-scores-table td { vertical-align: middle; }
        .aim-grade-badge {
            display: inline-block;
            min-width: 2rem;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 600;
            text-align: center;
            background: rgba(255, 217, 102, 0.12);
            border: 1px solid rgba(255, 217, 102, 0.28);
            color: #ffd966;
        }
        .aim-scores-pagination {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
        }
        .aim-scores-page-info {
            color: #9aa5b1;
            font-size: 0.85rem;
            margin-right: 8px;
        }
        .aim-scores-page-btn {
            min-width: 36px;
            padding: 6px 10px;
        }
        #aim-scores-table th:last-child,
        #aim-scores-table td:last-child {
            min-width: 148px;
        }
        #aim-scores-table .action-buttons {
            flex-wrap: wrap;
            justify-content: flex-end;
        }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="aim-leaderboards-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-trophy" style="color: #ffd966;"></i>
                Аим-тренажёры — таблицы лидеров
            </h1>
            <?php $navCurrent = 'aim-leaderboards'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="stats-grid aim-stats-grid">
                <div class="stat-card">
                    <div class="label"><i class="fas fa-database"></i> Всего записей</div>
                    <div class="value" id="aimScoresTotal"><?php echo (int) $stats['total']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-list-ol" style="color: #64b5f6;"></i> Позиций в топах</div>
                    <div class="value" id="aimLeaderboardSlots"><?php echo (int) $stats['leaderboard_slots']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-clock" style="color: #4caf50;"></i> За 24 часа</div>
                    <div class="value" id="aimScoresLast24h"><?php echo (int) $stats['last24h']; ?></div>
                </div>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="aimScoresSearch" class="search-input" placeholder="Поиск по нику...">
                    <div class="custom-select">
                        <select id="aimScoresView" title="Режим">
                            <option value="all">Все записи</option>
                            <option value="leaderboard">Текущий топ</option>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="aimScoresTrainer" title="Тренажёр">
                            <option value="">Все тренажёры</option>
                            <?php foreach ($trainers as $trainer): ?>
                                <option value="<?php echo htmlspecialchars($trainer['id'], ENT_QUOTES, 'UTF-8'); ?>">
                                    <?php echo htmlspecialchars($trainer['title'], ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="aimScoresDevice" title="Устройство">
                            <option value="">Все устройства</option>
                            <option value="desktop">ПК</option>
                            <option value="mobile">Телефон</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger" id="aimScoresResetFilters" title="Сбросить">
                        <i class="fas fa-times"></i> Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="aim-scores-table">
                    <thead>
                        <tr>
                            <th id="aimScoresRankHead" hidden>#</th>
                            <th>Тренажёр</th>
                            <th>Устройство</th>
                            <th>Игрок</th>
                            <th>Очки</th>
                            <th>Грейд</th>
                            <th>Аккаунт</th>
                            <th>Дата</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="aimScoresTableBody">
                        <tr><td colspan="9" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="aim-scores-pagination" id="aimScoresPagination"></div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/aim-leaderboards.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
