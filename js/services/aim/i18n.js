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
            leaderboardTitle: 'Таблицы лидеров',
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
            lbDeviceGroup: 'Топ устройства',
            lbDeviceLabel: 'Платформа',
            lbDeviceDesktop: 'ПК',
            lbDeviceMobile: 'Телефон',
            play: 'Играть',
            sec: 'с',
            roundsDuration: '10 раундов',
            backToHub: 'К выбору',
            clickToStart: 'Кликните в любой точку поля, чтобы начать',
            rotateForFullscreen: 'Поверните экран, чтобы играть в полноэкранном режиме',
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
            lbDeviceGroup: 'Leaderboard device',
            lbDeviceLabel: 'Platform',
            lbDeviceDesktop: 'PC',
            lbDeviceMobile: 'Mobile',
            play: 'Play',
            sec: 's',
            roundsDuration: '10 rounds',
            backToHub: 'All trainers',
            clickToStart: 'Click anywhere on the field to start',
            rotateForFullscreen: 'Rotate your device for fullscreen play',
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
            duckhunt: 'Утиная охота',
            vugich: 'Vugich-симулятор',
        },
        en: {
            flick: 'Flick',
            tracking: 'Tracking',
            reaction: 'Reaction',
            lead: 'Lead Shot',
            gridshot: 'Gridshot',
            duckhunt: 'Duck Hunt',
            vugich: 'Vugich Simulator',
        },
    };

    const TRAINER_DESCS = {
        ru: {
            flick: 'Кликайте по появляющимся целям как можно быстрее и точнее.',
            tracking: 'Держите прицел на движущейся цели как можно дольше.',
            reaction: '10 раундов: дождитесь зелёного сигнала и кликните.',
            lead: 'Попадайте в зону упреждения перед движущейся целью (нажимайте ЛКМ по зеленому кругу).',
            gridshot: 'Три мелкие цели одновременно — сбивайте их подряд.',
            duckhunt: 'Стреляйте по уткам, пролетающим через поле. Чем быстрее и точнее — тем выше счёт.',
            vugich: 'Попадайте в движущиеся мишени, пока экран трясётся как при землетрясении.',
        },
        en: {
            flick: 'Click targets as they appear — speed and accuracy matter.',
            tracking: 'Keep your crosshair on the moving target as long as possible.',
            reaction: '10 rounds: wait for green, then click as fast as you can.',
            lead: 'Hit the lead zone ahead of the moving target (left-click the green circle).',
            gridshot: 'Three small targets at once — clear them as fast as you can.',
            duckhunt: 'Shoot ducks flying across the field. Speed and accuracy raise your score.',
            vugich: 'Hit moving targets while the screen shakes like an earthquake.',
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

    function buildRatingsHref(lang, trainerId, device) {
        const normalized = normalizeLang(lang);
        const base = normalized === 'en' ? '/en/services/aim/ratings' : '/services/aim/ratings';
        const params = new URLSearchParams();
        if (trainerId) {
            params.set('trainer', String(trainerId));
        }
        if (device === 'mobile' || device === 'desktop') {
            params.set('device', device);
        }
        const qs = params.toString();
        return qs ? base + '?' + qs : base;
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
            const device = window.AbsAimLeaderboard && window.AbsAimLeaderboard.viewDevice
                ? window.AbsAimLeaderboard.viewDevice(trainerId)
                : '';
            el.setAttribute('href', buildRatingsHref(lang, trainerId || null, device));
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
        if (window.AbsAimLeaderboard && window.AbsAimLeaderboard.mountAllDeviceSwitches) {
            window.AbsAimLeaderboard.mountAllDeviceSwitches();
        }
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
        updateRatingsLinks,
        switchLanguage,
    };
})();
