<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_brackets.php';
require_once __DIR__ . '/../includes/bracket_helpers.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$stats = ['total' => 0, 'active' => 0, 'hidden' => 0];
$db_error = null;

try {
    ensure_brackets_table($db);
    $row = $db->fetchOne(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
         FROM tournament_brackets"
    );
    if ($row) {
        $stats = [
            'total' => (int) ($row['total'] ?? 0),
            'active' => (int) ($row['active'] ?? 0),
            'hidden' => (int) ($row['hidden'] ?? 0),
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
    <title>Турнирные сетки | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .brackets-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 768px) {
            .brackets-stats-grid {
                grid-template-columns: 1fr;
            }
        }

            width: 15%;
            min-width: 132px;
            overflow: visible;
            text-overflow: clip;
            white-space: nowrap;
            padding-right: 12px;
        }

            display: flex;
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 4px;
        }
        .brackets-page .action-btn {
            min-width: 28px;
            padding: 5px 7px;
            flex-shrink: 0;
        }

            overflow: visible;
            text-overflow: clip;
        }
        .bracket-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .bracket-status-badge.active {
            background: rgba(76, 175, 80, 0.18);
            border: 1px solid rgba(129, 199, 132, 0.5);
            color:
            font-weight: 600;
        }
        .bracket-status-badge.hidden {
            background: rgba(158, 158, 158, 0.15);
            border: 1px solid rgba(158, 158, 158, 0.3);
            color:
        }
        .bracket-vis-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.72rem;
            background: rgba(100, 181, 246, 0.12);
            border: 1px solid rgba(100, 181, 246, 0.25);
            color:
        }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="brackets-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-sitemap" style="color: #ffd966;"></i>
                Турнирные сетки
            </h1>
            <?php $navCurrent = 'brackets'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="stats-grid brackets-stats-grid">
                <div class="stat-card">
                    <div class="label"><i class="fas fa-sitemap"></i> Всего сеток</div>
                    <div class="value" id="bracketsTotalCount"><?php echo (int) $stats['total']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-check-circle" style="color: #4caf50;"></i> Активные</div>
                    <div class="value" id="bracketsActiveCount"><?php echo (int) $stats['active']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-eye-slash" style="color: #bdbdbd;"></i> Скрытые</div>
                    <div class="value" id="bracketsHiddenCount"><?php echo (int) $stats['hidden']; ?></div>
                </div>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="bracketsSearch" class="search-input" placeholder="Поиск по названию...">
                    <div class="custom-select">
                        <select id="bracketsStatus" title="Статус модерации">
                            <option value="">Все статусы</option>
                            <option value="active">Активные</option>
                            <option value="hidden">Скрытые</option>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="bracketsVisibility" title="Видимость">
                            <option value="">Вся видимость</option>
                            <option value="public">Публичные</option>
                            <option value="hidden">По ссылке</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger" id="bracketsResetFilters" title="Сбросить">
                        <i class="fas fa-times"></i> Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="brackets-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Название</th>
                            <th>Формат</th>
                            <th>Видимость</th>
                            <th>Статус</th>
                            <th>Автор</th>
                            <th>Дата</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="bracketsTableBody">
                        <tr><td colspan="8" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/brackets.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
