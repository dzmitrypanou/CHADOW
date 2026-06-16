(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        const link = document.getElementById('bracketGuestEditLink');
        const publicId = window.ABS_BRACKET_PUBLIC_ID;
        if (!link || !publicId || window.ABS_BRACKET_IS_OWNER || !window.ABS_BRACKET_IS_GUEST) {
            return;
        }

        const token = window.AbsBracketGuestStore?.getToken(publicId);
        if (!token) {
            return;
        }

        try {
            const access = await window.AbsBracketAccess.verifyEditAccess(publicId);
            if (access.can_edit) {
                link.hidden = false;
            }
        } catch (e) {

        }
    });
})();
