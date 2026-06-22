<?php

if (!headers_sent()) {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    $pubSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    if ($pubSecure) {
        header('Strict-Transport-Security: max-age=31536000');
    }
}

if (!isset($extraHeadHtml)) {
    $extraHeadHtml = '';
}

require_once __DIR__ . '/asset_tags.php';
require_once __DIR__ . '/../includes/perf_metrics.php';
chadow_perf_start('public_page');
require_once __DIR__ . '/lang.php';
require_once __DIR__ . '/seo.php';
$absLang = abs_detect_lang();
$htmlLang = $absLang === 'en' ? 'en' : 'ru';

if (!isset($siteVersion)) {
    if (!isset($GLOBALS['__chadow_site_version'])) {
        $_svRaw = @file_get_contents(__DIR__ . '/../config/version.json');
        $_svData = $_svRaw ? json_decode($_svRaw, true) : null;
        $GLOBALS['__chadow_site_version'] = (is_array($_svData) && !empty($_svData['version'])) ? $_svData['version'] : '3.4.4';
    }
    $siteVersion = $GLOBALS['__chadow_site_version'];
}
$bodyClass = isset($bodyClass) ? trim((string) $bodyClass) : '';
$metaDescription = isset($metaDescription) && trim((string) $metaDescription) !== ''
    ? trim((string) $metaDescription)
    : ($absLang === 'en'
        ? 'Chadow project hub: ABS replay analysis, recruiting tools, and more.'
        : 'Портал проектов Chadow: анализ АБС реплеев, рекрутинг и другие сервисы.');
$metaRobots = isset($metaRobots) && trim((string) $metaRobots) !== ''
    ? trim((string) $metaRobots)
    : 'index,follow';
$siteNameRu = 'Chadow';
$siteNameEn = 'Chadow';
try {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../config/ensure_site_settings.php';
    $_siteSettingsDb = Database::getInstance();
    $siteNameRu = get_site_name($_siteSettingsDb, 'ru');
    $siteNameEn = get_site_name($_siteSettingsDb, 'en');
    $seoGoogleVerification = trim((string) get_site_setting($_siteSettingsDb, 'seo_google_verification', ''));
    $seoYandexVerification = trim((string) get_site_setting($_siteSettingsDb, 'seo_yandex_verification', ''));
} catch (Throwable $e) {
    $siteNameRu = 'Chadow';
    $siteNameEn = 'Chadow';
    $seoGoogleVerification = '';
    $seoYandexVerification = '';
}
if (!isset($seoGoogleVerification)) {
    $seoGoogleVerification = '';
}
if (!isset($seoYandexVerification)) {
    $seoYandexVerification = '';
}
$siteName = $absLang === 'en' ? $siteNameEn : $siteNameRu;
$pageTitleRaw = isset($pageTitle) ? trim((string) $pageTitle) : '';
if (!isset($pageTitleRu)) {
    if ($pageTitleRaw === '') {
        $pageTitleRu = $siteNameRu;
    } else {
        $pageTitleRu = $absLang === 'ru' ? $pageTitleRaw : '';
    }
}
if (!isset($pageTitleEn)) {
    if ($pageTitleRaw === '') {
        $pageTitleEn = $siteNameEn;
    } else {
        $pageTitleEn = $absLang === 'en' ? $pageTitleRaw : '';
    }
}
$pageTitleForLang = $absLang === 'en'
    ? ($pageTitleEn !== '' ? $pageTitleEn : $pageTitleRu)
    : ($pageTitleRu !== '' ? $pageTitleRu : $pageTitleEn);
if ($pageTitleForLang === '') {
    $pageTitleForLang = $siteName;
}
$pageTitle = abs_seo_format_title($pageTitleForLang, $siteName);
$siteSlugCurrent = isset($seoSlug) && trim((string) $seoSlug) !== ''
    ? trim((string) $seoSlug)
    : abs_extract_slug_from_request();
