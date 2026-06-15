(() => {
    'use strict';

    const STRINGS = {
        ru: {
            open: 'Открыть',
            inDev: 'в разработке',
            testVersion: 'Тестовая версия',
            cards: {
                abs: {
                    title: 'Анализ АБС реплеев',
                    desc: 'Загрузка реплеев, статистика команды, WGSRT и метрики боёв.',
                },
                recruiting: {
                    title: 'Рекрутинг',
                    desc: 'Поиск команды, клана, игроков в клан и команду.',
                },
                online: {
                    title: 'Статус серверов',
                    desc: 'Статус доступности серверов, онлайн и графики.',
                },
                tactics: {
                    title: 'Тактический планшет',
                    desc: 'Совместное планирование тактик на картах — открытые и закрытые комнаты.',
                    createLabel: 'Создать планшет',
                    roomsLabel: 'Открытые комнаты',
                },
                'clan-reserve': {
                    title: 'Автоматическое включение клановых резервов',
                    desc: 'Автоматическое включение клановых резервов по расписанию.',
                },
                bracket: {
                    title: 'Генератор турнирных сеток',
                    desc: 'Создание и редактирование турнирных сеток для клановых и командных ивентов.',
                    createLabel: 'Создать сетку',
                    publicLabel: 'Публичные сетки',
                },
                'mod-install': {
                    title: 'Установка модов',
                    desc: 'Пошаговая установка и настройка модов для World of Tanks и Мира танков.',
                },
                'aim-trainers': {
                    title: 'Аим-тренажеры',
                    desc: 'Мини-игры для тренировки прицеливания и реакции.',
                },
                'online-games': {
                    title: 'Онлайн игры',
                    desc: 'Играйте с друзьями в реальном времени — настольные игры и не только.',
                },
                'games-launcher': {
                    title: 'Chadow Games Launcher',
                    desc: 'С помощью лаунчера можно играть на сервере «Chadow Land» Minecraft.',
                },
            },
            hrefs: {
                abs: '/services/abs',
                recruiting: '/services/recruiting',
                online: '/services/online/',
                tactics: '/services/tactics',
                'tactics-create': '/services/tactics',
                'tactics-rooms': '/services/tactics/rooms',
                bracket: '/services/bracket',
                'bracket-create': '/services/bracket/create',
                'bracket-public': '/services/bracket',
                'aim-trainers': '/services/aim',
                'online-games': '/services/onlinegames',
            },
        },
        en: {
            open: 'Open',
            inDev: 'In development',
            testVersion: 'Test version',
            cards: {
                abs: {
                    title: 'ABS Replay Analysis',
                    desc: 'Upload replays and review team statistics, WGSRT, and battle metrics.',
                },
                recruiting: {
                    title: 'Recruiting',
                    desc: 'Search for teams, clans, and players for clan and team.',
                },
                online: {
                    title: 'Server Status',
                    desc: 'Server availability status, online counts, and charts.',
                },
                tactics: {
                    title: 'Tactical Board',
                    desc: 'Plan tactics together on map overlays — open or password-protected rooms.',
                    createLabel: 'Create board',
                    roomsLabel: 'Open rooms',
                },
                'clan-reserve': {
                    title: 'Automatic Clan Reserve Activation',
                    desc: 'Scheduled automatic activation of clan reserves.',
                },
                bracket: {
                    title: 'Tournament Bracket Generator',
                    desc: 'Create and edit tournament brackets for clan and team events.',
                    createLabel: 'Create bracket',
                    publicLabel: 'Public brackets',
                },
                'mod-install': {
                    title: 'Mod Installation',
                    desc: 'Step-by-step mod installation and setup for World of Tanks and Mir Tankov.',
                },
                'aim-trainers': {
                    title: 'Aim Trainer Games',
                    desc: 'Mini-games for aim and reaction training.',
                },
                'online-games': {
                    title: 'Online Games',
                    desc: 'Play with friends in real time — board games and more.',
                },
                'games-launcher': {
                    title: 'Chadow Games Launcher',
                    desc: 'With the launcher you can play on the “Chadow Land” Minecraft server.',
                },
            },
            hrefs: {
                abs: '/en/services/abs',
                recruiting: '/en/services/recruiting',
                online: '/en/services/online/',
                tactics: '/en/services/tactics',
                'tactics-create': '/en/services/tactics',
                'tactics-rooms': '/en/services/tactics/rooms',
                bracket: '/en/services/bracket',
                'bracket-create': '/en/services/bracket/create',
                'bracket-public': '/en/services/bracket',
                'aim-trainers': '/en/services/aim',
                'online-games': '/en/services/onlinegames',
            },
        },
    };

    const MULTI_ACTION_CARDS = {
        tactics: [
            { action: 'create', hrefKey: 'tactics-create', labelKey: 'createLabel' },
            { action: 'rooms', hrefKey: 'tactics-rooms', labelKey: 'roomsLabel' },
        ],
        bracket: [
            { action: 'create', hrefKey: 'bracket-create', labelKey: 'createLabel' },
            { action: 'public', hrefKey: 'bracket-public', labelKey: 'publicLabel' },
        ],
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_LANG = normalized;
        return normalized;
    }

    function getLang() {
        return normalizeLang(window.ABS_LANG);
    }

    function setActionLabel(actionEl, text) {
        const icon = actionEl.querySelector('i');
        actionEl.textContent = '';
        actionEl.append(document.createTextNode(text));
        if (icon) {
            actionEl.appendChild(document.createTextNode(' '));
            actionEl.appendChild(icon);
        }
    }

    function updateCard(cardEl, lang) {
        const id = cardEl.getAttribute('data-landing-id');
        if (!id) return;

        const dict = STRINGS[lang];
        const card = dict.cards[id];
        if (!card) return;

        const titleEl = cardEl.querySelector('.project-card-title-text');
        if (titleEl) titleEl.textContent = card.title;

        const descEl = cardEl.querySelector('.project-card-desc');
        if (descEl) descEl.textContent = card.desc;

        const multiActions = MULTI_ACTION_CARDS[id];
        if (multiActions) {
            multiActions.forEach(({ action, hrefKey, labelKey }) => {
                const actionEl = cardEl.querySelector(`[data-landing-action="${action}"]`);
                if (!actionEl) return;
                actionEl.href = dict.hrefs[hrefKey];
                setActionLabel(actionEl, card[labelKey]);
            });
        } else {
            const href = dict.hrefs[id];
            if (href && cardEl.tagName === 'A') {
                cardEl.href = href;
            }

            const actionEl = cardEl.querySelector('.project-card-action');
            if (actionEl && !actionEl.classList.contains('project-card-action--placeholder')) {
                setActionLabel(actionEl, dict.open);
            }
        }

        cardEl.querySelectorAll('.project-card-badge').forEach((badge) => {
            if (badge.classList.contains('project-card-badge--test')) {
                badge.textContent = dict.testVersion;
            } else if (cardEl.classList.contains('project-card--disabled')
                && !badge.classList.contains('project-card-badge--cs2')
                && !badge.classList.contains('project-card-badge--dota2')
                && !badge.classList.contains('project-card-badge--wg')
                && !badge.classList.contains('project-card-badge--lesta')
                && badge.textContent.trim() !== 'WG'
                && badge.textContent.trim() !== 'LESTA') {
                badge.textContent = dict.inDev;
            }
        });
    }

    function updateStaticDom(lang) {
        const normalized = normalizeLang(lang);
        document.querySelectorAll('[data-landing-id]').forEach((card) => {
            updateCard(card, normalized);
        });
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        updateStaticDom(normalized);
        window.dispatchEvent(new CustomEvent('landing:langchange', { detail: { lang: normalized } }));
        return normalized;
    }

    window.AbsLandingI18n = {
        STRINGS,
        normalizeLang,
        getLang,
        setLang,
        updateStaticDom,
        switchLanguage,
    };
})();
