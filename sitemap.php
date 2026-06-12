<?php
declare(strict_types=1);

ob_start();

require_once __DIR__ . '/includes/seo.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/ensure_cms_pages.php';

$base = abs_site_base_url();

const ABS_SITEMAP_XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * @return array{alternates:array{ru:string,en:string}}
 */
function abs_sitemap_page(string $ruPath, string $enPath): array
{
    return [
        'alternates' => [
            'ru' => abs_absolute_url($ruPath),
            'en' => abs_absolute_url($enPath),
        ],
    ];
}

function abs_sitemap_xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
}

$pages = [
    abs_sitemap_page('/', '/en'),
    abs_sitemap_page('/services/abs', '/en/services/abs'),
    abs_sitemap_page('/services/online', '/en/services/online'),
    abs_sitemap_page('/services/recruiting', '/en/services/recruiting'),
    abs_sitemap_page('/services/bracket', '/en/services/bracket'),
    abs_sitemap_page('/services/tactics', '/en/services/tactics'),
    abs_sitemap_page('/services/tactics/rooms', '/en/services/tactics/rooms'),
];

try {
    $db = Database::getInstance();
    ensure_cms_pages_table($db);
    $rows = $db->fetchAll(
        'SELECT slug FROM cms_pages WHERE is_published = 1 ORDER BY slug ASC'
    );

    foreach ($rows as $row) {
        $slug = isset($row['slug']) ? trim((string) $row['slug']) : '';
        if ($slug === '' || !preg_match('/^[a-z0-9\-]{1,128}$/', $slug)) {
            continue;
        }

        $pages[] = abs_sitemap_page('/' . $slug, '/en/' . $slug);
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

    foreach ([$ru, $en] as $loc) {
        echo "  <url>\n";
        echo '    <loc>' . abs_sitemap_xml_escape($loc) . "</loc>\n";
        echo '    <xhtml:link rel="alternate" hreflang="ru" href="' . abs_sitemap_xml_escape($ru) . "\" />\n";
        echo '    <xhtml:link rel="alternate" hreflang="en" href="' . abs_sitemap_xml_escape($en) . "\" />\n";
        echo "  </url>\n";
    }
}

echo "</urlset>\n";
exit;
