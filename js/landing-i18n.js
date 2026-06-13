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
                },
                'clan-reserve': {
                    title: 'Автоматическое включение клановых резервов',
                    desc: 'Автоматическое включение клановых резервов по расписанию.',
                },
                bracket: {
                    title: 'Генератор турнирных сеток',
                    desc: 'Создание и редактирование турнирных сеток для клановых и командных ивентов.',
                },
                'mod-install': {
                    title: 'Установка модов',
                    desc: 'Пошаговая установка и настройка модов для World of Tanks и Мира танков.',
                },
                'aim-trainers': {
                    title: 'Aim тренажёры',
                    desc: 'Мини-игры для тренировки прицеливания и реакции.',
                },
            },
            hrefs: {
                abs: '/services/abs',
                recruiting: '/services/recruiting',
                online: '/services/online/',
                tactics: '/services/tactics',
                bracket: '/services/bracket',
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
                },
                'clan-reserve': {
                    title: 'Automatic Clan Reserve Activation',
                    desc: 'Scheduled automatic activation of clan reserves.',
                },
                bracket: {
                    title: 'Tournament Bracket Generator',
                    desc: 'Create and edit tournament brackets for clan and team events.',
                },
                'mod-install': {
                    title: 'Mod Installation',
                    desc: 'Step-by-step mod installation and setup for World of Tanks and Mir Tankov.',
                },
                'aim-trainers': {
                    title: 'Aim Trainer Games',
                    desc: 'Mini-games for aim and reaction training.',
                },
            },
            hrefs: {
                abs: '/en/services/abs',
                recruiting: '/en/services/recruiting',
                online: '/en/services/online/',
                tactics: '/en/services/tactics',
                bracket: '/en/services/bracket',
            },
        },
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

        const href = dict.hrefs[id];
        if (href && cardEl.tagName === 'A') {
            cardEl.href = href;
        }

        const actionEl = cardEl.querySelector('.project-card-action');
        if (actionEl && !actionEl.classList.contains('project-card-action--placeholder')) {
            const icon = actionEl.querySelector('i');
            actionEl.textContent = '';
            if (icon) actionEl.appendChild(icon);
            actionEl.append(` ${dict.open}`);
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
