<?php
/**
 * Компактное меню админки. Требует подключённый bootstrap и авторизацию.
 * Перед include задайте $navCurrent: index | pages | site-menu | dictionaries | maps | recruiting | brackets | wgsrt | users | dashboard
 */
if (!isset($navCurrent)) {
    $navCurrent = 'index';
}
require_once __DIR__ . '/admin_sections.php';
$au = function_exists('admin_user') ? admin_user() : null;
$displayName = $au && !empty($au['username']) ? $au['username'] : '';
$isAdmin = function_exists('admin_is_admin') && admin_is_admin();
?>
<div class="header-controls header-controls--compact">
    <?php if ($displayName !== ''): ?>
        <span class="admin-header-user" title="Вы вошли как"><?php echo htmlspecialchars($displayName); ?></span>
    <?php endif; ?>
    <a href="/admin/dashboard" class="btn admin-header-icon-btn" title="Дашборд" aria-label="Дашборд">
        <i class="fas fa-tachometer-alt"></i>
    </a>
    <button type="button" class="btn admin-header-icon-btn" onclick="location.reload()" title="Обновить страницу" aria-label="Обновить страницу">
        <i class="fas fa-sync-alt"></i>
    </button>
    <a href="/" class="btn admin-header-icon-btn" title="На сайт" aria-label="На сайт">
        <i class="fas fa-external-link-alt"></i>
    </a>
    <form method="post" action="/admin/logout" class="admin-header-logout-form">
        <input type="hidden" name="logout" value="1">
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(admin_csrf_token()); ?>">
        <button type="submit" class="btn admin-header-logout-btn" title="Выйти из админ-панели" aria-label="Выйти">
            <i class="fas fa-sign-out-alt"></i>
            <span>Выйти</span>
        </button>
    </form>
    <details class="admin-nav-menu">
        <summary class="btn admin-nav-menu-toggle" aria-label="Открыть список разделов">
            <i class="fas fa-bars"></i>
            <span>Разделы</span>
        </summary>
        <div class="admin-nav-menu-panel">
            <div class="admin-nav-menu-group">
                <a href="/admin/dashboard" class="admin-nav-menu-item<?php echo $navCurrent === 'dashboard' ? ' is-active' : ''; ?>">
                    <i class="fas fa-tachometer-alt"></i> Дашборд
                </a>
            </div>
            <div class="admin-nav-menu-divider" role="separator"></div>
            <div class="admin-nav-menu-group">
                <div class="admin-nav-menu-caption">Разделы админки</div>
                <?php foreach (admin_panel_sections() as $section): ?>
                    <?php if (!empty($section['admin_only']) && !$isAdmin) continue; ?>
                    <a href="<?php echo htmlspecialchars($section['href'], ENT_QUOTES, 'UTF-8'); ?>"
                        class="admin-nav-menu-item<?php echo $navCurrent === $section['id'] ? ' is-active' : ''; ?>">
                        <i class="<?php echo htmlspecialchars($section['icon'], ENT_QUOTES, 'UTF-8'); ?>"></i>
                        <?php echo htmlspecialchars(admin_panel_section_nav_label($section['id'], $section['label']), ENT_QUOTES, 'UTF-8'); ?>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </details>
</div>
