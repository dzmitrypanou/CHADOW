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
        await loadCatalog();
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

    function getUserTimezone() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) return tz;
        } catch (e) { /* ignore */ }
        return 'Europe/Moscow';
    }

    function parseLogTimestamp(ts) {
        if (!ts) return null;
        const n = Number(ts);
        if (Number.isFinite(n) && n > 1e9) {
            return new Date(n * 1000);
        }
        const raw = String(ts).trim();
        if (!raw) return null;
        let normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
        if (!/Z$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
            normalized += 'Z';
        }
        const parsed = Date.parse(normalized);
        return Number.isFinite(parsed) ? new Date(parsed) : null;
    }

    function formatLogTs(ts) {
        const d = parseLogTimestamp(ts);
        if (!d) return ts ? String(ts) : '—';
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-GB', {
                timeZone: getUserTimezone(),
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).formatToParts(d).map((part) => [part.type, part.value])
        );
        return parts.day + '.' + parts.month + ' ' + parts.hour + ':' + parts.minute;
    }

    function logTableWrap(tableHtml) {
        return '<div class="bracket-profile-wrap"><table class="bracket-profile-table bracket-profile-table--reserves bracket-profile-table--reserves-log">'
            + tableHtml
            + '</table></div>';
    }

    function statusLabel(status) {
        if (status === 'active') return i18n().t('statusActive');
        return i18n().t('statusInactive');
    }

    function statusBadgeClass(status) {
        if (status === 'active') return 'reserves-status-badge--active';
        return 'reserves-status-badge--inactive';
    }

    function reserveIconUrl(item) {
        const type = String(item?.type || '').trim();
        const localByType = {
            additionalBriefing: '/assets/icons/reserves/additional-briefing.png',
            battlePayments: '/assets/icons/reserves/battle-payments.png',
            militaryManeuvers: '/assets/icons/reserves/military-maneuvers.png',
            tacticalTraining: '/assets/icons/reserves/tactical-training.png',
        };
        if (type && localByType[type]) {
            return localByType[type];
        }
        return normalizeIconUrl(item?.icon || '');
    }

    function normalizeIconUrl(icon) {
        let url = String(icon || '').trim();
        if (!url) return '';
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.startsWith('http://')) url = 'https://' + url.slice(7);
        return url;
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

    function localizeCatalogItem(item) {
        const labels = i18n().translateReserve(item.type, item);
        return {
            ...item,
            name: labels.name,
            description: labels.description,
            bonus_type: labels.description,
        };
    }

    function localizedCatalogItems() {
        return catalogItems.map(localizeCatalogItem);
    }

    function reserveNameByType(type, fallback = '') {
        return i18n().translateReserve(type, { name: fallback }).name;
    }

    function refreshCatalogView() {
        if (!window.ABS_RESERVES_CAN_USE) {
            const root = document.getElementById('reservesCatalog');
            if (root) {
                root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('linkRequired')) + '</p>';
            }
            return;
        }

        if (catalogItems.length) {
            const items = localizedCatalogItems();
            renderCatalog(items);
            fillRuleSelects(items);
        } else if (!lastCatalogErrorCode) {
            renderCatalog([]);
            fillRuleSelects([]);
        }

        renderRules(rulesCache);
        renderLog(logCache);
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
        const iconUrl = reserveIconUrl(item);
        const description = String(item.description || item.bonus_type || '').trim();
        return '<div class="reserves-reserve-cell">'
            + (iconUrl
                ? '<img class="reserves-reserve-cell__icon" src="' + escAttr(iconUrl) + '" alt="" loading="lazy" width="32" height="32" decoding="async">'
                : '<span class="reserves-reserve-cell__icon reserves-reserve-cell__icon--placeholder" aria-hidden="true"><i class="fas fa-box"></i></span>')
            + '<div class="reserves-reserve-cell__text">'
            + '<span class="reserves-reserve-cell__name" title="' + escAttr(item.name || item.type) + '">' + escHtml(item.name || item.type) + '</span>'
            + (description ? '<span class="reserves-reserve-cell__sub" title="' + escAttr(description) + '">' + escHtml(description) + '</span>' : '')
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
                const amount = Number(lv.amount) || 0;

                const action = canActivate
                    ? '<button type="button" class="tactics-icon-btn reserves-activate-btn reserves-table-btn"'
                        + ' data-type="' + escAttr(item.type) + '"'
                        + ' data-level="' + lv.level + '">'
                        + escHtml(i18n().t('activate')) + '</button>'
                    : '<span class="reserves-table-muted">—</span>';

                rows.push('<tr>'
                    + '<td>' + reserveCellHtml(item) + '</td>'
                    + '<td class="reserves-table-level">' + escHtml(String(lv.level)) + '</td>'
                    + '<td>' + statusBadgeHtml(lv.status) + '</td>'
                    + '<td class="reserves-table-amount">' + escHtml(amount > 0 ? String(amount) : '—') + '</td>'
                    + '<td class="reserves-table-actions">' + action + '</td>'
                    + '</tr>');
            });
        });

        if (!rows.length) {
            root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('catalogEmpty')) + '</p>';
            return;
        }

        root.innerHTML = tableWrap(
            '<thead><tr>'
            + '<th>' + escHtml(i18n().t('colReserve')) + '</th>'
            + '<th>' + escHtml(i18n().t('colLevel')) + '</th>'
            + '<th>' + escHtml(i18n().t('colStatus')) + '</th>'
            + '<th>' + escHtml(i18n().t('colAmount')) + '</th>'
            + '<th>' + escHtml(i18n().t('colActivation')) + '</th>'
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

        try {
            const res = await fetchJson(window.ABS_RESERVES_CATALOG_API + activeLinkQuery());
            if (seq !== catalogLoadSeq) return;

            if (!res.ok || !res.data?.success) {
                const code = res.data?.error_code || (res.status === 409 ? 'no_clan' : 'api_error');
                showCatalogError(code, res.status);
                return;
            }

            clearCatalogError();
            catalogItems = res.data.data?.items || [];
            await loadRules();
            refreshCatalogView();
        } finally {
            if (seq === catalogLoadSeq && loading) {
                loading.hidden = true;
            }
        }
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
            const code = String(res.data?.error_code || '').trim();
            let message;
            if (code === 'no_clan' || res.status === 409) {
                message = i18n().t('errorNoClan');
            } else if (code) {
                message = i18n().translateLogError(code);
            } else {
                message = i18n().t('activateError');
            }
            toast(message, 'error');
            await loadRules();
            return;
        }

        toast(res.data.message || i18n().t('activated'), 'success');
        await loadCatalog();
    }

    function formatRuleDays(rule) {
        const dayKeys = {
            mon: 'dayMon', tue: 'dayTue', wed: 'dayWed', thu: 'dayThu',
            fri: 'dayFri', sat: 'daySat', sun: 'daySun',
        };
        const days = Array.isArray(rule.days) ? rule.days : [];
        if (!days.length) return '—';
        if (days.length === 7) return i18n().t('ruleEveryDay');
        return days.map((d) => i18n().t(dayKeys[d] || d)).join(', ');
    }

    function weekdayKeyInTimezone(date, timezone) {
        const weekday = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
        }).format(date);
        const map = {
            Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
        };
        return map[weekday] || '';
    }

    function minutesInTimezone(date, timezone) {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(date);
        const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
        const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
        return hour * 60 + minute;
    }

    function formatRuleSchedule(rule) {
        const dayKeys = {
            mon: 'dayMonShort', tue: 'dayTueShort', wed: 'dayWedShort', thu: 'dayThuShort',
            fri: 'dayFriShort', sat: 'daySatShort', sun: 'daySunShort',
        };
        const days = Array.isArray(rule.days) ? rule.days : [];
        const time = rule.time_local || '—';
        if (!days.length) return '—';

        let daysPart;
        if (days.length === 7) {
            daysPart = i18n().t('ruleEveryDay');
        } else {
            daysPart = days.map((d) => i18n().t(dayKeys[d] || d)).join(', ');
        }

        return i18n().t('ruleScheduleAt', { days: daysPart, time });
    }

    function formatNextActivationDate(date, timezone) {
        const lang = i18n().getLang() === 'en' ? 'en-GB' : 'ru-RU';
        return new Intl.DateTimeFormat(lang, {
            timeZone: timezone,
            day: 'numeric',
            month: 'long',
        }).format(date);
    }

    function ruleIsActive(rule) {
        if (rule.active === false) return false;
        if (rule.paused_no_stock) return false;
        return rule.enabled !== false;
    }

    function getNextActivationDate(rule) {
        if (!ruleIsActive(rule)) return null;

        const days = Array.isArray(rule.days) ? rule.days : [];
        const timeLocal = String(rule.time_local || '').trim();
        const timezone = String(rule.timezone || 'Europe/Moscow').trim() || 'Europe/Moscow';
        if (!days.length || !/^\d{1,2}:\d{2}$/.test(timeLocal)) return null;

        const daySet = new Set(days);
        const [targetHour, targetMinute] = timeLocal.split(':').map(Number);
        const targetMinutes = targetHour * 60 + targetMinute;
        const now = Date.now();

        for (let offset = 0; offset < 14; offset += 1) {
            const probe = new Date(now + offset * 86400000);
            const weekday = weekdayKeyInTimezone(probe, timezone);
            if (!daySet.has(weekday)) continue;

            if (offset === 0 && minutesInTimezone(probe, timezone) >= targetMinutes) {
                continue;
            }

            return formatNextActivationDate(probe, timezone);
        }

        return null;
    }

    function renderRules(rules) {
        const root = document.getElementById('reservesRulesList');
        if (!root) return;
        if (!rules.length) {
            root.innerHTML = '<p class="bracket-section-hint">' + escHtml(i18n().t('rulesEmpty')) + '</p>';
            return;
        }

        root.innerHTML = '<div class="reserves-rule-list">'
            + rules.map((rule) => {
                const item = catalogItems.find((it) => it.type === rule.reserve_type);
                const name = reserveNameByType(rule.reserve_type, item?.name || rule.reserve_type);
                const schedule = formatRuleSchedule(rule);
                const paused = !!rule.paused_no_stock;
                const nextDate = getNextActivationDate(rule);
                const rowClass = paused ? ' reserves-rule-row--paused' : '';

                return '<article class="reserves-rule-row' + rowClass + '">'
                    + '<div class="reserves-rule-row__info">'
                    + '<strong class="reserves-rule-row__title">' + escHtml(name) + '</strong>'
                    + '<span class="reserves-rule-row__schedule">' + escHtml(schedule) + '</span>'
                    + (paused
                        ? '<span class="reserves-rule-row__paused">' + escHtml(i18n().t('rulePausedHint')) + '</span>'
                        : '')
                    + '</div>'
                    + '<div class="reserves-rule-row__next">'
                    + '<span class="reserves-rule-row__next-label">' + escHtml(i18n().t('ruleNextActivation')) + '</span>'
                    + (paused
                        ? '<span class="reserves-rule-row__next-paused">' + escHtml(i18n().t('rulePausedNoStock')) + '</span>'
                        : '<strong class="reserves-rule-row__next-date">' + escHtml(nextDate || '—') + '</strong>')
                    + '</div>'
                    + '<button type="button" class="bracket-profile-delete reserves-rule-delete" data-id="' + rule.id + '"'
                    + ' title="' + escAttr(i18n().t('deleteRule')) + '" aria-label="' + escAttr(i18n().t('deleteRule')) + '">'
                    + escHtml(i18n().t('deleteRule'))
                    + '</button>'
                    + '</article>';
            }).join('')
            + '</div>';

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
            const trigger = row.trigger_type === 'schedule'
                ? i18n().t('triggerScheduleShort')
                : i18n().t('triggerManualShort');
            const when = formatLogTs(row.activated_at || row.created_at);
            const item = catalogItems.find((it) => it.type === row.reserve_type);
            const name = reserveNameByType(row.reserve_type, item?.name || row.reserve_type);
            const reserveLabel = name + ' · ' + i18n().t('levelLabelShort', { level: row.reserve_level });
            const errorText = row.error_message
                ? i18n().translateLogError(row.error_message)
                : '';
            const resultBadge = ok
                ? '<span class="reserves-status-badge reserves-status-badge--active">' + escHtml(i18n().t('logSuccess')) + '</span>'
                : '<span class="reserves-status-badge reserves-status-badge--error reserves-log-status"'
                    + (errorText ? ' title="' + escAttr(errorText) + '"' : '')
                    + '>' + escHtml(i18n().t('logError')) + '</span>';

            return '<tr>'
                + '<td class="reserves-log-time">' + escHtml(when) + '</td>'
                + '<td class="reserves-log-trigger">' + escHtml(trigger) + '</td>'
                + '<td><span class="reserves-log-reserve" title="' + escAttr(reserveLabel) + '">' + escHtml(reserveLabel) + '</span></td>'
                + '<td class="reserves-log-result">' + resultBadge + '</td>'
                + '</tr>';
        }).join('');

        root.innerHTML = logTableWrap(
            '<thead><tr>'
            + '<th>' + escHtml(i18n().t('colTime')) + '</th>'
            + '<th>' + escHtml(i18n().t('logColTrigger')) + '</th>'
            + '<th>' + escHtml(i18n().t('colReserve')) + '</th>'
            + '<th>' + escHtml(i18n().t('logColResult')) + '</th>'
            + '</tr></thead><tbody>' + rows + '</tbody>'
        );
    }

    function normalizeTimeLocal(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return '';
        return String(match[1]).padStart(2, '0') + ':' + match[2];
    }

    function readScheduleForm() {
        const typeSel = document.getElementById('reservesRuleType');
        const levelSel = document.getElementById('reservesRuleLevel');
        const timeInput = document.getElementById('reservesRuleTime');
        const days = [...document.querySelectorAll('#reservesRuleForm input[name="day"]:checked')].map((el) => el.value);

        return {
            reserve_type: typeSel?.value || '',
            reserve_level: Number(levelSel?.value || 0),
            time_local: normalizeTimeLocal(timeInput?.value || ''),
            days,
        };
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
        if (!res.ok || !res.data?.success) {
            toast(res.data?.error || i18n().t('rulesLoadError'), 'error');
            return;
        }
        rulesCache = res.data.data?.rules || [];
        logCache = res.data.data?.log || [];
        renderRules(rulesCache);
        renderLog(logCache);
    }

    async function saveRule(ev) {
        ev.preventDefault();

        const saveBtn = document.getElementById('reservesRuleSaveBtn');
        const payload = readScheduleForm();

        if (!payload.reserve_type || payload.reserve_level <= 0) {
            toast(i18n().t('ruleValidationTypeLevel'), 'error');
            return;
        }
        if (!payload.time_local) {
            toast(i18n().t('ruleValidationTime'), 'error');
            return;
        }

        if (saveBtn) saveBtn.disabled = true;

        const body = activeLinkBody({
            csrf_token: window.ABS_RESERVES_CSRF,
            id: editingRuleId || undefined,
            reserve_type: payload.reserve_type,
            reserve_level: payload.reserve_level,
            time_local: payload.time_local,
            days: payload.days,
            enabled: true,
        });

        const res = await fetchJson(window.ABS_RESERVES_RULES_API, {
            method: 'POST',
            headers: csrfHeaders(),
            body: JSON.stringify(body),
        });

        if (saveBtn) saveBtn.disabled = false;

        if (!res.ok || !res.data?.success) {
            toast(res.data?.error || i18n().t('ruleSaveError'), 'error');
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

    async function confirmClearLog() {
        const message = i18n().t('clearLogConfirm');
        const options = {
            title: i18n().t('dialogConfirmTitle'),
            confirmText: i18n().t('dialogConfirm'),
            cancelText: i18n().t('dialogCancel'),
        };
        if (window.AbsTacticsConfirm?.confirm) {
            return window.AbsTacticsConfirm.confirm(message, options);
        }
        return window.confirm(message);
    }

    async function clearLog() {
        if (!window.ABS_RESERVES_CAN_USE) return;
        if (!(await confirmClearLog())) return;

        const btn = document.getElementById('reservesLogClearBtn');
        if (btn) btn.disabled = true;

        const res = await fetchJson(window.ABS_RESERVES_LOG_API, {
            method: 'DELETE',
            headers: csrfHeaders(),
            body: JSON.stringify(activeLinkBody({ csrf_token: window.ABS_RESERVES_CSRF })),
        });

        if (btn) btn.disabled = false;

        if (!res.ok || !res.data?.success) {
            toast(res.data?.error || i18n().t('logClearError'), 'error');
            return;
        }

        logCache = [];
        renderLog(logCache);
        toast(res.data.message || i18n().t('logCleared'), 'success');
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

        refreshCatalogView();
        renderRules(rulesCache);
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
        document.getElementById('reservesLogClearBtn')?.addEventListener('click', clearLog);
        document.getElementById('reservesRuleForm')?.addEventListener('submit', saveRule);

        if (window.ABS_RESERVES_CAN_USE) {
            loadCatalog();
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
