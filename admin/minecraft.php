<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../includes/minecraft_helpers.php';

admin_require_web();

if (!admin_is_admin()) {
    header('Location: /admin/dashboard');
    exit();
}

$pageTitle = 'Chadow Games Launcher | Админка';
$bodyClass = 'minecraft-admin-page';
$navCurrent = 'minecraft';

$_versionRaw = @file_get_contents(__DIR__ . '/../config/version.json');
$_versionData = $_versionRaw ? json_decode($_versionRaw, true) : null;
$appVersion = (is_array($_versionData) && !empty($_versionData['version'])) ? $_versionData['version'] : '3.4.4';
$extraHead = '<link rel="stylesheet" href="/admin/css/minecraft.css?v=' . htmlspecialchars($appVersion, ENT_QUOTES, 'UTF-8') . '">';

$db_error = null;
$settings = minecraft_get_settings($db);

try {
    ensure_site_settings_table($db);
    $settings = minecraft_get_settings($db);
    $clientPacks = minecraft_get_client_packs($db);
    $landing = $settings['landing'] ?? minecraft_get_landing_settings($db);
} catch (Exception $e) {
    $db_error = $e->getMessage();
    $clientPacks = [];
    $landing = minecraft_landing_defaults();
    $landing['active'] = false;
    $landing['launcher_file'] = null;
}

