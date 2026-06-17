<?php
$lang = 'ru';
try {
    require_once __DIR__ . '/../../../includes/lang.php';
    $lang = abs_detect_lang();
} catch (Throwable $e) {
    $lang = 'ru';
}

require_once __DIR__ . '/../../../includes/wotmods_helpers.php';

$mod = wotmods_battle_limit_page($lang);

$hubHref = wotmods_build_href($lang);
$homeHref = wotmods_build_home_href($lang);
$downloadLabel = $lang === 'en' ? 'Download' : 'Скачать';
$unavailableLabel = $lang === 'en' ? 'Not available yet' : 'Пока недоступно';

$pageTitle = (string) $mod['metaTitle'];
abs_set_page_titles('Блокировка кнопки «В бой»', 'Battle button limiter mod');
$metaDescription = (string) $mod['desc'];
$bodyClass = 'page-wotmods page-wotmods-detail';
$seoSlug = 'services/wotmods/battle-limit';

require __DIR__ . '/../../../includes/site_header.php';
?>

        <main class="wotmods-service wotmods-detail">
            <section class="checkers-panel wotmods-service-header">
                <div class="checkers-section-head">
                    <div>
                        <div class="wotmods-detail__badges">
                            <?php echo wotmods_client_badges_html(); ?>
                            <span class="wotmods-card__version">v<?php echo htmlspecialchars((string) $mod['version'], ENT_QUOTES, 'UTF-8'); ?></span>
                        </div>
                        <h2 class="checkers-section-title">
                            <i class="fas <?php echo htmlspecialchars((string) $mod['icon'], ENT_QUOTES, 'UTF-8'); ?>" aria-hidden="true"></i>
                            <?php echo htmlspecialchars((string) $mod['title'], ENT_QUOTES, 'UTF-8'); ?>
                        </h2>
                        <p class="checkers-section-hint"><?php echo htmlspecialchars((string) $mod['desc'], ENT_QUOTES, 'UTF-8'); ?></p>
                    </div>
                    <div class="checkers-section-actions wotmods-detail__nav">
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($hubHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span><?php echo $lang === 'en' ? 'All mods' : 'Все моды'; ?></span>
                        </a>
                        <a class="checkers-back-link" href="<?php echo htmlspecialchars($homeHref, ENT_QUOTES, 'UTF-8'); ?>">
                            <i class="fas fa-home" aria-hidden="true"></i>
                            <span><?php echo $lang === 'en' ? 'Home' : 'На главную'; ?></span>
                        </a>
                    </div>
                </div>
            </section>

            <section class="checkers-panel wotmods-detail-section">
                <h3 class="wotmods-detail__heading"><?php echo $lang === 'en' ? 'Features' : 'Возможности'; ?></h3>
                <ul class="wotmods-detail__list">
                    <?php foreach ($mod['features'] as $feature): ?>
                        <li><?php echo htmlspecialchars((string) $feature, ENT_QUOTES, 'UTF-8'); ?></li>
                    <?php endforeach; ?>
                </ul>
                <p class="wotmods-detail__note"><?php echo htmlspecialchars((string) $mod['compatNote'], ENT_QUOTES, 'UTF-8'); ?></p>
            </section>

            <section class="checkers-panel wotmods-detail-section">
                <h3 class="wotmods-detail__heading"><?php echo $lang === 'en' ? 'Downloads' : 'Скачать'; ?></h3>
                <div class="wotmods-downloads">
                    <?php foreach ($mod['downloads'] as $item): ?>
                        <article class="wotmods-download-card">
                            <div class="wotmods-download-card__body">
                                <h4 class="wotmods-download-card__title"><?php echo htmlspecialchars((string) $item['label'], ENT_QUOTES, 'UTF-8'); ?></h4>
                                <p class="wotmods-download-card__file"><code><?php echo htmlspecialchars((string) $item['filename'], ENT_QUOTES, 'UTF-8'); ?></code></p>
                                <p class="wotmods-download-card__hint"><?php echo $item['hint']; ?></p>
                            </div>
                            <div class="wotmods-download-card__actions">
                                <?php if (!empty($item['available'])): ?>
                                    <a class="btn btn-primary wotmods-download-btn" href="<?php echo htmlspecialchars((string) $item['url'], ENT_QUOTES, 'UTF-8'); ?>" download>
                                        <i class="fas fa-download" aria-hidden="true"></i>
                                        <?php echo htmlspecialchars($downloadLabel, ENT_QUOTES, 'UTF-8'); ?>
                                    </a>
                                <?php else: ?>
                                    <span class="wotmods-download-btn wotmods-download-btn--disabled"><?php echo htmlspecialchars($unavailableLabel, ENT_QUOTES, 'UTF-8'); ?></span>
                                <?php endif; ?>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="checkers-panel wotmods-detail-section">
                <h3 class="wotmods-detail__heading"><?php echo $lang === 'en' ? 'Installation' : 'Установка'; ?></h3>
                <ol class="wotmods-detail__steps">
                    <?php foreach ($mod['installSteps'] as $step): ?>
                        <li><?php echo $step; ?></li>
                    <?php endforeach; ?>
                </ol>
                <div class="wotmods-paths">
                    <?php foreach ($mod['examplePaths'] as $label => $path): ?>
                        <div class="wotmods-paths__item">
                            <span class="wotmods-paths__label"><?php echo htmlspecialchars((string) $label, ENT_QUOTES, 'UTF-8'); ?></span>
                            <code class="wotmods-paths__value"><?php echo htmlspecialchars((string) $path, ENT_QUOTES, 'UTF-8'); ?></code>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="checkers-panel wotmods-detail-section wotmods-detail-section--split">
                <div>
                    <h3 class="wotmods-detail__heading"><?php echo $lang === 'en' ? 'Hotkeys (hangar)' : 'Горячие клавиши (ангар)'; ?></h3>
                    <div class="wotmods-table-wrap">
                        <table class="wotmods-table">
                            <thead>
                                <tr>
                                    <th><?php echo $lang === 'en' ? 'Keys' : 'Клавиши'; ?></th>
                                    <th><?php echo $lang === 'en' ? 'Action' : 'Действие'; ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($mod['hotkeys'] as $row): ?>
                                    <tr>
                                        <td><code><?php echo htmlspecialchars((string) $row['keys'], ENT_QUOTES, 'UTF-8'); ?></code></td>
                                        <td><?php echo htmlspecialchars((string) $row['action'], ENT_QUOTES, 'UTF-8'); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="wotmods-detail__heading"><?php echo $lang === 'en' ? 'Config' : 'Конфигурация'; ?></h3>
                    <div class="wotmods-table-wrap">
                        <table class="wotmods-table">
                            <thead>
                                <tr>
                                    <th><?php echo $lang === 'en' ? 'Field' : 'Поле'; ?></th>
                                    <th><?php echo $lang === 'en' ? 'Description' : 'Описание'; ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($mod['configFields'] as $field): ?>
                                    <tr>
                                        <td><code><?php echo htmlspecialchars((string) $field['name'], ENT_QUOTES, 'UTF-8'); ?></code></td>
                                        <td><?php echo htmlspecialchars((string) $field['desc'], ENT_QUOTES, 'UTF-8'); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <pre class="wotmods-code"><code><?php echo htmlspecialchars((string) $mod['configSample'], ENT_QUOTES, 'UTF-8'); ?></code></pre>
                </div>
            </section>
        </main>

<?php require __DIR__ . '/../../../includes/site_footer.php'; ?>
</body>
</html>
