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

$db_error = null;
$settings = minecraft_get_settings($db);

try {
    ensure_site_settings_table($db);
    $settings = minecraft_get_settings($db);
} catch (Exception $e) {
    $db_error = $e->getMessage();
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
            <div class="profile-card" style="max-width: 720px;">
                <div class="profile-card__head">
                    <h3 class="profile-card__title">
                        <i class="fas fa-sliders-h" aria-hidden="true"></i> Настройки лаунчера
                    </h3>
                </div>
                <div class="profile-card__body">
                    <p class="form-hint" style="margin-bottom: 16px;">
                        Конфигурация отдаётся лаунчеру через
                        <code>/api/minecraft/bootstrap</code>.
                    </p>
                    <form id="minecraftSettingsForm" class="profile-password-form" autocomplete="off">
                        <label class="profile-setting-toggle" for="mc_enabled">
                            <input type="checkbox" name="mc_enabled" id="mc_enabled" value="1"<?php echo $settings['enabled'] ? ' checked' : ''; ?>>
                            <span>
                                <strong>Лаунчер включён</strong>
                                <small>Если отключено, API вернёт <code>enabled: false</code>.</small>
                            </span>
                        </label>

                        <div class="form-group">
                            <label for="mc_server_name">Название сервера</label>
                            <input type="text" name="mc_server_name" id="mc_server_name" required maxlength="80"
                                value="<?php echo htmlspecialchars($settings['server_name'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="Chadow SMP">
                        </div>

                        <div class="form-group">
                            <label for="mc_server_host">IP / домен сервера</label>
                            <input type="text" name="mc_server_host" id="mc_server_host" maxlength="253"
                                value="<?php echo htmlspecialchars($settings['server_host'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="mc.example.com или 192.168.1.10">
                        </div>

                        <div class="form-group">
                            <label for="mc_server_port">Порт</label>
                            <input type="number" name="mc_server_port" id="mc_server_port" min="1" max="65535"
                                value="<?php echo (int) $settings['server_port']; ?>">
                        </div>

                        <div class="form-group">
                            <label for="mc_minecraft_version">Версия Minecraft</label>
                            <input type="text" name="mc_minecraft_version" id="mc_minecraft_version" required maxlength="16"
                                value="<?php echo htmlspecialchars($settings['minecraft_version'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="1.20.4">
                            <small class="form-hint">Формат: 1.20.4 (не 20.1.4)</small>
                        </div>

                        <div class="form-group">
                            <label for="mc_java_major">Java (major)</label>
                            <input type="number" name="mc_java_major" id="mc_java_major" min="8" max="25"
                                value="<?php echo (int) $settings['java_major']; ?>">
                        </div>

                        <div class="form-group">
                            <label for="mc_wg_application_id">WG API application_id (лаунчер)</label>
                            <input type="text" name="mc_wg_application_id" id="mc_wg_application_id" maxlength="64"
                                value="<?php echo htmlspecialchars($settings['wg_application_id'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="Ключ с developers.wargaming.net" autocomplete="off">
                            <small class="form-hint">EU/NA: OAuth вход в лаунчере. Redirect: <code>https://chadow.ru/api/minecraft/oauth/callback</code></small>
                        </div>

                        <div class="form-group">
                            <label for="mc_lesta_application_id">Lesta API application_id (лаунчер)</label>
                            <input type="text" name="mc_lesta_application_id" id="mc_lesta_application_id" maxlength="64"
                                value="<?php echo htmlspecialchars($settings['lesta_application_id'], ENT_QUOTES, 'UTF-8'); ?>"
                                placeholder="Ключ с developers.lesta.ru" autocomplete="off">
                        </div>

                        <div class="form-group">
                            <label for="mc_launcher_version">Версия лаунчера (для автообновления)</label>
                            <input type="number" name="mc_launcher_version" id="mc_launcher_version" min="1"
                                value="<?php echo (int) $settings['launcher_version']; ?>">
                        </div>

                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Сохранить
                        </button>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>
    <script src="/admin/js/minecraft.js?v=<?php echo htmlspecialchars($appVersion, ENT_QUOTES, 'UTF-8'); ?>"></script>
<?php require __DIR__ . '/includes/admin_footer.php'; ?>
