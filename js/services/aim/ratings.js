(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const lb = () => window.AbsAimLeaderboard;

    let trainers = [];
    let activeTrainer = '';

    function trainerFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const trainer = String(params.get('trainer') || '').toLowerCase();
        if (trainer && trainers.some((t) => t.id === trainer)) {
            return trainer;
        }
        return '';
    }

    function updateRatingsUrl(trainerId) {
        const base = i18n().buildRatingsHref(i18n().getLang());
        const url = trainerId ? base + '?trainer=' + encodeURIComponent(trainerId) : base;
        window.history.replaceState({}, '', url);
    }

    function renderLeaderboard() {
        const tabs = document.getElementById('aimLeaderboardTabs');
        const panel = document.getElementById('aimLeaderboardPanel');
        if (!tabs || !panel || !trainers.length || !lb()) return;

        const activeBtn = tabs.querySelector('.aim-lb-tab.is-active');
        if (activeBtn) {
            activeTrainer = activeBtn.getAttribute('data-trainer') || activeTrainer;
        }
        if (!activeTrainer) {
            activeTrainer = trainers[0].id;
        }

        lb().mountTabs(tabs, panel, trainers, activeTrainer, {
            onTabChange(trainerId) {
                activeTrainer = trainerId;
                updateRatingsUrl(trainerId);
            },
        });
    }

    function relocalizeView() {
        if (window.AbsAimI18n) {
            window.AbsAimI18n.applyDom();
        }

        const hubHref = i18n().buildHubBase(i18n().getLang());
        document.querySelectorAll('.aim-back-link[href*="services/aim"]').forEach((link) => {
            link.setAttribute('href', hubHref);
        });

        renderLeaderboard();
    }

    function init() {
        trainers = window.ABS_AIM_TRAINERS || [];
        activeTrainer = trainerFromUrl() || (trainers[0] && trainers[0].id) || '';

        if (window.AbsAimI18n) {
            window.AbsAimI18n.applyDom();
        }

        if (!trainers.length) {
            return;
        }

        renderLeaderboard();
    }

    document.addEventListener('DOMContentLoaded', init);

    window.AbsAimRatings = {
        relocalizeView,
    };
})();
