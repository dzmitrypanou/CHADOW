(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const core = () => window.AbsAimCore;
    const nick = () => window.AbsAimNickname;

    const leaderboardCache = new Map();

    function currentDevice() {
        return core() && core().isMobileDevice() ? 'mobile' : 'desktop';
    }

    function cacheKey(trainer, limit, device) {
        return String(trainer) + ':' + String(limit || 50) + ':' + (device || currentDevice());
    }

    function itemsEqual(a, b) {
        if (!a && !b) return true;
        if (!a || !b || a.length !== b.length) return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function seedItems(trainer, limit) {
        const device = currentDevice();
        const key = cacheKey(trainer, limit, device);
        if (leaderboardCache.has(key)) {
            return leaderboardCache.get(key);
        }
        const seed = window.ABS_AIM_MINI_LEADERBOARDS;
        if (limit === 3 && seed && seed[device] && Array.isArray(seed[device][trainer])) {
            leaderboardCache.set(key, seed[device][trainer]);
            return seed[device][trainer];
        }
        return null;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderGradeBadge(gradeCode, gradeClass, compact) {
        if (compact) {
            return '<span class="' + gradeClass + '">' + escapeHtml(gradeCode) + '</span>';
        }
        return '<span class="' + gradeClass + '">'
            + '<span class="aim-grade__short">' + escapeHtml(gradeCode) + '</span>'
            + '<span class="aim-grade__full">' + escapeHtml(i18n().gradeLabel(gradeCode)) + '</span>'
            + '</span>';
    }

    function isCompactLayout() {
        return core() && core().isMobileDevice();
    }

    function renderTable(items, compact) {
        const compactLayout = compact != null ? compact : isCompactLayout();
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
                + '<td class="aim-lb-grade">' + renderGradeBadge(gradeCode, gradeClass, compactLayout) + '</td>'
                + '</tr>';
        }).join('');

        const wrapClass = compactLayout
            ? 'aim-leaderboard-table-wrap aim-leaderboard-table-wrap--compact'
            : 'aim-leaderboard-table-wrap';
        const tableClass = compactLayout
            ? 'aim-leaderboard-table aim-leaderboard-table--compact'
            : 'aim-leaderboard-table';

        return '<div class="' + wrapClass + '">'
            + '<table class="' + tableClass + '">'
            + '<thead><tr>'
            + '<th>' + escapeHtml(i18n().t('rank')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('player')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('score')) + '</th>'
            + '<th>' + escapeHtml(i18n().t('grade')) + '</th>'
            + '</tr></thead>'
            + '<tbody>' + rows + '</tbody>'
            + '</table>'
            + '</div>';
    }

    async function fetchLeaderboard(trainer, limit) {
        const api = window.ABS_AIM_API_LEADERBOARD || '/api/aim/leaderboard.php';
        const device = currentDevice();
        const url = api
            + '?trainer=' + encodeURIComponent(trainer)
            + '&limit=' + encodeURIComponent(String(limit || 50))
            + '&device=' + encodeURIComponent(device);
        const res = await fetch(url, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data || !data.success) {
            throw new Error((data && data.error) || 'load_failed');
        }
        const items = data.items || [];
        leaderboardCache.set(cacheKey(trainer, limit, device), items);
        return items;
    }

    window.AbsAimLeaderboard = {
        escapeHtml,
        renderTable,
        isCompactLayout,
        currentDevice,
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
                const limit = 50;
                const device = currentDevice();
                const cached = seedItems(current, limit) || leaderboardCache.get(cacheKey(current, limit, device));
                if (cached) {
                    panel.innerHTML = renderTable(cached);
                } else {
                    panel.innerHTML = '<p class="aim-leaderboard-loading">' + escapeHtml(i18n().t('leaderboardLoading')) + '</p>';
                }
                try {
                    const items = await fetchLeaderboard(current, limit);
                    if (!itemsEqual(cached, items)) {
                        panel.innerHTML = renderTable(items);
                    }
                } catch (e) {
                    if (!cached) {
                        panel.innerHTML = '<p class="aim-leaderboard-error">' + escapeHtml(i18n().t('leaderboardError')) + '</p>';
                    }
                }
            }

            renderTabs();
            loadPanel();
            window.addEventListener('aim:devicechange', loadPanel);
        },
        renderMini(container, trainerId, options) {
            if (!container) return Promise.resolve();

            const opts = options || {};
            const limit = 3;
            const cached = seedItems(trainerId, limit);

            if (opts.layoutOnly && cached) {
                container.innerHTML = renderTable(cached);
                return Promise.resolve();
            }

            if (cached) {
                container.innerHTML = renderTable(cached);
            } else if (!container.textContent.trim()) {
                container.innerHTML = '<p class="aim-leaderboard-loading">' + escapeHtml(i18n().t('leaderboardLoading')) + '</p>';
            }

            return fetchLeaderboard(trainerId, limit)
                .then((items) => {
                    if (!itemsEqual(cached, items)) {
                        container.innerHTML = renderTable(items);
                    }
                })
                .catch(() => {
                    if (!cached) {
                        container.innerHTML = '<p class="aim-leaderboard-error">' + escapeHtml(i18n().t('leaderboardError')) + '</p>';
                    }
                });
        },
        refreshMiniLayouts(trainers) {
            if (!Array.isArray(trainers)) return;
            trainers.forEach((trainer) => {
                const id = trainer && trainer.id ? trainer.id : trainer;
                const container = document.getElementById('aimMiniLb-' + id);
                if (container) {
                    this.renderMini(container, id, { layoutOnly: true });
                }
            });
        },
    };
})();
