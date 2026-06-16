<?php

function admin_panel_sections(): array {
    return [
        [
            'id' => 'index',
            'href' => '/admin/tanks',
            'label' => 'Редактор названий танков',
            'icon' => 'fas fa-tools',
        ],
        [
            'id' => 'dictionaries',
            'href' => '/admin/dictionaries',
            'label' => 'Справочники наций и типов техники',
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
            'label' => 'Редактор названий карт',
            'icon' => 'fas fa-map',
        ],
        [
            'id' => 'recruiting',
            'href' => '/admin/recruiting',
            'label' => 'Модерация рекрутинга',
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
            'label' => 'Тактический планшет — комнаты',
            'icon' => 'fas fa-chalkboard',
        ],
        [
            'id' => 'tactics-maps',
            'href' => '/admin/tactics-maps',
            'label' => 'Тактический планшет — карты',
            'icon' => 'fas fa-map-marked-alt',
        ],
        [
            'id' => 'aim-leaderboards',
            'href' => '/admin/aim-leaderboards',
            'label' => 'Аим-тренажёры — таблицы лидеров',
            'icon' => 'fas fa-trophy',
        ],
        [
            'id' => 'minecraft',
            'href' => '/admin/minecraft',
            'label' => 'Chadow Games Launcher',
            'icon' => 'fas fa-cube',
            'admin_only' => true,
        ],
        [
            'id' => 'wgsrt',
            'href' => '/admin/wgsrt',
            'label' => 'WGSRT Редактор',
            'icon' => 'fas fa-chart-line',
        ],
        [
            'id' => 'users',
            'href' => '/admin/users',
            'label' => 'Пользователи админ-панели',
            'icon' => 'fas fa-users-cog',
            'admin_only' => true,
        ],
    ];
}
