<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
require_once __DIR__ . '/../config/tactics_map_catalog.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$db_error = null;

try {
    ensure_map_dictionary_table($db);
} catch (Exception $e) {
    $db_error = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Тактика: карты | Анализ АБС реплеев</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <style>
        .tactics-upload-panel {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0;
            padding: 20px;
            margin-bottom: 24px;
        }
        .tactics-upload-panel h2 {
            margin: 0 0 16px;
            font-size: 1.1rem;
            color: #e8eef2;
        }
        .tactics-upload-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            align-items: end;
        }
        .tactics-upload-grid .tactics-upload-field--wide {
            grid-column: span 2;
        }
        .tactics-upload-grid .tactics-upload-actions {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-start;
        }
        @media (max-width: 992px) {
            .tactics-upload-grid { grid-template-columns: 1fr 1fr; }
            .tactics-upload-grid .tactics-upload-field--wide { grid-column: span 2; }
        }
        @media (max-width: 576px) {
            .tactics-upload-grid { grid-template-columns: 1fr; }
            .tactics-upload-grid .tactics-upload-field--wide { grid-column: span 1; }
        }
        .tactics-upload-field label {
            display: block;
            margin-bottom: 6px;
            font-size: 0.82rem;
            color: #9aa5b1;
        }
        .tactics-upload-field input[type="number"],
        .tactics-upload-field input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
            padding: 8px 12px;
            background: #1a1f24;
            border: 1px solid #2a3138;
            border-radius: 0;
            color: #e8eef2;
            font-size: 0.88rem;
        }
        .tactics-upload-field input[type="number"]:focus,
        .tactics-upload-field input[type="text"]:focus {
            border-color: #ffd966;
            outline: none;
        }
        .tactics-side-length-input {
            width: 72px;
            min-height: 32px;
            padding: 4px 8px;
            background: #1a1f24;
            border: 1px solid #2a3138;
            border-radius: 0;
            color: #e8eef2;
            font-size: 0.82rem;
        }
        .tactics-maps-page .custom-select select {
            border-radius: 0;
        }
        .tactics-file-field {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 42px;
            padding: 6px 12px;
            background: #1a1f24;
            border: 1px solid #2a3138;
            border-radius: 0;
            transition: border-color 0.2s;
        }
        .tactics-file-field:focus-within {
            border-color: #ffd966;
        }
        .tactics-file-field .tactics-file-btn {
            flex: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(255, 217, 102, 0.12);
            border: 1px solid rgba(255, 217, 102, 0.35);
            border-radius: 0;
            color: #ffd966;
            font-size: 0.82rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .tactics-file-field .tactics-file-btn:hover {
            background: rgba(255, 217, 102, 0.2);
            border-color: #ffd966;
        }
        .tactics-file-field .tactics-file-input {
            position: absolute;
            width: 0.1px;
            height: 0.1px;
            opacity: 0;
            overflow: hidden;
            z-index: -1;
        }
        .tactics-file-field .tactics-file-name {
            flex: 1;
            min-width: 0;
            font-size: 0.82rem;
            color: #9aa5b1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .tactics-maps-page .tactics-upload-submit {
            min-width: auto;
            min-height: 42px;
            padding: 10px 20px;
            border-radius: 0;
            font-weight: 600;
            white-space: nowrap;
            align-self: end;
        }
        .tactics-maps-page .tactics-upload-submit:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .tactics-maps-page .tactics-filter-reset {
            min-width: auto;
            min-height: 42px;
            padding: 10px 16px;
            border-radius: 0;
            background: transparent;
        }
        .tactics-maps-page .tactics-filter-reset:hover {
            background: rgba(255, 138, 138, 0.1);
            color: #ff8a8a;
            transform: none;
            box-shadow: none;
        }
        .tactics-maps-page .action-buttons .action-btn {
            min-width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 0;
            text-decoration: none;
        }
        .tactics-maps-page .action-buttons .action-btn.delete:hover {
            background: rgba(255, 138, 138, 0.1);
        }
        .tactics-map-thumb {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 0;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #1a2332;
        }
        #tactics-maps-table td { vertical-align: middle; }
    </style>
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="tactics-maps-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-map-marked-alt" style="color: #ffd966;"></i>
                Тактический планшет — карты
            </h1>
            <?php $navCurrent = 'tactics-maps'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка: <?php echo htmlspecialchars($db_error); ?>
            </div>
        <?php else: ?>
            <div class="tactics-upload-panel">
                <h2><i class="fas fa-plus-circle"></i> Добавить карту</h2>
                <form id="tacticsMapUploadForm" class="tactics-upload-grid">
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadGame">Игра</label>
                        <div class="custom-select">
                            <select id="tacticsUploadGame" name="game" required>
                                <?php foreach (TACTICS_GAMES as $game): ?>
                                    <option value="<?php echo htmlspecialchars($game, ENT_QUOTES, 'UTF-8'); ?>">
                                        <?php echo htmlspecialchars(tactics_game_label($game), ENT_QUOTES, 'UTF-8'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadMode" id="tacticsUploadModeLabel">Режим боя</label>
                        <div class="custom-select">
                            <select id="tacticsUploadMode" name="battle_mode" required>
                                <?php foreach (tactics_game_modes('wot') as $mode): ?>
                                    <option value="<?php echo htmlspecialchars($mode, ENT_QUOTES, 'UTF-8'); ?>">
                                        <?php echo htmlspecialchars(tactics_battle_mode_label($mode, 'ru', 'wot'), ENT_QUOTES, 'UTF-8'); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadSideLength">Размер поля (м)</label>
                        <input type="number" id="tacticsUploadSideLength" name="side_length" min="100" max="20000" step="1" value="1000" required title="Длина стороны квадратного поля боя">
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadName">Название карты</label>
                        <input type="text" id="tacticsUploadName" name="display_name_ru" maxlength="255" required placeholder="Например: Вестфилд">
                    </div>
                    <div class="tactics-upload-field">
                        <label for="tacticsUploadNameEn">Название (EN)</label>
                        <input type="text" id="tacticsUploadNameEn" name="display_name_en" maxlength="255" placeholder="Необязательно">
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadCode">Код карты</label>
                        <input type="text" id="tacticsUploadCode" name="map_code" maxlength="64" pattern="[a-zA-Z0-9_\-]{0,64}" placeholder="Сгенерируется автоматически (латиница, цифры, _)">
                    </div>
                    <div class="tactics-upload-field tactics-upload-field--wide">
                        <label for="tacticsUploadFile">Изображение (WebP, PNG, JPEG)</label>
                        <div class="tactics-file-field">
                            <label for="tacticsUploadFile" class="tactics-file-btn">
                                <i class="fas fa-folder-open" aria-hidden="true"></i>
                                Выбрать файл
                            </label>
                            <input type="file" id="tacticsUploadFile" class="tactics-file-input" name="image" accept="image/webp,image/png,image/jpeg" required>
                            <span class="tactics-file-name" id="tacticsUploadFileName">Файл не выбран</span>
                        </div>
                    </div>
                    <div class="tactics-upload-actions">
                        <button type="submit" class="btn btn-primary tactics-upload-submit" id="tacticsUploadBtn">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            Добавить
                        </button>
                    </div>
                </form>
                <p style="margin: 12px 0 0; font-size: 0.82rem; color: #9aa5b1;">
                    Карта появится в тактике только в выбранном режиме и игре. Одинаковые названия допустимы — для каждой версии создаётся свой код
                    (например <code>westfeld_oth</code> для «Остальное»). Файл: <code>assets/tactics/maps/{игра}/{режим}/{код}.webp</code>. Макс. 8 МБ.
                </p>
            </div>

            <div class="search-section">
                <div class="filters-group">
                    <input type="text" id="tacticsMapsSearch" class="search-input" placeholder="Поиск по коду или названию...">
                    <div class="custom-select">
                        <select id="tacticsMapsGameFilter" title="Игра">
                            <option value="">Все игры</option>
                            <?php foreach (TACTICS_GAMES as $game): ?>
                                <option value="<?php echo htmlspecialchars($game, ENT_QUOTES, 'UTF-8'); ?>">
                                    <?php echo htmlspecialchars(tactics_game_label($game), ENT_QUOTES, 'UTF-8'); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="custom-select">
                        <select id="tacticsMapsModeFilter" title="Режим">
                            <option value="">Все режимы</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger tactics-filter-reset" id="tacticsMapsResetFilters" title="Сбросить фильтры">
                        <i class="fas fa-times" aria-hidden="true"></i>
                        Сбросить
                    </button>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="tactics-maps-table">
                    <thead>
                        <tr>
                            <th>Превью</th>
                            <th>Игра</th>
                            <th>Режим</th>
                            <th>Код</th>
                            <th>Название</th>
                            <th>Поле, м</th>
                            <th>Файл</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="tacticsMapsTableBody">
                        <tr><td colspan="8" style="text-align: center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <?php if ($db_error === null): ?>
        <script src="/admin/js/tactics-maps.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
    <?php endif; ?>
</body>
</html>
