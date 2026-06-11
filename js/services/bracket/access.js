(() => {
    'use strict';

    const GuestStore = window.AbsBracketGuestStore;

    function getCsrf() {
        return window.ABS_BRACKET_CSRF || window.ABS_SITE_CSRF || '';
    }

    /**
     * @param {string} publicId
     * @returns {Promise<{can_edit:boolean,is_logged_owner:boolean,claimed:boolean}>}
     */
    async function verifyEditAccess(publicId) {
        const api = window.ABS_BRACKET_CHECK_ACCESS_API;
        if (!api || !publicId) {
            return { can_edit: false, is_logged_owner: false, claimed: false };
        }

        const payload = { public_id: publicId };
        const token = GuestStore?.getToken(publicId);
        if (token) {
            payload.edit_token = token;
        }

        const res = await fetch(api, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrf(),
            },
            body: JSON.stringify(payload),
        });

        let json = null;
        try {
            json = await res.json();
        } catch (e) {
            return { can_edit: false, is_logged_owner: false, claimed: false };
        }

        if (!json.success || !json.data) {
            const err = String(json?.error || '');
            const isTokenError = /токен|token/i.test(err);
            if (token && isTokenError) {
                GuestStore.removeToken(publicId);
            }
            return { can_edit: false, is_logged_owner: false, claimed: false };
        }

        if (json.data.claimed) {
            GuestStore.removeToken(publicId);
        } else if (!json.data.can_edit && token) {
            GuestStore.removeToken(publicId);
        }

        return json.data;
    }

    window.AbsBracketAccess = { verifyEditAccess };
})();
