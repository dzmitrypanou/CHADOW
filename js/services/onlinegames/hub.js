(() => {
    'use strict';

    function relocalizeView() {
        if (!window.AbsCheckersI18n) return;
        window.AbsCheckersI18n.applyDom();
        if (typeof window.AbsCheckersI18n.updateNavLinks === 'function') {
            window.AbsCheckersI18n.updateNavLinks(window.AbsCheckersI18n.getLang());
        }
    }

    function init() {
        relocalizeView();
    }

    document.addEventListener('DOMContentLoaded', init);

    window.AbsOnlinegamesHub = {
        relocalizeView,
    };
})();
