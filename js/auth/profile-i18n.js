(() => {
    'use strict';

    const STRINGS = {
        ru: {
            pageTitle: 'Аккаунт',
            accountTitle: 'Мой аккаунт',
            regDateLabel: 'Дата регистрации',
            username: 'Логин',
            email: 'Email',
            changePassword: 'Смена пароля',
            currentPassword: 'Текущий пароль',
            newPassword: 'Новый пароль',
            confirmation: 'Подтверждение',
            passwordCurrentPh: '********',
            passwordNewPh: 'Не менее 8 символов',
            passwordConfirmPh: 'Введите ещё раз',
            usernameTitle: '3–64 символа: латиница, цифры, _ - .',
            gameNicknames: 'Игровые ники',
            gameAccounts: 'Игровые аккаунты',
            recruiting: 'Рекрутинг',
            adType: 'Тип объявления',
            region: 'Регион',
            notSet: 'Не выбран',
            contacts: 'Контакты',
            clanTag: 'Тег клана',
            teamName: 'Название команды',
            optional: 'Необязательно',
            nicknamePh: 'Никнейм',
            nicknameTitle: 'До 24 символов: латиница, цифры, _ -',
            nicknameLockedTitle: 'Заполнено из привязанного игрового аккаунта',
            myBrackets: 'Мои сетки',
            myTacticsRooms: 'Мои тактические комнаты',
            colTitle: 'Название',
            colFormat: 'Формат',
            colCode: 'Код',
            colUpdated: 'Обновлено',
            colActions: 'Действия',
            saveSettings: 'Сохранить настройки',
            unlink: 'Отвязать',
            tacticsOpen: 'Открыть',
            tacticsDelete: 'Удалить',
            tacticsConfirmDelete: 'Удалить комнату без возможности восстановления?',
            tacticsDeleted: 'Комната удалена',
            tacticsDeleteError: 'Не удалось удалить комнату',
            tacticsEmpty: 'У вас пока нет тактических комнат.',
            tacticsLoadError: 'Не удалось загрузить список.',
            tacticsPassword: 'Пароль',
            tacticsOpenVis: 'Открытая',
            tacticsClosedVis: 'Закрытая',
        },
        en: {
            pageTitle: 'Account',
            accountTitle: 'My account',
            regDateLabel: 'Registration date',
            username: 'Username',
            email: 'Email',
            changePassword: 'Change password',
            currentPassword: 'Current password',
            newPassword: 'New password',
            confirmation: 'Confirmation',
            passwordCurrentPh: '********',
            passwordNewPh: 'At least 8 characters',
            passwordConfirmPh: 'Enter again',
            usernameTitle: '3–64 characters: Latin letters, digits, _ - .',
            gameNicknames: 'Game nicknames',
            gameAccounts: 'Game accounts',
            recruiting: 'Recruiting',
            adType: 'Ad type',
            region: 'Region',
            notSet: 'Not set',
            contacts: 'Contacts',
            clanTag: 'Clan tag',
            teamName: 'Team name',
            optional: 'Optional',
            nicknamePh: 'Nickname',
            nicknameTitle: 'Up to 24 characters: Latin letters, digits, _ -',
            nicknameLockedTitle: 'Filled from linked game account',
            myBrackets: 'My brackets',
            myTacticsRooms: 'My tactics rooms',
            colTitle: 'Title',
            colFormat: 'Format',
            colCode: 'Code',
            colUpdated: 'Updated',
            colActions: 'Actions',
            saveSettings: 'Save settings',
            unlink: 'Unlink',
            tacticsOpen: 'Open',
            tacticsDelete: 'Delete',
            tacticsConfirmDelete: 'Delete this room permanently?',
            tacticsDeleted: 'Room deleted',
            tacticsDeleteError: 'Could not delete room',
            tacticsEmpty: 'You have no tactics rooms yet.',
            tacticsLoadError: 'Could not load the list.',
            tacticsPassword: 'Password',
            tacticsOpenVis: 'Open',
            tacticsClosedVis: 'Closed',
        },
    };

    const POST_TYPE_LABELS = {
        ru: {
            clan_seeks_players: 'Клан ищет игроков',
            team_seeks_players: 'Команда ищет игроков',
            player_seeks_clan: 'Игрок ищет клан',
            player_seeks_team: 'Игрок ищет команду',
        },
        en: {
            clan_seeks_players: 'Clan seeks players',
            team_seeks_players: 'Team seeks players',
            player_seeks_clan: 'Player seeks clan',
            player_seeks_team: 'Player seeks team',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        return normalizeLang(window.ABS_PROFILE_LANG || window.ABS_LANG || document.documentElement.lang || 'ru');
    }

    function t(key) {
        const lang = getLang();
        return STRINGS[lang][key] || STRINGS.ru[key] || key;
    }

    function applyOptionLabels(lang) {
        const dict = POST_TYPE_LABELS[lang] || POST_TYPE_LABELS.ru;
        document.querySelectorAll('#recruiting_post_type option[value]').forEach((opt) => {
            const value = opt.value;
            if (value && dict[value]) {
                opt.textContent = dict[value];
            }
        });

        document.querySelectorAll('#recruiting_realm option[value]').forEach((opt) => {
            const value = opt.value;
            if (value) {
                opt.textContent = value.toUpperCase();
            }
        });

        document.querySelectorAll('#recruiting_post_type option[value=""], #recruiting_realm option[value=""]').forEach((opt) => {
            opt.textContent = t('notSet');
        });
    }

    function refreshRecruitingSelects() {
        ['recruiting_post_type', 'recruiting_realm'].forEach((id) => {
            const sel = document.getElementById(id);
            if (sel && typeof window.recruitingRefreshSelect === 'function') {
                window.recruitingRefreshSelect(sel);
            }
        });
    }

    function relocalizeContactsEditor(lang) {
        const editor = document.getElementById('profileContactsEditor');
        if (!editor) return;
        editor.dataset.lang = lang;
        if (typeof window.recruitingRelocalizeContactsEditors === 'function') {
            window.recruitingRelocalizeContactsEditors();
        }
    }

    function relocalizeDom(root) {
        const scope = root && root.querySelectorAll ? root : document;

        scope.querySelectorAll('[data-profile-i18n]').forEach((el) => {
            const key = el.getAttribute('data-profile-i18n');
            if (!key) return;
            const value = t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = value;
            } else {
                el.textContent = value;
            }
        });

        scope.querySelectorAll('[data-profile-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-profile-i18n-placeholder');
            if (key) el.placeholder = t(key);
        });

        scope.querySelectorAll('[data-profile-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-profile-i18n-title');
            if (!key) return;
            const value = t(key);
            el.title = value;
            if (el.hasAttribute('aria-label')) {
                el.setAttribute('aria-label', value);
            }
        });
    }

    function relocalizeView(lang) {
        const normalized = normalizeLang(lang || getLang());
        window.ABS_PROFILE_LANG = normalized;
        window.ABS_LANG = normalized;
        document.documentElement.lang = normalized;

        relocalizeDom(document.querySelector('.auth-page--account') || document);
        applyOptionLabels(normalized);
        refreshRecruitingSelects();
        relocalizeContactsEditor(normalized);

        if (window.AbsBracketI18n && typeof window.AbsBracketI18n.switchLanguage === 'function') {
            window.AbsBracketI18n.switchLanguage(normalized);
        }

        window.dispatchEvent(new CustomEvent('profile:langchange', { detail: { lang: normalized } }));
        return normalized;
    }

    function switchLanguage(newLang) {
        return relocalizeView(newLang);
    }

    window.AbsProfileI18n = {
        STRINGS,
        getLang,
        t,
        switchLanguage,
        relocalizeView,
        relocalizeDom,
    };
})();
