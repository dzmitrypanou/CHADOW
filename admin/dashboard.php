<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../config/ensure_map_dictionary.php';
$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';

admin_require_web();

$u = admin_user();
$username = $u['username'] ?? '';
$roleLabel = ($u['role'] ?? '') === 'admin' ? 'Администратор' : 'Пользователь';
$isAdmin = function_exists('admin_is_admin') && admin_is_admin();
$replayStorageEnabled = function_exists('is_replay_storage_enabled') ? is_replay_storage_enabled($db) : true;
$siteNameRu = function_exists('get_site_name') ? get_site_name($db, 'ru') : 'Chadow';
$siteNameEn = function_exists('get_site_name') ? get_site_name($db, 'en') : 'Chadow';
$wgApplicationId = function_exists('get_site_setting') ? (string) get_site_setting($db, 'wg_application_id', '') : '';
$lestaApplicationId = function_exists('get_site_setting') ? (string) get_site_setting($db, 'lesta_application_id', '') : '';

if ($username === '') {
    $avatarLetter = '?';
} elseif (function_exists('mb_substr')) {
    $avatarLetter = mb_strtoupper(mb_substr($username, 0, 1, 'UTF-8'), 'UTF-8');
} else {
    $avatarLetter = strtoupper(substr($username, 0, 1));
}

$tankStats = null;
$mapStats = null;
$db_error = null;

