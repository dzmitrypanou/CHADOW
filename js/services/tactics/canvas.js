(() => {
    'use strict';

    const maps = () => window.AbsTacticsMaps;

    class TacticsCanvas {
        constructor(options) {
            this.canvasEl = options.canvasEl;
            this.toolbar = options.toolbar;
            this.strokeColorEl = options.strokeColorEl;
            this.strokeWidthEl = options.strokeWidthEl;
            this.onChange = options.onChange || (() => {});
            this.onOp = options.onOp || (() => {});
            this.onCursorMove = options.onCursorMove || (() => {});
            this.clientId = options.clientId || '';
            this.slideId = null;
            this.mapCode = 'cliff';
            this.mapSideLength = null;
            this.fabric = null;
            this.tool = 'select';
            this.isRemote = false;
            this.history = [];
            this.historyIndex = -1;
            this.lineStart = null;
            this.linePreview = null;
            this.bgImageEl = null;
            this.resizeObserver = null;
            this.showGrid = options.showGrid !== false;
            this.drawEnabled = options.drawEnabled !== false;
            this.onGridChange = options.onGridChange || (() => {});
            const cursorPrefs = TacticsCanvas.loadCursorPrefs();
            this.showRemoteCursors = cursorPrefs.showRemoteCursors !== false;
            this.shareMyCursor = cursorPrefs.shareMyCursor !== false;
            this.shareMyCursorAllowed = true;
            this.getNickname = options.getNickname || (() => '');
            this.remoteCursors = new Map();
            this.cursorsLayerEl = null;
            this.pingsLayerEl = null;
            this.cursorSendTimer = null;
            this.cursorRaf = null;
            this.lastCursorPayload = null;
            this.pingHoldActive = false;
            this.pingHoldTimer = null;
            this.pingHoldPointer = null;
            this.rulerLayerEl = null;
            this.rulerDragStart = null;
            this.rulerDragActive = false;
            this.rulerMeasurement = null;
            this.remoteStrokesLayerEl = null;
            this.remoteStrokes = new Map();
            this.localStrokeId = null;
            this.localStrokePoints = [];
            this.strokeBroadcastTimer = null;
            this.shapeStart = null;
            this.shapePreview = null;
            this.polygonPoints = [];
            this.eyedropperActive = false;
            this.secondaryColorEl = options.secondaryColorEl || document.getElementById('tacticsStrokeColorSecondary');
            this.hueSliderEl = options.hueSliderEl || document.getElementById('tacticsHueSlider');
            this.imageUploadEl = options.imageUploadEl || document.getElementById('tacticsImageUpload');
            this.applyToolPrefs();
            this.bindToolbar();
            this.bindPalette();
        }

        static CURSOR_PREFS_KEY = 'abs_tactics_cursor_prefs';
        static TOOL_PREFS_KEY = 'abs_tactics_tool_prefs';
        static DEFAULT_STROKE_WIDTH = 6;
        static DEFAULT_STROKE_COLOR = '#ff4444';

        static loadCursorPrefs() {
            try {
                const raw = localStorage.getItem(TacticsCanvas.CURSOR_PREFS_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        saveCursorPrefs() {
            localStorage.setItem(TacticsCanvas.CURSOR_PREFS_KEY, JSON.stringify({
                showRemoteCursors: this.showRemoteCursors,
                shareMyCursor: this.shareMyCursor,
            }));
        }

        static loadToolPrefs() {
            try {
                const raw = localStorage.getItem(TacticsCanvas.TOOL_PREFS_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        saveToolPrefs() {
            localStorage.setItem(TacticsCanvas.TOOL_PREFS_KEY, JSON.stringify({
                strokeColor: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
            }));
        }

        applyToolPrefs() {
            const prefs = TacticsCanvas.loadToolPrefs();
            if (this.strokeColorEl) {
                const color = String(prefs.strokeColor || TacticsCanvas.DEFAULT_STROKE_COLOR).trim();
                if (/^#[0-9a-fA-F]{6}$/.test(color)) {
                    this.strokeColorEl.value = color;
                }
            }
            if (this.strokeWidthEl) {
                const width = parseInt(prefs.strokeWidth, 10);
                const clamped = Number.isFinite(width)
                    ? Math.max(2, Math.min(16, width))
                    : TacticsCanvas.DEFAULT_STROKE_WIDTH;
                this.strokeWidthEl.value = String(clamped);
            }
        }

        static CURSOR_COLORS = [
            '#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#fb923c',
            '#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#818cf8',
        ];

        static eraserCursorSvg() {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
                + '<path d="M8.5 19.5 3.5 14.5 14.5 3.5 19.5 8.5 8.5 19.5z" fill="#ffffff" stroke="#1a1a1a" stroke-width="1"/>'
                + '<path d="M11.5 16.5 4.5 23.5" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round"/>'
                + '</svg>';
        }

        static eraserTargetCursorSvg() {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
                + '<path d="M6 7h12l-1 12H7L6 7z" fill="#ffffff" stroke="#1a1a1a" stroke-width="1"/>'
                + '<path d="M9 7V5h6v2M4 7h16" fill="none" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round"/>'
                + '</svg>';
        }

        static cursorFromSvg(svg, hotspotX, hotspotY, fallback) {
            return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`;
        }

        static getEraserCursor() {
            return TacticsCanvas.cursorFromSvg(
                TacticsCanvas.eraserCursorSvg(),
                5,
                22,
                'crosshair',
            );
        }

        static getEraserTargetCursor() {
            return TacticsCanvas.cursorFromSvg(
                TacticsCanvas.eraserTargetCursorSvg(),
                12,
                6,
                'pointer',
            );
        }

        initFabric() {
            if (this.fabric || !window.fabric || !this.canvasEl) return;
            this.fabric = new fabric.Canvas(this.canvasEl, {
                selection: true,
                preserveObjectStacking: true,
            });
            this.scheduleResize();
            const observeTargets = [
                this.canvasEl.closest('.tactics-map-column'),
                this.canvasEl.closest('.tactics-canvas-panel'),
                this.canvasEl.closest('.tactics-canvas-row'),
            ].filter(Boolean);
            if (typeof ResizeObserver !== 'undefined' && observeTargets.length) {
                this.resizeObserver = new ResizeObserver(() => this.resize());
                observeTargets.forEach((el) => this.resizeObserver.observe(el));
            } else {
                window.addEventListener('resize', () => this.resize());
            }

            this.fabric.on('object:added', (e) => this.handleLocalChange('add', e));
            this.fabric.on('object:modified', (e) => this.handleLocalChange('modify', e));
            this.fabric.on('object:removed', (e) => this.handleLocalChange('remove', e));

            this.fabric.on('mouse:down', (opt) => this.handleMouseDown(opt));
            this.fabric.on('mouse:move', (opt) => this.handleMouseMove(opt));
            this.fabric.on('mouse:up', (opt) => this.handleMouseUp(opt));
            this.fabric.on('object:moving', (e) => this.guardObjectTransform(e));
            this.fabric.on('object:scaling', (e) => this.guardObjectTransform(e));
            this.fabric.on('object:rotating', (e) => this.guardObjectTransform(e));
            this.fabric.on('path:created', (e) => {
                if (this.tool === 'pen' && this.fabric) {
                    this.fabric.discardActiveObject();
                    this.syncInteractionState();
                    this.fabric.requestRenderAll();
                }
                if (this.tool === 'pen') {
                    this.finishLocalStrokeBroadcast();
                }
            });

            this.ensureCursorsLayer();
            this.ensurePingsLayer();
            this.ensureRemoteStrokesLayer();
            this.ensureRulerLayer();
            this.bindCursorTracking();
            this.bindPingHoldRelease();
            this.fabric.on('mouse:move', (opt) => {
                this.handleFabricPointerMove(opt);
                if (this.localStrokeId && this.tool === 'pen' && this.fabric?.isDrawingMode) {
                    const pointer = this.fabric.getPointer(opt.e);
                    this.queueStrokePointBroadcast(pointer);
                }
            });
            this.fabric.on('mouse:out', () => {
                this.queueCursorSend(0, 0, false);
                this.stopPingHold();
                this.stopRulerDrag();
            });

            this.setTool('select');
            this.updateGridToggleBtn();
            this.updateRemoteCursorsBtn();
            this.updateShareCursorBtn();
        }

        ensureCursorsLayer() {
            const root = this.getOverlaysEl();
            if (!root) return;
            if (!this.cursorsLayerEl) {
                const layer = document.createElement('div');
                layer.className = 'tactics-cursors-layer';
                layer.setAttribute('aria-hidden', 'true');
                this.cursorsLayerEl = layer;
            }
            root.appendChild(this.cursorsLayerEl);
        }

        ensurePingsLayer() {
            const root = this.getOverlaysEl();
            if (!root) return;
            if (!this.pingsLayerEl) {
                const layer = document.createElement('div');
                layer.className = 'tactics-pings-layer';
                layer.setAttribute('aria-hidden', 'true');
                this.pingsLayerEl = layer;
            }
            root.appendChild(this.pingsLayerEl);
        }

        clearPings() {
            if (this.pingsLayerEl) {
                this.pingsLayerEl.innerHTML = '';
            }
        }

        ensureRulerLayer() {
            const root = this.getOverlaysEl();
            if (!root) return;
            if (!this.rulerLayerEl) {
                const layer = document.createElement('div');
                layer.className = 'tactics-ruler-layer';
                layer.setAttribute('aria-hidden', 'true');
                this.rulerLayerEl = layer;
            }
            root.appendChild(this.rulerLayerEl);
        }

        clearRuler() {
            this.stopRulerDrag();
            this.rulerMeasurement = null;
            if (this.rulerLayerEl) {
                this.rulerLayerEl.innerHTML = '';
            }
        }

        refreshRulerOverlay() {
            if (this.rulerMeasurement) {
                const m = this.rulerMeasurement;
                this.updateRulerDisplay(m.x1, m.y1, m.x2, m.y2);
            }
        }

        stopRulerDrag() {
            this.rulerDragActive = false;
            this.rulerDragStart = null;
        }

        canvasPointToOverlay(x, y) {
            const canvasSize = this.fabric?.getWidth() || 0;
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (canvasSize <= 0 || overlayW <= 0 || overlayH <= 0) {
                return { x: 0, y: 0 };
            }
            return {
                x: (x / canvasSize) * overlayW,
                y: (y / canvasSize) * overlayH,
            };
        }

        formatRulerDistance(meters) {
            if (meters == null || !Number.isFinite(meters)) {
                const i18n = window.AbsTacticsI18n;
                return i18n ? i18n.t('rulerNoSize') : '—';
            }
            if (meters >= 1000) {
                return `${(meters / 1000).toFixed(2)} km`;
            }
            return `${Math.round(meters)} m`;
        }

        updateMapScaleInfo() {
            const el = document.getElementById('tacticsMapScale');
            if (!el) return;
            const i18n = window.AbsTacticsI18n;
            const len = this.mapSideLength;
            if (len && len > 0) {
                const size = String(len);
                const template = i18n ? i18n.t('mapScale') : 'Масштаб карты: {size}×{size} м';
                el.textContent = template.replace(/\{size\}/g, size);
                el.hidden = false;
            } else {
                el.textContent = '';
                el.hidden = true;
            }
        }

        async refreshMapScaleInfo(slide) {
            if (!slide) {
                this.mapSideLength = null;
                this.updateMapScaleInfo();
                return;
            }
            this.mapSideLength = await maps().slideSideLength(slide);
            this.updateMapScaleInfo();
        }

        computeRulerDistanceMeters(x1, y1, x2, y2) {
            const canvasSize = this.fabric?.getWidth() || 0;
            if (canvasSize <= 0 || !this.mapSideLength) return null;
            const pixelDist = Math.hypot(x2 - x1, y2 - y1);
            return (pixelDist / canvasSize) * this.mapSideLength;
        }

        updateRulerDisplay(x1, y1, x2, y2) {
            this.ensureRulerLayer();
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (!this.rulerLayerEl || overlayW <= 0 || overlayH <= 0) return;

            const start = this.canvasPointToOverlay(x1, y1);
            const end = this.canvasPointToOverlay(x2, y2);
            const meters = this.computeRulerDistanceMeters(x1, y1, x2, y2);
            const label = this.formatRulerDistance(meters);
            const color = this.getStrokeColor();
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const capR = 4;

            this.rulerLayerEl.innerHTML = `
                <svg class="tactics-ruler-svg" viewBox="0 0 ${overlayW} ${overlayH}" aria-hidden="true">
                    <line class="tactics-ruler-line" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${color}"/>
                    <circle class="tactics-ruler-cap" cx="${start.x}" cy="${start.y}" r="${capR}" fill="${color}"/>
                    <circle class="tactics-ruler-cap" cx="${end.x}" cy="${end.y}" r="${capR}" fill="${color}"/>
                </svg>
                <div class="tactics-ruler-label" style="left:${midX}px;top:${midY}px;">${label}</div>
            `;
        }

        static PING_HOLD_MS = 100;

        pingSizePx(width) {
            const strokeWidth = Math.max(2, Math.min(16, Number(width) || TacticsCanvas.DEFAULT_STROKE_WIDTH));
            return Math.round(strokeWidth * 10);
        }

        playPing(nx, ny, color, width) {
            this.ensurePingsLayer();
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (!this.pingsLayerEl || overlayW <= 0 || overlayH <= 0) return;

            const x = Math.max(0, Math.min(1, Number(nx) || 0));
            const y = Math.max(0, Math.min(1, Number(ny) || 0));
            const pingColor = String(color || '#ff4444');
            const sizePx = this.pingSizePx(width);

            const ping = document.createElement('div');
            ping.className = 'tactics-ping';
            ping.style.setProperty('--ping-color', pingColor);
            ping.style.setProperty('--ping-size', `${sizePx}px`);
            ping.style.transform = `translate(${Math.round(x * overlayW)}px, ${Math.round(y * overlayH)}px)`;

            ['', ' tactics-ping__ring--delay-1', ' tactics-ping__ring--delay-2'].forEach((delayClass) => {
                const ring = document.createElement('span');
                ring.className = `tactics-ping__ring${delayClass}`;
                ping.appendChild(ring);
            });

            const tick = document.createElement('span');
            tick.className = 'tactics-ping__tick';
            ['n', 's', 'e', 'w'].forEach((dir) => {
                const line = document.createElement('span');
                line.className = `tactics-ping__tick-line tactics-ping__tick-line--${dir}`;
                tick.appendChild(line);
            });
            ping.appendChild(tick);

            this.pingsLayerEl.appendChild(ping);
            requestAnimationFrame(() => {
                ping.classList.add('is-animate');
            });
            setTimeout(() => ping.remove(), 1000);
        }

        firePingAtPointer(pointer) {
            if (!this.fabric || !pointer) return;
            const w = this.fabric.getWidth();
            const h = this.fabric.getHeight();
            if (w <= 0 || h <= 0) return;
            const payload = {
                x: pointer.x / w,
                y: pointer.y / h,
                color: this.getStrokeColor(),
                width: this.getStrokeWidth(),
            };
            this.playPing(payload.x, payload.y, payload.color, payload.width);
            if (this.slideId) {
                this.onOp({
                    op: 'ping',
                    slideId: this.slideId,
                    payload,
                });
            }
        }

        startPingHold(pointer) {
            this.stopPingHold();
            this.pingHoldActive = true;
            this.pingHoldPointer = pointer;
            this.firePingAtPointer(pointer);
            this.pingHoldTimer = setInterval(() => {
                if (!this.pingHoldActive || this.tool !== 'ping' || !this.pingHoldPointer) {
                    this.stopPingHold();
                    return;
                }
                this.firePingAtPointer(this.pingHoldPointer);
            }, TacticsCanvas.PING_HOLD_MS);
        }

        stopPingHold() {
            this.pingHoldActive = false;
            this.pingHoldPointer = null;
            if (this.pingHoldTimer) {
                clearInterval(this.pingHoldTimer);
                this.pingHoldTimer = null;
            }
        }

        bindPingHoldRelease() {
            if (this.pingHoldReleaseBound) return;
            this.pingHoldReleaseBound = true;
            window.addEventListener('mouseup', () => this.stopPingHold());
        }

        bindCursorTracking() {
            const wrap = this.getStackEl() || this.getWrapEl();
            if (!wrap || wrap.dataset.cursorBound) return;
            wrap.dataset.cursorBound = '1';

            wrap.addEventListener('mousemove', (ev) => {
                if (!this.fabric || !this.slideId) return;
                const bounds = this.fabric.upperCanvasEl?.getBoundingClientRect()
                    || this.canvasEl?.getBoundingClientRect();
                if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
                const x = (ev.clientX - bounds.left) / bounds.width;
                const y = (ev.clientY - bounds.top) / bounds.height;
                if (x < 0 || x > 1 || y < 0 || y > 1) return;
                this.queueCursorSend(x, y, true);
            });

            wrap.addEventListener('mouseleave', () => {
                this.queueCursorSend(0, 0, false);
            });
        }

        handleFabricPointerMove(opt) {
            if (!this.fabric) return;
            this.updateEraserCursor(opt);
            if (this.pingHoldActive && this.tool === 'ping' && opt?.e) {
                this.pingHoldPointer = this.fabric.getPointer(opt.e);
            }
            if (!this.slideId) return;
            const pointer = this.fabric.getPointer(opt.e);
            const w = this.fabric.getWidth();
            const h = this.fabric.getHeight();
            if (w <= 0 || h <= 0) return;
            this.queueCursorSend(pointer.x / w, pointer.y / h, true);
        }

        updateEraserCursor(opt) {
            const upper = this.fabric?.upperCanvasEl;
            if (!upper || !this.drawEnabled || this.tool !== 'eraser') return;

            let overDrawing = false;
            if (opt?.e) {
                const target = this.fabric.findTarget(opt.e, false);
                overDrawing = !!(target && !target.isBackground && !target.isGridLine && !this.isPreviewObject(target));
            }

            upper.style.cursor = overDrawing
                ? TacticsCanvas.getEraserTargetCursor()
                : TacticsCanvas.getEraserCursor();
        }

        queueCursorSend(x, y, visible) {
            if (!this.slideId) return;

            const broadcastVisible = !!visible && this.shareMyCursor && this.shareMyCursorAllowed;
            const payload = {
                slideId: this.slideId,
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
                visible: broadcastVisible,
                nickname: String(this.getNickname() || '').trim(),
            };
            const key = `${payload.slideId}:${payload.x.toFixed(4)}:${payload.y.toFixed(4)}:${payload.visible}:${payload.nickname}`;
            const hideNow = !broadcastVisible;

            if (!hideNow && key === this.lastCursorPayload) return;
            this.lastCursorPayload = key;

            clearTimeout(this.cursorSendTimer);
            this.cursorSendTimer = null;
            if (this.cursorRaf) {
                cancelAnimationFrame(this.cursorRaf);
                this.cursorRaf = null;
            }

            const send = () => {
                this.cursorRaf = null;
                this.onCursorMove(payload);
            };

            if (hideNow) {
                send();
                return;
            }

            this.cursorRaf = requestAnimationFrame(send);
        }

        cursorColorForClient(clientId) {
            let hash = 0;
            const id = String(clientId || '');
            for (let i = 0; i < id.length; i += 1) {
                hash = ((hash << 5) - hash) + id.charCodeAt(i);
                hash |= 0;
            }
            const colors = TacticsCanvas.CURSOR_COLORS;
            return colors[Math.abs(hash) % colors.length];
        }

        setShowRemoteCursors(visible) {
            this.showRemoteCursors = !!visible;
            if (!this.showRemoteCursors && this.cursorsLayerEl) {
                this.cursorsLayerEl.innerHTML = '';
                this.remoteCursors.clear();
            } else {
                this.remoteCursors.forEach((entry) => {
                    if (entry.el) entry.el.hidden = false;
                });
            }
            this.saveCursorPrefs();
            this.updateRemoteCursorsBtn();
        }

        toggleRemoteCursors() {
            this.setShowRemoteCursors(!this.showRemoteCursors);
        }

        setShareMyCursor(share) {
            if (!this.shareMyCursorAllowed) {
                share = false;
            }
            this.shareMyCursor = !!share;
            this.lastCursorPayload = null;
            if (!this.shareMyCursor) {
                this.onCursorMove({
                    slideId: this.slideId,
                    x: 0,
                    y: 0,
                    visible: false,
                    nickname: String(this.getNickname() || '').trim(),
                });
            }
            this.saveCursorPrefs();
            this.updateShareCursorBtn();
        }

        setShareMyCursorAllowed(allowed) {
            const next = !!allowed;
            if (this.shareMyCursorAllowed === next) return;
            this.shareMyCursorAllowed = next;
            this.lastCursorPayload = null;
            if (!next) {
                if (this.shareMyCursor) {
                    this.shareMyCursor = false;
                    this.saveCursorPrefs();
                }
                this.updateShareCursorBtn();
                this.onCursorMove({
                    slideId: this.slideId,
                    x: 0,
                    y: 0,
                    visible: false,
                    nickname: String(this.getNickname() || '').trim(),
                });
            }
        }

        toggleShareMyCursor() {
            if (!this.shareMyCursorAllowed) return;
            this.setShareMyCursor(!this.shareMyCursor);
        }

        updateRemoteCursorsBtn() {
            const btn = document.getElementById('tacticsRemoteCursorsBtn');
            if (!btn) return;
            const i18n = window.AbsTacticsI18n;
            btn.classList.toggle('is-active', this.showRemoteCursors);
            btn.title = i18n
                ? i18n.t(this.showRemoteCursors ? 'remoteCursorsOn' : 'remoteCursorsOff')
                : (this.showRemoteCursors ? 'Show peer cursors' : 'Hide peer cursors');
        }

        updateShareCursorBtn() {
            const btn = document.getElementById('tacticsShareCursorBtn');
            if (!btn) return;
            const i18n = window.AbsTacticsI18n;
            const icon = btn.querySelector('i');
            const active = this.shareMyCursorAllowed && this.shareMyCursor;
            btn.classList.toggle('is-active', active);
            btn.disabled = !this.shareMyCursorAllowed;
            btn.classList.toggle('is-disabled', !this.shareMyCursorAllowed);
            if (icon) {
                icon.className = active
                    ? 'fas fa-eye'
                    : 'fas fa-eye-slash';
            }
            btn.title = !this.shareMyCursorAllowed
                ? (i18n ? i18n.t('shareCursorDisabled') : 'Cursor sharing disabled in this room')
                : (i18n
                    ? i18n.t(this.shareMyCursor ? 'shareCursorOn' : 'shareCursorOff')
                    : (this.shareMyCursor ? 'Share my cursor' : 'Hide my cursor from others'));
        }

        removeRemoteCursor(clientId) {
            const entry = this.remoteCursors.get(clientId);
            if (!entry) return;
            entry.el?.remove();
            this.remoteCursors.delete(clientId);
        }

        syncRemoteCursorsPresence(participants) {
            const list = Array.isArray(participants) ? participants : [];
            const selfId = String(this.clientId || '');
            const active = new Set(
                list
                    .map((p) => String(p.clientId || '').trim())
                    .filter((id) => id && id !== selfId),
            );
            this.remoteCursors.forEach((_entry, remoteId) => {
                const id = String(remoteId || '');
                if (id && !active.has(id)) {
                    this.removeRemoteCursor(id);
                }
            });
            list.forEach((p) => {
                const clientId = String(p.clientId || '').trim();
                if (!clientId || clientId === selfId) return;
                const entry = this.remoteCursors.get(clientId);
                if (!entry) return;
                const nick = String(p.nickname || '').trim();
                if (nick) {
                    entry.nickname = nick;
                    entry.labelEl.textContent = nick;
                }
            });
        }

        applyRemoteCursor(msg) {
            if (!msg || !this.showRemoteCursors) return;
            this.ensureCursorsLayer();
            if (!this.cursorsLayerEl) return;

            const clientId = String(msg.from || '');
            if (!clientId || String(clientId) === String(this.clientId)) return;

            const msgSlideId = msg.slideId != null ? String(msg.slideId) : '';
            const activeSlideId = this.slideId != null ? String(this.slideId) : '';
            if (msgSlideId && activeSlideId && msgSlideId !== activeSlideId) {
                this.removeRemoteCursor(clientId);
                return;
            }

            if (!msg.visible) {
                this.removeRemoteCursor(clientId);
                return;
            }

            let entry = this.remoteCursors.get(clientId);
            if (!entry) {
                const el = document.createElement('div');
                el.className = 'tactics-remote-cursor';
                const pointer = document.createElement('span');
                pointer.className = 'tactics-remote-cursor__pointer';
                const label = document.createElement('span');
                label.className = 'tactics-remote-cursor__label';
                el.appendChild(pointer);
                el.appendChild(label);
                this.cursorsLayerEl.appendChild(el);
                const color = this.cursorColorForClient(clientId);
                pointer.style.color = color;
                pointer.style.borderBottomColor = color;
                label.style.background = color;
                entry = { el, labelEl: label, x: 0, y: 0, nickname: '' };
                this.remoteCursors.set(clientId, entry);
            }

            entry.x = Math.max(0, Math.min(1, Number(msg.x) || 0));
            entry.y = Math.max(0, Math.min(1, Number(msg.y) || 0));
            const nick = String(msg.nickname || entry.nickname || '').trim();
            if (nick) {
                entry.nickname = nick;
            }
            entry.labelEl.textContent = entry.nickname || '?';
            this.positionRemoteCursor(entry);
        }

        hideRemoteCursor(clientId) {
            this.removeRemoteCursor(String(clientId || ''));
        }

        positionRemoteCursor(entry) {
            if (!entry?.el) return;
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (overlayW <= 0 || overlayH <= 0) return;
            entry.el.style.transform = `translate3d(${Math.round(entry.x * overlayW)}px, ${Math.round(entry.y * overlayH)}px, 0)`;
        }

        repositionRemoteCursors() {
            this.remoteCursors.forEach((entry) => this.positionRemoteCursor(entry));
        }

        guardObjectTransform(e) {
            const target = e?.target;
            if (!target) return;
            if (target.isBackground) {
                this.resetBackgroundPosition(target);
                return;
            }
            if (this.canMoveObjects() || this.isPreviewObject(target)) return;

            const original = e.transform?.original;
            if (!original) return;

            target.set({
                left: original.left,
                top: original.top,
                scaleX: original.scaleX,
                scaleY: original.scaleY,
                angle: original.angle,
            });
            target.setCoords();
            this.fabric?.requestRenderAll();
        }

        canMoveObjects() {
            return this.drawEnabled && this.tool === 'select';
        }

        static LABEL_LEFT = 28;
        static LABEL_TOP = 24;
        static LABEL_GAP = 4;

        getWrapEl() {
            return this.canvasEl?.closest('.tactics-canvas-wrap') || this.canvasEl?.parentElement;
        }

        getStackEl() {
            return this.canvasEl?.closest('.tactics-map-canvas-stack') || this.getWrapEl();
        }

        getOverlaysEl() {
            return document.getElementById('tacticsCanvasOverlays') || this.getStackEl();
        }

        getOverlaySize() {
            const stack = this.getStackEl();
            if (stack) {
                return {
                    width: stack.clientWidth,
                    height: stack.clientHeight,
                };
            }
            const wrap = this.getWrapEl();
            return {
                width: wrap?.clientWidth || 0,
                height: wrap?.clientHeight || 0,
            };
        }

        getMapGridEl() {
            return this.canvasEl?.closest('.tactics-map-grid');
        }

        getSquareSize() {
            const mapColumn = this.canvasEl?.closest('.tactics-map-column')
                || this.canvasEl?.closest('.tactics-canvas-panel');
            if (!mapColumn) return 640;

            const columnRect = mapColumn.getBoundingClientRect();
            let measureWidth = columnRect?.width || 0;
            if (measureWidth <= 0) return null;

            const labelsW = TacticsCanvas.LABEL_LEFT + TacticsCanvas.LABEL_GAP;
            const size = Math.floor(measureWidth - labelsW);
            return Math.max(300, size);
        }

        scheduleResize() {
            if (!this.fabric) return;
            this.resize();
            requestAnimationFrame(() => {
                this.resize();
                requestAnimationFrame(() => this.resize());
            });
        }

        syncFabricContainer(size) {
            const wrap = this.getWrapEl();
            const stack = this.getStackEl();
            const grid = this.getMapGridEl();
            const container = this.fabric?.wrapperEl || this.canvasEl?.parentElement;
            if (!container) return;

            container.style.width = size + 'px';
            container.style.height = size + 'px';

            if (wrap) {
                wrap.style.width = size + 'px';
                wrap.style.height = size + 'px';
            }

            if (stack) {
                stack.style.width = size + 'px';
                stack.style.height = size + 'px';
            }

            if (grid) {
                grid.style.width = (TacticsCanvas.LABEL_LEFT + TacticsCanvas.LABEL_GAP + size) + 'px';
                grid.style.height = (TacticsCanvas.LABEL_TOP + TacticsCanvas.LABEL_GAP + size) + 'px';
            }
        }

        resize() {
            if (!this.fabric) return;
            const size = this.getSquareSize();
            if (!size) return;
            this.fabric.setWidth(size);
            this.fabric.setHeight(size);
            this.syncFabricContainer(size);
            this.fitBackground();
            this.syncGridOverlay();
            this.ensureCursorsLayer();
            this.ensurePingsLayer();
            this.ensureRulerLayer();
            this.repositionRemoteCursors();
            this.refreshRulerOverlay();
            this.fabric.renderAll();
        }

        removeGridLines() {
            if (!this.fabric) return;
            this.fabric.getObjects().filter((o) => o.isGridLine).forEach((o) => {
                this.fabric.remove(o);
            });
        }

        syncGridOverlay() {
            if (!this.fabric) return;
            this.removeGridLines();
            if (!this.showGrid) {
                this.fabric.renderAll();
                return;
            }

            const size = this.fabric.getWidth();
            const step = size / 10;
            const stroke = 'rgba(100, 140, 175, 0.42)';
            const newLines = [];

            for (let i = 1; i < 10; i += 1) {
                const p = Math.round(step * i) + 0.5;
                newLines.push(new fabric.Line([p, 0, p, size], {
                    stroke,
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,
                }));
                newLines.push(new fabric.Line([0, p, size, p], {
                    stroke,
                    strokeWidth: 1,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,
                }));
            }

            newLines.forEach((line) => {
                line.isGridLine = true;
                this.isRemote = true;
                this.fabric.add(line);
                this.isRemote = false;
            });
            this.consolidateLayerOrder();
            this.fabric.renderAll();
        }

        placeGridAboveMap() {
            if (!this.fabric || !this.showGrid) return;

            const objects = this.fabric.getObjects();
            const bg = objects.find((o) => o.isBackground);
            let targetIndex = bg ? objects.indexOf(bg) + 1 : 0;

            objects.filter((o) => o.isGridLine).forEach((line) => {
                this.fabric.moveTo(line, targetIndex);
                targetIndex += 1;
            });
        }

        consolidateLayerOrder() {
            if (!this.fabric) return;

            const backgrounds = this.fabric.getObjects().filter((o) => o.isBackground);
            if (backgrounds.length > 1) {
                backgrounds.slice(1).forEach((bg) => {
                    this.fabric.remove(bg);
                });
            }

            const bg = this.fabric.getObjects().find((o) => o.isBackground);
            if (bg) {
                this.fabric.sendToBack(bg);
            }
            this.placeGridAboveMap();
        }

        setShowGrid(visible) {
            this.showGrid = !!visible;
            this.syncGridOverlay();
            this.updateGridToggleBtn();
        }

        toggleGrid() {
            this.setShowGrid(!this.showGrid);
            this.onGridChange(this.showGrid);
        }

        updateGridToggleBtn() {
            const btn = document.getElementById('tacticsGridToggleBtn');
            if (!btn) return;
            const i18n = window.AbsTacticsI18n;
            btn.classList.toggle('is-active', this.showGrid);
            btn.title = i18n
                ? i18n.t(this.showGrid ? 'gridOn' : 'gridOff')
                : (this.showGrid ? 'Grid on' : 'Grid off');
        }

        fitBackground() {
            if (!this.fabric || !this.bgImageEl) return;

            this.fabric.getObjects().filter((o) => o.isBackground).forEach((o) => {
                this.fabric.remove(o);
            });

            const size = this.fabric.getWidth();
            const img = this.bgImageEl;
            const scale = Math.max(size / img.width, size / img.height);

            const bg = new fabric.Image(img, {
                originX: 'center',
                originY: 'center',
                left: size / 2,
                top: size / 2,
                scaleX: scale,
                scaleY: scale,
                selectable: false,
                evented: false,
            });
            bg.set('isBackground', true);
            this.applyBackgroundLock(bg);
            this.bgLayout = {
                left: size / 2,
                top: size / 2,
                scaleX: scale,
                scaleY: scale,
                angle: 0,
            };
            this.isRemote = true;
            this.fabric.add(bg);
            this.fabric.sendToBack(bg);
            this.isRemote = false;
            this.consolidateLayerOrder();
        }

        applyBackgroundLock(bg) {
            if (!bg) return;
            bg.set({
                selectable: false,
                evented: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
                hasControls: false,
                hasBorders: false,
            });
            bg.set('isBackground', true);
        }

        resetBackgroundPosition(bg) {
            if (!bg || !this.bgLayout) return;
            bg.set({ ...this.bgLayout });
            bg.setCoords();
            this.fabric?.requestRenderAll();
        }

        syncInteractionState() {
            if (!this.fabric) return;

            const readonly = !this.drawEnabled;
            const canMove = this.canMoveObjects();
            const canErase = this.drawEnabled && this.tool === 'eraser';
            const canPing = this.tool === 'ping';
            const canRuler = this.tool === 'ruler';
            const canOverlayTool = canPing || canRuler;
            this.fabric.selection = canMove;
            this.fabric.skipTargetFind = (readonly && !canOverlayTool) || canOverlayTool;

            this.fabric.forEachObject((obj) => {
                if (obj.isDrawingPreview || obj.isGridLine) {
                    obj.selectable = false;
                    obj.evented = false;
                    return;
                }
                if (obj.isBackground) {
                    this.applyBackgroundLock(obj);
                    return;
                }
                const isEditingText = obj.type === 'i-text' && obj.isEditing;
                obj.selectable = canMove || isEditingText;
                obj.evented = canMove || canErase || isEditingText;
                obj.lockMovementX = !canMove;
                obj.lockMovementY = !canMove;
                obj.lockScalingX = !canMove;
                obj.lockScalingY = !canMove;
                obj.lockRotation = !canMove;
                if (!obj.isBackground && !obj.isGridLine && !obj.isDrawingPreview) {
                    if (canErase) {
                        obj.hoverCursor = TacticsCanvas.getEraserTargetCursor();
                    } else if (canMove) {
                        obj.hoverCursor = 'move';
                    } else {
                        obj.hoverCursor = 'default';
                    }
                }
            });

            const wrap = this.getWrapEl();
            wrap?.classList.toggle('tactics-canvas-wrap--readonly', readonly);
            wrap?.classList.toggle('tactics-canvas-wrap--eraser', canErase);
            wrap?.classList.toggle('tactics-canvas-wrap--ping', canPing);
            wrap?.classList.toggle('tactics-canvas-wrap--ruler', canRuler);

            if (this.fabric.upperCanvasEl) {
                this.fabric.upperCanvasEl.style.pointerEvents = (readonly && !canOverlayTool) ? 'none' : '';
                if (canOverlayTool) {
                    this.fabric.upperCanvasEl.style.cursor = 'crosshair';
                } else if (readonly) {
                    this.fabric.upperCanvasEl.style.cursor = 'default';
                } else if (canErase) {
                    this.updateEraserCursor(null);
                } else {
                    this.fabric.upperCanvasEl.style.cursor = '';
                }
            }

            if (this.fabric) {
                if (canErase) {
                    this.fabric.defaultCursor = TacticsCanvas.getEraserCursor();
                } else if (canOverlayTool) {
                    this.fabric.defaultCursor = 'crosshair';
                } else {
                    this.fabric.defaultCursor = 'default';
                }
            }
        }

        bindToolbar() {
            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const tool = btn.getAttribute('data-tool');
                    if (tool === 'image') {
                        this.imageUploadEl?.click();
                        return;
                    }
                    this.setTool(tool);
                });
            });
            document.getElementById('tacticsUndoBtn')?.addEventListener('click', () => this.undo());
            document.getElementById('tacticsRedoBtn')?.addEventListener('click', () => this.redo());
            document.getElementById('tacticsClearBtn')?.addEventListener('click', () => this.clearSlide());
            document.getElementById('tacticsGridToggleBtn')?.addEventListener('click', () => this.toggleGrid());
            document.getElementById('tacticsRemoteCursorsBtn')?.addEventListener('click', () => this.toggleRemoteCursors());
            document.getElementById('tacticsShareCursorBtn')?.addEventListener('click', () => this.toggleShareMyCursor());

            this.strokeColorEl?.addEventListener('input', () => {
                this.syncBrushFromColor();
                this.updatePaletteSwatches();
                this.saveToolPrefs();
            });
            this.strokeWidthEl?.addEventListener('input', () => {
                if (this.fabric?.isDrawingMode && this.fabric.freeDrawingBrush) {
                    this.fabric.freeDrawingBrush.width = this.getStrokeWidth();
                }
                this.saveToolPrefs();
            });

            this.imageUploadEl?.addEventListener('change', (ev) => {
                const file = ev.target.files?.[0];
                if (file) this.insertImageFromFile(file);
                ev.target.value = '';
            });
        }

        bindPalette() {
            document.querySelectorAll('.tactics-palette-swatch').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const color = btn.getAttribute('data-color');
                    if (color && this.strokeColorEl) {
                        this.strokeColorEl.value = color;
                        this.syncBrushFromColor();
                        this.updatePaletteSwatches();
                        this.saveToolPrefs();
                    }
                });
            });

            this.hueSliderEl?.addEventListener('input', () => {
                const hue = parseInt(this.hueSliderEl.value, 10) || 0;
                const color = TacticsCanvas.hslToHex(hue, 100, 50);
                if (this.strokeColorEl) {
                    this.strokeColorEl.value = color;
                    this.syncBrushFromColor();
                    this.updatePaletteSwatches();
                    this.saveToolPrefs();
                }
            });

            document.getElementById('tacticsSwapColorsBtn')?.addEventListener('click', () => {
                if (!this.strokeColorEl || !this.secondaryColorEl) return;
                const a = this.strokeColorEl.value;
                this.strokeColorEl.value = this.secondaryColorEl.value;
                this.secondaryColorEl.value = a;
                this.syncBrushFromColor();
                this.updatePaletteSwatches();
                this.saveToolPrefs();
            });

            document.getElementById('tacticsEyedropperBtn')?.addEventListener('click', () => {
                this.eyedropperActive = !this.eyedropperActive;
                document.getElementById('tacticsEyedropperBtn')?.classList.toggle('is-active', this.eyedropperActive);
                if (this.eyedropperActive) {
                    this.setTool('select');
                }
            });

            this.updatePaletteSwatches();
        }

        static hslToHex(h, s, l) {
            const sat = s / 100;
            const light = l / 100;
            const c = (1 - Math.abs(2 * light - 1)) * sat;
            const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            const m = light - c / 2;
            let r = 0;
            let g = 0;
            let b = 0;
            if (h < 60) { r = c; g = x; }
            else if (h < 120) { r = x; g = c; }
            else if (h < 180) { g = c; b = x; }
            else if (h < 240) { g = x; b = c; }
            else if (h < 300) { r = x; b = c; }
            else { r = c; b = x; }
            const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }

        syncBrushFromColor() {
            if (this.fabric?.isDrawingMode && this.fabric.freeDrawingBrush) {
                this.fabric.freeDrawingBrush.color = this.getStrokeColor();
            }
        }

        updatePaletteSwatches() {
            const current = (this.getStrokeColor() || '').toLowerCase();
            document.querySelectorAll('.tactics-palette-swatch').forEach((btn) => {
                const color = (btn.getAttribute('data-color') || '').toLowerCase();
                btn.classList.toggle('is-active', color === current);
            });
        }

        ensureRemoteStrokesLayer() {
            const root = this.getOverlaysEl();
            if (!root) return;
            if (!this.remoteStrokesLayerEl) {
                const layer = document.createElement('div');
                layer.className = 'tactics-remote-strokes-layer';
                layer.setAttribute('aria-hidden', 'true');
                this.remoteStrokesLayerEl = layer;
            }
            root.appendChild(this.remoteStrokesLayerEl);
        }

        normalizePoint(pointer) {
            const w = this.fabric?.getWidth() || 1;
            const h = this.fabric?.getHeight() || 1;
            return { x: pointer.x / w, y: pointer.y / h };
        }

        startLocalStrokeBroadcast(pointer) {
            if (!this.slideId) return;
            this.localStrokeId = 'ls' + Math.random().toString(16).slice(2, 10);
            this.localStrokePoints = [this.normalizePoint(pointer)];
            this.onOp({
                op: 'stroke_start',
                slideId: this.slideId,
                payload: {
                    strokeId: this.localStrokeId,
                    tool: this.tool,
                    color: this.getStrokeColor(),
                    width: this.getStrokeWidth(),
                    points: [this.localStrokePoints[0]],
                },
            });
        }

        queueStrokePointBroadcast(pointer) {
            if (!this.localStrokeId || !this.slideId) return;
            const pt = this.normalizePoint(pointer);
            this.localStrokePoints.push(pt);
            if (this.strokeBroadcastTimer) return;
            this.strokeBroadcastTimer = setTimeout(() => {
                this.strokeBroadcastTimer = null;
                if (!this.localStrokeId) return;
                this.onOp({
                    op: 'stroke_point',
                    slideId: this.slideId,
                    payload: {
                        strokeId: this.localStrokeId,
                        points: this.localStrokePoints.slice(-8),
                    },
                });
            }, 32);
        }

        finishLocalStrokeBroadcast() {
            if (this.strokeBroadcastTimer) {
                clearTimeout(this.strokeBroadcastTimer);
                this.strokeBroadcastTimer = null;
            }
            if (!this.localStrokeId || !this.slideId) return;
            this.onOp({
                op: 'stroke_end',
                slideId: this.slideId,
                payload: { strokeId: this.localStrokeId },
            });
            this.localStrokeId = null;
            this.localStrokePoints = [];
        }

        getRemoteStrokeKey(clientId, strokeId) {
            return `${clientId || ''}:${strokeId || ''}`;
        }

        renderRemoteStrokePath(entry) {
            if (!entry?.el || !entry.points?.length) return;
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (overlayW <= 0 || overlayH <= 0) return;
            const pts = entry.points.map((p) => {
                const x = Math.round((p.x || 0) * overlayW);
                const y = Math.round((p.y || 0) * overlayH);
                return `${x},${y}`;
            }).join(' ');
            entry.el.innerHTML = `<svg width="${overlayW}" height="${overlayH}" style="position:absolute;left:0;top:0;overflow:visible"><polyline points="${pts}" fill="none" stroke="${entry.color || '#ff4444'}" stroke-width="${entry.width || 4}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/></svg>`;
        }

        applyRemoteStrokeOp(msg) {
            this.ensureRemoteStrokesLayer();
            if (!this.remoteStrokesLayerEl || !msg?.payload) return;
            const from = String(msg.from || msg.clientId || '');
            if (from && from === String(this.clientId || '')) return;

            const p = msg.payload;
            const key = this.getRemoteStrokeKey(from, p.strokeId);
            let entry = this.remoteStrokes.get(key);

            if (msg.op === 'stroke_start') {
                const el = document.createElement('div');
                el.className = 'tactics-remote-stroke';
                this.remoteStrokesLayerEl.appendChild(el);
                entry = {
                    el,
                    points: Array.isArray(p.points) ? p.points.slice() : [],
                    color: p.color,
                    width: p.width,
                };
                this.remoteStrokes.set(key, entry);
                this.renderRemoteStrokePath(entry);
                return;
            }

            if (!entry) return;

            if (msg.op === 'stroke_point' && Array.isArray(p.points)) {
                entry.points.push(...p.points);
                this.renderRemoteStrokePath(entry);
                return;
            }

            if (msg.op === 'stroke_end') {
                entry.el?.remove();
                this.remoteStrokes.delete(key);
            }
        }

        clearRemoteStrokes() {
            this.remoteStrokes.forEach((entry) => entry.el?.remove());
            this.remoteStrokes.clear();
            if (this.remoteStrokesLayerEl) {
                this.remoteStrokesLayerEl.innerHTML = '';
            }
        }

        insertImageFromFile(file) {
            if (!this.fabric || !this.drawEnabled) return;
            const reader = new FileReader();
            reader.onload = () => {
                fabric.Image.fromURL(reader.result, (img) => {
                    if (!img || !this.fabric) return;
                    const maxW = this.fabric.getWidth() * 0.4;
                    if (img.width > maxW) {
                        img.scaleToWidth(maxW);
                    }
                    img.set({
                        left: this.fabric.getWidth() / 2 - (img.getScaledWidth() / 2),
                        top: this.fabric.getHeight() / 2 - (img.getScaledHeight() / 2),
                    });
                    img.set('tacticsType', 'image');
                    this.ensureTacticsId(img);
                    this.isRemote = true;
                    this.fabric.add(img);
                    this.isRemote = false;
                    this.pushHistory();
                    this.onChange();
                    if (this.slideId) {
                        this.onOp({
                            op: 'full',
                            slideId: this.slideId,
                            payload: this.exportDrawingsJson(),
                        });
                    }
                    this.setTool('select');
                }, { crossOrigin: 'anonymous' });
            };
            reader.readAsDataURL(file);
        }

        setDrawEnabled(enabled) {
            this.drawEnabled = !!enabled;
            const disabled = !this.drawEnabled;

            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                const tool = btn.getAttribute('data-tool');
                const alwaysOn = tool === 'select' || tool === 'ping' || tool === 'ruler';
                btn.disabled = disabled && !alwaysOn;
                btn.classList.toggle('is-disabled', disabled && !alwaysOn);
            });
            ['tacticsUndoBtn', 'tacticsRedoBtn', 'tacticsClearBtn'].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = disabled;
                btn.classList.toggle('is-disabled', disabled);
            });
            if (this.strokeColorEl) {
                this.strokeColorEl.disabled = disabled;
            }
            if (this.strokeWidthEl) {
                this.strokeWidthEl.disabled = disabled;
            }

            if (!this.fabric) return;

            this.fabric.isDrawingMode = false;
            if (disabled) {
                this.clearLinePreview();
                this.lineStart = null;
                this.fabric.discardActiveObject();
                if (this.tool !== 'select' && this.tool !== 'ping' && this.tool !== 'ruler') {
                    this.setTool('select');
                }
            }
            this.syncInteractionState();
            this.fabric.requestRenderAll();
        }

        setTool(tool) {
            if (!this.drawEnabled && tool !== 'select' && tool !== 'ping' && tool !== 'ruler') return;
            this.stopPingHold();
            if (tool !== 'ruler') {
                this.clearRuler();
            }
            this.clearLinePreview();
            this.clearShapePreview();
            this.shapeStart = null;
            this.polygonPoints = [];
            this.lineStart = null;
            this.tool = tool || 'select';
            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.tool);
            });
            if (!this.fabric) return;

            this.fabric.isDrawingMode = this.drawEnabled && this.tool === 'pen';
            this.syncInteractionState();

            if (this.fabric.isDrawingMode) {
                this.fabric.freeDrawingBrush = new fabric.PencilBrush(this.fabric);
                this.fabric.freeDrawingBrush.color = this.getStrokeColor();
                this.fabric.freeDrawingBrush.width = this.getStrokeWidth();
            }
        }

        getStrokeColor() {
            return this.strokeColorEl?.value || TacticsCanvas.DEFAULT_STROKE_COLOR;
        }

        getStrokeWidth() {
            return parseInt(this.strokeWidthEl?.value || String(TacticsCanvas.DEFAULT_STROKE_WIDTH), 10)
                || TacticsCanvas.DEFAULT_STROKE_WIDTH;
        }

        isPreviewObject(obj) {
            return !!(obj?.isDrawingPreview || obj?.isGridLine || obj?.isBackground);
        }

        clearLinePreview() {
            if (!this.fabric || !this.linePreview) return;
            this.isRemote = true;
            if (this.linePreview.arrowHead) {
                this.fabric.remove(this.linePreview.arrowHead);
            }
            if (this.linePreview.line) {
                this.fabric.remove(this.linePreview.line);
            }
            this.isRemote = false;
            this.linePreview = null;
            this.fabric.requestRenderAll();
        }

        buildArrowHeadPolygon(line, options = {}) {
            const x1 = line.x1;
            const y1 = line.y1;
            const x2 = line.x2;
            const y2 = line.y2;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 14;
            const points = [
                { x: x2, y: y2 },
                {
                    x: x2 - headLen * Math.cos(angle - Math.PI / 6),
                    y: y2 - headLen * Math.sin(angle - Math.PI / 6),
                },
                {
                    x: x2 - headLen * Math.cos(angle + Math.PI / 6),
                    y: y2 - headLen * Math.sin(angle + Math.PI / 6),
                },
            ];
            return new fabric.Polygon(points, {
                fill: this.getStrokeColor(),
                stroke: this.getStrokeColor(),
                selectable: false,
                evented: false,
                ...options,
            });
        }

        syncPreviewArrowHead(line) {
            if (!this.fabric || !this.linePreview || this.tool !== 'arrow') return;

            if (this.linePreview.arrowHead) {
                this.isRemote = true;
                this.fabric.remove(this.linePreview.arrowHead);
                this.isRemote = false;
                this.linePreview.arrowHead = null;
            }

            const tri = this.buildArrowHeadPolygon(line);
            tri.isDrawingPreview = true;
            this.linePreview.arrowHead = tri;
            this.isRemote = true;
            this.fabric.add(tri);
            this.isRemote = false;
        }

        startLinePreview(x, y) {
            if (!this.fabric) return;

            this.clearLinePreview();
            this.lineStart = { x, y };
            this.startLocalStrokeBroadcast({ x, y });

            const line = new fabric.Line([x, y, x, y], {
                stroke: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
                selectable: false,
                evented: false,
                strokeLineCap: 'round',
            });
            line.isDrawingPreview = true;
            this.linePreview = { line };

            this.isRemote = true;
            this.fabric.add(line);
            this.isRemote = false;

            if (this.tool === 'arrow') {
                this.syncPreviewArrowHead(line);
            }
        }

        updateLinePreview(x, y) {
            const line = this.linePreview?.line;
            if (!line || !this.fabric) return;

            line.set({ x2: x, y2: y });
            line.setCoords();

            if (this.tool === 'arrow') {
                this.syncPreviewArrowHead(line);
            }

            this.queueStrokePointBroadcast({ x, y });
            this.fabric.requestRenderAll();
        }

        clearShapePreview() {
            if (!this.fabric || !this.shapePreview) return;
            this.isRemote = true;
            this.fabric.remove(this.shapePreview);
            this.isRemote = false;
            this.shapePreview = null;
            this.fabric.requestRenderAll();
        }

        updateShapePreview(x, y) {
            if (!this.fabric || !this.shapeStart) return;
            const start = this.shapeStart;
            this.clearShapePreview();

            const color = this.getStrokeColor();
            const strokeWidth = this.getStrokeWidth();
            let shape = null;

            if (this.tool === 'rect') {
                shape = new fabric.Rect({
                    left: Math.min(start.x, x),
                    top: Math.min(start.y, y),
                    width: Math.abs(x - start.x),
                    height: Math.abs(y - start.y),
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            } else if (this.tool === 'circle') {
                const radius = Math.hypot(x - start.x, y - start.y) / 2;
                shape = new fabric.Circle({
                    left: (start.x + x) / 2 - radius,
                    top: (start.y + y) / 2 - radius,
                    radius,
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            }

            if (!shape) return;
            shape.isDrawingPreview = true;
            this.shapePreview = shape;
            this.isRemote = true;
            this.fabric.add(shape);
            this.isRemote = false;
            this.fabric.requestRenderAll();
        }

        finishShapeDraw(x, y) {
            if (!this.fabric || !this.shapeStart) return;
            const start = this.shapeStart;
            this.clearShapePreview();
            this.shapeStart = null;

            if (Math.hypot(x - start.x, y - start.y) < 3) return;

            const color = this.getStrokeColor();
            const strokeWidth = this.getStrokeWidth();
            let shape = null;

            if (this.tool === 'rect') {
                shape = new fabric.Rect({
                    left: Math.min(start.x, x),
                    top: Math.min(start.y, y),
                    width: Math.abs(x - start.x),
                    height: Math.abs(y - start.y),
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            } else if (this.tool === 'circle') {
                const radius = Math.hypot(x - start.x, y - start.y) / 2;
                shape = new fabric.Circle({
                    left: (start.x + x) / 2 - radius,
                    top: (start.y + y) / 2 - radius,
                    radius,
                    fill: 'transparent',
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            }

            if (!shape) return;
            shape.set('tacticsType', this.tool);
            this.ensureTacticsId(shape);
            this.isRemote = true;
            this.fabric.add(shape);
            this.isRemote = false;
            this.pushHistory();
            this.onChange();
            if (this.slideId) {
                this.onOp({
                    op: 'full',
                    slideId: this.slideId,
                    payload: this.exportDrawingsJson(),
                });
            }
        }

        finishPolygon() {
            if (!this.fabric || this.polygonPoints.length < 3) {
                this.polygonPoints = [];
                this.clearShapePreview();
                return;
            }
            const points = this.polygonPoints.map((p) => ({ x: p.x, y: p.y }));
            this.polygonPoints = [];
            this.clearShapePreview();

            const poly = new fabric.Polygon(points, {
                fill: 'transparent',
                stroke: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
                selectable: false,
                evented: false,
            });
            poly.set('tacticsType', 'polygon');
            this.ensureTacticsId(poly);
            this.isRemote = true;
            this.fabric.add(poly);
            this.isRemote = false;
            this.pushHistory();
            this.onChange();
            if (this.slideId) {
                this.onOp({
                    op: 'full',
                    slideId: this.slideId,
                    payload: this.exportDrawingsJson(),
                });
            }
        }

        finishLineDraw(x, y) {
            if (!this.fabric || !this.lineStart) return;

            const start = this.lineStart;
            const dx = x - start.x;
            const dy = y - start.y;
            this.clearLinePreview();
            this.lineStart = null;

            if (Math.hypot(dx, dy) < 3) {
                return;
            }

            const line = new fabric.Line([start.x, start.y, x, y], {
                stroke: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
                selectable: false,
                evented: false,
                strokeLineCap: 'round',
            });
            line.set('tacticsType', this.tool);
            this.ensureTacticsId(line);

            this.isRemote = true;
            this.fabric.add(line);
            if (this.tool === 'arrow') {
                this.addArrowHead(line);
            }
            this.fabric.discardActiveObject();
            this.isRemote = false;

            this.syncInteractionState();
            this.fabric.requestRenderAll();

            this.finishLocalStrokeBroadcast();
            this.pushHistory();
            this.onChange();
            if (this.slideId) {
                this.onOp({
                    op: 'full',
                    slideId: this.slideId,
                    payload: this.exportDrawingsJson(),
                });
            }
        }

        ensureTacticsId(obj) {
            if (!obj.tacticsId) {
                obj.tacticsId = 't' + Math.random().toString(16).slice(2, 10);
            }
            return obj.tacticsId;
        }

        static EXPORT_PROPS = [
            'tacticsType',
            'tacticsArrowHead',
            'tacticsParent',
            'tacticsId',
            'tacticsParentId',
        ];

        removeAttachedArrowHeads(parent) {
            if (!this.fabric || !parent) return;

            const parentId = parent.tacticsId;
            this.fabric.getObjects().forEach((obj) => {
                if (!obj.tacticsArrowHead) return;
                if (obj.tacticsParent === parent || (parentId && obj.tacticsParentId === parentId)) {
                    this.isRemote = true;
                    this.fabric.remove(obj);
                    this.isRemote = false;
                }
            });
        }

        removeDrawingTarget(target) {
            if (!this.fabric || !target || this.isPreviewObject(target)) return;

            this.isRemote = true;
            if (target.tacticsType === 'arrow' || target.tacticsArrowHead) {
                if (target.tacticsArrowHead && target.tacticsParent) {
                    this.fabric.remove(target);
                } else {
                    this.removeAttachedArrowHeads(target);
                    this.fabric.remove(target);
                }
            } else {
                this.fabric.remove(target);
            }
            this.isRemote = false;

            this.fabric.discardActiveObject();
            this.fabric.requestRenderAll();
            this.pushHistory();
            this.onChange();
            if (this.slideId) {
                this.onOp({
                    op: 'full',
                    slideId: this.slideId,
                    payload: this.exportDrawingsJson(),
                });
            }
        }

        addArrowHead(line) {
            const parentId = this.ensureTacticsId(line);
            const tri = this.buildArrowHeadPolygon(line);
            tri.set('tacticsArrowHead', true);
            tri.set('tacticsParent', line);
            tri.set('tacticsParentId', parentId);
            this.fabric.add(tri);
        }

        handleMouseDown(opt) {
            if (!this.fabric || this.isRemote) return;
            const pointer = this.fabric.getPointer(opt.e);

            if (this.eyedropperActive && opt.e) {
                const ctx = this.fabric.getContext();
                const vpt = this.fabric.viewportTransform;
                const x = Math.round(pointer.x * (vpt?.[0] || 1) + (vpt?.[4] || 0));
                const y = Math.round(pointer.y * (vpt?.[3] || 1) + (vpt?.[5] || 0));
                try {
                    const data = ctx.getImageData(x, y, 1, 1).data;
                    const hex = '#' + [data[0], data[1], data[2]]
                        .map((n) => n.toString(16).padStart(2, '0')).join('');
                    if (this.strokeColorEl) {
                        this.strokeColorEl.value = hex;
                        this.syncBrushFromColor();
                        this.updatePaletteSwatches();
                        this.saveToolPrefs();
                    }
                } catch (e) {
                    // cross-origin or unavailable
                }
                this.eyedropperActive = false;
                document.getElementById('tacticsEyedropperBtn')?.classList.remove('is-active');
                return;
            }

            if (this.tool === 'eraser') {
                if (!this.drawEnabled) return;
                const target = this.fabric.findTarget(opt.e, false);
                if (target && !target.isBackground && !target.isGridLine) {
                    this.removeDrawingTarget(target);
                }
                return;
            }

            if (this.tool === 'ping') {
                this.startPingHold(pointer);
                return;
            }

            if (this.tool === 'pen' && this.drawEnabled && this.fabric.isDrawingMode) {
                this.startLocalStrokeBroadcast(pointer);
                return;
            }

            if (this.tool === 'ruler') {
                this.rulerDragStart = { x: pointer.x, y: pointer.y };
                this.rulerDragActive = true;
                this.rulerMeasurement = null;
                this.updateRulerDisplay(pointer.x, pointer.y, pointer.x, pointer.y);
                return;
            }

            if (!this.drawEnabled) return;

            if (this.tool === 'text') {
                const text = new fabric.IText('Text', {
                    left: pointer.x,
                    top: pointer.y,
                    fill: this.getStrokeColor(),
                    fontSize: 18,
                    fontFamily: 'Segoe UI, sans-serif',
                });
                this.fabric.add(text);
                this.syncInteractionState();
                this.fabric.setActiveObject(text);
                text.enterEditing();
                return;
            }

            if (this.tool === 'line' || this.tool === 'arrow') {
                this.startLinePreview(pointer.x, pointer.y);
                return;
            }

            if (this.tool === 'rect' || this.tool === 'circle') {
                this.shapeStart = { x: pointer.x, y: pointer.y };
                return;
            }

            if (this.tool === 'polygon') {
                if (this.polygonPoints.length >= 3) {
                    const first = this.polygonPoints[0];
                    if (Math.hypot(pointer.x - first.x, pointer.y - first.y) < 10) {
                        this.finishPolygon();
                        return;
                    }
                }
                this.polygonPoints.push({ x: pointer.x, y: pointer.y });
                return;
            }
        }

        handleMouseMove(opt) {
            if (!this.fabric || this.isRemote) return;

            if (this.tool === 'ruler' && this.rulerDragActive && this.rulerDragStart) {
                const pointer = this.fabric.getPointer(opt.e);
                this.updateRulerDisplay(
                    this.rulerDragStart.x,
                    this.rulerDragStart.y,
                    pointer.x,
                    pointer.y,
                );
                return;
            }

            const pointer = this.fabric.getPointer(opt.e);

            if (this.shapeStart && (this.tool === 'rect' || this.tool === 'circle')) {
                this.updateShapePreview(pointer.x, pointer.y);
                return;
            }

            if (!this.drawEnabled || !this.lineStart) return;
            if (this.tool !== 'line' && this.tool !== 'arrow') return;

            this.updateLinePreview(pointer.x, pointer.y);
        }

        handleMouseUp(opt) {
            if (!this.fabric || this.isRemote) return;
            if (this.tool === 'ping') {
                this.stopPingHold();
                return;
            }

            if (this.tool === 'ruler' && this.rulerDragActive && this.rulerDragStart) {
                const pointer = this.fabric.getPointer(opt.e);
                this.rulerMeasurement = {
                    x1: this.rulerDragStart.x,
                    y1: this.rulerDragStart.y,
                    x2: pointer.x,
                    y2: pointer.y,
                };
                this.rulerDragActive = false;
                this.rulerDragStart = null;
                this.updateRulerDisplay(
                    this.rulerMeasurement.x1,
                    this.rulerMeasurement.y1,
                    this.rulerMeasurement.x2,
                    this.rulerMeasurement.y2,
                );
                return;
            }

            if (!this.drawEnabled) return;

            const pointer = this.fabric.getPointer(opt.e);

            if (this.shapeStart && (this.tool === 'rect' || this.tool === 'circle')) {
                this.finishShapeDraw(pointer.x, pointer.y);
                return;
            }

            if (this.tool !== 'line' && this.tool !== 'arrow') return;
            if (!this.lineStart) return;

            this.finishLineDraw(pointer.x, pointer.y);
        }

        handleLocalChange(type, e) {
            if (this.isRemote || !this.drawEnabled) return;
            const obj = e?.target;
            if (!obj || this.isPreviewObject(obj)) return;

            this.pushHistory();
            this.onChange();

            if (!this.slideId) return;

            if (obj.type === 'path' || type === 'add') {
                this.onOp({
                    op: 'full',
                    slideId: this.slideId,
                    payload: this.exportDrawingsJson(),
                });
                return;
            }

            this.onOp({
                op: type,
                slideId: this.slideId,
                payload: obj.toObject(TacticsCanvas.EXPORT_PROPS),
            });
        }

        exportDrawingsJson() {
            if (!this.fabric) return null;
            const objects = this.fabric.getObjects()
                .filter((o) => !this.isPreviewObject(o) && !o.isBackground && !o.isGridLine)
                .map((o) => o.toObject(TacticsCanvas.EXPORT_PROPS));
            return {
                version: this.fabric.version || '5.3.0',
                objects,
            };
        }

        pushHistory() {
            if (!this.fabric) return;
            const json = this.exportJson();
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push(json);
            if (this.history.length > 40) {
                this.history.shift();
            } else {
                this.historyIndex += 1;
            }
        }

        undo() {
            if (!this.drawEnabled || this.historyIndex <= 0 || !this.fabric) return;
            this.historyIndex -= 1;
            this.loadJson(this.history[this.historyIndex], true);
            this.onChange();
            this.broadcastFull();
        }

        redo() {
            if (!this.drawEnabled || this.historyIndex >= this.history.length - 1 || !this.fabric) return;
            this.historyIndex += 1;
            this.loadJson(this.history[this.historyIndex], true);
            this.onChange();
            this.broadcastFull();
        }

        broadcastFull() {
            if (!this.slideId) return;
            this.onOp({
                op: 'full',
                slideId: this.slideId,
                payload: this.exportDrawingsJson(),
            });
        }

        clearSlide() {
            if (!this.drawEnabled) return;
            const t = window.AbsTacticsI18n?.t('clearConfirm') || 'Clear?';
            if (!confirm(t) || !this.fabric) return;
            this.fabric.getObjects().forEach((obj) => {
                if (!obj.isBackground && !obj.isGridLine) {
                    this.fabric.remove(obj);
                }
            });
            this.consolidateLayerOrder();
            this.fabric.requestRenderAll();
            this.pushHistory();
            this.onChange();
            this.onOp({ op: 'clear', slideId: this.slideId, payload: null });
        }

        exportJson() {
            if (!this.fabric) return null;
            const objects = this.fabric.getObjects()
                .filter((o) => !o.isGridLine && !o.isDrawingPreview)
                .map((o) => o.toObject([...TacticsCanvas.EXPORT_PROPS, 'isBackground', 'isGridLine']));
            return {
                version: this.fabric.version || '5.3.0',
                objects,
            };
        }

        relinkArrowHeads() {
            if (!this.fabric) return;

            const linesById = new Map();
            this.fabric.getObjects().forEach((obj) => {
                if (obj.type === 'line' && obj.tacticsType === 'arrow') {
                    this.ensureTacticsId(obj);
                    linesById.set(obj.tacticsId, obj);
                }
            });

            this.fabric.getObjects().forEach((obj) => {
                if (!obj.tacticsArrowHead) return;
                const parentId = obj.tacticsParentId;
                if (parentId && linesById.has(parentId)) {
                    obj.tacticsParent = linesById.get(parentId);
                }
            });
        }

        async loadDrawings(json) {
            if (!this.fabric || !json) return;
            this.isRemote = true;
            this.fabric.getObjects().filter((o) => !o.isBackground && !o.isGridLine).forEach((o) => {
                this.fabric.remove(o);
            });
            const objects = (Array.isArray(json.objects) ? json.objects : [])
                .filter((o) => !o.isBackground && !o.isGridLine);
            await new Promise((resolve) => {
                if (!objects.length) {
                    resolve();
                    return;
                }
                fabric.util.enlivenObjects(objects, (objs) => {
                    objs.forEach((obj) => this.fabric.add(obj));
                    this.relinkArrowHeads();
                    this.syncInteractionState();
                    resolve();
                });
            });
            this.consolidateLayerOrder();
            this.syncInteractionState();
            this.fabric.renderAll();
            this.isRemote = false;
        }

        clearRemoteCursors() {
            Array.from(this.remoteCursors.keys()).forEach((clientId) => {
                this.removeRemoteCursor(clientId);
            });
        }

        showBackgroundImage(img) {
            if (!img || !this.fabric) return;
            this.bgImageEl = img;
            this.fitBackground();
            this.syncGridOverlay();
            this.fabric.requestRenderAll();
        }

        async loadSlide(slide, mapUrl) {
            this.initFabric();
            if (!this.fabric || !slide) return;
            this.stopPingHold();
            this.clearRemoteCursors();
            this.clearRemoteStrokes();
            this.clearPings();
            this.clearRuler();
            this.slideId = slide.id;
            this.mapCode = slide.map_code || 'cliff';
            await this.refreshMapScaleInfo(slide);

            this.isRemote = true;
            this.fabric.clear();
            this.bgImageEl = null;
            this.bgLayout = null;
            this.isRemote = false;

            const publicId = String(window.ABS_TACTICS_PUBLIC_ID || '');
            const resolvedUrl = mapUrl || maps().slideMapUrl(slide, publicId);
            const cached = maps().getCachedImage(resolvedUrl);
            if (cached) {
                this.showBackgroundImage(cached);
            }

            const imgPromise = maps().loadMapImage(
                this.mapCode,
                slide.game,
                slide.battle_mode,
                resolvedUrl,
                slide,
                publicId,
            );
            const jsonPromise = slide.canvas ? this.loadJson(slide.canvas, true) : Promise.resolve();

            const img = await imgPromise;
            if (img && img !== this.bgImageEl) {
                this.showBackgroundImage(img);
            }

            await jsonPromise;

            this.history = [this.exportJson()];
            this.historyIndex = 0;
            requestAnimationFrame(() => {
                this.scheduleResize();
                this.updateGridToggleBtn();
                this.syncInteractionState();
                this.fabric.requestRenderAll();
            });
        }

        stripBackground(json) {
            if (!json || !Array.isArray(json.objects)) return json;
            return {
                ...json,
                objects: json.objects.filter((obj) => !obj.isBackground && !obj.isGridLine),
            };
        }

        loadJson(json, silent) {
            return new Promise((resolve) => {
                if (!this.fabric) {
                    resolve();
                    return;
                }
                if (!json) {
                    resolve();
                    return;
                }
                const cleaned = this.stripBackground(json);
                this.isRemote = !!silent;
                this.fabric.loadFromJSON(cleaned, () => {
                    this.fabric.getObjects().forEach((obj) => {
                        if (obj.isBackground) {
                            this.fabric.remove(obj);
                        }
                    });
                    this.fitBackground();
                    this.syncGridOverlay();
                    this.relinkArrowHeads();
                    this.syncInteractionState();
                    this.fabric.renderAll();
                    this.isRemote = false;
                    resolve();
                });
            });
        }

        async applyRemoteOp(msg) {
            if (!this.fabric || !msg) return;
            const msgSlideId = msg.slideId != null ? String(msg.slideId) : '';
            const activeSlideId = this.slideId != null ? String(this.slideId) : '';
            if (msgSlideId && activeSlideId && msgSlideId !== activeSlideId) return;

            this.isRemote = true;
            try {
                if (msg.op === 'clear') {
                    this.fabric.getObjects().forEach((obj) => {
                        if (!obj.isBackground && !obj.isGridLine) this.fabric.remove(obj);
                    });
                    this.consolidateLayerOrder();
                } else if (msg.op === 'full' && msg.payload) {
                    await this.loadDrawings(msg.payload);
                } else if (msg.op === 'remove' && msg.payload) {
                    const objects = this.fabric.getObjects();
                    const match = objects.find((o) => o.type === msg.payload.type
                        && Math.round(o.left) === Math.round(msg.payload.left)
                        && Math.round(o.top) === Math.round(msg.payload.top));
                    if (match) this.fabric.remove(match);
                } else if ((msg.op === 'add' || msg.op === 'modify') && msg.payload) {
                    fabric.util.enlivenObjects([msg.payload], (objs) => {
                        objs.forEach((obj) => this.fabric.add(obj));
                        this.syncInteractionState();
                        this.fabric.requestRenderAll();
                    });
                } else if (msg.op === 'ping' && msg.payload) {
                    const p = msg.payload;
                    this.playPing(p.x, p.y, p.color, p.width);
                } else if (msg.op === 'stroke_start' || msg.op === 'stroke_point' || msg.op === 'stroke_end') {
                    this.applyRemoteStrokeOp(msg);
                }
            } finally {
                this.isRemote = false;
                this.syncInteractionState();
            }
        }

        async applyCanvasState(json) {
            if (!json) return;
            await this.loadDrawings(json);
        }

        getCanvasState() {
            return this.exportDrawingsJson();
        }
    }

    window.TacticsCanvas = TacticsCanvas;
})();
