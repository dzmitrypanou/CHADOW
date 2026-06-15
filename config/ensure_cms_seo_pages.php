<?php
/**
 * Seed SEO-oriented CMS pages when missing (does not overwrite existing slugs).
 *
 * @param Database $db
 */
function ensure_cms_seo_pages($db): void
{
    ensure_cms_pages_table($db);

    $pages = [
        [
            'slug' => 'about',
            'title' => 'О проекте Chadow',
            'title_en' => 'About Chadow',
            'body_html' => '<h2>Что такое Chadow</h2><p>Chadow — портал бесплатных онлайн-инструментов для игроков World of Tanks и смежных дисциплин: анализ АБС-реплеев, тактический планшет, рекрутинг, турнирные сетки и тренажёры прицела.</p><h2>Для кого</h2><p>Сервисы рассчитаны на кланы, командиров взводов и отдельных игроков, которым нужны быстрые инструменты без установки дополнительного ПО — всё работает в браузере.</p><h2>Сервисы</h2><ul><li><a href="/services/abs">Анализ АБС реплеев</a> — статистика команды и WGSRT.</li><li><a href="/services/tactics">Тактический планшет</a> — совместное планирование на картах.</li><li><a href="/services/aim">Аим-тренажёры</a> — flick, tracking, gridshot и другие режимы.</li><li><a href="/services/recruiting">Рекрутинг</a> — объявления и поиск игроков.</li><li><a href="/services/bracket">Турнирные сетки</a> — создание и публикация bracket.</li></ul>',
            'body_html_en' => '<h2>What is Chadow</h2><p>Chadow is a hub of free online tools for World of Tanks players and related games: ABS replay analysis, tactical board, recruiting, tournament brackets, and aim trainers.</p><h2>Who it is for</h2><p>Clans, platoon leaders, and solo players who need fast browser-based utilities without extra software.</p><h2>Services</h2><ul><li><a href="/en/services/abs">ABS replay analysis</a> — team stats and WGSRT.</li><li><a href="/en/services/tactics">Tactical board</a> — collaborative map planning.</li><li><a href="/en/services/aim">Aim trainers</a> — flick, tracking, gridshot, and more.</li><li><a href="/en/services/recruiting">Recruiting</a> — posts and player search.</li><li><a href="/en/services/bracket">Tournament brackets</a> — create and share brackets.</li></ul>',
        ],
        [
            'slug' => 'faq',
            'title' => 'Частые вопросы',
            'title_en' => 'FAQ',
            'body_html' => '<h2>Анализ реплеев (ABS)</h2><h3>Какие форматы поддерживаются?</h3><p>Файлы <code>.mtreplay</code> и <code>.wotreplay</code>. Загрузите их на странице <a href="/services/abs">Анализ АБС реплеев</a>.</p><h3>Нужна ли регистрация?</h3><p>Нет, базовый анализ доступен без входа. Сохранение реплеев на сервере — по вашему согласию.</p><h2>Тактический планшет</h2><h3>Как создать комнату?</h3><p>Откройте <a href="/services/tactics">тактический планшет</a>, задайте название и при необходимости пароль. Ссылку можно отправить команде.</p><h2>Аим-тренажёры</h2><h3>Зачем тренироваться в браузере?</h3><p>Режимы flick, tracking и gridshot помогают разогреть реакцию и точность. Результаты попадают в <a href="/services/aim/ratings">общий рейтинг</a>.</p><h2>Общее</h2><h3>Есть ли английская версия?</h3><p>Да, переключатель RU / EN в шапке сайта.</p>',
            'body_html_en' => '<h2>ABS replay analysis</h2><h3>Which formats are supported?</h3><p><code>.mtreplay</code> and <code>.wotreplay</code> files. Upload them on the <a href="/en/services/abs">ABS replay analysis</a> page.</p><h3>Do I need an account?</h3><p>No for basic analysis. Server-side replay storage is optional and requires your consent.</p><h2>Tactical board</h2><h3>How do I create a room?</h3><p>Open the <a href="/en/services/tactics">tactical board</a>, set a title and optional password, then share the link with your team.</p><h2>Aim trainers</h2><h3>Why train in the browser?</h3><p>Flick, tracking, and gridshot modes help warm up aim and reaction. Scores appear on the <a href="/en/services/aim/ratings">global leaderboard</a>.</p><h2>General</h2><h3>Is English available?</h3><p>Yes — use the RU / EN switcher in the site header.</p>',
        ],
        [
            'slug' => 'abs-guide',
            'title' => 'Как анализировать реплеи',
            'title_en' => 'How to analyze replays',
            'body_html' => '<h2>Шаг 1. Подготовьте файлы</h2><p>Найдите реплеи боя в папке World of Tanks или экспортируйте из клиента. Поддерживаются <code>.mtreplay</code> (мод АБС) и <code>.wotreplay</code>.</p><h2>Шаг 2. Загрузка</h2><p>Перейдите в <a href="/services/abs">Анализ АБС реплеев</a> и перетащите файлы в зону загрузки или выберите их вручную. Максимальный размер одного файла — 10 МБ.</p><h2>Шаг 3. Разбор статистики</h2><p>После обработки вы увидите сводку по команде: урон, фраги, попадания, рейтинг WGSRT и детальные метрики по игрокам. Сравнивайте несколько боёв подряд, чтобы отслеживать прогресс клана.</p><h2>Советы</h2><ul><li>Загружайте реплеи одного состава — так проще сравнивать результаты.</li><li>Используйте фильтры и сортировку в таблице для поиска слабых мест.</li><li>Подробнее — в разделе <a href="/faq">Частые вопросы</a>.</li></ul>',
            'body_html_en' => '<h2>Step 1. Prepare files</h2><p>Locate battle replays in your World of Tanks folder or export from the client. Supported formats: <code>.mtreplay</code> (ABS mod) and <code>.wotreplay</code>.</p><h2>Step 2. Upload</h2><p>Open <a href="/en/services/abs">ABS replay analysis</a> and drag files into the upload area or pick them manually. Maximum file size is 10 MB per replay.</p><h2>Step 3. Review stats</h2><p>After processing you get a team summary: damage, frags, hits, WGSRT rating, and per-player metrics. Upload several battles in a row to track clan progress.</p><h2>Tips</h2><ul><li>Upload replays from the same roster for easier comparison.</li><li>Use table sorting to spot weak spots quickly.</li><li>More answers in the <a href="/en/faq">FAQ</a>.</li></ul>',
        ],
        [
            'slug' => 'tactics-guide',
            'title' => 'Как пользоваться тактическим планшетом',
            'title_en' => 'How to use the tactical board',
            'body_html' => '<h2>Создание комнаты</h2><p>На странице <a href="/services/tactics">Тактический планшет</a> нажмите «Создать планшет», введите название и при необходимости пароль. Скопируйте ссылку и отправьте команде в Discord или голосовой чат.</p><h2>Работа на карте</h2><p>Выберите карту из каталога, расставьте маркеры, маршруты и зоны. Все участники видят изменения в реальном времени — удобно для разбора расстановки перед боем.</p><h2>Открытые комнаты</h2><p>Список публичных сессий доступен в <a href="/services/tactics/rooms">Открытых комнатах</a>. Можно присоединиться без приглашения, если комната не защищена паролем.</p><h2>Советы командиру</h2><ul><li>Заранее подготовьте сценарий на нескольких картах из ротации.</li><li>Используйте пароль для закрытых разборов.</li><li>Сочетайте планшет с <a href="/services/abs">анализом реплеев</a> после тренировочных боёв.</li></ul>',
            'body_html_en' => '<h2>Create a room</h2><p>On the <a href="/en/services/tactics">Tactical board</a> page click create, set a title and optional password. Share the link with your team in Discord or voice chat.</p><h2>Map workflow</h2><p>Pick a map from the catalog, place markers, routes, and zones. Everyone sees updates in real time — ideal for pre-battle setups.</p><h2>Open rooms</h2><p>Public sessions are listed under <a href="/en/services/tactics/rooms">Open rooms</a>. You can join without an invite if the room has no password.</p><h2>Tips for callers</h2><ul><li>Prepare setups for several maps from the current rotation.</li><li>Use a password for private reviews.</li><li>Combine the board with <a href="/en/services/abs">replay analysis</a> after scrims.</li></ul>',
        ],
    ];

    foreach ($pages as $page) {
        $slug = (string) $page['slug'];
        $existing = $db->fetchOne('SELECT id FROM cms_pages WHERE slug = ?', [$slug]);
        if ($existing) {
            continue;
        }

        $db->query(
            'INSERT INTO cms_pages (slug, title, title_en, body_html, body_html_en, is_published)
             VALUES (?, ?, ?, ?, ?, 1)',
            [
                $slug,
                $page['title'],
                $page['title_en'],
                $page['body_html'],
                $page['body_html_en'],
            ]
        );
    }
}
