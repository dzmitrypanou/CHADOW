(() => {
    'use strict';

    const STRINGS = {
        ru: {
            title: 'Шашки онлайн',
            hint: 'Русские шашки на двоих в реальном времени. Создайте комнату и отправьте ссылку другу.',
            hubTitle: 'Онлайн игры',
            hubDesc: 'Играйте с друзьями в реальном времени — настольные игры и не только.',
            backToHome: 'На главную',
            backToHub: 'К онлайн-играм',
            backToHome: 'На главную',
            backToLobby: 'Лобби',
            createTitle: 'Создать игру',
            createDesc: 'Вы играете белыми. Отправьте ссылку на комнату сопернику.',
            joinTitle: 'Войти по коду',
            joinDesc: 'Введите 6-значный код комнаты от друга.',
            nicknameLabel: 'Ник',
            roomCodeLabel: 'Код комнаты',
            createBtn: 'Создать комнату',
            joinBtn: 'Войти',
            creating: 'Создаём комнату…',
            joining: 'Подключаемся…',
            invalidNickname: 'Ник: 2–32 символа (буквы, цифры, _-.).',
            invalidRoomCode: 'Код комнаты: 6 символов A–Z и 2–9.',
            multiplayerBadge: '2 игрока',
            cardTitle: 'Шашки онлайн',
            cardDesc: 'Русские шашки на двоих в реальном времени.',
            playOnline: 'Играть',
            connecting: 'Подключение…',
            connected: 'В сети',
            offline: 'Нет связи',
            waitingOpponent: 'Ждём второго игрока… Отправьте ссылку на комнату.',
            waitingOpponentStatus: 'Ожидание соперника',
            yourTurn: 'Ваш ход',
            opponentTurn: 'Ход соперника',
            white: 'Белые',
            black: 'Чёрные',
            you: 'Вы',
            opponent: 'Соперник',
            resign: 'Сдаться',
            resignConfirm: 'Сдаться и отдать победу сопернику?',
            dialogConfirmTitle: 'Подтвердите действие',
            dialogAlertTitle: 'Уведомление',
            dialogConfirm: 'Подтвердить',
            dialogCancel: 'Отмена',
            dialogOk: 'OK',
            copyLink: 'Ссылка скопирована',
            copyLinkFail: 'Не удалось скопировать ссылку',
            copyLinkTitle: 'Скопировать ссылку',
            win: 'Победа!',
            lose: 'Поражение',
            draw: 'Ничья',
            gameOverCapture: 'Все шашки сбиты',
            gameOverNoMoves: 'Нет ходов',
            gameOverResign: 'Соперник сдался',
            gameOverYouResigned: 'Вы сдались',
            moveRejected: 'Недопустимый ход',
            serverError: 'Ошибка сервера',
            wsUnavailable: 'Сервер realtime недоступен',
            openLobbiesTitle: 'Открытые лобби',
            openLobbiesDesc: 'Подключайтесь к комнатам, где ждут второго игрока.',
            openLobbiesLoading: 'Загрузка…',
            openLobbiesEmpty: 'Сейчас нет открытых лобби. Создайте комнату или зайдите позже.',
            openLobbiesError: 'Не удалось загрузить список лобби.',
            openLobbiesHost: 'Хост',
            openLobbiesRoom: 'Комната',
            openLobbiesSlots: 'Места',
            openLobbiesJoin: 'Войти',
            openLobbiesSlotsFree: '1 свободно',
            chatTitle: 'Чат',
            chatPlaceholder: 'Сообщение…',
            chatSend: 'Отправить',
            chatEmpty: 'Сообщений пока нет',
            roomJoinTitle: 'Вход в комнату',
            roomJoinDesc: 'Укажите ник, под которым вас увидят в комнате.',
            roomJoinBtn: 'Войти в комнату',
            wsAuthFailed: 'Ошибка авторизации realtime. Проверьте CHECKERS_WS_SECRET в .env и перезапустите сервис.',
            wsForbidden: 'Не удалось войти в комнату. Обновите страницу.',
            wsRoomNotFound: 'Комната на сервере realtime не найдена. Создайте новую игру.',
        },
        en: {
            title: 'Online Checkers',
            hint: 'Play Russian draughts for two in real time. Create a room and share the link.',
            hubTitle: 'Online Games',
            hubDesc: 'Play with friends in real time — board games and more.',
            backToHome: 'Back to home',
            backToHub: 'Online games',
            backToHome: 'Back to home',
            backToLobby: 'Lobby',
            createTitle: 'Create a game',
            createDesc: 'You play as white. Send the room link to your opponent.',
            joinTitle: 'Join by code',
            joinDesc: 'Enter the 6-character room code from your friend.',
            nicknameLabel: 'Nickname',
            roomCodeLabel: 'Room code',
            createBtn: 'Create room',
            joinBtn: 'Join',
            creating: 'Creating room…',
            joining: 'Joining…',
            invalidNickname: 'Nickname: 2–32 characters (letters, digits, _-.).',
            invalidRoomCode: 'Room code: 6 characters A–Z and 2–9.',
            multiplayerBadge: '2 players',
            cardTitle: 'Online Checkers',
            cardDesc: 'Russian draughts for two in real time.',
            playOnline: 'Play',
            connecting: 'Connecting…',
            connected: 'Online',
            offline: 'Offline',
            waitingOpponent: 'Waiting for the second player… Share the room link.',
            waitingOpponentStatus: 'Waiting for opponent',
            yourTurn: 'Your turn',
            opponentTurn: 'Opponent\'s turn',
            white: 'White',
            black: 'Black',
            you: 'You',
            opponent: 'Opponent',
            resign: 'Resign',
            resignConfirm: 'Resign and give victory to your opponent?',
            dialogConfirmTitle: 'Confirm action',
            dialogAlertTitle: 'Notice',
            dialogConfirm: 'Confirm',
            dialogCancel: 'Cancel',
            dialogOk: 'OK',
            copyLink: 'Link copied',
            copyLinkFail: 'Could not copy link',
            copyLinkTitle: 'Copy link',
            win: 'Victory!',
            lose: 'Defeat',
            draw: 'Draw',
            gameOverCapture: 'All pieces captured',
            gameOverNoMoves: 'No legal moves',
            gameOverResign: 'Opponent resigned',
            gameOverYouResigned: 'You resigned',
            moveRejected: 'Illegal move',
            serverError: 'Server error',
            wsUnavailable: 'Realtime server unavailable',
            openLobbiesTitle: 'Open lobbies',
            openLobbiesDesc: 'Join a room that is waiting for a second player.',
            openLobbiesLoading: 'Loading…',
            openLobbiesEmpty: 'No open lobbies right now. Create a room or check back later.',
            openLobbiesError: 'Could not load the lobby list.',
            openLobbiesHost: 'Host',
            openLobbiesRoom: 'Room',
            openLobbiesSlots: 'Seats',
            openLobbiesJoin: 'Join',
            openLobbiesSlotsFree: '1 open',
            chatTitle: 'Chat',
            chatPlaceholder: 'Message…',
            chatSend: 'Send',
            chatEmpty: 'No messages yet',
            roomJoinTitle: 'Join the room',
            roomJoinDesc: 'Enter your nickname before joining the game.',
            roomJoinBtn: 'Enter room',
            wsAuthFailed: 'Realtime auth failed. Check CHECKERS_WS_SECRET in .env and restart the service.',
            wsForbidden: 'Could not join the room. Refresh the page.',
            wsRoomNotFound: 'Room not found on the realtime server. Create a new game.',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        return normalizeLang(window.ABS_CHECKERS_LANG || window.ABS_LANG || 'ru');
    }

    function t(key) {
        const lang = getLang();
        return STRINGS[lang][key] || STRINGS.ru[key] || key;
    }

    function buildLangHref(slug, lang) {
        const normalized = normalizeLang(lang);
        const clean = String(slug || '').replace(/^\/+/, '').replace(/^en\
        if (normalized === 'en') {
            return clean ? `/en/${clean}` : '/en';
        }
        return clean ? `/${clean}` : '/';
    }

    function buildHomeHref(lang) {
        return normalizeLang(lang) === 'en' ? '/en#online-games' : '/#online-games';
    }

    function updateNavLinks(lang) {
        const normalized = normalizeLang(lang);
        const lobbyHref = buildLangHref('services/onlinegames/checkers', normalized);
        const hubHref = buildLangHref('services/onlinegames', normalized);
        const homeHref = buildHomeHref(normalized);

        window.ABS_CHECKERS_LOBBY_HREF = lobbyHref;
        window.ABS_CHECKERS_HUB_HREF = hubHref;
        if (window.ABS_CHECKERS_PUBLIC_ID) {
            window.ABS_CHECKERS_ROOM_HREF = buildLangHref(
                `services/onlinegames/checkers/${window.ABS_CHECKERS_PUBLIC_ID}`,
                normalized
            );
        }

        const lobbyLink = document.querySelector('.checkers-room-bar .checkers-back-link');
        if (lobbyLink) lobbyLink.href = lobbyHref;

        const playAgainBtn = document.getElementById('checkersPlayAgainBtn');
        if (playAgainBtn) playAgainBtn.href = lobbyHref;

        const lobbyBackLink = document.querySelector('.checkers-service-header .checkers-back-link');
        if (lobbyBackLink) lobbyBackLink.href = hubHref;

        const hubBackLink = document.querySelector('.onlinegames-service-header .checkers-back-link');
        if (hubBackLink) hubBackLink.href = homeHref;

        const checkersCard = document.querySelector('.online-game-card--checkers');
        if (checkersCard) checkersCard.href = lobbyHref;
    }

    function applyDom(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-checkers-i18n]').forEach((el) => {
            const key = el.getAttribute('data-checkers-i18n');
            if (key) {
                el.textContent = t(key);
            }
        });
        scope.querySelectorAll('[data-checkers-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-checkers-i18n-placeholder');
            if (key) {
                el.placeholder = t(key);
                if (el.hasAttribute('aria-label')) {
                    el.setAttribute('aria-label', t(key).replace(/…$/, '').trim() || t(key));
                }
            }
        });
        scope.querySelectorAll('[data-checkers-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-checkers-i18n-title');
            if (key) {
                const value = t(key);
                el.title = value;
                if (el.hasAttribute('aria-label')) {
                    el.setAttribute('aria-label', value);
                }
            }
        });
    }

    function switchLanguage(newLang) {
        const normalized = normalizeLang(newLang);
        window.ABS_CHECKERS_LANG = normalized;
        window.ABS_LANG = normalized;
        document.documentElement.lang = normalized;
        applyDom();
        updateNavLinks(normalized);
        if (typeof window.absUpdateDocumentTitle === 'function') {
            window.absUpdateDocumentTitle(normalized);
        }
        window.dispatchEvent(new CustomEvent('checkers:langchange', { detail: { lang: normalized } }));
        return true;
    }

    window.AbsCheckersI18n = {
        getLang,
        normalizeLang,
        t,
        applyDom,
        updateNavLinks,
        switchLanguage,
    };
})();
