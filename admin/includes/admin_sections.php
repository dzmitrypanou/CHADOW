<?php
/**
 * Единый список разделов админ-панели.
 *
 * @return list<array{id:string, href:string, label:string, icon:string, admin_only?:bool}>
 */
function admin_panel_sections(): array {
    return [
        [
            'id' => 'index',
            'href' => '/admin/tanks',
            'label' => 'Редактор танков',
            'icon' => 'fas fa-tools',
        ],
        [
            'id' => 'dictionaries',
            'href' => '/admin/dictionaries',
            'label' => 'Нации и типы техники',
            'icon' => 'fas fa-book',
        ],
        [
            'id' => 'pages',
            'href' => '/admin/pages',
            'label' => 'Страницы сайта',
            'icon' => 'fas fa-file-alt',
        ],
        [
            'id' => 'site-menu',
            'href' => '/admin/site-menu',
            'label' => 'Меню сайта',
            'icon' => 'fas fa-bars',
        ],
        [
            'id' => 'maps',
            'href' => '/admin/maps',
            'label' => 'Карты',
            'icon' => 'fas fa-map',
        ],
        [
            'id' => 'recruiting',
            'href' => '/admin/recruiting',
            'label' => 'Рекрутинг',
            'icon' => 'fas fa-bullhorn',
        ],
        [
            'id' => 'brackets',
            'href' => '/admin/brackets',
            'label' => 'Турнирные сетки',
            'icon' => 'fas fa-sitemap',
        ],
        [
            'id' => 'tactics-rooms',
            'href' => '/admin/tactics-rooms',
            'label' => 'Тактика: комнаты',
            'icon' => 'fas fa-chalkboard',
        ],
        [
            'id' => 'tactics-maps',
            'href' => '/admin/tactics-maps',
            'label' => 'Тактика: карты',
            'icon' => 'fas fa-map-marked-alt',
        ],
        [
            'id' => 'wgsrt',
            'href' => '/admin/wgsrt',
            'label' => 'WGSRT',
            'icon' => 'fas fa-chart-line',
        ],
        [
            'id' => 'users',
            'href' => '/admin/users',
            'label' => 'Пользователи',
            'icon' => 'fas fa-users-cog',
            'admin_only' => true,
        ],
    ];
}

function admin_panel_section_nav_label(string $id, string $fullLabel): string {
    static $short = [
        'dictionaries' => 'Нации и типы',
        'pages' => 'Страницы',
        'site-menu' => 'Меню сайта',
        'tactics-rooms' => 'Тактика',
        'tactics-maps' => 'Карты планшета',
    ];

    return $short[$id] ?? $fullLabel;
}
