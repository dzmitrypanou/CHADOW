(() => {
    'use strict';

    const STORAGE_KEY = 'abs_checkers_session_v1';

    function read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data && typeof data === 'object' ? data : null;
        } catch (e) {
            return null;
        }
    }

    function write(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // ignore quota errors
        }
    }

    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // ignore
        }
    }

    function getClientId() {
        const existing = read();
        if (existing && existing.client_id) {
            return existing.client_id;
        }
        const clientId = 'c' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        write(Object.assign({}, existing || {}, { client_id: clientId }));
        return clientId;
    }

    function saveSession(publicId, session) {
        write({
            client_id: session.client_id || getClientId(),
            public_id: publicId,
            ws_token: session.ws_token,
            color: session.color,
            nickname: session.nickname,
            preferred_nickname: session.nickname || read()?.preferred_nickname || '',
        });
    }

    function getPreferredNickname() {
        const data = read();
        return data && data.preferred_nickname ? String(data.preferred_nickname) : '';
    }

    function setPreferredNickname(nickname) {
        const data = read() || {};
        data.preferred_nickname = String(nickname || '').trim();
        write(data);
    }

    function getSession(publicId) {
        const data = read();
        if (!data || data.public_id !== publicId) {
            return null;
        }
        return data;
    }

    function clearSession(publicId) {
        const data = read();
        if (!data || data.public_id !== publicId) {
            return;
        }
        delete data.ws_token;
        delete data.color;
        delete data.nickname;
        write(data);
    }

    window.AbsCheckersStorage = {
        getClientId,
        saveSession,
        getSession,
        clearSession,
        getPreferredNickname,
        setPreferredNickname,
        clear,
    };
})();
