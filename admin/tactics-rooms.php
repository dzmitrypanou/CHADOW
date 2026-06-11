<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_tactics.php';
require_once __DIR__ . '/../includes/tactics_helpers.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$stats = ['total' => 0, 'open' => 0, 'closed' => 0];
$db_error = null;

try {
    ensure_tactics_table($db);
    $result = tactics_admin_fetch_rooms($db, []);
    if ($result['success']) {
        $stats = $result['stats'] ?? $stats;
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
    <title>Тактика: комнаты | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .tactics-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 768px) { .tactics-stats-grid { grid-template-columns: 1fr; } }
        #tactics-rooms-table td { vertical-align: top; }
        .tactics-vis-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.72rem;
            background: rgba(100, 181, 246, 0.12);
            border: 1px solid rgba(100, 181, 246, 0.25);
            color: #90caf9;
        }
        .tactics-vis-badge.closed {
            background: rgba(255, 152, 0, 0.12);
            border-color: rgba(255, 183, 77, 0.35);
            color: #ffcc80;
        }
        .tactics-maps-cell { font-size: 0.82rem; color: #9aa5b1; max-width: 220px; }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="tactics-rooms-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-chalkboard" style="color: #ffd966;"></i>
                Тактический планшет — комнаты
            </h1>
            <?php $navCurrent = 'tactics-rooms'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="stats-grid tactics-stats-grid">
                <div class="stat-card">
                    <div class="label"><i class="fas fa-door-open"></i> Всего комнат</div>
                    <div class="value" id="tacticsRoomsTotal"><?php echo (int) $stats['total']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-globe" style="color: #4caf50;"></i> Открытые</div>
                    <div class="value" id="tacticsRoomsOpen"><?php echo (int) $stats['open']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-lock" style="color: #ff9800;"></i> Закрытые</div>
                    <div class="value" id="tacticsRoomsClosed"><?php echo (int) $stats['closed']; ?></div>
                </div>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="tacticsRoomsSearch" class="search-input" placeholder="Поиск по названию или коду...">
                    <div class="custom-select">
                        <select id="tacticsRoomsVisibility" title="Видимость">
                            <option value="">Вся видимость</option>
                            <option value="open">Открытые</option>
                            <option value="closed">Закрытые</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger" id="tacticsRoomsResetFilters" title="Сбросить">
                        <i class="fas fa-times"></i> Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="tactics-rooms-table">
                    <thead>
                        <tr>
                            <th>Код</th>
                            <th>Название</th>
                            <th>Видимость</th>
                            <th>Карты</th>
                            <th>Автор</th>
                            <th>Активность</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="tacticsRoomsTableBody">
                        <tr><td colspan="7" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/tactics-rooms.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
