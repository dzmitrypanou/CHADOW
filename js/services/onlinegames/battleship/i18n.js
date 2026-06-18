(() => {
    'use strict';

    const STRINGS = {
        ru: {
            title: 'Морской бой',
            hint: 'Классический морской бой на двоих. Поле 10×10, 20×20 или 50×50 — создайте комнату и отправьте ссылку.',
            hubTitle: 'Онлайн игры',
            hubDesc: 'Играйте с друзьями в реальном времени — настольные игры и не только.',
            backToHome: 'На главную',
            backToHub: 'К онлайн-играм',
            backToLobby: 'Лобби',
            createTitle: 'Создать игру',
            createDesc: 'Вы — хост. Выберите размер поля и отправьте ссылку сопернику.',
            joinTitle: 'Войти по коду',
            joinDesc: 'Введите 6-значный код комнаты от друга.',
            nicknameLabel: 'Ник',
            roomCodeLabel: 'Код комнаты',
            boardSizeLabel: 'Размер поля',
            boardSize10Hint: 'Классический флот',
            boardSize20Hint: 'Расширенный бой',
            boardSize50Hint: 'Масштабная армада',
            createBtn: 'Создать комнату',
            joinBtn: 'Войти',
            creating: 'Создаём комнату…',
            joining: 'Подключаемся…',
            invalidNickname: 'Ник: 2–32 символа (буквы, цифры, _-.).',
            invalidRoomCode: 'Код комнаты: 6 символов A–Z и 2–9.',
            multiplayerBadge: '2 игрока',
            cardTitle: 'Морской бой',
            cardDesc: 'Классический морской бой на двоих с полями 10×10, 20×20 и 50×50.',
            playOnline: 'Играть',
            connecting: 'Подключение…',
            connected: 'В сети',
            offline: 'Нет связи',
            waitingOpponent: 'Ждём второго игрока… Отправьте ссылку на комнату.',
            waitingOpponentStatus: 'Ожидание соперника',
            placementStatus: 'Расстановка кораблей',
            waitingPlacement: 'Ждём расстановку соперника',
            yourTurn: 'Ваш ход',
            opponentTurn: 'Ход соперника',
            host: 'Хост',
            guest: 'Гость',
            you: 'Вы',
            opponent: 'Соперник',
            ownBoard: 'Ваш флот',
            enemyBoard: 'Поле соперника',
            autoPlace: 'Случайная расстановка',
            placementHint: 'Перетащите корабли на поле. Колесо мыши — поворот. Когда все на месте — подтвердите.',
            placementDragHint: 'Колесо мыши — поворот корабля',
            confirmPlacement: 'Готово — начать бой',
            placementReady: 'Корабли расставлены. Ждём соперника…',
            boardSizeBadge: 'Поле {size}×{size}',
            resign: 'Сдаться',
            resignConfirm: 'Сдаться и отдать победу сопернику?',
            dialogConfirmTitle: 'Подтвердите действие',
            dialogConfirm: 'Подтвердить',
            dialogCancel: 'Отмена',
            copyLink: 'Ссылка скопирована',
            copyLinkFail: 'Не удалось скопировать ссылку',
            copyLinkTitle: 'Скопировать ссылку',
            win: 'Победа!',
            lose: 'Поражение',
            gameOverAllSunk: 'Все корабли потоплены',
            gameOverResign: 'Соперник сдался',
            gameOverYouResigned: 'Вы сдались',
            shotRejected: 'Недопустимый выстрел',
            placementRejected: 'Нельзя поставить корабль здесь',
            serverError: 'Ошибка сервера',
            wsUnavailable: 'Сервер realtime недоступен',
            openLobbiesTitle: 'Открытые лобби',
            openLobbiesDesc: 'Подключайтесь к комнатам, где ждут второго игрока.',
            openLobbiesLoading: 'Загрузка…',
            openLobbiesEmpty: 'Сейчас нет открытых лобби. Создайте комнату или зайдите позже.',
            openLobbiesError: 'Не удалось загрузить список лобби.',
            openLobbiesHost: 'Хост',
            openLobbiesBoard: 'Поле',
            openLobbiesJoin: 'Войти',
            openLobbiesSlotsFree: '1 свободно',
            chatTitle: 'Чат',
            chatPlaceholder: 'Сообщение…',
            chatSend: 'Отправить',
            chatEmpty: 'Сообщений пока нет',
            roomJoinTitle: 'Вход в комнату',
            roomJoinDesc: 'Укажите ник, под которым вас увидят в комнате.',
            roomJoinBtn: 'Войти в комнату',
            wsAuthFailed: 'Ошибка авторизации realtime. Проверьте BATTLESHIP_WS_SECRET в .env и перезапустите сервис.',
            wsForbidden: 'Не удалось войти в комнату. Обновите страницу.',
            wsRoomNotFound: 'Комната на сервере realtime не найдена. Создайте новую игру.',
            fleetShip: 'Корабль {len}',
            fleetCount: '×{count}',
        },
        en: {
            title: 'Battleship Online',
            hint: 'Classic sea battle for two. Choose 10×10, 20×20 or 50×50 board and share the room link.',
            hubTitle: 'Online Games',
            hubDesc: 'Play with friends in real time — board games and more.',
            backToHome: 'Back to home',
            backToHub: 'Online games',
            backToLobby: 'Lobby',
            createTitle: 'Create a game',
            createDesc: 'You are the host. Choose board size and share the room link.',
            joinTitle: 'Join by code',
            joinDesc: 'Enter the 6-character room code from your friend.',
            nicknameLabel: 'Nickname',
            roomCodeLabel: 'Room code',
            boardSizeLabel: 'Board size',
            boardSize10Hint: 'Classic fleet',
            boardSize20Hint: 'Extended battle',
            boardSize50Hint: 'Massive armada',
            createBtn: 'Create room',
            joinBtn: 'Join',
            creating: 'Creating room…',
            joining: 'Joining…',
            invalidNickname: 'Nickname: 2–32 characters (letters, digits, _-.).',
            invalidRoomCode: 'Room code: 6 characters A–Z and 2–9.',
            multiplayerBadge: '2 players',
            cardTitle: 'Battleship Online',
            cardDesc: 'Classic battleship for two with 10×10, 20×20 and 50×50 boards.',
            playOnline: 'Play',
            connecting: 'Connecting…',
            connected: 'Online',
            offline: 'Offline',
            waitingOpponent: 'Waiting for the second player… Share the room link.',
            waitingOpponentStatus: 'Waiting for opponent',
            placementStatus: 'Ship placement',
            waitingPlacement: 'Waiting for opponent placement',
            yourTurn: 'Your turn',
            opponentTurn: 'Opponent\'s turn',
            host: 'Host',
            guest: 'Guest',
            you: 'You',
            opponent: 'Opponent',
            ownBoard: 'Your fleet',
            enemyBoard: 'Enemy waters',
            autoPlace: 'Random placement',
            placementHint: 'Drag ships onto the board. Mouse wheel rotates. Confirm when all are placed.',
            placementDragHint: 'Mouse wheel — rotate ship',
            confirmPlacement: 'Ready — start battle',
            placementReady: 'Ships placed. Waiting for opponent…',
            boardSizeBadge: 'Board {size}×{size}',
            resign: 'Resign',
            resignConfirm: 'Resign and give victory to your opponent?',
            dialogConfirmTitle: 'Confirm action',
            dialogConfirm: 'Confirm',
            dialogCancel: 'Cancel',
            copyLink: 'Link copied',
            copyLinkFail: 'Could not copy link',
            copyLinkTitle: 'Copy link',
            win: 'Victory!',
            lose: 'Defeat',
            gameOverAllSunk: 'All ships sunk',
            gameOverResign: 'Opponent resigned',
            gameOverYouResigned: 'You resigned',
            shotRejected: 'Invalid shot',
            placementRejected: 'Cannot place ship here',
            serverError: 'Server error',
            wsUnavailable: 'Realtime server unavailable',
            openLobbiesTitle: 'Open lobbies',
            openLobbiesDesc: 'Join a room that is waiting for a second player.',
            openLobbiesLoading: 'Loading…',
            openLobbiesEmpty: 'No open lobbies right now. Create a room or check back later.',
            openLobbiesError: 'Could not load the lobby list.',
            openLobbiesHost: 'Host',
            openLobbiesBoard: 'Board',
            openLobbiesJoin: 'Join',
            openLobbiesSlotsFree: '1 open',
            chatTitle: 'Chat',
            chatPlaceholder: 'Message…',
            chatSend: 'Send',
            chatEmpty: 'No messages yet',
            roomJoinTitle: 'Join the room',
            roomJoinDesc: 'Enter your nickname before joining the game.',
            roomJoinBtn: 'Enter room',
            wsAuthFailed: 'Realtime auth failed. Check BATTLESHIP_WS_SECRET in .env and restart the service.',
            wsForbidden: 'Could not join the room. Refresh the page.',
            wsRoomNotFound: 'Room not found on the realtime server. Create a new game.',
            fleetShip: 'Ship {len}',
            fleetCount: '×{count}',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        return normalizeLang(window.ABS_BATTLESHIP_LANG || window.ABS_LANG || 'ru');
    }

    function t(key, vars) {
        const lang = getLang();
        let text = STRINGS[lang][key] || STRINGS.ru[key] || key;
        if (vars && typeof vars === 'object') {
            Object.keys(vars).forEach((name) => {
                text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(vars[name]));
            });
        }
        return text;
    }

    function buildLangHref(slug, lang) {
        const normalized = normalizeLang(lang);
        const clean = String(slug || '').replace(/^\/+/, '').replace(/^en\//, '');
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
        const lobbyHref = buildLangHref('services/onlinegames/battleship', normalized);
        const hubHref = buildLangHref('services/onlinegames', normalized);
        const homeHref = buildHomeHref(normalized);

        window.ABS_BATTLESHIP_LOBBY_HREF = lobbyHref;
        window.ABS_BATTLESHIP_HUB_HREF = hubHref;
        if (window.ABS_BATTLESHIP_PUBLIC_ID) {
            window.ABS_BATTLESHIP_ROOM_HREF = buildLangHref(
                `services/onlinegames/battleship/${window.ABS_BATTLESHIP_PUBLIC_ID}`,
                normalized
            );
        }

        const lobbyLink = document.querySelector('.battleship-room .checkers-room-bar .checkers-back-link');
        if (lobbyLink) lobbyLink.href = lobbyHref;

        const playAgainBtn = document.getElementById('battleshipPlayAgainBtn');
        if (playAgainBtn) playAgainBtn.href = lobbyHref;

        const lobbyBackLink = document.querySelector('.page-battleship-lobby .checkers-service-header .checkers-back-link');
        if (lobbyBackLink) lobbyBackLink.href = hubHref;

        const battleshipCard = document.querySelector('.online-game-card--battleship');
        if (battleshipCard) battleshipCard.href = lobbyHref;
    }

    function applyDom(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-battleship-i18n]').forEach((el) => {
            const key = el.getAttribute('data-battleship-i18n');
            if (key) {
                el.textContent = t(key);
            }
        });
        scope.querySelectorAll('[data-battleship-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-battleship-i18n-placeholder');
            if (key) {
                el.placeholder = t(key);
            }
        });
        scope.querySelectorAll('[data-battleship-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-battleship-i18n-title');
            if (key) {
                el.title = t(key);
            }
        });
    }

    function switchLanguage(newLang) {
        const normalized = normalizeLang(newLang);
        window.ABS_BATTLESHIP_LANG = normalized;
        window.ABS_LANG = normalized;
        document.documentElement.lang = normalized;
        applyDom();
        updateNavLinks(normalized);
        if (typeof window.absUpdateDocumentTitle === 'function') {
            window.absUpdateDocumentTitle(normalized);
        }
        window.dispatchEvent(new CustomEvent('battleship:langchange', { detail: { lang: normalized } }));
        return true;
    }

    window.AbsBattleshipI18n = {
        getLang,
        normalizeLang,
        t,
        applyDom,
        updateNavLinks,
        switchLanguage,
    };
})();