$seoUrls = abs_seo_page_urls($absLang, $siteSlugCurrent);
$canonicalUrl = isset($canonicalUrl) && trim((string) $canonicalUrl) !== ''
    ? trim((string) $canonicalUrl)
    : $seoUrls['canonical'];
$alternateRuUrl = $seoUrls['alternate_ru'];
$alternateEnUrl = $seoUrls['alternate_en'];
$ogType = isset($ogType) && trim((string) $ogType) !== '' ? trim((string) $ogType) : 'website';
$defaultOgImagePath = '/assets/seo/og-image.png';
$defaultOgImageUrl = abs_absolute_url($defaultOgImagePath);
$ogImage = isset($ogImage) && trim((string) $ogImage) !== '' ? trim((string) $ogImage) : $defaultOgImageUrl;
if ($ogImage !== '' && !preg_match('#^https?://#i', $ogImage)) {
    $ogImage = abs_absolute_url($ogImage);
}
$ogImageType = 'image/png';
if (preg_match('/\.jpe?g$/i', $ogImage)) {
    $ogImageType = 'image/jpeg';
} elseif (preg_match('/\.webp$/i', $ogImage)) {
    $ogImageType = 'image/webp';
} elseif (preg_match('/\.svg$/i', $ogImage)) {
    $ogImageType = 'image/svg+xml';
}
$twitterCard = $ogImage !== '' ? 'summary_large_image' : 'summary';
$ogLocale = $absLang === 'en' ? 'en_US' : 'ru_RU';
$ogLocaleAlternate = $absLang === 'en' ? 'ru_RU' : 'en_US';
if (isset($jsonLdData) && is_array($jsonLdData)) {
    $jsonLd = $jsonLdData;
} elseif ($siteSlugCurrent !== '') {
    $webPage = abs_seo_web_page_json_ld($pageTitle, $metaDescription, $canonicalUrl, $absLang, $siteName);
    $graphExtra = [];
    if (isset($seoSoftwareApp) && is_array($seoSoftwareApp)) {
        $appName = trim((string) ($seoSoftwareApp['name'] ?? $pageTitleForLang));
        $appDesc = trim((string) ($seoSoftwareApp['description'] ?? $metaDescription));
        $appCategory = trim((string) ($seoSoftwareApp['category'] ?? 'GameApplication'));
        if ($appName !== '') {
            $graphExtra[] = abs_seo_software_app_json_ld(
                $appName,
                $appDesc !== '' ? $appDesc : $metaDescription,
                $canonicalUrl,
                $absLang,
                $appCategory !== '' ? $appCategory : 'GameApplication'
            );
        }
    }
    if (isset($seoBreadcrumbs) && is_array($seoBreadcrumbs) && $seoBreadcrumbs !== []) {
        $graphExtra[] = abs_seo_breadcrumb_json_ld($seoBreadcrumbs);
    }
    $jsonLd = $graphExtra !== [] ? abs_seo_page_graph_json_ld($webPage, $graphExtra) : $webPage;
} else {
    $jsonLd = abs_seo_default_json_ld($siteName, $absLang, $canonicalUrl);
}

$siteMenuItems = [];
if (empty($tacticsRoomShell)) {
    try {
        require_once __DIR__ . '/../config/database.php';
        require_once __DIR__ . '/../config/ensure_site_menu.php';
        $_menuDb = Database::getInstance();
        if (!isset($GLOBALS['__chadow_site_menu_cache']) || !is_array($GLOBALS['__chadow_site_menu_cache'])) {
            $GLOBALS['__chadow_site_menu_cache'] = [];
        }
        $menuCache = &$GLOBALS['__chadow_site_menu_cache'];
        $cacheTtl = 120;
        $cacheFresh = isset($menuCache['loaded_at']) && (time() - (int) $menuCache['loaded_at']) < $cacheTtl;
        if (!$cacheFresh) {
            ensure_site_menu_table($_menuDb);
            $menuCache = [
                'loaded_at' => time(),
                'header' => $_menuDb->fetchAll(
                    "SELECT label, label_en, href FROM cms_site_menu WHERE is_enabled = 1 AND (placement = 'header' OR placement IS NULL OR placement = '') ORDER BY sort_order ASC, id ASC"
                ),
                'footer' => $_menuDb->fetchAll(
                    "SELECT label, label_en, href FROM cms_site_menu WHERE is_enabled = 1 AND placement = 'footer' ORDER BY sort_order ASC, id ASC"
                ),
            ];
        }
        $siteMenuItems = is_array($menuCache['header'] ?? null) ? $menuCache['header'] : [];
    } catch (Throwable $e) {
        $siteMenuItems = [];
    }
}

