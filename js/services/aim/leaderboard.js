(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const core = () => window.AbsAimCore;

    const leaderboardCache = new Map();
    const VIEW_STORAGE_KEY = 'abs_aim_lb_view_devices';
    const VIEW_STORAGE_KEY_LEGACY = 'abs_aim_lb_view_device';
    const RATINGS_DEVICE_KEY = '__ratings';

    let deviceSwitchBound = false;
    let ratingsPanelLoader = null;
    let lbViewChangeListener = null;
    let deviceLayoutListener = null;

    function hardwareDevice() {
        return core() && core().isMobileDevice() ? 'mobile' : 'desktop';
    }

    function readViewDevices() {
        try {
            const raw = sessionStorage.getItem(VIEW_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (e) {
            // ignore
        }

        try {
            const legacy = sessionStorage.getItem(VIEW_STORAGE_KEY_LEGACY);
            if (legacy === 'mobile' || legacy === 'desktop') {
                sessionStorage.removeItem(VIEW_STORAGE_KEY_LEGACY);
                return { __default: legacy };
            }
        } catch (e) {
            // ignore
        }

        return {};
    }

    function writeViewDevices(map) {
        try {
            sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(map));
        } catch (e) {
            // ignore
        }
    }

    function isRatingsPage() {
        return !!document.querySelector('.page-aim-ratings');
    }

    function viewRatingsDevice() {
        const stored = readViewDevices()[RATINGS_DEVICE_KEY];
        if (stored === 'mobile' || stored === 'desktop') {
            return stored;
        }
        const legacyDefault = readViewDevices().__default;
        if (legacyDefault === 'mobile' || legacyDefault === 'desktop') {
            return legacyDefault;
        }
        return hardwareDevice();
    }

    function normalizeTrainerId(trainerId) {
        return trainerId ? String(trainerId).toLowerCase() : '';
    }

    function viewDevice(trainerId) {
        if (isRatingsPage()) {
            return viewRatingsDevice();
        }
        const id = normalizeTrainerId(trainerId);
        if (id) {
            const stored = readViewDevices()[id];
            if (stored === 'mobile' || stored === 'desktop') {
                return stored;
            }
        }
        return hardwareDevice();
    }

    function isRatingsScopeSwitch(wrap) {
        return wrap && wrap.getAttribute('data-aim-lb-device-scope') === 'ratings';
    }

    function syncRatingsDeviceSwitchUI() {
        const active = viewRatingsDevice();
        document.querySelectorAll('[data-aim-lb-device-scope="ratings"]').forEach((wrap) => {
            wrap.querySelectorAll('.aim-lb-device-btn').forEach((btn) => {
                const device = btn.getAttribute('data-device');
                const isActive = device === active;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        });
    }

    function syncDeviceSwitchUI(trainerId) {
        syncRatingsDeviceSwitchUI();

        const id = normalizeTrainerId(trainerId);
        const selector = id
            ? '[data-aim-lb-device-switch][data-trainer="' + id + '"]:not([data-aim-lb-device-scope="ratings"])'
            : '[data-aim-lb-device-switch][data-trainer]:not([data-aim-lb-device-scope="ratings"])';

        document.querySelectorAll(selector).forEach((wrap) => {
            const switchTrainer = normalizeTrainerId(wrap.getAttribute('data-trainer'));
            if (!switchTrainer) {
                return;
            }
            const active = viewDevice(switchTrainer);
            wrap.querySelectorAll('.aim-lb-device-btn').forEach((btn) => {
                const device = btn.getAttribute('data-device');
                const isActive = device === active;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        });
    }

    function deviceSwitchButtonsMarkup(trainerId, scope) {
        const active = scope === 'ratings' ? viewRatingsDevice() : viewDevice(trainerId);
        const t = i18n().t;
        return '<button type="button" class="aim-lb-device-btn'
            + (active === 'desktop' ? ' is-active' : '')
            + '" data-device="desktop" aria-pressed="'
            + (active === 'desktop' ? 'true' : 'false')
            + '" title="' + escapeHtml(t('lbDeviceDesktop')) + '" aria-label="'
            + escapeHtml(t('lbDeviceDesktop')) + '">'
            + '<i class="fas fa-desktop" aria-hidden="true"></i>'
            + '</button>'
            + '<button type="button" class="aim-lb-device-btn'
            + (active === 'mobile' ? ' is-active' : '')
            + '" data-device="mobile" aria-pressed="'
            + (active === 'mobile' ? 'true' : 'false')
            + '" title="' + escapeHtml(t('lbDeviceMobile')) + '" aria-label="'
            + escapeHtml(t('lbDeviceMobile')) + '">'
            + '<i class="fas fa-mobile-alt" aria-hidden="true"></i>'
            + '</button>';
    }

    function bindDeviceSwitchEvents() {
        if (deviceSwitchBound) {
            return;
        }
        deviceSwitchBound = true;
        document.addEventListener('click', (event) => {
            const btn = event.target.closest('.aim-lb-device-btn[data-device]');
            const wrap = btn && btn.closest('[data-aim-lb-device-switch]');
            if (!btn || !wrap) {
                return;
            }
            const device = btn.getAttribute('data-device');
            if (device !== 'mobile' && device !== 'desktop') {
                return;
            }
            if (isRatingsScopeSwitch(wrap)) {
                setViewDevice(device, { scope: 'ratings' });
                return;
            }
            const trainerId = normalizeTrainerId(wrap.getAttribute('data-trainer'));
            if (!trainerId) {
                return;
            }
            setViewDevice(device, { trainerId });
        });
    }

    function updateRatingsLinksForTrainer(trainerId) {
        const id = normalizeTrainerId(trainerId);
        if (!id || !i18n()) {
            return;
        }
        const lang = i18n().getLang();
        document.querySelectorAll('[data-aim-ratings-link][data-trainer="' + id + '"]').forEach((el) => {
            el.setAttribute('href', i18n().buildRatingsHref(lang, id, viewDevice(id)));
        });
    }

    function setViewDevice(device, options) {
        const opts = options || {};
        if (device !== 'mobile' && device !== 'desktop') {
            return;
        }

        if (opts.scope === 'ratings' || (isRatingsPage() && !normalizeTrainerId(opts.trainerId))) {
            const map = readViewDevices();
            map[RATINGS_DEVICE_KEY] = device;
            writeViewDevices(map);
            syncRatingsDeviceSwitchUI();

            if (!opts.silent) {
                window.dispatchEvent(new CustomEvent('aim:lbviewchange', {
                    detail: { scope: 'ratings', device },
                }));
            }
            return;
        }

        const trainerId = normalizeTrainerId(opts.trainerId);
        if (!trainerId) {
            return;
        }

        const map = readViewDevices();
        map[trainerId] = device;
        writeViewDevices(map);
        syncDeviceSwitchUI(trainerId);
        updateRatingsLinksForTrainer(trainerId);

        if (!opts.silent) {
            window.dispatchEvent(new CustomEvent('aim:lbviewchange', {
                detail: { trainerId, device },
            }));
        }
    }

    function initViewDeviceFromUrl(activeTrainer) {
        const params = new URLSearchParams(window.location.search);
        const device = String(params.get('device') || '').toLowerCase();
        if (device !== 'mobile' && device !== 'desktop') {
            return;
        }
        if (isRatingsPage()) {
            setViewDevice(device, { scope: 'ratings', silent: true });
            return;
        }
        const trainer = normalizeTrainerId(activeTrainer || params.get('trainer'));
        if (trainer) {
            setViewDevice(device, { trainerId: trainer, silent: true });
        }
    }

    function mountAllDeviceSwitches() {
        bindDeviceSwitchEvents();
        if (!i18n()) {
            return;
        }
        const groupLabel = i18n().t('lbDeviceGroup');
        document.querySelectorAll('[data-aim-lb-device-scope="ratings"]').forEach((el) => {
            el.setAttribute('role', 'group');
            el.setAttribute('aria-label', groupLabel);
            el.innerHTML = deviceSwitchButtonsMarkup('', 'ratings');
        });
        document.querySelectorAll('[data-aim-lb-device-switch][data-trainer]:not([data-aim-lb-device-scope="ratings"])').forEach((el) => {
            const trainerId = normalizeTrainerId(el.getAttribute('data-trainer'));
            if (!trainerId) {
                return;
            }
            el.setAttribute('role', 'group');
            el.setAttribute('aria-label', groupLabel);
            el.innerHTML = deviceSwitchButtonsMarkup(trainerId);
        });
        syncRatingsDeviceSwitchUI();
        document.querySelectorAll('[data-aim-lb-device-switch][data-trainer]:not([data-aim-lb-device-scope="ratings"])').forEach((el) => {
            const trainerId = normalizeTrainerId(el.getAttribute('data-trainer'));
            if (trainerId) {
                syncDeviceSwitchUI(trainerId);
            }
        });
    }

    function setRatingsActiveTrainer(trainerId) {
        syncRatingsDeviceSwitchUI();
    }

    function cacheKey(trainer, limit, device) {
        return String(trainer) + ':' + String(limit || 50) + ':' + (device || viewDevice(trainer));
    }

    function itemsEqual(a, b) {
        if (!a && !b) return true;
        if (!a || !b || a.length !== b.length) return false;
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function seedItems(trainer, limit) {
        const device = viewDevice(trainer);
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
        const device = viewDevice(trainer);
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

    function refreshRatingsPanelLayout() {
        if (typeof ratingsPanelLoader !== 'function') {
            return;
        }
        const panel = document.getElementById('aimLeaderboardPanel');
        if (!panel) {
            return;
        }
        const table = panel.querySelector('.aim-leaderboard-table-wrap');
        if (!table) {
            return;
        }
        const rows = panel.querySelectorAll('tbody tr');
        if (!rows.length) {
            return;
        }
        const items = Array.from(rows).map((row, index) => {
            const cells = row.querySelectorAll('td');
            const gradeEl = cells[3] && cells[3].querySelector('.aim-grade');
            const gradeCode = gradeEl
                ? String(gradeEl.textContent || 'D').trim().charAt(0).toUpperCase()
                : 'D';
            return {
                rank: cells[0] ? cells[0].textContent.trim() : String(index + 1),
                player_name: cells[1] ? cells[1].textContent.trim() : '',
                score: cells[2] ? cells[2].textContent.trim() : '',
                grade: gradeCode,
            };
        });
        panel.innerHTML = renderTable(items);
    }

    window.AbsAimLeaderboard = {
        escapeHtml,
        renderTable,
        isCompactLayout,
        viewDevice,
        setViewDevice,
        initViewDeviceFromUrl,
        mountAllDeviceSwitches,
        setRatingsActiveTrainer,
        syncDeviceSwitchUI,
        fetchLeaderboard,
        mountTabs(container, panel, trainers, activeId, options) {
            if (!container || !panel || !trainers || !trainers.length) return;

            const opts = options || {};
            let current = activeId || trainers[0].id;
            setRatingsActiveTrainer(current);

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
                        setRatingsActiveTrainer(current);
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
                const device = viewDevice(current);
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

            ratingsPanelLoader = loadPanel;

            if (lbViewChangeListener) {
                window.removeEventListener('aim:lbviewchange', lbViewChangeListener);
            }
            if (deviceLayoutListener) {
                window.removeEventListener('aim:devicechange', deviceLayoutListener);
            }
            lbViewChangeListener = (event) => {
                const detail = event && event.detail ? event.detail : {};
                if (detail.scope === 'ratings') {
                    loadPanel();
                    return;
                }
                const trainerId = normalizeTrainerId(detail.trainerId);
                if (trainerId && trainerId !== normalizeTrainerId(current)) {
                    return;
                }
                loadPanel();
            };
            deviceLayoutListener = refreshRatingsPanelLayout;
            window.addEventListener('aim:lbviewchange', lbViewChangeListener);
            window.addEventListener('aim:devicechange', deviceLayoutListener);

            renderTabs();
            loadPanel();
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
