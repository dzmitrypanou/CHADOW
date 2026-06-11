(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;
    const Engine = window.AbsBracketEngine;
    const Renderer = window.AbsBracketRenderer;
    const GuestStore = window.AbsBracketGuestStore;
    const Meta = window.AbsBracketMeta;
    const Prizes = window.AbsBracketPrizes;

    function mergeMetaItem(base, patch) {
        return { ...(base || {}), ...(patch || {}) };
    }

    function isTournamentCompleted(item) {
        return item?.tournament_phase === 'completed' || !!item?.completed_at;
    }

    function apiFetch(url, options = {}) {
        const csrf = window.ABS_BRACKET_CSRF || '';
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (csrf) headers['X-CSRF-Token'] = csrf;

        return fetch(url, { ...options, headers, credentials: 'same-origin' });
    }

    function toast(msg, type) {
        if (typeof window.showSiteToast === 'function') {
            window.showSiteToast(msg, type);
        }
    }

    function parseParticipants(text) {
        return String(text || '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const BRACKET_MAX_GROUPS = 32;
    const BRACKET_MIN_GROUPS = 2;

    function clampGroupCount(value) {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return 4;
        return Math.max(BRACKET_MIN_GROUPS, Math.min(BRACKET_MAX_GROUPS, n));
    }

    function syncGroupCountInput(input) {
        if (!input) return clampGroupCount(4);
        const clamped = clampGroupCount(input.value);
        input.value = String(clamped);
        return clamped;
    }

    function collectGroupParticipantsFromContainer(container) {
        if (!container) return [];
        return [...container.querySelectorAll('[data-group-index]')].map((ta) =>
            String(ta.value || '')
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
        );
    }

    function renderGroupParticipantFields(container, count, existing = null) {
        if (!container) return;
        const preserved = existing || collectGroupParticipantsFromContainer(container);
        const groupCount = clampGroupCount(count);
        const placeholder = I18n.t('groupParticipantsPlaceholder');

        let html = `<p class="bracket-form-hint">${escapeHtml(I18n.t('groupParticipantsHint'))}</p>`;
        html += '<div class="bracket-group-participants-grid">';
        for (let g = 0; g < groupCount; g++) {
            const lines = preserved[g] || [];
            const value = escapeHtml(lines.join('\n'));
            html += `
                <div class="bracket-group-participants-card">
                    <label class="bracket-form-label" for="bracketGroupParticipants_${g}">${escapeHtml(I18n.t('group'))} ${g + 1}</label>
                    <textarea id="bracketGroupParticipants_${g}" class="bracket-textarea bracket-group-participants-textarea" rows="4" data-group-index="${g}" placeholder="${escapeHtml(placeholder)}">${value}</textarea>
                </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function countGroupParticipants(groupParticipants) {
        return (groupParticipants || []).reduce((sum, group) => sum + (group?.length || 0), 0);
    }

    function isGroupBracketFormat(format) {
        return Prizes.isGroupFamilyFormat(format);
    }

    function isPureGroupFormat(format) {
        return Prizes.isPureGroupFormat(format);
    }

    function hasPlayoffFormat(format) {
        return Prizes.hasPlayoffFormat(format);
    }

    function wireBracketVisibilitySwitch(switchRoot, hiddenInput) {
        if (!switchRoot || !hiddenInput) return;

        const options = switchRoot.querySelectorAll('.bracket-visibility-switch__option input[type="radio"]');

        function syncActiveState() {
            switchRoot.querySelectorAll('.bracket-visibility-switch__option').forEach((label) => {
                const radio = label.querySelector('input[type="radio"]');
                label.classList.toggle('is-active', !!radio?.checked);
            });
        }

        function setValue(value) {
            const normalized = value === 'hidden' ? 'hidden' : 'public';
            hiddenInput.value = normalized;
            options.forEach((radio) => {
                radio.checked = radio.value === normalized;
            });
            syncActiveState();
        }

        options.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                hiddenInput.value = radio.value;
                syncActiveState();
            });
        });

        setValue(hiddenInput.value || 'public');
    }

    function refreshBracketVisibilitySwitchLabels() {
        document.querySelectorAll('.bracket-visibility-switch').forEach((root) => {
            root.querySelectorAll('.bracket-visibility-switch__option').forEach((label) => {
                const radio = label.querySelector('input[type="radio"]');
                const text = label.querySelector('.bracket-visibility-switch__text');
                if (!radio || !text) return;
                text.textContent = radio.value === 'hidden'
                    ? I18n.t('visibilityLinkAccess')
                    : I18n.t('visibilityPublicAccess');
            });
        });
    }

    function getCreateBracketSize() {
        return Engine.normalizeBracketSize(document.getElementById('bracketParticipantSize')?.value || 8);
    }

    function countFilledParticipantLines(text) {
        return String(text || '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !/^BYE/i.test(l)).length;
    }

    function refreshBracketSizeSelect(selectEl) {
        if (selectEl && typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(selectEl);
        }
    }

    function setBracketSizeFieldLocked(fieldEl, selectEl, locked) {
        if (!fieldEl) return;
        fieldEl.classList.toggle('is-locked', locked);
        if (selectEl) {
            selectEl.disabled = locked;
            if (locked) selectEl.setAttribute('aria-disabled', 'true');
            else selectEl.removeAttribute('aria-disabled');
        }
        const trigger = fieldEl.querySelector('.recruiting-select-trigger');
        if (trigger) {
            trigger.disabled = locked;
            if (locked) trigger.setAttribute('aria-disabled', 'true');
            else trigger.removeAttribute('aria-disabled');
        }
    }

    function syncParticipantTextarea(textarea, size, preserve = true) {
        if (!textarea) return;
        const current = preserve
            ? String(textarea.value || '').split(/\r?\n/).map((l) => l.trim())
            : [];
        const lines = [];
        for (let i = 0; i < size; i++) {
            lines.push(current[i] || '');
        }
        textarea.value = lines.join('\n');
    }

    function refreshCreatePrizeFields(participantCount) {
        const prizeContainer = document.getElementById('bracketCreatePrizePool');
        const sizeSelect = document.getElementById('bracketParticipantSize');
        const formatSelect = document.getElementById('bracketFormat');
        if (!prizeContainer || !Meta?.renderPrizeFieldset || !Prizes) return;

        const format = formatSelect?.value || 'single';
        const size = participantCount != null
            ? Math.max(2, participantCount)
            : (parseInt(sizeSelect?.value, 10) || getCreateBracketSize());
        const existing = Meta.collectPrizePool(prizeContainer);

        if (isPureGroupFormat(format)) {
            const groupCount = clampGroupCount(document.getElementById('bracketGroupCount')?.value);
            Meta.renderPrizeFieldset(prizeContainer, groupCount, existing, {
                format,
                groupCount,
            });
            return;
        }

        Meta.renderPrizeFieldset(prizeContainer, size, existing, {
            format,
            bracketSize: true,
        });
    }

    function initCreateForm() {
        const form = document.getElementById('bracketCreateForm');
        if (!form) return;

        const Games = window.AbsBracketGames;
        const gamePickerRoot = document.getElementById('bracketGamePicker');
        if (Games && gamePickerRoot) {
            gamePickerRoot.innerHTML = Games.renderPicker({ game: 'wot', realm: 'ru' });
            Games.wirePicker(gamePickerRoot);
        }

        const formatSelect = document.getElementById('bracketFormat');
        const groupOnlyBlock = document.getElementById('bracketGroupOnly');
        const groupParticipantsContainer = document.getElementById('bracketGroupParticipants');
        const participantsBlock = document.getElementById('bracketParticipantsBlock');
        const sizeField = document.getElementById('bracketSizeField');
        const groupCountInput = document.getElementById('bracketGroupCount');
        const advancePerGroupField = document.getElementById('bracketAdvancePerGroupField');
        const sizeSelect = document.getElementById('bracketParticipantSize');
        const participantsInput = document.getElementById('bracketParticipants');

        function syncAdvancePerGroupVisibility() {
            if (!advancePerGroupField || !formatSelect) return;
            const fmt = formatSelect.value;
            advancePerGroupField.hidden = isPureGroupFormat(fmt);
        }

        window.AbsBracketCombobox?.wireNumber(document.getElementById('bracketGroupCountCombobox'), {
            min: BRACKET_MIN_GROUPS,
            max: BRACKET_MAX_GROUPS,
            defaultValue: 4,
        });

        function getCreateGroupCount() {
            return clampGroupCount(groupCountInput?.value);
        }

        function setCreateGroupUiVisible(visible) {
            if (groupOnlyBlock) groupOnlyBlock.hidden = !visible;
            if (groupParticipantsContainer) {
                if (!visible) {
                    groupParticipantsContainer.innerHTML = '';
                } else {
                    renderGroupParticipantFields(groupParticipantsContainer, getCreateGroupCount());
                }
            }
            if (participantsBlock) participantsBlock.hidden = visible;
            if (sizeField) sizeField.hidden = visible;
            if (participantsInput) participantsInput.required = !visible;
            syncAdvancePerGroupVisibility();
            if (visible) {
                refreshCreatePrizeFields(countGroupParticipants(
                    collectGroupParticipantsFromContainer(groupParticipantsContainer)
                ));
            } else {
                refreshCreatePrizeFields();
            }
        }

        function updateCreateBracketSizeLock() {
            if (!participantsInput || !sizeField || isGroupBracketFormat(formatSelect?.value)) return;
            const size = getCreateBracketSize();
            setBracketSizeFieldLocked(sizeField, sizeSelect, countFilledParticipantLines(participantsInput.value) > size);
        }

        function toggleGroupSettings() {
            if (!formatSelect) return;
            setCreateGroupUiVisible(isGroupBracketFormat(formatSelect.value));
            syncAdvancePerGroupVisibility();
            updateCreateBracketSizeLock();
        }

        formatSelect?.addEventListener('change', () => {
            toggleGroupSettings();
            refreshCreatePrizeFields();
        });
        formatSelect?.addEventListener('input', toggleGroupSettings);
        groupCountInput?.addEventListener('input', () => {
            if (!isGroupBracketFormat(formatSelect?.value)) return;
            renderGroupParticipantFields(groupParticipantsContainer, getCreateGroupCount());
        });
        groupCountInput?.addEventListener('change', () => {
            if (!isGroupBracketFormat(formatSelect?.value)) return;
            const count = syncGroupCountInput(groupCountInput);
            renderGroupParticipantFields(groupParticipantsContainer, count);
            refreshCreatePrizeFields(countGroupParticipants(
                collectGroupParticipantsFromContainer(groupParticipantsContainer)
            ));
        });
        groupCountInput?.addEventListener('blur', () => {
            if (!isGroupBracketFormat(formatSelect?.value)) return;
            syncGroupCountInput(groupCountInput);
        });
        groupParticipantsContainer?.addEventListener('input', () => {
            if (isGroupBracketFormat(formatSelect?.value)) {
                refreshCreatePrizeFields(countGroupParticipants(
                    collectGroupParticipantsFromContainer(groupParticipantsContainer)
                ));
            }
        });
        toggleGroupSettings();

        window.addEventListener('bracket:langchange', () => {
            toggleGroupSettings();
            if (isGroupBracketFormat(formatSelect?.value)) {
                const current = collectGroupParticipantsFromContainer(groupParticipantsContainer);
                renderGroupParticipantFields(
                    groupParticipantsContainer,
                    current.length || getCreateGroupCount(),
                    current
                );
            }
        });
        window.addEventListener('bracket:create-sync', toggleGroupSettings);

        window.AbsBracketDatetime?.init(form);

        syncParticipantTextarea(participantsInput, getCreateBracketSize(), false);
        sizeSelect?.addEventListener('change', () => {
            if (sizeSelect.disabled) return;
            syncParticipantTextarea(participantsInput, getCreateBracketSize());
            refreshCreatePrizeFields();
            updateCreateBracketSizeLock();
        });
        participantsInput?.addEventListener('input', updateCreateBracketSizeLock);

        refreshCreatePrizeFields();
        updateCreateBracketSizeLock();

        wireBracketVisibilitySwitch(
            document.getElementById('bracketVisibilitySwitch'),
            document.getElementById('bracketVisibility')
        );

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('bracketTitle')?.value?.trim() || '';
            const format = formatSelect?.value || 'single';
            const matchFormat = document.getElementById('bracketMatchFormat')?.value || 'bo1';
            const gameData = window.AbsBracketGames?.collectFrom(gamePickerRoot) || { game: 'wot', game_realm: 'ru' };
            const bracketSize = getCreateBracketSize();
            const visibility = document.getElementById('bracketVisibility')?.value || 'public';
            const description = document.getElementById('bracketDescription')?.value?.trim() || '';
            const startsAt = document.getElementById('bracketStartsAt')?.value || '';

            const settings = { matchFormat, bracketSize };
            let participantNames;
            let prizeSize = bracketSize;

            if (isGroupBracketFormat(format)) {
                settings.groupCount = getCreateGroupCount();
                if (isPureGroupFormat(format)) {
                    settings.advancePerGroup = 1;
                } else {
                    settings.advancePerGroup = parseInt(document.getElementById('bracketAdvancePerGroup')?.value, 10) || 2;
                }
                const groupParticipants = collectGroupParticipantsFromContainer(groupParticipantsContainer);
                participantNames = groupParticipants.flat();
                prizeSize = isPureGroupFormat(format)
                    ? settings.groupCount
                    : participantNames.length;
                if (participantNames.length < 2) {
                    toast(I18n.t('participantsHint'), 'error');
                    return;
                }
                if (groupParticipants.filter((g) => g.length > 0).length < 2) {
                    toast(I18n.t('groupMinGroupsHint'), 'error');
                    return;
                }
                settings.groupParticipants = groupParticipants;
            } else {
                const participantLines = Engine.parseParticipantLines(
                    participantsInput?.value || '',
                    bracketSize
                );
                const filledInTextarea = countFilledParticipantLines(participantsInput?.value || '');
                if (filledInTextarea > bracketSize) {
                    toast(I18n.t('participantsExceedSize'), 'error');
                    return;
                }
                participantNames = participantLines.filter(Boolean);
                if (Engine.filledParticipantCount(participantLines) < 2) {
                    toast(I18n.t('participantsHint'), 'error');
                    return;
                }
            }

            let bracketData;
            try {
                bracketData = Engine.generate(format, participantNames, settings);
            } catch (err) {
                toast(err.message || I18n.t('createError'), 'error');
                return;
            }

            const prizeTierOptions = isPureGroupFormat(format)
                ? { format, groupCount: settings.groupCount || getCreateGroupCount() }
                : { format, bracketSize: true };
            const prizeTiers = Prizes.resolvePrizeTiers(format, prizeSize, prizeTierOptions);
            const prizePool = Meta.collectPrizePool(
                document.getElementById('bracketCreatePrizePool'),
                prizeTiers
            );

            const btn = form.querySelector('[type="submit"]');
            if (btn) btn.disabled = true;

            try {
                const res = await apiFetch(window.ABS_BRACKET_CREATE_API, {
                    method: 'POST',
                    body: JSON.stringify({
                        title,
                        format,
                        match_format: matchFormat,
                        game: gameData.game,
                        game_realm: gameData.game_realm,
                        visibility,
                        description,
                        starts_at: startsAt,
                        prize_pool: prizePool,
                        bracket_data: bracketData,
                    }),
                });
                const json = await res.json();
                if (!json.success) {
                    toast(json.error || I18n.t('createError'), 'error');
                    return;
                }

                const publicId = json.data.public_id;
                if (json.data.edit_token) {
                    GuestStore.setToken(publicId, json.data.edit_token);
                }

                const editHref = I18n.buildHref(`services/bracket/${publicId}/edit`);
                const tokenPart = json.data.edit_token
                    ? `#bk=${encodeURIComponent(json.data.edit_token)}`
                    : '';
                window.location.href = editHref + tokenPart;
            } catch (err) {
                toast(I18n.t('createError'), 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    function initEditor() {
        const root = document.getElementById('bracketEditorRoot');
        if (!root) return;

        const publicId = window.ABS_BRACKET_PUBLIC_ID;
        let metaItem = mergeMetaItem(window.ABS_BRACKET_INITIAL, {});
        let bracketData = metaItem?.bracket_data;
        const format = metaItem?.format || 'single';
        let matchFormat = metaItem?.match_format || 'bo1';
        let canEdit = !!window.ABS_BRACKET_CAN_EDIT;
        let isLoggedOwner = !!window.ABS_BRACKET_IS_LOGGED_OWNER;
        const renderTarget = document.getElementById('bracketRenderTarget');
        const metaDisplay = document.getElementById('bracketMetaDisplay');
        const editControls = document.getElementById('bracketEditControls');
        const tournamentActions = document.getElementById('bracketTournamentActions');
        const noEditMsg = document.getElementById('bracketNoEditMsg');
        const groupActions = document.getElementById('bracketGroupActions');
        const groupActionsHint = document.getElementById('bracketGroupActionsHint');
        const generatePlayoffBtn = document.getElementById('bracketGeneratePlayoffBtn');

        function getEditToken() {
            return GuestStore.getToken(publicId);
        }

        GuestStore.consumeHashToken?.(publicId);

        function setEditUiState(enabled) {
            if (editControls) editControls.hidden = !enabled;
            if (noEditMsg) noEditMsg.hidden = enabled;
            updateParticipantsPanel();
        }

        function canEditMatches() {
            return canEdit && !isTournamentCompleted(metaItem);
        }

        const editParticipantsInput = document.getElementById('bracketEditParticipants');
        const editGroupParticipantsContainer = document.getElementById('bracketEditGroupParticipants');
        const editParticipantsBlock = document.getElementById('bracketEditParticipantsBlock');
        const editGroupOnlyBlock = document.getElementById('bracketEditGroupOnly');
        const editSizeSelect = document.getElementById('bracketEditParticipantSize');
        const editSizeField = document.getElementById('bracketEditSizeField');
        const editGroupCountInput = document.getElementById('bracketEditGroupCount');
        const editAdvancePerGroupField = document.getElementById('bracketEditAdvancePerGroupField');
        const editAdvancePerGroupInput = document.getElementById('bracketEditAdvancePerGroup');
        const editPrizePool = document.getElementById('bracketEditPrizePool');

        window.AbsBracketCombobox?.wireNumber(document.getElementById('bracketEditGroupCountCombobox'), {
            min: BRACKET_MIN_GROUPS,
            max: BRACKET_MAX_GROUPS,
            defaultValue: 4,
        });

        function getEditGroupCount() {
            return clampGroupCount(editGroupCountInput?.value || bracketData?.settings?.groupCount || 4);
        }

        function syncEditAdvancePerGroupVisibility() {
            if (!editAdvancePerGroupField) return;
            editAdvancePerGroupField.hidden = isPureGroupFormat(format);
        }

        function syncEditGroupSettingsFields() {
            if (!isGroupBracketFormat(format)) return;
            const groupCount = bracketData?.settings?.groupCount || getEditGroupParticipantsFromData().length || 4;
            if (editGroupCountInput) {
                editGroupCountInput.value = String(clampGroupCount(groupCount));
            }
            if (editAdvancePerGroupInput) {
                editAdvancePerGroupInput.value = String(
                    isPureGroupFormat(format)
                        ? 1
                        : (bracketData?.settings?.advancePerGroup || 2)
                );
            }
            syncEditAdvancePerGroupVisibility();
        }

        function syncEditGroupUi() {
            const isGroup = isGroupBracketFormat(format);
            const rosterEditable = canEditMatches();
            if (editGroupOnlyBlock) editGroupOnlyBlock.hidden = !isGroup || !rosterEditable;
            if (editParticipantsBlock) editParticipantsBlock.hidden = isGroup || !rosterEditable;
            if (editSizeField) editSizeField.hidden = isGroup;
            syncEditAdvancePerGroupVisibility();
            syncEditGroupParticipantFields();
            if (isGroup) {
                syncEditGroupSettingsFields();
            }
        }

        function getEditGroupParticipantsFromData() {
            return (bracketData?.settings?.groups || []).map((g) => g.names || []);
        }

        function syncEditGroupParticipantFields() {
            if (!editGroupParticipantsContainer) return;
            const isGroup = isGroupBracketFormat(format);
            if (!isGroup) {
                editGroupParticipantsContainer.innerHTML = '';
                return;
            }
            const groupCount = getEditGroupCount();
            renderGroupParticipantFields(
                editGroupParticipantsContainer,
                groupCount,
                getEditGroupParticipantsFromData()
            );
        }

        function getEditGroupParticipantNames() {
            return collectGroupParticipantsFromContainer(editGroupParticipantsContainer).flat();
        }

        function groupsParticipantsEqual(a, b) {
            const left = a || [];
            const right = b || [];
            if (left.length !== right.length) return false;
            return left.every((group, gi) => {
                const other = right[gi] || [];
                if (group.length !== other.length) return false;
                return group.every((name, ni) => name === other[ni]);
            });
        }

        function getEditBracketSize() {
            return Engine.normalizeBracketSize(
                editSizeSelect?.value || Engine.resolveBracketSize(bracketData)
            );
        }

        function updateEditBracketSizeLock() {
            if (!editParticipantsInput || !editSizeField || isGroupBracketFormat(format)) return;
            const size = getEditBracketSize();
            setBracketSizeFieldLocked(editSizeField, editSizeSelect, countFilledParticipantLines(editParticipantsInput.value) > size);
        }

        function syncEditParticipantFields() {
            syncEditGroupUi();
            if (isGroupBracketFormat(format)) return;
            if (!bracketData || !editParticipantsInput || !editSizeSelect) return;
            const size = Engine.resolveBracketSize(bracketData);
            editSizeSelect.value = String(size);
            refreshBracketSizeSelect(editSizeSelect);
            syncParticipantTextarea(editParticipantsInput, size, false);
            editParticipantsInput.value = Engine.participantsToEditText(bracketData.participants || []);
            syncParticipantTextarea(editParticipantsInput, size, true);
            updateEditBracketSizeLock();
        }

        function updateParticipantsPanel() {
            syncEditGroupUi();
        }

        function getEditParticipantNames() {
            const size = getEditBracketSize();
            const lines = Engine.parseParticipantLines(editParticipantsInput?.value || '', size);
            return lines.filter((n) => n && !/^BYE/i.test(n));
        }

        function getStoredParticipantNames() {
            return (bracketData?.participants || [])
                .map((p) => String(p || '').trim())
                .filter((p) => p && !/^BYE/i.test(p));
        }

        function hasParticipantChanges() {
            if (!canEditMatches()) return false;
            if (isGroupBracketFormat(format)) {
                const current = collectGroupParticipantsFromContainer(editGroupParticipantsContainer);
                return !groupsParticipantsEqual(current, getEditGroupParticipantsFromData());
            }
            if (!editParticipantsInput) return false;
            const newSize = getEditBracketSize();
            const oldSize = Engine.resolveBracketSize(bracketData);
            if (newSize !== oldSize) return true;
            const newNames = getEditParticipantNames();
            const oldNames = getStoredParticipantNames();
            if (newNames.length !== oldNames.length) return true;
            return newNames.some((name, i) => name !== oldNames[i]);
        }

        function buildBracketFromParticipantFields() {
            if (isGroupBracketFormat(format)) {
                const groupParticipants = collectGroupParticipantsFromContainer(editGroupParticipantsContainer);
                const names = groupParticipants.flat();
                if (names.length < 2) {
                    throw new Error(I18n.t('participantsHint'));
                }
                if (groupParticipants.filter((g) => g.length > 0).length < 2) {
                    throw new Error(I18n.t('groupMinGroupsHint'));
                }

                let newData = Engine.regenerateWithParticipants(format, bracketData, names, {
                    matchFormat: matchFormatSelect?.value || matchFormat,
                    groupParticipants,
                    advancePerGroup: isPureGroupFormat(format)
                        ? 1
                        : (parseInt(editAdvancePerGroupInput?.value, 10) || bracketData?.settings?.advancePerGroup || 2),
                    groupCount: getEditGroupCount(),
                });

                window.AbsBracketGroup.stripPostGroupMatches(newData);
                newData.settings = newData.settings || {};
                newData.settings.playoffGenerated = false;
                newData.settings.playoffParticipants = null;
                newData.settings.playoffType = null;
                return newData;
            }

            const size = getEditBracketSize();
            const lines = Engine.parseParticipantLines(editParticipantsInput?.value || '', size);
            if (countFilledParticipantLines(editParticipantsInput?.value || '') > size) {
                throw new Error(I18n.t('participantsExceedSize'));
            }
            const filledCount = Engine.filledParticipantCount(lines);
            if (filledCount < 2) {
                throw new Error(I18n.t('participantsHint'));
            }

            let newData = Engine.regenerateWithParticipants(format, bracketData, lines.filter(Boolean), {
                bracketSize: size,
                matchFormat: matchFormatSelect?.value || matchFormat,
            });

            return newData;
        }

        function syncEditFormValues(item) {
            if (!item) return;
            const descEl = document.getElementById('bracketEditDescription');
            if (descEl && document.activeElement !== descEl) {
                descEl.value = item.description || '';
            }
            const startsEl = document.getElementById('bracketEditStartsAt');
            if (startsEl) {
                const pickerWrap = startsEl.closest('.bracket-datetime');
                if (!pickerWrap || !pickerWrap.contains(document.activeElement)) {
                    startsEl.value = Meta.toDatetimeLocalValue(item.starts_at) || '';
                }
            }
        }

        function collectMetaPayload() {
            const formatValue = metaItem?.format || format;
            const bracketDataRef = metaItem?.bracket_data || bracketData || {};
            const tierOptions = isPureGroupFormat(formatValue)
                ? { format: formatValue, groupCount: bracketDataRef.settings?.groupCount || 2 }
                : { format: formatValue, bracketSize: true };
            const size = isPureGroupFormat(formatValue)
                ? (bracketDataRef.settings?.groupCount || 2)
                : (canEditMatches() && editSizeSelect
                    ? getEditBracketSize()
                    : Engine.resolveBracketSize(bracketDataRef));
            const tiers = Prizes.resolvePrizeTiers(formatValue, size, tierOptions);
            return {
                description: document.getElementById('bracketEditDescription')?.value ?? '',
                starts_at: document.getElementById('bracketEditStartsAt')?.value ?? '',
                prize_pool: Meta.collectPrizePool(editPrizePool, tiers),
            };
        }

        function refreshEditPrizeFields() {
            if (!editPrizePool || !canEdit) return;
            const formatValue = metaItem?.format || format;
            const bracketDataRef = metaItem?.bracket_data || bracketData || {};
            const tierOptions = isPureGroupFormat(formatValue)
                ? { format: formatValue, groupCount: bracketDataRef.settings?.groupCount || getEditGroupCount() }
                : { format: formatValue, bracketSize: true };
            const size = isPureGroupFormat(formatValue)
                ? (getEditGroupCount() || bracketDataRef.settings?.groupCount || 2)
                : (canEditMatches() && editSizeSelect
                    ? getEditBracketSize()
                    : Engine.resolveBracketSize(bracketDataRef));
            const existing = Meta.collectPrizePool(editPrizePool);

            if (isPureGroupFormat(formatValue)) {
                Meta.renderPrizeFieldset(editPrizePool, size, existing, {
                    format: formatValue,
                    groupCount: size,
                });
                return;
            }

            Meta.renderPrizeFieldset(editPrizePool, size, existing, {
                format: formatValue,
                bracketSize: true,
            });
        }

        function refreshMetaPanels() {
            if (metaDisplay) {
                Meta.renderDisplay(metaDisplay, metaItem);
            }
            if (canEdit) {
                syncEditFormValues(metaItem);
                refreshEditPrizeFields();
            }
            if (tournamentActions) {
                Meta.renderTournamentActions(tournamentActions, metaItem, canEdit);
                mountTournamentActions();
            }
            if (canEdit) {
                wireMetaButtons();
            }
        }

        function wireMetaButtons() {
            document.getElementById('bracketMarkCompleteBtn')?.addEventListener('click', async () => {
                if (!canEdit) return;
                try {
                    const data = await save({ mark_completed: true });
                    metaItem = mergeMetaItem(metaItem, data);
                    refreshMetaPanels();
                    renderBracket();
                    toast(I18n.t('saved'), 'success');
                } catch (e) {
                    toast(e.message || I18n.t('saveError'), 'error');
                }
            });

            document.getElementById('bracketReopenBtn')?.addEventListener('click', async () => {
                if (!canEdit) return;
                try {
                    const data = await save({ reopen_tournament: true });
                    metaItem = mergeMetaItem(metaItem, data);
                    refreshMetaPanels();
                    renderBracket();
                    toast(I18n.t('saved'), 'success');
                } catch (e) {
                    toast(e.message || I18n.t('saveError'), 'error');
                }
            });
        }

        async function save(updates) {
            const payload = {
                public_id: publicId,
                ...updates,
            };
            if (!isLoggedOwner) {
                const token = getEditToken();
                if (token) {
                    payload.edit_token = token;
                }
            }

            const res = await apiFetch(window.ABS_BRACKET_UPDATE_API, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || I18n.t('saveError'));
            if (json.data) {
                metaItem = mergeMetaItem(metaItem, json.data);
                if (json.data.bracket_data) {
                    bracketData = Engine.rebuildBracket(JSON.parse(JSON.stringify(json.data.bracket_data)));
                }
            }
            return json.data;
        }

        function positionGroupActions() {
            if (!groupActions || !renderTarget) return;
            const groupStage = renderTarget.querySelector('.bracket-group-stage');
            if (isGroupBracketFormat(format) && groupStage) {
                groupStage.insertAdjacentElement('afterend', groupActions);
            }
        }

        function updateGroupActions() {
            if (!groupActions) return;

            const show = hasPlayoffFormat(format) && canEditMatches();
            groupActions.hidden = !show;
            if (!show) return;

            const status = Engine.getGroupStageStatus(bracketData);
            const hasPlayoff = bracketData.settings?.playoffGenerated === true;

            if (groupActionsHint) {
                if (status.complete) {
                    groupActionsHint.textContent = I18n.t('groupStageComplete')
                        .replace('{count}', String(status.qualifierCount));
                } else {
                    groupActionsHint.textContent = I18n.t('groupStageIncomplete')
                        .replace('{pending}', String(status.pendingCount));
                }
            }

            if (generatePlayoffBtn) {
                generatePlayoffBtn.textContent = hasPlayoff
                    ? I18n.t('regeneratePlayoff')
                    : I18n.t('generatePlayoff');
                generatePlayoffBtn.disabled = !status.complete;
            }
        }

        function mountTournamentActions() {
            if (!tournamentActions || !renderTarget) return;

            const host = renderTarget.closest('.bracket-playoff-section') || renderTarget.parentElement || renderTarget;

            if (tournamentActions.parentElement !== host) {
                host.appendChild(tournamentActions);
            }
        }

        function renderBracket() {
            if (!renderTarget || !bracketData) return;
            if (metaItem) {
                metaItem = { ...metaItem, bracket_data: bracketData };
            }
            if (metaDisplay) {
                Meta.renderDisplay(metaDisplay, metaItem);
            }
            const editable = canEditMatches();
            Renderer.render(renderTarget, bracketData, {
                format,
                matchFormat,
                editable,
                onWinnerClick: editable ? onWinnerClick : null,
                onScoreChange: editable ? onScoreChange : null,
            });
            mountTournamentActions();
            positionGroupActions();
            updateGroupActions();
            updateParticipantsPanel();
        }

        async function persistBracket() {
            await save({ bracket_data: bracketData });
            toast(I18n.t('saved'), 'success');
        }

        async function onWinnerClick(matchId, side) {
            bracketData = Engine.setMatchWinner(bracketData, matchId, side, matchFormat);
            renderBracket();
            try {
                await persistBracket();
            } catch (e) {
                toast(I18n.t('saveError'), 'error');
            }
        }

        let scoreSaveTimer = null;
        async function onScoreChange(matchId, score1, score2) {
            bracketData = Engine.setMatchScores(bracketData, matchId, score1, score2, matchFormat);
            renderBracket();
            clearTimeout(scoreSaveTimer);
            scoreSaveTimer = setTimeout(async () => {
                try {
                    await persistBracket();
                } catch (e) {
                    toast(I18n.t('saveError'), 'error');
                }
            }, 400);
        }

        if (bracketData) {
            if (isPureGroupFormat(format)) {
                window.AbsBracketGroup.stripPostGroupMatches(bracketData);
                bracketData.settings = bracketData.settings || {};
                bracketData.settings.playoffGenerated = false;
                bracketData.settings.playoffParticipants = null;
                bracketData.settings.playoffType = null;
            } else if (hasPlayoffFormat(format) && !bracketData.settings?.playoffGenerated) {
                window.AbsBracketGroup.stripPostGroupMatches(bracketData);
            }
            bracketData = Engine.rebuildBracket(JSON.parse(JSON.stringify(bracketData)));
        }

        async function resolveAccess() {
            setEditUiState(canEdit);

            if (canEdit) {
                syncEditParticipantFields();
                renderBracket();
                refreshMetaPanels();
                return;
            }

            renderBracket();

            if (!window.ABS_BRACKET_IS_GUEST) {
                return;
            }

            const token = getEditToken();
            if (!token) {
                return;
            }

            try {
                const access = await window.AbsBracketAccess.verifyEditAccess(publicId);
                if (!access.can_edit) {
                    setEditUiState(false);
                    renderBracket();
                    return;
                }

                canEdit = true;
                if (access.is_logged_owner) {
                    isLoggedOwner = true;
                    window.ABS_BRACKET_IS_LOGGED_OWNER = true;
                }
                if (access.claimed && typeof window.showSiteToast === 'function') {
                    toast(I18n.t('claimedToAccount'), 'success');
                }
                setEditUiState(true);
                syncEditParticipantFields();
                refreshMetaPanels();
                renderBracket();
            } catch (e) {
                setEditUiState(false);
                renderBracket();
            }
        }

        resolveAccess();

        const titleInput = document.getElementById('bracketEditTitle');
        const visibilityInput = document.getElementById('bracketEditVisibility');
        const matchFormatSelect = document.getElementById('bracketEditMatchFormat');
        const gamePickerRoot = document.getElementById('bracketEditGamePicker');
        const saveBtn = document.getElementById('bracketSaveBtn');
        const deleteBtn = document.getElementById('bracketDeleteBtn');
        const copyBtn = document.getElementById('bracketCopyLinkBtn');

        if (window.AbsBracketGames && gamePickerRoot) {
            gamePickerRoot.innerHTML = window.AbsBracketGames.renderPicker({
                game: metaItem?.game || 'wot',
                realm: metaItem?.game_realm || 'ru',
                idPrefix: 'bracketEditGame',
            });
            window.AbsBracketGames.wirePicker(gamePickerRoot);
        }

        wireBracketVisibilitySwitch(
            document.getElementById('bracketEditVisibilitySwitch'),
            visibilityInput
        );

        if (editControls) {
            window.AbsBracketDatetime?.init(editControls);
        }

        syncEditGroupUi();
        refreshEditPrizeFields();

        editGroupCountInput?.addEventListener('input', () => {
            if (!isGroupBracketFormat(format)) return;
            renderGroupParticipantFields(editGroupParticipantsContainer, getEditGroupCount());
        });
        editGroupCountInput?.addEventListener('change', () => {
            if (!isGroupBracketFormat(format)) return;
            const count = syncGroupCountInput(editGroupCountInput);
            renderGroupParticipantFields(editGroupParticipantsContainer, count);
            refreshEditPrizeFields();
        });
        editGroupCountInput?.addEventListener('blur', () => {
            if (!isGroupBracketFormat(format)) return;
            syncGroupCountInput(editGroupCountInput);
        });
        editGroupParticipantsContainer?.addEventListener('input', () => {
            if (isGroupBracketFormat(format)) {
                refreshEditPrizeFields();
            }
        });

        saveBtn?.addEventListener('click', async () => {
            if (!canEdit) return;

            const gameData = window.AbsBracketGames?.collectFrom(gamePickerRoot) || {};
            const savePayload = {
                title: titleInput?.value?.trim(),
                visibility: visibilityInput?.value,
                match_format: matchFormatSelect?.value,
                game: gameData.game,
                game_realm: gameData.game_realm,
                ...collectMetaPayload(),
            };

            if (canEditMatches() && hasParticipantChanges()) {
                if (Engine.hasMatchResults(bracketData) && !confirm(I18n.t('confirmRegenerate'))) {
                    return;
                }
                try {
                    savePayload.bracket_data = buildBracketFromParticipantFields();
                } catch (e) {
                    toast(e.message || I18n.t('participantsHint'), 'error');
                    return;
                }
            }

            saveBtn.disabled = true;
            try {
                const data = await save(savePayload);
                toast(I18n.t('saved'), 'success');
                if (data?.title && titleInput) titleInput.value = data.title;
                metaItem = mergeMetaItem(metaItem, data);
                if (data?.bracket_data) {
                    bracketData = Engine.rebuildBracket(JSON.parse(JSON.stringify(data.bracket_data)));
                    syncEditParticipantFields();
                }
                if (data?.match_format) {
                    matchFormat = data.match_format;
                    if (bracketData?.settings) {
                        bracketData.settings.matchFormat = matchFormat;
                    }
                }
                refreshMetaPanels();
                renderBracket();
            } catch (e) {
                toast(e.message || I18n.t('saveError'), 'error');
            } finally {
                saveBtn.disabled = false;
            }
        });

        deleteBtn?.addEventListener('click', async () => {
            if (!canEdit || !confirm(I18n.t('confirmDelete'))) return;
            const payload = { public_id: publicId };
            if (!isLoggedOwner) {
                const token = getEditToken();
                if (token) {
                    payload.edit_token = token;
                }
            }

            try {
                const res = await apiFetch(window.ABS_BRACKET_DELETE_API, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!json.success) {
                    toast(json.error || I18n.t('saveError'), 'error');
                    return;
                }
                GuestStore.removeToken(publicId);
                window.location.href = I18n.buildHref('services/bracket');
            } catch (e) {
                toast(I18n.t('saveError'), 'error');
            }
        });

        copyBtn?.addEventListener('click', async () => {
            const url = window.location.origin + I18n.buildHref(`services/bracket/${publicId}`);
            try {
                await navigator.clipboard.writeText(url);
                toast(I18n.t('linkCopied'), 'success');
            } catch (e) {
                toast(url, 'info');
            }
        });

        matchFormatSelect?.addEventListener('change', () => {
            matchFormat = matchFormatSelect.value || 'bo1';
            if (bracketData?.settings) {
                bracketData.settings.matchFormat = matchFormat;
            }
            renderBracket();
        });

        editSizeSelect?.addEventListener('change', () => {
            if (editSizeSelect.disabled) return;
            syncParticipantTextarea(editParticipantsInput, getEditBracketSize());
            refreshEditPrizeFields();
            updateEditBracketSizeLock();
        });
        editParticipantsInput?.addEventListener('input', updateEditBracketSizeLock);

        window.addEventListener('bracket:langchange', () => {
            refreshMetaPanels();
            renderBracket();
            if (isGroupBracketFormat(format) && editGroupParticipantsContainer) {
                const current = collectGroupParticipantsFromContainer(editGroupParticipantsContainer);
                renderGroupParticipantFields(
                    editGroupParticipantsContainer,
                    current.length || bracketData?.settings?.groupCount || 4,
                    current.length ? current : getEditGroupParticipantsFromData()
                );
            }
        });

        generatePlayoffBtn?.addEventListener('click', async () => {
            if (!canEditMatches() || !hasPlayoffFormat(format)) return;

            const hasPlayoff = bracketData.settings?.playoffGenerated === true;
            if (hasPlayoff && !confirm(I18n.t('confirmRegeneratePlayoff'))) {
                return;
            }

            generatePlayoffBtn.disabled = true;
            try {
                const playoffType = format === 'group_de' ? 'double' : 'single';
                bracketData = Engine.buildPlayoffFromGroups(bracketData, playoffType);
                renderBracket();
                await persistBracket();
            } catch (e) {
                const msg = e.message === 'GROUP_STAGE_INCOMPLETE'
                    ? I18n.t('groupStageIncomplete').replace('{pending}', String(
                        Engine.getGroupStageStatus(bracketData).pendingCount
                    ))
                    : e.message === 'NOT_ENOUGH_QUALIFIERS'
                        ? I18n.t('notEnoughQualifiers')
                        : (e.message || I18n.t('saveError'));
                toast(msg, 'error');
                updateGroupActions();
            } finally {
                if (generatePlayoffBtn) {
                    generatePlayoffBtn.disabled = !Engine.getGroupStageStatus(bracketData).complete;
                }
            }
        });
    }

    function initViewer() {
        if (document.getElementById('bracketEditorRoot')) return;
        const renderTarget = document.getElementById('bracketRenderTarget');
        const metaDisplay = document.getElementById('bracketMetaDisplay');
        if (!renderTarget) return;

        let metaItem = window.ABS_BRACKET_INITIAL || {};
        const bracketData = metaItem.bracket_data;
        const format = metaItem.format || 'single';
        const matchFormat = metaItem.match_format || 'bo1';

        const normalized = bracketData
            ? window.AbsBracketEngine.rebuildBracket(JSON.parse(JSON.stringify(bracketData)))
            : bracketData;
        metaItem = { ...metaItem, bracket_data: normalized };

        if (metaDisplay) {
            Meta.renderDisplay(metaDisplay, metaItem);
        }

        Renderer.render(renderTarget, normalized, { format, matchFormat, editable: false });

        window.addEventListener('bracket:langchange', () => {
            if (metaDisplay) {
                Meta.renderDisplay(metaDisplay, metaItem);
            }
            Renderer.render(renderTarget, normalized, { format, matchFormat, editable: false });
        });

        const copyBtn = document.getElementById('bracketCopyLinkBtn');
        copyBtn?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast(I18n.t('linkCopied'), 'success');
            } catch (e) {
                // ignore
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initCreateForm();
        initEditor();
        initViewer();
    });

    window.AbsBracketEditor = {
        initCreateForm,
        initEditor,
        initViewer,
        refreshCreatePrizeFields,
        refreshBracketVisibilitySwitchLabels,
    };
})();
