<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/../includes/minecraft_helpers.php';

admin_require_web();

if (!admin_is_admin()) {
    header('Location: /admin/dashboard');
    exit();
}

$pageTitle = 'Minecraft сервер | Админка';
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
} catch (Exception $e) {
    $db_error = $e->getMessage();
    $clientPacks = [];
}

require __DIR__ . '/includes/admin_head.php';
?>
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-cube" style="color: #64b5f6;"></i>
                Minecraft сервер
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

                            <div class="form-group minecraft-form-full">
                                <label for="mc_server_name">Название сервера</label>
                                <input type="text" name="mc_server_name" id="mc_server_name" required maxlength="80"
                                    value="<?php echo htmlspecialchars($settings['server_name'], ENT_QUOTES, 'UTF-8'); ?>"
                                    placeholder="Chadow SMP">
                            </div>

                            <div class="form-group minecraft-form-host">
                                <label for="mc_server_host">IP / домен сервера</label>
                                <input type="text" name="mc_server_host" id="mc_server_host" maxlength="253"
                                    value="<?php echo htmlspecialchars($settings['server_host'], ENT_QUOTES, 'UTF-8'); ?>"
                                    placeholder="mc.example.com или 192.168.1.10">
                            </div>

                            <div class="form-group minecraft-form-port">
                                <label for="mc_server_port">Порт</label>
                                <input type="number" name="mc_server_port" id="mc_server_port" min="1" max="65535"
                                    value="<?php echo (int) $settings['server_port']; ?>">
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

                            <div class="minecraft-form-full minecraft-oauth-panel">
                                <p class="minecraft-oauth-panel__title">OAuth WG / Lesta</p>
                                <div class="minecraft-oauth-badges">
                                    <span class="minecraft-oauth-badge<?php echo $settings['wg_application_id'] !== '' ? ' is-ok' : ''; ?>">
                                        WG: <?php echo $settings['wg_application_id'] !== '' ? 'настроен' : 'не задан'; ?>
                                    </span>
                                    <span class="minecraft-oauth-badge<?php echo $settings['lesta_application_id'] !== '' ? ' is-ok' : ''; ?>">
                                        Lesta: <?php echo $settings['lesta_application_id'] !== '' ? 'настроен' : 'не задан'; ?>
                                    </span>
                                </div>
                                <p class="minecraft-oauth-note">
                                    Ключи из <a href="/admin/dashboard">настроек сайта</a>.
                                </p>
                                <p class="minecraft-oauth-note">
                                    Redirect URI (уже используется сайтом):
                                    <code><?php echo htmlspecialchars(user_absolute_url('/auth/wg/callback'), ENT_QUOTES, 'UTF-8'); ?></code>
                                </p>
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
                            <small class="form-hint minecraft-pack-hint">До 2 ГБ</small>
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
    <script src="/admin/js/minecraft.js?v=<?php echo htmlspecialchars($appVersion, ENT_QUOTES, 'UTF-8'); ?>"></script>
<?php require __DIR__ . '/includes/admin_footer.php'; ?>
