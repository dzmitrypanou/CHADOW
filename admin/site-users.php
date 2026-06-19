<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_site_users.php';
require_once __DIR__ . '/../includes/site_users_admin_helpers.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web_admin();

$stats = ['total' => 0, 'active' => 0, 'blocked' => 0, 'last24h' => 0];
$db_error = null;

try {
    ensure_site_users_table($db);
    $stats = site_users_admin_fetch_stats($db);
} catch (Exception $e) {
    $db_error = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Пользователи сайта | Админ-панель</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .site-users-stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @media (max-width: 992px) { .site-users-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 576px) { .site-users-stats-grid { grid-template-columns: 1fr; } }

        .site-users-page #site-users-table { table-layout: fixed; }
        .site-users-page #site-users-table th:nth-child(1),
        .site-users-page #site-users-table td:nth-child(1) { width: 5%; }
        .site-users-page #site-users-table th:nth-child(2),
        .site-users-page #site-users-table td:nth-child(2) { width: 12%; }
        .site-users-page #site-users-table th:nth-child(3),
        .site-users-page #site-users-table td:nth-child(3) { width: 16%; }
        .site-users-page #site-users-table th:nth-child(4),
        .site-users-page #site-users-table td:nth-child(4) { width: 10%; }
        .site-users-page #site-users-table th:nth-child(5),
        .site-users-page #site-users-table td:nth-child(5) { width: 22%; }
        .site-users-page #site-users-table th:nth-child(6),
        .site-users-page #site-users-table td:nth-child(6) { width: 9%; overflow: visible; text-overflow: clip; }
        .site-users-page #site-users-table th:nth-child(7),
        .site-users-page #site-users-table td:nth-child(7) { width: 13%; }
        .site-users-page #site-users-table th:nth-child(8),
        .site-users-page #site-users-table td:nth-child(8) {
            width: 13%;
            min-width: 108px;
            overflow: visible;
            text-overflow: clip;
        }
        .site-users-page #site-users-table td:nth-child(3),
        .site-users-page #site-users-table td:nth-child(5) {
            white-space: normal;
            word-break: break-word;
        }
        .site-users-page #site-users-table .action-buttons {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 4px;
        }
        .site-user-status-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .site-user-status-badge.active {
            background: rgba(76, 175, 80, 0.18);
            border: 1px solid rgba(129, 199, 132, 0.5);
            color: #a5d6a7;
        }
        .site-user-status-badge.blocked {
            background: rgba(255, 138, 138, 0.15);
            border: 1px solid rgba(255, 138, 138, 0.35);
            color: #ff8a8a;
        }
        .site-user-provider-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.72rem;
            white-space: nowrap;
            background: rgba(100, 181, 246, 0.12);
            border: 1px solid rgba(100, 181, 246, 0.25);
            color: #90caf9;
        }
        .site-users-pagination {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
        }
        .site-users-page-info {
            color: #9aa7b2;
            font-size: 0.85rem;
            margin-right: 8px;
        }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="site-users-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-users" style="color: #ffd966;"></i>
                Пользователи сайта
            </h1>
            <?php $navCurrent = 'site-users'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="stats-grid site-users-stats-grid">
                <div class="stat-card">
                    <div class="label"><i class="fas fa-users"></i> Всего</div>
                    <div class="value" id="siteUsersTotal"><?php echo (int) $stats['total']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-check-circle" style="color: #4caf50;"></i> Активные</div>
                    <div class="value" id="siteUsersActive"><?php echo (int) $stats['active']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-ban" style="color: #ff8a8a;"></i> Заблокированные</div>
                    <div class="value" id="siteUsersBlocked"><?php echo (int) $stats['blocked']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-user-plus" style="color: #64b5f6;"></i> За 24 часа</div>
                    <div class="value" id="siteUsersLast24h"><?php echo (int) $stats['last24h']; ?></div>
                </div>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="siteUsersSearch" class="search-input" placeholder="Поиск по логину, email или нику...">
                    <div class="custom-select">
                        <select id="siteUsersProvider" title="Способ входа">
                            <option value="">Все способы входа</option>
                            <option value="local">Сайт (email)</option>
                            <option value="wg">Wargaming</option>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="siteUsersActive" title="Статус">
                            <option value="">Все статусы</option>
                            <option value="1">Активные</option>
                            <option value="0">Заблокированные</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger" id="siteUsersResetFilters" title="Сбросить">
                        <i class="fas fa-times"></i> Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="site-users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Логин</th>
                            <th>Email</th>
                            <th>Вход</th>
                            <th>Привязки</th>
                            <th>Статус</th>
                            <th>Регистрация</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="siteUsersTableBody">
                        <tr><td colspan="8" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="site-users-pagination" id="siteUsersPagination"></div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/site-users.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
