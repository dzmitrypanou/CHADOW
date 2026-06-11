(() => {
    'use strict';

    const GuestStore = window.AbsBracketGuestStore;

    function getCsrf() {
        return window.ABS_SITE_CSRF || window.ABS_BRACKET_CSRF || window.ABS_PROFILE_CSRF || '';
    }

    function getClaimApi() {
        return window.ABS_BRACKET_CLAIM_API || '';
    }

    async function claimAllStoredBrackets() {
        const api = getClaimApi();
        if (!api) {
            return { claimed: [] };
        }

        const tokens = GuestStore?.listTokens?.() || {};
        const items = Object.entries(tokens)
            .filter(([publicId, token]) => publicId && token)
            .map(([public_id, edit_token]) => ({ public_id, edit_token }));

        const res = await fetch(api, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrf(),
            },
            body: JSON.stringify({ items }),
        });

        const json = await res.json();
        if (!json.success) {
            throw new Error(json.error || 'Claim failed');
        }

        const claimed = json.data?.claimed || [];
        if (claimed.length > 0 && GuestStore) {
            GuestStore.removeTokens(claimed);
        }

        return json.data || { claimed: [] };
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.ABS_SITE_LOGGED_IN) {
            return;
        }
        claimAllStoredBrackets().catch(() => {
            // токены могли устареть — не мешаем работе сайта
        });
    });

    window.AbsBracketClaim = { claimAllStoredBrackets };
})();
