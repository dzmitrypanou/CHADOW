(() => {
    'use strict';

    const store = () => window.AbsTacticsStore;
    const i18n = () => window.AbsTacticsI18n;
    const maps = () => window.AbsTacticsMaps;

    const POLL_MS = 750;
    const POLL_RT_MS = 200;
    const POLL_WS_MS = 2000;
    const PRESENCE_POLL_MS = 2500;
    const SAVE_MS = 1000;

    let roomState = null;
    let accessToken = null;
    let wsToken = null;
    let wsUrl = null;
    let nickname = '';
    let clientId = '';
    let revision = 1;
    let saveTimer = null;
    let pollTimer = null;
    let presencePollTimer = null;
    let wsClient = null;
    let chatCtrl = null;
    let slidesCtrl = null;
    let addMapPicker = null;
    let canvasCtrl = null;
    let dirty = false;
    let wsConnected = false;
    let canManage = false;
    let canDraw = false;
    let participantsList = [];
    let settingsTimer = null;
    let settingsSaving = false;
    let nicknameLockedByUser = false;
    let nicknameEditing = false;
    let wsAuthRefreshing = false;
    let sinceEventId = 0;
    let lastCursorPostKey = '';

    const GUEST_NICKS = ['Guest', 'Гость'];

    function isGuestNickname(nick) {
        return GUEST_NICKS.includes(String(nick || '').trim());
    }

    function roomPublicId() {
        return String(roomState?.public_id || window.ABS_TACTICS_PUBLIC_ID || '');
    }

    const CUSTOM_MAP_CODES = {
        cs2: 'cs2_custom',
        dota2: 'dota2_custom',
    };

    function isDotaStandardSlide(slide) {
        if (!slide) return false;
        return String(slide.game || '').toLowerCase() === 'dota2'
            && String(slide.battle_mode || '').toLowerCase() === 'standard';
    }

    function isCustomRoomSlide(slide) {
        if (!slide) return false;
        const game = String(slide.game || '').toLowerCase();
        const mode = String(slide.battle_mode || '').toLowerCase();
        const code = String(slide.map_code || '').toLowerCase();
        const expected = CUSTOM_MAP_CODES[game];
        return !!expected && mode === 'custom' && code === expected;
    }

    function mapUrlForSlide(slide) {
        if (!slide?.id) return maps().slideMapUrl(slide, roomPublicId());
        const fromCtrl = slidesCtrl?.mapUrls?.[slide.id];
        return fromCtrl || maps().slideMapUrl(slide, roomPublicId());
    }

    function getRoomGame() {
        const slides = roomState?.room_data?.slides;
        if (!Array.isArray(slides) || slides.length === 0) {
            return 'wot';
        }
        for (const slide of slides) {
            if (slide?.game) {
                return String(slide.game);
            }
        }
        return 'wot';
    }

    function canUploadCustomMap(slide) {
        return !!(slide && isCustomRoomSlide(slide) && (canManage || canDraw));
    }

    function syncDotaPickUi(slide) {
        const panel = document.getElementById('tacticsDotaPickAction');
        if (!panel) return;
        panel.hidden = !isDotaStandardSlide(slide);
    }

    function bindDotaPickBtn() {
        const btn = document.getElementById('tacticsDotaPickBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const slide = slidesCtrl?.getActiveSlide();
            if (!isDotaStandardSlide(slide)) return;
            canvasCtrl?.setTool('text');
        });
    }

    function syncCustomMapUploadUi(slide) {
        const panel = document.getElementById('tacticsCustomMapUpload');
        const btn = document.getElementById('tacticsCustomMapUploadBtn');
        if (!panel) return;
        const visible = canUploadCustomMap(slide);
        panel.hidden = !visible;
        if (btn) {
            btn.disabled = customUploadBusy || !visible;
            btn.classList.toggle('is-busy', customUploadBusy);
        }
    }

    let customUploadBusy = false;

    async function uploadCustomMapFile(file) {
        const slide = slidesCtrl?.getActiveSlide();
        if (!file || customUploadBusy || !canUploadCustomMap(slide)) return;

        const apiUrl = window.ABS_TACTICS_UPLOAD_CUSTOM_MAP_API;
        if (!apiUrl) return;

        if (!accessToken) {
            const payload = await refreshSession('');
            if (payload?.access_token) {
                accessToken = payload.access_token;
            }
        }

        customUploadBusy = true;
        syncCustomMapUploadUi(slide);

        const formData = new FormData();
        formData.append('public_id', roomPublicId());
        formData.append('slide_id', slide.id);
        formData.append('access_token', accessToken || '');
        formData.append('csrf_token', window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '');
        formData.append('image', file);

        let res = await store().postFormData(apiUrl, formData, accessToken);

        if (!res.ok && res.status === 403) {
            const payload = await refreshSession('');
            if (payload?.access_token) {
                accessToken = payload.access_token;
                formData.set('access_token', accessToken);
                res = await store().postFormData(apiUrl, formData, accessToken);
            }
        }

        customUploadBusy = false;
        syncCustomMapUploadUi(slide);

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }

        if (res.ok && res.data?.success && res.data?.data?.url) {
            const url = res.data.data.url;
            if (slidesCtrl) {
                slidesCtrl.mapUrls[slide.id] = url;
            }
            if (!window.ABS_TACTICS_MAP_URLS) {
                window.ABS_TACTICS_MAP_URLS = {};
            }
            window.ABS_TACTICS_MAP_URLS[slide.id] = url;
            if (canvasCtrl) {
                await canvasCtrl.loadSlide(slide, url);
            }
            return;
        }

        const message = res.data?.error || i18n().t('uploadCustomMapError');
        window.alert(message);
    }

    function bindCustomMapUpload() {
        const input = document.getElementById('tacticsCustomMapFile');
        const btn = document.getElementById('tacticsCustomMapUploadBtn');
        if (!input || input.dataset.bound) return;
        input.dataset.bound = '1';

        btn?.addEventListener('click', () => {
            if (customUploadBusy || !canUploadCustomMap(slidesCtrl?.getActiveSlide())) return;
            input.click();
        });

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            await uploadCustomMapFile(file);
        });
    }

    function gameNickForSlide(slide) {
        if (!slide || !window.ABS_TACTICS_GAME_NICKS) return '';
        const game = slide.game || 'wot';
        return String(window.ABS_TACTICS_GAME_NICKS[game] || '').trim();
    }

    function setSaveStatus() {
        /* connection / save status hidden per UI design */
    }

    async function copyTextToClipboard(text) {
        const value = String(text || '');
        if (!value) return false;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (e) {
            /* fallback below */
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (err) {
            copied = false;
        }
        document.body.removeChild(textarea);
        return copied;
    }

    let copyLinkResetTimer = null;

    function ensureCopyBtnSizeLocked(btn) {
        if (!btn || btn.dataset.copySizeLocked) return;

        const textWrap = btn.querySelector('.tactics-room-code-btn__text');
        const btnWidth = btn.getBoundingClientRect().width;
        if (btnWidth > 0) {
            btn.style.minWidth = Math.ceil(btnWidth) + 'px';
        }
        if (textWrap) {
            const textWidth = textWrap.getBoundingClientRect().width;
            if (textWidth > 0) {
                textWrap.style.minWidth = Math.ceil(textWidth) + 'px';
            }
        }
        btn.dataset.copySizeLocked = '1';
    }

    function showCopyLinkFeedback(ok) {
        const btn = document.getElementById('tacticsCopyLinkBtn');
        if (!btn) return;

        ensureCopyBtnSizeLocked(btn);

        const textWrap = btn.querySelector('.tactics-room-code-btn__text');
        const icon = btn.querySelector('.tactics-room-code-btn__icon');
        if (!textWrap) return;

        if (copyLinkResetTimer) {
            clearTimeout(copyLinkResetTimer);
            copyLinkResetTimer = null;
        }

        if (!btn.dataset.copyDefaultHtml) {
            btn.dataset.copyDefaultHtml = textWrap.innerHTML;
            if (icon) {
                btn.dataset.copyDefaultIcon = icon.className;
            }
        }

        if (!ok) {
            btn.classList.add('is-copy-error');
            textWrap.innerHTML = '<span class="tactics-room-code-btn__copied tactics-room-code-btn__copied--error">'
                + escapeHtml(i18n().t('copyLinkFail'))
                + '</span>';
            copyLinkResetTimer = setTimeout(() => {
                textWrap.innerHTML = btn.dataset.copyDefaultHtml;
                btn.classList.remove('is-copy-error');
                copyLinkResetTimer = null;
            }, 2000);
            return;
        }

        btn.classList.add('is-copied');
        if (icon) {
            icon.className = 'fas fa-check tactics-room-code-btn__icon';
        }
        textWrap.innerHTML = '<span class="tactics-room-code-btn__copied">'
            + escapeHtml(i18n().t('copyLinkDone'))
            + '</span>';

        copyLinkResetTimer = setTimeout(() => {
            textWrap.innerHTML = btn.dataset.copyDefaultHtml;
            if (icon && btn.dataset.copyDefaultIcon) {
                icon.className = btn.dataset.copyDefaultIcon;
            }
            btn.classList.remove('is-copied');
            copyLinkResetTimer = null;
        }, 1500);
    }

    function bindCopyLinkBtn() {
        const btn = document.getElementById('tacticsCopyLinkBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';

        requestAnimationFrame(() => ensureCopyBtnSizeLocked(btn));

        btn.addEventListener('click', async () => {
            const ok = await copyTextToClipboard(window.location.href);
            showCopyLinkFeedback(ok);
        });
    }

    function showJoinError(msg) {
        const el = document.getElementById('tacticsRoomJoinError');
        if (!el) return;
        el.hidden = !msg;
        el.textContent = msg || '';
    }

    function updateLocalParticipantNickname(nextNickname) {
        const selfId = String(clientId || '');
        participantsList = participantsList.map((p) => (
            p.clientId === selfId ? { ...p, nickname: nextNickname } : p
        ));
    }

    function canEditNickname() {
        return !window.ABS_TACTICS_IS_LOGGED_IN;
    }

    function startNicknameEdit() {
        if (!canEditNickname()) return;
        nicknameEditing = true;
        renderParticipants(participantsList);
        const input = document.querySelector('.tactics-participant-name-input');
        if (!input) return;
        input.focus();
        input.select();
        input.addEventListener('keydown', onNicknameInputKeydown);
    }

    function cancelNicknameEdit() {
        nicknameEditing = false;
        renderParticipants(participantsList);
    }

    function onNicknameInputKeydown(ev) {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            saveNickname();
        }
        if (ev.key === 'Escape') {
            ev.preventDefault();
            cancelNicknameEdit();
        }
    }

    async function saveNickname() {
        if (!canEditNickname()) return;
        const input = document.querySelector('.tactics-participant-name-input');
        const next = (input?.value || '').trim()
            || window.ABS_TACTICS_DEFAULT_NICK
            || 'Guest';
        if (next === nickname) {
            nicknameEditing = false;
            renderParticipants(participantsList);
            return;
        }

        const prev = nickname;
        nickname = next;
        nicknameEditing = false;

        const payload = await refreshSession('');
        if (!payload) {
            nickname = prev;
            renderParticipants(participantsList);
            return;
        }

        accessToken = payload.access_token;
        wsToken = payload.ws_token;
        wsUrl = payload.ws_url;

        if (wsClient) {
            wsClient.nickname = nickname;
            wsClient.reconnectWithToken(wsToken);
        }

        nicknameLockedByUser = true;
        updateLocalParticipantNickname(nickname);
        renderParticipants(participantsList);
    }

    async function applyGameNicknameForSlide(slide) {
        if (!window.ABS_TACTICS_IS_LOGGED_IN) return;
        if (nicknameLockedByUser) return;

        const next = gameNickForSlide(slide);
        if (!next || next === nickname) return;

        nickname = next;
        updateLocalParticipantNickname(nickname);
        renderParticipants(participantsList);

        if (wsClient?.ws?.readyState === WebSocket.OPEN) {
            wsClient.nickname = nickname;
            wsClient.updateNickname(nickname);
        }
    }

    function getDrawSettings() {
        if (!roomState.room_data) {
            roomState.room_data = {};
        }
        if (!roomState.room_data.settings) {
            roomState.room_data.settings = {};
        }
        return roomState.room_data.settings;
    }

    function getDrawSettingsPayload() {
        const settings = getDrawSettings();
        return {
            draw_mode: settings.draw_mode === 'open' ? 'open' : 'restricted',
            cursors_mode: settings.cursors_mode === 'off' ? 'off' : 'open',
            editors: Array.isArray(settings.editors) ? [...settings.editors] : [],
            show_grid: settings.show_grid !== false,
        };
    }

    function broadcastDrawSettings() {
        wsClient?.sendSettings(getDrawSettingsPayload());
    }

    async function saveDrawSettingsNow() {
        if (!canManage || !roomState || !accessToken) return;

        const slide = slidesCtrl?.getActiveSlide();
        if (slide && canvasCtrl) {
            slidesCtrl.updateSlideCanvas(slide.id, canvasCtrl.getCanvasState());
        }

        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
            public_id: roomState.public_id,
            room_data: roomState.room_data,
            revision,
            access_token: accessToken,
        }, accessToken);

        if (res.ok && res.data.success) {
            revision = res.data.data.revision || revision + 1;
            roomState.revision = revision;
        } else if (res.status === 409) {
            await resyncRoom(true);
        }
    }

    async function saveGridSettingNow() {
        if (!canDraw || !roomState || !accessToken) return;

        const slide = slidesCtrl?.getActiveSlide();
        if (slide && canvasCtrl) {
            slidesCtrl.updateSlideCanvas(slide.id, canvasCtrl.getCanvasState());
        }

        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
            public_id: roomState.public_id,
            room_data: roomState.room_data,
            revision,
            access_token: accessToken,
        }, accessToken);

        if (res.ok && res.data.success) {
            revision = res.data.data.revision || revision + 1;
            roomState.revision = revision;
        } else if (res.status === 409) {
            await resyncRoom(true);
        }
    }

    function pushDrawSettingsChange() {
        applyDrawPermissions();
        broadcastDrawSettings();
        saveDrawSettingsNow();
    }

    function pushGridChange(visible) {
        const settings = getDrawSettings();
        settings.show_grid = !!visible;
        broadcastDrawSettings();
        saveGridSettingNow();
    }

    function applyRemoteGridSetting(showGrid) {
        if (!roomState?.room_data) return;
        const settings = getDrawSettings();
        const next = showGrid !== false;
        if (settings.show_grid === next) return;
        settings.show_grid = next;
        canvasCtrl?.setShowGrid(next);
    }

    function computeCanDraw() {
        if (canManage) return true;
        const settings = getDrawSettings();
        if (settings.draw_mode === 'open') return true;
        const editors = Array.isArray(settings.editors) ? settings.editors : [];
        return editors.includes(String(clientId || ''));
    }

    function computeCanShareCursor() {
        const settings = getDrawSettings();
        return settings.cursors_mode !== 'off';
    }

    function applyDrawPermissions() {
        canDraw = computeCanDraw();
        canvasCtrl?.setDrawEnabled(canDraw);
        updateDrawLockBtn();
        applyCursorPermissions();
        const gridBtn = document.getElementById('tacticsGridToggleBtn');
        if (gridBtn) {
            gridBtn.disabled = !canDraw;
            gridBtn.classList.toggle('is-disabled', !canDraw);
        }
        slidesCtrl?.setCanAddSlides(canManage || canDraw);
        const mapsPanel = document.getElementById('tacticsMapsPanel');
        if (mapsPanel) {
            mapsPanel.classList.toggle('is-disabled', !(canManage || canDraw));
        }
        syncCustomMapUploadUi(slidesCtrl?.getActiveSlide());
        syncDotaPickUi(slidesCtrl?.getActiveSlide());
        renderParticipants(participantsList);
    }

    function applyCursorPermissions() {
        const allowed = computeCanShareCursor();
        canvasCtrl?.setShareMyCursorAllowed(allowed);
        canvasCtrl?.updateShareCursorBtn();
        updateCursorsLockBtn();
        if (!allowed) {
            canvasCtrl?.clearRemoteCursors();
        }
    }

    function updateCursorsLockBtn() {
        const btn = document.getElementById('tacticsCursorsLockBtn');
        if (!btn) return;

        const settings = getDrawSettings();
        const disabled = settings.cursors_mode === 'off';
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = disabled ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
        btn.classList.toggle('is-active', disabled);
        btn.title = i18n().t(disabled ? 'cursorsDisabled' : 'cursorsEnabled');
        btn.disabled = !canManage;
        btn.classList.toggle('is-disabled', !canManage);
    }

    function bindCursorsLockBtn() {
        const btn = document.getElementById('tacticsCursorsLockBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', () => {
            if (!canManage) return;
            const settings = getDrawSettings();
            settings.cursors_mode = settings.cursors_mode === 'off' ? 'open' : 'off';
            pushDrawSettingsChange();
        });
    }

    function toggleDrawModeLock() {
        if (!canManage) return;
        const settings = getDrawSettings();
        settings.draw_mode = settings.draw_mode === 'open' ? 'restricted' : 'open';
        pushDrawSettingsChange();
    }

    function updateDrawLockBtn() {
        const settings = getDrawSettings();
        const restricted = settings.draw_mode !== 'open';
        const title = i18n().t(restricted ? 'drawRestricted' : 'drawOpen');

        ['tacticsDrawLockBtn', 'tacticsDrawLockBtnSide'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = restricted ? 'fas fa-lock' : 'fas fa-lock-open';
            }
            btn.classList.toggle('is-active', restricted);
            btn.title = title;
            btn.disabled = !canManage;
            btn.classList.toggle('is-disabled', !canManage);
        });
    }

    function bindDrawLockBtn() {
        ['tacticsDrawLockBtn', 'tacticsDrawLockBtnSide'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn || btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => toggleDrawModeLock());
        });
    }

    function bindEditorChrome() {
        const leftBtn = document.getElementById('tacticsCollapseLeft');
        const rightBtn = document.getElementById('tacticsCollapseRight');
        const leftCol = document.getElementById('tacticsToolsColumn');
        const rightCol = document.getElementById('tacticsRightColumn');

        leftBtn?.addEventListener('click', () => {
            const collapsed = leftCol?.classList.toggle('is-collapsed');
            leftBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            canvasCtrl?.scheduleResize?.();
        });

        rightBtn?.addEventListener('click', () => {
            const collapsed = rightCol?.classList.toggle('is-collapsed');
            rightBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            canvasCtrl?.scheduleResize?.();
        });
    }

    function toggleParticipantEditor(targetClientId) {
        if (!canManage || !targetClientId || targetClientId === clientId) return;

        const settings = getDrawSettings();
        const editors = Array.isArray(settings.editors) ? [...settings.editors] : [];
        const idx = editors.indexOf(targetClientId);
        if (idx >= 0) {
            editors.splice(idx, 1);
        } else {
            editors.push(targetClientId);
        }
        settings.editors = editors;
        pushDrawSettingsChange();
    }

    function applyRemoteDrawSettings(settings) {
        if (!settings || !roomState?.room_data) return;

        const local = getDrawSettings();

        if (typeof settings.draw_mode === 'string') {
            local.draw_mode = settings.draw_mode === 'open' ? 'open' : 'restricted';
        }
        if (Array.isArray(settings.editors)) {
            local.editors = settings.editors
                .map((id) => String(id || '').trim())
                .filter((id) => id !== '');
        }

        if (typeof settings.show_grid === 'boolean') {
            applyRemoteGridSetting(settings.show_grid);
        }

        if (typeof settings.cursors_mode === 'string') {
            local.cursors_mode = settings.cursors_mode === 'off' ? 'off' : 'open';
        }

        applyDrawPermissions();
    }

    function normalizeParticipants(list) {
        if (!Array.isArray(list)) return [];
        return list
            .map((p) => ({
                clientId: String(p?.clientId || '').trim(),
                nickname: String(p?.nickname || '').trim(),
            }))
            .filter((p) => p.clientId !== '');
    }

    function renderParticipants(list) {
        const el = document.getElementById('tacticsParticipants');
        if (!el) return;

        const selfId = String(clientId || '');
        let items = normalizeParticipants(list);
        if (selfId && !items.some((p) => p.clientId === selfId)) {
            items.push({ clientId: selfId, nickname: String(nickname || '') });
        }
        participantsList = items;
        const countEl = document.getElementById('tacticsUsersCount');
        if (countEl) {
            countEl.textContent = '(' + participantsList.length + ')';
        }
        const settings = getDrawSettings();
        const editors = new Set(Array.isArray(settings.editors) ? settings.editors : []);
        const drawOpen = settings.draw_mode === 'open';

        el.innerHTML = participantsList.map((p) => {
            const cid = String(p.clientId || '');
            const isSelf = cid === selfId;
            const displayName = isSelf ? nickname : (p.nickname || cid || '?');
            const colors = window.TacticsCanvas?.CURSOR_COLORS || ['#b388ff'];
            let colorIdx = 0;
            for (let i = 0; i < cid.length; i += 1) {
                colorIdx = (colorIdx + cid.charCodeAt(i)) % colors.length;
            }
            const nickColor = colors[colorIdx] || '#b388ff';
            const name = '<span style="color:' + nickColor + '">' + escapeHtml(displayName) + '</span>';
            const self = isSelf ? ' tactics-participant-self' : '';
            const editingClass = isSelf && nicknameEditing ? ' tactics-participant--editing-nick' : '';
            let actionBtn = '';

            if (isSelf) {
                if (canEditNickname() && nicknameEditing) {
                    const editTitle = i18n().t('saveNickname');
                    actionBtn = '<button type="button" class="tactics-participant-nick-btn is-save"'
                        + ' title="' + escapeHtml(editTitle) + '" aria-label="' + escapeHtml(editTitle) + '">'
                        + '<i class="fas fa-check" aria-hidden="true"></i></button>';
                    return '<li class="tactics-participant' + self + editingClass + '">'
                        + '<input type="text" class="tactics-participant-name-input" maxlength="32"'
                        + ' value="' + escapeHtml(displayName) + '" autocomplete="nickname">'
                        + actionBtn
                        + '</li>';
                }

                if (canEditNickname()) {
                    const editTitle = i18n().t('editNickname');
                    actionBtn = '<button type="button" class="tactics-participant-nick-btn"'
                        + ' title="' + escapeHtml(editTitle) + '" aria-label="' + escapeHtml(editTitle) + '">'
                        + '<i class="fas fa-pen" aria-hidden="true"></i></button>';
                }
            } else if (canManage && cid && !drawOpen) {
                const isEditor = editors.has(cid);
                const activeClass = isEditor ? ' is-active' : '';
                const title = i18n().t(isEditor ? 'revokeDraw' : 'grantDraw');
                actionBtn = '<button type="button" class="tactics-participant-editor-btn'
                    + activeClass + '" data-client-id="' + escapeHtml(cid)
                    + '" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title)
                    + '"><i class="fas fa-crown" aria-hidden="true"></i></button>';
            }

            return '<li class="tactics-participant' + self + editingClass + '">'
                + '<span class="tactics-participant-name">' + name + '</span>'
                + actionBtn
                + '</li>';
        }).join('');

        el.querySelectorAll('.tactics-participant-nick-btn:not(.is-save)').forEach((btn) => {
            btn.addEventListener('click', () => startNicknameEdit());
        });
        el.querySelectorAll('.tactics-participant-nick-btn.is-save').forEach((btn) => {
            btn.addEventListener('click', () => saveNickname());
        });
        el.querySelectorAll('.tactics-participant-editor-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                toggleParticipantEditor(btn.getAttribute('data-client-id'));
            });
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function markDirty() {
        dirty = true;
        scheduleSave();
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveRoom, SAVE_MS);
    }

    async function saveRoom() {
        if (!dirty || !roomState || !accessToken) return;
        dirty = false;
        setSaveStatus('saving');

        const slide = slidesCtrl?.getActiveSlide();
        if (slide && canvasCtrl) {
            slidesCtrl.updateSlideCanvas(slide.id, canvasCtrl.getCanvasState());
        }

        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
            public_id: roomState.public_id,
            room_data: roomState.room_data,
            revision,
            access_token: accessToken,
        }, accessToken);

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }

        if (res.ok && res.data.success) {
            revision = res.data.data.revision || revision + 1;
            roomState.revision = revision;
            setSaveStatus(wsConnected ? 'connected' : 'saved');
            if (!wsConnected) {
                setTimeout(() => setSaveStatus(''), 2000);
            }
        } else {
            dirty = true;
            setSaveStatus('saveError');
            if (res.status === 403) {
                await resyncRoom(true);
                applyDrawPermissions();
            } else if (res.status === 409) {
                await resyncRoom(true);
            }
        }
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function stopPresencePolling() {
        if (presencePollTimer) {
            clearInterval(presencePollTimer);
            presencePollTimer = null;
        }
    }

    async function pollPresenceFallback() {
        if (!wsToken || !window.ABS_TACTICS_PRESENCE_API) return;

        const url = window.ABS_TACTICS_PRESENCE_API
            + '?token=' + encodeURIComponent(wsToken);
        const res = await store().getJson(url);
        if (!res.ok || !res.data?.success || !Array.isArray(res.data.participants)) {
            return;
        }

        applyPresenceList(res.data.participants, !wsConnected);
    }

    function applyPresenceList(list, applyCursors) {
        renderParticipants(list);
        canvasCtrl?.syncRemoteCursorsPresence(participantsList);
        if (!applyCursors || !canvasCtrl?.showRemoteCursors) return;

        list.forEach((p) => {
            const fromId = String(p.clientId || '');
            if (!fromId || fromId === String(clientId || '')) return;
            if (!p.cursor || !p.cursor.visible) {
                canvasCtrl.hideRemoteCursor(fromId);
                return;
            }
            canvasCtrl.applyRemoteCursor({
                from: fromId,
                slideId: p.cursor.slideId,
                x: p.cursor.x,
                y: p.cursor.y,
                visible: true,
                nickname: p.cursor.nickname || p.nickname || '',
            });
        });
    }

    async function postRealtimeEvent(eventType, slideId, payload) {
        if (!roomState || !wsToken || !window.ABS_TACTICS_EVENT_API) return;

        if (eventType === 'cursor') {
            if (!computeCanShareCursor()) return;
            const hideNow = !payload.visible;
            if (!hideNow) {
                const key = `${slideId}:${payload.x}:${payload.y}:${payload.visible}:${payload.nickname || ''}`;
                if (key === lastCursorPostKey) return;
                lastCursorPostKey = key;
            } else {
                lastCursorPostKey = '';
            }
        }

        await store().postJson(window.ABS_TACTICS_EVENT_API, {
            public_id: roomState.public_id,
            event_type: eventType,
            slide_id: slideId,
            payload,
            ws_token: wsToken,
        });
    }

    function applyRealtimePayload(realtime) {
        if (!realtime) return;

        if (Array.isArray(realtime.participants)) {
            applyPresenceList(realtime.participants, !wsConnected);
        }

        if (!Array.isArray(realtime.events)) return;

        realtime.events.forEach((ev) => {
            const fromId = String(ev.clientId || '');
            if (!fromId || fromId === String(clientId || '')) return;

            if (ev.eventType === 'ping') {
                canvasCtrl?.applyRemoteOp({
                    op: 'ping',
                    slideId: ev.slideId,
                    payload: ev.payload,
                });
            }

            const eventId = Number(ev.id) || 0;
            if (eventId > sinceEventId) {
                sinceEventId = eventId;
            }
        });
    }

    function buildSyncUrl() {
        let api = window.ABS_TACTICS_SYNC_API
            + '?public_id=' + encodeURIComponent(roomState.public_id)
            + '&since_revision=' + encodeURIComponent(String(revision))
            + '&since_event_id=' + encodeURIComponent(String(sinceEventId));
        if (clientId) {
            api += '&client_id=' + encodeURIComponent(clientId);
        }
        if (wsToken) {
            api += '&ws_token=' + encodeURIComponent(wsToken);
        }
        if (nickname) {
            api += '&nickname=' + encodeURIComponent(nickname);
        }
        return api;
    }

    function restartPresencePolling() {
        stopPresencePolling();
        pollPresenceFallback();
        presencePollTimer = setInterval(() => {
            if (wsConnected) {
                stopPresencePolling();
                return;
            }
            pollPresenceFallback();
        }, PRESENCE_POLL_MS);
    }

    function isRoomGoneResponse(res) {
        return !!(res && res.status === 404 && res.data?.success === false);
    }

    let roomGoneShown = false;

    async function confirmRoomDeleted() {
        const publicId = roomPublicId();
        if (!publicId) {
            return true;
        }

        const syncApi = window.ABS_TACTICS_SYNC_API;
        if (!syncApi) {
            return true;
        }

        const url = syncApi
            + '?public_id=' + encodeURIComponent(publicId)
            + '&since_revision=0';
        const res = await store().getJson(url);
        return isRoomGoneResponse(res);
    }

    function canDrawFromRoomData(roomData, owner) {
        if (owner) return true;
        const settings = roomData?.settings || {};
        if (settings.draw_mode === 'open') return true;
        const editors = Array.isArray(settings.editors) ? settings.editors : [];
        return editors.includes(clientId);
    }

    function hasEmbeddedRoom() {
        return !!window.ABS_TACTICS_INITIAL_ROOM;
    }

    function buildBootstrapPayload(stored) {
        const room = window.ABS_TACTICS_INITIAL_ROOM;
        if (!room) return null;

        const isOwner = stored?.is_owner === true;
        const roomData = room.room_data || {};

        return {
            room,
            access_token: stored?.access_token || '',
            ws_token: stored?.ws_token || '',
            ws_url: window.ABS_TACTICS_WS_URL || '',
            can_manage: isOwner,
            can_draw: canDrawFromRoomData(roomData, isOwner),
        };
    }

    function showRoomGoneOverlay() {
        if (roomGoneShown) {
            return;
        }
        roomGoneShown = true;

        stopPolling();
        stopPresencePolling();
        if (wsClient) {
            wsClient.disconnect();
            wsClient = null;
        }
        store().clearRoomSession(window.ABS_TACTICS_PUBLIC_ID);

        const goneEl = document.getElementById('tacticsRoomGone');
        const headerEl = document.getElementById('tacticsRoomHeader');
        const workspaceEl = document.getElementById('tacticsRoomWorkspace');
        const passwordEl = document.getElementById('tacticsPasswordGate');
        const layoutEl = document.querySelector('.tactics-room-layout');

        if (goneEl) {
            goneEl.hidden = false;
            document.body.classList.add('page-tactics-room-gone');
            if (headerEl) headerEl.hidden = true;
            if (workspaceEl) workspaceEl.hidden = true;
            if (passwordEl) passwordEl.hidden = true;
            if (layoutEl) layoutEl.classList.add('tactics-room-layout--gone');
            return;
        }

        const lobby = window.ABS_TACTICS_LOBBY_HREF || '/services/tactics';
        window.location.href = lobby;
    }

    async function redirectRoomNotFound() {
        if (roomGoneShown) {
            return;
        }

        if (hasEmbeddedRoom() || roomState) {
            const deleted = await confirmRoomDeleted();
            if (!deleted) {
                return;
            }
        }

        showRoomGoneOverlay();
    }

    function restartPolling() {
        stopPolling();
        pollTimer = setInterval(() => {
            resyncRoom(false);
        }, wsConnected ? POLL_WS_MS : POLL_RT_MS);
    }

    function startPollingFallback() {
        if (pollTimer) return;
        restartPolling();
    }

    async function resyncRoom(force) {
        if (!roomState) return;

        const res = await store().getJson(buildSyncUrl());
        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }
        if (!res.data?.success) return;

        if (res.data.realtime) {
            applyRealtimePayload(res.data.realtime);
        }

        if (!res.data.changed) return;

        const newData = res.data.data;
        const newRevision = newData.revision || revision;
        if (newRevision <= revision) return;

        if (newData.room_data?.settings) {
            applyRemoteGridSetting(newData.room_data.settings.show_grid);
        }

        if (dirty && !force) return;

        const activeId = slidesCtrl?.getActiveSlideId();
        const prevSlide = roomState.room_data?.slides?.find((s) => s.id === activeId);
        const nextSlide = newData.room_data?.slides?.find((s) => s.id === activeId);

        roomState.room_data = newData.room_data;
        roomState.revision = newRevision;
        if (newData.visibility) {
            roomState.visibility = newData.visibility;
            syncVisibilityUi(roomState.visibility);
        }
        revision = newRevision;
        slidesCtrl?.setRoomData(roomState.room_data);
        applyDrawPermissions();

        if (nextSlide && canvasCtrl && !dirty) {
            const prevJson = JSON.stringify(prevSlide?.canvas || null);
            const nextJson = JSON.stringify(nextSlide?.canvas || null);
            if (prevJson !== nextJson) {
                if (nextSlide.canvas) {
                    await canvasCtrl.applyCanvasState(nextSlide.canvas);
                } else {
                    await canvasCtrl.applyRemoteOp({ op: 'clear', slideId: activeId });
                }
            }
        }
    }

    function revealWorkspace() {
        document.getElementById('tacticsPasswordGate')?.setAttribute('hidden', '');
        document.getElementById('tacticsRoomHeader')?.removeAttribute('hidden');
        document.getElementById('tacticsRoomWorkspace')?.removeAttribute('hidden');
        document.querySelector('.tactics-room-layout')?.classList.remove('tactics-room-layout--locked');
        document.body.classList.remove('page-tactics-room-locked');
    }

    function buildMapUrls(roomData, serverUrls) {
        const urls = {
            ...(serverUrls || window.ABS_TACTICS_MAP_URLS || {}),
        };
        const publicId = roomPublicId();
        (roomData?.slides || []).forEach((slide) => {
            if (!slide?.id) return;
            if (!urls[slide.id]) {
                urls[slide.id] = maps().slideMapUrl(slide, publicId, urls);
            }
        });
        return urls;
    }

    function updateSettingsPanel() {
        const panel = document.getElementById('tacticsRoomSettings');
        if (panel) {
            panel.hidden = !canManage;
        }
    }

    function syncVisibilityUi(visibility) {
        const vis = visibility === 'closed' ? 'closed' : 'open';
        const switchRoot = document.getElementById('tacticsRoomVisibilitySwitch');
        const passwordWrap = document.getElementById('tacticsRoomPasswordSetting');
        const radio = switchRoot?.querySelector('input[name="room_visibility"][value="' + vis + '"]');
        if (radio) {
            radio.checked = true;
        }
        switchRoot?.querySelectorAll('.bracket-visibility-switch__option').forEach((label) => {
            const input = label.querySelector('input[type="radio"]');
            label.classList.toggle('is-active', !!input?.checked);
        });
        if (passwordWrap) {
            passwordWrap.hidden = vis !== 'closed';
        }
    }

    function bindRoomSettings() {
        const switchRoot = document.getElementById('tacticsRoomVisibilitySwitch');
        if (!switchRoot || switchRoot.dataset.bound) return;
        switchRoot.dataset.bound = '1';

        const passwordInput = document.getElementById('tacticsRoomSettingPassword');
        const options = switchRoot.querySelectorAll('.bracket-visibility-switch__option input[type="radio"]');

        function onVisibilityChange() {
            const vis = switchRoot.querySelector('input[name="room_visibility"]:checked')?.value || 'open';
            const passwordWrap = document.getElementById('tacticsRoomPasswordSetting');
            if (passwordWrap) {
                passwordWrap.hidden = vis !== 'closed';
            }
            switchRoot.querySelectorAll('.bracket-visibility-switch__option').forEach((label) => {
                const radio = label.querySelector('input[type="radio"]');
                label.classList.toggle('is-active', !!radio?.checked);
            });
            scheduleSettingsSave();
        }

        options.forEach((radio) => {
            radio.addEventListener('change', onVisibilityChange);
        });

        passwordInput?.addEventListener('input', () => scheduleSettingsSave());
    }

    function bindDeleteRoomBtn() {
        const btn = document.getElementById('tacticsDeleteRoomBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => deleteRoom());
    }

    async function deleteRoom() {
        if (!canManage || !roomState || !accessToken) return;
        if (!window.confirm(i18n().t('deleteRoomConfirm'))) return;

        stopPolling();
        dirty = false;
        clearTimeout(saveTimer);
        saveTimer = null;

        const res = await store().postJson(window.ABS_TACTICS_DELETE_API, {
            public_id: roomState.public_id,
            access_token: accessToken,
        }, accessToken);

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }

        if (res.ok && res.data.success) {
            store().clearRoomSession(roomState.public_id);
            window.location.href = window.ABS_TACTICS_LOBBY_HREF || '/services/tactics';
            return;
        }

        window.alert(i18n().t('deleteRoomError'));
        startPollingFallback();
    }

    function scheduleSettingsSave() {
        if (!canManage) return;
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(saveRoomSettings, 800);
    }

    async function saveRoomSettings() {
        if (!canManage || !roomState || !accessToken || settingsSaving) return;

        const visibility = document.querySelector('input[name="room_visibility"]:checked')?.value || 'open';
        const password = document.getElementById('tacticsRoomSettingPassword')?.value || '';
        const prevVisibility = roomState.visibility || 'open';
        if (visibility === prevVisibility && !password) {
            return;
        }

        settingsSaving = true;
        setSaveStatus('saving');

        const slide = slidesCtrl?.getActiveSlide();
        if (slide && canvasCtrl) {
            slidesCtrl.updateSlideCanvas(slide.id, canvasCtrl.getCanvasState());
        }

        const body = {
            public_id: roomState.public_id,
            room_data: roomState.room_data,
            revision,
            visibility,
            access_token: accessToken,
        };
        if (password) {
            body.password = password;
        }

        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, body, accessToken);
        settingsSaving = false;

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }

        if (res.ok && res.data.success) {
            revision = res.data.data.revision || revision + 1;
            roomState.revision = revision;
            roomState.visibility = res.data.data.visibility || visibility;
            syncVisibilityUi(roomState.visibility);
            const passwordInput = document.getElementById('tacticsRoomSettingPassword');
            if (passwordInput) passwordInput.value = '';
            setSaveStatus('settingsSaved');
            setTimeout(() => setSaveStatus(wsConnected ? 'connected' : ''), 2000);
        } else {
            syncVisibilityUi(prevVisibility);
            setSaveStatus('settingsError');
            if (res.status === 409) {
                await resyncRoom(true);
            }
        }
    }

    async function refreshSession(password) {
        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);

        const body = {
            public_id: window.ABS_TACTICS_PUBLIC_ID,
            nickname,
            client_id: clientId,
        };
        if (password) body.password = password;
        if (stored?.access_token) body.access_token = stored.access_token;

        const res = await store().postJson(window.ABS_TACTICS_JOIN_API, body, stored?.access_token || null);
        if (isRoomGoneResponse(res)) {
            const fallback = buildBootstrapPayload(stored);
            if (fallback) return fallback;
            redirectRoomNotFound();
            return null;
        }
        if (!res.ok || !res.data.success) {
            const fallback = buildBootstrapPayload(stored);
            if (fallback) return fallback;
            return null;
        }

        const payload = res.data.data;
        accessToken = payload.access_token;
        wsToken = payload.ws_token;
        wsUrl = payload.ws_url;
        canManage = !!payload.can_manage;
        if (payload.room) {
            roomState = payload.room;
            revision = roomState.revision || revision;
        }
        canDraw = payload.can_draw !== undefined ? !!payload.can_draw : computeCanDraw();

        store().saveRoomSession(roomState?.public_id || window.ABS_TACTICS_PUBLIC_ID, {
            access_token: accessToken,
            ws_token: wsToken,
            nickname,
            client_id: clientId,
            is_owner: canManage,
        });

        return payload;
    }

    async function applySession(payload) {
        accessToken = payload.access_token;
        wsToken = payload.ws_token;
        wsUrl = payload.ws_url;
        roomState = payload.room || roomState;
        revision = roomState.revision || 1;
        canManage = !!payload.can_manage;
        canDraw = payload.can_draw !== undefined ? !!payload.can_draw : computeCanDraw();
        window.ABS_TACTICS_MAP_URLS = buildMapUrls(
            roomState.room_data,
            payload.room?.map_urls || payload.map_urls,
        );
        maps().preloadMapUrls(Object.values(window.ABS_TACTICS_MAP_URLS));
        revealWorkspace();
        updateSettingsPanel();
        syncVisibilityUi(roomState.visibility);
        store().saveRoomSession(roomState?.public_id || window.ABS_TACTICS_PUBLIC_ID, {
            access_token: accessToken,
            ws_token: wsToken,
            nickname,
            client_id: clientId,
            is_owner: canManage,
        });
        await initWorkspace();
        applyDrawPermissions();
    }

    async function refreshWsSession() {
        if (wsAuthRefreshing) return null;
        wsAuthRefreshing = true;
        try {
            const payload = await refreshSession('');
            if (!payload) return null;

            wsToken = payload.ws_token;
            wsUrl = payload.ws_url;
            if (wsClient) {
                wsClient.reconnectWithToken(wsToken);
            } else {
                connectWebSocket();
            }
            return payload;
        } finally {
            wsAuthRefreshing = false;
        }
    }

    function connectWebSocket() {
        if (!wsToken || !window.TacticsWsClient) {
            wsConnected = false;
            setSaveStatus('offline');
            startPollingFallback();
            restartPresencePolling();
            return;
        }

        if (wsClient) {
            wsClient.disconnect();
        }

        wsClient = new window.TacticsWsClient({
            publicId: roomState.public_id,
            wsToken,
            clientId,
            nickname,
            wsUrl,
            onPresence: (list) => {
                renderParticipants(list);
                canvasCtrl?.syncRemoteCursorsPresence(participantsList);
            },
            onCursor: (msg) => {
                const fromId = String(msg.from || '');
                const participant = participantsList.find((p) => p.clientId === fromId);
                canvasCtrl?.applyRemoteCursor({
                    ...msg,
                    nickname: msg.nickname || participant?.nickname || '',
                });
            },
            onConnection: (state) => {
                if (state === 'connected') {
                    wsConnected = true;
                    stopPresencePolling();
                    wsClient?.updateNickname(nickname);
                    restartPolling();
                    setSaveStatus('connected');
                } else if (state === 'auth_failed') {
                    wsConnected = false;
                    refreshWsSession();
                } else {
                    wsConnected = false;
                    restartPolling();
                    restartPresencePolling();
                    if (state === 'offline') {
                        setSaveStatus('offline');
                    } else {
                        setSaveStatus('reconnecting');
                    }
                }
            },
            onOp: async (msg) => {
                if (msg.type === 'slide') {
                    slidesCtrl.applyRemote(msg.action, msg);
                    return;
                }
                await canvasCtrl.applyRemoteOp(msg);
            },
            onSettings: (msg) => {
                applyRemoteDrawSettings(msg.settings);
            },
            onChat: (msg) => {
                chatCtrl?.applyRemote(msg);
            },
        });
        wsClient.connect();
    }

    async function initWorkspace() {
        const mapUrls = window.ABS_TACTICS_MAP_URLS || {};
        maps().preloadMapUrls(Object.values(mapUrls));
        const mapsLoadPromise = maps().loadMaps();

        addMapPicker = null;
        const roomGame = getRoomGame();
        if (window.TacticsMapPicker) {
            addMapPicker = new window.TacticsMapPicker({
                root: document.getElementById('tacticsAddMapPicker'),
                selectEl: document.getElementById('tacticsAddSlideMap'),
                lockGame: roomGame,
            });
        }

        slidesCtrl = new window.TacticsSlides({
            roomData: roomState.room_data,
            mapUrls,
            publicId: roomPublicId(),
            listEl: document.getElementById('tacticsSlidesList'),
            addBtn: document.getElementById('tacticsAddSlideBtn'),
            addSelect: document.getElementById('tacticsAddSlideMap'),
            mapPicker: addMapPicker,
            lang: i18n().getLang(),
            roomGame,
            canManage,
            canAddSlides: canManage || canDraw,
            onSwitch: async (slideId, prevSlideId) => {
                if (prevSlideId && canvasCtrl) {
                    slidesCtrl.updateSlideCanvas(prevSlideId, canvasCtrl.getCanvasState());
                }
                const slide = slidesCtrl.getActiveSlide();
                if (slide) {
                    syncCustomMapUploadUi(slide);
                    syncDotaPickUi(slide);
                    await canvasCtrl.loadSlide(slide, mapUrlForSlide(slide));
                    await applyGameNicknameForSlide(slide);
                }
            },
            onChange: () => markDirty(),
            onBroadcast: (data) => {
                wsClient?.sendSlide(data.action, data);
            },
            onDelete: () => markDirty(),
        });

        const showGrid = roomState.room_data?.settings?.show_grid !== false;

        canvasCtrl = new window.TacticsCanvas({
            canvasEl: document.getElementById('tacticsCanvas'),
            toolbar: document.getElementById('tacticsToolbar'),
            strokeColorEl: document.getElementById('tacticsStrokeColor'),
            strokeWidthEl: document.getElementById('tacticsStrokeWidth'),
            drawEnabled: canDraw,
            showGrid,
            clientId,
            onGridChange: (visible) => {
                if (!canDraw) return;
                pushGridChange(visible);
            },
            onChange: () => {
                if (canDraw) markDirty();
            },
            onOp: (msg) => {
                if (msg.op === 'ping') {
                    if (wsClient?.sendOp(msg.slideId, msg.op, msg.payload)) {
                        return;
                    }
                    postRealtimeEvent('ping', msg.slideId, msg.payload);
                    return;
                }
                const strokeOps = ['stroke_start', 'stroke_point', 'stroke_end'];
                if (strokeOps.includes(msg.op)) {
                    wsClient?.sendOp(msg.slideId, msg.op, msg.payload);
                    return;
                }
                if (wsClient?.sendOp(msg.slideId, msg.op, msg.payload)) {
                    return;
                }
                scheduleSave();
            },
            onCursorMove: (payload) => {
                if (!payload?.slideId) return;
                const visible = !!payload.visible && computeCanShareCursor();
                const out = {
                    x: visible ? payload.x : 0,
                    y: visible ? payload.y : 0,
                    visible,
                    nickname: payload.nickname || nickname,
                };
                if (wsClient?.sendCursor(
                    payload.slideId,
                    out.x,
                    out.y,
                    out.visible,
                    out.nickname,
                )) {
                    return;
                }
                postRealtimeEvent('cursor', payload.slideId, out);
            },
            getNickname: () => nickname,
        });

        await mapsLoadPromise;

        const slide = slidesCtrl.getActiveSlide();
        syncCustomMapUploadUi(slide);
        syncDotaPickUi(slide);
        if (slide) {
            await canvasCtrl.loadSlide(slide, mapUrlForSlide(slide));
        }

        if (window.TacticsChat) {
            chatCtrl = new window.TacticsChat({
                publicId: roomPublicId(),
                clientId,
                getNickname: () => nickname,
                getWsToken: () => wsToken,
                onSendWs: (message) => wsClient?.sendChat(message),
            });
        }

        bindRoomSettings();
        bindDeleteRoomBtn();
        bindCustomMapUpload();
        bindDotaPickBtn();
        bindDrawLockBtn();
        bindCursorsLockBtn();
        bindEditorChrome();
        updateSettingsPanel();
        syncVisibilityUi(roomState?.visibility);
        renderParticipants([{ clientId: String(clientId || ''), nickname: String(nickname || '') }]);

        connectWebSocket();
        startPollingFallback();
        restartPresencePolling();
    }

    async function handlePasswordJoin(ev) {
        ev.preventDefault();
        showJoinError('');
        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
        nickname = window.ABS_TACTICS_DEFAULT_NICK || 'Guest';
        if (stored?.nickname) {
            if (window.ABS_TACTICS_IS_LOGGED_IN && isGuestNickname(stored.nickname)) {
                nickname = window.ABS_TACTICS_DEFAULT_NICK || nickname;
            } else {
                nickname = stored.nickname;
            }
        }
        const password = document.getElementById('tacticsRoomPassword')?.value || '';

        const payload = await refreshSession(password);
        if (!payload) {
            showJoinError(i18n().t('joinError'));
            return;
        }

        await applySession(payload);
    }

    async function init() {
        clientId = store().getClientId();
        nickname = window.ABS_TACTICS_DEFAULT_NICK || 'Guest';
        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
        if (stored?.nickname) {
            if (window.ABS_TACTICS_IS_LOGGED_IN && isGuestNickname(stored.nickname)) {
                nickname = window.ABS_TACTICS_DEFAULT_NICK || nickname;
            } else {
                nickname = stored.nickname;
            }
        }

        document.getElementById('tacticsRoomJoinForm')?.addEventListener('submit', handlePasswordJoin);

        if (window.ABS_TACTICS_NEEDS_PASSWORD) {
            return;
        }

        if (window.ABS_TACTICS_INITIAL_ROOM) {
            roomState = window.ABS_TACTICS_INITIAL_ROOM;
            revision = roomState.revision || 1;
            window.ABS_TACTICS_MAP_URLS = window.ABS_TACTICS_MAP_URLS || buildMapUrls(roomState.room_data);
        }

        if (window.ABS_TACTICS_MAP_URLS) {
            maps().preloadMapUrls(Object.values(window.ABS_TACTICS_MAP_URLS));
        }

        let payload = await refreshSession('');
        if (!payload && hasEmbeddedRoom()) {
            payload = buildBootstrapPayload(store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID));
        }
        if (payload) {
            await applySession(payload);
        }

        window.addEventListener('tactics:catalog-updated', () => {
            addMapPicker?.relocalize();
            const activeSlide = slidesCtrl?.getActiveSlide();
            if (activeSlide && canvasCtrl) {
                canvasCtrl.refreshMapScaleInfo(activeSlide);
            }
        });
    }

    async function relocalizeView() {
        if (nicknameEditing) return;

        i18n().relocalizeDom(document.getElementById('tacticsPasswordGate') || document);
        i18n().relocalizeDom(document.querySelector('.tactics-room-workspace') || document);
        i18n().relocalizeDom(document.querySelector('.tactics-room-gone') || document);
        slidesCtrl?.setLang(i18n().getLang());
        slidesCtrl?.relocalizeNames();
        if (addMapPicker) {
            await addMapPicker.relocalize();
        }
        updateDrawLockBtn();
        canvasCtrl?.updateGridToggleBtn();
        canvasCtrl?.updateRemoteCursorsBtn();
        canvasCtrl?.updateShareCursorBtn();
        canvasCtrl?.updateMapScaleInfo();
        updateCursorsLockBtn();
        renderParticipants(participantsList);
    }

    window.AbsTacticsRoom = { relocalizeView };

    window.addEventListener('beforeunload', () => {
        if (dirty) saveRoom();
        stopPresencePolling();
        wsClient?.disconnect();
    });

    function waitForFabric(cb) {
        if (window.fabric) {
            cb();
            return;
        }
        const iv = setInterval(() => {
            if (window.fabric) {
                clearInterval(iv);
                cb();
            }
        }, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindCopyLinkBtn();
            waitForFabric(init);
        });
    } else {
        bindCopyLinkBtn();
        waitForFabric(init);
    }
})();
