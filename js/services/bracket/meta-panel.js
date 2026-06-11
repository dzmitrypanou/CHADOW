(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;
    const Prizes = window.AbsBracketPrizes;
    const Games = window.AbsBracketGames;
    const Placements = window.AbsBracketPlacements;

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function formatDateTime(value) {
        if (!value) return '';
        const d = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return esc(String(value));
        const lang = I18n.getLang();
        return d.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function toDatetimeLocalValue(value) {
        if (!value) return '';
        const d = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function phaseLabel(phase) {
        const map = {
            upcoming: I18n.t('phaseUpcoming'),
            live: I18n.t('phaseLive'),
            completed: I18n.t('phaseCompleted'),
        };
        return map[phase] || phase;
    }

    function tierLabel(tier) {
        const groupMatch = String(tier).match(/^g(\d+)$/);
        if (groupMatch) {
            const groupNum = parseInt(groupMatch[1], 10) + 1;
            return I18n.t('groupWinnerTier').replace('{n}', String(groupNum));
        }
        if (tier === '1') return I18n.t('prizePlace1');
        if (tier === '2') return I18n.t('prizePlace2');
        return `${tier} ${I18n.t('prizePlaceSuffix')}`;
    }

    function tierMedalKind(tier) {
        if (tier === '1') return 'gold';
        if (tier === '2') return 'silver';
        if (tier === '3' || tier === '3-4') return 'bronze';
        return null;
    }

    function tierMedalHtml(tier) {
        const kind = tierMedalKind(tier);
        if (!kind) return '';

        return `<img class="bracket-result-medal bracket-result-medal--${kind}" src="/assets/icons/bracket/medal-${kind}.svg" width="24" height="24" alt="" loading="lazy" decoding="async">`;
    }

    function tierPlaceHtml(tier) {
        const medal = tierMedalHtml(tier);
        const label = esc(tierLabel(tier));

        if (!medal) {
            return `<span class="bracket-result-place-text">${label}</span>`;
        }

        return `${medal}<span class="bracket-result-place-text">${label}</span>`;
    }

    function buildHeaderMetaHtml(item) {
        if (!item) return '';

        const phase = item.tournament_phase || 'live';
        const matchFormatLabel = I18n.matchFormatLabel(item.match_format);
        const gameBadge = Games?.gameBadgeHtml
            ? Games.gameBadgeHtml(item.game || 'wot', item.game_realm, 'bracket-view-header-meta__game')
            : '';
        const statusHtml = `<span class="bracket-meta-status bracket-meta-status--${esc(phase)}">${esc(phaseLabel(phase))}</span>`;
        const matchFormatHtml = item.match_format
            ? `<span class="bracket-meta-match-format">${esc(matchFormatLabel)}</span>`
            : '';
        const startHtml = item.starts_at
            ? `<p class="bracket-meta-start"><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${esc(I18n.t('startsAt'))}: ${formatDateTime(item.starts_at)}</p>`
            : `<p class="bracket-meta-start bracket-meta-start--empty"><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${esc(I18n.t('noDate'))}</p>`;
        const completedHtml = item.completed_at
            ? `<p class="bracket-meta-completed"><i class="fas fa-flag-checkered" aria-hidden="true"></i> ${esc(I18n.t('completedAt'))}: ${formatDateTime(item.completed_at)}</p>`
            : '';

        return `${gameBadge}${statusHtml}${matchFormatHtml}${startHtml}${completedHtml}`;
    }

    function renderHeaderMeta(container, item) {
        if (!container) return;

        const html = buildHeaderMetaHtml(item);
        container.innerHTML = html;
        container.hidden = html.trim() === '';
    }

    function isTournamentCompleted(item) {
        return item?.tournament_phase === 'completed' || Boolean(item?.completed_at);
    }

    function resolvePrizeTiers(item) {
        const format = item?.format || 'single';
        const bracketData = item?.bracket_data || {};
        const participantCount = item.bracket_data?.settings?.bracketSize
            || (item.bracket_data?.participants || []).length;

        if (Prizes.isPureGroupFormat(format)) {
            return Prizes.getGroupWinnerTiers(bracketData.settings?.groupCount || 2);
        }

        return item.prize_tiers || Prizes.resolvePrizeTiers(format, participantCount, {
            bracketSize: !Prizes.isGroupFamilyFormat(format),
        });
    }

    function buildMetaBlock(title, iconClass, bodyHtml, modifier = '') {
        if (!bodyHtml || !String(bodyHtml).trim()) return '';

        const modClass = modifier ? ` bracket-meta-block--${modifier}` : '';
        return `<article class="bracket-meta-block${modClass}">
            <header class="bracket-meta-block__head">
                <i class="${esc(iconClass)}" aria-hidden="true"></i>
                <h3 class="bracket-meta-block__title">${esc(title)}</h3>
            </header>
            <div class="bracket-meta-block__body">${bodyHtml}</div>
        </article>`;
    }

    function buildPrizePoolHtml(item) {
        const prizePool = item.prize_pool || {};
        const tiers = resolvePrizeTiers(item);
        const prizeRows = tiers
            .filter((t) => prizePool[t])
            .map((t) => (
                `<div class="bracket-prize-row">
                    <span class="bracket-prize-place">${esc(tierLabel(t))}</span>
                    <span class="bracket-prize-value">${esc(prizePool[t])}</span>
                </div>`
            ))
            .join('');

        return prizeRows;
    }

    function buildResultsHtml(item) {
        if (!isTournamentCompleted(item)) return '';
        if (!Placements?.buildResultRows) return '';

        const rows = Placements.buildResultRows(item);
        const filledRows = rows.filter((row) => row.names.length > 0);
        if (!filledRows.length) return '';

        const body = filledRows.map((row) => {
            const namesText = row.names.map((name) => esc(name)).join(', ');

            return `<div class="bracket-result-row">
                <span class="bracket-result-place">${tierPlaceHtml(row.tier)}</span>
                <span class="bracket-result-names">${namesText}</span>
            </div>`;
        }).join('');

        return `<div class="bracket-results-table">
            ${body}
        </div>`;
    }

    function renderDisplay(container, item) {
        if (!container || !item) return;

        renderHeaderMeta(document.getElementById('bracketHeaderMeta'), item);

        const description = (item.description || '').trim();
        const descBody = description
            ? `<div class="bracket-meta-desc-body">${esc(description).replace(/\n/g, '<br>')}</div>`
            : '';
        const prizeBody = buildPrizePoolHtml(item);
        const resultsBody = buildResultsHtml(item);

        const blocks = [
            buildMetaBlock(I18n.t('description'), 'fas fa-align-left', descBody, 'desc'),
            buildMetaBlock(I18n.t('prizePool'), 'fas fa-trophy', prizeBody, 'prizes'),
            buildMetaBlock(I18n.t('tournamentResults'), 'fas fa-medal', resultsBody, 'results'),
        ].filter(Boolean).join('');

        if (!blocks) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = `<div class="bracket-meta-grid">${blocks}</div>`;
    }

    function collectPrizePool(formEl, tiers) {
        const pool = {};
        if (!formEl) return pool;
        const lang = I18n.getLang?.() || window.ABS_BRACKET_LANG || 'ru';

        function readTier(tier, inp) {
            if (!tier || !inp) return;
            const unitSelect = formEl.querySelector(`[data-prize-unit="${tier}"]`);
            const text = inp.value.trim();
            if (!text) return;
            const unit = unitSelect?.value || '';
            pool[tier] = Prizes.formatPrizeEntry(text, unit, lang);
        }

        formEl.querySelectorAll('[data-prize-tier]').forEach((inp) => {
            readTier(inp.getAttribute('data-prize-tier'), inp);
        });

        if (Array.isArray(tiers)) {
            tiers.forEach((tier) => {
                if (pool[tier] !== undefined) return;
                const inp = formEl.querySelector(`[data-prize-tier="${tier}"]`);
                readTier(tier, inp);
            });
        }

        return pool;
    }

    function buildPrizeUnitOptions(selectedUnit = '') {
        const units = [
            { value: '', labelKey: 'prizeUnitNone' },
            { value: 'gold', labelKey: 'prizeUnitGold' },
            { value: 'rub', labelKey: 'prizeUnitRub' },
            { value: 'usd', labelKey: 'prizeUnitUsd' },
        ];
        return units.map(({ value, labelKey }) => (
            `<option value="${esc(value)}"${selectedUnit === value ? ' selected' : ''}>${esc(I18n.t(labelKey))}</option>`
        )).join('');
    }

    function buildPrizeInputsHtml(tiers, prizePool = {}) {
        return tiers.map((tier) => {
            const parsed = Prizes.parsePrizeEntry(prizePool[tier] || '');
            const fieldId = `prize_${tier.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            return `<div class="bracket-prize-compact-row">
                <label class="bracket-prize-compact-label" for="${fieldId}">${esc(tierLabel(tier))}</label>
                <div class="bracket-prize-compact-fields">
                    <input type="text" id="${fieldId}" class="bracket-prize-compact-input"
                        name="bracket_prize_${fieldId}"
                        data-prize-tier="${esc(tier)}" maxlength="96"
                        autocomplete="off" autocapitalize="off" spellcheck="false"
                        value="${esc(parsed.text)}"
                        placeholder="${esc(I18n.t('prizePlaceholder'))}">
                    <select class="bracket-select bracket-prize-unit-select" id="${fieldId}_unit"
                        data-prize-unit="${esc(tier)}"
                        aria-label="${esc(I18n.t('prizePool'))} — ${esc(tierLabel(tier))}">
                        ${buildPrizeUnitOptions(parsed.unit)}
                    </select>
                </div>
            </div>`;
        }).join('');
    }

    function syncPrizeUnitSelects() {
        if (typeof window.recruitingEnhanceSelects === 'function') {
            window.recruitingEnhanceSelects();
        }
    }

    function renderPrizeGrid(gridEl, participantCount, prizePool = {}, options = {}) {
        if (!gridEl) return;
        const tiers = options.format
            ? Prizes.resolvePrizeTiers(options.format, participantCount, options)
            : Prizes.getPrizeTiers(participantCount, options);
        gridEl.innerHTML = buildPrizeInputsHtml(tiers, prizePool);
        syncPrizeUnitSelects();
    }

    function renderPrizeFieldset(container, participantCount, prizePool = {}, options = {}) {
        if (!container) return;

        const tiers = options.format
            ? Prizes.resolvePrizeTiers(options.format, participantCount, options)
            : Prizes.getPrizeTiers(participantCount, options);
        const prizeInputs = buildPrizeInputsHtml(tiers, prizePool);

        container.innerHTML = `
            <fieldset class="bracket-prize-fieldset" autocomplete="off">
                <legend class="bracket-form-label">${esc(I18n.t('prizePool'))}</legend>
                <div class="bracket-prize-grid bracket-prize-grid--compact">${prizeInputs}</div>
            </fieldset>
        `;
        syncPrizeUnitSelects();
    }

    function renderEditForm(container, item, editable) {
        if (!editable || !item) return;

        const descEl = document.getElementById('bracketEditDescription');
        if (descEl && document.activeElement !== descEl) {
            descEl.value = item.description || '';
        }

        const startsEl = document.getElementById('bracketEditStartsAt');
        if (startsEl) {
            const pickerWrap = startsEl.closest('.bracket-datetime');
            if (!pickerWrap || !pickerWrap.contains(document.activeElement)) {
                startsEl.value = toDatetimeLocalValue(item.starts_at) || '';
            }
        }
    }

    function renderTournamentActions(container, item, editable) {
        if (!container) return;

        if (!item || !editable) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        const phase = item.tournament_phase || 'live';
        const isCompleted = phase === 'completed';

        const completeBtn = !isCompleted
            ? `<button type="button" id="bracketMarkCompleteBtn" class="bracket-submit-btn bracket-submit-btn--secondary">
                <i class="fas fa-flag-checkered" aria-hidden="true"></i> ${esc(I18n.t('markCompleted'))}
               </button>`
            : '';
        const completedHint = isCompleted
            ? `<p class="bracket-completed-hint">${esc(I18n.t('tournamentCompletedHint'))}</p>`
            : '';
        const reopenBtn = isCompleted
            ? `<button type="button" id="bracketReopenBtn" class="bracket-back-link">
                <i class="fas fa-undo" aria-hidden="true"></i> ${esc(I18n.t('reopenTournament'))}
               </button>`
            : '';

        const completedRow = (isCompleted && (completedHint || reopenBtn))
            ? `<div class="bracket-tournament-actions__row">${completedHint}${reopenBtn}</div>`
            : '';

        if (!completeBtn && !completedRow) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;
        container.innerHTML = `${completedRow}${completeBtn}`;
    }

    window.AbsBracketMeta = {
        renderDisplay,
        renderHeaderMeta,
        buildHeaderMetaHtml,
        renderEditForm,
        renderTournamentActions,
        renderPrizeFieldset,
        renderPrizeGrid,
        collectPrizePool,
        formatDateTime,
        toDatetimeLocalValue,
        phaseLabel,
        tierLabel,
    };
})();
