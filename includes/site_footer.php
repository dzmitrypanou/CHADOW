<?php

if (!isset($siteVersion)) {
    if (!isset($GLOBALS['__chadow_site_version'])) {
        $_svRaw = @file_get_contents(__DIR__ . '/../config/version.json');
        $_svData = $_svRaw ? json_decode($_svRaw, true) : null;
        $GLOBALS['__chadow_site_version'] = (is_array($_svData) && !empty($_svData['version'])) ? $_svData['version'] : '3.4.4';
    }
    $siteVersion = $GLOBALS['__chadow_site_version'];
}

$absLang = 'ru';
try {
    require_once __DIR__ . '/lang.php';
    $absLang = abs_detect_lang();
} catch (Throwable $e) {
    $absLang = 'ru';
}

$siteFooterMenuItems = [];
try {
    require_once __DIR__ . '/../config/database.php';
    $_footerMenuDb = Database::getInstance();
    if (!isset($GLOBALS['__chadow_site_menu_cache']) || !is_array($GLOBALS['__chadow_site_menu_cache'])) {
        $GLOBALS['__chadow_site_menu_cache'] = [];
    }
    $menuCache = &$GLOBALS['__chadow_site_menu_cache'];
    $cacheTtl = 120;
    $cacheFresh = isset($menuCache['loaded_at']) && (time() - (int) $menuCache['loaded_at']) < $cacheTtl;
    if (!$cacheFresh) {
        require_once __DIR__ . '/../config/ensure_site_menu.php';
        ensure_site_menu_table($_footerMenuDb);
        $menuCache = [
            'loaded_at' => time(),
            'header' => $_footerMenuDb->fetchAll(
                "SELECT label, label_en, href FROM cms_site_menu WHERE is_enabled = 1 AND (placement = 'header' OR placement IS NULL OR placement = '') ORDER BY sort_order ASC, id ASC"
            ),
            'footer' => $_footerMenuDb->fetchAll(
                "SELECT label, label_en, href FROM cms_site_menu WHERE is_enabled = 1 AND placement = 'footer' ORDER BY sort_order ASC, id ASC"
            ),
        ];
    }
    $siteFooterMenuItems = is_array($menuCache['footer'] ?? null) ? $menuCache['footer'] : [];
} catch (Throwable $e) {
    $siteFooterMenuItems = [];
}

