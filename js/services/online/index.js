(() => {
    let currentLang = window.ABS_ONLINE_LANG === 'en' ? 'en' : 'ru';
    let realmLabels = window.ABS_ONLINE_REALM_LABELS || {};

    const cacheNote = document.getElementById('onlineCacheNote');
    const pollIntervalSeconds = 15;
    let pollInFlight = false;
    let lastPollStartedAt = 0;
    const clusterStateStorageKey = 'abs_online_cluster_state';
    const chartLegendStorageKey = 'abs_online_chart_legend';
    const chartRangeStorageKey = 'abs_online_chart_range_days';
    const defaultOpenClusters = new Set(['МТ RUBY']);
    let lastFetchedAt = '';
    let lastPayload = null;
    let pollTimer = null;
    const clusterUserState = {};
    let chartLegendState = {};
    let chartRangeDays = 7;

    try {
        const savedLegendState = JSON.parse(localStorage.getItem(chartLegendStorageKey) || '{}');
        if (savedLegendState && typeof savedLegendState === 'object') {
            chartLegendState = savedLegendState;
        }
    } catch (e) {
        chartLegendState = {};
    }

    try {
        const savedRange = Number(localStorage.getItem(chartRangeStorageKey) || '7');
        if (savedRange === 1 || savedRange === 7 || savedRange === 30) {
            chartRangeDays = savedRange;
        }
    } catch (e) {
        chartRangeDays = 7;
    }

    try {
        const savedState = JSON.parse(sessionStorage.getItem(clusterStateStorageKey) || '{}');
        if (savedState && typeof savedState === 'object') {
            Object.entries(savedState).forEach(([key, value]) => {
                if (key && (value === 'open' || value === 'closed')) {
                    clusterUserState[key] = value;
                }
            });
        }
    } catch (e) {
        // ignore
    }

    function getTranslations(langCode) {
        const isEn = langCode === 'en';
        return {
            updated: isEn ? 'Data updated:' : 'Данные обновлены:',
            apiUnavailable: isEn ? 'API unavailable' : 'API недоступен',
            server: isEn ? 'Server' : 'Сервер',
            status: isEn ? 'Status' : 'Статус',
            online: isEn ? 'Online' : 'Онлайн',
            onlineLabel: isEn ? 'online' : 'онлайн',
            recommendation: isEn ? 'Recommendation' : 'Рекомендация',
            total: isEn ? 'Total' : 'Всего',
            pageTitle: isEn ? 'Server Status' : 'Статус серверов',
        };
    }

    let t = getTranslations(currentLang);

    const chartInstances = {};

    const palette = [
        '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
        '#aed581', '#fff176', '#ffb74d', '#ff8a65', '#f06292',
    ];

    const legendCheckmarkPlugin = {
        id: 'legendCheckmarks',
        afterDraw(chart) {
            const legend = chart.legend;
            if (!legend || !legend.legendItems || !legend.legendHitBoxes) return;

            const boxWidth = legend.options.labels.boxWidth || 12;
            const boxHeight = legend.options.labels.boxHeight || boxWidth;
            const { ctx } = chart;

            ctx.save();
            legend.legendItems.forEach((item, index) => {
                const datasetIndex = item.datasetIndex;
                if (datasetIndex === undefined || !chart.isDatasetVisible(datasetIndex)) return;

                const hitBox = legend.legendHitBoxes[index];
                if (!hitBox) return;

                const boxTop = hitBox.top + (hitBox.height - boxHeight) / 2;
                const cx = hitBox.left + boxWidth / 2;
                const cy = boxTop + boxHeight / 2;
                const s = boxWidth * 0.22;

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.lineWidth = 1.6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(cx - s, cy + s * 0.1);
                ctx.lineTo(cx - s * 0.15, cy + s * 0.95);
                ctx.lineTo(cx + s * 1.1, cy - s * 0.85);
                ctx.stroke();
            });
            ctx.restore();
        },
    };

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function healthClass(health, majority, status) {
        const normalized = String(health || '').toLowerCase();
        if (normalized === 'down') return 'is-offline';
        if (normalized === 'issue') return 'is-major';
        if (normalized === 'dip') return 'is-minor';
        if (status === 'offline') return 'is-offline';
        if (majority === 'major') return 'is-major';
        if (majority === 'minor') return 'is-minor';
        return 'is-good';
    }

    function statusClass(majority, status, health) {
        return healthClass(health, majority, status);
    }

    function statusLabel(majority, status) {
        if (status === 'offline') return currentLang === 'en' ? 'Offline' : 'Офлайн';
        if (majority === 'major') return currentLang === 'en' ? 'Issues' : 'Проблемы';
        if (majority === 'minor') return currentLang === 'en' ? 'Unstable' : 'Нестабильно';
        return currentLang === 'en' ? 'Online' : 'Онлайн';
    }

    function recommendationLabel(value) {
        const map = {
            recommended: currentLang === 'en' ? 'Recommended' : 'Рекомендуется',
            available: currentLang === 'en' ? 'Available' : 'Доступен',
            not_available: currentLang === 'en' ? 'Unavailable' : 'Недоступен',
            not_recommended: currentLang === 'en' ? 'Not recommended' : 'Не рекомендуется',
        };
        return map[value] || value || '—';
    }

    function summaryLabel(item) {
        if (item && item.flag && realmLabels[item.flag]) {
            return realmLabels[item.flag];
        }
        return item?.title || '';
    }

    function clusterDisplayTitle(cluster) {
        if (cluster && cluster.flag) {
            if (cluster.flag === 'ru') {
                return currentLang === 'en' ? 'MT RUBY' : 'МТ RUBY';
            }
            if (realmLabels[cluster.flag]) {
                return realmLabels[cluster.flag];
            }
        }
        return clusterKey(cluster?.title);
    }

    function showApiError(message) {
        const text = message || t.apiUnavailable || window.ABS_ONLINE_EMPTY_MESSAGE || 'API недоступен';
        const dashboard = document.querySelector('.online-dashboard');
        let empty = document.getElementById('onlineEmpty');
        if (dashboard) dashboard.hidden = true;
        if (!empty) {
            empty = document.createElement('section');
            empty.className = 'online-empty';
            empty.id = 'onlineEmpty';
            document.querySelector('.online-service')?.appendChild(empty);
        }
        empty.hidden = false;
        empty.innerHTML = `<p>${escapeHtml(text)}</p>`;
    }

    function hideApiError() {
        const empty = document.getElementById('onlineEmpty');
        const dashboard = document.querySelector('.online-dashboard');
        if (empty) empty.hidden = true;
        if (dashboard) dashboard.hidden = false;
    }

    function updateStaticLabels() {
        const isEn = currentLang === 'en';
        document.querySelectorAll('.online-section-title[data-label-ru]').forEach((el) => {
            const label = el.getAttribute(isEn ? 'data-label-en' : 'data-label-ru');
            if (label) el.textContent = label;
        });
        document.querySelectorAll('.online-chart-range-btn[data-label-ru]').forEach((btn) => {
            const label = btn.getAttribute(isEn ? 'data-label-en' : 'data-label-ru');
            if (label) btn.textContent = label;
        });
    }

    function serverNameMap() {
        const maps = window.ABS_ONLINE_SERVER_NAMES || {};
        if (maps.ru || maps.en) {
            return maps[currentLang] || maps.ru || {};
        }
        return maps;
    }

    function serverDisplayName(realm, server) {
        const code = String(server?.code || server?.name || '').trim();
        if (!code) return '';
        const realmMap = serverNameMap()[realm] || {};
        if (realmMap[code]) return realmMap[code];
        if (realmMap[code.toUpperCase()]) return realmMap[code.toUpperCase()];
        return server?.name || code;
    }

    function relocalizeView() {
        t = getTranslations(currentLang);
        updateStaticLabels();
        if (!lastPayload || !lastPayload.data) return;
        renderSummary(lastPayload.data.summary || []);
        renderClusters(lastPayload.data.clusters || []);
        renderCharts(lastPayload.charts || {}, { forceFullSync: true });
        updateCacheNote(lastPayload.fetched_at);
    }

    function switchLanguage(newLang) {
        if (newLang !== 'ru' && newLang !== 'en') return false;
        if (currentLang === newLang) return true;
        currentLang = newLang;
        window.ABS_ONLINE_LANG = newLang;
        document.documentElement.lang = newLang;
        const pageTitle = getTranslations(newLang).pageTitle;
        if (typeof window.absSetDocumentTitle === 'function') {
            window.absSetDocumentTitle(pageTitle, newLang);
        } else {
            document.title = pageTitle;
        }
        relocalizeView();
        const empty = document.getElementById('onlineEmpty');
        if (empty && !empty.hidden) {
            const paragraph = empty.querySelector('p');
            if (paragraph) paragraph.textContent = t.apiUnavailable;
        }
        return true;
    }

    function formatLocalTime(utcString) {
        if (typeof window.absFormatUtcLocal === 'function') {
            return window.absFormatUtcLocal(utcString);
        }
        return utcString;
    }

    function updateCacheNote(fetchedAt) {
        if (!cacheNote) return;
        if (!fetchedAt) {
            cacheNote.innerHTML = '';
            return;
        }
        const display = escapeHtml(formatLocalTime(fetchedAt));
        cacheNote.innerHTML = `${t.updated} <time datetime="${escapeHtml(fetchedAt)}">${display}</time>`;
    }

    function summaryAllLabel() {
        return 'WoT All';
    }

    function summaryTotalOnline(summary) {
        if (!Array.isArray(summary)) return null;
        let total = 0;
        let hasValue = false;
        summary.forEach((item) => {
            const value = Number(item?.online);
            if (!Number.isNaN(value)) {
                total += value;
                hasValue = true;
            }
        });
        return hasValue ? total : null;
    }

    function renderSummary(summary) {
        const grid = document.getElementById('onlineSummaryGrid');
        if (!grid || !Array.isArray(summary)) return;
        const totalCard = `
            <article class="online-summary-card">
                <span class="online-summary-label">${escapeHtml(summaryAllLabel())}</span>
                <span class="online-summary-value">${fmtNum(summaryTotalOnline(summary))}</span>
            </article>
        `;
        const regionCards = summary.map((item) => `
            <article class="online-summary-card">
                <span class="online-summary-label">${escapeHtml(summaryLabel(item))}</span>
                <span class="online-summary-value">${fmtNum(item.online)}</span>
            </article>
        `).join('');
        grid.innerHTML = totalCard + regionCards;
    }

    function clusterKey(title) {
        return String(title || '').trim();
    }

    function isClusterExpanded(key) {
        if (Object.prototype.hasOwnProperty.call(clusterUserState, key)) {
            return clusterUserState[key] === 'open';
        }
        return defaultOpenClusters.has(key);
    }

    function persistClusterState() {
        try {
            sessionStorage.setItem(clusterStateStorageKey, JSON.stringify(clusterUserState));
        } catch (e) {
            // ignore
        }
    }

    function updateClusterCardUi(card, collapsed) {
        if (!card) return;
        const toggle = card.querySelector('.online-cluster-toggle');
        card.classList.toggle('is-collapsed', collapsed);
        if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function setClusterCollapsed(card, collapsed) {
        if (!card) return;
        const key = card.getAttribute('data-cluster-key') || '';
        if (key) {
            clusterUserState[key] = collapsed ? 'closed' : 'open';
        }
        updateClusterCardUi(card, collapsed);
        persistClusterState();
    }

    function applyCollapsedState(root) {
        if (!root) return;
        root.querySelectorAll('.online-cluster-card').forEach((card) => {
            const key = card.getAttribute('data-cluster-key') || '';
            updateClusterCardUi(card, !isClusterExpanded(key));
        });
    }

    function bindClusterToggles(root) {
        if (!root || root.dataset.toggleBound === '1') return;
        root.addEventListener('click', (event) => {
            const toggle = event.target.closest('.online-cluster-toggle');
            if (!toggle || !root.contains(toggle)) return;
            const card = toggle.closest('.online-cluster-card');
            if (!card) return;
            setClusterCollapsed(card, !card.classList.contains('is-collapsed'));
        });
        root.dataset.toggleBound = '1';
    }

    function uptimeStore() {
        return lastPayload?.uptime || window.ABS_ONLINE_UPTIME || {};
    }

    function uptimeBuckets(realm, code) {
        const realmData = uptimeStore()[realm];
        if (!realmData || typeof realmData !== 'object') return [];
        const buckets = realmData[code];
        return Array.isArray(buckets) ? buckets : [];
    }

    const uptimeHistoryHours = 24;
    const uptimeDisplayBucketSeconds = 1800;

    const uptimeStorageBucketSeconds = 900;

    function normalizeHealthState(state) {
        const value = String(state || 'good').toLowerCase();
        if (value === 'down' || value === 'issue' || value === 'dip' || value === 'good') return value;
        return 'good';
    }

    function fillTimelineBuckets(buckets, currentState) {
        const now = Date.now();
        const cutoff = now - uptimeHistoryHours * 3600 * 1000;
        const bucketMs = uptimeDisplayBucketSeconds * 1000;
        const storageBucketMs = uptimeStorageBucketSeconds * 1000;
        const currentBucket = Math.floor(now / bucketMs) * bucketMs;
        const startBucket = Math.floor(cutoff / bucketMs) * bucketMs;
        const rawByTs = new Map();

        (Array.isArray(buckets) ? buckets : []).forEach((bucket) => {
            if (!Array.isArray(bucket) || bucket.length < 2) return;
            rawByTs.set(Number(bucket[0]), normalizeHealthState(bucket[1]));
        });

        const stateWeight = { good: 0, dip: 1, issue: 2, down: 3 };
        const worstState = (left, right) => (
            (stateWeight[right] ?? 0) > (stateWeight[left] ?? 0) ? right : left
        );

        const filled = [];
        for (let ts = startBucket; ts <= currentBucket; ts += bucketMs) {
            let state = null;
            const windowEnd = ts + bucketMs;
            rawByTs.forEach((rawState, rawTs) => {
                if (rawTs >= ts && rawTs < windowEnd) {
                    state = state === null ? rawState : worstState(state, rawState);
                    return;
                }
                if (rawTs >= ts - storageBucketMs && rawTs < ts) {
                    state = state === null ? rawState : worstState(state, rawState);
                }
            });
            filled.push([ts, state || 'down']);
        }

        if (filled.length) {
            const lastIndex = filled.length - 1;
            if (rawByTs.size) {
                let latestTs = null;
                rawByTs.forEach((_state, rawTs) => {
                    if (latestTs === null || rawTs > latestTs) latestTs = rawTs;
                });
                if (latestTs !== null) {
                    filled[lastIndex][1] = worstState(filled[lastIndex][1], rawByTs.get(latestTs));
                }
            }
            if (currentState) {
                filled[lastIndex][1] = normalizeHealthState(currentState);
            }
        }
        return filled;
    }

    function renderUptimeBar(buckets, currentState) {
        const filled = fillTimelineBuckets(buckets, currentState);
        const lastIndex = filled.length - 1;
        const segments = filled.map((bucket, index) => {
            const state = escapeHtml(String(bucket?.[1] || 'down'));
            const latestClass = index === lastIndex ? ' is-latest' : '';
            return `<span class="online-uptime-seg is-${state}${latestClass}"></span>`;
        }).join('');
        return `<div class="online-uptime-wrap"><div class="online-uptime-bar">${segments}</div><span class="online-uptime-label">24h</span></div>`;
    }

    function renderClusters(clusters) {
        const root = document.getElementById('onlineClusters');
        if (!root || !Array.isArray(clusters)) return;

        root.innerHTML = clusters.map((cluster, index) => {
            const title = clusterDisplayTitle(cluster);
            const bodyId = `online-cluster-body-${index}`;
            const servers = Array.isArray(cluster.servers) ? cluster.servers : [];
            const realm = String(cluster.flag || '');
            const apiBuckets = uptimeBuckets(realm, '_api');
            let apiHealth = 'good';
            if (apiBuckets.length) {
                const apiLast = apiBuckets[apiBuckets.length - 1];
                apiHealth = normalizeHealthState(apiLast?.[1]);
            }
            const apiBar = `<div class="online-cluster-api"><span class="online-cluster-api-label">API</span>${renderUptimeBar(apiBuckets, apiHealth)}</div>`;
            const cards = servers.map((server) => {
                const majority = String(server.majority || '');
                const status = String(server.status || '');
                const health = String(server.health || '');
                const cls = statusClass(majority, status, health);
                const code = String(server.code || server.name || '');
                const serverLabel = serverDisplayName(realm, server);
                return `<article class="online-server-card">
                    <div class="online-server-head">
                        <span class="online-server-dot ${cls}" aria-hidden="true"></span>
                        <div class="online-server-title">
                            <span class="online-server-name">${escapeHtml(serverLabel)}</span>
                            <span class="online-server-online">(${escapeHtml(t.online)}: ${fmtNum(server.online)})</span>
                        </div>
                        <span class="online-server-rec ${cls}">${escapeHtml(recommendationLabel(server.recommendation || ''))}</span>
                    </div>
                    ${renderUptimeBar(uptimeBuckets(realm, code), server.health || 'good')}
                </article>`;
            }).join('');

            const onlineLabel = t.onlineLabel;
            const onlineMeta = cluster.online
                ? `<span class="online-cluster-online"><span class="online-cluster-online-value">${fmtNum(cluster.online)}</span><span class="online-cluster-online-label">${onlineLabel}</span></span>`
                : '';
            const expanded = isClusterExpanded(title);

            return `<article class="online-cluster-card${expanded ? '' : ' is-collapsed'}" data-cluster-key="${escapeHtml(title)}" data-cluster-realm="${escapeHtml(cluster.flag || '')}">
                <header class="online-cluster-head">
                    <button type="button" class="online-cluster-toggle" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${escapeHtml(bodyId)}">
                        <i class="fas fa-chevron-down online-cluster-chevron" aria-hidden="true"></i>
                        <span class="online-cluster-title">${escapeHtml(title)}</span>
                    </button>
                    <div class="online-cluster-meta">${onlineMeta}</div>
                </header>
                ${servers.length ? `<div class="online-cluster-body" id="${escapeHtml(bodyId)}">${apiBar}<div class="online-server-list">${cards}</div></div>` : ''}
            </article>`;
        }).join('');
        applyCollapsedState(root);
    }

    function applyPayload(data) {
        if (!data || !data.success || !data.data) return false;

        hideApiError();

        if (data.realm_labels && typeof data.realm_labels === 'object') {
            realmLabels = data.realm_labels;
        }
        if (data.server_names && typeof data.server_names === 'object') {
            window.ABS_ONLINE_SERVER_NAMES = data.server_names;
        }

        const prevFetchedAt = lastFetchedAt;
        const fetchedAtChanged = !!(data.fetched_at && data.fetched_at !== prevFetchedAt);
        const payloadChanged = !lastPayload
            || JSON.stringify(lastPayload.data) !== JSON.stringify(data.data)
            || JSON.stringify(lastPayload.charts) !== JSON.stringify(data.charts)
            || JSON.stringify(lastPayload.uptime) !== JSON.stringify(data.uptime);

        lastPayload = data;

        if (data.uptime && typeof data.uptime === 'object') {
            window.ABS_ONLINE_UPTIME = data.uptime;
        }

        if (fetchedAtChanged || payloadChanged) {
            renderSummary(data.data.summary || []);
            renderClusters(data.data.clusters || []);
            renderCharts(data.charts || {});
            if (data.fetched_at) {
                lastFetchedAt = data.fetched_at;
                updateCacheNote(data.fetched_at);
            }
        }

        return fetchedAtChanged || payloadChanged;
    }

    function getPollDelaySeconds(data) {
        const apiInterval = Number(data && data.poll_interval_seconds) || pollIntervalSeconds;
        const serverWait = data && data.rate_limit && Number.isFinite(data.rate_limit.wait_seconds)
            ? Math.max(0, data.rate_limit.wait_seconds)
            : 0;
        return Math.max(apiInterval, serverWait);
    }

    function schedulePoll(waitSeconds) {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        const delay = Math.max(pollIntervalSeconds, Number(waitSeconds) || pollIntervalSeconds) * 1000;
        pollTimer = setTimeout(pollStatus, delay);
    }

    async function pollStatus() {
        const now = Date.now();
        const minGapMs = pollIntervalSeconds * 1000;
        if (lastPollStartedAt && now - lastPollStartedAt < minGapMs) {
            schedulePoll(Math.ceil((minGapMs - (now - lastPollStartedAt)) / 1000));
            return;
        }
        if (pollInFlight) {
            schedulePoll(pollIntervalSeconds);
            return;
        }

        pollInFlight = true;
        lastPollStartedAt = now;

        try {
            const params = { lang: currentLang };
            const res = await fetch(`/api/get_online.php?${new URLSearchParams(params)}`);
            const data = await res.json();
            if (!data.success) {
                showApiError(data.error || t.apiUnavailable);
                schedulePoll(pollIntervalSeconds);
                return;
            }
            applyPayload(data);
            schedulePoll(getPollDelaySeconds(data));
        } catch (e) {
            showApiError(t.apiUnavailable);
            schedulePoll(pollIntervalSeconds);
        } finally {
            pollInFlight = false;
        }
    }

    function fmtNum(value) {
        if (value === null || value === undefined || value === '') return '—';
        const n = Number(value);
        if (Number.isNaN(n)) return '—';
        return n.toLocaleString(currentLang === 'en' ? 'en-US' : 'ru-RU');
    }

    function formatChartLabel(ts) {
        const d = new Date(ts);
        return d.toLocaleString(currentLang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function normalizeChartTimestamp(ts) {
        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return null;
        // Guard against legacy second-based timestamps in cached chart history.
        return n < 100000000000 ? n * 1000 : n;
    }

    function chartRangeMinTimestamp(timestamps) {
        if (!Array.isArray(timestamps) || !timestamps.length) return null;
        const maxTs = timestamps[timestamps.length - 1];
        if (!Number.isFinite(maxTs)) return null;
        return maxTs - chartRangeDays * 24 * 60 * 60 * 1000;
    }

    function extractSeriesTimestamps(seriesList) {
        if (!Array.isArray(seriesList) || !seriesList.length) return [];
        const totalSeries = seriesList.find((s) => s.name === 'chart_total');
        const primary = totalSeries || seriesList[0];
        return (primary?.data || [])
            .map((point) => normalizeChartTimestamp(point[0]))
            .filter((ts) => ts !== null);
    }

    function timestampsPrefixEqual(prev, next, length) {
        for (let i = 0; i < length; i++) {
            if (prev[i] !== next[i]) return false;
        }
        return true;
    }

    function destroyChart(realm) {
        const chart = chartInstances[realm];
        if (chart) {
            chart.destroy();
            delete chartInstances[realm];
        }
    }

    function persistChartLegendState() {
        try {
            localStorage.setItem(chartLegendStorageKey, JSON.stringify(chartLegendState));
        } catch (e) {
            // ignore
        }
    }

    function isSeriesVisible(realm, seriesName) {
        const realmState = chartLegendState[realm];
        if (!realmState || !Object.prototype.hasOwnProperty.call(realmState, seriesName)) {
            return true;
        }
        return realmState[seriesName] !== false;
    }

    function setSeriesVisibility(realm, seriesName, visible) {
        if (!realm || !seriesName) return;
        if (!chartLegendState[realm] || typeof chartLegendState[realm] !== 'object') {
            chartLegendState[realm] = {};
        }
        chartLegendState[realm][seriesName] = !!visible;
        persistChartLegendState();
    }

    function applySavedVisibility(realm, chart) {
        if (!chart || !Array.isArray(chart.data.datasets)) return;
        chart.data.datasets.forEach((dataset, index) => {
            const seriesName = dataset._absSeriesName;
            if (!seriesName) return;
            const visible = isSeriesVisible(realm, seriesName);
            chart.setDatasetVisibility(index, visible);
            dataset.hidden = !visible;
        });
    }

    function buildChartOptions(realm) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    maxHeight: 140,
                    labels: {
                        color: 'rgba(200, 220, 245, 0.9)',
                        boxWidth: 12,
                        boxHeight: 12,
                        font: { size: 11 },
                    },
                    onClick(_event, legendItem, legend) {
                        const chart = legend.chart;
                        const index = legendItem.datasetIndex;
                        if (index === undefined) return;
                        const nextVisible = !chart.isDatasetVisible(index);
                        chart.setDatasetVisibility(index, nextVisible);
                        chart.update();
                        const seriesName = chart.data.datasets[index]?._absSeriesName;
                        if (seriesName) {
                            setSeriesVisibility(realm, seriesName, nextVisible);
                        }
                    },
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            return `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: 'rgba(160, 180, 210, 0.8)',
                        maxTicksLimit: 8,
                    },
                    grid: { color: 'rgba(80, 110, 150, 0.18)' },
                },
                y: {
                    ticks: {
                        color: 'rgba(160, 180, 210, 0.8)',
                        callback: (value) => fmtNum(value),
                    },
                    grid: { color: 'rgba(80, 110, 150, 0.18)' },
                },
            },
        };
    }

    function seriesLabel(realm, seriesName) {
        if (seriesName === 'chart_total') return t.total;
        const name = serverDisplayName(realm, { code: seriesName });
        return name || seriesName;
    }

    function sortChartSeries(seriesList, realm) {
        return [...seriesList].sort((a, b) => {
            if (a.name === 'chart_total') return -1;
            if (b.name === 'chart_total') return 1;
            return seriesLabel(realm, a.name).localeCompare(
                seriesLabel(realm, b.name),
                currentLang === 'en' ? 'en' : 'ru'
            );
        });
    }

    function buildChartDatasets(seriesList, realm) {
        if (!Array.isArray(seriesList) || !seriesList.length) return { labels: [], datasets: [], timestamps: [] };

        const sortedSeries = sortChartSeries(seriesList, realm);
        const allTimestamps = [...new Set(
            sortedSeries.flatMap((series) => (series.data || [])
                .map((point) => normalizeChartTimestamp(point[0]))
                .filter((ts) => ts !== null))
        )].sort((a, b) => a - b);
        const minTs = chartRangeMinTimestamp(allTimestamps);
        const filteredTimestamps = minTs === null
            ? allTimestamps
            : allTimestamps.filter((ts) => ts >= minTs);
        const labels = filteredTimestamps.map((ts) => formatChartLabel(ts));
        const datasets = [];

        sortedSeries.forEach((series, index) => {
            const isTotal = series.name === 'chart_total';
            const color = palette[index % palette.length];
            const pointMap = new Map((series.data || []).flatMap((point) => {
                const ts = normalizeChartTimestamp(point[0]);
                if (ts === null) return [];
                return [[ts, point[1]]];
            }));
            const visible = isSeriesVisible(realm, series.name);
            datasets.push({
                label: seriesLabel(realm, series.name),
                _absSeriesName: series.name,
                data: filteredTimestamps.map((ts) => (pointMap.has(ts) ? pointMap.get(ts) : null)),
                borderColor: color,
                backgroundColor: isTotal ? 'rgba(100, 181, 246, 0.12)' : 'transparent',
                borderWidth: isTotal ? 2.5 : 1.2,
                pointRadius: 0,
                tension: 0,
                fill: isTotal,
                spanGaps: true,
                hidden: !visible,
            });
        });

        return { labels, datasets, timestamps: filteredTimestamps };
    }

    function applyBuiltChartData(chart, built) {
        chart.data.labels = built.labels;
        built.datasets.forEach((dataset, index) => {
            const existing = chart.data.datasets[index];
            if (existing) {
                existing.label = dataset.label;
                existing.data = dataset.data;
                existing.hidden = dataset.hidden;
                existing._absSeriesName = dataset._absSeriesName;
            } else {
                chart.data.datasets.push(dataset);
            }
        });
        if (chart.data.datasets.length > built.datasets.length) {
            chart.data.datasets.length = built.datasets.length;
        }
        chart.update('none');
    }

    function updateChartInstance(realm, seriesList, forceFullSync) {
        const canvas = document.getElementById(`onlineChart-${realm}`);
        const card = canvas ? canvas.closest('.online-chart-card') : null;
        if (!canvas || !Array.isArray(seriesList) || !seriesList.length) {
            destroyChart(realm);
            if (card) card.hidden = true;
            return;
        }
        if (card) card.hidden = false;

        const built = buildChartDatasets(seriesList, realm);
        const timestamps = built.timestamps.length ? built.timestamps : extractSeriesTimestamps(seriesList);
        const chart = chartInstances[realm];

        if (!chart) {
            const instance = new window.Chart(canvas, {
                type: 'line',
                data: {
                    labels: built.labels,
                    datasets: built.datasets,
                },
                plugins: [legendCheckmarkPlugin],
                options: buildChartOptions(realm),
            });
            applySavedVisibility(realm, instance);
            instance.update('none');
            instance._absTimestamps = timestamps.slice();
            chartInstances[realm] = instance;
            return;
        }

        const prevTimestamps = chart._absTimestamps || [];
        const canAppend = !forceFullSync
            && prevTimestamps.length > 0
            && timestamps.length >= prevTimestamps.length
            && timestampsPrefixEqual(prevTimestamps, timestamps, prevTimestamps.length)
            && chart.data.datasets.length === built.datasets.length;

        if (canAppend && timestamps.length > prevTimestamps.length) {
            for (let i = prevTimestamps.length; i < timestamps.length; i++) {
                chart.data.labels.push(built.labels[i]);
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    dataset.data.push(built.datasets[datasetIndex].data[i]);
                });
            }
            chart._absTimestamps = timestamps.slice();
            chart.update('none');
            return;
        }

        chart._absTimestamps = timestamps.slice();
        applyBuiltChartData(chart, built);
        applySavedVisibility(realm, chart);
        chart.update('none');
    }

    function renderCharts(charts, options) {
        if (!window.Chart || !charts) return;

        const forceFullSync = !!(options && options.forceFullSync);
        const activeRealms = new Set();

        Object.keys(realmLabels).forEach((realm) => {
            const chartData = charts[realm];
            if (!chartData || !Array.isArray(chartData.series) || !chartData.series.length) {
                destroyChart(realm);
                const canvas = document.getElementById(`onlineChart-${realm}`);
                const card = canvas ? canvas.closest('.online-chart-card') : null;
                if (card) card.hidden = true;
                return;
            }

            activeRealms.add(realm);
            updateChartInstance(realm, chartData.series, forceFullSync);
        });

        Object.keys(chartInstances).forEach((realm) => {
            if (!activeRealms.has(realm)) {
                destroyChart(realm);
            }
        });
    }

    function setChartRangeDays(days) {
        if (days !== 1 && days !== 7 && days !== 30) return;
        if (chartRangeDays === days) return;
        chartRangeDays = days;
        try {
            localStorage.setItem(chartRangeStorageKey, String(days));
        } catch (e) {
            // ignore
        }
        if (lastPayload && lastPayload.charts) {
            renderCharts(lastPayload.charts, { forceFullSync: true });
        }
    }

    function syncChartRangeButtons() {
        const root = document.getElementById('onlineChartRange');
        if (!root) return;
        root.querySelectorAll('.online-chart-range-btn').forEach((btn) => {
            const days = Number(btn.getAttribute('data-range-days'));
            btn.classList.toggle('is-active', days === chartRangeDays);
            btn.setAttribute('aria-pressed', days === chartRangeDays ? 'true' : 'false');
        });
    }

    function bindChartRangeControls() {
        const root = document.getElementById('onlineChartRange');
        if (!root || root.dataset.bound === '1') return;
        root.addEventListener('click', (event) => {
            const btn = event.target.closest('.online-chart-range-btn');
            if (!btn || !root.contains(btn)) return;
            const days = Number(btn.getAttribute('data-range-days'));
            if (days !== 1 && days !== 7 && days !== 30) return;
            setChartRangeDays(days);
            syncChartRangeButtons();
        });
        root.dataset.bound = '1';
        syncChartRangeButtons();
    }

    function initChartsWhenReady() {
        const start = () => renderCharts(window.ABS_ONLINE_CHARTS || {});
        if (window.Chart) {
            start();
            return;
        }
        const timer = setInterval(() => {
            if (!window.Chart) return;
            clearInterval(timer);
            start();
        }, 50);
        setTimeout(() => clearInterval(timer), 10000);
    }

    initChartsWhenReady();

    const initialNote = cacheNote ? cacheNote.querySelector('time') : null;
    if (initialNote) {
        lastFetchedAt = initialNote.getAttribute('datetime') || '';
    }

    if (window.ABS_ONLINE_DATA) {
        lastPayload = {
            success: true,
            data: window.ABS_ONLINE_DATA,
            charts: window.ABS_ONLINE_CHARTS || {},
            uptime: window.ABS_ONLINE_UPTIME || {},
            fetched_at: lastFetchedAt,
        };
    }

    bindClusterToggles(document.getElementById('onlineClusters'));
    applyCollapsedState(document.getElementById('onlineClusters'));
    bindChartRangeControls();
    pollStatus();

    window.AbsOnline = { switchLanguage };
})();
