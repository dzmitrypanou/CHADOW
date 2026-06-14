(() => {
    'use strict';

    const i18n = () => window.AbsCheckersI18n;
    const storage = () => window.AbsCheckersStorage;

    let wsClient = null;
    let boardRenderer = null;
    let session = null;
    let latestState = null;
    let connectionState = 'connecting';
    const chatSeenIds = new Set();
    let soundBaselineReady = false;
    let lastSoundUpdatedAt = 0;

    function sounds() {
        return window.AbsCheckersSounds;
    }

    function unlockSounds() {
        if (sounds()) {
            sounds().unlock();
        }
    }

    function playMoveSound(state) {
        if (!state || !state.lastMove || !sounds()) return;

        const updatedAt = Number(state.updatedAt) || 0;
        if (!soundBaselineReady) {
            lastSoundUpdatedAt = updatedAt;
            soundBaselineReady = true;
            return;
        }
        if (!updatedAt || updatedAt <= lastSoundUpdatedAt) return;

        lastSoundUpdatedAt = updatedAt;
        const captures = state.lastMove.captures;
        if (Array.isArray(captures) && captures.length > 0) {
            sounds().playCapture(captures.length);
        } else {
            sounds().playMove();
        }
    }

    async function postJson(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': window.ABS_CHECKERS_CSRF || '',
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
        const input = document.getElementById('checkersRoomNicknameInput');
        const fromInput = input ? String(input.value || '').trim() : '';
        if (fromInput) return fromInput;

        const preferred = storage().getPreferredNickname();
        if (preferred) return preferred;

        const saved = storage().getSession(window.ABS_CHECKERS_PUBLIC_ID);
        if (saved && saved.nickname) return String(saved.nickname).trim();

        return String(window.ABS_CHECKERS_DEFAULT_NICKNAME || '').trim()
            || defaultNicknameLabel();
    }

    function needsNicknamePrompt() {
        if (window.ABS_CHECKERS_IS_LOGGED_IN) return false;
        const preferred = storage().getPreferredNickname();
        if (preferred && nicknameValid(preferred)) return false;
        const saved = storage().getSession(window.ABS_CHECKERS_PUBLIC_ID);
        if (saved && saved.nickname && nicknameValid(saved.nickname)) return false;
        return true;
    }

    function showNicknameGate(show) {
        const gate = document.getElementById('checkersNicknameGate');
        if (!gate) return;
        gate.hidden = !show;
    }

    function showNicknameGateError(message) {
        const el = document.getElementById('checkersNicknameGateError');
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
    }

    function bindNicknameGate() {
        const btn = document.getElementById('checkersNicknameGateBtn');
        const input = document.getElementById('checkersRoomNicknameInput');
        if (!btn) return;

        const submit = async () => {
            const nickname = getNickname();
            if (!nicknameValid(nickname)) {
                showNicknameGateError(i18n().t('invalidNickname'));
                return;
            }
            showNicknameGateError('');
            storage().setPreferredNickname(nickname);
            storage().clearSession(window.ABS_CHECKERS_PUBLIC_ID);
            unlockSounds();
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
        const publicId = window.ABS_CHECKERS_PUBLIC_ID;
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

        const result = await postJson(window.ABS_CHECKERS_API_JOIN, payload);
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
        const el = document.getElementById('checkersConnectionStatus');
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

    function renderPlayers(state) {
        const el = document.getElementById('checkersPlayers');
        if (!el || !state) return;

        const white = state.players && state.players.white ? state.players.white.nickname : '—';
        const black = state.players && state.players.black ? state.players.black.nickname : '—';
        const myColor = state.you || session.color;

        el.innerHTML = ''
            + '<div class="checkers-player checkers-player--black'
            + (myColor === 'black' ? ' checkers-player--you' : '')
            + '"><span class="checkers-player__label">' + escapeHtml(i18n().t('black')) + '</span>'
            + '<span class="checkers-player__name">' + escapeHtml(black) + '</span></div>'
            + '<div class="checkers-player checkers-player--white'
            + (myColor === 'white' ? ' checkers-player--you' : '')
            + '"><span class="checkers-player__label">' + escapeHtml(i18n().t('white')) + '</span>'
            + '<span class="checkers-player__name">' + escapeHtml(white) + '</span></div>';
    }

    function renderStatus(state) {
        const line = document.getElementById('checkersStatusLine');
        const waiting = document.getElementById('checkersWaiting');
        const resignBtn = document.getElementById('checkersResignBtn');
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
        const overlay = document.getElementById('checkersGameOver');
        const title = document.getElementById('checkersGameOverTitle');
        const hint = document.getElementById('checkersGameOverHint');
        if (!overlay || !title || !hint) return;

        const myColor = state.you || session.color;
        const winner = payload.winner || state.winner;
        const reason = payload.reason || state.finishReason;

        if (winner === myColor) {
            title.textContent = i18n().t('win');
        } else if (!winner) {
            title.textContent = i18n().t('draw');
        } else {
            title.textContent = i18n().t('lose');
        }

        if (reason === 'resign') {
            hint.textContent = winner === myColor ? i18n().t('gameOverResign') : i18n().t('gameOverYouResigned');
        } else if (reason === 'capture_all') {
            hint.textContent = i18n().t('gameOverCapture');
        } else {
            hint.textContent = i18n().t('gameOverNoMoves');
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
        const listEl = document.getElementById('checkersChatMessages');
        const emptyEl = document.getElementById('checkersChatEmpty');
        if (!emptyEl) return;
        const hasMessages = listEl && listEl.children.length > 0;
        emptyEl.hidden = hasMessages;
    }

    function appendChatMessage(message) {
        const listEl = document.getElementById('checkersChatMessages');
        if (!listEl || !message) return;

        const id = Number(message.id) || 0;
        if (id > 0) {
            if (chatSeenIds.has(id)) return;
            chatSeenIds.add(id);
        }

        const li = document.createElement('li');
        li.className = 'checkers-chat__message';
        if (id > 0) {
            li.dataset.chatId = String(id);
        }

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
        const form = document.getElementById('checkersChatForm');
        const input = document.getElementById('checkersChatInput');
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
        playMoveSound(state);
        renderPlayers(state);
        renderStatus(state);
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

        boardRenderer.mount(session.color);
        unlockSounds();

        const boardEl = document.getElementById('checkersBoard');
        if (boardEl) {
            boardEl.addEventListener('click', unlockSounds, { once: true });
        }

        const connectWs = () => {
            if (wsClient) {
                wsClient.disconnect();
            }
            wsClient = new window.AbsCheckersWsClient({
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
                        window.AbsSiteToast.show(i18n().t('moveRejected'), 'error');
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
                        storage().clearSession(window.ABS_CHECKERS_PUBLIC_ID);
                        session = await ensureSession(true);
                        boardRenderer.mount(session.color);
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
        if (!window.ABS_CHECKERS_PUBLIC_ID) return;

        if (window.AbsCheckersI18n) {
            window.AbsCheckersI18n.applyDom();
            if (typeof window.AbsCheckersI18n.updateNavLinks === 'function') {
                window.AbsCheckersI18n.updateNavLinks(window.AbsCheckersI18n.getLang());
            }
        }

        const boardEl = document.getElementById('checkersBoard');
        boardRenderer = window.AbsCheckersBoard.createBoardRenderer({
            boardEl,
            onMove(from, to) {
                if (wsClient) {
                    wsClient.move(from, to);
                }
            },
        });

        const copyBtn = document.getElementById('checkersCopyLinkBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyRoomLink);
        }

        const resignBtn = document.getElementById('checkersResignBtn');
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

        const nickInput = document.getElementById('checkersRoomNicknameInput');
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
        if (window.AbsCheckersI18n) {
            window.AbsCheckersI18n.applyDom();
            if (typeof window.AbsCheckersI18n.updateNavLinks === 'function') {
                window.AbsCheckersI18n.updateNavLinks(window.AbsCheckersI18n.getLang());
            }
        }
        if (window.AbsTacticsConfirm && typeof window.AbsTacticsConfirm.relocalize === 'function') {
            window.AbsTacticsConfirm.relocalize();
        }
        setConnection(connectionState);
        if (latestState) {
            renderPlayers(latestState);
            renderStatus(latestState);
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

    window.AbsCheckersRoom = {
        relocalizeView,
    };
})();
