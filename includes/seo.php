<?php

function abs_request_scheme(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $forwardedProto = strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']);
        if ($forwardedProto === 'https' || $forwardedProto === 'http') {
            $scheme = $forwardedProto;
        }
    }

    return $scheme;
}

function abs_request_host(): string
{
    return isset($_SERVER['HTTP_HOST']) && is_string($_SERVER['HTTP_HOST'])
        ? trim($_SERVER['HTTP_HOST'])
        : '';
}

function abs_site_host(): string
{
    $host = abs_request_host();
    if ($host === '') {
        return '';
    }
    if (preg_match('/^www\.(.+)$/i', $host, $matches)) {
        return $matches[1];
    }

    return $host;
}

function abs_redirect_www_to_apex(): void
{
    static $checked = false;
    if ($checked || PHP_SAPI === 'cli') {
        return;
    }
    $checked = true;

    $host = abs_request_host();
    if (!preg_match('/^www\.chadow\.ru$/i', $host)) {
        return;
    }

    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    if (!is_string($uri) || $uri === '') {
        $uri = '/';
    }

    header('Location: https://chadow.ru' . $uri, true, 301);
    exit;
}

function abs_site_base_url(): string
{
    $host = abs_site_host();
    if ($host === '') {
        return '';
    }

    return abs_request_scheme() . '://' . $host;
}

function abs_absolute_url(string $path): string
{
    $path = trim($path);
    if ($path === '') {
        return abs_site_base_url() !== '' ? abs_site_base_url() . '/' : '/';
    }
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    if ($path[0] !== '/') {
        $path = '/' . $path;
    }

    $base = abs_site_base_url();
    return $base !== '' ? ($base . $path) : $path;
}

function abs_seo_truncate(string $text, int $maxLength = 160): string
{
    $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');
    if ($text === '') {
        return '';
    }
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text, 'UTF-8') <= $maxLength) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $maxLength - 1, 'UTF-8')) . '…';
    }

    if (strlen($text) <= $maxLength) {
        return $text;
    }

    return rtrim(substr($text, 0, $maxLength - 1)) . '…';
}

function abs_seo_format_title(string $title, string $siteName): string
{
    $title = trim($title);
    $siteName = trim($siteName);
    if ($title === '' || $siteName === '' || $title === $siteName) {
        return $title !== '' ? $title : $siteName;
    }
    if (stripos($title, $siteName) !== false) {
        return $title;
    }

    return $title . ' | ' . $siteName;
}

/**
 * @return array{ru:string,en:string}
 */
function abs_seo_lang_paths(string $slug): array
{
    if (!function_exists('abs_build_lang_href')) {
        require_once __DIR__ . '/lang.php';
    }

    $slug = trim($slug, '/');

    return [
        'ru' => abs_build_lang_href('ru', $slug),
        'en' => abs_build_lang_href('en', $slug),
    ];
}

/**
 * @return array{canonical:string,alternate_ru:string,alternate_en:string}
 */
function abs_seo_page_urls(string $lang, string $slug): array
{
    $paths = abs_seo_lang_paths($slug);
    $lang = $lang === 'en' ? 'en' : 'ru';

    return [
        'canonical' => abs_absolute_url($paths[$lang]),
        'alternate_ru' => abs_absolute_url($paths['ru']),
        'alternate_en' => abs_absolute_url($paths['en']),
    ];
}

/**
 * @return array<string, mixed>
 */
function abs_seo_default_json_ld(string $siteName, string $lang, string $canonicalUrl = ''): array
{
    $base = abs_site_base_url();
    $data = [
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'name' => $siteName,
        'url' => $base !== '' ? ($base . '/') : '/',
        'inLanguage' => $lang === 'en' ? 'en' : 'ru',
    ];
    if ($canonicalUrl !== '') {
        $data['mainEntityOfPage'] = $canonicalUrl;
    }

    return $data;
}

/**
 * @return array<string, mixed>
 */
function abs_seo_web_page_json_ld(
    string $name,
    string $description,
    string $canonicalUrl,
    string $lang,
    string $siteName = ''
): array {
    $siteName = trim($siteName);
    $siteUrl = abs_site_base_url() !== '' ? (abs_site_base_url() . '/') : '/';

    return [
        '@context' => 'https://schema.org',
        '@type' => 'WebPage',
        'name' => $name,
        'description' => $description,
        'url' => $canonicalUrl,
        'inLanguage' => $lang === 'en' ? 'en' : 'ru',
        'isPartOf' => [
            '@type' => 'WebSite',
            'name' => $siteName !== '' ? $siteName : $name,
            'url' => $siteUrl,
        ],
    ];
}

/**
 * @param array<int, array<string, mixed>> $items
 * @return array<string, mixed>
 */
function abs_seo_json_ld_graph(array $items): array
{
    return [
        '@context' => 'https://schema.org',
        '@graph' => array_values($items),
    ];
}

/**
 * @return array<string, mixed>
 */
function abs_seo_software_app_json_ld(
    string $name,
    string $description,
    string $url,
    string $lang,
    string $category = 'GameApplication'
): array {
    return [
        '@type' => 'SoftwareApplication',
        'name' => $name,
        'description' => $description,
        'url' => $url,
        'applicationCategory' => $category,
        'operatingSystem' => 'Web',
        'offers' => [
            '@type' => 'Offer',
            'price' => '0',
            'priceCurrency' => 'USD',
        ],
        'inLanguage' => $lang === 'en' ? 'en' : 'ru',
    ];
}

/**
 * @param array<int, array{name:string,url:string}> $items
 * @return array<string, mixed>
 */
function abs_seo_breadcrumb_json_ld(array $items): array
{
    $list = [];
    foreach ($items as $index => $item) {
        $name = trim((string) ($item['name'] ?? ''));
        $url = trim((string) ($item['url'] ?? ''));
        if ($name === '' || $url === '') {
            continue;
        }
        $list[] = [
            '@type' => 'ListItem',
            'position' => count($list) + 1,
            'name' => $name,
            'item' => $url,
        ];
    }

    return [
        '@type' => 'BreadcrumbList',
        'itemListElement' => $list,
    ];
}

/**
 * @param array<string, mixed> $webPage
 * @param array<int, array<string, mixed>> $extra
 * @return array<string, mixed>
 */
function abs_seo_page_graph_json_ld(array $webPage, array $extra = []): array
{
    $items = [$webPage];
    foreach ($extra as $node) {
        if (is_array($node) && $node !== []) {
            $items[] = $node;
        }
    }

    return abs_seo_json_ld_graph($items);
}

abs_redirect_www_to_apex();
