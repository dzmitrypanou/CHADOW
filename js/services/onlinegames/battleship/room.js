(() => {
    'use strict';

    const i18n = () => window.AbsBattleshipI18n;
    const storage = () => window.AbsBattleshipStorage;

    let wsClient = null;
    let boardRenderer = null;
    let session = null;
    let latestState = null;
    let connectionState = 'connecting';
    const chatSeenIds = new Set();

    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': window.ABS_BATTLESHIP_CSRF || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
    }

    function nicknameValid(name) {
        if (window.AbsAimNickname && window.AbsAimNickname.isValid) {
            return window.AbsAimNickname.isValid(name);
        }
        return /^[\p{L}\p{N}_\-. ]{2,32}$/u.test(String(name || '').trim());
    }

    function defaultNicknameLabel() {
        return i18n().getLang() === 'en' ? 'Player' : 'Игрок';
    }

    function getNickname() {
        const input = document.getElementById('battleshipRoomNicknameInput');
        const fromInput = input ? String(input.value || '').trim() : '';
        if (fromInput) return fromInput;

        const preferred = storage().getPreferredNickname();
        if (preferred) return preferred;

        const saved = storage().getSession(window.ABS_BATTLESHIP_PUBLIC_ID);
        if (saved && saved.nickname) return String(saved.nickname).trim();

        return String(window.ABS_BATTLESHIP_DEFAULT_NICKNAME || '').trim()
            || defaultNicknameLabel();
    }

    function needsNicknamePrompt() {
        if (window.ABS_BATTLESHIP_IS_LOGGED_IN) return false;
        const preferred = storage().getPreferredNickname();
        if (preferred && nicknameValid(preferred)) return false;
        const saved = storage().getSession(window.ABS_BATTLESHIP_PUBLIC_ID);
        if (saved && saved.nickname && nicknameValid(saved.nickname)) return false;
        return true;
    }

    function showNicknameGate(show) {
        const gate = document.getElementById('battleshipNicknameGate');
        if (!gate) return;
        gate.hidden = !show;
    }

    function showNicknameGateError(message) {
        const el = document.getElementById('battleshipNicknameGateError');
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
    }

    function bindNicknameGate() {
        const btn = document.getElementById('battleshipNicknameGateBtn');
        const input = document.getElementById('battleshipRoomNicknameInput');
        if (!btn) return;

        const submit = async () => {
            const nickname = getNickname();
            if (!nicknameValid(nickname)) {
                showNicknameGateError(i18n().t('invalidNickname'));
                return;
            }
            showNicknameGateError('');
            storage().setPreferredNickname(nickname);
            storage().clearSession(window.ABS_BATTLESHIP_PUBLIC_ID);
            showNicknameGate(false);
            await startRoomSession();
        };

        btn.addEventListener('click', submit);
        if (input) {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    submit();
                }
            });
        }
    }

    function wsCloseMessage(code) {
        if (code === 4401) return i18n().t('wsAuthFailed');
        if (code === 4403) return i18n().t('wsForbidden');
        if (code === 4404) return i18n().t('wsRoomNotFound');
        return i18n().t('wsUnavailable');
    }

    async function ensureSession(forceRefresh) {
        const publicId = window.ABS_BATTLESHIP_PUBLIC_ID;
        const saved = forceRefresh ? null : storage().getSession(publicId);
        const payload = {
            public_id: publicId,
            client_id: storage().getClientId(),
            nickname: getNickname(),
            lang: i18n().getLang(),
        };
        if (saved && saved.ws_token) {
            payload.ws_token = saved.ws_token;
        }

        const result = await postJson(window.ABS_BATTLESHIP_API_JOIN, payload);
        if (!result.ok || !result.data.success) {
            throw new Error(result.data.error || i18n().t('serverError'));
        }

        session = result.data.data;
        storage().saveSession(publicId, session);
        if (session.nickname) {
            storage().setPreferredNickname(session.nickname);
        }
        return session;
    }

    function setConnection(state) {
        connectionState = state;
        const el = document.getElementById('battleshipConnectionStatus');
        if (!el) return;
        el.dataset.state = state;
        const icon = el.querySelector('i');
        const label = el.querySelector('span');
        if (!icon || !label) return;

        if (state === 'connected') {
            icon.className = 'fas fa-circle';
            label.textContent = i18n().t('connected');
        } else if (state === 'connecting') {
            icon.className = 'fas fa-circle-notch fa-spin';
            label.textContent = i18n().t('connecting');
        } else {
            icon.className = 'fas fa-circle';
            label.textContent = i18n().t('offline');
        }
    }

    function roleLabel(role) {
        return role === 'host' ? i18n().t('host') : i18n().t('guest');
    }

    function renderPlayers(state) {
        const el = document.getElementById('battleshipPlayers');
        if (!el || !state) return;

        const host = state.players && state.players.host ? state.players.host.nickname : '—';
        const guest = state.players && state.players.guest ? state.players.guest.nickname : '—';
        const myRole = state.you || session.color;

        el.innerHTML = ''
            + '<div class="checkers-player checkers-player--black'
            + (myRole === 'host' ? ' checkers-player--you' : '')
            + '"><span class="checkers-player__label">' + escapeHtml(roleLabel('host')) + '</span>'
            + '<span class="checkers-player__name">' + escapeHtml(host) + '</span></div>'
            + '<div class="checkers-player checkers-player--white'
            + (myRole === 'guest' ? ' checkers-player--you' : '')
            + '"><span class="checkers-player__label">' + escapeHtml(roleLabel('guest')) + '</span>'
            + '<span class="checkers-player__name">' + escapeHtml(guest) + '</span></div>';
    }

    function updateBoardBadge(size) {
        const badge = document.getElementById('battleshipBoardBadge');
        if (!badge) return;
        const boardSize = Number(size) || 10;
        badge.textContent = i18n().t('boardSizeBadge', { size: boardSize });
        badge.hidden = false;
    }

    function renderFleetList(state) {
        const list = document.getElementById('battleshipFleetList');
        if (!list || !state || !Array.isArray(state.fleet)) return;
        list.innerHTML = state.fleet.map((item) => {
            const len = Number(item.len) || 0;
            const count = Number(item.count) || 0;
            return '<span class="battleship-fleet-chip">'
                + escapeHtml(i18n().t('fleetShip', { len }))
                + ' ' + escapeHtml(i18n().t('fleetCount', { count }))
                + '</span>';
        }).join('');
    }

    function renderPlacement(state) {
        const bar = document.getElementById('battleshipPlacementBar');
        const hint = document.getElementById('battleshipPlacementHint');
        const autoBtn = document.getElementById('battleshipAutoPlaceBtn');
        if (!bar) return;

        if (state.status !== 'placement') {
            bar.hidden = true;
            return;
        }

        bar.hidden = false;
        renderFleetList(state);

        const ownReady = !!(state.ownBoard && state.ownBoard.ready);
        if (hint) {
            hint.textContent = ownReady ? i18n().t('placementReady') : i18n().t('placementHint');
        }
        if (autoBtn) {
            autoBtn.disabled = ownReady;
        }
    }

    function renderStatus(state) {
        const line = document.getElementById('battleshipStatusLine');
        const waiting = document.getElementById('battleshipWaiting');
        const resignBtn = document.getElementById('battleshipResignBtn');
        if (!line) return;

        if (state.status === 'waiting') {
            line.textContent = i18n().t('waitingOpponentStatus');
            line.hidden = false;
            line.classList.remove('checkers-status-line--yours', 'checkers-status-line--opponent');
            line.classList.add('checkers-status-line--waiting');
            if (waiting) waiting.hidden = false;
            if (resignBtn) resignBtn.hidden = true;
            return;
        }

        if (waiting) waiting.hidden = true;

        if (state.status === 'placement') {
            const ownReady = !!(state.ownBoard && state.ownBoard.ready);
            line.textContent = ownReady ? i18n().t('waitingPlacement') : i18n().t('placementStatus');
            line.hidden = false;
            line.classList.remove('checkers-status-line--yours', 'checkers-status-line--opponent');
            line.classList.add('checkers-status-line--waiting');
            if (resignBtn) resignBtn.hidden = false;
            return;
        }

        if (resignBtn) resignBtn.hidden = state.status !== 'playing';

        if (state.status === 'finished') {
            line.textContent = '';
            line.hidden = true;
            line.classList.remove('checkers-status-line--yours', 'checkers-status-line--opponent', 'checkers-status-line--waiting');
            return;
        }

        line.hidden = false;
        line.classList.remove('checkers-status-line--waiting');

        if (state.turn === state.you) {
            line.textContent = i18n().t('yourTurn');
            line.classList.add('checkers-status-line--yours');
            line.classList.remove('checkers-status-line--opponent');
        } else {
            line.textContent = i18n().t('opponentTurn');
            line.classList.add('checkers-status-line--opponent');
            line.classList.remove('checkers-status-line--yours');
        }
    }

    function showGameOver(payload, state) {
        const overlay = document.getElementById('battleshipGameOver');
        const title = document.getElementById('battleshipGameOverTitle');
        const hint = document.getElementById('battleshipGameOverHint');
        if (!overlay || !title || !hint) return;

        const myRole = state.you || session.color;
        const winner = payload.winner || state.winner;
        const reason = payload.reason || state.finishReason;

        title.textContent = winner === myRole ? i18n().t('win') : i18n().t('lose');

        if (reason === 'resign') {
            hint.textContent = winner === myRole ? i18n().t('gameOverResign') : i18n().t('gameOverYouResigned');
        } else {
            hint.textContent = i18n().t('gameOverAllSunk');
        }

        overlay.hidden = false;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatChatTime(ts) {
        const date = new Date(Number(ts) || Date.now());
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function updateChatEmptyState() {
        const listEl = document.getElementById('battleshipChatMessages');
        const emptyEl = document.getElementById('battleshipChatEmpty');
        if (!emptyEl) return;
        const hasMessages = listEl && listEl.children.length > 0;
        emptyEl.hidden = hasMessages;
    }

    function appendChatMessage(message) {
        const listEl = document.getElementById('battleshipChatMessages');
        if (!listEl || !message) return;

        const id = Number(message.id) || 0;
        if (id > 0) {
            if (chatSeenIds.has(id)) return;
            chatSeenIds.add(id);
        }

        const li = document.createElement('li');
        li.className = 'checkers-chat__message';

        const nick = document.createElement('span');
        nick.className = 'checkers-chat__nick';
        nick.textContent = String(message.nickname || 'Guest');

        const time = document.createElement('span');
        time.className = 'checkers-chat__time';
        time.textContent = formatChatTime(message.ts);

        const text = document.createElement('span');
        text.className = 'checkers-chat__text';
        text.textContent = String(message.text || '');

        li.appendChild(nick);
        li.appendChild(time);
        li.appendChild(text);
        listEl.appendChild(li);
        listEl.scrollTop = listEl.scrollHeight;
        updateChatEmptyState();
    }

    function bindChatForm() {
        const form = document.getElementById('battleshipChatForm');
        const input = document.getElementById('battleshipChatInput');
        if (!form || !input) return;

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const text = String(input.value || '').trim();
            if (!text || !wsClient) return;
            if (!wsClient.sendChat(text)) return;
            input.value = '';
            input.focus();
        });
    }

    function handleState(state) {
        latestState = state;
        updateBoardBadge(state.boardSize);
        renderPlayers(state);
        renderStatus(state);
        renderPlacement(state);
        if (boardRenderer) {
            boardRenderer.update(state);
        }
        if (state.status === 'finished') {
            showGameOver({ winner: state.winner, reason: state.finishReason }, state);
        }
    }

    async function copyRoomLink() {
        const href = window.location.href;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(href);
            } else {
                const tmp = document.createElement('textarea');
                tmp.value = href;
                tmp.setAttribute('readonly', '');
                tmp.style.position = 'fixed';
                tmp.style.left = '-9999px';
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
            }
            if (window.AbsSiteToast) {
                window.AbsSiteToast.show(i18n().t('copyLink'), 'success');
            }
        } catch (e) {
            if (window.AbsSiteToast) {
                window.AbsSiteToast.show(i18n().t('copyLinkFail'), 'error');
            }
        }
    }

    async function startRoomSession() {
        setConnection('connecting');

        try {
            session = await ensureSession();
        } catch (e) {
            setConnection('offline');
            if (window.AbsSiteToast) {
                window.AbsSiteToast.show(String(e.message || i18n().t('serverError')), 'error');
            }
            return;
        }

        const boardSize = session.board_size || 10;
        boardRenderer.mount(session.color, boardSize);
        updateBoardBadge(boardSize);

        const connectWs = () => {
            if (wsClient) {
                wsClient.disconnect();
            }
            wsClient = new window.AbsBattleshipWsClient({
                wsUrl: session.ws_url,
                wsToken: session.ws_token,
                onConnection: setConnection,
                onState: handleState,
                onGameOver: (payload) => {
                    if (latestState) {
                        showGameOver(payload, latestState);
                    }
                },
                onError: () => {
                    if (window.AbsSiteToast) {
                        window.AbsSiteToast.show(i18n().t('shotRejected'), 'error');
                    }
                },
                onChat: (payload) => {
                    if (payload && payload.message) {
                        appendChatMessage(payload.message);
                    }
                },
                onWsClose: (event) => {
                    if (event && event.code && event.code !== 1000 && wsClient && wsClient.failedAttempts === 1) {
                        if (window.AbsSiteToast) {
                            window.AbsSiteToast.show(wsCloseMessage(event.code), 'error');
                        }
                    }
                },
                onReconnectFailed: async (event) => {
                    setConnection('offline');
                    if (window.AbsSiteToast) {
                        window.AbsSiteToast.show(wsCloseMessage(event && event.code), 'error');
                    }
                    try {
                        storage().clearSession(window.ABS_BATTLESHIP_PUBLIC_ID);
                        session = await ensureSession(true);
                        boardRenderer.mount(session.color, session.board_size || 10);
                        connectWs();
                    } catch (e) {
                        if (window.AbsSiteToast) {
                            window.AbsSiteToast.show(String(e.message || i18n().t('serverError')), 'error');
                        }
                    }
                },
            });
            wsClient.connect();
        };

        connectWs();
    }

    async function init() {
        if (!window.ABS_BATTLESHIP_PUBLIC_ID) return;

        if (window.AbsBattleshipI18n) {
            window.AbsBattleshipI18n.applyDom();
            if (typeof window.AbsBattleshipI18n.updateNavLinks === 'function') {
                window.AbsBattleshipI18n.updateNavLinks(window.AbsBattleshipI18n.getLang());
            }
        }

        boardRenderer = window.AbsBattleshipBoard.createBoardRenderer({
            ownEl: document.getElementById('battleshipOwnBoard'),
            enemyEl: document.getElementById('battleshipEnemyBoard'),
            onShoot(r, c) {
                if (wsClient) {
                    wsClient.shoot(r, c);
                }
            },
        });

        const copyBtn = document.getElementById('battleshipCopyLinkBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyRoomLink);
        }

        const autoPlaceBtn = document.getElementById('battleshipAutoPlaceBtn');
        if (autoPlaceBtn) {
            autoPlaceBtn.addEventListener('click', () => {
                if (wsClient) wsClient.autoPlace();
            });
        }

        const resignBtn = document.getElementById('battleshipResignBtn');
        if (resignBtn) {
            resignBtn.addEventListener('click', async () => {
                let confirmed = false;
                if (window.AbsTacticsConfirm?.confirm) {
                    confirmed = await window.AbsTacticsConfirm.confirm(i18n().t('resignConfirm'), {
                        title: i18n().t('dialogConfirmTitle'),
                        confirmText: i18n().t('resign'),
                    });
                } else {
                    confirmed = window.confirm(i18n().t('resignConfirm'));
                }
                if (!confirmed) return;
                if (wsClient) wsClient.resign();
            });
        }

        bindChatForm();
        updateChatEmptyState();
        bindNicknameGate();

        const nickInput = document.getElementById('battleshipRoomNicknameInput');
        const preferred = storage().getPreferredNickname();
        if (nickInput && preferred && !nickInput.value) {
            nickInput.value = preferred;
        }

        if (needsNicknamePrompt()) {
            showNicknameGate(true);
            setConnection('offline');
            return;
        }

        await startRoomSession();
    }

    function relocalizeView() {
        if (window.AbsBattleshipI18n) {
            window.AbsBattleshipI18n.applyDom();
            if (typeof window.AbsBattleshipI18n.updateNavLinks === 'function') {
                window.AbsBattleshipI18n.updateNavLinks(window.AbsBattleshipI18n.getLang());
            }
        }
        setConnection(connectionState);
        if (latestState) {
            updateBoardBadge(latestState.boardSize);
            renderPlayers(latestState);
            renderStatus(latestState);
            renderPlacement(latestState);
            if (latestState.status === 'finished') {
                showGameOver(
                    { winner: latestState.winner, reason: latestState.finishReason },
                    latestState
                );
            }
        }
        updateChatEmptyState();
    }

    document.addEventListener('DOMContentLoaded', init);

    window.AbsBattleshipRoom = {
        relocalizeView,
    };
})();
