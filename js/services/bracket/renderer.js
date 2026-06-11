(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function participantName(participants, idx) {
        if (idx === null || idx === undefined) return '—';
        const name = participants[idx];
        if (!name) return '—';
        if (/^BYE/i.test(name)) return I18n.t('bye');
        return name;
    }

    function formatScore(val) {
        if (val === null || val === undefined || val === '') return '';
        return String(val);
    }

    function isByeName(name) {
        return !name || name === '—' || /^BYE/i.test(name);
    }

    function stageLabel(stage) {
        const map = {
            winners: I18n.t('winners'),
            losers: I18n.t('losers'),
            grand_final: I18n.t('grandFinal'),
            grand_final_reset: I18n.t('resetFinal'),
            group: I18n.t('group'),
            playoff: I18n.t('playoff'),
        };
        return map[stage] || stage;
    }

    function renderMatch(match, participants, editable, onWinnerClick, onScoreChange, matchFormat) {
        const p1Name = participantName(participants, match.p1);
        const p2Name = participantName(participants, match.p2);
        const w1 = match.winner === match.p1 && match.p1 !== null;
        const w2 = match.winner === match.p2 && match.p2 !== null;
        const hasBoth = match.p1 !== null && match.p2 !== null;
        const canInteract = editable && hasBoth && !isByeName(p1Name) && !isByeName(p2Name);
        const score1 = formatScore(match.score1);
        const score2 = formatScore(match.score2);
        const maxScore = window.AbsBracketMatchFormat?.maxScore(matchFormat) ?? 1;

        const el = document.createElement('div');
        el.className = 'bracket-match';
        el.dataset.matchId = match.id;

        if (editable && canInteract) {
            el.innerHTML = `
                <div class="bracket-match__slot${w1 ? ' is-winner' : ''}${canInteract ? ' is-clickable' : ''}" data-side="1">
                    <span class="bracket-match__name">${esc(p1Name)}</span>
                    <input type="number" class="bracket-match__score" min="0" max="${maxScore}" step="1" inputmode="numeric"
                        aria-label="${esc(I18n.t('score'))} 1" data-side="1" value="${esc(score1)}" placeholder="0">
                </div>
                <div class="bracket-match__slot${w2 ? ' is-winner' : ''}${canInteract ? ' is-clickable' : ''}" data-side="2">
                    <span class="bracket-match__name">${esc(p2Name)}</span>
                    <input type="number" class="bracket-match__score" min="0" max="${maxScore}" step="1" inputmode="numeric"
                        aria-label="${esc(I18n.t('score'))} 2" data-side="2" value="${esc(score2)}" placeholder="0">
                </div>
            `;

            el.querySelectorAll('.bracket-match__slot.is-clickable').forEach((slot) => {
                slot.addEventListener('click', (e) => {
                    if (e.target.classList.contains('bracket-match__score')) return;
                    const side = parseInt(slot.dataset.side, 10);
                    onWinnerClick(match.id, side);
                });
            });

            const syncScores = () => {
                if (typeof onScoreChange !== 'function') return;
                const inp1 = el.querySelector('.bracket-match__score[data-side="1"]');
                const inp2 = el.querySelector('.bracket-match__score[data-side="2"]');
                onScoreChange(match.id, inp1?.value ?? '', inp2?.value ?? '');
            };

            el.querySelectorAll('.bracket-match__score').forEach((inp) => {
                inp.addEventListener('click', (e) => e.stopPropagation());
                inp.addEventListener('blur', syncScores);
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        inp.blur();
                    }
                });
            });
        } else {
            const scoreHtml1 = score1 !== '' ? `<span class="bracket-match__score-display">${esc(score1)}</span>` : '';
            const scoreHtml2 = score2 !== '' ? `<span class="bracket-match__score-display">${esc(score2)}</span>` : '';
            el.innerHTML = `
                <div class="bracket-match__slot${w1 ? ' is-winner' : ''}">
                    <span class="bracket-match__name">${esc(p1Name)}</span>
                    ${scoreHtml1}
                </div>
                <div class="bracket-match__slot${w2 ? ' is-winner' : ''}">
                    <span class="bracket-match__name">${esc(p2Name)}</span>
                    ${scoreHtml2}
                </div>
            `;
        }

        return el;
    }

    function groupMatchesByStage(matches) {
        const stages = {};
        matches.forEach((m) => {
            const key = m.stage || 'winners';
            if (!stages[key]) stages[key] = [];
            stages[key].push(m);
        });
        return stages;
    }

    const TREE_BLOCK_PX = 88;
    const TREE_CONNECTOR_PX = 28;
    const TREE_MATCH_HEIGHT_PX = 72;
    const TREE_PEDESTAL_LABEL_PX = 22;
    const TREE_PEDESTAL_BOX_PX = 68;

    function treeMatchCenterY(roundIndex, matchIndex) {
        return (2 * matchIndex + 1) * (2 ** roundIndex) * (TREE_BLOCK_PX / 2);
    }

    function treeMatchTop(roundIndex, matchIndex) {
        return treeMatchCenterY(roundIndex, matchIndex) - (TREE_MATCH_HEIGHT_PX / 2);
    }

    function buildTreeConnector(roundIndex, matchIndex) {
        if (roundIndex < 0) return null;

        const pairSpan = (2 ** roundIndex) * TREE_BLOCK_PX;
        const vertLen = pairSpan / 2;
        const isUpper = matchIndex % 2 === 0;

        const lines = document.createElement('div');
        lines.className = 'bracket-tree__lines';
        lines.style.setProperty('--v-len', `${vertLen}px`);
        lines.setAttribute('aria-hidden', 'true');
        lines.innerHTML = `
            <span class="bracket-tree__line bracket-tree__line--h"></span>
            <span class="bracket-tree__line bracket-tree__line--v${isUpper ? ' is-down' : ' is-up'}"></span>
            ${isUpper ? '<span class="bracket-tree__line bracket-tree__line--merge"></span>' : ''}
        `;
        return lines;
    }

    function renderWinnerPedestal(participants, finalMatch) {
        const wrap = document.createElement('div');
        wrap.className = 'bracket-tree__winner';

        let winnerName = '—';
        if (finalMatch && finalMatch.winner !== null && finalMatch.winner !== undefined) {
            winnerName = participantName(participants, finalMatch.winner);
        }

        wrap.innerHTML = `
            <div class="bracket-tree__winner-label">${esc(I18n.t('bracketWinner'))}</div>
            <div class="bracket-tree__winner-box">${esc(winnerName)}</div>
        `;
        return wrap;
    }

    function renderSingleElimTree(stageEl, roundsMap, participants, editable, onWinnerClick, onScoreChange, matchFormat) {
        const roundKeys = Object.keys(roundsMap).sort((a, b) => Number(a) - Number(b));
        if (roundKeys.length === 0) return;

        const tree = document.createElement('div');
        tree.className = 'bracket-tree';

        const firstRoundCount = roundsMap[roundKeys[0]].length;
        const treeHeight = firstRoundCount * TREE_BLOCK_PX;

        let finalMatch = null;

        roundKeys.forEach((roundKey, roundIdx) => {
            const col = document.createElement('div');
            col.className = 'bracket-tree__round';
            col.style.minHeight = `${treeHeight}px`;

            const label = document.createElement('div');
            label.className = 'bracket-tree__round-label';
            label.textContent = `${I18n.t('round')} ${roundKey}`;
            col.appendChild(label);

            const stack = document.createElement('div');
            stack.className = 'bracket-tree__stack';
            stack.style.height = `${treeHeight}px`;

            const matches = [...roundsMap[roundKey]].sort((a, b) => (a.slot || 0) - (b.slot || 0));
            matches.forEach((m, idx) => {
                const wrap = document.createElement('div');
                wrap.className = 'bracket-tree__match-wrap';
                wrap.style.top = `${treeMatchTop(roundIdx, idx)}px`;

                wrap.appendChild(renderMatch(m, participants, editable, onWinnerClick, onScoreChange, matchFormat));

                if (roundIdx < roundKeys.length - 1) {
                    const connector = buildTreeConnector(roundIdx, idx);
                    if (connector) wrap.appendChild(connector);
                } else if (matches.length === 1) {
                    const lines = document.createElement('div');
                    lines.className = 'bracket-tree__lines bracket-tree__lines--final';
                    lines.setAttribute('aria-hidden', 'true');
                    lines.innerHTML = '<span class="bracket-tree__line bracket-tree__line--h is-full"></span>';
                    wrap.appendChild(lines);
                }

                stack.appendChild(wrap);
            });

            col.appendChild(stack);
            tree.appendChild(col);

            if (roundIdx === roundKeys.length - 1 && matches[0]) {
                finalMatch = matches[0];
            }
        });

        if (finalMatch) {
            const winnerCol = document.createElement('div');
            winnerCol.className = 'bracket-tree__round bracket-tree__round--winner';
            winnerCol.style.minHeight = `${treeHeight}px`;

            const label = document.createElement('div');
            label.className = 'bracket-tree__round-label';
            label.setAttribute('aria-hidden', 'true');
            label.innerHTML = '&nbsp;';
            winnerCol.appendChild(label);

            const stack = document.createElement('div');
            stack.className = 'bracket-tree__stack';
            stack.style.height = `${treeHeight}px`;

            const pedestalHeight = TREE_PEDESTAL_LABEL_PX + 6 + TREE_PEDESTAL_BOX_PX;
            const finalCenterY = treeMatchCenterY(roundKeys.length - 1, 0);
            const winnerWrap = document.createElement('div');
            winnerWrap.className = 'bracket-tree__match-wrap bracket-tree__match-wrap--pedestal';
            winnerWrap.style.top = `${finalCenterY - (pedestalHeight / 2)}px`;
            winnerWrap.appendChild(renderWinnerPedestal(participants, finalMatch));
            stack.appendChild(winnerWrap);
            winnerCol.appendChild(stack);
            tree.appendChild(winnerCol);
        }

        stageEl.appendChild(tree);
    }

    function renderColumnLayout(stageEl, roundsMap, participants, editable, onWinnerClick, onScoreChange, matchFormat) {
        const roundsEl = document.createElement('div');
        roundsEl.className = 'bracket-rounds';

        Object.keys(roundsMap).sort((a, b) => Number(a) - Number(b)).forEach((round) => {
            const roundEl = document.createElement('div');
            roundEl.className = 'bracket-round';
            roundEl.innerHTML = `<div class="bracket-round__label">${esc(I18n.t('round'))} ${esc(round)}</div>`;

            const col = document.createElement('div');
            col.className = 'bracket-round__matches';
            roundsMap[round]
                .sort((a, b) => (a.slot || 0) - (b.slot || 0))
                .forEach((m) => {
                    col.appendChild(renderMatch(m, participants, editable, onWinnerClick, onScoreChange, matchFormat));
                });

            roundEl.appendChild(col);
            roundsEl.appendChild(roundEl);
        });

        stageEl.appendChild(roundsEl);
    }

    function isStandardElimTree(roundsMap) {
        const roundKeys = Object.keys(roundsMap).sort((a, b) => Number(a) - Number(b));
        if (roundKeys.length === 0) return false;

        let expected = roundsMap[roundKeys[0]].length;
        if (expected < 1 || (expected & (expected - 1)) !== 0) return false;

        for (let i = 0; i < roundKeys.length; i++) {
            const count = roundsMap[roundKeys[i]].length;
            if (count !== expected) return false;
            expected = Math.max(1, expected / 2);
        }

        return true;
    }

    function shouldShowStageTitle(stage, format) {
        return !(format === 'single' && stage === 'winners');
    }

    function renderEliminationTree(container, bracketData, editable, onWinnerClick, onScoreChange, matchFormat, format) {
        container.innerHTML = '';
        const defaultParticipants = bracketData.participants || [];
        const playoffParticipants = bracketData.settings?.playoffParticipants || null;
        const matches = bracketData.matches || [];
        const stages = groupMatchesByStage(
            matches.filter((m) => m.stage !== 'group')
        );

        const stageOrder = ['winners', 'playoff', 'losers', 'grand_final'];
        const sortedStages = Object.keys(stages)
            .filter((stage) => stage !== 'grand_final_reset')
            .sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

        sortedStages.forEach((stage) => {
            const stageEl = document.createElement('div');
            stageEl.className = 'bracket-stage';
            if (shouldShowStageTitle(stage, format)) {
                const title = document.createElement('h3');
                title.className = 'bracket-stage__title';
                title.textContent = stageLabel(stage);
                stageEl.appendChild(title);
            }

            const participants = playoffParticipants || defaultParticipants;

            const rounds = {};
            stages[stage].forEach((m) => {
                const r = m.round || 1;
                if (!rounds[r]) rounds[r] = [];
                rounds[r].push(m);
            });

            if (isStandardElimTree(rounds)) {
                renderSingleElimTree(
                    stageEl,
                    rounds,
                    participants,
                    editable,
                    onWinnerClick,
                    onScoreChange,
                    matchFormat
                );
            } else {
                renderColumnLayout(
                    stageEl,
                    rounds,
                    participants,
                    editable,
                    onWinnerClick,
                    onScoreChange,
                    matchFormat
                );
            }

            container.appendChild(stageEl);
        });
    }

    function renderGroupPanel(bracketData, groupIndex, participants, matches, editable, onWinnerClick, onScoreChange, matchFormat, options = {}) {
        const settings = bracketData.settings || {};
        const showTitle = options.showTitle !== false;
        const groupEl = document.createElement('div');
        groupEl.className = 'bracket-group';
        groupEl.dataset.groupIndex = String(groupIndex);

        const standings = window.AbsBracketGroup.computeGroupStandings(bracketData, groupIndex);
        const standingsHtml = standings.map((s, i) => (
            `<tr>
                <td>${i + 1}</td>
                <td>${esc(s.name)}</td>
                <td>${s.wins}</td>
                <td>${s.losses}</td>
                <td>${s.points}</td>
            </tr>`
        )).join('');

        const titleHtml = showTitle
            ? `<h3 class="bracket-group__title">${esc(I18n.t('group'))} ${groupIndex + 1}</h3>`
            : '';

        groupEl.innerHTML = `
            ${titleHtml}
            <table class="bracket-standings">
                <thead>
                    <tr>
                        <th>#</th>
                        <th></th>
                        <th>${esc(I18n.t('wins'))}</th>
                        <th>${esc(I18n.t('losses'))}</th>
                        <th>${esc(I18n.t('points'))}</th>
                    </tr>
                </thead>
                <tbody>${standingsHtml}</tbody>
            </table>
        `;

        const matchesEl = document.createElement('div');
        matchesEl.className = 'bracket-group__matches';
        const groupNames = settings.groups?.[groupIndex]?.names || participants;
        matches
            .filter((m) => m.stage === 'group' && m.group === groupIndex)
            .forEach((m) => {
                matchesEl.appendChild(renderMatch(m, groupNames, editable, onWinnerClick, onScoreChange, matchFormat));
            });

        groupEl.appendChild(matchesEl);
        return groupEl;
    }

    function buildGroupPickerItems(bracketData, groupCount) {
        const settings = bracketData.settings || {};
        return Array.from({ length: groupCount }, (_, g) => {
            const label = `${I18n.t('group')} ${g + 1}`;
            const names = (settings.groups?.[g]?.names || []).filter((name) => name && !/^BYE/i.test(name));
            const hint = names.join(', ');
            return {
                index: g,
                label,
                hint,
                searchText: `${g + 1} ${label} ${hint}`.toLowerCase(),
            };
        });
    }

    function filterGroupPickerItems(items, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return [];
        const num = parseInt(q, 10);
        if (Number.isFinite(num)) {
            const byNum = items.filter((item) => item.index + 1 === num);
            if (byNum.length) return byNum;
        }
        return items.filter((item) => {
            const haystack = item.searchText || `${item.label} ${item.hint || ''}`.toLowerCase();
            return haystack.includes(q);
        });
    }

    function renderGroupStage(container, bracketData, editable, onWinnerClick, onScoreChange, matchFormat, initialGroupIndex = 0) {
        const settings = bracketData.settings || {};
        const groupCount = settings.groupCount || 0;
        const participants = bracketData.participants || [];
        const matches = bracketData.matches || [];
        if (groupCount <= 0) return;

        const pickerItems = buildGroupPickerItems(bracketData, groupCount);
        const showHead = groupCount > 1;
        const renderRoot = container.closest('.bracket-render-target') || container;

        const stageWrap = document.createElement('div');
        stageWrap.className = 'bracket-group-stage';

        const shell = document.createElement('div');
        shell.className = 'bracket-group-panel';

        let tabsEl = null;
        let searchInput = null;
        let searchMenu = null;
        let head = null;

        if (showHead) {
            head = document.createElement('div');
            head.className = 'bracket-group-panel__head';
            head.innerHTML = `
                <div class="bracket-group-panel__tabs" role="tablist"></div>
                <div class="bracket-group-search">
                    <input type="search" id="bracketGroupViewSearch" class="bracket-group-search__input bracket-text-input"
                        placeholder="${esc(I18n.t('groupViewSearchPlaceholder'))}" autocomplete="off" spellcheck="false"
                        aria-label="${esc(I18n.t('groupViewSearchLabel'))}">
                    <div id="bracketGroupViewSearchMenu" class="bracket-group-search__menu" role="listbox" hidden></div>
                </div>
            `;
            shell.appendChild(head);
            tabsEl = head.querySelector('.bracket-group-panel__tabs');
            searchInput = head.querySelector('#bracketGroupViewSearch');
            searchMenu = head.querySelector('#bracketGroupViewSearchMenu');
        }

        const body = document.createElement('div');
        body.className = 'bracket-group-stage__body';

        const notFound = document.createElement('p');
        notFound.className = 'bracket-group-stage__not-found';
        notFound.hidden = true;
        notFound.textContent = I18n.t('groupViewNotFound');

        const panelsWrap = document.createElement('div');
        panelsWrap.className = 'bracket-group-stage__panels';

        const groupPanels = [];
        for (let g = 0; g < groupCount; g++) {
            const panel = renderGroupPanel(
                bracketData,
                g,
                participants,
                matches,
                editable,
                onWinnerClick,
                onScoreChange,
                matchFormat,
                { showTitle: !showHead }
            );
            panel.hidden = true;
            groupPanels.push(panel);
            panelsWrap.appendChild(panel);
        }

        body.appendChild(notFound);
        body.appendChild(panelsWrap);
        shell.appendChild(body);
        stageWrap.appendChild(shell);
        container.appendChild(stageWrap);

        let activeIndex = Math.max(0, Math.min(groupCount - 1, initialGroupIndex));

        function persistState() {
            renderRoot.dataset.activeGroupIndex = String(activeIndex);
        }

        function renderTabs() {
            if (!tabsEl) return;
            tabsEl.innerHTML = pickerItems.map((item, idx) => {
                const isActive = idx === activeIndex;
                return `<button type="button" class="bracket-group-tab${isActive ? ' is-active' : ''}" role="tab"
                    aria-selected="${isActive ? 'true' : 'false'}" data-group-index="${idx}">${esc(item.label)}</button>`;
            }).join('');
            tabsEl.querySelectorAll('.bracket-group-tab').forEach((btn) => {
                btn.addEventListener('click', () => {
                    showGroup(parseInt(btn.dataset.groupIndex, 10));
                });
            });
        }

        function renderSearchMenu(query) {
            if (!searchMenu || !searchInput) return;
            const filtered = filterGroupPickerItems(pickerItems, query);
            if (!String(query || '').trim()) {
                searchMenu.hidden = true;
                searchMenu.innerHTML = '';
                searchMenu.closest('.bracket-group-search')?.classList.remove('is-open');
                return;
            }
            searchMenu.innerHTML = filtered.length
                ? filtered.map((item) => (
                    `<button type="button" class="bracket-group-search__option" role="option" data-group-index="${item.index}">
                        <span class="bracket-group-search__option-label">${esc(item.label)}</span>
                        ${item.hint ? `<span class="bracket-group-search__option-hint">${esc(item.hint)}</span>` : ''}
                    </button>`
                )).join('')
                : `<div class="bracket-group-search__empty">${esc(I18n.t('groupViewNotFound'))}</div>`;
            searchMenu.hidden = false;
            searchMenu.closest('.bracket-group-search')?.classList.add('is-open');
        }

        function openGroupFromSearch(index) {
            if (searchInput) {
                searchInput.value = '';
            }
            renderSearchMenu('');
            showGroup(index);
        }

        function showGroup(index) {
            activeIndex = Math.max(0, Math.min(groupCount - 1, index));
            groupPanels.forEach((panel, i) => {
                panel.hidden = i !== activeIndex;
            });
            notFound.hidden = true;
            panelsWrap.hidden = false;
            persistState();
            renderTabs();
        }

        if (searchInput && searchMenu && head) {
            searchInput.addEventListener('input', () => {
                renderSearchMenu(searchInput.value);
            });

            searchInput.addEventListener('focus', () => {
                if (String(searchInput.value || '').trim()) {
                    renderSearchMenu(searchInput.value);
                }
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    renderSearchMenu('');
                    searchInput.blur();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const first = searchMenu.querySelector('.bracket-group-search__option');
                    if (first) {
                        openGroupFromSearch(parseInt(first.dataset.groupIndex, 10));
                    }
                }
            });

            searchMenu.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            searchMenu.addEventListener('click', (e) => {
                const option = e.target.closest('.bracket-group-search__option');
                if (!option) return;
                openGroupFromSearch(parseInt(option.dataset.groupIndex, 10));
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!searchMenu.closest('.bracket-group-search')?.classList.contains('is-open')) return;
                    if (searchMenu.contains(document.activeElement)) return;
                    renderSearchMenu('');
                }, 120);
            });
        }

        renderTabs();
        showGroup(activeIndex);
    }

    function render(container, bracketData, options = {}) {
        if (!container || !bracketData) return;
        const editable = !!options.editable;
        const onWinnerClick = options.onWinnerClick || null;
        const onScoreChange = options.onScoreChange || null;
        const format = options.format || 'single';
        const matchFormat = window.AbsBracketMatchFormat?.normalize(
            options.matchFormat || bracketData.settings?.matchFormat
        ) || 'bo1';
        const initialGroupIndex = parseInt(container.dataset.activeGroupIndex, 10) || 0;

        container.innerHTML = '';

        if (window.AbsBracketPrizes?.isGroupFamilyFormat(format)) {
            renderGroupStage(
                container,
                bracketData,
                editable,
                onWinnerClick,
                onScoreChange,
                matchFormat,
                initialGroupIndex
            );
        }

        const settings = bracketData.settings || {};
        const hasLegacyPlayoff = format === 'group'
            && (bracketData.matches || []).some((m) => m.stage === 'playoff')
            && settings.playoffGenerated === true;
        const showPlayoff = format === 'single'
            || format === 'double'
            || ((window.AbsBracketPrizes?.hasPlayoffFormat(format) || hasLegacyPlayoff)
                && settings.playoffGenerated === true);

        if (showPlayoff) {
            const elimContainer = document.createElement('div');
            elimContainer.className = 'bracket-elimination';
            renderEliminationTree(elimContainer, bracketData, editable, onWinnerClick, onScoreChange, matchFormat, format);
            container.appendChild(elimContainer);
        }
    }

    window.AbsBracketRenderer = { render, renderMatch, esc, participantName };
})();
