(() => {
    'use strict';

    const store = () => window.AbsTacticsStore;
    const i18n = () => window.AbsTacticsI18n;
    const maps = () => window.AbsTacticsMaps;

    const POLL_MS = 750;
    const POLL_RT_MS = 200;
    const POLL_WS_MS = 2000;
    const PRESENCE_POLL_MS = 2500;
    const NICK_COLOR_POLL_MS = 3000;
    const SAVE_MS = 1000;
    const SAVE_MODIFY_MS = 300;
    const PASSWORD_MASK = '••••••••';

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
    let nickColorPollTimer = null;
    let wsClient = null;
    let chatCtrl = null;
    let slidesCtrl = null;
    let addMapPicker = null;
    let canvasCtrl = null;
    let workspaceInitPromise = null;
    let editorAssetsPromise = null;
    let lastJoinError = '';
    let dirty = false;
    let wsConnected = false;
    let canManage = false;
    let canDraw = false;
    let participantsList = [];
    let lastPresenceClientIds = new Set();
    let settingsTimer = null;
    let settingsSaving = false;
    let nicknameLockedByUser = false;
    let nicknameLockedBeforeEdit = false;
    let nicknameEditing = false;
    let nicknameColor = '';
    let nicknameColorPickerOpen = false;
    let nickColorPickerDocBound = false;
    const NICK_COLOR_STORAGE_KEY = 'abs_tactics_nick_color';
    let wsAuthRefreshing = false;
    let wsAuthFailures = 0;
    const WS_AUTH_MAX_RETRIES = 3;
    let sinceEventId = 0;
    let lastCursorPostKey = '';
    let pendingSessionPromise = null;
    let saveInFlight = false;
    let drawSettingsSaveInFlight = false;
    let presentationToggleInFlight = false;
    const PRESENTATION_INACTIVITY_MS = 60000;
    const PRESENTATION_INACTIVITY_SHOW_IDLE_MS = 12000;
    let presentationInactivityTimer = null;
    let presentationCountdownInterval = null;
    let presentationLastActivityAt = 0;
    let presentationStopInactivityInFlight = false;
    let serverPresentationSnapshot = { mode: false, hostId: '', hostNickname: '' };
    let save403Attempts = 0;
    const SAVE_403_MAX_ATTEMPTS = 2;

    function isGuestNickname(nick) {
        return /^(?:Guest|Гость)(?:\s+\d+)?$/u.test(String(nick || '').trim());
    }

    function roomPublicId() {
        return String(roomState?.public_id || window.ABS_TACTICS_PUBLIC_ID || '');
    }

    function nickColorStorageKey() {
        return NICK_COLOR_STORAGE_KEY + '_' + String(clientId || '');
    }

    function normalizeNickColor(color) {
        const raw = String(color || '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return '';
        return raw.toLowerCase();
    }

    function loadNicknameColor() {
        try {
            const raw = localStorage.getItem(nickColorStorageKey());
            return normalizeNickColor(raw);
        } catch (e) {
            return '';
        }
    }

    function saveNicknameColorLocal(color) {
        const normalized = normalizeNickColor(color);
        if (!normalized) return;
        try {
            localStorage.setItem(nickColorStorageKey(), normalized);
        } catch (e) {  }
    }

    function defaultNickColorForClient(cid) {
        const colors = window.TacticsCanvas?.CURSOR_COLORS || ['#b388ff'];
        let colorIdx = 0;
        const id = String(cid || '');
        for (let i = 0; i < id.length; i += 1) {
            colorIdx = (colorIdx + id.charCodeAt(i)) % colors.length;
        }
        return colors[colorIdx] || '#b388ff';
    }

    function resolveParticipantNickColor(participant, cid) {
        const custom = normalizeNickColor(participant?.nickColor || participant?.nick_color || '');
        if (custom) return custom;
        if (String(cid) === String(clientId || '') && nicknameColor) {
            return nicknameColor;
        }
        return defaultNickColorForClient(cid);
    }

    function saveRoomSessionSnapshot() {
        store().saveRoomSession(roomPublicId(), {
            access_token: accessToken,
            ws_token: wsToken,
            nickname,
            nick_color: nicknameColor,
            nickname_locked: nicknameLockedByUser,
            client_id: clientId,
        });
    }

    function mergeParticipantsWithLocalSelf(list) {
        const selfId = String(clientId || '');
        const prevColorByClient = new Map();
        participantsList.forEach((p) => {
            const color = normalizeNickColor(p.nickColor);
            if (color) {
                prevColorByClient.set(String(p.clientId || ''), color);
            }
        });
        let items = normalizeParticipants(list);
        items = items.map((p) => {
            const incomingColor = normalizeNickColor(p.nickColor);
            if (incomingColor) {
                return p;
            }
            const preserved = prevColorByClient.get(p.clientId);
            if (preserved) {
                return { ...p, nickColor: preserved };
            }
            return p;
        });
        if (!selfId) return items;
        items = items.map((p) => (
            p.clientId === selfId
                ? {
                    ...p,
                    nickname: String(nickname || ''),
                    nickColor: nicknameColor || p.nickColor || '',
                }
                : p
        ));
        if (!items.some((p) => p.clientId === selfId)) {
            items.push({
                clientId: selfId,
                nickname: String(nickname || ''),
                nickColor: nicknameColor || '',
            });
        }
        return items;
    }

    const DEFAULT_SLIDE_VIEW_PREFS = {
        show_remote_cursors: true,
        share_my_cursor: true,
    };

    function slideViewStorageKey(slideId) {
        return `abs_tactics_map_view_${roomPublicId()}_${slideId}`;
    }

    function loadSlideCursorPrefs(slideId) {
        try {
            const raw = localStorage.getItem(slideViewStorageKey(slideId));
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    show_remote_cursors: parsed.show_remote_cursors !== false,
                    share_my_cursor: parsed.share_my_cursor !== false,
                };
            }
        } catch (e) {  }
        return { ...DEFAULT_SLIDE_VIEW_PREFS };
    }

    function saveSlideCursorPrefs(slideId) {
        if (!slideId || !canvasCtrl) return;
        try {
            localStorage.setItem(slideViewStorageKey(slideId), JSON.stringify({
                show_remote_cursors: !!canvasCtrl.showRemoteCursors,
                share_my_cursor: !!canvasCtrl.shareMyCursor,
            }));
        } catch (e) {  }
    }

    function ensureSlideView(slide) {
        if (!slide) return;
        if (!slide.view || typeof slide.view !== 'object') {
            slide.view = {};
        }
        if (typeof slide.view.show_grid !== 'boolean') {
            slide.view.show_grid = getDrawSettings().show_grid !== false;
        }
    }

    function getSlideShowGrid(slide) {
        ensureSlideView(slide);
        return slide.view.show_grid !== false;
    }

    function setSlideShowGrid(slide, visible) {
        if (!slide) return;
        ensureSlideView(slide);
        slide.view.show_grid = !!visible;
    }

    function applySlideViewPrefs(slide) {
        if (!slide || !canvasCtrl) return;
        ensureSlideView(slide);
        const cursorPrefs = loadSlideCursorPrefs(slide.id);
        canvasCtrl.setShowRemoteCursors(cursorPrefs.show_remote_cursors);
        if (computeCanShareCursor()) {
            canvasCtrl.setShareMyCursor(cursorPrefs.share_my_cursor);
        }
        canvasCtrl.setShowGrid(getSlideShowGrid(slide));
    }

    const CUSTOM_MAP_CODES = {
        cs2: 'cs2_custom',
        dota2: 'dota2_custom',
    };

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

    let customMapModalSlideId = null;
    let customUploadBusy = false;
    let pendingCustomMapFile = null;
    let pendingCustomMapPreviewUrl = null;
    let pendingCustomMapSlideId = null;

    function clearPendingCustomMap() {
        if (pendingCustomMapPreviewUrl) {
            URL.revokeObjectURL(pendingCustomMapPreviewUrl);
        }
        pendingCustomMapFile = null;
        pendingCustomMapPreviewUrl = null;
        pendingCustomMapSlideId = null;
        addMapPicker?.clearCustomPreviewOverride?.();
    }

    function canStageCustomMapFile() {
        return !!customMapModalSlideId && (canManage || canDraw);
    }

    function getCustomUploadSlide() {
        if (customMapModalSlideId && slidesCtrl) {
            return slidesCtrl.getSlides().find((s) => s.id === customMapModalSlideId) || null;
        }
        return slidesCtrl?.getActiveSlide() || null;
    }

    function syncMapModalCustomUploadUi() {
        const customPanel = document.getElementById('tacticsCustomMapPanel');
        const uploadBtn = document.getElementById('tacticsCustomMapUpload');
        const modal = document.getElementById('tacticsMapPickerModal');
        if (!uploadBtn && !customPanel) return;

        const modalOpen = !!(modal && !modal.hidden);
        const mode = modal?.querySelector('[data-tactics-map-modal-mode]')?.value || '';
        const pick = addMapPicker?.getValue?.() || {};
        const game = String(pick.game || getRoomGame() || '').toLowerCase();
        const supportsCustom = game === 'cs2' || game === 'dota2';
        const showCustomPanel = modalOpen
            && mode === 'custom'
            && supportsCustom;
        const showUpload = showCustomPanel
            && !!customMapModalSlideId
            && (canManage || canDraw);

        if (modalOpen && mode !== 'custom') {
            clearPendingCustomMap();
        }

        if (customPanel) {
            customPanel.hidden = !showCustomPanel;
        }
        if (modal) {
            modal.classList.toggle('is-custom-map-mode', showCustomPanel);
        }
        if (uploadBtn) {
            uploadBtn.hidden = !showUpload;
            uploadBtn.disabled = customUploadBusy || !showUpload;
            uploadBtn.classList.toggle('is-busy', customUploadBusy);
        }
        addMapPicker?.updateCustomPanelVisibility?.();
    }

    async function validateCustomMapFileSize(file) {
        const maxBytes = window.ABS_TACTICS_MAP_UPLOAD_MAX_BYTES || 16 * 1024 * 1024;
        if (file.size <= maxBytes) return true;
        const maxMb = Math.round(maxBytes / (1024 * 1024));
        const lang = window.ABS_TACTICS_LANG || 'ru';
        await tacticsAlert(
            lang === 'en'
                ? `File too large (max ${maxMb} MB)`
                : `Файл слишком большой (макс. ${maxMb} МБ)`,
        );
        return false;
    }

    async function stageCustomMapFile(file) {
        const slide = getCustomUploadSlide();
        if (!file || customUploadBusy || !slide || !canStageCustomMapFile()) return;

        const pick = addMapPicker?.getValue?.();
        if (pick?.battle_mode !== 'custom') return;

        if (!(await validateCustomMapFileSize(file))) return;

        clearPendingCustomMap();
        pendingCustomMapFile = file;
        pendingCustomMapSlideId = slide.id;
        pendingCustomMapPreviewUrl = URL.createObjectURL(file);
        addMapPicker?.setCustomPreviewUrl?.(pendingCustomMapPreviewUrl);
    }

    function applySlideMapMetaForUpload(slide, pick) {
        if (!slide || !pick?.map_code) return;
        let game = pick.game || slide.game || 'wot';
        const roomGame = getRoomGame();
        if (roomGame) {
            game = roomGame;
        }
        slide.map_code = pick.map_code;
        slide.game = game;
        slide.battle_mode = pick.battle_mode || slide.battle_mode || 'random';
        if (pick.map_width_m && pick.map_height_m) {
            slide.map_width_m = parseInt(pick.map_width_m, 10) || maps().defaultCustomMapScaleHu(slide.game);
            slide.map_height_m = parseInt(pick.map_height_m, 10) || maps().defaultCustomMapScaleHu(slide.game);
        }
        maps().normalizeCustomRoomSlide?.(slide);
    }

    async function uploadCustomMapToServer(slide, file, opts = {}) {
        if (!file || !slide || !canUploadCustomMap(slide)) return false;

        const apiUrl = window.ABS_TACTICS_UPLOAD_CUSTOM_MAP_API;
        if (!apiUrl) return false;

        if (!accessToken) {
            const payload = await refreshSession('');
            if (payload?.access_token) {
                accessToken = payload.access_token;
            }
        }

        customUploadBusy = true;
        syncMapModalCustomUploadUi();

        const formData = new FormData();
        formData.append('public_id', roomPublicId());
        formData.append('slide_id', slide.id);
        formData.append('game', slide.game || '');
        formData.append('battle_mode', slide.battle_mode || '');
        formData.append('map_code', slide.map_code || '');
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
        syncMapModalCustomUploadUi();

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return false;
        }

        if (res.ok && res.data?.success && res.data?.data?.url) {
            const url = res.data.data.url;
            if (slidesCtrl) {
                slidesCtrl.mapUrls[slide.id] = url;
                if (!opts.skipSlideRender) {
                    slidesCtrl.render();
                }
            }
            if (!window.ABS_TACTICS_MAP_URLS) {
                window.ABS_TACTICS_MAP_URLS = {};
            }
            window.ABS_TACTICS_MAP_URLS[slide.id] = url;
            if (!opts.skipCanvasLoad && canvasCtrl && slidesCtrl?.getActiveSlideId() === slide.id) {
                await canvasCtrl.loadSlide(slide, url);
            }
            if (!opts.skipMarkDirty) {
                markDirty();
            }
            return true;
        }

        const message = res.data?.error || i18n().t('uploadCustomMapError');
        await tacticsAlert(message);
        return false;
    }

    async function commitPendingCustomMap(slideId, pick) {
        if (!pendingCustomMapFile || pendingCustomMapSlideId !== slideId) {
            return { ok: true, url: null };
        }

        const slide = slidesCtrl?.getSlides().find((s) => s.id === slideId);
        const file = pendingCustomMapFile;
        clearPendingCustomMap();

        if (!slide) {
            return { ok: true, url: null };
        }

        if (pick) {
            applySlideMapMetaForUpload(slide, pick);
        }

        if (!canUploadCustomMap(slide)) {
            return { ok: false, url: null };
        }

        addMapPicker?.setModalBusy?.(true, i18n().t('changeMapUploading'));
        const ok = await uploadCustomMapToServer(slide, file, {
            skipCanvasLoad: true,
            skipSlideRender: true,
            skipMarkDirty: true,
        });
        if (!ok) {
            return { ok: false, url: null };
        }

        return {
            ok: true,
            url: slidesCtrl?.mapUrls?.[slideId] || window.ABS_TACTICS_MAP_URLS?.[slideId] || null,
        };
    }

    function syncCustomMapModalPreview(slideId) {
        customMapModalSlideId = slideId || null;
        syncMapModalCustomUploadUi();

        const slide = slidesCtrl?.getSlides().find((s) => s.id === slideId);
        if (!slide || !isCustomRoomSlide(slide)) {
            addMapPicker?.clearCustomPreviewOverride?.();
            return;
        }

        const url = slidesCtrl?.mapUrls?.[slide.id]
            || window.ABS_TACTICS_MAP_URLS?.[slide.id]
            || mapUrlForSlide(slide);
        const placeholder = maps().placeholderUrl();
        if (url && url !== placeholder) {
            addMapPicker?.setCustomPreviewUrl?.(url);
        } else {
            addMapPicker?.clearCustomPreviewOverride?.();
        }
    }

    async function duplicateCustomMapFile(sourceSlideId, targetSlideId) {
        const apiUrl = window.ABS_TACTICS_DUPLICATE_CUSTOM_MAP_API;
        if (!apiUrl || !sourceSlideId || !targetSlideId) return;

        if (!accessToken) {
            const payload = await refreshSession('');
            if (payload?.access_token) {
                accessToken = payload.access_token;
            }
        }

        const formData = new FormData();
        formData.append('public_id', roomPublicId());
        formData.append('source_slide_id', sourceSlideId);
        formData.append('target_slide_id', targetSlideId);
        formData.append('access_token', accessToken || '');
        formData.append('csrf_token', window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '');

        let res = await store().postFormData(apiUrl, formData, accessToken);

        if (!res.ok && res.status === 403) {
            const payload = await refreshSession('');
            if (payload?.access_token) {
                accessToken = payload.access_token;
                formData.set('access_token', accessToken);
                res = await store().postFormData(apiUrl, formData, accessToken);
            }
        }

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return;
        }

        if (res.ok && res.data?.success && res.data?.data?.url) {
            const url = res.data.data.url;
            if (slidesCtrl) {
                slidesCtrl.mapUrls[targetSlideId] = url;
                slidesCtrl.render();
            }
            if (!window.ABS_TACTICS_MAP_URLS) {
                window.ABS_TACTICS_MAP_URLS = {};
            }
            window.ABS_TACTICS_MAP_URLS[targetSlideId] = url;
            if (canvasCtrl && slidesCtrl?.getActiveSlideId() === targetSlideId) {
                const slide = slidesCtrl.getSlides().find((s) => s.id === targetSlideId);
                if (slide) {
                    await canvasCtrl.loadSlide(slide, url);
                }
            }
            return;
        }

        const message = res.data?.error || i18n().t('uploadCustomMapError');
        await tacticsAlert(message);
    }

    function tacticsConfirm(message) {
        if (window.AbsTacticsConfirm?.confirm) {
            return window.AbsTacticsConfirm.confirm(message);
        }
        return Promise.resolve(window.confirm(message));
    }

    async function tacticsAlert(message) {
        if (window.AbsTacticsConfirm?.alert) {
            await window.AbsTacticsConfirm.alert(message);
            return;
        }
        window.alert(message);
    }

    function bindCustomMapUpload() {
        const input = document.getElementById('tacticsCustomMapFile');
        const btn = document.getElementById('tacticsCustomMapUpload');
        if (!input || input.dataset.bound) return;
        input.dataset.bound = '1';

        btn?.addEventListener('click', () => {
            if (customUploadBusy) return;
            const modal = document.getElementById('tacticsMapPickerModal');
            if (!modal || modal.hidden) return;
            if (!customMapModalSlideId) return;
            input.click();
        });

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            await stageCustomMapFile(file);
        });
    }

    function gameNickForSlide(slide) {
        if (!slide || !window.ABS_TACTICS_GAME_NICKS) return '';
        const game = slide.game || 'wot';
        return String(window.ABS_TACTICS_GAME_NICKS[game] || '').trim();
    }

    function setSaveStatus() {

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

    function resetCopyBtnSizeLock(btn) {
        if (!btn) return;
        delete btn.dataset.copySizeLocked;
        btn.style.minWidth = '';
    }

    function ensureCopyBtnSizeLocked(btn) {
        if (!btn || btn.dataset.copySizeLocked) return;

        const btnWidth = btn.getBoundingClientRect().width;
        if (btnWidth > 0) {
            btn.style.minWidth = Math.ceil(btnWidth) + 'px';
        }
        btn.dataset.copySizeLocked = '1';
    }

    function restoreCopyBtnDefault() {
        const btn = document.getElementById('tacticsCopyLinkBtn');
        if (!btn) return;

        const textWrap = btn.querySelector('.tactics-room-code-btn__text');
        const icon = btn.querySelector('.tactics-room-code-btn__icon');
        if (!textWrap) return;

        const publicId = window.ABS_TACTICS_PUBLIC_ID || '';
        textWrap.innerHTML = '<span class="tactics-room-code-btn__label">'
            + '<span data-tactics-i18n="roomCode">' + escapeHtml(i18n().t('roomCode')) + '</span>:'
            + '</span>'
            + '<span class="tactics-room-code-btn__value">' + escapeHtml(publicId) + '</span>';
        if (icon) {
            icon.className = 'fas fa-link tactics-room-code-btn__icon';
        }
        btn.classList.remove('is-copied', 'is-copy-error');
    }

    function relocalizeCopyLinkBtn() {
        const btn = document.getElementById('tacticsCopyLinkBtn');
        if (!btn) return;

        if (copyLinkResetTimer) {
            clearTimeout(copyLinkResetTimer);
            copyLinkResetTimer = null;
        }

        const textWrap = btn.querySelector('.tactics-room-code-btn__text');
        const icon = btn.querySelector('.tactics-room-code-btn__icon');
        if (!textWrap) return;

        if (btn.classList.contains('is-copy-error')) {
            textWrap.innerHTML = '<span class="tactics-room-code-btn__copied tactics-room-code-btn__copied--error">'
                + escapeHtml(i18n().t('copyLinkFail'))
                + '</span>';
            return;
        }

        if (btn.classList.contains('is-copied')) {
            if (icon) {
                icon.className = 'fas fa-check tactics-room-code-btn__icon';
            }
            textWrap.innerHTML = '<span class="tactics-room-code-btn__copied">'
                + escapeHtml(i18n().t('copyLinkDone'))
                + '</span>';
            return;
        }

        restoreCopyBtnDefault();
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

        if (!ok) {
            btn.classList.remove('is-copied');
            btn.classList.add('is-copy-error');
            textWrap.innerHTML = '<span class="tactics-room-code-btn__copied tactics-room-code-btn__copied--error">'
                + escapeHtml(i18n().t('copyLinkFail'))
                + '</span>';
            copyLinkResetTimer = setTimeout(() => {
                restoreCopyBtnDefault();
                copyLinkResetTimer = null;
            }, 2000);
            return;
        }

        btn.classList.remove('is-copy-error');
        btn.classList.add('is-copied');
        if (icon) {
            icon.className = 'fas fa-check tactics-room-code-btn__icon';
        }
        textWrap.innerHTML = '<span class="tactics-room-code-btn__copied">'
            + escapeHtml(i18n().t('copyLinkDone'))
            + '</span>';

        copyLinkResetTimer = setTimeout(() => {
            restoreCopyBtnDefault();
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

    function updateLocalParticipantNickColor(nextColor) {
        const selfId = String(clientId || '');
        const normalized = normalizeNickColor(nextColor);
        if (!normalized) return;
        participantsList = participantsList.map((p) => (
            p.clientId === selfId ? { ...p, nickColor: normalized } : p
        ));
    }

    async function saveNicknameColor(color) {
        const normalized = normalizeNickColor(color);
        if (!normalized) return;
        nicknameColor = normalized;
        saveNicknameColorLocal(normalized);
        updateLocalParticipantNickColor(normalized);
        saveRoomSessionSnapshot();
        renderParticipants(participantsList);
        wsClient?.updateNickColor(normalized);
        if (wsToken && window.ABS_TACTICS_EVENT_API) {
            await store().postJson(window.ABS_TACTICS_EVENT_API, {
                public_id: roomState?.public_id || roomPublicId(),
                event_type: 'nick_color',
                payload: { color: normalized },
                ws_token: wsToken,
            });
        }
    }

    function closeNicknameColorPicker() {
        const popup = document.getElementById('tacticsNickColorPicker');
        if (popup) popup.hidden = true;
        nicknameColorPickerOpen = false;
    }

    function positionNickColorPicker(popup, anchorBtn) {
        const rect = anchorBtn.getBoundingClientRect();
        const margin = 8;
        popup.hidden = false;
        popup.style.visibility = 'hidden';
        popup.style.left = '0px';
        popup.style.top = '0px';
        const popupRect = popup.getBoundingClientRect();
        let left = rect.right - popupRect.width;
        let top = rect.bottom + 4;
        if (left + popupRect.width > window.innerWidth - margin) {
            left = window.innerWidth - popupRect.width - margin;
        }
        if (left < margin) {
            left = margin;
        }
        if (top + popupRect.height > window.innerHeight - margin) {
            top = rect.top - popupRect.height - 4;
        }
        if (top < margin) {
            top = margin;
        }
        popup.style.left = Math.round(left) + 'px';
        popup.style.top = Math.round(top) + 'px';
        popup.style.visibility = '';
    }

    function toggleNicknameColorPicker(anchorBtn) {
        const popup = document.getElementById('tacticsNickColorPicker');
        if (!popup) return;
        if (nicknameColorPickerOpen) {
            closeNicknameColorPicker();
            return;
        }
        positionNickColorPicker(popup, anchorBtn);
        nicknameColorPickerOpen = true;
    }

    function bindNicknameColorPickers() {
        const palette = window.TacticsCanvas?.CURSOR_COLORS || [];
        let popup = document.getElementById('tacticsNickColorPicker');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'tacticsNickColorPicker';
            popup.className = 'tactics-nick-color-picker';
            popup.hidden = true;
            popup.innerHTML = palette.map((c) => (
                '<button type="button" class="tactics-nick-color-picker__swatch"'
                + ' data-color="' + escapeHtml(c) + '" style="background:' + escapeHtml(c) + '"'
                + ' title="' + escapeHtml(c) + '" aria-label="' + escapeHtml(c) + '"></button>'
            )).join('');
            document.body.appendChild(popup);
            popup.addEventListener('click', (ev) => {
                const btn = ev.target.closest('[data-color]');
                if (!btn) return;
                ev.stopPropagation();
                void saveNicknameColor(btn.getAttribute('data-color'));
                closeNicknameColorPicker();
            });
        }
        popup.querySelectorAll('[data-color]').forEach((btn) => {
            const color = btn.getAttribute('data-color');
            const selected = normalizeNickColor(color) === nicknameColor;
            btn.classList.toggle('is-selected', selected);
        });
        document.querySelectorAll('.tactics-participant-color-btn').forEach((btn) => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                toggleNicknameColorPicker(btn);
            });
        });
        if (!nickColorPickerDocBound) {
            nickColorPickerDocBound = true;
            document.addEventListener('click', (ev) => {
                if (!nicknameColorPickerOpen) return;
                const picker = document.getElementById('tacticsNickColorPicker');
                if (picker && !picker.contains(ev.target) && !ev.target.closest('.tactics-participant-color-btn')) {
                    closeNicknameColorPicker();
                }
            });
        }
    }

    function buildNickColorBtn(cid, isSelf) {
        if (!isSelf) return '';
        const title = escapeHtml(i18n().t('chooseNickColor'));
        const color = resolveParticipantNickColor({ nickColor: nicknameColor, clientId: cid }, cid);
        return '<button type="button" class="tactics-participant-color-btn"'
            + ' title="' + title + '" aria-label="' + title + '">'
            + '<span class="tactics-participant-color-btn__swatch" style="background:'
            + escapeHtml(color) + '"></span></button>';
    }

    function canEditNickname() {
        if (!window.ABS_TACTICS_IS_LOGGED_IN) return true;
        return !canManage;
    }

    function shouldShowGuestNicknameEditUi() {
        return canEditNickname() && (isMobileLayout() || isCompactLayout());
    }

    function usesTopbarNicknameEditUi() {
        return nicknameEditing && shouldShowGuestNicknameEditUi();
    }

    function getNicknameEditInput() {
        return document.querySelector('.tactics-participant-name-input')
            || document.getElementById('tacticsMobileNicknameInput');
    }

    function syncMobileNicknameEditUi() {
        const titleRow = document.querySelector('.page-tactics-room .tactics-editor-topbar__title-row');
        const titleEl = document.getElementById('tacticsRoomTitle');
        const groupEl = titleEl?.closest('.tactics-editor-topbar__group--center');
        const visibilityWrap = document.getElementById('tacticsRoomVisibilityWrap');
        if (!titleRow || !titleEl) return;

        const showGuestNickUi = shouldShowGuestNicknameEditUi();
        let penBtn = document.getElementById('tacticsMobileNicknameBtn');
        let editWrap = document.getElementById('tacticsMobileNicknameWrap');

        const clearNicknameEditingLayout = () => {
            titleRow.classList.remove('is-nickname-editing');
            groupEl?.classList.remove('is-nickname-editing');
            titleEl.hidden = false;
            if (visibilityWrap && canManage) {
                visibilityWrap.hidden = false;
            }
        };

        if (!showGuestNickUi) {
            penBtn?.remove();
            editWrap?.remove();
            clearNicknameEditingLayout();
            return;
        }

        if (nicknameEditing) {
            penBtn?.remove();
            titleEl.hidden = true;
            if (visibilityWrap) {
                visibilityWrap.hidden = true;
            }
            titleRow.classList.add('is-nickname-editing');
            groupEl?.classList.add('is-nickname-editing');
            if (!editWrap) {
                editWrap = document.createElement('div');
                editWrap.id = 'tacticsMobileNicknameWrap';
                editWrap.className = 'tactics-mobile-nickname-wrap';
                editWrap.innerHTML = ''
                    + '<input type="text" class="tactics-mobile-nickname-input" id="tacticsMobileNicknameInput"'
                    + ' maxlength="32" autocomplete="nickname">'
                    + '<button type="button" class="tactics-mobile-nickname-btn tactics-mobile-nickname-btn--save"'
                    + ' id="tacticsMobileNicknameSave" title="' + escapeHtml(i18n().t('saveNickname')) + '">'
                    + '<i class="fas fa-check" aria-hidden="true"></i></button>'
                    + '<button type="button" class="tactics-mobile-nickname-btn tactics-mobile-nickname-btn--cancel"'
                    + ' id="tacticsMobileNicknameCancel" title="'
                    + escapeHtml(i18n().getLang() === 'en' ? 'Cancel' : 'Отмена')
                    + '"><i class="fas fa-times" aria-hidden="true"></i></button>';
                titleEl.insertAdjacentElement('afterend', editWrap);
                editWrap.querySelector('#tacticsMobileNicknameSave')
                    ?.addEventListener('click', () => saveNickname());
                editWrap.querySelector('#tacticsMobileNicknameCancel')
                    ?.addEventListener('click', () => cancelNicknameEdit());
            } else if (editWrap.previousElementSibling !== titleEl) {
                titleEl.insertAdjacentElement('afterend', editWrap);
            }
            return;
        }

        editWrap?.remove();
        clearNicknameEditingLayout();
        if (!penBtn) {
            penBtn = document.createElement('button');
            penBtn.type = 'button';
            penBtn.id = 'tacticsMobileNicknameBtn';
            penBtn.className = 'tactics-editor-topbar__btn tactics-mobile-nickname-btn';
            penBtn.title = i18n().t('editNickname');
            penBtn.setAttribute('aria-label', penBtn.title);
            penBtn.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i>';
            penBtn.addEventListener('click', () => startNicknameEdit());
            titleEl.insertAdjacentElement('afterend', penBtn);
        } else if (penBtn.previousElementSibling !== titleEl) {
            titleEl.insertAdjacentElement('afterend', penBtn);
        }
    }

    function abortNicknameEditStart() {
        nicknameEditing = false;
        nicknameLockedByUser = nicknameLockedBeforeEdit;
        syncMobileNicknameEditUi();
        renderParticipants(participantsList);
    }

    function focusNicknameEditInput(input) {
        if (!input) return false;
        input.value = nickname;
        input.focus();
        input.select();
        input.addEventListener('keydown', onNicknameInputKeydown);
        return true;
    }

    function startNicknameEdit() {
        if (!canEditNickname()) return;
        nicknameLockedBeforeEdit = nicknameLockedByUser;
        nicknameLockedByUser = true;
        nicknameEditing = true;
        if (shouldShowGuestNicknameEditUi()) {
            syncMobileNicknameEditUi();
            renderParticipants(participantsList);
            if (!focusNicknameEditInput(document.getElementById('tacticsMobileNicknameInput'))) {
                abortNicknameEditStart();
            }
            return;
        }
        syncMobileNicknameEditUi();
        renderParticipants(participantsList);
        if (!focusNicknameEditInput(document.querySelector('.tactics-participant-name-input'))) {
            abortNicknameEditStart();
        }
    }

    function cancelNicknameEdit() {
        nicknameEditing = false;
        nicknameLockedByUser = nicknameLockedBeforeEdit;
        syncMobileNicknameEditUi();
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
        const input = getNicknameEditInput();
        const next = (input?.value || '').trim()
            || window.ABS_TACTICS_DEFAULT_NICK
            || 'Guest';
        if (next === nickname) {
            nicknameEditing = false;
            nicknameLockedByUser = nicknameLockedBeforeEdit;
            syncMobileNicknameEditUi();
            renderParticipants(participantsList);
            return;
        }

        const prev = nickname;
        nicknameEditing = false;
        nicknameLockedByUser = true;
        nicknameLockedBeforeEdit = true;
        nickname = next;
        updateLocalParticipantNickname(nickname);
        syncMobileNicknameEditUi();
        renderParticipants(participantsList);

        const payload = await refreshSession('', { nickname: next, nicknameChange: true });
        if (!payload) {
            nickname = prev;
            nicknameLockedByUser = nicknameLockedBeforeEdit;
            updateLocalParticipantNickname(nickname);
            saveRoomSessionSnapshot();
            syncMobileNicknameEditUi();
            renderParticipants(participantsList);
            return;
        }

        accessToken = payload.access_token;
        wsToken = payload.ws_token;
        wsUrl = payload.ws_url;
        if (payload.nickname) {
            nickname = payload.nickname;
        }

        if (wsClient) {
            wsClient.nickname = nickname;
            if (wsToken) {
                wsClient.reconnectWithToken(wsToken);
            } else {
                wsClient.updateNickname(nickname);
            }
        }

        saveRoomSessionSnapshot();
        updateLocalParticipantNickname(nickname);
        syncMobileNicknameEditUi();
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

    function syncServerPresentationSnapshot(settings) {
        if (!settings || typeof settings !== 'object') return;
        serverPresentationSnapshot = {
            mode: settings.presentation_mode === true,
            hostId: String(settings.presentation_host_id || '').trim(),
            hostNickname: String(settings.presentation_host_nickname || '').trim(),
        };
    }

    function getPresentationHostId() {
        return String(getDrawSettings().presentation_host_id || '').trim();
    }

    function isPresentationHostOnline() {
        const hostId = getPresentationHostId();
        const selfId = String(clientId || '');
        if (!hostId) return false;
        if (hostId === selfId) return true;
        return participantsList.some((p) => p.clientId === hostId && p.online !== false);
    }

    function touchPresentationActivity(fromClientId) {
        if (!isPresentationMode()) return;
        const hostId = getPresentationHostId();
        if (!hostId) return;
        const sourceId = fromClientId != null ? String(fromClientId) : String(clientId || '');
        if (sourceId !== hostId) return;
        presentationLastActivityAt = Date.now();
        schedulePresentationInactivityCheck();
        updatePresentationCountdownUi();
    }

    function getPresentationInactivityRemainingMs() {
        if (!isPresentationMode()) return 0;
        const lastAt = presentationLastActivityAt || Date.now();
        return Math.max(0, PRESENTATION_INACTIVITY_MS - (Date.now() - lastAt));
    }

    function formatPresentationCountdown(ms) {
        const totalSec = Math.max(0, Math.ceil(ms / 1000));
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    }

    function updatePresentationCountdownUi() {
        if (!isPresentationMode()) {
            stopPresentationCountdownUi();
            return;
        }

        const hostId = getPresentationHostId();
        if (!hostId) return;

        const timerEl = document.querySelector(
            '#tacticsParticipants .tactics-participant-present-timer[data-client-id="'
            + hostId.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]',
        );
        if (!timerEl) return;

        const idleMs = Date.now() - (presentationLastActivityAt || Date.now());
        const remaining = getPresentationInactivityRemainingMs();

        if (idleMs < PRESENTATION_INACTIVITY_SHOW_IDLE_MS) {
            timerEl.classList.remove('is-visible', 'is-warning', 'is-critical');
            return;
        }

        timerEl.textContent = formatPresentationCountdown(remaining);
        timerEl.classList.add('is-visible');
        timerEl.classList.toggle('is-warning', remaining <= 30000);
        timerEl.classList.toggle('is-critical', remaining <= 10000);

        if (remaining <= 0 && idleMs >= PRESENTATION_INACTIVITY_MS - 250) {
            if (!isPresentationHostOnline()) {
                void stopPresentationWhenHostDisconnected();
            } else {
                void stopPresentationDueToInactivity();
            }
        }
    }

    function startPresentationCountdownUi() {
        if (!isPresentationMode()) {
            stopPresentationCountdownUi();
            return;
        }
        updatePresentationCountdownUi();
        if (!presentationCountdownInterval) {
            presentationCountdownInterval = setInterval(updatePresentationCountdownUi, 250);
        }
    }

    function stopPresentationCountdownUi() {
        if (presentationCountdownInterval) {
            clearInterval(presentationCountdownInterval);
            presentationCountdownInterval = null;
        }
        document.querySelectorAll('.tactics-participant-present-timer').forEach((el) => {
            el.classList.remove('is-visible', 'is-warning', 'is-critical');
            el.textContent = '';
        });
    }

    function clearPresentationInactivityTimer() {
        if (presentationInactivityTimer) {
            clearTimeout(presentationInactivityTimer);
            presentationInactivityTimer = null;
        }
    }

    function schedulePresentationInactivityCheck() {
        clearPresentationInactivityTimer();
        if (!isPresentationMode()) return;
        const lastAt = presentationLastActivityAt || Date.now();
        const delay = Math.max(250, lastAt + PRESENTATION_INACTIVITY_MS - Date.now());
        presentationInactivityTimer = setTimeout(() => {
            presentationInactivityTimer = null;
            void stopPresentationDueToInactivity();
        }, delay);
    }

    function onPresentationModeChanged(wasActive) {
        if (isPresentationMode()) {
            presentationLastActivityAt = Date.now();
            schedulePresentationInactivityCheck();
            startPresentationCountdownUi();
        } else {
            clearPresentationInactivityTimer();
            stopPresentationCountdownUi();
            if (wasActive) {
                presentationLastActivityAt = 0;
            }
        }
        renderParticipants(participantsList);
    }

    function clearPresentationSettings(settings) {
        if (!settings) return;
        settings.presentation_mode = false;
        delete settings.presentation_host_id;
        delete settings.presentation_host_nickname;
    }

    function getPresentationHostNickname() {
        return String(getDrawSettings().presentation_host_nickname || '').trim();
    }

    function mergeParticipantsWithPresentationHost(list) {
        const selfId = String(clientId || '');
        const presenceIds = lastPresenceClientIds.size > 0
            ? lastPresenceClientIds
            : new Set(normalizeParticipants(list).map((p) => p.clientId));

        let items = mergeParticipantsWithLocalSelf(list)
            .filter((p) => presenceIds.has(p.clientId) || p.clientId === selfId)
            .map((p) => ({ ...p, online: presenceIds.has(p.clientId) }));

        const hostId = isPresentationMode() ? getPresentationHostId() : '';
        if (!hostId) return items;

        const hostOnline = items.find((p) => p.clientId === hostId && p.online !== false);
        if (hostOnline) {
            const hostNick = String(hostOnline.nickname || '').trim();
            if (hostNick) {
                getDrawSettings().presentation_host_nickname = hostNick;
            }
            return items;
        }

        const prevHost = participantsList.find((p) => p.clientId === hostId);
        items.push({
            clientId: hostId,
            nickname: getPresentationHostNickname() || hostId,
            nickColor: prevHost?.nickColor || '',
            online: false,
        });
        return items;
    }

    async function ensureSaveAuthReady() {
        if (accessToken) return hasSaveAuth();
        if (canManage && window.ABS_TACTICS_IS_LOGGED_IN) {
            return refreshSaveSession();
        }
        return hasSaveAuth();
    }

    function sanitizeStalePresentation() {
        if (!isPresentationMode() || !roomState) return;
        if (presentationToggleInFlight || drawSettingsSaveInFlight) return;

        const hostId = getPresentationHostId();
        if (!hostId) {
            if (canManage || computeHasDrawRights()) {
                void stopPresentationMode(true);
            }
            return;
        }

        if (!isPresentationHostOnline()) {
            startPresentationCountdownUi();
        }
    }

    async function stopPresentationWhenHostDisconnected() {
        if (!isPresentationMode() || presentationStopInactivityInFlight) return;
        const hostId = getPresentationHostId();
        if (!hostId || isPresentationHostOnline()) return;
        if (!canManage && !computeHasDrawRights()) return;

        presentationStopInactivityInFlight = true;
        try {
            await stopPresentationMode(true);
        } finally {
            presentationStopInactivityInFlight = false;
        }
    }

    function prepareRoomDataForSave(roomData) {
        if (!roomData || drawSettingsSaveInFlight) return roomData;

        const selfId = String(clientId || '');
        const hostId = getPresentationHostId();
        const canChangePresentation = canManage
            || (isPresentationMode() && hostId === selfId)
            || (!isPresentationMode() && computeHasDrawRights())
            || (isPresentationOrphaned() && computeHasDrawRights());

        if (canChangePresentation) return roomData;

        const copy = JSON.parse(JSON.stringify(roomData));
        if (!copy.settings) copy.settings = {};
        copy.settings.presentation_mode = serverPresentationSnapshot.mode;
        if (serverPresentationSnapshot.hostId) {
            copy.settings.presentation_host_id = serverPresentationSnapshot.hostId;
        } else {
            delete copy.settings.presentation_host_id;
        }
        if (serverPresentationSnapshot.hostNickname) {
            copy.settings.presentation_host_nickname = serverPresentationSnapshot.hostNickname;
        } else {
            delete copy.settings.presentation_host_nickname;
        }
        return copy;
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
        const payload = {
            draw_mode: settings.draw_mode === 'open' ? 'open' : 'restricted',
            cursors_mode: settings.cursors_mode === 'off' ? 'off' : 'open',
            editors: Array.isArray(settings.editors) ? [...settings.editors] : [],
            show_grid: settings.show_grid !== false,
            presentation_mode: settings.presentation_mode === true,
        };
        if (payload.presentation_mode && roomState?.room_data) {
            const hostId = String(settings.presentation_host_id || clientId || '').trim();
            if (hostId) {
                payload.presentation_host_id = hostId;
            }
            const hostNickname = String(settings.presentation_host_nickname || nickname || '').trim();
            if (hostNickname) {
                payload.presentation_host_nickname = hostNickname;
            }
            const activeId = roomState.room_data.active_slide_id
                || slidesCtrl?.getActiveSlideId?.()
                || null;
            if (activeId) {
                payload.active_slide_id = activeId;
            }
        }
        return payload;
    }

    function isPresentationMode() {
        return getDrawSettings().presentation_mode === true;
    }

    function computeHasDrawRights() {
        if (canManage) return true;
        const settings = getDrawSettings();
        if (settings.draw_mode === 'open') return true;
        const editors = Array.isArray(settings.editors) ? settings.editors : [];
        return editors.includes(String(clientId || ''));
    }

    function isPresentationOrphaned() {
        return isPresentationMode() && !getPresentationHostId();
    }

    function isPresentationHost() {
        if (!isPresentationMode()) return false;
        const hostId = getPresentationHostId();
        if (!hostId) {
            return canManage;
        }
        return hostId === String(clientId || '');
    }

    function canControlPresentation() {
        if (canManage) {
            return isPresentationMode() || computeHasDrawRights();
        }
        if (!computeHasDrawRights()) return false;
        if (!isPresentationMode()) return true;
        if (isPresentationOrphaned()) return true;
        return isPresentationHost();
    }

    async function stopPresentationMode(force) {
        if (!isPresentationMode() || presentationToggleInFlight) return false;
        if (!force && !canControlPresentation()) return false;

        const previousMode = true;
        const previousHostId = getPresentationHostId();

        presentationToggleInFlight = true;
        updatePresentBtn();

        const settings = getDrawSettings();
        try {
            clearPresentationSettings(settings);
            applyDrawPermissions();

            let saved = await pushDrawSettingsChange();
            if (!saved) {
                await resyncRoom(true);
                clearPresentationSettings(getDrawSettings());
                applyDrawPermissions();
                saved = await pushDrawSettingsChange();
            }

            if (!saved) {
                if (force && canManage) {
                    void (async () => {
                        await refreshSaveSession();
                        clearPresentationSettings(getDrawSettings());
                        await pushDrawSettingsChange();
                    })();
                    onPresentationModeChanged(true);
                    return true;
                }
                settings.presentation_mode = previousMode;
                if (previousHostId) {
                    settings.presentation_host_id = previousHostId;
                }
                applyDrawPermissions();
                return false;
            }

            onPresentationModeChanged(true);
            return true;
        } finally {
            presentationToggleInFlight = false;
            updatePresentBtn();
        }
    }

    async function stopPresentationDueToInactivity() {
        if (!isPresentationMode() || presentationStopInactivityInFlight) return;

        if (!isPresentationHostOnline()) {
            await stopPresentationWhenHostDisconnected();
            return;
        }

        const hostId = getPresentationHostId();
        const selfId = String(clientId || '');
        const idleMs = Date.now() - (presentationLastActivityAt || Date.now());
        const inactivityExpired = idleMs >= PRESENTATION_INACTIVITY_MS - 250;

        if (!inactivityExpired || idleMs < PRESENTATION_INACTIVITY_SHOW_IDLE_MS) {
            schedulePresentationInactivityCheck();
            return;
        }

        const canStopAsHost = !!(hostId && hostId === selfId);
        const canStopAsOwner = canManage && hostId && inactivityExpired;
        const canStopOrphaned = isPresentationOrphaned() && (canManage || computeHasDrawRights());
        if (!canStopAsHost && !canStopAsOwner && !canStopOrphaned) return;

        presentationStopInactivityInFlight = true;
        try {
            await stopPresentationMode(true);
        } finally {
            presentationStopInactivityInFlight = false;
        }
    }

    function syncViewerToPresentationSlide() {
        if (!isPresentationMode() || isPresentationHost() || !slidesCtrl) return;
        slidesCtrl.syncToPresentationSlide(roomState?.room_data?.active_slide_id);
    }

    function broadcastDrawSettings() {
        wsClient?.sendSettings(getDrawSettingsPayload());
    }

    async function saveDrawSettingsNow() {
        if (!canPersistRoomChanges() || !roomState) return false;
        if (!(await ensureSaveAuthReady()) && !(canManage && window.ABS_TACTICS_IS_LOGGED_IN)) {
            return false;
        }

        persistCanvasToSlide();
        drawSettingsSaveInFlight = true;

        try {
            const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
                public_id: roomState.public_id,
                room_data: prepareRoomDataForSave(roomState.room_data),
                revision,
                access_token: accessToken || '',
            }, accessToken);

            if (res.ok && res.data.success) {
                revision = res.data.data.revision || revision + 1;
                roomState.revision = revision;
                syncServerPresentationSnapshot(getDrawSettings());
                return true;
            }
            return false;
        } finally {
            drawSettingsSaveInFlight = false;
            updatePresentBtn();
        }
    }

    async function saveGridSettingNow() {
        if (!canDraw || !roomState || !accessToken) return;

        persistCanvasToSlide();

        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
            public_id: roomState.public_id,
            room_data: prepareRoomDataForSave(roomState.room_data),
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

    async function pushDrawSettingsChange() {
        applyDrawPermissions();
        broadcastDrawSettings();
        return saveDrawSettingsNow();
    }

    function pushGridChange(visible) {
        const slide = slidesCtrl?.getActiveSlide();
        setSlideShowGrid(slide, visible);
        const settings = getDrawSettings();
        settings.show_grid = !!visible;
        broadcastDrawSettings();
        saveGridSettingNow();
    }

    function applyRemoteGridSetting(showGrid) {
        if (!roomState?.room_data) return;
        const slide = slidesCtrl?.getActiveSlide();
        const next = showGrid !== false;
        const settings = getDrawSettings();
        if (settings.show_grid === next && (!slide || getSlideShowGrid(slide) === next)) return;
        settings.show_grid = next;
        if (slide) setSlideShowGrid(slide, next);
        canvasCtrl?.setShowGrid(next);
    }

    function computeCanDraw() {
        if (isPresentationMode() && !isPresentationHost()) return false;
        return computeHasDrawRights();
    }

    function computeCanShareCursor() {
        const settings = getDrawSettings();
        return settings.cursors_mode !== 'off';
    }

    function applyDrawPermissions() {
        const mobileView = isMobileView();
        let viewerLocked;

        viewerLocked = isPresentationMode() && !isPresentationHost();

        if (mobileView) {
            canDraw = false;
            canvasCtrl?.setDrawEnabled(false);
            canvasCtrl?.setInteractionLocked(viewerLocked);
        } else {
            canDraw = computeCanDraw();
            canvasCtrl?.setDrawEnabled(canDraw);
            canvasCtrl?.setInteractionLocked(false);
        }

        updateDrawLockBtn();
        updatePresentBtn();
        applyCursorPermissions();
        const gridBtn = document.getElementById('tacticsGridToggleBtn');
        if (gridBtn) {
            gridBtn.disabled = viewerLocked;
            gridBtn.classList.toggle('is-disabled', viewerLocked);
        }
        const canEditSlides = !mobileView && (canManage || canDraw) && !viewerLocked;
        slidesCtrl?.setCanManage(canManage);
        slidesCtrl?.setCanAddSlides(canEditSlides);
        slidesCtrl?.setCanRenameSlides(canManage || canDraw);
        slidesCtrl?.setSlidesLocked(viewerLocked);
        const mapsPanel = document.getElementById('tacticsMapsPanel');
        if (mapsPanel) {
            mapsPanel.classList.toggle('is-disabled', !canEditSlides);
        }
        chatCtrl?.setInputEnabled(!mobileView);
        updateRoomTitle();
        syncMapModalCustomUploadUi();
        renderParticipants(participantsList);
        updateMobileSlideNav();
        syncMobileNicknameEditUi();

        if (isPresentationMode()) {
            if (!presentationLastActivityAt) {
                presentationLastActivityAt = Date.now();
                schedulePresentationInactivityCheck();
            }
            startPresentationCountdownUi();
        } else {
            clearPresentationInactivityTimer();
            stopPresentationCountdownUi();
        }
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
        btn.hidden = !canManage;
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

    function getRoomDisplayTitle() {
        const title = String(roomState?.title || '').trim();
        if (title) return title;
        return i18n().t('roomTitlePlaceholder');
    }

    function syncRoomDocumentTitle(titleOverride) {
        const raw = titleOverride !== undefined
            ? String(titleOverride).trim()
            : String(roomState?.title || '').trim();
        const pageTitle = raw || i18n().t('roomTitlePlaceholder');
        if (window.ABS_PAGE_TITLES) {
            window.ABS_PAGE_TITLES.ru = pageTitle;
            window.ABS_PAGE_TITLES.en = pageTitle;
        }
        const lang = i18n().getLang();
        if (typeof window.absSetDocumentTitle === 'function') {
            window.absSetDocumentTitle(pageTitle, lang);
        } else if (typeof window.absFormatSiteTitle === 'function') {
            document.title = window.absFormatSiteTitle(pageTitle, lang);
        } else {
            document.title = pageTitle;
        }
    }

    function updateRoomTitle() {
        const el = document.getElementById('tacticsRoomTitle');
        if (!el || el.tagName !== 'H1') return;
        el.textContent = getRoomDisplayTitle();
        syncRoomDocumentTitle();
        const canRename = !!canManage;
        el.classList.toggle('is-editable', canRename);
        if (canRename) {
            el.title = i18n().t('renameRoomTitleHint');
            el.setAttribute('role', 'button');
            el.tabIndex = 0;
        } else {
            el.removeAttribute('title');
            el.removeAttribute('role');
            el.removeAttribute('tabindex');
        }
    }

    async function saveRoomTitle(rawTitle, previousTitle) {
        if (!canManage || !roomState || !accessToken) return false;

        const clean = String(rawTitle || '').trim();
        const newTitle = clean || i18n().t('roomTitlePlaceholder');
        const prevRaw = previousTitle !== undefined
            ? String(previousTitle || '').trim()
            : String(roomState.title || '').trim();
        const prevNorm = prevRaw || i18n().t('roomTitlePlaceholder');
        if (newTitle === prevNorm) return true;

        setSaveStatus('saving');
        const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
            public_id: roomState.public_id,
            title: newTitle,
            revision,
            access_token: accessToken,
        }, accessToken);

        if (isRoomGoneResponse(res)) {
            redirectRoomNotFound();
            return false;
        }

        if (res.ok && res.data.success) {
            revision = res.data.data.revision || revision + 1;
            roomState.revision = revision;
            roomState.title = res.data.data.title || newTitle;
            updateRoomTitle();
            setSaveStatus(wsConnected ? 'connected' : 'saved');
            if (!wsConnected) {
                setTimeout(() => setSaveStatus(''), 2000);
            }
            return true;
        }

        setSaveStatus('saveError');
        if (res.status === 409) {
            await resyncRoom(true);
        }
        return false;
    }

    function openRoomTitleEditor() {
        if (!canManage) return;
        const titleEl = document.getElementById('tacticsRoomTitle');
        if (!titleEl || titleEl.tagName !== 'H1' || titleEl.dataset.editing === '1') return;

        const row = titleEl.closest('.tactics-editor-topbar__title-row');
        const groupEl = titleEl.closest('.tactics-editor-topbar__group--center');
        const originalText = String(roomState?.title || '').trim() || getRoomDisplayTitle();
        let finishing = false;

        titleEl.dataset.editing = '1';
        titleEl.dataset.originalTitle = originalText;
        titleEl.contentEditable = 'true';
        titleEl.classList.add('is-editing');
        titleEl.textContent = originalText;

        if (row && groupEl) {
            groupEl.classList.add('is-title-editing');
            row.classList.add('is-editing');
        }

        const finish = async (cancel) => {
            if (finishing || titleEl.dataset.editing !== '1') return;
            finishing = true;
            cleanupListeners();
            titleEl.contentEditable = 'false';
            titleEl.classList.remove('is-editing');
            delete titleEl.dataset.editing;
            delete titleEl.dataset.originalTitle;

            if (row) {
                row.classList.remove('is-editing');
            }
            groupEl?.classList.remove('is-title-editing');

            if (cancel) {
                titleEl.textContent = originalText;
                syncRoomDocumentTitle(originalText);
                return;
            }

            const nextTitle = String(titleEl.textContent || '').replace(/\s+/g, ' ').trim();
            const displayTitle = nextTitle || i18n().t('roomTitlePlaceholder');
            const previousTitle = String(roomState?.title || '').trim();

            titleEl.textContent = displayTitle;
            syncRoomDocumentTitle(displayTitle);

            const saved = await saveRoomTitle(nextTitle, previousTitle);
            if (!saved) {
                const rollbackTitle = previousTitle || i18n().t('roomTitlePlaceholder');
                titleEl.textContent = rollbackTitle;
                if (roomState) {
                    roomState.title = previousTitle;
                }
                syncRoomDocumentTitle(rollbackTitle);
            }
            updateRoomTitle();
        };

        const onInput = () => {
            syncRoomDocumentTitle(titleEl.textContent || '');
        };
        const onBlur = () => {
            void finish(false);
        };
        const onKeydown = (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                void finish(false);
            }
            if (ev.key === 'Escape') {
                ev.preventDefault();
                void finish(true);
            }
        };
        const onPaste = (ev) => {
            ev.preventDefault();
            const text = ev.clipboardData?.getData('text/plain') || '';
            document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
        };
        const cleanupListeners = () => {
            titleEl.removeEventListener('input', onInput);
            titleEl.removeEventListener('blur', onBlur);
            titleEl.removeEventListener('keydown', onKeydown);
            titleEl.removeEventListener('paste', onPaste);
        };

        titleEl.addEventListener('input', onInput);
        titleEl.addEventListener('blur', onBlur);
        titleEl.addEventListener('keydown', onKeydown);
        titleEl.addEventListener('paste', onPaste);

        titleEl.focus();
        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    function bindRoomTitleEdit() {
        const cluster = document.querySelector('.tactics-editor-topbar__title-cluster');
        if (!cluster || cluster.dataset.titleEditBound) return;
        cluster.dataset.titleEditBound = '1';

        cluster.addEventListener('click', (ev) => {
            const titleEl = ev.target.closest('#tacticsRoomTitle');
            if (!titleEl || titleEl.tagName !== 'H1' || titleEl.dataset.editing === '1') return;
            ev.preventDefault();
            openRoomTitleEditor();
        });

        cluster.addEventListener('keydown', (ev) => {
            const titleEl = ev.target.closest('#tacticsRoomTitle');
            if (!titleEl || titleEl.tagName !== 'H1' || titleEl.dataset.editing === '1') return;
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            openRoomTitleEditor();
        });
    }

    function updatePresentBtn() {
        const btn = document.getElementById('tacticsPresentBtn');
        if (!btn) return;

        const active = isPresentationMode();
        const host = isPresentationHost();
        const canToggle = canControlPresentation();
        const canStop = canManage || canToggle;
        const viewerStatus = active && !canManage && !host && !canStop;
        btn.hidden = !computeHasDrawRights() && !(active && !host);
        btn.classList.toggle('is-active', active && host);
        btn.classList.toggle('is-viewer-status', viewerStatus);
        btn.disabled = !canStop || presentationToggleInFlight || drawSettingsSaveInFlight;
        btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');

        const icon = btn.querySelector('i');
        if (icon) {
            if (viewerStatus) {
                icon.className = 'fas fa-chalkboard-teacher';
            } else {
                icon.className = active ? 'fas fa-stop' : 'fas fa-play';
            }
        }

        const titleKey = viewerStatus
            ? 'presentActive'
            : (active ? 'presentStop' : 'present');
        btn.title = i18n().t(titleKey);
        btn.setAttribute('aria-label', btn.title);

        const labelEl = document.getElementById('tacticsPresentBtnLabel');
        if (labelEl) {
            const labelKey = viewerStatus
                ? 'presentActive'
                : (active ? 'presentStopBtn' : 'presentBtn');
            labelEl.textContent = i18n().t(labelKey);
        }

        document.getElementById('tacticsRoomWorkspace')?.classList.toggle('is-presenting', active);
    }

    async function togglePresentationMode() {
        if (presentationToggleInFlight) return;
        if (isPresentationMode() && canManage) {
            await stopPresentationMode(true);
            return;
        }
        if (!canControlPresentation()) return;
        if (isPresentationMode()) {
            await stopPresentationMode(false);
            return;
        }

        presentationToggleInFlight = true;
        updatePresentBtn();

        const settings = getDrawSettings();

        try {
            if (slidesCtrl && roomState?.room_data) {
                const slideId = slidesCtrl.getActiveSlideId();
                if (slideId) {
                    roomState.room_data.active_slide_id = slideId;
                    wsClient?.sendSlide('switch', {
                        action: 'switch',
                        slideId,
                        activeSlideId: slideId,
                    });
                }
                settings.presentation_host_id = String(clientId || '');
                settings.presentation_host_nickname = String(nickname || '').trim();
            }
            settings.presentation_mode = true;
            touchPresentationActivity();
            await pushDrawSettingsChange();
            onPresentationModeChanged(false);
        } finally {
            presentationToggleInFlight = false;
            updatePresentBtn();
        }
    }

    function bindPresentBtn() {
        const btn = document.getElementById('tacticsPresentBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => togglePresentationMode());
    }

    function bindBackBtn() {
        const btn = document.getElementById('tacticsBackBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const fallback = window.ABS_TACTICS_ROOMS_HREF || window.ABS_TACTICS_LOBBY_HREF || '/';
            try {
                const ref = document.referrer;
                if (ref) {
                    const refUrl = new URL(ref, window.location.origin);
                    if (refUrl.origin === window.location.origin && window.history.length > 1) {
                        window.history.back();
                        return;
                    }
                }
            } catch (e) {

            }
            window.location.href = fallback;
        });
    }

    function dataUrlToBlob(dataUrl) {
        const [header, body] = String(dataUrl).split(',');
        if (!body) return null;
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
    }

    function downloadBlobFile(blob, filename) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    function bindDownloadScreenshotBtn() {
        const btn = document.getElementById('tacticsDownloadScreenshotBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const dataUrl = canvasCtrl?.exportScreenshot?.();
            if (!dataUrl) return;
            const slide = slidesCtrl?.getActiveSlide();
            const rawName = slide ? slidesCtrl.getSlideDisplayName(slide) : 'map';
            const safeName = String(rawName || 'map')
                .replace(/[^\w\u0400-\u04FF.-]+/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 80) || 'map';
            const blob = dataUrlToBlob(dataUrl);
            downloadBlobFile(blob, `${safeName}.png`);
        });
    }

    function updateDrawLockBtn() {
        const settings = getDrawSettings();
        const restricted = settings.draw_mode !== 'open';
        const title = i18n().t(restricted ? 'drawRestricted' : 'drawOpen');

        ['tacticsDrawLockBtnSide'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = restricted ? 'fas fa-lock' : 'fas fa-lock-open';
            }
            btn.hidden = !canManage;
            btn.classList.toggle('is-active', restricted);
            btn.title = title;
            btn.setAttribute('aria-label', title);
            btn.disabled = !canManage;
            btn.classList.toggle('is-disabled', !canManage);
        });
    }

    function bindDrawLockBtn() {
        ['tacticsDrawLockBtnSide'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn || btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => toggleDrawModeLock());
        });
    }

    let sidebarLayoutRaf = 0;

    function syncRightSidebarLayout() {
        const rightInner = document.querySelector('.page-tactics-room .tactics-right-sidebar__inner');
        const toolContext = document.querySelector('.page-tactics-room .tactics-tool-context');
        const leftCol = document.getElementById('tacticsToolsColumn');
        if (!rightInner || !toolContext || leftCol?.classList.contains('is-collapsed')) {
            rightInner?.style.removeProperty('--tactics-right-users-height');
            return;
        }

        if (window.innerWidth <= COMPACT_LAYOUT_MAX) {
            rightInner?.style.removeProperty('--tactics-right-users-height');
            return;
        }

        const innerRect = rightInner.getBoundingClientRect();
        const contextRect = toolContext.getBoundingClientRect();
        const offset = Math.max(96, Math.round(contextRect.top - innerRect.top));
        rightInner.style.setProperty('--tactics-right-users-height', offset + 'px');
    }

    function scheduleRightSidebarLayoutSync() {
        cancelAnimationFrame(sidebarLayoutRaf);
        sidebarLayoutRaf = requestAnimationFrame(syncRightSidebarLayout);
    }

    function bindSidebarLayoutSync() {
        if (bindSidebarLayoutSync.bound) return;
        bindSidebarLayoutSync.bound = true;

        const observeTargets = [
            document.getElementById('tacticsToolsColumn'),
            document.querySelector('.page-tactics-room .tactics-right-sidebar__inner'),
            document.querySelector('.page-tactics-room .tactics-tool-context'),
        ].filter(Boolean);

        window.addEventListener('resize', scheduleRightSidebarLayoutSync, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(scheduleRightSidebarLayoutSync);
            observeTargets.forEach((el) => observer.observe(el));
        }
        scheduleRightSidebarLayoutSync();
    }

    const SIDEBAR_AUTO_COLLAPSE_LEFT = 1340;
    const COMPACT_LAYOUT_MAX = 1340;
    const MOBILE_LAYOUT_MAX = 500;
    let sidebarPreferLeft = null;
    let sidebarPreferRight = null;
    let sidebarResponsiveBound = false;

    function isMobileLayout() {
        return window.innerWidth <= MOBILE_LAYOUT_MAX;
    }

    function isCompactLayout() {
        const width = window.innerWidth;
        return width > MOBILE_LAYOUT_MAX && width <= COMPACT_LAYOUT_MAX;
    }

    function isMobileView() {
        return isMobileLayout();
    }

    function canUseMobileSlideNav() {
        return isMobileLayout() && !(isPresentationMode() && !isPresentationHost());
    }

    function syncEditorBodyLayoutClasses() {
        const editorBody = document.querySelector('.page-tactics-room .tactics-editor-body');
        const leftCol = document.getElementById('tacticsToolsColumn');
        const rightCol = document.getElementById('tacticsRightColumn');
        if (!editorBody) return;
        editorBody.classList.toggle('is-left-collapsed', !!leftCol?.classList.contains('is-collapsed'));
        editorBody.classList.toggle('is-right-collapsed', !!rightCol?.classList.contains('is-collapsed'));
    }

    function setSidebarCollapsed(side, collapsed) {
        const col = side === 'left'
            ? document.getElementById('tacticsToolsColumn')
            : document.getElementById('tacticsRightColumn');
        const btn = side === 'left'
            ? document.getElementById('tacticsCollapseLeft')
            : document.getElementById('tacticsCollapseRight');
        if (!col) return;
        col.classList.toggle('is-collapsed', collapsed);
        btn?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        syncEditorBodyLayoutClasses();
    }

    function shouldAutoCollapseLeft(width) {
        if (sidebarPreferLeft !== null) {
            return !sidebarPreferLeft;
        }
        return width < SIDEBAR_AUTO_COLLAPSE_LEFT;
    }

    function updateMobileSlideNav() {
        const bar = document.getElementById('tacticsMobileBar');
        const labelEl = document.getElementById('tacticsMobileSlideLabel');
        const prevBtn = document.getElementById('tacticsMobileSlidePrev');
        const nextBtn = document.getElementById('tacticsMobileSlideNext');
        if (!bar || !labelEl || !prevBtn || !nextBtn) return;

        const showBar = canUseMobileSlideNav();
        bar.hidden = !showBar;
        if (!showBar) return;

        const slides = slidesCtrl?.getSlides?.() || [];
        const activeId = slidesCtrl?.getActiveSlideId?.();
        const index = slides.findIndex((slide) => slide.id === activeId);
        const total = slides.length;
        const activeSlide = index >= 0 ? slides[index] : null;
        const slideName = activeSlide
            ? (slidesCtrl?.getSlideDisplayName?.(activeSlide) || String(index + 1))
            : '—';

        labelEl.textContent = total > 0
            ? (index >= 0 ? (index + 1) + ' / ' + total + ' · ' + slideName : slideName)
            : '—';

        const canSwitch = total > 1;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        prevBtn.classList.toggle('is-disabled', !canSwitch);
        nextBtn.classList.toggle('is-disabled', !canSwitch);
    }

    function bindMobileSlideNav() {
        const prevBtn = document.getElementById('tacticsMobileSlidePrev');
        const nextBtn = document.getElementById('tacticsMobileSlideNext');
        if (!prevBtn || !nextBtn || prevBtn.dataset.bound) return;
        prevBtn.dataset.bound = '1';
        nextBtn.dataset.bound = '1';

        const step = (delta) => {
            if (!canUseMobileSlideNav()) return;
            const slides = slidesCtrl?.getSlides?.() || [];
            if (slides.length < 2) return;
            const activeId = slidesCtrl?.getActiveSlideId?.();
            const index = slides.findIndex((slide) => slide.id === activeId);
            const start = index >= 0 ? index : 0;
            const next = slides[(start + delta + slides.length) % slides.length];
            if (next?.id) {
                slidesCtrl.switchSlide(next.id);
            }
        };

        const onStep = (delta) => (ev) => {
            ev.preventDefault();
            step(delta);
        };

        prevBtn.addEventListener('click', onStep(-1));
        nextBtn.addEventListener('click', onStep(1));
    }

    function applyResponsiveSidebars() {
        const width = window.innerWidth;
        const mobile = width <= MOBILE_LAYOUT_MAX;
        const compact = isCompactLayout();
        document.getElementById('tacticsRoomWorkspace')?.classList.toggle('is-mobile-view', mobile);
        document.getElementById('tacticsRoomWorkspace')?.classList.toggle('is-compact-view', compact);
        document.body.classList.toggle('is-tactics-mobile', mobile);
        document.body.classList.toggle('is-tactics-compact', compact);

        if (mobile) {
            setSidebarCollapsed('left', true);
            setSidebarCollapsed('right', true);
            chatCtrl?.setCollapsed?.(true);
        } else if (compact) {
            setSidebarCollapsed('left', true);
            setSidebarCollapsed('right', false);
            chatCtrl?.setCollapsed?.(true);
        } else {
            const leftCollapsed = shouldAutoCollapseLeft(width);
            setSidebarCollapsed('left', leftCollapsed);
            if (sidebarPreferRight !== null) {
                setSidebarCollapsed('right', !sidebarPreferRight);
            }
        }

        applyDrawPermissions();
        updateMobileSlideNav();
        syncMobileNicknameEditUi();
        slidesCtrl?.syncCarouselLayout?.();
        canvasCtrl?.scheduleResize?.();
        if (mobile || compact) {
            void canvasCtrl?.ensureCanvasLayout?.();
        }
        scheduleRightSidebarLayoutSync();
    }

    function bindResponsiveSidebars() {
        if (sidebarResponsiveBound) return;
        sidebarResponsiveBound = true;

        let lastWidth = window.innerWidth;
        const onViewportChange = () => {
            const width = window.innerWidth;
            if (width >= SIDEBAR_AUTO_COLLAPSE_LEFT && lastWidth < SIDEBAR_AUTO_COLLAPSE_LEFT) {
                sidebarPreferLeft = null;
            }
            lastWidth = width;
            applyResponsiveSidebars();
        };

        window.addEventListener('resize', onViewportChange, { passive: true });
        window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
        window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true });

        applyResponsiveSidebars();
    }

    function bindEditorChrome() {
        const leftBtn = document.getElementById('tacticsCollapseLeft');
        const rightBtn = document.getElementById('tacticsCollapseRight');
        const leftCol = document.getElementById('tacticsToolsColumn');
        const rightCol = document.getElementById('tacticsRightColumn');

        leftBtn?.addEventListener('click', () => {
            const collapsed = !!leftCol?.classList.toggle('is-collapsed');
            sidebarPreferLeft = !collapsed;
            leftBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            applyResponsiveSidebars();
        });

        rightBtn?.addEventListener('click', () => {
            const collapsed = !!rightCol?.classList.toggle('is-collapsed');
            sidebarPreferRight = !collapsed;
            rightBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            syncEditorBodyLayoutClasses();
            canvasCtrl?.scheduleResize?.();
            scheduleRightSidebarLayoutSync();
        });

        bindResponsiveSidebars();
        bindMobileSlideNav();
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
        if (presentationToggleInFlight) return;

        const local = getDrawSettings();
        const wasPresentation = isPresentationMode();

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

        if (typeof settings.presentation_mode === 'boolean') {
            local.presentation_mode = settings.presentation_mode;
        }

        if (typeof settings.presentation_host_id === 'string' && settings.presentation_host_id) {
            local.presentation_host_id = settings.presentation_host_id;
        } else if (settings.presentation_mode === false) {
            delete local.presentation_host_id;
        }

        if (typeof settings.presentation_host_nickname === 'string' && settings.presentation_host_nickname) {
            local.presentation_host_nickname = settings.presentation_host_nickname;
        } else if (settings.presentation_mode === false) {
            delete local.presentation_host_nickname;
        }

        if (typeof settings.active_slide_id === 'string' && settings.active_slide_id) {
            roomState.room_data.active_slide_id = settings.active_slide_id;
        }

        syncServerPresentationSnapshot(local);

        applyDrawPermissions();

        if (local.presentation_mode && !wasPresentation) {
            syncViewerToPresentationSlide();
        }
        onPresentationModeChanged(wasPresentation);
    }

    function normalizeParticipants(list) {
        if (!Array.isArray(list)) return [];
        return list
            .map((p) => ({
                clientId: String(p?.clientId || '').trim(),
                nickname: String(p?.nickname || '').trim(),
                nickColor: String(p?.nickColor || p?.nick_color || '').trim(),
            }))
            .filter((p) => p.clientId !== '');
    }

    function renderParticipants(list) {
        const el = document.getElementById('tacticsParticipants');
        if (!el) return;

        participantsList = mergeParticipantsWithPresentationHost(list);
        const selfId = String(clientId || '');
        const countEl = document.getElementById('tacticsUsersCount');
        if (countEl) {
            const onlineCount = participantsList.filter((p) => p.online !== false).length;
            countEl.textContent = '(' + onlineCount + ')';
        }
        if (nicknameEditing && getNicknameEditInput()) {
            return;
        }
        const settings = getDrawSettings();
        const editors = new Set(Array.isArray(settings.editors) ? settings.editors : []);
        const drawOpen = settings.draw_mode === 'open';
        const presentHostId = isPresentationMode() ? getPresentationHostId() : '';

        const buildPresenterIcon = (cid, isOffline) => {
            if (!presentHostId || String(cid) !== presentHostId) return '';
            const title = escapeHtml(i18n().t('presentStreaming'));
            const offlineClass = isOffline ? ' is-offline' : '';
            return '<span class="tactics-participant-present' + offlineClass + '" title="' + title + '">'
                + '<i class="fas fa-video" aria-hidden="true"></i></span>';
        };

        const buildOfflineBadge = (isOffline) => {
            if (!isOffline) return '';
            const label = escapeHtml(i18n().t('participantOffline'));
            return '<span class="tactics-participant-offline" title="' + label + '">' + label + '</span>';
        };

        const buildPresenterTimer = (cid) => {
            if (!presentHostId || String(cid) !== presentHostId) return '';
            const title = escapeHtml(i18n().t('presentInactivityTimer'));
            return '<span class="tactics-participant-present-timer" data-client-id="'
                + escapeHtml(cid) + '" title="' + title + '" aria-live="polite"></span>';
        };

        el.innerHTML = participantsList.map((p) => {
            const cid = String(p.clientId || '');
            const isSelf = cid === selfId;
            const displayName = isSelf ? nickname : (p.nickname || cid || '?');
            const nickColor = resolveParticipantNickColor(p, cid);
            const isOffline = p.online === false;
            const offlineClass = isOffline ? ' tactics-participant--offline' : '';
            const presenterIcon = buildPresenterIcon(cid, isOffline);
            const offlineBadge = buildOfflineBadge(isOffline);
            const presenterTimer = buildPresenterTimer(cid);
            const name = '<span class="tactics-participant-nick' + (isOffline ? ' is-offline' : '') + '" style="color:'
                + nickColor + '">' + escapeHtml(displayName) + '</span>';
            const self = isSelf ? ' tactics-participant-self' : '';
            const editingClass = isSelf && nicknameEditing && !usesTopbarNicknameEditUi()
                ? ' tactics-participant--editing-nick'
                : '';
            let actionBtn = '';
            const colorBtn = buildNickColorBtn(cid, isSelf);

            if (isSelf) {
                if (canEditNickname() && nicknameEditing && !usesTopbarNicknameEditUi()) {
                    const editTitle = i18n().t('saveNickname');
                    actionBtn = '<button type="button" class="tactics-participant-nick-btn is-save"'
                        + ' title="' + escapeHtml(editTitle) + '" aria-label="' + escapeHtml(editTitle) + '">'
                        + '<i class="fas fa-check" aria-hidden="true"></i></button>';
                    return '<li class="tactics-participant' + self + editingClass + offlineClass + '" data-client-id="'
                        + escapeHtml(cid) + '">'
                        + presenterIcon
                        + '<input type="text" class="tactics-participant-name-input" maxlength="32"'
                        + ' value="' + escapeHtml(displayName) + '" autocomplete="nickname">'
                        + offlineBadge
                        + presenterTimer
                        + colorBtn
                        + actionBtn
                        + '</li>';
                }

                if (canEditNickname() && !nicknameEditing) {
                    const editTitle = i18n().t('editNickname');
                    actionBtn = '<button type="button" class="tactics-participant-nick-btn"'
                        + ' title="' + escapeHtml(editTitle) + '" aria-label="' + escapeHtml(editTitle) + '">'
                        + '<i class="fas fa-pen" aria-hidden="true"></i></button>';
                }
            } else if (canManage && cid && !drawOpen && !isOffline) {
                const isEditor = editors.has(cid);
                const activeClass = isEditor ? ' is-active' : '';
                const title = i18n().t(isEditor ? 'revokeDraw' : 'grantDraw');
                actionBtn = '<button type="button" class="tactics-participant-editor-btn'
                    + activeClass + '" data-client-id="' + escapeHtml(cid)
                    + '" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title)
                    + '"><i class="fas fa-crown" aria-hidden="true"></i></button>';
            }

            return '<li class="tactics-participant' + self + editingClass + offlineClass + '" data-client-id="'
                + escapeHtml(cid) + '">'
                + '<span class="tactics-participant-name">'
                + presenterIcon + name + offlineBadge + presenterTimer + '</span>'
                + colorBtn
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
        bindNicknameColorPickers();

        if (slidesCtrl && (slidesCtrl.savedListScrollTop > 0 || slidesCtrl.savedListScrollLeft > 0)) {
            const scrollState = {
                top: slidesCtrl.savedListScrollTop,
                left: slidesCtrl.savedListScrollLeft,
            };
            slidesCtrl.restoreScrollState(scrollState);
            requestAnimationFrame(() => slidesCtrl.restoreScrollState(scrollState));
        }

        if (isPresentationMode()) {
            updatePresentationCountdownUi();
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function markDirty(urgent) {
        dirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveRoom, urgent ? SAVE_MODIFY_MS : SAVE_MS);
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveRoom, SAVE_MS);
    }

    function canvasStateHasObjects(canvas) {
        return Array.isArray(canvas?.objects) && canvas.objects.length > 0;
    }

    function flushCanvasToRoomData() {
        persistCanvasToSlide();
    }

    function canPersistRoomChanges() {
        return computeHasDrawRights() || canManage;
    }

    function hasSaveAuth() {
        if (accessToken) return true;
        return !!(canManage && window.ABS_TACTICS_IS_LOGGED_IN);
    }

    async function refreshSaveSession() {
        const previousRoomData = roomState?.room_data;
        const payload = await refreshSession('');
        if (!payload) return false;
        applySessionTokens(payload);
        if (payload.room?.room_data) {
            const mergedRoomData = mergeLocalCanvasRoomData(
                previousRoomData,
                payload.room.room_data,
            );
            roomState.room_data = mergedRoomData;
            slidesCtrl?.setRoomData(mergedRoomData);
        }
        saveRoomSessionSnapshot();
        applyDrawPermissions();
        if (wsClient && wsToken) {
            wsClient.reconnectWithToken(wsToken);
        }
        return true;
    }

    async function saveRoom() {
        if (!dirty || !roomState || saveInFlight) return;
        if (!canPersistRoomChanges()) return;
        if (!hasSaveAuth()) {
            scheduleSave();
            return;
        }
        if (canvasCtrl?.isSlideLoading) {
            scheduleSave();
            return;
        }

        saveInFlight = true;
        try {
            setSaveStatus('saving');
            flushCanvasToRoomData();

            const res = await store().postJson(window.ABS_TACTICS_UPDATE_API, {
                public_id: roomState.public_id,
                room_data: prepareRoomDataForSave(roomState.room_data),
                revision,
                access_token: accessToken,
            }, accessToken);

            if (isRoomGoneResponse(res)) {
                redirectRoomNotFound();
                return;
            }

            if (res.ok && res.data.success) {
                dirty = false;
                save403Attempts = 0;
                revision = res.data.data.revision || revision + 1;
                roomState.revision = revision;
                setSaveStatus(wsConnected ? 'connected' : 'saved');
                if (!wsConnected) {
                    setTimeout(() => setSaveStatus(''), 2000);
                }
                return;
            }

            dirty = true;
            setSaveStatus('saveError');

            const errorText = String(res.data?.error || '');
            const isCsrf = /токен безопасности|security token/i.test(errorText);

            if (res.status === 403) {
                if (!isCsrf && save403Attempts < SAVE_403_MAX_ATTEMPTS) {
                    save403Attempts += 1;
                    const refreshed = await refreshSaveSession();
                    if (refreshed && hasSaveAuth() && canPersistRoomChanges()) {
                        saveInFlight = false;
                        return saveRoom();
                    }
                }
                save403Attempts = 0;
                applyDrawPermissions();
                return;
            }

            if (res.status === 409) {
                await resyncRoom(true);
                scheduleSave();
            } else {
                scheduleSave();
            }
        } finally {
            saveInFlight = false;
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

    function stopNickColorPolling() {
        if (nickColorPollTimer) {
            clearInterval(nickColorPollTimer);
            nickColorPollTimer = null;
        }
    }

    function mergeParticipantNickColors(incomingList) {
        if (!Array.isArray(incomingList) || incomingList.length === 0) return false;

        const colorMap = new Map();
        incomingList.forEach((p) => {
            const cid = String(p?.clientId || '').trim();
            const color = normalizeNickColor(p?.nickColor || p?.nick_color || '');
            if (cid && color) {
                colorMap.set(cid, color);
            }
        });
        if (colorMap.size === 0) return false;

        let changed = false;
        participantsList = participantsList.map((p) => {
            const cid = String(p.clientId || '');
            const incoming = colorMap.get(cid);
            if (!incoming || incoming === normalizeNickColor(p.nickColor)) {
                return p;
            }
            changed = true;
            return { ...p, nickColor: incoming };
        });
        return changed;
    }

    async function pollPresenceNickColors() {
        if (!wsToken || !window.ABS_TACTICS_PRESENCE_API) return;

        const url = window.ABS_TACTICS_PRESENCE_API
            + '?token=' + encodeURIComponent(wsToken);
        const res = await store().getJson(url);
        if (!res.ok || !res.data?.success || !Array.isArray(res.data.participants)) {
            return;
        }

        if (mergeParticipantNickColors(res.data.participants)) {
            renderParticipants(participantsList);
        }
    }

    function restartNickColorPolling() {
        stopNickColorPolling();
        void pollPresenceNickColors();
        nickColorPollTimer = setInterval(() => {
            void pollPresenceNickColors();
        }, NICK_COLOR_POLL_MS);
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
        lastPresenceClientIds = new Set(
            normalizeParticipants(list).map((p) => p.clientId),
        );
        renderParticipants(list);
        sanitizeStalePresentation();
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

    function persistCanvasToSlide() {
        syncRoomDataFromSlides();
        if (!slidesCtrl || !canvasCtrl || canvasCtrl.isSlideLoading) return;
        const slideId = canvasCtrl.slideId;
        if (!slideId) return;
        slidesCtrl.updateSlideCanvas(slideId, canvasCtrl.getCanvasState());
    }

    async function applyServerCanvasForActiveSlide() {
        if (!slidesCtrl || !canvasCtrl || canvasCtrl.isSlideLoading || dirty) return;
        const slide = slidesCtrl.getActiveSlide();
        if (!slide?.canvas || !canvasStateHasObjects(slide.canvas)) return;
        const live = canvasCtrl.getCanvasState();
        if (canvasStateHasObjects(live)) return;
        if (String(canvasCtrl.slideId || '') !== String(slide.id)) return;
        await canvasCtrl.applyCanvasState(slide.canvas);
    }

    function syncRoomDataFromSlides() {
        if (!roomState || !slidesCtrl?.roomData) return;
        if (roomState.room_data !== slidesCtrl.roomData) {
            roomState.room_data = slidesCtrl.roomData;
        }
    }

    function mergePendingDrawSettings(localRoomData, incomingRoomData) {
        if (!drawSettingsSaveInFlight || !localRoomData?.settings) {
            return incomingRoomData;
        }
        return {
            ...incomingRoomData,
            settings: {
                ...(incomingRoomData?.settings || {}),
                ...localRoomData.settings,
            },
        };
    }

    function mergeLocalCanvasRoomData(localRoomData, incomingRoomData) {
        if (!localRoomData?.slides || !incomingRoomData?.slides) {
            return incomingRoomData;
        }

        const localSlides = localRoomData.slides;
        const incomingIds = new Set(
            incomingRoomData.slides.map((s) => s.id).filter(Boolean),
        );
        const mergedSlides = incomingRoomData.slides.map((nextSlide) => {
            const localSlide = localSlides.find((s) => s.id === nextSlide.id);
            if (!localSlide) {
                return nextSlide;
            }
            if (canvasStateHasObjects(localSlide.canvas)) {
                return { ...nextSlide, canvas: localSlide.canvas };
            }
            return nextSlide;
        });

        localSlides.forEach((localSlide) => {
            if (localSlide?.id && !incomingIds.has(localSlide.id)) {
                mergedSlides.push(localSlide);
            }
        });

        return {
            ...incomingRoomData,
            slides: mergedSlides,
            active_slide_id: localRoomData.active_slide_id || incomingRoomData.active_slide_id,
        };
    }

    function syncStoredSlideCanvas(slideId) {
        if (!slideId || !slidesCtrl || !canvasCtrl) return;
        if (String(canvasCtrl.slideId || '') !== String(slideId)) return;
        persistCanvasToSlide();
    }

    function preserveRealtimeCanvasRoomData(previousRoomData, incomingRoomData, activeSlideId) {
        if (!wsConnected || !previousRoomData?.slides || !incomingRoomData?.slides) {
            return incomingRoomData;
        }

        const localSlides = previousRoomData.slides;
        const incomingIds = new Set(
            incomingRoomData.slides.map((s) => s.id).filter(Boolean),
        );
        const mergedSlides = incomingRoomData.slides.map((nextSlide) => {
            const localSlide = localSlides.find((s) => s.id === nextSlide.id);
            if (!localSlide) {
                return nextSlide;
            }
            if (activeSlideId && nextSlide.id === activeSlideId && canvasCtrl) {
                return { ...nextSlide, canvas: canvasCtrl.getCanvasState() };
            }
            if (localSlide.canvas) {
                return { ...nextSlide, canvas: localSlide.canvas };
            }
            return nextSlide;
        });

        localSlides.forEach((localSlide) => {
            if (localSlide?.id && !incomingIds.has(localSlide.id)) {
                mergedSlides.push(localSlide);
            }
        });

        return {
            ...incomingRoomData,
            slides: mergedSlides,
            active_slide_id: previousRoomData.active_slide_id || incomingRoomData.active_slide_id,
        };
    }

    function mergeRemoteOwnIntoSlideCanvas(slideId, clientId, payload) {
        if (!slidesCtrl || !slideId || !payload || !clientId) return;
        const slide = slidesCtrl.getSlides().find((s) => s.id === slideId);
        if (!slide) return;

        const authorId = String(clientId || '').trim();
        const current = slide.canvas || {
            version: canvasCtrl?.fabric?.version || '5.3.0',
            objects: [],
        };
        const kept = (Array.isArray(current.objects) ? current.objects : [])
            .filter((obj) => String(obj?.tacticsAuthorId || '').trim() !== authorId);
        const incoming = (Array.isArray(payload.objects) ? payload.objects : []).map((obj) => ({
            ...obj,
            tacticsAuthorId: authorId,
        }));

        slidesCtrl.updateSlideCanvas(slideId, {
            ...current,
            coordSpace: payload.coordSpace || current.coordSpace,
            objects: kept.concat(incoming),
        });
    }

    function findRemoteCanvasObjectIndex(objects, payload) {
        if (!Array.isArray(objects) || !payload) return -1;
        const tacticsId = String(payload.tacticsId || '').trim();
        if (tacticsId) {
            const byId = objects.findIndex((obj) => String(obj?.tacticsId || '').trim() === tacticsId);
            if (byId >= 0) return byId;
        }
        return objects.findIndex((obj) => obj.type === payload.type
            && Math.round(obj.left) === Math.round(payload.left)
            && Math.round(obj.top) === Math.round(payload.top));
    }

    function mergeRemoteObjectIntoSlideCanvas(slideId, payload, mode) {
        if (!slidesCtrl || !slideId || !payload) return;
        const slide = slidesCtrl.getSlides().find((s) => s.id === slideId);
        if (!slide) return;

        const current = slide.canvas || {
            version: canvasCtrl?.fabric?.version || '5.3.0',
            objects: [],
        };
        const objects = Array.isArray(current.objects) ? [...current.objects] : [];

        if (mode === 'add') {
            const next = { ...payload };
            delete next.tacticsLiveStrokeId;
            objects.push(next);
        } else if (mode === 'modify') {
            const index = findRemoteCanvasObjectIndex(objects, payload);
            if (index >= 0) {
                objects[index] = { ...objects[index], ...payload };
            }
        } else if (mode === 'remove') {
            const index = findRemoteCanvasObjectIndex(objects, payload);
            if (index >= 0) {
                objects.splice(index, 1);
            }
        }

        slidesCtrl.updateSlideCanvas(slideId, {
            ...current,
            objects,
        });
    }

    async function applyRemoteCanvasOp(msg) {
        if (!canvasCtrl || !msg) return;

        const activeId = slidesCtrl?.getActiveSlideId();
        const msgSlideId = msg.slideId != null ? String(msg.slideId) : '';
        const activeIdStr = activeId != null ? String(activeId) : '';
        const canvasMutatingOps = ['full', 'clear', 'add', 'remove', 'modify', 'sync_own'];

        if (msg.op === 'full' && msg.payload && msgSlideId && msgSlideId !== activeIdStr) {
            slidesCtrl?.updateSlideCanvas(msgSlideId, msg.payload);
            if (canDraw) markDirty();
            return;
        }

        if (msg.op === 'clear' && msgSlideId && msgSlideId !== activeIdStr) {
            slidesCtrl?.updateSlideCanvas(msgSlideId, {
                version: canvasCtrl.fabric?.version || '5.3.0',
                objects: [],
            });
            if (canDraw) markDirty();
            return;
        }

        if (msg.op === 'sync_own' && msg.payload && msgSlideId && msgSlideId !== activeIdStr) {
            mergeRemoteOwnIntoSlideCanvas(msgSlideId, msg.from || msg.clientId || '', msg.payload);
            if (canDraw) markDirty();
            return;
        }

        if (msg.op === 'add' && msg.payload && msgSlideId && msgSlideId !== activeIdStr) {
            mergeRemoteObjectIntoSlideCanvas(msgSlideId, msg.payload, 'add');
            if (canDraw) markDirty();
            return;
        }

        if (msg.op === 'modify' && msg.payload && msgSlideId && msgSlideId !== activeIdStr) {
            mergeRemoteObjectIntoSlideCanvas(msgSlideId, msg.payload, 'modify');
            if (canDraw) markDirty();
            return;
        }

        if (msg.op === 'remove' && msg.payload && msgSlideId && msgSlideId !== activeIdStr) {
            mergeRemoteObjectIntoSlideCanvas(msgSlideId, msg.payload, 'remove');
            if (canDraw) markDirty();
            return;
        }

        await canvasCtrl.applyRemoteOp(msg);

        if (canvasMutatingOps.includes(msg.op) && msgSlideId === activeIdStr) {
            persistCanvasToSlide();
            if (canDraw) markDirty();
        }
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

            if (ev.eventType === 'ping' || ev.eventType === 'cell') {
                canvasCtrl?.applyRemoteOp({
                    op: ev.eventType,
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

        const isOwner = stored?.is_owner === true || window.ABS_TACTICS_IS_OWNER === true;
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
        const workspaceEl = document.getElementById('tacticsRoomWorkspace');
        const passwordEl = document.getElementById('tacticsPasswordGate');
        const layoutEl = document.querySelector('.tactics-room-layout');

        if (goneEl) {
            goneEl.hidden = false;
            document.body.classList.add('page-tactics-room-gone');
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

        if ((dirty || drawSettingsSaveInFlight) && !force) return;

        const activeId = slidesCtrl?.getActiveSlideId();
        const prevSlide = roomState.room_data?.slides?.find((s) => s.id === activeId);
        let mergedRoomData = preserveRealtimeCanvasRoomData(
            roomState.room_data,
            newData.room_data,
            activeId,
        );
        mergedRoomData = mergePendingDrawSettings(roomState.room_data, mergedRoomData);
        const nextSlide = mergedRoomData?.slides?.find((s) => s.id === activeId);

        roomState.room_data = mergedRoomData;
        roomState.revision = newRevision;
        if (newData.title) {
            roomState.title = newData.title;
            updateRoomTitle();
        }
        if (newData.visibility) {
            roomState.visibility = newData.visibility;
            syncVisibilityUi(roomState.visibility);
        }
        if (newData.has_password !== undefined) {
            roomState.has_password = !!newData.has_password;
            syncPasswordUi();
        }
        revision = newRevision;
        slidesCtrl?.setRoomData(roomState.room_data);
        syncServerPresentationSnapshot(getDrawSettings());
        applyDrawPermissions();

        if (nextSlide && canvasCtrl && !dirty) {
            const live = canvasCtrl.getCanvasState();
            const liveEmpty = !canvasStateHasObjects(live);
            const serverHas = canvasStateHasObjects(nextSlide.canvas);
            if (liveEmpty && serverHas) {
                await canvasCtrl.applyCanvasState(nextSlide.canvas);
            } else if (!liveEmpty) {
                persistCanvasToSlide();
            } else {
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
    }

    function getAssetVersion() {
        const script = document.querySelector('script[src*="/js/services/tactics/room.js"]');
        if (!script?.src) return '';
        const match = script.src.match(/[?&]v=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function loadStylesheet(href) {
        if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`stylesheet load failed: ${href}`));
            document.head.appendChild(link);
        });
    }

    function loadScript(src) {
        if (document.querySelector('script[src*="/js/vendor/fabric.min.js"]')) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`script load failed: ${src}`));
            document.head.appendChild(script);
        });
    }

    async function ensureEditorAssets() {
        if (window.fabric) return;
        if (editorAssetsPromise) {
            await editorAssetsPromise;
            return;
        }

        editorAssetsPromise = (async () => {
            const version = getAssetVersion();
            const qs = version ? `?v=${encodeURIComponent(version)}` : '';
            await loadStylesheet('https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css');
            await loadScript(`/js/vendor/fabric.min.js${qs}`);
            if (!window.fabric) {
                throw new Error('fabric.js failed to load');
            }
        })();

        await editorAssetsPromise;
    }

    function enterRoomShell() {
        document.body.classList.add('page-tactics-room-shell');
        document.body.classList.remove('page-tactics-room-locked');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    function isAuthPending() {
        return document.documentElement.classList.contains('tactics-auth-pending');
    }

    function showAuthGate() {
        document.documentElement.classList.add('tactics-auth-pending');
        document.getElementById('tacticsPasswordGate')?.setAttribute('hidden', '');
        document.getElementById('tacticsAuthGate')?.removeAttribute('hidden');
        enterRoomShell();
    }

    function showPasswordGate() {
        document.documentElement.classList.remove('tactics-auth-pending');
        document.getElementById('tacticsAuthGate')?.setAttribute('hidden', '');
        document.getElementById('tacticsPasswordGate')?.removeAttribute('hidden');
        document.body.classList.add('page-tactics-room-locked');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    function clearAuthGate() {
        document.documentElement.classList.remove('tactics-auth-pending');
        document.getElementById('tacticsAuthGate')?.setAttribute('hidden', '');
    }

    function revealWorkspace() {
        clearAuthGate();
        document.getElementById('tacticsPasswordGate')?.setAttribute('hidden', '');
        const workspace = document.getElementById('tacticsRoomWorkspace');
        workspace?.removeAttribute('hidden');
        workspace?.classList.add('is-booting');
        workspace?.classList.remove('is-ready');
        document.querySelector('.tactics-room-layout')?.classList.remove('tactics-room-layout--locked');
        enterRoomShell();
    }

    function markEditorReady() {
        const editor = document.getElementById('tacticsRoomWorkspace');
        if (!editor || editor.hasAttribute('hidden')) return;
        editor.classList.remove('is-booting');
        editor.classList.add('is-ready');
        applyResponsiveSidebars();
        updateMobileSlideNav();
        canvasCtrl?.scheduleResize?.();
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
        const visibilityWrap = document.getElementById('tacticsRoomVisibilityWrap');
        if (visibilityWrap) {
            visibilityWrap.hidden = !canManage;
        }
        const deleteBtn = document.getElementById('tacticsDeleteRoomBtn');
        if (deleteBtn) {
            deleteBtn.hidden = !canManage;
        }
        updatePresentBtn();
        updateCursorsLockBtn();
    }

    function getVisibilityFromUi() {
        const toggle = document.getElementById('tacticsRoomVisibilityToggle');
        return toggle?.checked ? 'closed' : 'open';
    }

    function isPasswordInputMasked(input) {
        return input?.dataset.passwordMasked === '1';
    }

    function setPasswordInputMasked(input, masked) {
        if (!input) return;
        if (masked) {
            input.dataset.passwordMasked = '1';
            input.value = PASSWORD_MASK;
            input.readOnly = true;
            input.classList.add('is-masked');
        } else {
            delete input.dataset.passwordMasked;
            input.readOnly = false;
            input.classList.remove('is-masked');
            if (input.value === PASSWORD_MASK) {
                input.value = '';
            }
        }
    }

    function syncPasswordUi() {
        const isClosed = getVisibilityFromUi() === 'closed';
        const hasPassword = !!roomState?.has_password;
        const saveBtn = document.getElementById('tacticsRoomPasswordSaveBtn');
        const passwordInput = document.getElementById('tacticsRoomSettingPassword');

        if (saveBtn) {
            saveBtn.hidden = !isClosed;
            saveBtn.tabIndex = isClosed ? 0 : -1;
            saveBtn.classList.toggle('is-saved', isClosed && hasPassword && isPasswordInputMasked(passwordInput));
        }
        if (passwordInput) {
            if (isClosed && hasPassword && !passwordInput.matches(':focus')) {
                setPasswordInputMasked(passwordInput, true);
            }
        }
    }

    function syncVisibilityUi(visibility) {
        const vis = visibility === 'closed' ? 'closed' : 'open';
        const isClosed = vis === 'closed';
        const toggle = document.getElementById('tacticsRoomVisibilityToggle');
        const lockBtn = document.getElementById('tacticsRoomVisibilityBtn');
        const lockIcon = document.getElementById('tacticsRoomVisibilityIcon');
        const passwordSlot = document.getElementById('tacticsRoomPasswordSlot');
        const passwordInput = document.getElementById('tacticsRoomSettingPassword');

        if (toggle) {
            toggle.checked = isClosed;
        }
        if (lockBtn) {
            lockBtn.classList.toggle('is-closed', isClosed);
            lockBtn.setAttribute('aria-pressed', isClosed ? 'true' : 'false');
            const labelKey = isClosed ? 'visibilityClosedShort' : 'visibilityOpenShort';
            lockBtn.title = i18n().t(labelKey);
            lockBtn.dataset.tacticsI18nTitle = labelKey;
        }
        if (lockIcon) {
            lockIcon.className = isClosed ? 'fas fa-lock' : 'fas fa-lock-open';
        }
        if (passwordSlot) {
            passwordSlot.classList.toggle('is-open', isClosed);
            passwordSlot.setAttribute('aria-hidden', isClosed ? 'false' : 'true');
        }
        if (passwordInput) {
            passwordInput.tabIndex = isClosed ? 0 : -1;
        }
        const saveBtn = document.getElementById('tacticsRoomPasswordSaveBtn');
        if (saveBtn) {
            saveBtn.tabIndex = isClosed ? 0 : -1;
        }
        syncPasswordUi();
    }

    function setVisibilityFromUi(visibility) {
        const toggle = document.getElementById('tacticsRoomVisibilityToggle');
        if (!toggle) return;
        const isClosed = visibility === 'closed';
        if (toggle.checked === isClosed) return;
        toggle.checked = isClosed;
        syncVisibilityUi(visibility);
        scheduleSettingsSave();
    }

    function bindRoomSettings() {
        const toggle = document.getElementById('tacticsRoomVisibilityToggle');
        const lockBtn = document.getElementById('tacticsRoomVisibilityBtn');
        if (!toggle || !lockBtn || lockBtn.dataset.bound) return;
        lockBtn.dataset.bound = '1';

        const passwordInput = document.getElementById('tacticsRoomSettingPassword');
        const saveBtn = document.getElementById('tacticsRoomPasswordSaveBtn');

        lockBtn.addEventListener('click', () => {
            setVisibilityFromUi(toggle.checked ? 'open' : 'closed');
        });

        saveBtn?.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
        });

        saveBtn?.addEventListener('click', () => {
            void saveRoomPassword();
        });

        passwordInput?.addEventListener('focus', () => {
            if (isPasswordInputMasked(passwordInput)) {
                setPasswordInputMasked(passwordInput, false);
                saveBtn?.classList.remove('is-saved');
            }
        });

        passwordInput?.addEventListener('input', () => {
            saveBtn?.classList.remove('is-saved');
        });

        passwordInput?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                void saveRoomPassword();
            }
        });

        passwordInput?.addEventListener('blur', () => {
            if (!roomState?.has_password || !passwordInput) return;
            window.setTimeout(() => {
                if (document.activeElement === passwordInput) return;
                setPasswordInputMasked(passwordInput, true);
                saveBtn?.classList.add('is-saved');
            }, 0);
        });
    }

    function bindDeleteRoomBtn() {
        const btn = document.getElementById('tacticsDeleteRoomBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => deleteRoom());
    }

    async function deleteRoom() {
        if (!canManage || !roomState || !accessToken) return;
        if (!(await tacticsConfirm(i18n().t('deleteRoomConfirm')))) return;

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

        await tacticsAlert(i18n().t('deleteRoomError'));
        startPollingFallback();
    }

    function scheduleSettingsSave() {
        if (!canManage) return;
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(saveRoomSettings, 800);
    }

    async function saveRoomPassword() {
        if (!canManage || !roomState || !accessToken || settingsSaving) return;
        if (getVisibilityFromUi() !== 'closed') return;

        const passwordInput = document.getElementById('tacticsRoomSettingPassword');
        const saveBtn = document.getElementById('tacticsRoomPasswordSaveBtn');
        if (isPasswordInputMasked(passwordInput)) return;

        const password = passwordInput?.value.trim() || '';
        const clearPassword = !password && !!roomState.has_password;
        if (!password && !roomState.has_password) return;

        settingsSaving = true;
        setSaveStatus('saving');

        const body = {
            public_id: roomState.public_id,
            revision,
            visibility: 'closed',
            access_token: accessToken,
        };
        if (password) {
            body.password = password;
        }
        if (clearPassword) {
            body.clear_password = true;
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
            if (res.data.data.has_password !== undefined) {
                roomState.has_password = !!res.data.data.has_password;
            } else if (clearPassword) {
                roomState.has_password = false;
            } else if (password) {
                roomState.has_password = true;
            }
            if (roomState.has_password) {
                setPasswordInputMasked(passwordInput, true);
                saveBtn?.classList.add('is-saved');
            } else {
                setPasswordInputMasked(passwordInput, false);
                saveBtn?.classList.remove('is-saved');
            }
            setSaveStatus('settingsSaved');
            setTimeout(() => setSaveStatus(wsConnected ? 'connected' : ''), 2000);
        } else {
            setSaveStatus('settingsError');
            if (res.status === 409) {
                await resyncRoom(true);
            }
        }
    }

    async function saveRoomSettings() {
        if (!canManage || !roomState || !accessToken || settingsSaving) return;

        const visibility = getVisibilityFromUi();
        const prevVisibility = roomState.visibility || 'open';
        if (visibility === prevVisibility) {
            return;
        }

        settingsSaving = true;
        setSaveStatus('saving');

        persistCanvasToSlide();

        const body = {
            public_id: roomState.public_id,
            room_data: prepareRoomDataForSave(roomState.room_data),
            revision,
            visibility,
            access_token: accessToken,
        };

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
            if (res.data.data.has_password !== undefined) {
                roomState.has_password = !!res.data.data.has_password;
            } else if (visibility === 'open') {
                roomState.has_password = false;
            }
            syncVisibilityUi(roomState.visibility);
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

    async function refreshSession(password, options = {}) {
        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
        const explicitPassword = typeof password === 'string' ? password.trim() : '';
        const requestedNickname = typeof options.nickname === 'string'
            ? options.nickname.trim()
            : '';

        const body = {
            public_id: window.ABS_TACTICS_PUBLIC_ID,
            nickname: requestedNickname || nickname,
            client_id: clientId,
            lang: i18n().getLang(),
        };
        if (options.nicknameChange) {
            body.nickname_change = true;
        }
        if (nicknameColor) {
            body.nick_color = nicknameColor;
        }
        if (explicitPassword) {
            body.password = explicitPassword;
        } else {
            const token = stored?.access_token || accessToken || '';
            if (token) {
                body.access_token = token;
            }
        }

        const joinToken = body.access_token || accessToken || null;
        const res = await store().postJson(window.ABS_TACTICS_JOIN_API, body, joinToken);
        if (isRoomGoneResponse(res)) {
            const fallback = buildBootstrapPayload(stored);
            if (fallback) return fallback;
            redirectRoomNotFound();
            return null;
        }
        if (!res.ok || !res.data?.success) {
            if (res.status === 403 && (explicitPassword || window.ABS_TACTICS_NEEDS_PASSWORD)) {
                accessToken = null;
                wsToken = null;
                saveRoomSessionSnapshot();
            }
            if (res.status === 404) {
                const fallback = buildBootstrapPayload(stored);
                if (fallback) return fallback;
            }
            lastJoinError = typeof res.data?.error === 'string' ? res.data.error : '';
            return null;
        }

        lastJoinError = '';

        const payload = res.data.data;
        accessToken = payload.access_token;
        wsToken = payload.ws_token;
        wsUrl = payload.ws_url;
        if (payload.nickname && (!nicknameLockedByUser || options.nicknameChange)) {
            nickname = payload.nickname;
        }
        if (payload.nick_color) {
            const resolvedColor = normalizeNickColor(payload.nick_color);
            if (resolvedColor) {
                nicknameColor = resolvedColor;
                saveNicknameColorLocal(resolvedColor);
            }
        }
        canManage = !!payload.can_manage;
        if (payload.room) {
            roomState = payload.room;
            revision = roomState.revision || revision;
            syncServerPresentationSnapshot(roomState.room_data?.settings);
        }
        canDraw = payload.can_draw !== undefined ? !!payload.can_draw : computeCanDraw();

        saveRoomSessionSnapshot();

        return payload;
    }

    async function applySession(payload) {
        applySessionTokens(payload);
        await ensureEditorAssets();
        revealWorkspace();
        updateSettingsPanel();
        syncVisibilityUi(roomState.visibility);
        saveRoomSessionSnapshot();
        if (!workspaceInitPromise) {
            workspaceInitPromise = initWorkspace();
        }
        await workspaceInitPromise;
        applyDrawPermissions();
        sanitizeStalePresentation();
    }

    function applySessionTokens(payload) {
        if (!payload) return;
        if (payload.access_token) {
            accessToken = payload.access_token;
        }
        if (payload.ws_token) {
            wsToken = payload.ws_token;
        }
        if (payload.ws_url) {
            wsUrl = payload.ws_url;
        }
        if (payload.nickname && !nicknameLockedByUser) {
            nickname = payload.nickname;
        }
        if (payload.nick_color) {
            const resolvedColor = normalizeNickColor(payload.nick_color);
            if (resolvedColor) {
                nicknameColor = resolvedColor;
                saveNicknameColorLocal(resolvedColor);
            }
        }
        if (payload.room) {
            roomState = payload.room;
            revision = roomState.revision || revision;
            syncServerPresentationSnapshot(roomState.room_data?.settings);
        }
        canManage = !!payload.can_manage;
        canDraw = payload.can_draw !== undefined ? !!payload.can_draw : computeCanDraw();
        window.ABS_TACTICS_MAP_URLS = buildMapUrls(
            roomState.room_data,
            payload.room?.map_urls || payload.map_urls,
        );
        maps().preloadMapUrls(Object.values(window.ABS_TACTICS_MAP_URLS));
    }

    async function mergeSessionUpdate(payload) {
        if (!payload) return;
        const previousRoomData = roomState?.room_data;
        applySessionTokens(payload);
        if (payload.room?.room_data && slidesCtrl) {
            const mergedRoomData = mergeLocalCanvasRoomData(
                previousRoomData,
                payload.room.room_data,
            );
            roomState.room_data = mergedRoomData;
            slidesCtrl.setRoomData(mergedRoomData);
            await applyServerCanvasForActiveSlide();
        }
        updateSettingsPanel();
        syncVisibilityUi(roomState?.visibility);
        saveRoomSessionSnapshot();
        applyDrawPermissions();
        syncViewerToPresentationSlide();
        sanitizeStalePresentation();
        if (!wsToken) return;
        if (wsClient) {
            wsClient.reconnectWithToken(wsToken);
            return;
        }
        if (slidesCtrl) {
            connectWebSocket();
        }
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
            restartNickColorPolling();
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
            nickColor: nicknameColor,
            wsUrl,
            onPresence: (list) => {
                applyPresenceList(list, false);
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
                    wsAuthFailures = 0;
                    wsConnected = true;
                    stopPresencePolling();
                    wsClient?.updateNickname(nickname);
                    restartNickColorPolling();
                    restartPolling();
                    setSaveStatus('connected');
                } else if (state === 'auth_failed') {
                    wsConnected = false;
                    wsAuthFailures += 1;
                    if (wsAuthFailures <= WS_AUTH_MAX_RETRIES) {
                        refreshWsSession();
                    } else {
                        restartPolling();
                        restartPresencePolling();
                        setSaveStatus('offline');
                    }
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
                    if (msg.action === 'switch') {
                        touchPresentationActivity(String(msg.from || ''));
                    }
                    return;
                }
                const activityOps = ['add', 'remove', 'modify', 'full', 'clear', 'ping', 'cell', 'stroke_start', 'stroke_point', 'stroke_end'];
                if (activityOps.includes(msg.op)) {
                    touchPresentationActivity(String(msg.from || ''));
                }
                await applyRemoteCanvasOp(msg);
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

    async function finishDeferredModules() {
        const roomGame = getRoomGame();
        if (window.TacticsMapPicker && !addMapPicker) {
            addMapPicker = new window.TacticsMapPicker({
                modalId: 'tacticsMapPickerModal',
                selectEl: document.getElementById('tacticsAddSlideMap'),
                lockGame: roomGame,
                onModalUpdate: () => syncMapModalCustomUploadUi(),
            });
            slidesCtrl?.setMapPicker?.(addMapPicker);
        }
        if (!chatCtrl && window.TacticsChat) {
            chatCtrl = new window.TacticsChat({
                publicId: roomPublicId(),
                clientId,
                getNickname: () => nickname,
                getWsToken: () => wsToken,
                onSendWs: (message) => wsClient?.sendChat(message),
            });
        }
    }

    async function initWorkspace() {
        try {
        const mapUrls = window.ABS_TACTICS_MAP_URLS || {};
        maps().preloadMapUrls(Object.values(mapUrls));
        void maps().loadMaps();

        const roomGame = getRoomGame();
        if (window.TacticsMapPicker) {
            addMapPicker = new window.TacticsMapPicker({
                modalId: 'tacticsMapPickerModal',
                selectEl: document.getElementById('tacticsAddSlideMap'),
                lockGame: roomGame,
                onModalUpdate: () => syncMapModalCustomUploadUi(),
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
            getCanvasSlideId: () => canvasCtrl?.slideId || null,
            getLiveCanvasState: () => canvasCtrl?.getCanvasState() || null,
            onSwitch: async (slideId, prevSlideId) => {
                if (prevSlideId && canvasCtrl?.slideId
                    && String(canvasCtrl.slideId) === String(prevSlideId)) {
                    saveSlideCursorPrefs(prevSlideId);
                    slidesCtrl.updateSlideCanvas(prevSlideId, canvasCtrl.getCanvasState());
                }
                const slide = slidesCtrl.getSlides().find((s) => s.id === slideId)
                    || slidesCtrl.getActiveSlide();
                if (slide) {
                    slidesCtrl.pinViewSlide(slide.id);
                    await canvasCtrl.loadSlide(slide, mapUrlForSlide(slide));
                    applySlideViewPrefs(slide);
                    await applyGameNicknameForSlide(slide);
                    if (dirty) scheduleSave();
                }
                if (isPresentationHost()) {
                    touchPresentationActivity();
                }
                updateMobileSlideNav();
            },
            onChange: () => markDirty(),
            onRenamed: () => updateMobileSlideNav(),
            onMapModalOpen: (slideId) => {
                syncCustomMapModalPreview(slideId);
            },
            onMapModalClose: () => {
                clearPendingCustomMap();
                customMapModalSlideId = null;
                syncMapModalCustomUploadUi();
            },
            onMapChange: async (slideId) => {
                const slide = slidesCtrl?.getActiveSlide();
                if (!slide || slide.id !== slideId) return;
                await canvasCtrl.loadSlide(slide, mapUrlForSlide(slide));
                await applyGameNicknameForSlide(slide);
                markDirty();
            },
            onBroadcast: (data) => {
                wsClient?.sendSlide(data.action, data);
                if (data.action === 'switch' && isPresentationHost()) {
                    touchPresentationActivity();
                }
            },
            shouldBroadcastSlideSwitch: () => isPresentationMode() && isPresentationHost(),
            shouldFollowRemoteSlideSwitch: () => isPresentationMode() && !isPresentationHost(),
            onDelete: () => markDirty(),
            onDuplicate: async (sourceSlide, copySlide) => {
                if (!sourceSlide || !copySlide) return;
                maps().normalizeCustomRoomSlide?.(copySlide);
                if (!maps().needsCustomMapFileCopy?.(
                    sourceSlide,
                    copySlide,
                    roomPublicId(),
                    slidesCtrl?.mapUrls || window.ABS_TACTICS_MAP_URLS || {}
                )) {
                    return;
                }
                await duplicateCustomMapFile(sourceSlide.id, copySlide.id);
            },
        });

        const slidesRender = slidesCtrl.render.bind(slidesCtrl);
        slidesCtrl.render = function renderSlidesWithMobileNav() {
            slidesRender();
            updateMobileSlideNav();
        };

        const activeSlideForView = slidesCtrl?.getActiveSlide()
            || roomState.room_data?.slides?.find((s) => s.id === roomState.room_data?.active_slide_id)
            || roomState.room_data?.slides?.[0];
        const initialCursorPrefs = activeSlideForView
            ? loadSlideCursorPrefs(activeSlideForView.id)
            : DEFAULT_SLIDE_VIEW_PREFS;
        const showGrid = activeSlideForView ? getSlideShowGrid(activeSlideForView) : true;

        canvasCtrl = new window.TacticsCanvas({
            canvasEl: document.getElementById('tacticsCanvas'),
            toolbar: document.getElementById('tacticsToolbar'),
            strokeColorEl: document.getElementById('tacticsStrokeColor'),
            strokeWidthEl: document.getElementById('tacticsStrokeWidth'),
            drawEnabled: canDraw,
            showGrid,
            cursorPrefsStorageKey: null,
            initialCursorPrefs: {
                showRemoteCursors: initialCursorPrefs.show_remote_cursors,
                shareMyCursor: initialCursorPrefs.share_my_cursor,
            },
            onCursorPrefsChange: () => {
                const id = slidesCtrl?.getActiveSlideId();
                if (id) saveSlideCursorPrefs(id);
            },
            clientId,
            onGridChange: (visible) => {
                if (!canDraw) return;
                pushGridChange(visible);
            },
            onChange: () => {
                if (canDraw) {
                    persistCanvasToSlide();
                    markDirty();
                }
            },
            onOp: (msg) => {
                if (isPresentationHost()) {
                    touchPresentationActivity();
                }
                if (msg.op === 'ping' || msg.op === 'cell') {
                    if (wsClient?.sendOp(msg.slideId, msg.op, msg.payload)) {
                        return;
                    }
                    postRealtimeEvent(msg.op, msg.slideId, msg.payload);
                    return;
                }
                const strokeOps = ['stroke_start', 'stroke_point', 'stroke_end'];
                if (strokeOps.includes(msg.op)) {
                    wsClient?.sendOp(msg.slideId, msg.op, msg.payload);
                    return;
                }
                const persistOps = ['add', 'remove', 'modify', 'full', 'clear', 'sync_own'];
                if (wsClient?.sendOp(msg.slideId, msg.op, msg.payload)) {
                    if (persistOps.includes(msg.op) && canDraw) {
                        markDirty(msg.op === 'modify');
                    }
                    return;
                }
                if (persistOps.includes(msg.op) && canDraw) {
                    markDirty(msg.op === 'modify');
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

        canvasCtrl.initFabric();

        bindRoomSettings();
        bindDeleteRoomBtn();
        bindCustomMapUpload();
        bindDrawLockBtn();
        bindCursorsLockBtn();
        bindPresentBtn();
        bindBackBtn();
        bindDownloadScreenshotBtn();
        bindEditorChrome();
        bindSidebarLayoutSync();
        bindRoomTitleEdit();
        updateSettingsPanel();
        syncVisibilityUi(roomState?.visibility);
        renderParticipants([{ clientId: String(clientId || ''), nickname: String(nickname || '') }]);

        const slideLoadPromise = (async () => {
            if (pendingSessionPromise) {
                try {
                    const sessionPayload = await pendingSessionPromise;
                    if (sessionPayload) {
                        await mergeSessionUpdate(sessionPayload);
                    }
                } catch (err) {
                    console.warn('[tactics] session refresh before slide load failed', err);
                }
            }
            syncViewerToPresentationSlide();
            const slide = slidesCtrl.getActiveSlide();
            syncMapModalCustomUploadUi();
            if (slide) {
                await canvasCtrl.loadSlide(slide, mapUrlForSlide(slide));
                await applyServerCanvasForActiveSlide();
                slidesCtrl.pinViewSlide(slide.id);
                applySlideViewPrefs(slide);
                updateRoomTitle();
                await canvasCtrl.ensureCanvasLayout?.();
                updateMobileSlideNav();
                canvasCtrl.scheduleResize?.();
                if (dirty) scheduleSave();
            }
        })();

        connectWebSocket();
        startPollingFallback();
        restartPresencePolling();
        restartNickColorPolling();

        if (!chatCtrl && window.TacticsChat) {
            chatCtrl = new window.TacticsChat({
                publicId: roomPublicId(),
                clientId,
                getNickname: () => nickname,
                getWsToken: () => wsToken,
                onSendWs: (message) => wsClient?.sendChat(message),
            });
        }

        void slideLoadPromise;
        } finally {
            markEditorReady();
        }
    }

    async function handlePasswordJoin(ev) {
        ev.preventDefault();
        showJoinError('');

        const form = ev.currentTarget;
        const submitBtn = form?.querySelector('.tactics-password-panel__enter');
        if (submitBtn?.disabled) return;

        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
        nickname = window.ABS_TACTICS_DEFAULT_NICK || 'Guest';
        if (stored?.nickname) {
            if (window.ABS_TACTICS_IS_LOGGED_IN && isGuestNickname(stored.nickname)) {
                nickname = window.ABS_TACTICS_DEFAULT_NICK || nickname;
            } else {
                nickname = stored.nickname;
            }
        }

        const passwordInput = document.getElementById('tacticsRoomPassword');
        const password = passwordInput?.value?.trim() || '';
        if (!password) {
            showJoinError(i18n().t('passwordRequired'));
            passwordInput?.focus();
            return;
        }

        if (submitBtn) submitBtn.disabled = true;

        accessToken = null;
        wsToken = null;
        saveRoomSessionSnapshot();
        showAuthGate();

        try {
            const payload = await refreshSession(password);
            if (!payload) {
                showPasswordGate();
                const serverError = lastJoinError || '';
                showJoinError(serverError || i18n().t('wrongPassword'));
                return;
            }
            await applySession(payload);
        } catch (err) {
            console.error('[tactics] password join failed', err);
            showPasswordGate();
            showJoinError(i18n().t('wrongPassword'));
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    async function init() {
        try {
        clientId = store().getClientId();
        nickname = window.ABS_TACTICS_DEFAULT_NICK || 'Guest';
        nicknameColor = loadNicknameColor();
        const stored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
        if (stored?.nickname) {
            if (window.ABS_TACTICS_IS_LOGGED_IN && isGuestNickname(stored.nickname)) {
                nickname = window.ABS_TACTICS_DEFAULT_NICK || nickname;
            } else {
                nickname = stored.nickname;
            }
        }
        if (stored?.nickname_locked || (stored?.nickname && !isGuestNickname(stored.nickname))) {
            nicknameLockedByUser = true;
        }
        if (!nicknameColor && stored?.nick_color) {
            nicknameColor = normalizeNickColor(stored.nick_color);
        }

        document.getElementById('tacticsRoomJoinForm')?.addEventListener('submit', handlePasswordJoin);

        if (window.ABS_TACTICS_NEEDS_PASSWORD) {
            accessToken = null;
            wsToken = null;
            const gateStored = store().loadRoomSession(window.ABS_TACTICS_PUBLIC_ID);
            if (gateStored?.access_token) {
                showAuthGate();
                const payload = await refreshSession('');
                if (payload) {
                    await applySession(payload);
                } else {
                    showPasswordGate();
                }
            } else {
                clearAuthGate();
            }
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

        pendingSessionPromise = refreshSession('');
        const sessionPromise = pendingSessionPromise;

        if (hasEmbeddedRoom()) {
            const bootstrap = buildBootstrapPayload(stored);
            if (bootstrap) {
                await applySession(bootstrap);
                try {
                    const sessionPayload = await pendingSessionPromise;
                    if (sessionPayload) {
                        await mergeSessionUpdate(sessionPayload);
                    }
                } catch (err) {
                    console.warn('[tactics] session refresh after bootstrap failed', err);
                }
                window.addEventListener('tactics:catalog-updated', () => {
                    addMapPicker?.relocalize();
                    const activeSlide = slidesCtrl?.getActiveSlide();
                    if (activeSlide && canvasCtrl) {
                        canvasCtrl.refreshMapScaleInfo(activeSlide);
                    }
                });
                return;
            }
        }

        let payload = await sessionPromise;
        if (!payload && hasEmbeddedRoom()) {
            payload = buildBootstrapPayload(stored);
        }
        if (payload) {
            await applySession(payload);
        } else if (!window.ABS_TACTICS_NEEDS_PASSWORD) {
            markEditorReady();
        }

        window.addEventListener('tactics:catalog-updated', () => {
            addMapPicker?.relocalize();
            const activeSlide = slidesCtrl?.getActiveSlide();
            if (activeSlide && canvasCtrl) {
                canvasCtrl.refreshMapScaleInfo(activeSlide);
            }
        });
        } catch (e) {
            markEditorReady();
        }
    }

    async function relocalizeView() {
        if (nicknameEditing) return;

        i18n().relocalizeDom(document.getElementById('tacticsAuthGate') || document);
        i18n().relocalizeDom(document.getElementById('tacticsPasswordGate') || document);
        i18n().relocalizeDom(document.getElementById('tacticsRoomWorkspace') || document);
        i18n().relocalizeDom(document.querySelector('.tactics-room-gone') || document);
        relocalizeCopyLinkBtn();
        resetCopyBtnSizeLock(document.getElementById('tacticsCopyLinkBtn'));
        requestAnimationFrame(() => ensureCopyBtnSizeLocked(document.getElementById('tacticsCopyLinkBtn')));
        slidesCtrl?.setLang(i18n().getLang());
        slidesCtrl?.relocalizeNames();
        updateRoomTitle();
        window.AbsTacticsToolSettings?.syncUi();
        updatePresentBtn();
        if (addMapPicker) {
            await addMapPicker.relocalize();
        }
        updateDrawLockBtn();
        canvasCtrl?.updateGridToggleBtn();
        canvasCtrl?.updateRemoteCursorsBtn();
        canvasCtrl?.updateShareCursorBtn();
        canvasCtrl?.updateMapScaleInfo();
        updateCursorsLockBtn();
        syncVisibilityUi(roomState?.visibility);
        renderParticipants(participantsList);
    }

    window.AbsTacticsRoom = {
        relocalizeView,
        ensureDeferredModules: finishDeferredModules,
        commitPendingCustomMap,
    };

    window.addEventListener('beforeunload', () => {
        if (dirty && roomState && accessToken) {
            flushCanvasToRoomData();
            const body = JSON.stringify({
                public_id: roomState.public_id,
                room_data: prepareRoomDataForSave(roomState.room_data),
                revision,
                access_token: accessToken,
                csrf_token: window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '',
            });
            const headers = {
                type: 'application/json',
                'X-CSRF-Token': window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '',
                'X-Tactics-Token': accessToken,
            };
            if (navigator.sendBeacon) {
                const blob = new Blob([body], headers);
                navigator.sendBeacon(window.ABS_TACTICS_UPDATE_API, blob);
            } else {
                void saveRoom();
            }
        }
        stopPresencePolling();
        wsClient?.disconnect();
    });

    function waitForFabric(cb) {
        if (window.fabric || window.ABS_TACTICS_NEEDS_PASSWORD) {
            cb();
            return;
        }
        let attempts = 0;
        const iv = setInterval(() => {
            attempts += 1;
            if (window.fabric) {
                clearInterval(iv);
                cb();
                return;
            }
            if (attempts >= 200) {
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
