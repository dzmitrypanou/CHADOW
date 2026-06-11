(() => {
    'use strict';

    const store = () => window.AbsTacticsStore;
    const i18n = () => window.AbsTacticsI18n;
    const maps = () => window.AbsTacticsMaps;

    function showError(el, message) {
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = message;
    }

    function bindVisibilityToggle() {
        const switchRoot = document.getElementById('tacticsVisibilitySwitch');
        const passwordWrap = document.getElementById('tacticsPasswordWrap');
        if (!switchRoot) return;

        const options = switchRoot.querySelectorAll('.bracket-visibility-switch__option input[type="radio"]');

        function syncActiveState() {
            switchRoot.querySelectorAll('.bracket-visibility-switch__option').forEach((label) => {
                const radio = label.querySelector('input[type="radio"]');
                label.classList.toggle('is-active', !!radio?.checked);
            });
        }

        function onVisibilityChange() {
            const closed = switchRoot.querySelector('input[name="visibility"]:checked')?.value === 'closed';
            if (passwordWrap) {
                passwordWrap.hidden = !closed;
            }
            if (!closed) {
                const passwordInput = document.getElementById('tacticsPassword');
                if (passwordInput) passwordInput.value = '';
            }
            syncActiveState();
        }

        options.forEach((radio) => {
            radio.addEventListener('change', onVisibilityChange);
        });

        onVisibilityChange();
    }

    let createMapPicker = null;

    function nicknameForGame(game) {
        const nicks = window.ABS_TACTICS_GAME_NICKS || {};
        const key = String(game || 'wot').toLowerCase();
        return nicks[key] || nicks.wot || '';
    }

    function syncCreateNickname(game) {
        const input = document.getElementById('tacticsNickname');
        if (!input) return;
        if (window.ABS_TACTICS_IS_LOGGED_IN) {
            const nick = nicknameForGame(game);
            if (nick) input.value = nick;
            return;
        }
        if (!input.dataset.userEdited) {
            const nick = nicknameForGame(game);
            if (nick) input.value = nick;
        }
    }

    function lockNicknameFields() {
        if (!window.ABS_TACTICS_IS_LOGGED_IN) return;
        ['tacticsNickname', 'tacticsJoinNickname'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.readOnly = true;
            el.setAttribute('aria-readonly', 'true');
            el.classList.add('tactics-input--locked');
        });
    }

    function syncCreateSubmitState() {
        const btn = document.getElementById('tacticsCreateBtn');
        if (!btn) return;

        let hasMaps = false;
        if (createMapPicker) {
            hasMaps = createMapPicker.hasMaps();
        } else {
            const select = document.getElementById('tacticsMapSelect');
            hasMaps = !!(select?.value && select.value.trim());
        }

        btn.disabled = !hasMaps;
        btn.classList.toggle('is-disabled', !hasMaps);
        btn.title = hasMaps ? '' : i18n().t('noMapsForMode');
    }

    function getCreateScrollTarget() {
        const panel = document.getElementById('tactics-create');
        if (!panel) return null;
        return panel.querySelector('.tactics-panel-title') || panel;
    }

    function scrollToCreatePanel() {
        if (window.location.hash !== '#tactics-create') return;
        const target = getCreateScrollTarget();
        if (!target) return;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    async function relocalizeView() {
        i18n().relocalizeDom(document.querySelector('.page-tactics-lobby') || document);
        if (createMapPicker) {
            await createMapPicker.relocalize();
        }
        syncCreateNickname(createMapPicker?.game || 'wot');
        syncCreateSubmitState();
    }

    async function handleCreate(ev) {
        ev.preventDefault();
        const errEl = document.getElementById('tacticsCreateError');
        const btn = document.getElementById('tacticsCreateBtn');
        showError(errEl, '');

        const title = document.getElementById('tacticsTitle')?.value?.trim() || '';
        const mapPick = createMapPicker?.getValue() || {
            map_code: document.getElementById('tacticsMapSelect')?.value || 'cliff',
            game: 'wot',
            battle_mode: 'random',
        };
        const nickname = window.ABS_TACTICS_IS_LOGGED_IN
            ? (nicknameForGame(mapPick.game) || document.getElementById('tacticsNickname')?.value?.trim() || 'Guest')
            : (document.getElementById('tacticsNickname')?.value?.trim() || 'Guest');
        if (!mapPick.map_code) {
            showError(errEl, i18n().t('noMapsForMode'));
            return;
        }
        const visibility = document.querySelector('input[name="visibility"]:checked')?.value || 'open';
        const password = document.getElementById('tacticsPassword')?.value || '';

        btn.disabled = true;
        try {
            const res = await store().postJson(window.ABS_TACTICS_CREATE_API, {
                nickname,
                title,
                map_code: mapPick.map_code || 'cliff',
                game: mapPick.game || 'wot',
                battle_mode: mapPick.battle_mode || 'random',
                visibility,
                password: visibility === 'closed' ? password : '',
                client_id: store().getClientId(),
                lang: i18n().getLang(),
            });

            if (!res.ok || !res.data.success) {
                showError(errEl, res.data.error || i18n().t('createError'));
                return;
            }

            const payload = res.data.data;
            store().saveRoomSession(payload.room.public_id, {
                access_token: payload.access_token,
                ws_token: payload.ws_token,
                nickname,
                client_id: store().getClientId(),
                is_owner: true,
            });
            window.location.href = payload.room_href || (window.ABS_TACTICS_LOBBY_BASE + '/' + payload.room.public_id);
        } finally {
            syncCreateSubmitState();
        }
    }

    async function handleJoin(ev) {
        ev.preventDefault();
        const errEl = document.getElementById('tacticsJoinError');
        showError(errEl, '');

        const publicId = (document.getElementById('tacticsJoinCode')?.value || '').trim().toUpperCase();
        const nickname = window.ABS_TACTICS_IS_LOGGED_IN
            ? (nicknameForGame('wot') || document.getElementById('tacticsJoinNickname')?.value?.trim() || 'Guest')
            : (document.getElementById('tacticsJoinNickname')?.value?.trim() || 'Guest');
        const password = document.getElementById('tacticsJoinPassword')?.value || '';

        const res = await store().postJson(window.ABS_TACTICS_JOIN_API, {
            public_id: publicId,
            nickname,
            password,
            client_id: store().getClientId(),
            lang: i18n().getLang(),
        });

        if (!res.ok || !res.data.success) {
            if (res.data.error && res.status === 403) {
                const pwWrap = document.getElementById('tacticsJoinPasswordWrap');
                if (pwWrap) pwWrap.hidden = false;
            }
            showError(errEl, res.data.error || i18n().t('joinError'));
            return;
        }

        const payload = res.data.data;
        store().saveRoomSession(publicId, {
            access_token: payload.access_token,
            ws_token: payload.ws_token,
            nickname,
            client_id: store().getClientId(),
        });
        window.location.href = payload.room_href || (window.ABS_TACTICS_LOBBY_BASE + '/' + publicId);
    }

    async function init() {
        bindVisibilityToggle();
        if (window.TacticsMapPicker) {
            createMapPicker = new window.TacticsMapPicker({
                root: document.getElementById('tacticsCreateMapPicker'),
                selectEl: document.getElementById('tacticsMapSelect'),
                onChange: (value) => {
                    syncCreateNickname(value?.game || createMapPicker?.game || 'wot');
                    syncCreateSubmitState();
                },
            });
            await createMapPicker.init();
            syncCreateNickname(createMapPicker.game || 'wot');
        } else {
            await maps().loadMaps();
            maps().populateSelect(document.getElementById('tacticsMapSelect'), i18n().getLang());
        }
        lockNicknameFields();
        syncCreateSubmitState();

        document.getElementById('tacticsNickname')?.addEventListener('input', (ev) => {
            if (!window.ABS_TACTICS_IS_LOGGED_IN && ev.target) {
                ev.target.dataset.userEdited = '1';
            }
        });

        document.getElementById('tacticsCreateForm')?.addEventListener('submit', handleCreate);
        document.getElementById('tacticsJoinForm')?.addEventListener('submit', handleJoin);

        window.addEventListener('tactics:catalog-updated', () => {
            createMapPicker?.relocalize();
            syncCreateSubmitState();
        });

        scrollToCreatePanel();
    }

    window.AbsTacticsLobby = { relocalizeView };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