$siteLogoTextRu = $siteNameRu;
$siteLogoTextEn = $siteNameEn;
$siteLogoText = $siteName;
$siteSlug = abs_extract_slug_from_request();
$langRuHref = abs_build_lang_href('ru', $siteSlug);
$langEnHref = abs_build_lang_href('en', $siteSlug);
$homeRuHref = '/';
$homeEnHref = '/en';

require_once __DIR__ . '/user_bootstrap.php';

$userLoggedIn = user_is_logged_in();
$authLoginHref = $absLang === 'en' ? '/en/auth/login' : '/auth/login';
$authProfileHref = $absLang === 'en' ? '/en/auth/profile' : '/auth/profile';
$authLogoutAction = $absLang === 'en' ? '/en/auth/logout' : '/auth/logout';
$authLoginTitle = $absLang === 'en' ? 'Log in' : 'Авторизация';
$authProfileTitle = $absLang === 'en' ? 'Account' : 'Аккаунт';
$authLogoutTitle = $absLang === 'en' ? 'Log out' : 'Выйти';
$GLOBALS['__chadow_auth_ready'] = true;
?>
<!DOCTYPE html>
<html lang="<?php echo htmlspecialchars($htmlLang, ENT_QUOTES, 'UTF-8'); ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="robots" content="<?php echo htmlspecialchars($metaRobots, ENT_QUOTES, 'UTF-8'); ?>">
    <?php if ($seoGoogleVerification !== ''): ?>
    <meta name="google-site-verification" content="<?php echo htmlspecialchars($seoGoogleVerification, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <?php if ($seoYandexVerification !== ''): ?>
    <meta name="yandex-verification" content="<?php echo htmlspecialchars($seoYandexVerification, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <?php if ($canonicalUrl !== ''): ?>
    <link rel="canonical" href="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <?php if ($alternateRuUrl !== ''): ?>
    <link rel="alternate" hreflang="ru" href="<?php echo htmlspecialchars($alternateRuUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <?php if ($alternateEnUrl !== ''): ?>
    <link rel="alternate" hreflang="en" href="<?php echo htmlspecialchars($alternateEnUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="alternate" hreflang="x-default" href="<?php echo htmlspecialchars($alternateRuUrl !== '' ? $alternateRuUrl : $alternateEnUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <meta property="og:type" content="<?php echo htmlspecialchars($ogType, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:site_name" content="<?php echo htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>">
    <?php if ($canonicalUrl !== ''): ?>
    <meta property="og:url" content="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <meta property="og:locale" content="<?php echo htmlspecialchars($ogLocale, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:locale:alternate" content="<?php echo htmlspecialchars($ogLocaleAlternate, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="theme-color" content="#0A1022">
    <?php if ($ogImage !== ''): ?>
    <meta property="og:image" content="<?php echo htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <meta name="twitter:card" content="<?php echo htmlspecialchars($twitterCard, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="twitter:title" content="<?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?>">
    <meta name="twitter:description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>">
    <?php if ($ogImage !== ''): ?>
    <meta name="twitter:image" content="<?php echo htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:image:type" content="<?php echo htmlspecialchars($ogImageType, ENT_QUOTES, 'UTF-8'); ?>">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:image:alt" content="<?php echo htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8'); ?>">
    <?php endif; ?>
    <script type="application/ld+json"><?php echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
    <link rel="manifest" href="/site.webmanifest">
    <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM site map">
    <?php
    $faStylesheetHref = '/css/vendor/fontawesome.min.css?v=' . $siteVersion;
    $faLandingStylesheetHref = '/css/vendor/fontawesome-landing.min.css?v=' . $siteVersion;
    $mainStylesheetHref = '/css/style.css?v=' . $siteVersion;
    $isLandingPage = isset($bodyClass) && strpos((string) $bodyClass, 'page-landing') !== false;
    $logoWebpHref = '/assets/icons/logo-header.webp?v=' . $siteVersion;
    if (empty($tacticsRoomShell)):
    ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <?php
        chadow_emit_async_stylesheet('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        chadow_emit_async_stylesheet('https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css');
        chadow_emit_async_stylesheet($isLandingPage ? $faLandingStylesheetHref : $faStylesheetHref);
        if ($isLandingPage) {
            chadow_emit_preload($logoWebpHref, 'image', 'image/webp');
            chadow_emit_inline_landing_critical_css();
            chadow_emit_async_stylesheet($mainStylesheetHref);
        } else {
            echo '<link rel="stylesheet" href="' . htmlspecialchars($mainStylesheetHref, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        }
    else: ?>
    <?php
        chadow_emit_async_stylesheet($faStylesheetHref);
        echo '<link rel="stylesheet" href="' . htmlspecialchars($mainStylesheetHref, ENT_QUOTES, 'UTF-8') . '">' . "\n";
    endif; ?>
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png?v=<?php echo htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=<?php echo htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="shortcut icon" type="image/png" href="/favicon.png?v=<?php echo htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8'); ?>">
    <?php if (!empty($extraHeadHtml)) {
        echo $extraHeadHtml;
    } ?>
    <script>
        window.ABS_LANG = <?php echo json_encode($absLang); ?>;
        window.ABS_SITE_NAMES = <?php echo json_encode(['ru' => $siteNameRu, 'en' => $siteNameEn], JSON_UNESCAPED_UNICODE); ?>;
        window.ABS_PAGE_TITLES = <?php echo json_encode(['ru' => $pageTitleRu, 'en' => $pageTitleEn], JSON_UNESCAPED_UNICODE); ?>;
    </script>
</head>
<body<?php echo $bodyClass !== '' ? ' class="' . htmlspecialchars($bodyClass) . '"' : ''; ?>>
<?php if (empty($tacticsRoomShell)): ?>
    <div class="ambient-bg" id="ambientBg" aria-hidden="true"></div>
    <div class="container">
        <div class="header<?php echo empty($siteMenuItems) ? ' header--no-nav' : ''; ?>">
            <h1 class="site-heading">
                <span class="site-heading-main">
                    <a
                        href="<?php echo htmlspecialchars($absLang === 'en' ? $homeEnHref : $homeRuHref, ENT_QUOTES, 'UTF-8'); ?>"
                        class="site-logo-link"
                        id="siteLogoLink"
                        data-text-ru="<?php echo htmlspecialchars($siteLogoTextRu, ENT_QUOTES, 'UTF-8'); ?>"
                        data-text-en="<?php echo htmlspecialchars($siteLogoTextEn, ENT_QUOTES, 'UTF-8'); ?>"
                        data-href-ru="<?php echo htmlspecialchars($homeRuHref, ENT_QUOTES, 'UTF-8'); ?>"
                        data-href-en="<?php echo htmlspecialchars($homeEnHref, ENT_QUOTES, 'UTF-8'); ?>"
                    >
                        <picture>
                            <source
                                srcset="<?php echo htmlspecialchars($logoWebpHref, ENT_QUOTES, 'UTF-8'); ?>"
                                type="image/webp"
                            >
                            <img
                                class="site-logo-img"
                                src="/assets/icons/logo-header.png?v=<?php echo htmlspecialchars($siteVersion, ENT_QUOTES, 'UTF-8'); ?>"
                                width="230"
                                height="50"
                                alt="<?php echo htmlspecialchars($siteLogoText, ENT_QUOTES, 'UTF-8'); ?>"
                                fetchpriority="high"
                            >
                        </picture>
                    </a>
                </span>
            </h1>
            <div class="header-right">
                <?php if (!empty($siteMenuItems)): ?>
                <nav class="site-header-nav" aria-label="<?php echo $absLang === 'en' ? 'Site sections' : 'Разделы сайта'; ?>">
                    <?php foreach ($siteMenuItems as $item):
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
                        data-base-href="<?php echo htmlspecialchars($itemBaseHref, ENT_QUOTES, 'UTF-8'); ?>"
                        data-href-ru="<?php echo htmlspecialchars($itemHrefRu, ENT_QUOTES, 'UTF-8'); ?>"
                        data-href-en="<?php echo htmlspecialchars($itemHrefEn, ENT_QUOTES, 'UTF-8'); ?>"
                        data-label-ru="<?php echo htmlspecialchars($itemLabelRu, ENT_QUOTES, 'UTF-8'); ?>"
                        data-label-en="<?php echo htmlspecialchars($itemLabelEn, ENT_QUOTES, 'UTF-8'); ?>"
                        <?php echo $itemExternal ? ' target="_blank" rel="noopener noreferrer"' : ''; ?>
                    ><?php echo htmlspecialchars($itemLabel, ENT_QUOTES, 'UTF-8'); ?></a>
                    <?php endforeach; ?>
                </nav>
                <?php endif; ?>

                <div class="site-lang-switch" aria-label="Language switch">
                    <a class="site-lang-link<?php echo $absLang === 'ru' ? ' is-active' : ''; ?>" data-lang="ru" href="<?php echo htmlspecialchars($langRuHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <span class="site-lang-flag fi fi-ru" aria-hidden="true"></span> RU
                    </a>
                    <a class="site-lang-link<?php echo $absLang === 'en' ? ' is-active' : ''; ?>" data-lang="en" href="<?php echo htmlspecialchars($langEnHref, ENT_QUOTES, 'UTF-8'); ?>">
                        <span class="site-lang-flag fi fi-us" aria-hidden="true"></span> US
                    </a>
                </div>

                <div class="site-header-auth">
                    <?php if ($userLoggedIn): ?>
                    <a
                        class="site-header-icon-btn"
                        href="<?php echo htmlspecialchars($authProfileHref, ENT_QUOTES, 'UTF-8'); ?>"
                        title="<?php echo htmlspecialchars($authProfileTitle, ENT_QUOTES, 'UTF-8'); ?>"
                        aria-label="<?php echo htmlspecialchars($authProfileTitle, ENT_QUOTES, 'UTF-8'); ?>"
                    ><i class="fas fa-user" aria-hidden="true"></i></a>
                    <form class="site-header-logout-form" action="<?php echo htmlspecialchars($authLogoutAction, ENT_QUOTES, 'UTF-8'); ?>" method="post">
                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(user_csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">
                        <button
                            type="submit"
                            class="site-header-icon-btn site-header-icon-btn--logout"
                            title="<?php echo htmlspecialchars($authLogoutTitle, ENT_QUOTES, 'UTF-8'); ?>"
                            aria-label="<?php echo htmlspecialchars($authLogoutTitle, ENT_QUOTES, 'UTF-8'); ?>"
                        ><i class="fas fa-sign-out-alt" aria-hidden="true"></i></button>
                    </form>
                    <?php else: ?>
                    <a
                        class="site-header-icon-btn"
                        href="<?php echo htmlspecialchars($authLoginHref, ENT_QUOTES, 'UTF-8'); ?>"
                        title="<?php echo htmlspecialchars($authLoginTitle, ENT_QUOTES, 'UTF-8'); ?>"
                        aria-label="<?php echo htmlspecialchars($authLoginTitle, ENT_QUOTES, 'UTF-8'); ?>"
                    ><i class="fas fa-sign-in-alt" aria-hidden="true"></i></a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
<?php endif; ?>
