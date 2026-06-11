(() => {
    'use strict';

    const store = () => window.AbsTacticsStore;
    const i18n = () => window.AbsTacticsI18n;
    const cards = () => window.AbsTacticsCatalogCards;

    let catalogItems = [];

    async function loadCatalog() {
        const listEl = document.getElementById('tacticsCatalogList');
        const api = window.ABS_TACTICS_LIST_API;
        if (!listEl || !api) return;

        let items = [];
        const initial = window.ABS_TACTICS_INITIAL_LIST;
        if (initial && initial.success && Array.isArray(initial.data)) {
            items = initial.data;
        } else {
            const res = await store().getJson(api + '?limit=50');
            if (res.data && res.data.success) {
                items = res.data.data || [];
            }
        }
        catalogItems = items;
        cards().renderCatalog(listEl, catalogItems, window.ABS_TACTICS_ROOM_BASE);
    }

    function relocalizeView() {
        i18n().relocalizeDom(document.querySelector('.page-tactics-rooms') || document);
        cards().renderCatalog(
            document.getElementById('tacticsCatalogList'),
            catalogItems,
            window.ABS_TACTICS_ROOM_BASE,
        );
    }

    function init() {
        loadCatalog();
    }

    window.AbsTacticsRoomsPage = { relocalizeView };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
