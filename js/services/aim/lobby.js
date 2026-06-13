(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const lb = () => window.AbsAimLeaderboard;
    const nick = () => window.AbsAimNickname;

    let trainers = [];

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function trainerHref(id) {
        return i18n().buildPlayHref(id, i18n().getLang());
    }

    function ratingsHref(trainerId) {
        const device = lb() && lb().viewDevice ? lb().viewDevice() : '';
        return i18n().buildRatingsHref(i18n().getLang(), trainerId, device);
    }

    function renderCard(trainer) {
        const duration = trainer.duration_sec
            ? trainer.duration_sec + ' ' + i18n().t('sec')
            : i18n().t('roundsDuration');
        return '<article class="aim-trainer-card" data-trainer="' + escapeHtml(trainer.id) + '">'
            + '<div class="aim-trainer-card__head">'
            + '<h3 class="aim-trainer-card__title">'
            + '<i class="fas ' + escapeHtml(trainer.icon || 'fa-crosshairs') + '" aria-hidden="true"></i> '
            + escapeHtml(i18n().trainerLabel(trainer.id))
            + '</h3>'
            + '<span class="aim-trainer-card__duration">' + escapeHtml(duration) + '</span>'
            + '</div>'
            + '<p class="aim-trainer-card__desc">' + escapeHtml(i18n().trainerDesc(trainer.id)) + '</p>'
            + '<a class="aim-btn aim-btn--primary aim-trainer-card__play" href="' + escapeHtml(trainerHref(trainer.id)) + '">'
            + '<i class="fas fa-play" aria-hidden="true"></i> '
            + escapeHtml(i18n().t('play'))
            + '</a>'
            + '<div class="aim-trainer-card__top">'
            + '<div class="aim-trainer-card__top-head">'
            + '<span class="aim-trainer-card__top-title">' + escapeHtml(i18n().t('top3')) + '</span>'
            + '<div class="aim-trainer-card__top-actions">'
            + '<div class="aim-lb-device-field">'
            + '<span class="aim-lb-device-label" data-aim-i18n="lbDeviceLabel">' + escapeHtml(i18n().t('lbDeviceLabel')) + '</span>'
            + '<div class="aim-lb-device-switch" data-aim-lb-device-switch></div>'
            + '</div>'
            + '<a class="aim-link-btn aim-trainer-card__full-top" data-aim-ratings-link data-trainer="' + escapeHtml(trainer.id) + '" href="' + escapeHtml(ratingsHref(trainer.id)) + '" aria-label="' + escapeHtml(i18n().t('fullTop')) + '" title="' + escapeHtml(i18n().t('fullTop')) + '">'
            + '<i class="fas fa-trophy" aria-hidden="true"></i>'
            + '<span class="aim-trainer-card__full-top-label" data-aim-i18n="fullTop">' + escapeHtml(i18n().t('fullTop')) + '</span>'
            + '</a>'
            + '</div>'
            + '</div>'
            + '<div class="aim-trainer-card__top-body" id="aimMiniLb-' + escapeHtml(trainer.id) + '"></div>'
            + '</div>'
            + '</article>';
    }

    function refreshMiniLeaderboards() {
        if (!lb()) return;
        trainers.forEach((trainer) => {
            const mini = document.getElementById('aimMiniLb-' + trainer.id);
            if (mini) {
                lb().renderMini(mini, trainer.id);
            }
        });
    }

    function renderTrainerGrid() {
        const grid = document.getElementById('aimTrainerGrid');
        if (!grid || !trainers.length) return;

        grid.innerHTML = trainers.map(renderCard).join('');

        trainers.forEach((trainer) => {
            const mini = document.getElementById('aimMiniLb-' + trainer.id);
            if (mini && lb()) {
                lb().renderMini(mini, trainer.id);
            }
        });

        if (lb() && lb().mountAllDeviceSwitches) {
            lb().mountAllDeviceSwitches();
        }
    }

    function relocalizeView() {
        if (window.AbsAimI18n) {
            window.AbsAimI18n.applyDom();
        }
        renderTrainerGrid();
    }

    function init() {
        trainers = window.ABS_AIM_TRAINERS || [];

        if (window.AbsAimI18n) {
            window.AbsAimI18n.applyDom();
        }
        if (window.AbsAimNickname) {
            window.AbsAimNickname.bindInput(document.getElementById('aimNicknameInput'));
        }

        if (!trainers.length) {
            return;
        }

        renderTrainerGrid();
        window.addEventListener('aim:devicechange', () => {
            if (lb() && lb().refreshMiniLayouts) {
                lb().refreshMiniLayouts(trainers);
            }
        });
        window.addEventListener('aim:lbviewchange', refreshMiniLeaderboards);
    }

    document.addEventListener('DOMContentLoaded', init);

    window.AbsAimLobby = {
        relocalizeView,
    };
})();
