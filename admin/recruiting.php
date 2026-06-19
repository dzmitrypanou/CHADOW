<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_recruiting.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$stats = [
    'total' => 0,
    'pending' => 0,
    'approved' => 0,
    'rejected' => 0,
    'hidden' => 0,
];
$db_error = null;

try {
    ensure_recruiting_posts_table($db);
    $row = $db->fetchOne(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
         FROM recruiting_posts"
    );
    if ($row) {
        $stats = [
            'total' => (int) ($row['total'] ?? 0),
            'pending' => (int) ($row['pending'] ?? 0),
            'approved' => (int) ($row['approved'] ?? 0),
            'rejected' => (int) ($row['rejected'] ?? 0),
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
    <title>Рекрутинг | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .recruiting-stats-grid {
            width: 100%;
            max-width: none;
            box-sizing: border-box;
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        @media (max-width: 992px) {
            .recruiting-stats-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }
        @media (max-width: 576px) {
            .recruiting-stats-grid {
                grid-template-columns: 1fr;
            }
        }

        .recruiting-page #recruiting-table td {
            vertical-align: top;
        }
        .recruiting-page #recruiting-table th:nth-child(1),
        .recruiting-page #recruiting-table td:nth-child(1) { width: 15%; }
        .recruiting-page #recruiting-table th:nth-child(2),
        .recruiting-page #recruiting-table td:nth-child(2) { width: 6%; }
        .recruiting-page #recruiting-table th:nth-child(3),
        .recruiting-page #recruiting-table td:nth-child(3) { width: 24%; }
        .recruiting-page #recruiting-table th:nth-child(4),
        .recruiting-page #recruiting-table td:nth-child(4) { width: 12%; }
        .recruiting-page #recruiting-table th:nth-child(5),
        .recruiting-page #recruiting-table td:nth-child(5) { width: 10%; }
        .recruiting-page #recruiting-table th:nth-child(6),
        .recruiting-page #recruiting-table td:nth-child(6) { width: 13%; overflow: visible; text-overflow: clip; }
        .recruiting-page #recruiting-table th:nth-child(7),
        .recruiting-page #recruiting-table td:nth-child(7) {
            width: 20%;
            min-width: 188px;
            overflow: visible;
            white-space: normal;
            text-overflow: clip;
        }
        .recruiting-page #recruiting-table .action-buttons {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 4px;
        }
        .recruiting-page .action-btn {
            min-width: 28px;
            padding: 4px 6px;
            flex-shrink: 0;
        }
        .recruiting-title-cell {
            max-width: none;
            white-space: normal;
            word-break: break-word;
        }
        .recruiting-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .recruiting-status-badge.pending {
            background: rgba(255, 217, 102, 0.15);
            border: 1px solid rgba(255, 217, 102, 0.35);
            color: #ffd966;
            cursor: pointer;
            transition: all 0.2s;
        }
        .recruiting-status-badge.pending:hover {
            background: rgba(255, 217, 102, 0.25);
            transform: scale(1.05);
        }
        .recruiting-status-badge.approved {
            background: rgba(76, 175, 80, 0.15);
            border: 1px solid rgba(76, 175, 80, 0.3);
            color: #a5d6a7;
        }
        .recruiting-status-badge.rejected {
            background: rgba(255, 138, 138, 0.15);
            border: 1px solid rgba(255, 138, 138, 0.3);
            color: #ff8a8a;
        }
        .recruiting-status-badge.hidden {
            background: rgba(158, 158, 158, 0.15);
            border: 1px solid rgba(158, 158, 158, 0.3);
            color: #bdbdbd;
        }
        .recruiting-type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.72rem;
            background: rgba(100, 181, 246, 0.12);
            border: 1px solid rgba(100, 181, 246, 0.25);
            color: #90caf9;
            white-space: nowrap;
        }
        .recruiting-realm-badge {
            font-weight: 600;
            font-size: 0.8rem;
            color: #e8eef2;
        }
        .recruiting-view-body {
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 240px;
            overflow-y: auto;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid #2a3138;
            border-radius: 4px;
            margin-top: 8px;
        }
        .recruiting-view-meta {
            display: grid;
            gap: 8px;
            margin-bottom: 12px;
        }
        .recruiting-view-meta dt {
            color: #9aa7b2;
            font-size: 0.8rem;
        }
        .recruiting-view-meta dd {
            margin: 0 0 8px;
        }
        .recruiting-moderation-note {
            margin-top: 12px;
            padding: 10px;
            background: rgba(255, 138, 138, 0.1);
            border: 1px solid rgba(255, 138, 138, 0.25);
            border-radius: 4px;
            color: #ff8a8a;
            font-size: 0.9rem;
        }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="recruiting-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-bullhorn" style="color: #ffd966;"></i>
                Модерация рекрутинга
            </h1>
            <?php $navCurrent = 'recruiting'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="stats-grid recruiting-stats-grid">
                <div class="stat-card">
                    <div class="label"><i class="fas fa-bullhorn"></i> Всего объявлений</div>
                    <div class="value" id="recruitingTotalCount"><?php echo (int) $stats['total']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-clock" style="color: #ffd966;"></i> На модерации</div>
                    <div class="value" id="recruitingPendingCount"><?php echo (int) $stats['pending']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-check-circle" style="color: #4caf50;"></i> Одобрено</div>
                    <div class="value" id="recruitingApprovedCount"><?php echo (int) $stats['approved']; ?></div>
                </div>
                <div class="stat-card">
                    <div class="label"><i class="fas fa-times-circle" style="color: #ff8a8a;"></i> Отклонено</div>
                    <div class="value" id="recruitingRejectedCount"><?php echo (int) $stats['rejected']; ?></div>
                </div>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="recruitingSearch" class="search-input" placeholder="Поиск по заголовку, тексту, автору...">
                    <div class="custom-select">
                        <select id="recruitingStatus" title="Статус">
                            <option value="">Все статусы</option>
                            <option value="pending">На модерации</option>
                            <option value="approved">Одобрено</option>
                            <option value="rejected">Отклонено</option>
                            <option value="hidden">Скрыто</option>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="recruitingPostType" title="Тип">
                            <option value="">Все типы</option>
                            <option value="clan_seeks_players">Клан ищет игроков</option>
                            <option value="team_seeks_players">Команда ищет игроков</option>
                            <option value="player_seeks_clan">Игрок ищет клан</option>
                            <option value="player_seeks_team">Игрок ищет команду</option>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="recruitingRealm" title="Регион">
                            <option value="">Все регионы</option>
                            <option value="ru">RU</option>
                            <option value="eu">EU</option>
                            <option value="na">NA</option>
                            <option value="asia">ASIA</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger" id="recruitingResetFilters" title="Сбросить">
                        <i class="fas fa-times"></i> Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="recruiting-table">
                    <thead>
                        <tr>
                            <th>Тип</th>
                            <th>Регион</th>
                            <th>Заголовок</th>
                            <th>Автор</th>
                            <th>Дата</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="recruitingTableBody">
                        <tr><td colspan="7" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="modal" id="viewRecruitingModal">
                <div class="modal-content" style="max-width: 640px;">
                    <h2><i class="fas fa-eye"></i> Объявление</h2>
                    <dl class="recruiting-view-meta" id="viewRecruitingMeta"></dl>
                    <div>
                        <strong>Текст</strong>
                        <div class="recruiting-view-body" id="viewRecruitingBody"></div>
                    </div>
                    <div id="viewRecruitingNoteWrap" class="recruiting-moderation-note" style="display: none;">
                        <strong>Причина отклонения:</strong>
                        <span id="viewRecruitingNote"></span>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-primary js-view-approve" style="display: none;">
                            <i class="fas fa-check"></i> Одобрить
                        </button>
                        <button type="button" class="btn js-view-reject" style="display: none;">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                        <button type="button" class="btn js-view-hide" style="display: none;">
                            <i class="fas fa-eye-slash"></i> Скрыть
                        </button>
                        <button type="button" class="btn" onclick="closeViewRecruitingModal()">
                            <i class="fas fa-times"></i> Закрыть
                        </button>
                    </div>
                </div>
            </div>

            <div class="modal" id="rejectRecruitingModal">
                <div class="modal-content" style="max-width: 480px;">
                    <h2><i class="fas fa-times-circle"></i> Отклонить объявление</h2>
                    <form id="rejectRecruitingForm">
                        <input type="hidden" id="reject_recruiting_id" name="id">
                        <div class="form-group">
                            <label for="reject_recruiting_note">Причина отклонения (видна автору)</label>
                            <textarea id="reject_recruiting_note" name="note" rows="4" required maxlength="500" placeholder="Укажите причину..."></textarea>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn btn-danger" style="flex: 1;">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                            <button type="button" class="btn" onclick="closeRejectRecruitingModal()">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/recruiting.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
