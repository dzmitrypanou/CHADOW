(() => {
    'use strict';

    const STRINGS = {
        ru: {
            serviceTitle: 'Аим-тренажеры',
            serviceHint: 'Выберите тренажёр, введите ник и соревнуйтесь в глобальном топе.',
            nicknameLabel: 'Ник',
            nicknamePlaceholder: 'Для топа',
            nicknameHint: 'Сохраняется в браузере. Нужен для отправки результата в топ.',
            nicknameInvalid: 'Ник: 2–32 символа (буквы, цифры, _-.).',
            leaderboardTitle: 'Таблица лидеров',
            ratingsBtn: 'Таблицы лидеров',
            leaderboardEmpty: 'Пока нет результатов.',
            leaderboardLoading: 'Загрузка…',
            leaderboardError: 'Не удалось загрузить топ.',
            rank: 'Место',
            player: 'Игрок',
            score: 'Очки',
            grade: 'Оценка',
            top3: 'Топ-3',
            fullTop: 'Весь топ',
            play: 'Играть',
            sec: 'с',
            roundsDuration: '10 раундов',
            backToHub: 'К выбору',
            clickToStart: 'Кликните в любой точку поля, чтобы начать',
            start: 'Начать',
            hudTime: 'Время',
            hudScore: 'Очки',
            yourResult: 'Ваш результат',
            submitScore: 'Сохранить',
            submitSaved: 'Сохранено',
            retry: 'Ещё раз',
            submitError: 'Не удалось сохранить результат.',
            submitNeedNickname: 'Введите ник на странице выбора тренажёров.',
            rateLimited: 'Подождите 30 секунд перед повторной отправкой.',
            hits: 'Попадания',
            misses: 'Промахи',
            accuracy: 'Точность',
            streak: 'Серия',
            onTarget: 'На цели',
            avgReaction: 'Средняя реакция',
            rounds: 'Раунды',
            earlyClicks: 'Ранние клики',
            metricMs: 'мс',
            metricPct: '%',
            distance: 'Дальность',
            distanceClose: 'Ближняя',
            distanceMid: 'Средняя',
            distanceFar: 'Дальняя',
        },
        en: {
            serviceTitle: 'Aim Trainer Games',
            serviceHint: 'Pick a trainer, enter your nickname, and compete on the global leaderboard.',
            nicknameLabel: 'Nickname',
            nicknamePlaceholder: 'For leaderboard',
            nicknameHint: 'Saved in this browser. Required to submit scores.',
            nicknameInvalid: 'Nickname: 2–32 characters (letters, digits, _-.).',
            leaderboardTitle: 'Leaderboard',
            ratingsBtn: 'Leaderboards',
            leaderboardEmpty: 'No scores yet.',
            leaderboardLoading: 'Loading…',
            leaderboardError: 'Failed to load leaderboard.',
            rank: 'Rank',
            player: 'Player',
            score: 'Score',
            grade: 'Grade',
            top3: 'Top 3',
            fullTop: 'Full top',
            play: 'Play',
            sec: 's',
            roundsDuration: '10 rounds',
            backToHub: 'All trainers',
            clickToStart: 'Click anywhere on the field to start',
            start: 'Start',
            hudTime: 'Time',
            hudScore: 'Score',
            yourResult: 'Your result',
            submitScore: 'Save',
            submitSaved: 'Saved',
            retry: 'Try again',
            submitError: 'Could not save score.',
            submitNeedNickname: 'Enter a nickname on the trainer selection page.',
            rateLimited: 'Wait 30 seconds before submitting again.',
            hits: 'Hits',
            misses: 'Misses',
            accuracy: 'Accuracy',
            streak: 'Streak',
            onTarget: 'On target',
            avgReaction: 'Avg reaction',
            rounds: 'Rounds',
            earlyClicks: 'Early clicks',
            metricMs: 'ms',
            metricPct: '%',
            distance: 'Distance',
            distanceClose: 'Close',
            distanceMid: 'Medium',
            distanceFar: 'Far',
        },
    };

    const TRAINER_LABELS = {
        ru: {
            flick: 'Снайперский клик',
            tracking: 'Сопровождение',
            reaction: 'Реакция',
            lead: 'Упреждение',
            gridshot: 'Точечная серия',
        },
        en: {
            flick: 'Flick',
            tracking: 'Tracking',
            reaction: 'Reaction',
            lead: 'Lead Shot',
            gridshot: 'Gridshot',
        },
    };

    const TRAINER_DESCS = {
        ru: {
            flick: 'Кликайте по появляющимся целям как можно быстрее и точнее.',
            tracking: 'Держите прицел на движущейся цели как можно дольше.',
            reaction: '10 раундов: дождитесь зелёного сигнала и кликните.',
            lead: 'Попадайте в зону упреждения перед движущейся целью (нажимайте ЛКМ по зеленому кругу).',
            gridshot: 'Три мелкие цели одновременно — сбивайте их подряд.',
        },
        en: {
            flick: 'Click targets as they appear — speed and accuracy matter.',
            tracking: 'Keep your crosshair on the moving target as long as possible.',
            reaction: '10 rounds: wait for green, then click as fast as you can.',
            lead: 'Hit the lead zone ahead of the moving target (left-click the green circle).',
            gridshot: 'Three small targets at once — clear them as fast as you can.',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        if (window.ABS_AIM_LANG === 'en' || window.ABS_AIM_LANG === 'ru') {
            return normalizeLang(window.ABS_AIM_LANG);
        }
        if (document.documentElement.lang === 'en') {
            return 'en';
        }
        return normalizeLang(window.ABS_LANG);
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_AIM_LANG = normalized;
        window.ABS_LANG = normalized;
        window.ABS_AIM_HUB_BASE = buildHubBase(normalized);
        window.ABS_AIM_RATINGS_BASE = buildRatingsHref(normalized);
        return normalized;
    }

    function buildHubBase(lang) {
        const normalized = normalizeLang(lang);
        return normalized === 'en' ? '/en/services/aim' : '/services/aim';
    }

    function buildRatingsHref(lang, trainerId) {
        const normalized = normalizeLang(lang);
        const base = normalized === 'en' ? '/en/services/aim/ratings' : '/services/aim/ratings';
        if (!trainerId) {
            return base;
        }
        return base + '?trainer=' + encodeURIComponent(String(trainerId));
    }

    function buildPlayHref(trainerId, lang) {
        const base = buildHubBase(lang).replace(/\/$/, '');
        return base + '/' + encodeURIComponent(String(trainerId || ''));
    }

    function t(key) {
        const lang = getLang();
        return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.ru[key] || key;
    }

    function trainerLabel(id) {
        const lang = getLang();
        const dict = TRAINER_LABELS[lang] || TRAINER_LABELS.ru;
        return dict[id] || id;
    }

    function trainerDesc(id) {
        const lang = getLang();
        const dict = TRAINER_DESCS[lang] || TRAINER_DESCS.ru;
        return dict[id] || '';
    }

    const GRADE_LABELS = {
        ru: {
            D: 'D Tier',
            C: 'C Tier',
            B: 'B Tier',
            A: 'A Tier',
            S: 'S Tier',
            SS: 'SS Tier',
            SSS: 'SSS Tier',
        },
        en: {
            D: 'D Tier',
            C: 'C Tier',
            B: 'B Tier',
            A: 'A Tier',
            S: 'S Tier',
            SS: 'SS Tier',
            SSS: 'SSS Tier',
        },
    };

    function gradeLabel(code) {
        const lang = getLang();
        const key = String(code || 'D').toUpperCase();
        const dict = GRADE_LABELS[lang] || GRADE_LABELS.ru;
        return dict[key] || key;
    }

    function gradeClass(code) {
        return 'aim-grade--' + String(code || 'D').toLowerCase();
    }

    function updateNicknameChrome() {
        const input = document.getElementById('aimNicknameInput');
        if (input) {
            input.placeholder = t('nicknamePlaceholder');
            input.title = t('nicknameHint');
        }
    }

    function updateRatingsLinks() {
        const lang = getLang();
        document.querySelectorAll('[data-aim-ratings-link]').forEach((el) => {
            const trainerId = el.getAttribute('data-trainer') || '';
            el.setAttribute('href', buildRatingsHref(lang, trainerId || null));
        });
    }

    function applyDom() {
        document.querySelectorAll('[data-aim-i18n]').forEach((el) => {
            const key = el.getAttribute('data-aim-i18n');
            if (key) {
                el.textContent = t(key);
            }
        });
        updateNicknameChrome();
        updateRatingsLinks();
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        applyDom();
        if (typeof window.absUpdateDocumentTitle === 'function') {
            window.absUpdateDocumentTitle(normalized);
        }
        window.dispatchEvent(new CustomEvent('aim:langchange', { detail: { lang: normalized } }));
        return true;
    }

    window.AbsAimI18n = {
        getLang,
        setLang,
        normalizeLang,
        t,
        trainerLabel,
        trainerDesc,
        gradeLabel,
        gradeClass,
        buildHubBase,
        buildRatingsHref,
        buildPlayHref,
        applyDom,
        switchLanguage,
    };
})();
