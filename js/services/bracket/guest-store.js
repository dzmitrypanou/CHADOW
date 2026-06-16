(() => {
    'use strict';

    const STORAGE_KEY = 'abs_bracket_tokens';

    function readAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function writeAll(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {

        }
    }

    function getToken(publicId) {
        const all = readAll();
        return all[publicId] || null;
    }

    function setToken(publicId, token) {
        if (!publicId || !token) return;
        const all = readAll();
        all[publicId] = token;
        writeAll(all);
    }

    function removeToken(publicId) {
        const all = readAll();
        if (all[publicId]) {
            delete all[publicId];
            writeAll(all);
        }
    }

    function listTokens() {
        return readAll();
    }

    function consumeHashToken(publicId) {
        if (!publicId || !window.location.hash) {
            return null;
        }
        const match = window.location.hash.match(/^#bk=([a-f0-9]{32,128})$/i);
        if (!match) {
            return null;
        }
        const token = match[1];
        setToken(publicId, token);
        try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch (e) {

        }
        return token;
    }

    function removeTokens(publicIds) {
        const all = readAll();
        let changed = false;
        (publicIds || []).forEach((id) => {
            if (all[id]) {
                delete all[id];
                changed = true;
            }
        });
        if (changed) {
            writeAll(all);
        }
    }

    window.AbsBracketGuestStore = {
        getToken,
        setToken,
        removeToken,
        listTokens,
        removeTokens,
        consumeHashToken,
        STORAGE_KEY,
    };
})();