try {
    $tankStats = $db->fetchOne("
        SELECT 
            COUNT(*) as total,
            SUM(is_moderated) as moderated,
            SUM(CASE WHEN is_moderated = 0 THEN 1 ELSE 0 END) as unmoderated
        FROM tank_dictionary
    ");

    ensure_map_dictionary_table($db);
    $mapRow = $db->fetchOne('SELECT COUNT(*) AS c FROM map_dictionary');
    $mapsCount = (int) ($mapRow['c'] ?? 0);
    $modRow = $db->fetchOne('SELECT SUM(is_moderated) AS m FROM map_dictionary');
    $mapsModerated = (int) ($modRow['m'] ?? 0);
    $mapStats = [
        'total' => $mapsCount,
        'moderated' => $mapsModerated,
        'unmoderated' => max(0, $mapsCount - $mapsModerated),
    ];
} catch (Exception $e) {
    $db_error = $e->getMessage();
}

function n($v) {
    return (int) ($v ?? 0);
}

$statsOk = $tankStats !== null && $mapStats !== null;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Дашборд | Админ-панель</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="/admin/css/admin.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <link rel="stylesheet" href="/admin/css/dashboard.css?v=<?php echo htmlspecialchars($appVersion); ?>">
    <?php require __DIR__ . '/includes/csrf_head.php'; ?>
</head>
<body class="dashboard-page">
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-tachometer-alt" style="color: #ffd966;"></i>
                Дашборд
            </h1>
            <?php $navCurrent = 'dashboard'; include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <div class="profile-layout">
            <div class="profile-layout__main">
                <div class="profile-stack">
                    <section class="profile-card" aria-labelledby="profile-card-identity">
                        <div class="profile-card__head">
                            <h3 id="profile-card-identity" class="profile-card__title">
                                <i class="fas fa-id-badge" aria-hidden="true"></i> Профиль
                            </h3>
                        </div>
                        <div class="profile-card__body">
                            <div class="profile-identity">
                                <div class="profile-avatar" aria-hidden="true"><?php echo htmlspecialchars($avatarLetter, ENT_QUOTES, 'UTF-8'); ?></div>
                                <dl class="profile-meta">
                                    <dt>Логин</dt>
                                    <dd><?php echo htmlspecialchars($username); ?></dd>
                                    <dt>Роль</dt>
                                    <dd><?php echo htmlspecialchars($roleLabel); ?></dd>
                                </dl>
                            </div>
                        </div>
                    </section>

                    <section class="profile-card" aria-labelledby="profile-card-password">
                        <div class="profile-card__head">
                            <h3 id="profile-card-password" class="profile-card__title">
                                <i class="fas fa-key" aria-hidden="true"></i> Смена пароля
                            </h3>
                        </div>
                        <div class="profile-card__body">
                            <form id="dashboardPasswordForm" class="profile-password-form" autocomplete="off">
                                <div class="form-group">
                                    <label for="current_password">Текущий пароль</label>
                                    <input type="password" name="current_password" id="current_password" required autocomplete="current-password">
                                </div>
                                <div class="form-group">
                                    <label for="new_password">Новый пароль</label>
                                    <input type="password" name="new_password" id="new_password" required minlength="8" autocomplete="new-password" placeholder="Не менее 8 символов">
                                </div>
                                <div class="form-group">
                                    <label for="new_password_confirm">Повторите новый пароль</label>
                                    <input type="password" name="new_password_confirm" id="new_password_confirm" required minlength="8" autocomplete="new-password" placeholder="Введите ещё раз">
                                </div>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Сохранить новый пароль
                                </button>
                            </form>
                        </div>
                    </section>

                    <?php if ($isAdmin): ?>
                    <section class="profile-card" aria-labelledby="profile-card-site-settings">
                        <div class="profile-card__head">
                            <h3 id="profile-card-site-settings" class="profile-card__title">
                                <i class="fas fa-sliders-h" aria-hidden="true"></i> Настройки сайта
                            </h3>
                        </div>
                        <div class="profile-card__body">
                            <form id="siteSettingsForm" class="profile-password-form" autocomplete="off">
                                <div class="form-group">
                                    <label for="site_name_ru">Название сайта (RU)</label>
                                    <input type="text" name="site_name_ru" id="site_name_ru" required maxlength="120" value="<?php echo htmlspecialchars($siteNameRu, ENT_QUOTES, 'UTF-8'); ?>" placeholder="Отображается в шапке на всех страницах">
                                </div>
                                <div class="form-group">
                                    <label for="site_name_en">Название сайта (EN)</label>
                                    <input type="text" name="site_name_en" id="site_name_en" required maxlength="120" value="<?php echo htmlspecialchars($siteNameEn, ENT_QUOTES, 'UTF-8'); ?>" placeholder="Header title on all pages (English)">
                                </div>
                                <div class="form-group">
                                    <label for="wg_application_id">WG API application_id</label>
                                    <input type="text" name="wg_application_id" id="wg_application_id" maxlength="64" value="<?php echo htmlspecialchars($wgApplicationId, ENT_QUOTES, 'UTF-8'); ?>" placeholder="Ключ с developers.wargaming.net" autocomplete="off">
                                    <small class="form-hint">EU, NA, ASIA: поиск игроков, % попаданий, ссылки на кланы в рекрутинге.</small>
                                </div>
                                <div class="form-group">
                                    <label for="lesta_application_id">Lesta API application_id</label>
                                    <input type="text" name="lesta_application_id" id="lesta_application_id" maxlength="64" value="<?php echo htmlspecialchars($lestaApplicationId, ENT_QUOTES, 'UTF-8'); ?>" placeholder="Ключ с developers.lesta.ru" autocomplete="off">
                                    <small class="form-hint">RU: поиск игроков, % попаданий, ссылки на кланы, OAuth Lesta.</small>
                                </div>
                                <label class="profile-setting-toggle" for="replay_storage_enabled">
                                    <input type="checkbox" name="replay_storage_enabled" id="replay_storage_enabled" value="1"<?php echo $replayStorageEnabled ? ' checked' : ''; ?>>
                                    <span>
                                        <strong>Сохранять копии реплеев на сервере</strong>
                                        <small>Если отключено, блок с переключателем скрывается на лендинге, а API не сохраняет файлы.</small>
                                    </span>
                                </label>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i> Сохранить настройки
                                </button>
                            </form>
                        </div>
                    </section>
                    <?php endif; ?>
                </div>
            </div>

            <aside class="profile-layout__aside" aria-label="Разделы и сводка">
                <div class="profile-aside-stack">
                    <section class="profile-card" aria-labelledby="profile-card-modules">
                        <div class="profile-card__head">
                            <h3 id="profile-card-modules" class="profile-card__title">
                                <i class="fas fa-bars" aria-hidden="true"></i> Разделы админки
                            </h3>
                        </div>
                        <div class="profile-card__body">
                            <?php include __DIR__ . '/includes/admin_sections_nav.php'; ?>
                        </div>
                    </section>

                <?php if ($db_error !== null): ?>
                    <div class="alert alert-danger profile-aside-alert">
                        <i class="fas fa-exclamation-triangle"></i>
                        Сводка недоступна: <?php echo htmlspecialchars($db_error); ?>
                    </div>
                <?php elseif ($statsOk): ?>
                    <section class="profile-panel profile-panel--mini" aria-labelledby="profile-mini-stats-heading">
                        <h2 id="profile-mini-stats-heading" class="profile-section-title">
                            <i class="fas fa-chart-pie" aria-hidden="true"></i>
                            Сводка
                        </h2>
                        <div class="profile-panel__body profile-panel__body--mini">
                            <div class="profile-subsection-block">
                                <h3 class="profile-subsection-title profile-subsection-title--mini">
                                    <i class="fas fa-tools" aria-hidden="true"></i> Танки
                                </h3>
                                <div class="profile-stat-grid profile-stat-grid--mini-main">
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">Всего</div>
                                        <div class="value"><?php echo n($tankStats['total']); ?></div>
                                    </div>
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">Проверено</div>
                                        <div class="value"><?php echo n($tankStats['moderated']); ?></div>
                                    </div>
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">На проверке</div>
                                        <div class="value"><?php echo n($tankStats['unmoderated']); ?></div>
                                    </div>
                                </div>
                            </div>

                            <div class="profile-subsection-block profile-subsection-block--last">
                                <h3 class="profile-subsection-title profile-subsection-title--mini"><i class="fas fa-map"></i> Карты</h3>
                                <div class="profile-stat-grid profile-stat-grid--mini-maps">
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">Всего</div>
                                        <div class="value"><?php echo (int) $mapStats['total']; ?></div>
                                    </div>
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">Проверено</div>
                                        <div class="value"><?php echo (int) $mapStats['moderated']; ?></div>
                                    </div>
                                    <div class="profile-stat-card profile-stat-card--mini">
                                        <div class="label">На проверке</div>
                                        <div class="value"><?php echo (int) $mapStats['unmoderated']; ?></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                <?php endif; ?>
                </div>
            </aside>
        </div>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <script src="/admin/js/dashboard.js?v=<?php echo htmlspecialchars($appVersion); ?>"></script>
</body>
</html>
