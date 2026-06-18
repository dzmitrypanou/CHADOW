(() => {
    'use strict';

    const i18n = () => window.AbsBattleshipI18n;
    const storage = () => window.AbsBattleshipStorage;

    const OPEN_LOBBIES_POLL_MS = 12000;
    let openLobbiesTimer = null;
    let lastOpenLobbies = [];

    function showStatus(message, isError) {
        const el = document.getElementById('battleshipLobbyStatus');
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
        el.classList.toggle('is-visible', !!message);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function nicknameValid(name) {
        if (window.AbsAimNickname && window.AbsAimNickname.isValid) {
            return window.AbsAimNickname.isValid(name);
        }
        return /^[\p{L}\p{N}_\-. ]{2,32}$/u.test(String(name || '').trim());
    }

    function getNickname() {
        const input = document.getElementById('battleshipNicknameInput');
        const value = input ? String(input.value || '').trim() : '';
        if (value) return value;
        return String(window.ABS_BATTLESHIP_DEFAULT_NICKNAME || '').trim()
            || (i18n().getLang() === 'en' ? 'Player' : 'Игрок');
    }

    function getBoardSize() {
        const selected = document.querySelector('input[name="battleshipBoardSize"]:checked');
        const size = selected ? parseInt(selected.value, 10) : 10;
        return [10, 20, 50].includes(size) ? size : 10;
    }

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

    async function createRoom() {
        const nickname = getNickname();
        if (!nicknameValid(nickname)) {
            showStatus(i18n().t('invalidNickname'), true);
            return;
        }

        const btn = document.getElementById('battleshipCreateBtn');
        if (btn) btn.disabled = true;
        showStatus(i18n().t('creating'), false);

        const result = await postJson(window.ABS_BATTLESHIP_API_CREATE, {
            nickname,
            client_id: storage().getClientId(),
            board_size: getBoardSize(),
            lang: i18n().getLang(),
        });

        if (btn) btn.disabled = false;

        if (!result.ok || !result.data.success) {
            const err = result.data.error || i18n().t('serverError');
            showStatus(err, true);
            if (window.AbsSiteToast) {
                window.AbsSiteToast.show(err, 'error');
            }
            return;
        }

        const session = result.data.data;
        storage().saveSession(session.public_id, session);
        if (session.nickname) {
            storage().setPreferredNickname(session.nickname);
        }
        window.location.href = session.room_href;
    }

    async function joinRoom(codeOverride) {
        const input = document.getElementById('battleshipRoomCodeInput');
        const code = String(codeOverride || (input ? input.value : '') || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');

        if (!/^[A-Z0-9]{6}$/.test(code)) {
            showStatus(i18n().t('invalidRoomCode'), true);
            return;
        }

        const btn = document.getElementById('battleshipJoinBtn');
        if (btn) btn.disabled = true;
        showStatus(i18n().t('joining'), false);

        const nickname = getNickname();
        const result = await postJson(window.ABS_BATTLESHIP_API_JOIN, {
            public_id: code,
            nickname,
            client_id: storage().getClientId(),
            lang: i18n().getLang(),
        });

        if (btn) btn.disabled = false;

        if (!result.ok || !result.data.success) {
            const err = result.data.error || i18n().t('serverError');
            showStatus(err, true);
            if (window.AbsSiteToast) {
                window.AbsSiteToast.show(err, 'error');
            }
            refreshOpenLobbies(false);
            return;
        }

        const session = result.data.data;
        storage().saveSession(session.public_id, session);
        if (session.nickname) {
            storage().setPreferredNickname(session.nickname);
        }
        window.location.href = session.room_href;
    }

    function setOpenLobbiesStatus(state, message) {
        const el = document.getElementById('battleshipOpenLobbiesStatus');
        if (!el) return;
        el.dataset.state = state;
        const icon = el.querySelector('i');
        const label = el.querySelector('span');
        if (label) label.textContent = message;
        if (!icon) return;
        if (state === 'loading') {
            icon.className = 'fas fa-circle-notch fa-spin';
            icon.hidden = false;
        } else if (state === 'empty' || state === 'error') {
            icon.className = 'fas fa-info-circle';
            icon.hidden = false;
        } else {
            icon.hidden = true;
        }
    }

    function renderOpenLobbies(lobbies) {
        lastOpenLobbies = Array.isArray(lobbies) ? lobbies.slice() : [];
        const listEl = document.getElementById('battleshipOpenLobbiesList');
        const statusEl = document.getElementById('battleshipOpenLobbiesStatus');
        if (!listEl) return;

        if (!lobbies.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            if (statusEl) statusEl.hidden = false;
            setOpenLobbiesStatus('empty', i18n().t('openLobbiesEmpty'));
            return;
        }

        if (statusEl) statusEl.hidden = true;
        listEl.hidden = false;
        listEl.innerHTML = lobbies.map((lobby) => {
            const code = escapeHtml(lobby.public_id || '');
            const host = escapeHtml(lobby.host || '');
            const boardSize = Number(lobby.board_size) || 10;
            return ''
                + '<article class="checkers-open-lobby-row" data-room="' + code + '">'
                + '<div class="checkers-open-lobby-row__main">'
                + '<span class="checkers-open-lobby-row__code">' + code + '</span>'
                + '<span class="checkers-open-lobby-row__host">' + escapeHtml(i18n().t('openLobbiesHost')) + ': ' + host + '</span>'
                + '<span class="checkers-open-lobby-row__slots">' + escapeHtml(i18n().t('openLobbiesBoard')) + ': ' + boardSize + '×' + boardSize + '</span>'
                + '</div>'
                + '<button type="button" class="checkers-submit-btn checkers-open-lobby-row__join" data-room="' + code + '">'
                + '<i class="fas fa-door-open" aria-hidden="true"></i> '
                + escapeHtml(i18n().t('openLobbiesJoin'))
                + '</button>'
                + '</article>';
        }).join('');

        listEl.querySelectorAll('.checkers-open-lobby-row__join').forEach((btn) => {
            btn.addEventListener('click', () => {
                const room = btn.getAttribute('data-room');
                if (room) joinRoom(room);
            });
        });
    }

    async function refreshOpenLobbies(showLoading) {
        const url = window.ABS_BATTLESHIP_API_LIST
            + (window.ABS_BATTLESHIP_API_LIST.indexOf('?') === -1 ? '?' : '&')
            + 'lang=' + encodeURIComponent(i18n().getLang());

        if (showLoading !== false) {
            const listEl = document.getElementById('battleshipOpenLobbiesList');
            if (listEl) listEl.hidden = true;
            const statusEl = document.getElementById('battleshipOpenLobbiesStatus');
            if (statusEl) statusEl.hidden = false;
            setOpenLobbiesStatus('loading', i18n().t('openLobbiesLoading'));
        }

        try {
            const response = await fetch(url, { credentials: 'same-origin' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                renderOpenLobbies([]);
                setOpenLobbiesStatus('error', data.error || i18n().t('openLobbiesError'));
                const statusEl = document.getElementById('battleshipOpenLobbiesStatus');
                if (statusEl) statusEl.hidden = false;
                return;
            }
            renderOpenLobbies(Array.isArray(data.data?.lobbies) ? data.data.lobbies : []);
        } catch (e) {
            const statusEl = document.getElementById('battleshipOpenLobbiesStatus');
            if (statusEl) statusEl.hidden = false;
            setOpenLobbiesStatus('error', i18n().t('openLobbiesError'));
            const listEl = document.getElementById('battleshipOpenLobbiesList');
            if (listEl) {
                listEl.hidden = true;
                listEl.innerHTML = '';
            }
        }
    }

    function startOpenLobbiesPolling() {
        if (openLobbiesTimer) {
            clearInterval(openLobbiesTimer);
        }
        refreshOpenLobbies(true);
        openLobbiesTimer = window.setInterval(() => {
            refreshOpenLobbies(false);
        }, OPEN_LOBBIES_POLL_MS);
    }

    function relocalizeView() {
        if (window.AbsBattleshipI18n) {
            window.AbsBattleshipI18n.applyDom();
            if (typeof window.AbsBattleshipI18n.updateNavLinks === 'function') {
                window.AbsBattleshipI18n.updateNavLinks(window.AbsBattleshipI18n.getLang());
            }
        }
        if (lastOpenLobbies.length) {
            renderOpenLobbies(lastOpenLobbies);
        }
    }

    function init() {
        if (window.AbsBattleshipI18n) {
            window.AbsBattleshipI18n.applyDom();
            if (typeof window.AbsBattleshipI18n.updateNavLinks === 'function') {
                window.AbsBattleshipI18n.updateNavLinks(window.AbsBattleshipI18n.getLang());
            }
        }

        const nickInput = document.getElementById('battleshipNicknameInput');
        if (nickInput && window.AbsAimNickname) {
            window.AbsAimNickname.bindInput(nickInput);
        }

        const createBtn = document.getElementById('battleshipCreateBtn');
        if (createBtn) {
            createBtn.addEventListener('click', createRoom);
        }

        const joinBtn = document.getElementById('battleshipJoinBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => joinRoom());
        }

        const codeInput = document.getElementById('battleshipRoomCodeInput');
        if (codeInput) {
            codeInput.addEventListener('input', () => {
                codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
            });
            codeInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    joinRoom();
                }
            });
        }

        if (document.getElementById('battleshipOpenLobbies')) {
            startOpenLobbiesPolling();
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && document.getElementById('battleshipOpenLobbies')) {
                refreshOpenLobbies(false);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    window.AbsBattleshipLobby = {
        relocalizeView,
    };
})();