$sitePublicPath = '';
try {
    $sitePublicPath = abs_extract_slug_from_request();
} catch (Throwable $e) {
    $sitePublicPath = '';
}
$footerLangRuHref = abs_build_lang_href('ru', $sitePublicPath);
$footerLangEnHref = abs_build_lang_href('en', $sitePublicPath);
?>
<?php if (empty($tacticsRoomShell)): ?>
        <div class="page-bottom-spacer" aria-hidden="true"></div>
        <footer>
            <div class="footer-axis" aria-hidden="true">
                <div class="footer-axis-track"></div>
                <div class="footer-axis-ticks">
                    <span class="footer-axis-tick">0</span>
                    <span class="footer-axis-tick">1</span>
                    <span class="footer-axis-tick">2</span>
                    <span class="footer-axis-tick">3</span>
                    <span class="footer-axis-tick">4</span>
                    <span class="footer-axis-tick">5</span>
                    <span class="footer-axis-tick">6</span>
                    <span class="footer-axis-tick">7</span>
                    <span class="footer-axis-tick">8</span>
                    <span class="footer-axis-tick">9</span>
                    <span class="footer-axis-tick">10</span>
                    <span class="footer-axis-tick">11</span>
                    <span class="footer-axis-tick">12</span>
                </div>
            </div>
            <div class="site-footer-top">
                <div class="site-footer-toolbar">
                    <div class="site-lang-switch site-lang-switch-footer" aria-label="Language switch">
                        <a class="site-lang-link<?php echo $absLang === 'ru' ? ' is-active' : ''; ?>" data-lang="ru" href="<?php echo htmlspecialchars($footerLangRuHref, ENT_QUOTES, 'UTF-8'); ?>" aria-label="Russian">
                            <span class="site-lang-flag fi fi-ru" aria-hidden="true"></span> RU
                        </a>
                        <a class="site-lang-link<?php echo $absLang === 'en' ? ' is-active' : ''; ?>" data-lang="en" href="<?php echo htmlspecialchars($footerLangEnHref, ENT_QUOTES, 'UTF-8'); ?>" aria-label="English">
                            <span class="site-lang-flag fi fi-us" aria-hidden="true"></span> US
                        </a>
                    </div>
                    <?php if (!empty($siteFooterMenuItems)): ?>
                    <div class="site-footer-menu" id="siteFooterMenu">
                        <button
                            type="button"
                            class="site-footer-menu-toggle"
                            id="siteFooterMenuToggle"
                            aria-expanded="false"
                            aria-controls="siteFooterMenuPanel"
                            aria-label="<?php echo $absLang === 'en' ? 'Footer menu' : 'Меню в подвале'; ?>"
                        >
                            <span class="site-footer-menu-bars" aria-hidden="true"></span>
                        </button>
                        <nav
                            class="site-footer-nav site-footer-nav--dropdown"
                            id="siteFooterMenuPanel"
                            aria-label="<?php echo $absLang === 'en' ? 'Footer links' : 'Ссылки в подвале'; ?>"
                        >
                            <?php foreach ($siteFooterMenuItems as $item):
                                $itemBaseHref = site_menu_normalize_href($item['href'] ?? '');
                                $itemHref = $itemBaseHref;
                                $itemExternal = preg_match('#^https?://#i', $itemBaseHref) === 1;
                                $itemHrefRu = $itemBaseHref;
                                $itemHrefEn = $itemBaseHref;
                                if (!$itemExternal && is_string($itemBaseHref) && strpos($itemBaseHref, '/') === 0) {
                                    if ($itemBaseHref === '/') {
                                        $itemHrefEn = '/en';
                                    } elseif (strpos($itemBaseHref, '/en/') === 0 || $itemBaseHref === '/en') {
                                        $itemHrefEn = $itemBaseHref;
                                        $itemHrefRu = $itemBaseHref === '/en' ? '/' : substr($itemBaseHref, 3);
                                        if ($itemHrefRu === '') {
                                            $itemHrefRu = '/';
                                        }
                                    } else {
                                        $itemHrefEn = '/en' . $itemBaseHref;
                                    }
                                    $itemHref = $absLang === 'en' ? $itemHrefEn : $itemHrefRu;
                                }
                                $itemLabel = $absLang === 'en'
                                    ? (!empty($item['label_en']) ? (string) $item['label_en'] : (string) ($item['label'] ?? ''))
                                    : (string) ($item['label'] ?? '');
                                $itemLabelRu = (string) ($item['label'] ?? '');
                                $itemLabelEn = !empty($item['label_en']) ? (string) $item['label_en'] : $itemLabelRu;
                            ?>
                            <a
                                href="<?php echo htmlspecialchars($itemHref, ENT_QUOTES, 'UTF-8'); ?>"
                                class="site-footer-nav-link"
                                data-base-href="<?php echo htmlspecialchars($itemBaseHref, ENT_QUOTES, 'UTF-8'); ?>"
                                data-href-ru="<?php echo htmlspecialchars($itemHrefRu, ENT_QUOTES, 'UTF-8'); ?>"
                                data-href-en="<?php echo htmlspecialchars($itemHrefEn, ENT_QUOTES, 'UTF-8'); ?>"
                                data-label-ru="<?php echo htmlspecialchars($itemLabelRu, ENT_QUOTES, 'UTF-8'); ?>"
                                data-label-en="<?php echo htmlspecialchars($itemLabelEn, ENT_QUOTES, 'UTF-8'); ?>"
                                <?php echo $itemExternal ? ' target="_blank" rel="noopener noreferrer"' : ''; ?>
                            ><?php echo htmlspecialchars($itemLabel, ENT_QUOTES, 'UTF-8'); ?></a>
                            <?php endforeach; ?>
                        </nav>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <div class="footer-links">
                <a href="https://twitch.tv/immortal_emperor" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Twitch"><i class="fab fa-twitch" aria-hidden="true"></i><span class="social-link-label">Twitch</span></a>
                <span class="separator" aria-hidden="true">•</span>
                <a href="https://t.me/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Telegram"><i class="fab fa-telegram" aria-hidden="true"></i><span class="social-link-label">Telegram</span></a>
                <span class="separator" aria-hidden="true">•</span>
                <a href="https://vk.com/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="VK"><i class="fab fa-vk" aria-hidden="true"></i><span class="social-link-label">VK</span></a>
                <span class="separator" aria-hidden="true">•</span>
                <a href="https://www.donationalerts.com/r/chadowfriend" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Donation"><i class="fas fa-university" aria-hidden="true"></i><span class="social-link-label">Donation</span></a>
            </div>
            <div class="footer-text">
                Copyright (c) 2026 Analysis ABS replays <span class="version">ver. <span id="siteVersion"><?php echo htmlspecialchars($siteVersion); ?></span></span> by <a href="https://tanki.su/ru/community/accounts/282194247" target="_blank" rel="noopener noreferrer" class="version footer-author-link">Immortal_Emperor</a>.
            </div>
            <div class="footer-text">
                I will make them and the places all around My hill a blessing; and I will cause showers to come down in their season; there shall be showers of blessing.
            </div>
            <div class="footer-text">
                Ezekiel 34:26 (NKJV)
            </div>
        </footer>
<?php endif; ?>
        <script src="/js/datetime-local.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php if (empty($tacticsRoomShell)): ?>
        <script src="/js/background-ambient.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php endif; ?>
        <?php
        $isLandingPage = isset($bodyClass) && strpos((string) $bodyClass, 'page-landing') !== false;
        if ($isLandingPage):
        ?>
        <script src="/js/landing-i18n.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php endif; ?>
        <script src="/js/site-title.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <script src="/js/footer-menu.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <script src="/js/lang-switch.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php
        if (!isset($userLoggedIn) && empty($GLOBALS['__chadow_auth_ready'])) {
            require_once __DIR__ . '/user_bootstrap.php';
            $userLoggedIn = user_is_logged_in();
        }
        if ($userLoggedIn):
        ?>
        <script>
            window.ABS_SITE_LOGGED_IN = true;
            window.ABS_SITE_CSRF = <?php echo json_encode(user_csrf_token()); ?>;
            window.ABS_BRACKET_CLAIM_API = <?php echo json_encode(user_api_path('/api/bracket/claim.php')); ?>;
        </script>
        <script src="/js/services/bracket/guest-store.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <script src="/js/services/bracket/claim.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php endif; ?>
        <?php
        $isBracketPage = isset($bodyClass) && strpos((string) $bodyClass, 'page-bracket') !== false;
        $isRecruitingPage = isset($bodyClass) && strpos((string) $bodyClass, 'page-recruiting') !== false;
        if ($isBracketPage):
        ?>
        <script src="/js/services/bracket/access.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php endif; ?>
        <?php if ($isRecruitingPage): ?>
        <script src="/js/services/recruiting/board.js?v=<?php echo htmlspecialchars($siteVersion); ?>" defer></script>
        <?php endif; ?>
<?php if (empty($tacticsRoomShell)): ?>
    </div>
<?php endif; ?>
<?php
chadow_perf_finish('public_page');
?>
