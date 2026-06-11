<?php
/**
 * Ссылки «Разделы админки» для карточки на дашборде.
 *
 * @var string|null $navCurrent
 */
require_once __DIR__ . '/admin_sections.php';

$navCurrent = $navCurrent ?? '';
$isAdmin = function_exists('admin_is_admin') && admin_is_admin();
?>
<nav class="profile-module-links" aria-label="Разделы админ-панели">
    <?php foreach (admin_panel_sections() as $section): ?>
        <?php if (!empty($section['admin_only']) && !$isAdmin) continue; ?>
        <a href="<?php echo htmlspecialchars($section['href'], ENT_QUOTES, 'UTF-8'); ?>"
            class="profile-module-link<?php echo $navCurrent === $section['id'] ? ' is-active' : ''; ?>">
            <i class="<?php echo htmlspecialchars($section['icon'], ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></i>
            <?php echo htmlspecialchars($section['label'], ENT_QUOTES, 'UTF-8'); ?>
        </a>
    <?php endforeach; ?>
</nav>
