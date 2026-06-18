(() => {
    'use strict';

    const i18n = () => window.AbsReservesI18n;
    const toast = (msg, type) => {
        if (typeof window.showSiteToast === 'function') {
            window.showSiteToast(msg, type || 'info');
        }
    };

    let catalogItems = [];
    let rulesCache = [];
    let logCache = [];
    let lastCatalogErrorCode = '';
    let catalogLoadSeq = 0;
    let rulesLoadSeq = 0;
    let editingRuleId = 0;
    let activeLink = window.ABS_RESERVES_ACTIVE || null;

    function resetWorkspaceForLinkSwitch() {
        catalogLoadSeq += 1;
        rulesLoadSeq += 1;

        const root = document.getElementById('reservesCatalog');
        const loading = document.getElementById('reservesCatalogLoading');
        const rulesLoading = document.getElementById('reservesRulesLoading');
        const rulesList = document.getElementById('reservesRulesList');
        const logRoot = document.getElementById('reservesLog');

        clearCatalogError();
        catalogItems = [];
        rulesCache = [];
        logCache = [];

        if (root) root.innerHTML = '';
        if (loading) loading.hidden = false;
        if (rulesLoading) rulesLoading.hidden = false;
        if (rulesList) rulesList.innerHTML = '';
        if (logRoot) logRoot.innerHTML = '';
        fillRuleSelects([]);
    }

    function activeLinkQuery() {
        const params = new URLSearchParams();
        if (activeLink?.link_id) {
            params.set('link_id', String(activeLink.link_id));
        }
        params.set('lang', i18n().getLang());
        return '?' + params.toString();
    }

    function showCatalogError(code, status = 0) {
        const errEl = document.getElementById('reservesCatalogError');
        const root = document.getElementById('reservesCatalog');
        lastCatalogErrorCode = code || 'unknown';
        if (errEl) {
            errEl.hidden = false;
            errEl.dataset.reservesErrorCode = lastCatalogErrorCode;
            errEl.textContent = i18n().translateApiError({ error_code: lastCatalogErrorCode }, status);
        }
        if (root) {
            root.innerHTML = '';
        }
        catalogItems = [];
    }

    function clearCatalogError() {
        lastCatalogErrorCode = '';
        const errEl = document.getElementById('reservesCatalogError');
        if (errEl) {
            errEl.hidden = true;
            errEl.textContent = '';
            delete errEl.dataset.reservesErrorCode;
        }
    }

    function updateCatalogErrorText() {
        const errEl = document.getElementById('reservesCatalogError');
        if (!errEl || errEl.hidden || !lastCatalogErrorCode) return;
        errEl.textContent = i18n().translateApiError({ error_code: lastCatalogErrorCode });
    }

    function activeLinkBody(extra = {}) {
        return {
            link_id: activeLink?.link_id || 0,
            provider: activeLink?.provider || '',
            realm: activeLink?.realm || '',
            lang: i18n().getLang(),
            ...extra,
        };
    }

    function setActiveLink(linkId) {
        activeLink = (window.ABS_RESERVES_USABLE || []).find(
            (item) => Number(item.link_id) === Number(linkId),
        ) || activeLink;

        document.querySelectorAll('.reserves-region-account[data-reserves-usable="1"]').forEach((accountEl) => {
            const isActive = Number(accountEl.dataset.reserveLinkId) === Number(linkId);
            accountEl.classList.toggle('reserves-region-account--selected', isActive);
            const card = accountEl.querySelector('.reserves-linked-card');
            if (!card) return;

            card.classList.toggle('reserves-linked-card--selected', isActive);
            const badge = card.querySelector('.reserves-linked-card__selected-badge');
            if (badge) {
                badge.classList.toggle('reserves-linked-card__selected-badge--hidden', !isActive);
            }
        });
    }

    function updateUrlLinkId(linkId) {
        const params = new URLSearchParams(window.location.search);
        if (linkId > 0) {
            params.set('link_id', String(linkId));
        } else {
            params.delete('link_id');
        }
        const next = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', next);
    }

    async function selectAccount(linkId) {
        if (!linkId || Number(activeLink?.link_id) === Number(linkId)) return;
        setActiveLink(linkId);
        editingRuleId = 0;
        updateUrlLinkId(linkId);
        resetWorkspaceForLinkSwitch();
        await Promise.all([loadCatalog(), loadRules()]);
    }

    function csrfHeaders() {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-Token': window.ABS_RESERVES_CSRF || '',
        };
    }

    async function fetchJson(url, options = {}) {
        const res = await fetch(url, { credentials: 'same-origin', ...options });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    function formatTs(ts) {
        if (!ts) return '—';
        const n = Number(ts);
        const d = Number.isFinite(n) && n > 1e9 ? new Date(n * 1000) : new Date(ts);
        if (Number.isNaN(d.getTime())) return String(ts);
        return d.toLocaleString(i18n().getLang() === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    }

    function statusLabel(status) {
        if (status === 'active') return i18n().t('statusActive');
        if (status === 'ready') return i18n().t('statusReady');
        return i18n().t('statusUnavailable');
    }

    function statusBadgeClass(status) {
        if (status === 'active') return 'reserves-status-badge--active';
        if (status === 'ready') return 'reserves-status-badge--ready';
        return 'reserves-status-badge--unavailable';
    }

    function escAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function tableWrap(tableHtml) {
        return '<div class="bracket-profile-wrap"><table class="bracket-profile-table bracket-profile-table--reserves">'
            + tableHtml
            + '</table></div>';
    }

    function statusBadgeHtml(status) {
        return '<span class="reserves-status-badge ' + statusBadgeClass(status) + '">'
            + escHtml(statusLabel(status))
            + '</span>';
    }

    function reserveCellHtml(item) {
        return '<div class="reserves-reserve-cell">'
            + (item.icon ? '<img class="reserves-reserve-cell__icon" src="' + escAttr(item.icon) + '" alt="" loading="lazy">' : '')
            + '<div class="reserves-reserve-cell__text">'
            + '<span class="reserves-reserve-cell__name">' + escHtml(item.name || item.type) + '</span>'
            + (item.bonus_type ? '<span class="reserves-reserve-cell__sub">' + escHtml(item.bonus_type) + '</span>' : '')
            + '</div></div>';
    }

    function renderCatalog(items) {
        const root = document.getElementById('reservesCatalog');
        if (!root) return;
        if (!items.length) {
            root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('catalogEmpty')) + '</p>';
            return;
        }

        const rows = [];
        items.forEach((item) => {
            (item.levels || []).forEach((lv) => {
                const canActivate = lv.status === 'ready';
                const meta = [];
                if (lv.amount > 0) meta.push(i18n().t('amountLabel', { amount: lv.amount }));
                if (lv.active_till) meta.push(i18n().t('activeTill', { time: formatTs(lv.active_till) }));

                const action = canActivate
                    ? '<button type="button" class="tactics-icon-btn reserves-activate-btn reserves-table-btn"'
                        + ' data-type="' + escAttr(item.type) + '"'
                        + ' data-level="' + lv.level + '">'
                        + escHtml(i18n().t('activate')) + '</button>'
                    : '<span class="reserves-table-muted">—</span>';

                rows.push('<tr>'
                    + '<td>' + reserveCellHtml(item) + '</td>'
                    + '<td>' + escHtml(i18n().t('levelLabel', { level: lv.level })) + '</td>'
                    + '<td>' + statusBadgeHtml(lv.status) + '</td>'
                    + '<td>' + escHtml(meta.join(' · ') || '—') + '</td>'
                    + '<td class="reserves-table-actions">' + action + '</td>'
                    + '</tr>');
            });
        });

        root.innerHTML = tableWrap(
            '<thead><tr>'
            + '<th>' + escHtml(i18n().t('colReserve')) + '</th>'
            + '<th>' + escHtml(i18n().t('colLevel')) + '</th>'
            + '<th>' + escHtml(i18n().t('colStatus')) + '</th>'
            + '<th>' + escHtml(i18n().t('colDetails')) + '</th>'
            + '<th>' + escHtml(i18n().t('colAction')) + '</th>'
            + '</tr></thead><tbody>' + rows.join('') + '</tbody>'
        );

        root.querySelectorAll('.reserves-activate-btn').forEach((btn) => {
            btn.addEventListener('click', () => activateReserve(btn.dataset.type, Number(btn.dataset.level), btn));
        });
    }

    function refreshScheduleSelect(select) {
        if (!select) return;
        if (select.dataset.recruitingSelectEnhanced === '1' && typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(select);
            return;
        }
        if (typeof window.recruitingEnhanceSelect === 'function') {
            window.recruitingEnhanceSelect(select);
        }
    }

    function fillRuleSelects(items) {
        const typeSel = document.getElementById('reservesRuleType');
        const levelSel = document.getElementById('reservesRuleLevel');
        if (!typeSel || !levelSel) return;

        const prevType = typeSel.value;
        typeSel.innerHTML = '<option value="">' + escHtml(i18n().t('selectType')) + '</option>'
            + items.map((it) => '<option value="' + escAttr(it.type) + '">' + escHtml(it.name || it.type) + '</option>').join('');
        if (prevType) typeSel.value = prevType;
        refreshScheduleSelect(typeSel);

        const updateLevels = () => {
            const type = typeSel.value || '';
            const item = items.find((it) => it.type === type);
            levelSel.innerHTML = '<option value="">' + escHtml(i18n().t('selectLevel')) + '</option>';
            (item?.levels || []).forEach((lv) => {
                if (lv.status === 'ready' || lv.status === 'active' || lv.amount > 0) {
                    levelSel.innerHTML += '<option value="' + lv.level + '">' + escHtml(i18n().t('levelLabel', { level: lv.level })) + '</option>';
                }
            });
            refreshScheduleSelect(levelSel);
        };
        typeSel.onchange = updateLevels;
        updateLevels();
    }

    async function loadCatalog() {
        const seq = catalogLoadSeq;
        const loading = document.getElementById('reservesCatalogLoading');
        const root = document.getElementById('reservesCatalog');

        if (!window.ABS_RESERVES_CAN_USE) {
            if (loading) loading.hidden = true;
            if (root) {
                root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('linkRequired')) + '</p>';
            }
            return;
        }

        if (root) root.innerHTML = '';
        if (loading) loading.hidden = false;
        clearCatalogError();

        const res = await fetchJson(window.ABS_RESERVES_CATALOG_API + activeLinkQuery());
        if (seq !== catalogLoadSeq) return;

        if (loading) loading.hidden = true;

        if (!res.ok || !res.data?.success) {
            const code = res.data?.error_code || (res.status === 409 ? 'no_clan' : 'api_error');
            showCatalogError(code, res.status);
            return;
        }

        clearCatalogError();
        catalogItems = res.data.data?.items || [];
        renderCatalog(catalogItems);
        fillRuleSelects(catalogItems);
    }

    async function activateReserve(type, level, btn) {
        if (!type || !level) return;
        const original = btn?.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = i18n().t('activating');
        }

        const res = await fetchJson(window.ABS_RESERVES_ACTIVATE_API, {
            method: 'POST',
            headers: csrfHeaders(),
            body: JSON.stringify(activeLinkBody({
                csrf_token: window.ABS_RESERVES_CSRF,
                reserve_type: type,
                reserve_level: level,
            })),
        });

        if (btn) {
            btn.disabled = false;
            btn.textContent = original || i18n().t('activate');
        }

        if (!res.ok || !res.data?.success) {
            const code = res.data?.error_code || (res.status === 409 ? 'no_clan' : 'api_error');
            toast(i18n().translateApiError({ error_code: code }, res.status), 'error');
            return;
        }

        toast(res.data.message || i18n().t('activated'), 'success');
        await Promise.all([loadCatalog(), loadRules()]);
    }

    function formatRuleDays(rule) {
        const dayKeys = {
            mon: 'dayMon', tue: 'dayTue', wed: 'dayWed', thu: 'dayThu',
            fri: 'dayFri', sat: 'daySat', sun: 'daySun',
        };
        const days = Array.isArray(rule.days) ? rule.days : [];
        if (!days.length) return '—';
        return days.map((d) => i18n().t(dayKeys[d] || d)).join(', ');
    }

    function renderRules(rules) {
        const root = document.getElementById('reservesRulesList');
        if (!root) return;
        if (!rules.length) {
            root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('rulesEmpty')) + '</p>';
            return;
        }

        const rows = rules.map((rule) => {
            const item = catalogItems.find((it) => it.type === rule.reserve_type);
            const name = item?.name || rule.reserve_type;
            const enabledBadge = rule.enabled
                ? '<span class="reserves-status-badge reserves-status-badge--ready">' + escHtml(i18n().t('enabled')) + '</span>'
                : '<span class="reserves-status-badge reserves-status-badge--unavailable">' + escHtml(i18n().t('disabled')) + '</span>';
            const lastRun = rule.last_status
                ? '<span class="reserves-table-muted">' + escHtml(rule.last_status) + '</span>'
                : '—';

            return '<tr>'
                + '<td>' + escHtml(name) + '</td>'
                + '<td>' + escHtml(i18n().t('levelLabel', { level: rule.reserve_level })) + '</td>'
                + '<td>' + escHtml(rule.time_local || '—') + '</td>'
                + '<td>' + escHtml(formatRuleDays(rule)) + '</td>'
                + '<td>' + enabledBadge + '</td>'
                + '<td>' + lastRun + '</td>'
                + '<td class="reserves-table-actions">'
                + '<button type="button" class="bracket-profile-delete reserves-rule-delete" data-id="' + rule.id + '">'
                + escHtml(i18n().t('deleteRule')) + '</button>'
                + '</td>'
                + '</tr>';
        }).join('');

        root.innerHTML = tableWrap(
            '<thead><tr>'
            + '<th>' + escHtml(i18n().t('colReserve')) + '</th>'
            + '<th>' + escHtml(i18n().t('colLevel')) + '</th>'
            + '<th>' + escHtml(i18n().t('colTime')) + '</th>'
            + '<th>' + escHtml(i18n().t('ruleDays')) + '</th>'
            + '<th>' + escHtml(i18n().t('colStatus')) + '</th>'
            + '<th>' + escHtml(i18n().t('colLastRun')) + '</th>'
            + '<th>' + escHtml(i18n().t('colAction')) + '</th>'
            + '</tr></thead><tbody>' + rows + '</tbody>'
        );

        root.querySelectorAll('.reserves-rule-delete').forEach((btn) => {
            btn.addEventListener('click', () => deleteRule(Number(btn.dataset.id)));
        });
    }

    function renderLog(entries) {
        const root = document.getElementById('reservesLog');
        if (!root) return;
        if (!entries.length) {
            root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('logEmpty')) + '</p>';
            return;
        }

        const rows = entries.map((row) => {
            const ok = row.status === 'success';
            const trigger = row.trigger_type === 'schedule' ? i18n().t('triggerSchedule') : i18n().t('triggerManual');
            const when = formatTs(row.activated_at || row.created_at);
            const item = catalogItems.find((it) => it.type === row.reserve_type);
            const name = item?.name || row.reserve_type;
            const resultBadge = ok
                ? '<span class="reserves-status-badge reserves-status-badge--active">' + escHtml(i18n().t('logSuccess')) + '</span>'
                : '<span class="reserves-status-badge reserves-status-badge--error">' + escHtml(i18n().t('logError')) + '</span>';
            const err = row.error_message
                ? '<span class="reserves-table-muted">' + escHtml(row.error_message) + '</span>'
                : '—';

            return '<tr>'
                + '<td>' + escHtml(when) + '</td>'
                + '<td>' + escHtml(trigger) + '</td>'
                + '<td>' + escHtml(name + ' · ' + i18n().t('levelLabel', { level: row.reserve_level })) + '</td>'
                + '<td>' + resultBadge + '</td>'
                + '<td>' + err + '</td>'
                + '</tr>';
        }).join('');

        root.innerHTML = tableWrap(
            '<thead><tr>'
            + '<th>' + escHtml(i18n().t('colTime')) + '</th>'
            + '<th>' + escHtml(i18n().t('colTrigger')) + '</th>'
            + '<th>' + escHtml(i18n().t('colReserve')) + '</th>'
            + '<th>' + escHtml(i18n().t('colResult')) + '</th>'
            + '<th>' + escHtml(i18n().t('colError')) + '</th>'
            + '</tr></thead><tbody>' + rows + '</tbody>'
        );
    }

    async function loadRules() {
        const seq = rulesLoadSeq;
        const loading = document.getElementById('reservesRulesLoading');
        if (!window.ABS_RESERVES_CAN_USE) {
            if (loading) loading.hidden = true;
            return;
        }
        if (loading) loading.hidden = false;

        const res = await fetchJson(window.ABS_RESERVES_RULES_API + activeLinkQuery());
        if (seq !== rulesLoadSeq) return;

        if (loading) loading.hidden = true;
        if (!res.ok || !res.data?.success) return;
        rulesCache = res.data.data?.rules || [];
        logCache = res.data.data?.log || [];
        renderRules(rulesCache);
        renderLog(logCache);
    }

    async function saveRule(ev) {
        ev.preventDefault();
        const typeSel = document.getElementById('reservesRuleType');
        const levelSel = document.getElementById('reservesRuleLevel');
        const timeInput = document.getElementById('reservesRuleTime');
        const days = [...document.querySelectorAll('#reservesRuleForm input[name="day"]:checked')].map((el) => el.value);

        const body = activeLinkBody({
            csrf_token: window.ABS_RESERVES_CSRF,
            id: editingRuleId || undefined,
            reserve_type: typeSel?.value || '',
            reserve_level: Number(levelSel?.value || 0),
            time_local: timeInput?.value || '',
            days,
            enabled: true,
        });

        const res = await fetchJson(window.ABS_RESERVES_RULES_API, {
            method: 'POST',
            headers: csrfHeaders(),
            body: JSON.stringify(body),
        });

        if (!res.ok || !res.data?.success) {
            toast(res.data?.error || 'Error', 'error');
            return;
        }

        editingRuleId = 0;
        toast(res.data.message || i18n().t('ruleSaved'), 'success');
        await loadRules();
    }

    async function deleteRule(id) {
        if (!id) return;
        const res = await fetchJson(window.ABS_RESERVES_RULES_API, {
            method: 'DELETE',
            headers: csrfHeaders(),
            body: JSON.stringify({ csrf_token: window.ABS_RESERVES_CSRF, id }),
        });
        if (!res.ok || !res.data?.success) {
            toast(res.data?.error || 'Error', 'error');
            return;
        }
        toast(res.data.message || i18n().t('ruleDeleted'), 'success');
        await loadRules();
    }

    function relocalizeView() {
        i18n().relocalizeDom(document);
        updateCatalogErrorText();

        if (!window.ABS_RESERVES_CAN_USE) {
            const root = document.getElementById('reservesCatalog');
            if (root) {
                root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('linkRequired')) + '</p>';
            }
            return;
        }

        if (catalogItems.length) {
            renderCatalog(catalogItems);
            fillRuleSelects(catalogItems);
        } else if (!lastCatalogErrorCode) {
            renderCatalog([]);
        }

        renderRules(rulesCache);
        renderLog(logCache);
    }

    window.AbsReserves = { relocalizeView };

    function initAccountSelection() {
        document.querySelectorAll('.reserves-region-account[data-reserves-usable="1"]').forEach((accountEl) => {
            const activate = () => {
                const linkId = Number(accountEl.dataset.reserveLinkId || 0);
                if (linkId) selectAccount(linkId);
            };

            accountEl.addEventListener('click', (ev) => {
                if (ev.target.closest('.reserves-linking__unlink, a, button')) return;
                activate();
            });
            accountEl.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                activate();
            });
        });
    }

    function init() {
        i18n().relocalizeDom(document);
        initAccountSelection();
        if (activeLink?.link_id) {
            setActiveLink(activeLink.link_id);
        }
        document.getElementById('reservesRefreshBtn')?.addEventListener('click', () => loadCatalog());
        document.getElementById('reservesRuleForm')?.addEventListener('submit', saveRule);

        if (window.ABS_RESERVES_CAN_USE) {
            loadCatalog();
            loadRules();
        } else {
            loadCatalog();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
