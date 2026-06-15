<?php
declare(strict_types=1);

ob_start();

require_once __DIR__ . '/includes/seo.php';
require_once __DIR__ . '/includes/aim_helpers.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/ensure_cms_pages.php';
require_once __DIR__ . '/config/ensure_cms_seo_pages.php';

$base = abs_site_base_url();

const ABS_SITEMAP_XHTML_NS = 'http://www.w3.org/1999/xhtml';

function abs_sitemap_lastmod_from_file(string $relativePath): string
{
    $path = __DIR__ . $relativePath;
    if (is_file($path)) {
        return gmdate('Y-m-d', (int) filemtime($path));
    }

    return gmdate('Y-m-d');
}

function abs_sitemap_lastmod_from_version(): string
{
    $raw = @file_get_contents(__DIR__ . '/config/version.json');
    $data = $raw ? json_decode($raw, true) : null;
    if (is_array($data) && !empty($data['built_at']) && is_string($data['built_at'])) {
        $ts = strtotime($data['built_at']);
        if ($ts !== false) {
            return gmdate('Y-m-d', $ts);
        }
    }

    return abs_sitemap_lastmod_from_file('/config/version.json');
}

/**
 * @return array{alternates:array{ru:string,en:string},lastmod?:string}
 */
function abs_sitemap_page(string $ruPath, string $enPath, ?string $lastmod = null): array
{
    $page = [
        'alternates' => [
            'ru' => abs_absolute_url($ruPath),
            'en' => abs_absolute_url($enPath),
        ],
    ];
    if ($lastmod !== null && trim($lastmod) !== '') {
        $page['lastmod'] = trim($lastmod);
    }

    return $page;
}

function abs_sitemap_xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
}

$deployLastmod = abs_sitemap_lastmod_from_version();

$pages = [
    abs_sitemap_page('/', '/en', abs_sitemap_lastmod_from_file('/index.php')),
    abs_sitemap_page('/services/abs', '/en/services/abs', abs_sitemap_lastmod_from_file('/services/abs/index.php')),
    abs_sitemap_page('/services/online', '/en/services/online', abs_sitemap_lastmod_from_file('/services/online/index.php')),
    abs_sitemap_page('/services/recruiting', '/en/services/recruiting', abs_sitemap_lastmod_from_file('/services/recruiting/index.php')),
    abs_sitemap_page('/services/bracket', '/en/services/bracket', abs_sitemap_lastmod_from_file('/services/bracket/index.php')),
    abs_sitemap_page('/services/tactics', '/en/services/tactics', abs_sitemap_lastmod_from_file('/services/tactics/index.php')),
    abs_sitemap_page('/services/tactics/rooms', '/en/services/tactics/rooms', abs_sitemap_lastmod_from_file('/services/tactics/rooms.php')),
    abs_sitemap_page('/services/aim', '/en/services/aim', abs_sitemap_lastmod_from_file('/services/aim/index.php')),
    abs_sitemap_page('/services/aim/ratings', '/en/services/aim/ratings', abs_sitemap_lastmod_from_file('/services/aim/ratings.php')),
    abs_sitemap_page('/services/onlinegames', '/en/services/onlinegames', abs_sitemap_lastmod_from_file('/services/onlinegames/index.php')),
    abs_sitemap_page('/services/onlinegames/checkers', '/en/services/onlinegames/checkers', abs_sitemap_lastmod_from_file('/services/onlinegames/checkers/index.php')),
];

foreach (AIM_TRAINERS as $trainer) {
    $pages[] = abs_sitemap_page(
        '/services/aim/' . $trainer,
        '/en/services/aim/' . $trainer,
        abs_sitemap_lastmod_from_file('/services/aim/play.php')
    );
}

try {
    $db = Database::getInstance();
    ensure_cms_pages_table($db);
    ensure_cms_seo_pages($db);
    $rows = $db->fetchAll(
        'SELECT slug, updated_at FROM cms_pages WHERE is_published = 1 ORDER BY slug ASC'
    );

    foreach ($rows as $row) {
        $slug = isset($row['slug']) ? trim((string) $row['slug']) : '';
        if ($slug === '' || !preg_match('/^[a-z0-9\-]{1,128}$/', $slug)) {
            continue;
        }

        $lastmod = $deployLastmod;
        if (!empty($row['updated_at'])) {
            $ts = strtotime((string) $row['updated_at']);
            if ($ts !== false) {
                $lastmod = gmdate('Y-m-d', $ts);
            }
        }

        $pages[] = abs_sitemap_page('/' . $slug, '/en/' . $slug, $lastmod);
    }
} catch (Throwable $e) {
    // Keep sitemap available even if DB is temporarily unavailable.
}

ob_end_clean();

header('Content-Type: text/xml; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

if ($base === '') {
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>' . "\n";
    exit;
}

echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="' . ABS_SITEMAP_XHTML_NS . "\">\n";

foreach ($pages as $page) {
    $alternates = $page['alternates'] ?? [];
    $ru = (string) ($alternates['ru'] ?? '');
    $en = (string) ($alternates['en'] ?? '');
    if ($ru === '' || $en === '') {
        continue;
    }
    $lastmod = isset($page['lastmod']) ? trim((string) $page['lastmod']) : '';

    foreach ([$ru, $en] as $loc) {
        echo "  <url>\n";
        echo '    <loc>' . abs_sitemap_xml_escape($loc) . "</loc>\n";
        if ($lastmod !== '') {
            echo '    <lastmod>' . abs_sitemap_xml_escape($lastmod) . "</lastmod>\n";
        }
        echo '    <xhtml:link rel="alternate" hreflang="ru" href="' . abs_sitemap_xml_escape($ru) . "\" />\n";
        echo '    <xhtml:link rel="alternate" hreflang="en" href="' . abs_sitemap_xml_escape($en) . "\" />\n";
        echo "  </url>\n";
    }
}

echo "</urlset>\n";
exit;
