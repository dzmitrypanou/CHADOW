(() => {
    'use strict';

    const CLIENT_KEY = 'abs_tactics_client_id';
    const TOKEN_PREFIX = 'abs_tactics_token_';

    function getClientId() {
        let id = localStorage.getItem(CLIENT_KEY);
        if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
            id = 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(CLIENT_KEY, id);
        }
        return id;
    }

    function saveRoomSession(publicId, payload) {
        if (!publicId) return;
        localStorage.setItem(TOKEN_PREFIX + publicId, JSON.stringify({
            access_token: payload.access_token || '',
            ws_token: payload.ws_token || '',
            nickname: payload.nickname || '',
            client_id: payload.client_id || getClientId(),
            saved_at: Date.now(),
        }));
    }

    function loadRoomSession(publicId) {
        if (!publicId) return null;
        try {
            const raw = localStorage.getItem(TOKEN_PREFIX + publicId);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data && typeof data === 'object' ? data : null;
        } catch (e) {
            return null;
        }
    }

    function clearRoomSession(publicId) {
        if (publicId) {
            localStorage.removeItem(TOKEN_PREFIX + publicId);
        }
    }

    async function postJson(url, body, accessToken) {
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '',
        };
        if (accessToken) {
            headers['X-Tactics-Token'] = accessToken;
        }
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    async function getJson(url) {
        const res = await fetch(url, { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    async function postFormData(url, formData, accessToken) {
        const headers = {
            'X-CSRF-Token': window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '',
        };
        if (accessToken) {
            headers['X-Tactics-Token'] = accessToken;
        }
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: formData,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    window.AbsTacticsStore = {
        getClientId,
        saveRoomSession,
        loadRoomSession,
        clearRoomSession,
        postJson,
        postFormData,
        getJson,
    };
})();