require __DIR__ . '/includes/admin_head.php';
?>
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-rocket" aria-hidden="true"></i>
                Chadow Games Launcher
            </h1>
            <?php include __DIR__ . '/includes/header_nav.php'; ?>
        </div>

        <?php if ($db_error !== null): ?>
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка БД: <?php echo htmlspecialchars($db_error, ENT_QUOTES, 'UTF-8'); ?>
            </div>
        <?php else: ?>
            <div class="minecraft-admin-stack">
                <div class="profile-card">
                    <div class="profile-card__head">
                        <h3 class="profile-card__title">
                            <i class="fas fa-sliders-h" aria-hidden="true"></i> Настройки лаунчера
                        </h3>
                    </div>
                    <div class="profile-card__body">
                        <p class="minecraft-intro">
                            Конфигурация для лаунчера: <code>/api/minecraft/bootstrap</code>.
                            Версия сайта: <code><?php echo htmlspecialchars(chadow_app_version(), ENT_QUOTES, 'UTF-8'); ?></code>
                        </p>
                        <form id="minecraftSettingsForm" class="profile-password-form minecraft-form-grid" autocomplete="off">
                            <label class="profile-setting-toggle minecraft-form-full" for="mc_enabled">
                                <input type="checkbox" name="mc_enabled" id="mc_enabled" value="1"<?php echo $settings['enabled'] ? ' checked' : ''; ?>>
                                <span>
                                    <strong>Лаунчер включён</strong>
                                    <small>Если отключено, API вернёт <code>enabled: false</code>.</small>
                                </span>
                            </label>

                            <div class="minecraft-form-full minecraft-servers-panel">
                                <div class="minecraft-servers-head">
                                    <p class="minecraft-servers-title">Серверы Minecraft</p>
                                    <button type="button" class="btn btn-sm btn-secondary" id="mcServerAddBtn">
                                        <i class="fas fa-plus"></i> Добавить сервер
                                    </button>
                                </div>
                                <p class="form-hint">Список отображается в лаунчере — игрок выбирает сервер перед запуском.</p>
                                <div id="minecraftServersList" class="minecraft-servers-list"></div>
                                <input type="hidden" name="mc_servers_json" id="mc_servers_json" value="">
                            </div>

                            <div class="form-group">
                                <label for="mc_minecraft_version">Версия Minecraft</label>
                                <input type="text" name="mc_minecraft_version" id="mc_minecraft_version" required maxlength="16"
                                    value="<?php echo htmlspecialchars($settings['minecraft_version'], ENT_QUOTES, 'UTF-8'); ?>"
                                    placeholder="26.1.2">
                                <small class="form-hint">1.21.11 или 26.1.2</small>
                            </div>

                            <div class="form-group">
                                <label for="mc_java_major">Java (major)</label>
                                <input type="number" name="mc_java_major" id="mc_java_major" min="8" max="30"
                                    value="<?php echo (int) $settings['java_major']; ?>">
                            </div>

                            <div class="form-group">
                                <label for="mc_launcher_version">Build лаунчера</label>
                                <input type="number" name="mc_launcher_version" id="mc_launcher_version" min="1"
                                    value="<?php echo (int) $settings['launcher_version']; ?>">
                                <small class="form-hint">Для автообновления</small>
                            </div>

                            <div class="form-group minecraft-form-full">
                                <label for="mc_exaroton_api_token">Exaroton API token</label>
                                <input type="password" name="mc_exaroton_api_token" id="mc_exaroton_api_token" maxlength="128"
                                    value="<?php echo htmlspecialchars($settings['exaroton_api_token'] ?? '', ENT_QUOTES, 'UTF-8'); ?>"
                                    placeholder="Для автозапуска серверов из лаунчера" autocomplete="new-password">
                                <small class="form-hint">Токен из настроек аккаунта exaroton (не ID сервера). Сохраняется при нажатии «Сохранить» в этом блоке; не стирается при сохранении карточки на главной.</small>
                            </div>
                        </form>
                    </div>
                    <div class="profile-card__foot">
                        <button type="submit" form="minecraftSettingsForm" class="btn btn-primary">
                            <i class="fas fa-save"></i> Сохранить
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <div class="profile-card__head">
                        <h3 class="profile-card__title">
                            <i class="fas fa-th-large" aria-hidden="true"></i> Карточка на главной
                        </h3>
                    </div>
                    <div class="profile-card__body">
                        <p class="minecraft-intro">
                            Блок <code>Chadow Games Launcher</code> на главной странице сайта.
                        </p>
                        <form id="minecraftLandingForm" class="profile-password-form minecraft-form-grid" autocomplete="off">
                            <label class="profile-setting-toggle minecraft-form-full" for="mc_landing_active">
                                <input type="checkbox" name="mc_landing_active" id="mc_landing_active" value="1"<?php echo !empty($landing['active']) ? ' checked' : ''; ?>>
                                <span>
                                    <strong>Карточка активна</strong>
                                    <small>Если включено и загружен установщик — карточка кликабельна и ведёт на скачивание.</small>
                                </span>
                            </label>

                            <div class="form-group minecraft-form-full">
                                <label for="mc_landing_desc_ru">Описание (RU)</label>
                                <textarea name="mc_landing_desc_ru" id="mc_landing_desc_ru" rows="3" maxlength="500"><?php echo htmlspecialchars($landing['desc_ru'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
                            </div>

                            <div class="form-group minecraft-form-full">
                                <label for="mc_landing_desc_en">Описание (EN)</label>
                                <textarea name="mc_landing_desc_en" id="mc_landing_desc_en" rows="3" maxlength="500"><?php echo htmlspecialchars($landing['desc_en'] ?? '', ENT_QUOTES, 'UTF-8'); ?></textarea>
                            </div>

                            <div class="form-group">
                                <label for="mc_landing_tile_span">Размер карточки</label>
                                <select name="mc_landing_tile_span" id="mc_landing_tile_span">
                                    <?php
                                    $tileSpan = (int) ($landing['tile_span'] ?? 2);
                                    $tileOptions = [
                                        1 => 'Маленькая — 1/4 ширины',
                                        2 => 'Средняя — 1/2 ширины',
                                        4 => 'Большая — на всю ширину',
                                    ];
                                    foreach ($tileOptions as $value => $label):
                                    ?>
                                        <option value="<?php echo $value; ?>"<?php echo $tileSpan === $value ? ' selected' : ''; ?>>
                                            <?php echo htmlspecialchars($label, ENT_QUOTES, 'UTF-8'); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>

                            <div class="minecraft-form-full minecraft-badges-panel">
                                <div class="minecraft-servers-head">
                                    <p class="minecraft-servers-title">Бейджи</p>
                                    <button type="button" class="btn btn-sm btn-secondary" id="mcLandingBadgeAddBtn">
                                        <i class="fas fa-plus"></i> Добавить бейдж
                                    </button>
                                </div>
                                <p class="form-hint">Подписи на карточке — например «в разработке», «Minecraft» и т.д.</p>
                                <div id="minecraftLandingBadgesList" class="minecraft-badges-list"></div>
                                <input type="hidden" name="mc_landing_badges_json" id="mc_landing_badges_json" value="">
                            </div>

                            <div class="minecraft-form-full minecraft-launcher-file-panel">
                                <p class="minecraft-servers-title">Файл лаунчера</p>
                                <p class="form-hint">Установщик для скачивания с главной (.exe или .msi, до 512 МБ).</p>

                                <div id="minecraftLauncherFileInfo" class="minecraft-launcher-file-info<?php echo empty($landing['launcher_file']) ? ' is-empty' : ''; ?>">
                                    <?php if (!empty($landing['launcher_file'])): ?>
                                        <?php
                                        $launcherFile = $landing['launcher_file'];
                                        $launcherSizeMb = round(($launcherFile['size'] ?? 0) / 1024 / 1024, 1);
                                        $launcherUploaded = !empty($launcherFile['uploaded_at'])
                                            ? date('d.m.Y H:i', strtotime($launcherFile['uploaded_at']))
                                            : '—';
                                        ?>
                                        <div class="minecraft-launcher-file-meta">
                                            <strong><?php echo htmlspecialchars($launcherFile['original_name'] ?? $launcherFile['filename'], ENT_QUOTES, 'UTF-8'); ?></strong>
                                            <span><?php echo htmlspecialchars((string) $launcherSizeMb, ENT_QUOTES, 'UTF-8'); ?> МБ · <?php echo htmlspecialchars($launcherUploaded, ENT_QUOTES, 'UTF-8'); ?></span>
                                            <a href="<?php echo htmlspecialchars(minecraft_launcher_public_path($launcherFile['filename']), ENT_QUOTES, 'UTF-8'); ?>" target="_blank" rel="noopener">Открыть</a>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-danger" id="minecraftLauncherDeleteBtn">Удалить файл</button>
                                    <?php else: ?>
                                        <p class="minecraft-launcher-file-empty">Файл не загружен.</p>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </form>

                        <form id="minecraftLauncherUploadForm" class="minecraft-launcher-upload-form" autocomplete="off">
                            <input type="file" class="minecraft-pack-control minecraft-file-input" name="mc_launcher_file" id="mc_launcher_file" accept=".exe,.msi,application/x-msdownload,application/x-msi">
                            <button type="submit" class="btn btn-primary" id="minecraftLauncherUploadBtn">
                                <i class="fas fa-upload"></i> Загрузить установщик
                            </button>
                        </form>
                    </div>
                    <div class="profile-card__foot">
                        <button type="submit" form="minecraftLandingForm" class="btn btn-primary">
                            <i class="fas fa-save"></i> Сохранить карточку
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <div class="profile-card__head">
                        <h3 class="profile-card__title">
                            <i class="fas fa-file-archive" aria-hidden="true"></i> Архивы клиента
                        </h3>
                    </div>
                    <div class="profile-card__body">
                        <p class="minecraft-intro">
                            ZIP ускоряет установку: один архив с сайта вместо тысяч файлов Mojang.
                            В корне: <code>versions/{версия}/</code>, <code>libraries/</code>, <code>assets/</code>.
                        </p>

                        <form id="minecraftPackUploadForm" class="minecraft-pack-form" autocomplete="off">
                            <label class="minecraft-pack-label" for="mc_pack_version">Версия</label>
                            <label class="minecraft-pack-label" for="mc_pack_archive">ZIP-архив</label>
                            <span class="minecraft-pack-label-spacer" aria-hidden="true"></span>

                            <input type="text" class="minecraft-pack-control" name="mc_pack_version" id="mc_pack_version" required maxlength="16"
                                value="<?php echo htmlspecialchars($settings['minecraft_version'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="1.21.11">

                            <input type="file" class="minecraft-pack-control minecraft-file-input" name="mc_pack_archive" id="mc_pack_archive" accept=".zip,application/zip" required>

                            <button type="submit" class="btn btn-primary minecraft-pack-submit" id="minecraftPackUploadBtn">
                                <i class="fas fa-upload"></i> Загрузить
                            </button>

                            <span class="minecraft-pack-spacer" aria-hidden="true"></span>
                            <small class="form-hint minecraft-pack-hint">До 2 ГБ (лимит PHP на сервере: ~<?php echo minecraft_pack_php_upload_limit_mb(); ?> МБ)</small>
                            <span class="minecraft-pack-spacer" aria-hidden="true"></span>
                        </form>

                        <div id="minecraftPacksList" class="minecraft-packs-list">
                            <?php if (empty($clientPacks)): ?>
                                <p class="minecraft-packs-empty" id="minecraftPacksEmpty">Архивы пока не загружены.</p>
                            <?php else: ?>
                                <table class="admin-table" id="minecraftPacksTable">
                                    <thead>
                                        <tr>
                                            <th>Версия</th>
                                            <th>Размер</th>
                                            <th>Загружен</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($clientPacks as $pack): ?>
                                            <?php
                                            $sizeMb = round($pack['size'] / 1024 / 1024, 1);
                                            $uploaded = $pack['uploaded_at'] !== ''
                                                ? date('d.m.Y H:i', strtotime($pack['uploaded_at']))
                                                : '—';
                                            ?>
                                            <tr data-version="<?php echo htmlspecialchars($pack['version'], ENT_QUOTES, 'UTF-8'); ?>">
                                                <td><code><?php echo htmlspecialchars($pack['version'], ENT_QUOTES, 'UTF-8'); ?></code></td>
                                                <td><?php echo htmlspecialchars((string) $sizeMb, ENT_QUOTES, 'UTF-8'); ?> МБ</td>
                                                <td><?php echo htmlspecialchars($uploaded, ENT_QUOTES, 'UTF-8'); ?></td>
                                                <td>
                                                    <button type="button" class="btn btn-sm btn-danger minecraft-pack-delete"
                                                        data-version="<?php echo htmlspecialchars($pack['version'], ENT_QUOTES, 'UTF-8'); ?>">
                                                        Удалить
                                                    </button>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>
    <?php include __DIR__ . '/includes/footer.php'; ?>
    <script>
        window.__mcInitialServers = <?php echo json_encode($settings['servers'] ?? [], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        window.__mcInitialLandingBadges = <?php echo json_encode($landing['badges'] ?? [], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
        window.__mcBadgeStyles = <?php echo json_encode(minecraft_landing_badge_styles(), JSON_UNESCAPED_UNICODE); ?>;
        window.__mcServerIcons = <?php echo json_encode(minecraft_server_icon_options(), JSON_UNESCAPED_UNICODE); ?>;
    </script>
    <script src="/admin/js/minecraft.js?v=<?php echo htmlspecialchars($appVersion, ENT_QUOTES, 'UTF-8'); ?>"></script>
<?php require __DIR__ . '/includes/admin_footer.php'; ?>
