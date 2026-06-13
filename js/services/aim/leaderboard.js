(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const core = () => window.AbsAimCore;
    const nick = () => window.AbsAimNickname;

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderTable(items, compact) {
        if (!items || !items.length) {
            return '<p class="aim-leaderboard-empty">' + escapeHtml(i18n().t('leaderboardEmpty')) + '</p>';
        }
        const rows = items.map((row) => {
            const gradeCode = String(row.grade || 'D').toUpperCase();
            const gradeClass = 'aim-grade ' + i18n().gradeClass(gradeCode);
            return '<tr>'
                + '<td class="aim-lb-rank">' + escapeHtml(String(row.rank)) + '</td>'
                + '<td class="aim-lb-player">' + escapeHtml(row.player_name) + '</td>'
                + '<td class="aim-lb-score">' + escapeHtml(String(row.score)) + '</td>'
                + '<td class="aim-lb-grade"><span class="' + gradeClass + '">' + escapeHtml(i18n().gradeLabel(gradeCode)) + '</span></td>'
                + '</tr>';
        }).join('');

        const limitNote = compact ? '' : '';
        return '<div class="aim-leaderboard-table-wrap">'
            + '<table class="aim-leaderboard-table">'
            + '<thead><tr>'
            + '<th>' + escapeHtml(i18n().t('rank')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('player')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('score')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('grade')) + '</th>'
            + '</tr></thead>'
            + '<tbody>' + rows + '</tbody>'
            + '</table>'
            + limitNote
            + '</div>';
    }

    async function fetchLeaderboard(trainer, limit) {
        const api = window.ABS_AIM_API_LEADERBOARD || '/api/aim/leaderboard.php';
        const url = api + '?trainer=' + encodeURIComponent(trainer) + '&limit=' + encodeURIComponent(String(limit || 50));
        const res = await fetch(url, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data || !data.success) {
            throw new Error((data && data.error) || 'load_failed');
        }
        return data.items || [];
    }

    window.AbsAimLeaderboard = {
        escapeHtml,
        renderTable,
        fetchLeaderboard,
        mountTabs(container, panel, trainers, activeId, options) {
            if (!container || !panel || !trainers || !trainers.length) return;

            const opts = options || {};
            let current = activeId || trainers[0].id;

            function renderTabs() {
                container.innerHTML = trainers.map((t) => {
                    const active = t.id === current ? ' is-active' : '';
                    return '<button type="button" class="aim-lb-tab' + active + '" role="tab" aria-selected="'
                        + (t.id === current ? 'true' : 'false')
                        + '" data-trainer="' + escapeHtml(t.id) + '">'
                        + escapeHtml(i18n().trainerLabel(t.id))
                        + '</button>';
                }).join('');

                container.querySelectorAll('.aim-lb-tab').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        current = btn.getAttribute('data-trainer');
                        renderTabs();
                        loadPanel();
                        if (typeof opts.onTabChange === 'function') {
                            opts.onTabChange(current);
                        }
                    });
                });
            }

            async function loadPanel() {
                panel.innerHTML = '<p class="aim-leaderboard-loading">' + escapeHtml(i18n().t('leaderboardLoading')) + '</p>';
                try {
                    const items = await fetchLeaderboard(current, 50);
                    panel.innerHTML = renderTable(items, false);
                } catch (e) {
                    panel.innerHTML = '<p class="aim-leaderboard-error">' + escapeHtml(i18n().t('leaderboardError')) + '</p>';
                }
            }

            renderTabs();
            loadPanel();
        },
        async renderMini(container, trainerId) {
            if (!container) return;
            container.innerHTML = '<p class="aim-leaderboard-loading">' + escapeHtml(i18n().t('leaderboardLoading')) + '</p>';
            try {
                const items = await fetchLeaderboard(trainerId, 3);
                container.innerHTML = renderTable(items, true);
            } catch (e) {
                container.innerHTML = '<p class="aim-leaderboard-error">' + escapeHtml(i18n().t('leaderboardError')) + '</p>';
            }
        },
    };
})();
