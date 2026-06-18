(() => {
    'use strict';

    function relocalizeView() {
        if (window.AbsCheckersI18n) {
            window.AbsCheckersI18n.applyDom();
            if (typeof window.AbsCheckersI18n.updateNavLinks === 'function') {
                window.AbsCheckersI18n.updateNavLinks(window.AbsCheckersI18n.getLang());
            }
        }
        if (window.AbsBattleshipI18n) {
            window.AbsBattleshipI18n.applyDom();
            if (typeof window.AbsBattleshipI18n.updateNavLinks === 'function') {
                window.AbsBattleshipI18n.updateNavLinks(window.AbsBattleshipI18n.getLang());
            }
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
