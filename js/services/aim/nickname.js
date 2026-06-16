(() => {
    'use strict';

    const STORAGE_KEY = 'chadow_aim_nickname';
    const NAME_RE = /^[\p{L}\p{N}_\-. ]+$/u;

    function normalize(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    }

    function isValid(value) {
        const name = normalize(value);
        if (name.length < 2 || name.length > 32) {
            return false;
        }
        return NAME_RE.test(name);
    }

    function load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && isValid(stored)) {
                return normalize(stored);
            }
        } catch (e) {

        }
        const fallback = normalize(window.ABS_AIM_DEFAULT_NICKNAME || '');
        return isValid(fallback) ? fallback : '';
    }

    function save(value) {
        const name = normalize(value);
        if (!isValid(name)) {
            return false;
        }
        try {
            localStorage.setItem(STORAGE_KEY, name);
        } catch (e) {

        }
        return true;
    }

    function bindInput(input) {
        if (!input) {
            return;
        }
        const initial = load();
        if (initial && !input.value) {
            input.value = initial;
        }
        input.addEventListener('change', () => {
            save(input.value);
        });
        input.addEventListener('blur', () => {
            save(input.value);
        });
    }

    window.AbsAimNickname = {
        STORAGE_KEY,
        normalize,
        isValid,
        load,
        save,
        bindInput,
        getForSubmit() {
            const playInput = document.getElementById('aimResultNickname');
            if (playInput) {
                save(playInput.value);
                return normalize(playInput.value);
            }
            const input = document.getElementById('aimNicknameInput');
            if (input) {
                save(input.value);
                return normalize(input.value);
            }
            return load();
        },
    };

    document.addEventListener('DOMContentLoaded', () => {
        bindInput(document.getElementById('aimNicknameInput'));
        bindInput(document.getElementById('aimResultNickname'));
    });
})();
