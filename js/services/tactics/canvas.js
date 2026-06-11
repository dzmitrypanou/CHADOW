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
            this.cellFlashesLayerEl = null;
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
            this.polygonPreview = null;
            this.eyedropperActive = false;
            this.eyedropperPickInFlight = false;
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
        static ARROW_SPREAD = Math.PI / 7;
        static ICON_LABEL_FONT = 'Segoe UI, sans-serif';
        static ICON_LABEL_GAP = 4;
        static ICON_LABEL_MARKER_GAP_EXTRA = 3;
        static ICON_LABEL_MARKER_BODY_EXTRA = 1;
        static ICON_LABEL_EDGE_MARGIN = 6;
        static DEFAULT_ICON_SIZE = 16;
        static DEFAULT_ICON_LABEL_SIZE = 14;

        static circlePathData(radius) {
            const r = Math.max(0.5, radius);
            return `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${2 * r} A ${r} ${r} 0 1 1 ${r} 0 Z`;
        }

        createCircleShape(options) {
            const radius = Math.max(0.5, options.radius || 0);
            const shape = new fabric.Path(TacticsCanvas.circlePathData(radius), {
                left: options.left,
                top: options.top,
                fill: options.fill ?? 'transparent',
                stroke: options.stroke,
                strokeWidth: options.strokeWidth,
                selectable: options.selectable ?? false,
                evented: options.evented ?? false,
                strokeLineCap: 'round',
                strokeLineJoin: 'round',
            });
            this.applyStrokeDash(shape);
            return shape;
        }
        static TOOL_I18N_KEYS = {
            select: 'toolSelect',
            pen: 'toolPen',
            line: 'toolLine',
            circle: 'toolCircle',
            rect: 'toolRect',
            polygon: 'toolPolygon',
            eraser: 'toolEraser',
            text: 'toolText',
            image: 'toolImage',
            cell: 'toolCell',
            ping: 'toolPing',
            ruler: 'toolRuler',
        };

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
            const customEl = this.getCustomSwatchEl();
            const customColor = TacticsCanvas.normalizeHexColor(customEl?.getAttribute('data-color'));
            const hueRaw = parseInt(this.hueSliderEl?.value, 10);
            const prefs = {
                strokeColor: this.getStrokeColor(),
                customColor: customColor || this.getStrokeColor(),
                hue: Number.isFinite(hueRaw) ? hueRaw : TacticsCanvas.hexToHue(customColor || this.getStrokeColor()),
                strokeWidth: this.getStrokeWidth(),
            };
            try {
                localStorage.setItem(TacticsCanvas.TOOL_PREFS_KEY, JSON.stringify(prefs));
            } catch (e) {
                // storage unavailable
            }
        }

        applyToolPrefs() {
            const prefs = TacticsCanvas.loadToolPrefs();
            const strokeColor = TacticsCanvas.normalizeHexColor(prefs.strokeColor)
                || TacticsCanvas.DEFAULT_STROKE_COLOR;
            const customColor = TacticsCanvas.normalizeHexColor(prefs.customColor)
                || strokeColor;

            if (this.strokeColorEl) {
                this.strokeColorEl.value = strokeColor;
            }
            this.updateCustomSwatch(customColor);
            if (this.hueSliderEl) {
                const hue = Number.isFinite(prefs.hue)
                    ? Math.max(0, Math.min(360, prefs.hue))
                    : TacticsCanvas.hexToHue(customColor);
                this.hueSliderEl.value = String(hue);
            }
            if (this.strokeWidthEl) {
                const width = parseInt(prefs.strokeWidth, 10);
                const clamped = Number.isFinite(width)
                    ? Math.max(2, Math.min(16, width))
                    : TacticsCanvas.DEFAULT_STROKE_WIDTH;
                this.strokeWidthEl.value = String(clamped);
            }
            this.updateStrokeWidthLabel();
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
                this.canvasEl.closest('.tactics-map-grid'),
                this.canvasEl.closest('.tactics-editor-body'),
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
                const path = e.path;
                if (path && this.tool === 'pen') {
                    this.applyStrokeStyle(path);
                    path.set('tacticsType', 'pen');
                    this.ensureTacticsId(path);
                }
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
            this.bindContextMenuBlock();
            this.bindPingHoldRelease();
            this.bindDeleteKey();
            this.bindUndoRedoKeys();
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

        mountOverlayLayer(layer, root) {
            if (!layer || !root) return;
            if (layer.parentElement !== root) {
                root.appendChild(layer);
            }
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
            this.mountOverlayLayer(this.cursorsLayerEl, root);
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
            this.mountOverlayLayer(this.pingsLayerEl, root);
        }

        clearPings() {
            if (this.pingsLayerEl) {
                this.pingsLayerEl.innerHTML = '';
            }
        }

        ensureCellFlashesLayer() {
            const root = this.getOverlaysEl();
            if (!root) return;
            if (!this.cellFlashesLayerEl) {
                const layer = document.createElement('div');
                layer.className = 'tactics-cell-flashes-layer';
                layer.setAttribute('aria-hidden', 'true');
                this.cellFlashesLayerEl = layer;
            }
            this.mountOverlayLayer(this.cellFlashesLayerEl, root);
        }

        clearCellFlashes() {
            if (this.cellFlashesLayerEl) {
                this.cellFlashesLayerEl.innerHTML = '';
            }
        }

        static GRID_DIVISIONS = 10;
        static DEFAULT_CELL_FLASH_MS = 2000;

        getGridCanvasSize() {
            return this.fabric?.getWidth() || 0;
        }

        getGridStep(size = this.getGridCanvasSize()) {
            return size > 0 ? size / TacticsCanvas.GRID_DIVISIONS : 0;
        }

        getGridLineCanvasCoord(index, size = this.getGridCanvasSize()) {
            if (index <= 0) return 0;
            if (index >= TacticsCanvas.GRID_DIVISIONS) return size;
            return this.getGridStep(size) * index;
        }

        getGridCellFromPointer(pointer) {
            const size = this.getGridCanvasSize();
            if (!pointer || size <= 0) return null;

            const step = this.getGridStep(size);
            if (step <= 0) return null;

            return {
                col: Math.min(TacticsCanvas.GRID_DIVISIONS - 1, Math.max(0, Math.floor(pointer.x / step))),
                row: Math.min(TacticsCanvas.GRID_DIVISIONS - 1, Math.max(0, Math.floor(pointer.y / step))),
            };
        }

        getCellFlashDuration() {
            const settings = this.getToolSettings();
            const ms = Number(settings.cellFlashDuration);
            if (!Number.isFinite(ms)) {
                return TacticsCanvas.DEFAULT_CELL_FLASH_MS;
            }
            return Math.round(Math.max(400, Math.min(4000, ms)));
        }

        getCellOverlaySize() {
            const layer = this.cellFlashesLayerEl;
            if (layer?.clientWidth > 0 && layer?.clientHeight > 0) {
                return {
                    width: layer.clientWidth,
                    height: layer.clientHeight,
                };
            }
            return this.getOverlaySize();
        }

        getCellFlashOverlayRect(col, row) {
            const { width, height } = this.getCellOverlaySize();
            if (width <= 0 || height <= 0) {
                return { left: 0, top: 0, width: 0, height: 0 };
            }

            const divisions = TacticsCanvas.GRID_DIVISIONS;
            const left = Math.round((col * width) / divisions);
            const top = Math.round((row * height) / divisions);
            const right = Math.round(((col + 1) * width) / divisions);
            const bottom = Math.round(((row + 1) * height) / divisions);
            return {
                left,
                top,
                width: Math.max(1, right - left),
                height: Math.max(1, bottom - top),
            };
        }

        playCellFlash(col, row, color) {
            this.ensureCellFlashesLayer();
            if (!this.cellFlashesLayerEl) return null;

            const cellRect = this.getCellFlashOverlayRect(col, row);
            if (cellRect.width <= 0 || cellRect.height <= 0) return null;

            const durationMs = this.getCellFlashDuration();

            const flash = document.createElement('div');
            flash.className = 'tactics-cell-flash';
            flash.style.setProperty('--cell-flash-color', String(color || '#ff4444'));
            flash.style.setProperty('--cell-flash-duration', `${durationMs}ms`);
            flash.style.left = `${cellRect.left}px`;
            flash.style.top = `${cellRect.top}px`;
            flash.style.width = `${cellRect.width}px`;
            flash.style.height = `${cellRect.height}px`;

            this.cellFlashesLayerEl.appendChild(flash);

            const cleanup = () => {
                if (flash.isConnected) flash.remove();
            };

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                flash.style.opacity = '0.45';
                window.setTimeout(cleanup, durationMs);
                return flash;
            }

            flash.addEventListener('animationend', cleanup, { once: true });
            window.setTimeout(cleanup, durationMs + 80);
            return flash;
        }

        fireCellFlashAtPointer(pointer) {
            const cell = this.getGridCellFromPointer(pointer);
            if (!cell) return;

            const payload = {
                col: cell.col,
                row: cell.row,
                color: this.getStrokeColor(),
            };
            this.playCellFlash(payload.col, payload.row, payload.color);
            if (this.slideId) {
                this.onOp({
                    op: 'cell',
                    slideId: this.slideId,
                    payload,
                });
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
            this.mountOverlayLayer(this.rulerLayerEl, root);
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
            const wasHidden = el.hidden;
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
            if (this.fabric && wasHidden !== el.hidden) {
                this.scheduleResize();
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

        static PING_HOLD_MS = Math.round(1000 / 6);
        static DEFAULT_PING_SIZE = 70;
        static DEFAULT_PING_STROKE_WIDTH = 6;
        static PING_RING_ANIMATION_MS = 900;

        pingSizePx(size) {
            const value = Number(size);
            if (Number.isFinite(value) && value >= 24) {
                return Math.round(Math.max(24, Math.min(140, value)));
            }
            const strokeWidth = Math.max(2, Math.min(16, Number(size) || TacticsCanvas.DEFAULT_STROKE_WIDTH));
            return Math.round(strokeWidth * 10);
        }

        getPingSize() {
            const settings = this.getToolSettings();
            const size = settings.pingSize ?? TacticsCanvas.DEFAULT_PING_SIZE;
            return this.pingSizePx(size);
        }

        pingStrokePx(strokeWidth) {
            const value = Number(strokeWidth);
            if (!Number.isFinite(value)) {
                return TacticsCanvas.DEFAULT_PING_STROKE_WIDTH;
            }
            return Math.round(Math.max(1, Math.min(12, value)));
        }

        getPingStrokeWidth() {
            const settings = this.getToolSettings();
            return this.pingStrokePx(settings.pingStrokeWidth ?? TacticsCanvas.DEFAULT_PING_STROKE_WIDTH);
        }

        startPingRingAnimation(ring, pingEl) {
            if (!ring || !pingEl) return;

            const duration = TacticsCanvas.PING_RING_ANIMATION_MS;
            const cleanup = () => {
                if (pingEl.isConnected) pingEl.remove();
            };

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                ring.style.opacity = '0.55';
                ring.style.transform = 'scale(0.85)';
                window.setTimeout(cleanup, duration);
                return;
            }

            const anim = ring.animate(
                [
                    { transform: 'scale(0.15)', opacity: 0.9 },
                    { opacity: 0.4, offset: 0.7 },
                    { transform: 'scale(1)', opacity: 0 },
                ],
                {
                    duration,
                    easing: 'ease-out',
                    fill: 'forwards',
                },
            );

            anim.onfinish = cleanup;
            window.setTimeout(cleanup, duration + 120);
        }

        playPing(nx, ny, color, size, strokeWidth) {
            this.ensurePingsLayer();
            const { width: overlayW, height: overlayH } = this.getOverlaySize();
            if (!this.pingsLayerEl || overlayW <= 0 || overlayH <= 0) return null;

            const x = Math.max(0, Math.min(1, Number(nx) || 0));
            const y = Math.max(0, Math.min(1, Number(ny) || 0));
            const pingColor = String(color || '#ff4444');
            const sizePx = this.pingSizePx(size);
            const strokePx = this.pingStrokePx(strokeWidth);

            const ping = document.createElement('div');
            ping.className = 'tactics-ping';
            ping.style.setProperty('--ping-color', pingColor);
            ping.style.setProperty('--ping-size', `${sizePx}px`);
            ping.style.setProperty('--ping-stroke', `${strokePx}px`);
            ping.style.transform = `translate(${Math.round(x * overlayW)}px, ${Math.round(y * overlayH)}px)`;

            const ring = document.createElement('span');
            ring.className = 'tactics-ping__ring';
            ping.appendChild(ring);

            this.pingsLayerEl.appendChild(ping);
            this.startPingRingAnimation(ring, ping);
            return ping;
        }

        firePingAtPointer(pointer) {
            if (!this.fabric || !pointer) return;
            const w = this.fabric.getWidth();
            const h = this.fabric.getHeight();
            if (w <= 0 || h <= 0) return;
            const pingSize = this.getPingSize();
            const pingStroke = this.getPingStrokeWidth();
            const payload = {
                x: pointer.x / w,
                y: pointer.y / h,
                color: this.getStrokeColor(),
                width: pingSize,
                stroke: pingStroke,
            };
            this.playPing(payload.x, payload.y, payload.color, payload.width, payload.stroke);
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

        shouldIgnoreCanvasHotkey(ev) {
            const target = ev?.target;
            if (!target) return false;
            const tag = target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
            if (target.isContentEditable) return true;

            const active = this.fabric?.getActiveObject();
            if (active?.isEditing) return true;
            return false;
        }

        getSelectedDrawingTargets() {
            if (!this.fabric || !this.canMoveObjects()) return [];

            const active = this.fabric.getActiveObject();
            if (!active) return [];

            const selected = active.type === 'activeSelection'
                ? active.getObjects()
                : [active];

            return selected.filter((obj) => obj && !this.isPreviewObject(obj) && !obj.isBackground);
        }

        deleteSelectedObjects() {
            if (!this.fabric || !this.canMoveObjects()) return;

            const targets = this.getSelectedDrawingTargets();
            if (!targets.length) return;

            const targetSet = new Set(targets);
            const toRemove = targets.filter((obj) => {
                if ((obj.tacticsArrowHead || obj.tacticsBarEnd) && obj.tacticsParent && targetSet.has(obj.tacticsParent)) {
                    return false;
                }
                return true;
            });

            this.isRemote = true;
            toRemove.forEach((target) => {
                if (target.tacticsType === 'line') {
                    this.removeAttachedArrowHeads(target);
                }
                this.fabric.remove(target);
            });
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

        bindDeleteKey() {
            if (this.deleteKeyBound) return;
            this.deleteKeyBound = true;

            window.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
                if (!this.fabric || !this.canMoveObjects()) return;
                if (this.shouldIgnoreCanvasHotkey(ev)) return;
                if (!this.getSelectedDrawingTargets().length) return;

                ev.preventDefault();
                this.deleteSelectedObjects();
            });
        }

        bindUndoRedoKeys() {
            if (this.undoKeyBound) return;
            this.undoKeyBound = true;

            window.addEventListener('keydown', (ev) => {
                if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
                if (!this.fabric || !this.drawEnabled) return;
                if (this.shouldIgnoreCanvasHotkey(ev)) return;

                const isUndo = ev.code === 'KeyZ' && !ev.shiftKey;
                const isRedo = (ev.code === 'KeyZ' && ev.shiftKey) || ev.code === 'KeyY';
                if (!isUndo && !isRedo) return;

                if (isUndo) {
                    if (this.historyIndex <= 0) return;
                    ev.preventDefault();
                    void this.undo();
                    return;
                }

                if (this.historyIndex >= this.history.length - 1) return;
                ev.preventDefault();
                void this.redo();
            }, true);
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

        bindContextMenuBlock() {
            const stack = this.getStackEl();
            if (!stack || stack.dataset.contextMenuBound) return;
            stack.dataset.contextMenuBound = '1';

            stack.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
            });
            stack.addEventListener('mousedown', (ev) => {
                if (ev.button === 2) ev.preventDefault();
            });
            stack.addEventListener('auxclick', (ev) => {
                if (ev.button === 2) ev.preventDefault();
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

        isTextObject(obj) {
            if (!obj || obj.isBackground || obj.isGridLine || obj.isDrawingPreview) {
                return false;
            }
            return obj.tacticsType === 'text' || obj.type === 'i-text' || obj.type === 'textbox';
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
            const measureWidth = columnRect?.width || 0;
            const measureHeight = columnRect?.height || 0;
            if (measureWidth <= 0 || measureHeight <= 0) return null;

            const labelsW = TacticsCanvas.LABEL_LEFT + TacticsCanvas.LABEL_GAP;
            const labelsH = TacticsCanvas.LABEL_TOP + TacticsCanvas.LABEL_GAP;
            const scaleEl = document.getElementById('tacticsMapScale');
            const scaleExtra = (scaleEl && !scaleEl.hidden) ? scaleEl.offsetHeight + 6 : 0;

            const maxW = measureWidth - labelsW;
            const maxH = measureHeight - labelsH - scaleExtra;
            const size = Math.floor(Math.min(maxW, maxH));
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

        setMapViewportLoading(loading) {
            const grid = this.getMapGridEl();
            if (grid) {
                grid.classList.toggle('is-map-loading', loading);
            }
        }

        async ensureCanvasLayout(maxFrames = 8) {
            if (!this.fabric) return;
            for (let i = 0; i < maxFrames; i += 1) {
                if (this.getSquareSize()) {
                    this.resize();
                    return;
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            this.resize();
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
            const stroke = 'rgba(100, 140, 175, 0.42)';
            const newLines = [];

            for (let i = 1; i < TacticsCanvas.GRID_DIVISIONS; i += 1) {
                const p = this.getGridLineCanvasCoord(i, size);
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
            const canEditText = this.drawEnabled && this.tool === 'text';
            const canPing = this.tool === 'ping';
            const canRuler = this.tool === 'ruler';
            const canCell = this.tool === 'cell';
            const canOverlayTool = canPing || canRuler || canCell;
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
                const isTextObj = this.isTextObject(obj);
                const isEditingText = (obj.type === 'i-text' || obj.type === 'textbox') && obj.isEditing;
                obj.selectable = canMove || isEditingText;
                obj.evented = canMove || canErase || isEditingText || (canEditText && isTextObj);
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
            wrap?.classList.toggle('tactics-canvas-wrap--cell', canCell);

            if (this.fabric.upperCanvasEl) {
                this.fabric.upperCanvasEl.style.pointerEvents = (readonly && !canOverlayTool) ? 'none' : '';
                if (canCell) {
                    this.fabric.upperCanvasEl.style.cursor = 'pointer';
                } else if (canPing || canRuler) {
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
                } else if (canCell) {
                    this.fabric.defaultCursor = 'pointer';
                } else if (canPing || canRuler) {
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
                this.applyStrokeColor(this.getStrokeColor(), { selectCustom: true });
            });
            this.strokeWidthEl?.addEventListener('input', () => {
                this.syncFreeDrawingBrushStyles();
                this.updateStrokeWidthLabel();
                this.saveToolPrefs();
            });
            window.AbsTacticsToolSettings?.onChange(() => {
                this.syncFreeDrawingBrushStyles();
                if (this.linePreview?.line) {
                    this.applyStrokeStyle(this.linePreview.line);
                }
                if (this.shapePreview) {
                    this.applyStrokeStyle(this.shapePreview);
                }
                if (this.polygonPreview) {
                    this.applyStrokeStyle(this.polygonPreview);
                }
                this.fabric?.requestRenderAll();
            });
            this.updateToolContext();

            this.imageUploadEl?.addEventListener('change', (ev) => {
                const file = ev.target.files?.[0];
                if (file) this.insertImageFromFile(file);
                ev.target.value = '';
            });
        }

        getCustomSwatchEl() {
            return document.getElementById('tacticsCustomColorSwatch')
                || document.querySelector('.tactics-palette-swatch[data-custom]');
        }

        updateCustomSwatch(color) {
            const el = this.getCustomSwatchEl();
            if (!el || !color) return;
            el.style.setProperty('--swatch-color', color);
            el.setAttribute('data-color', color);
        }

        static rgbToHex(r, g, b) {
            const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }

        static normalizeHexColor(color) {
            const value = String(color || '').trim();
            if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
            return null;
        }

        static hexToHue(hex) {
            const normalized = TacticsCanvas.normalizeHexColor(hex);
            if (!normalized) return 0;
            const r = parseInt(normalized.slice(1, 3), 16) / 255;
            const g = parseInt(normalized.slice(3, 5), 16) / 255;
            const b = parseInt(normalized.slice(5, 7), 16) / 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max === min) return 0;
            const d = max - min;
            let h = 0;
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
            return Math.round(h);
        }

        normalizeFabricColor(color) {
            if (!color || color === 'transparent') return null;
            if (typeof color === 'string') {
                return TacticsCanvas.normalizeHexColor(color);
            }
            if (typeof color?.toHex === 'function') {
                return TacticsCanvas.normalizeHexColor(`#${color.toHex()}`);
            }
            return null;
        }

        syncHueSliderFromColor(color) {
            if (!this.hueSliderEl) return;
            this.hueSliderEl.value = String(TacticsCanvas.hexToHue(color));
        }

        applyStrokeColor(color, options = {}) {
            const hex = TacticsCanvas.normalizeHexColor(color);
            if (!hex || !this.strokeColorEl) return;

            this.strokeColorEl.value = hex;
            if (options.selectCustom === true) {
                this.updateCustomSwatch(hex);
                this.syncHueSliderFromColor(hex);
            }
            this.syncBrushFromColor();
            this.updatePaletteSwatches();
            this.saveToolPrefs();
        }

        restorePaletteUi() {
            this.syncBrushFromColor();
            this.updatePaletteSwatches();
        }

        resetStrokeColor() {
            this.applyStrokeColor(TacticsCanvas.DEFAULT_STROKE_COLOR);
        }

        sampleColorFromObject(domEvent) {
            if (!this.fabric || !domEvent) return null;
            const target = this.fabric.findTarget(domEvent, false);
            if (!target || target.isGridLine) return null;

            if (!target.isBackground) {
                const stroke = this.normalizeFabricColor(target.stroke);
                if (stroke) return stroke;
                const fill = this.normalizeFabricColor(target.fill);
                if (fill) return fill;
            }

            return null;
        }

        sampleColorFromCanvas(domEvent) {
            const canvas = this.fabric?.lowerCanvasEl;
            if (!canvas || !domEvent) return null;

            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;

            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((domEvent.clientX - rect.left) * scaleX);
            const y = Math.floor((domEvent.clientY - rect.top) * scaleY);

            try {
                const ctx = canvas.getContext('2d');
                const data = ctx.getImageData(x, y, 1, 1).data;
                if (data[3] === 0) return null;
                return TacticsCanvas.rgbToHex(data[0], data[1], data[2]);
            } catch (e) {
                return null;
            }
        }

        sampleColorFromBackground(pointer) {
            const img = this.bgImageEl;
            const bg = this.fabric?.getObjects().find((o) => o.isBackground);
            if (!img || !bg || !img.width || !img.height || !pointer) return null;

            try {
                const bounds = bg.getBoundingRect();
                if (pointer.x < bounds.left || pointer.y < bounds.top
                    || pointer.x > bounds.left + bounds.width
                    || pointer.y > bounds.top + bounds.height) {
                    return null;
                }

                const relX = (pointer.x - bounds.left) / bounds.width;
                const relY = (pointer.y - bounds.top) / bounds.height;
                const px = Math.min(img.width - 1, Math.max(0, Math.floor(relX * img.width)));
                const py = Math.min(img.height - 1, Math.max(0, Math.floor(relY * img.height)));
                const off = document.createElement('canvas');
                off.width = 1;
                off.height = 1;
                const ctx = off.getContext('2d');
                ctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
                const data = ctx.getImageData(0, 0, 1, 1).data;
                return TacticsCanvas.rgbToHex(data[0], data[1], data[2]);
            } catch (e) {
                return null;
            }
        }

        sampleColorAtPointer(pointer, domEvent) {
            return this.sampleColorFromObject(domEvent)
                || this.sampleColorFromCanvas(domEvent)
                || this.sampleColorFromBackground(pointer);
        }

        supportsScreenEyeDropper() {
            return typeof window.EyeDropper === 'function';
        }

        setEyedropperActive(active) {
            this.eyedropperActive = !!active;
            document.getElementById('tacticsEyedropperBtn')?.classList.toggle('is-active', this.eyedropperActive);
            this.getWrapEl()?.classList.toggle('tactics-canvas-wrap--eyedropper', this.eyedropperActive);
        }

        async pickColorFromScreen() {
            if (this.supportsScreenEyeDropper()) {
                if (this.eyedropperPickInFlight) return;
                this.eyedropperPickInFlight = true;
                this.setEyedropperActive(true);
                try {
                    const dropper = new window.EyeDropper();
                    const result = await dropper.open();
                    const hex = TacticsCanvas.normalizeHexColor(result?.sRGBHex);
                    if (hex) {
                        this.applyStrokeColor(hex, { selectCustom: true });
                    }
                } catch (e) {
                    // AbortError — пользователь отменил выбор
                } finally {
                    this.eyedropperPickInFlight = false;
                    this.setEyedropperActive(false);
                }
                return;
            }

            const next = !this.eyedropperActive;
            this.setEyedropperActive(next);
            if (next) {
                this.setTool('select');
            }
        }

        bindPalette() {
            document.querySelectorAll('.tactics-palette-swatch').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const color = btn.getAttribute('data-color');
                    if (!color) return;
                    if (btn.dataset.custom === '1') {
                        this.applyStrokeColor(color, { selectCustom: true });
                        return;
                    }
                    this.applyStrokeColor(color);
                });
            });

            this.hueSliderEl?.addEventListener('input', () => {
                const hue = parseInt(this.hueSliderEl.value, 10) || 0;
                const color = TacticsCanvas.hslToHex(hue, 100, 50);
                this.applyStrokeColor(color, { selectCustom: true });
            });

            document.getElementById('tacticsResetColorBtn')?.addEventListener('click', () => {
                this.resetStrokeColor();
            });

            document.getElementById('tacticsEyedropperBtn')?.addEventListener('click', () => {
                void this.pickColorFromScreen();
            });

            if (!this.toolPrefsUnloadBound) {
                this.toolPrefsUnloadBound = true;
                window.addEventListener('pagehide', () => this.saveToolPrefs());
            }

            this.restorePaletteUi();
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

        getStrokeLineCap() {
            const lineType = this.getToolSettings().lineType || 'solid';
            return lineType === 'dotted' ? 'butt' : 'round';
        }

        applyStrokeStyle(obj) {
            if (!obj) return;
            const dash = this.getStrokeDashArray();
            obj.set({
                strokeDashArray: dash || null,
                strokeLineCap: this.getStrokeLineCap(),
            });
        }

        syncFreeDrawingBrushStyles() {
            const brush = this.fabric?.freeDrawingBrush;
            if (!brush) return;
            brush.color = this.getStrokeColor();
            brush.width = this.getStrokeWidth();
            brush.strokeDashArray = this.getStrokeDashArray();
            brush.strokeLineCap = this.getStrokeLineCap();
        }

        syncBrushFromColor() {
            this.syncFreeDrawingBrushStyles();
        }

        updatePaletteSwatches() {
            const current = (this.getStrokeColor() || '').toLowerCase();
            const swatches = Array.from(document.querySelectorAll('.tactics-palette-swatch'));
            const presetMatch = swatches.find((btn) => btn.dataset.custom !== '1'
                && (btn.getAttribute('data-color') || '').toLowerCase() === current);

            swatches.forEach((btn) => {
                const isCustom = btn.dataset.custom === '1';
                const color = (btn.getAttribute('data-color') || '').toLowerCase();
                let active = false;
                if (presetMatch) {
                    active = btn === presetMatch;
                } else if (isCustom) {
                    active = true;
                } else {
                    active = color === current;
                }
                btn.classList.toggle('is-active', active);
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

        setInteractionLocked(locked) {
            this.interactionLocked = !!locked;
            if (!this.interactionLocked) {
                this.setDrawEnabled(this.drawEnabled);
                return;
            }
            const strictDisabled = this.interactionLocked;

            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.disabled = strictDisabled;
                btn.classList.toggle('is-disabled', strictDisabled);
            });
            document.querySelectorAll('.tactics-palette-swatch, .tactics-palette-action-btn, .tactics-hue-slider, #tacticsStrokeWidth, #tacticsStrokeWidthShape, #tacticsFontSize, #tacticsShapeFilled, #tacticsShapeFillOpacity, #tacticsIconLabel, #tacticsIconSize, #tacticsIconLabelSize, #tacticsPingSize, #tacticsPingStrokeWidth, #tacticsCellFlashDuration, .tactics-option-btn, .tactics-icon-grid__btn')
                .forEach((el) => {
                    el.disabled = strictDisabled;
                    el.classList.toggle('is-disabled', strictDisabled);
                });
            ['tacticsUndoBtn', 'tacticsRedoBtn', 'tacticsClearBtn'].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = strictDisabled || !this.drawEnabled;
                btn.classList.toggle('is-disabled', btn.disabled);
            });

            if (strictDisabled) {
                this.stopPingHold();
                if (this.tool !== 'select') {
                    this.setTool('select');
                }
                this.fabric?.discardActiveObject();
            }

            this.syncInteractionState();
            this.fabric?.requestRenderAll();
        }

        setDrawEnabled(enabled) {
            this.drawEnabled = !!enabled;
            const disabled = !this.drawEnabled;

            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                const tool = btn.getAttribute('data-tool');
                const alwaysOn = tool === 'select' || tool === 'cell' || tool === 'ping' || tool === 'ruler';
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
                if (this.tool !== 'select' && this.tool !== 'cell' && this.tool !== 'ping' && this.tool !== 'ruler') {
                    this.setTool('select');
                }
            }
            this.syncInteractionState();
            this.fabric.requestRenderAll();
        }

        setTool(tool) {
            if (this.interactionLocked) return;
            if (!this.drawEnabled && tool !== 'select' && tool !== 'cell' && tool !== 'ping' && tool !== 'ruler') return;
            this.stopPingHold();
            if (tool !== 'ruler') {
                this.clearRuler();
            }
            this.clearLinePreview();
            this.clearShapePreview();
            this.clearPolygonPreview();
            this.shapeStart = null;
            this.polygonPoints = [];
            this.lineStart = null;
            this.tool = tool || 'select';
            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.tool);
            });
            this.updateToolContext();
            if (!this.fabric) return;

            this.fabric.isDrawingMode = this.drawEnabled && this.tool === 'pen';
            this.syncInteractionState();

            if (this.fabric.isDrawingMode) {
                this.fabric.freeDrawingBrush = new fabric.PencilBrush(this.fabric);
                this.syncFreeDrawingBrushStyles();
            }
        }

        getStrokeColor() {
            return this.strokeColorEl?.value || TacticsCanvas.DEFAULT_STROKE_COLOR;
        }

        getStrokeWidth() {
            return parseInt(this.strokeWidthEl?.value || String(TacticsCanvas.DEFAULT_STROKE_WIDTH), 10)
                || TacticsCanvas.DEFAULT_STROKE_WIDTH;
        }

        updateStrokeWidthLabel() {
            const el = document.getElementById('tacticsStrokeWidthValue');
            if (el && this.strokeWidthEl) {
                el.textContent = this.strokeWidthEl.value;
            }
        }

        getToolSettings() {
            return window.AbsTacticsToolSettings?.getState() || {};
        }

        getStrokeDashArray() {
            const lineType = this.getToolSettings().lineType || 'solid';
            return window.AbsTacticsToolSettings?.getStrokeDashArray(lineType, this.getStrokeWidth()) || null;
        }

        getEndType() {
            return this.getToolSettings().endType || 'none';
        }

        getArrowHeadLength() {
            const w = this.getStrokeWidth();
            return Math.max(10, w * 2.6);
        }

        getArrowSpread() {
            const w = this.getStrokeWidth();
            const headLen = this.getArrowHeadLength();
            const fromWidth = Math.atan((w * 1.2) / headLen);
            return Math.max(TacticsCanvas.ARROW_SPREAD, Math.min(Math.PI / 4.5, fromWidth));
        }

        getBarHalfLength() {
            const w = this.getStrokeWidth();
            return Math.max(5, w * 1.35);
        }

        getLineEndGeometry(x1, y1, tipX, tipY, endType) {
            const dx = tipX - x1;
            const dy = tipY - y1;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            let bodyX2 = tipX;
            let bodyY2 = tipY;

            const capPad = this.getStrokeWidth() / 2;
            if (endType === 'arrow' && dist > 0) {
                const headLen = this.getArrowHeadLength();
                const inset = headLen * Math.cos(this.getArrowSpread()) + capPad;
                if (dist > inset) {
                    bodyX2 = tipX - inset * Math.cos(angle);
                    bodyY2 = tipY - inset * Math.sin(angle);
                }
            } else if (endType === 'bar' && dist > capPad) {
                bodyX2 = tipX - capPad * Math.cos(angle);
                bodyY2 = tipY - capPad * Math.sin(angle);
            }

            return { bodyX2, bodyY2, tipX, tipY, angle, dist };
        }

        getShapeFill(color) {
            const settings = this.getToolSettings();
            const filled = !!settings.shapeFilled;
            const opacity = settings.shapeFillOpacity ?? 50;
            return window.AbsTacticsToolSettings?.getShapeFill(color, filled, opacity) ?? 'transparent';
        }

        normalizePolygonPoints(points) {
            if (!points.length) return { points: [], left: 0, top: 0 };
            const xs = points.map((p) => p.x);
            const ys = points.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return {
                left: minX,
                top: minY,
                points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
            };
        }

        clearPolygonPreview() {
            if (!this.fabric || !this.polygonPreview) return;
            this.isRemote = true;
            this.fabric.remove(this.polygonPreview);
            this.isRemote = false;
            this.polygonPreview = null;
            this.fabric.requestRenderAll();
        }

        updatePolygonPreview(cursorX, cursorY) {
            if (!this.fabric || this.tool !== 'polygon' || !this.polygonPoints.length) {
                this.clearPolygonPreview();
                return;
            }

            this.clearPolygonPreview();

            const color = this.getStrokeColor();
            const strokeWidth = this.getStrokeWidth();
            const previewPoints = [...this.polygonPoints];
            if (Number.isFinite(cursorX) && Number.isFinite(cursorY)) {
                previewPoints.push({ x: cursorX, y: cursorY });
            }

            if (previewPoints.length < 2) return;

            const normalized = this.normalizePolygonPoints(previewPoints);
            const shapeOpts = {
                left: normalized.left,
                top: normalized.top,
                fill: previewPoints.length >= 3 ? this.getShapeFill(color) : 'transparent',
                stroke: color,
                strokeWidth,
                selectable: false,
                evented: false,
                isDrawingPreview: true,
            };
            const shape = previewPoints.length >= 3
                ? new fabric.Polygon(normalized.points, shapeOpts)
                : new fabric.Polyline(normalized.points, shapeOpts);
            this.applyStrokeDash(shape);

            this.polygonPreview = shape;
            this.isRemote = true;
            this.fabric.add(shape);
            this.isRemote = false;
            this.fabric.requestRenderAll();
        }

        applyStrokeDash(obj) {
            this.applyStrokeStyle(obj);
        }

        updateToolContext() {
            window.AbsTacticsToolSettings?.showPanel(this.tool);
            window.AbsTacticsToolSettings?.syncUi();
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
            if (this.linePreview.barEnd) {
                this.fabric.remove(this.linePreview.barEnd);
            }
            if (this.linePreview.line) {
                this.fabric.remove(this.linePreview.line);
            }
            this.isRemote = false;
            this.linePreview = null;
            this.fabric.requestRenderAll();
        }

        buildArrowHeadAt(tipX, tipY, angle, options = {}) {
            const headLen = this.getArrowHeadLength();
            const spread = this.getArrowSpread();
            const absPoints = [
                { x: tipX, y: tipY },
                {
                    x: tipX - headLen * Math.cos(angle - spread),
                    y: tipY - headLen * Math.sin(angle - spread),
                },
                {
                    x: tipX - headLen * Math.cos(angle + spread),
                    y: tipY - headLen * Math.sin(angle + spread),
                },
            ];
            const normalized = this.normalizePolygonPoints(absPoints);
            return new fabric.Polygon(normalized.points, {
                left: normalized.left,
                top: normalized.top,
                fill: this.getStrokeColor(),
                stroke: null,
                strokeWidth: 0,
                objectCaching: false,
                selectable: false,
                evented: false,
                ...options,
            });
        }

        buildArrowHeadPolygon(line, options = {}) {
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
            return this.buildArrowHeadAt(line.x2, line.y2, angle, options);
        }

        clearPreviewLineEnd() {
            if (!this.fabric || !this.linePreview) return;
            ['arrowHead', 'barEnd'].forEach((key) => {
                if (!this.linePreview[key]) return;
                this.isRemote = true;
                this.fabric.remove(this.linePreview[key]);
                this.isRemote = false;
                this.linePreview[key] = null;
            });
        }

        syncPreviewArrowHead(line, tipX, tipY, angle) {
            if (!this.fabric || !this.linePreview) return;
            this.clearPreviewLineEnd();

            const tri = this.buildArrowHeadAt(tipX, tipY, angle);
            tri.isDrawingPreview = true;
            this.linePreview.arrowHead = tri;
            this.isRemote = true;
            this.fabric.add(tri);
            this.isRemote = false;
        }

        buildBarEndAt(tipX, tipY, angle, options = {}) {
            const half = this.getBarHalfLength();
            const perp = angle + Math.PI / 2;
            return new fabric.Line([
                tipX - half * Math.cos(perp),
                tipY - half * Math.sin(perp),
                tipX + half * Math.cos(perp),
                tipY + half * Math.sin(perp),
            ], {
                stroke: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
                strokeLineCap: 'round',
                selectable: false,
                evented: false,
                ...options,
            });
        }

        buildBarEndLine(line, options = {}) {
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
            return this.buildBarEndAt(line.x2, line.y2, angle, options);
        }

        syncPreviewBarEnd(line, tipX, tipY, angle) {
            if (!this.fabric || !this.linePreview) return;
            this.clearPreviewLineEnd();

            const bar = this.buildBarEndAt(tipX, tipY, angle);
            bar.isDrawingPreview = true;
            this.linePreview.barEnd = bar;
            this.isRemote = true;
            this.fabric.add(bar);
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
            this.applyStrokeDash(line);
            line.isDrawingPreview = true;
            this.linePreview = { line };

            this.isRemote = true;
            this.fabric.add(line);
            this.isRemote = false;

            this.syncLinePreviewEnds(x, y);
        }

        syncLinePreviewEnds(tipX, tipY) {
            const line = this.linePreview?.line;
            if (!line || !this.fabric) return;

            const endType = this.getEndType();
            const geom = this.getLineEndGeometry(line.x1, line.y1, tipX, tipY, endType);
            line.set({ x2: geom.bodyX2, y2: geom.bodyY2 });
            line.setCoords();

            if (endType === 'arrow') {
                this.syncPreviewArrowHead(line, geom.tipX, geom.tipY, geom.angle);
            } else if (endType === 'bar') {
                this.syncPreviewBarEnd(line, geom.tipX, geom.tipY, geom.angle);
            } else {
                this.clearPreviewLineEnd();
            }
        }

        updateLinePreview(x, y) {
            const line = this.linePreview?.line;
            if (!line || !this.fabric) return;

            this.syncLinePreviewEnds(x, y);

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
            const fill = this.getShapeFill(color);
            let shape = null;

            if (this.tool === 'rect') {
                shape = new fabric.Rect({
                    left: Math.min(start.x, x),
                    top: Math.min(start.y, y),
                    width: Math.abs(x - start.x),
                    height: Math.abs(y - start.y),
                    fill,
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            } else if (this.tool === 'circle') {
                const radius = Math.hypot(x - start.x, y - start.y) / 2;
                shape = this.createCircleShape({
                    left: (start.x + x) / 2 - radius,
                    top: (start.y + y) / 2 - radius,
                    radius,
                    fill,
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            }

            if (!shape) return;
            if (this.tool !== 'circle') {
                this.applyStrokeDash(shape);
            }
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
            const fill = this.getShapeFill(color);
            let shape = null;

            if (this.tool === 'rect') {
                shape = new fabric.Rect({
                    left: Math.min(start.x, x),
                    top: Math.min(start.y, y),
                    width: Math.abs(x - start.x),
                    height: Math.abs(y - start.y),
                    fill,
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            } else if (this.tool === 'circle') {
                const radius = Math.hypot(x - start.x, y - start.y) / 2;
                shape = this.createCircleShape({
                    left: (start.x + x) / 2 - radius,
                    top: (start.y + y) / 2 - radius,
                    radius,
                    fill,
                    stroke: color,
                    strokeWidth,
                    selectable: false,
                    evented: false,
                });
            }

            if (!shape) return;
            if (this.tool !== 'circle') {
                this.applyStrokeDash(shape);
            }
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
                this.clearPolygonPreview();
                return;
            }
            const points = this.polygonPoints.map((p) => ({ x: p.x, y: p.y }));
            this.polygonPoints = [];
            this.clearPolygonPreview();

            const color = this.getStrokeColor();
            const normalized = this.normalizePolygonPoints(points);
            const poly = new fabric.Polygon(normalized.points, {
                left: normalized.left,
                top: normalized.top,
                fill: this.getShapeFill(color),
                stroke: color,
                strokeWidth: this.getStrokeWidth(),
                selectable: false,
                evented: false,
            });
            this.applyStrokeDash(poly);
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

            const endType = this.getEndType();
            const geom = this.getLineEndGeometry(start.x, start.y, x, y, endType);
            const line = new fabric.Line([start.x, start.y, geom.bodyX2, geom.bodyY2], {
                stroke: this.getStrokeColor(),
                strokeWidth: this.getStrokeWidth(),
                selectable: false,
                evented: false,
                strokeLineCap: 'round',
            });
            this.applyStrokeDash(line);
            line.set('tacticsType', 'line');
            line.set('tacticsEndType', endType);
            this.ensureTacticsId(line);

            this.isRemote = true;
            this.fabric.add(line);
            if (endType === 'arrow') {
                this.addArrowHeadAt(geom.tipX, geom.tipY, geom.angle, line);
            } else if (endType === 'bar') {
                this.addBarEndAt(geom.tipX, geom.tipY, geom.angle, line);
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
            'tacticsBarEnd',
            'tacticsParent',
            'tacticsId',
            'tacticsParentId',
            'tacticsIconId',
            'tacticsIconMarker',
            'tacticsIconLabel',
            'tacticsIconLabelSize',
            'tacticsIconLabelPlacement',
            'tacticsIconSize',
            'tacticsEndType',
        ];

        removeAttachedArrowHeads(parent) {
            if (!this.fabric || !parent) return;

            const parentId = parent.tacticsId;
            this.fabric.getObjects().forEach((obj) => {
                if (!obj.tacticsArrowHead && !obj.tacticsBarEnd) return;
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
            if (target.tacticsType === 'line' || target.tacticsArrowHead || target.tacticsBarEnd) {
                if ((target.tacticsArrowHead || target.tacticsBarEnd) && target.tacticsParent) {
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

        addArrowHeadAt(tipX, tipY, angle, line) {
            const parentId = this.ensureTacticsId(line);
            const tri = this.buildArrowHeadAt(tipX, tipY, angle);
            tri.set('tacticsArrowHead', true);
            tri.set('tacticsParent', line);
            tri.set('tacticsParentId', parentId);
            this.fabric.add(tri);
        }

        addArrowHead(line) {
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
            this.addArrowHeadAt(line.x2, line.y2, angle, line);
        }

        addBarEndAt(tipX, tipY, angle, line) {
            const parentId = this.ensureTacticsId(line);
            const bar = this.buildBarEndAt(tipX, tipY, angle);
            bar.set('tacticsBarEnd', true);
            bar.set('tacticsParent', line);
            bar.set('tacticsParentId', parentId);
            this.fabric.add(bar);
        }

        addBarEnd(line) {
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
            this.addBarEndAt(line.x2, line.y2, angle, line);
        }

        getMarkerViewBoxSize(markerDef) {
            const parts = String(markerDef?.viewBox || '0 0 14 18').trim().split(/\s+/).map(Number);
            return { width: parts[2] || 14, height: parts[3] || 18 };
        }

        getIconMarkerScale(markerDef, iconSize) {
            const size = Number.isFinite(iconSize)
                ? iconSize
                : (this.getToolSettings().iconSize ?? TacticsCanvas.DEFAULT_ICON_SIZE);
            if (!markerDef) return 1;
            const { height } = this.getMarkerViewBoxSize(markerDef);
            return size / Math.max(1, height);
        }

        getIconGlyphSize(iconSize, onMarker = false) {
            const size = Number.isFinite(iconSize)
                ? iconSize
                : (this.getToolSettings().iconSize ?? TacticsCanvas.DEFAULT_ICON_SIZE);
            if (onMarker) {
                return Math.max(7, Math.round(size * 0.55));
            }
            return Math.max(8, Math.round(size));
        }

        measurePartExtents(part) {
            if (!part) return { halfW: 8, halfH: 8 };

            part.set({
                left: 0,
                top: 0,
                originX: 'center',
                originY: 'center',
            });
            if (typeof part.initDimensions === 'function') {
                part.initDimensions();
            }
            part.setCoords();

            const rect = part.getBoundingRect(false, true);
            if (rect.width > 0 && rect.height > 0) {
                const scale = Math.max(part.scaleX ?? 1, part.scaleY ?? 1);
                const strokePad = (part.strokeWidth || 0) * scale / 2;
                return {
                    halfW: rect.width / 2 + strokePad,
                    halfH: rect.height / 2 + strokePad,
                };
            }

            const scaleY = part.scaleY ?? 1;
            if (part.fontSize) {
                const fs = part.fontSize * scaleY;
                return { halfW: fs / 2 + 1, halfH: fs / 2 + 1 };
            }

            return { halfW: 8, halfH: 8 };
        }

        measurePartLabelExtents(part) {
            const extents = this.measurePartExtents(part);
            if (part?.type === 'path') {
                return {
                    halfW: extents.halfW,
                    halfH: extents.halfH + TacticsCanvas.ICON_LABEL_MARKER_BODY_EXTRA,
                };
            }
            return extents;
        }

        getIconLabelGap(bodyPart) {
            if (bodyPart?.type === 'path') {
                return TacticsCanvas.ICON_LABEL_GAP + TacticsCanvas.ICON_LABEL_MARKER_GAP_EXTRA;
            }
            return TacticsCanvas.ICON_LABEL_GAP;
        }

        measureIconLabelSize(label, fontSize) {
            const text = new fabric.Text(label, {
                fontSize,
                fontFamily: TacticsCanvas.ICON_LABEL_FONT,
                backgroundColor: 'rgba(0,0,0,0.45)',
            });
            return { width: text.width || 0, height: text.height || fontSize };
        }

        pickIconLabelSide(preferred, spaceRight, spaceLeft, needHoriz) {
            if (preferred === 'right' && spaceRight >= needHoriz) return 'right';
            if (preferred === 'left' && spaceLeft >= needHoriz) return 'left';
            if (spaceRight >= needHoriz) return 'right';
            if (spaceLeft >= needHoriz) return 'left';
            return preferred;
        }

        resolveIconLabelPlacement(x, y, labelSize, bodyHalfW, bodyHalfH, labelGap = TacticsCanvas.ICON_LABEL_GAP) {
            const w = this.fabric?.getWidth() || 0;
            const h = this.fabric?.getHeight() || 0;
            if (!w || !h) return 'bottom';

            const margin = TacticsCanvas.ICON_LABEL_EDGE_MARGIN;
            const gap = labelGap;
            const needVert = bodyHalfH + gap + labelSize.height;
            const needHoriz = bodyHalfW + gap + labelSize.width;
            const needDiag = bodyHalfH + gap + Math.max(labelSize.height, labelSize.width * 0.6);

            const spaceBelow = h - y - margin;
            const spaceAbove = y - margin;
            const spaceRight = w - x - margin;
            const spaceLeft = x - margin;

            const labelHalfW = labelSize.width / 2;
            const nearTop = y - bodyHalfH < margin;
            const nearBottom = y + bodyHalfH > h - margin;
            const nearLeft = x - Math.max(bodyHalfW, labelHalfW) < margin;
            const nearRight = x + Math.max(bodyHalfW, labelHalfW) > w - margin;

            if (nearTop && nearLeft && spaceRight >= needDiag && spaceBelow >= needDiag) return 'bottom-right';
            if (nearTop && nearRight && spaceLeft >= needDiag && spaceBelow >= needDiag) return 'bottom-left';
            if (nearBottom && nearLeft && spaceRight >= needDiag && spaceAbove >= needDiag) return 'top-right';
            if (nearBottom && nearRight && spaceLeft >= needDiag && spaceAbove >= needDiag) return 'top-left';

            if (nearTop && nearLeft) return this.pickIconLabelSide('right', spaceRight, spaceLeft, needHoriz);
            if (nearTop && nearRight) return this.pickIconLabelSide('left', spaceRight, spaceLeft, needHoriz);
            if (nearBottom && nearLeft) return this.pickIconLabelSide('right', spaceRight, spaceLeft, needHoriz);
            if (nearBottom && nearRight) return this.pickIconLabelSide('left', spaceRight, spaceLeft, needHoriz);

            const clipsLeft = x - labelHalfW < margin;
            const clipsRight = x + labelHalfW > w - margin;

            if (clipsLeft || clipsRight) {
                if (clipsLeft && !clipsRight) return this.pickIconLabelSide('right', spaceRight, spaceLeft, needHoriz);
                if (clipsRight && !clipsLeft) return this.pickIconLabelSide('left', spaceRight, spaceLeft, needHoriz);
                return this.pickIconLabelSide(
                    spaceRight >= spaceLeft ? 'right' : 'left',
                    spaceRight,
                    spaceLeft,
                    needHoriz,
                );
            }

            if (spaceBelow >= needVert) return 'bottom';
            if (spaceAbove >= needVert) return 'top';

            return this.pickIconLabelSide(
                spaceRight >= spaceLeft ? 'right' : 'left',
                spaceRight,
                spaceLeft,
                needHoriz,
            );
        }

        getIconBodyPart(objects) {
            const path = objects.find((o) => o.type === 'path');
            if (path) return path;
            return objects.find((o) => o.type === 'text'
                && String(o.fontFamily || '').includes('Font Awesome'))
                || objects[0];
        }

        getIconLabelPart(objects) {
            return objects.find((o) => o.type === 'text'
                && String(o.fontFamily || '').includes(TacticsCanvas.ICON_LABEL_FONT));
        }

        positionIconGroup(group, canvasX, canvasY, placement) {
            if (!group) return;

            const objects = group.getObjects();
            const body = this.getIconBodyPart(objects);
            const label = this.getIconLabelPart(objects);

            if (label && body) {
                if (placement === 'left' || placement === 'right') {
                    label.set({ top: body.top });
                } else if (placement === 'top' || placement === 'bottom') {
                    label.set({ left: body.left });
                }
            }

            const anchorLeft = body?.left ?? 0;
            const anchorTop = body?.top ?? 0;
            group.set({
                left: canvasX - anchorLeft,
                top: canvasY - anchorTop,
                originX: 'center',
                originY: 'center',
            });
            group.setCoords();
        }

        buildIconLabelText(label, fontSize, placement, bodyHalfW, bodyHalfH, labelGap = TacticsCanvas.ICON_LABEL_GAP) {
            const gap = labelGap;
            const base = {
                fontSize,
                fill: '#f0f0f0',
                fontFamily: TacticsCanvas.ICON_LABEL_FONT,
                backgroundColor: 'rgba(0,0,0,0.45)',
                textAlign: 'center',
            };

            if (placement === 'top') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'center',
                    originY: 'bottom',
                    top: -(bodyHalfH + gap),
                });
            }
            if (placement === 'bottom-right') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'left',
                    originY: 'top',
                    left: bodyHalfW + gap,
                    top: bodyHalfH + gap,
                });
            }
            if (placement === 'bottom-left') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'right',
                    originY: 'top',
                    left: -(bodyHalfW + gap),
                    top: bodyHalfH + gap,
                });
            }
            if (placement === 'top-right') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'left',
                    originY: 'bottom',
                    left: bodyHalfW + gap,
                    top: -(bodyHalfH + gap),
                });
            }
            if (placement === 'top-left') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'right',
                    originY: 'bottom',
                    left: -(bodyHalfW + gap),
                    top: -(bodyHalfH + gap),
                });
            }
            if (placement === 'left') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'right',
                    originY: 'center',
                    left: -(bodyHalfW + gap),
                });
            }
            if (placement === 'right') {
                return new fabric.Text(label, {
                    ...base,
                    originX: 'left',
                    originY: 'center',
                    left: bodyHalfW + gap,
                });
            }
            return new fabric.Text(label, {
                ...base,
                originX: 'center',
                originY: 'top',
                top: bodyHalfH + gap,
            });
        }

        insertIconAt(x, y) {
            if (!this.fabric || !this.drawEnabled) return;

            const settings = this.getToolSettings();
            const iconsApi = window.AbsTacticsIcons;
            const markerKey = settings.iconMarker || null;
            const iconKey = settings.iconId || null;
            const markerDef = markerKey ? iconsApi?.MARKERS?.[markerKey] : null;
            const iconDef = iconKey
                ? iconsApi?.ICONS?.find((item) => item.id === iconKey)
                : null;
            if (!markerDef && !iconDef) return;

            const color = this.getStrokeColor();
            const parts = [];

            const iconSize = Math.round((this.getToolSettings().iconSize ?? TacticsCanvas.DEFAULT_ICON_SIZE));
            const onMarker = Boolean(markerDef);
            const markerScale = this.getIconMarkerScale(markerDef, iconSize);
            const glyphSize = this.getIconGlyphSize(iconSize, onMarker);
            let bodyPart = null;

            if (markerDef) {
                bodyPart = new fabric.Path(markerDef.path, {
                    fill: color,
                    stroke: color,
                    strokeWidth: 0.5,
                    originX: 'center',
                    originY: 'center',
                    scaleX: markerScale,
                    scaleY: markerScale,
                });
                parts.push(bodyPart);
            }

            if (iconDef) {
                const glyph = iconsApi.getGlyph(iconDef.fa);
                if (glyph) {
                    const glyphPart = new fabric.Text(glyph, {
                        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Pro", FontAwesome',
                        fontWeight: '900',
                        fontSize: glyphSize,
                        fill: '#ffffff',
                        originX: 'center',
                        originY: 'center',
                        top: markerDef ? -1 : 0,
                    });
                    parts.push(glyphPart);
                    if (!bodyPart) bodyPart = glyphPart;
                }
            }

            if (!parts.length) return;

            const bodyExtents = this.measurePartLabelExtents(bodyPart);
            const labelGap = this.getIconLabelGap(bodyPart);
            const label = String(settings.iconLabel || '').trim();
            const labelFontSize = Math.max(8, Math.min(24, settings.iconLabelSize ?? TacticsCanvas.DEFAULT_ICON_LABEL_SIZE));
            let labelPlacement = 'bottom';
            if (label) {
                const labelSize = this.measureIconLabelSize(label, labelFontSize);
                labelPlacement = this.resolveIconLabelPlacement(
                    x,
                    y,
                    labelSize,
                    bodyExtents.halfW,
                    bodyExtents.halfH,
                    labelGap,
                );
                parts.push(this.buildIconLabelText(
                    label,
                    labelFontSize,
                    labelPlacement,
                    bodyExtents.halfW,
                    bodyExtents.halfH,
                    labelGap,
                ));
            }

            const group = new fabric.Group(parts, {
                selectable: false,
                evented: false,
            });
            this.positionIconGroup(group, x, y, labelPlacement);
            group.set('tacticsType', 'icon');
            group.set('tacticsIconId', iconDef?.id || '');
            group.set('tacticsIconMarker', markerKey || '');
            group.set('tacticsIconLabel', label);
            group.set('tacticsIconLabelSize', label ? labelFontSize : 0);
            group.set('tacticsIconLabelPlacement', label ? labelPlacement : '');
            group.set('tacticsIconSize', iconSize);
            this.ensureTacticsId(group);

            this.isRemote = true;
            this.fabric.add(group);
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

        handleMouseDown(opt) {
            if (!this.fabric || this.isRemote) return;
            if (opt.e?.button === 2) return;
            const pointer = this.fabric.getPointer(opt.e);

            if (this.eyedropperActive && !this.supportsScreenEyeDropper() && opt.e) {
                const hex = this.sampleColorAtPointer(pointer, opt.e);
                if (hex) {
                    this.applyStrokeColor(hex, { selectCustom: true });
                }
                this.setEyedropperActive(false);
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

            if (this.tool === 'cell') {
                this.fireCellFlashAtPointer(pointer);
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
                const existingText = this.fabric.findTarget(opt.e, false);
                if (this.isTextObject(existingText)) {
                    this.fabric.setActiveObject(existingText);
                    this.syncInteractionState();
                    if (existingText.enterEditing) {
                        existingText.enterEditing(opt.e);
                    }
                    return;
                }

                const settings = this.getToolSettings();
                const fontSize = settings.fontSize || 16;
                const textAlign = settings.textAlign || 'left';
                const color = this.getStrokeColor();
                const baseOpts = {
                    left: pointer.x,
                    top: pointer.y,
                    fill: color,
                    fontSize,
                    fontFamily: 'Segoe UI, sans-serif',
                    textAlign,
                };
                let text;
                if (settings.textType === 'label') {
                    text = new fabric.Textbox('Text', {
                        ...baseOpts,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        padding: 4,
                        width: 80,
                    });
                } else if (settings.textType === 'callout') {
                    text = new fabric.Textbox('Text', {
                        ...baseOpts,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: 6,
                        width: 90,
                        borderColor: color,
                        borderWidth: 1,
                    });
                } else {
                    text = new fabric.IText('Text', baseOpts);
                }
                text.set('tacticsType', 'text');
                this.ensureTacticsId(text);
                this.fabric.add(text);
                this.syncInteractionState();
                this.fabric.setActiveObject(text);
                if (text.enterEditing) {
                    text.enterEditing();
                }
                return;
            }

            if (this.tool === 'image') {
                this.insertIconAt(pointer.x, pointer.y);
                return;
            }

            if (this.tool === 'line') {
                this.startLinePreview(pointer.x, pointer.y);
                return;
            }

            if (this.tool === 'rect' || this.tool === 'circle') {
                this.shapeStart = { x: pointer.x, y: pointer.y };
                return;
            }

            if (this.tool === 'polygon') {
                if (opt.e?.detail >= 2 && this.polygonPoints.length >= 3) {
                    this.finishPolygon();
                    return;
                }
                if (this.polygonPoints.length >= 3) {
                    const first = this.polygonPoints[0];
                    if (Math.hypot(pointer.x - first.x, pointer.y - first.y) < 14) {
                        this.finishPolygon();
                        return;
                    }
                }
                this.polygonPoints.push({ x: pointer.x, y: pointer.y });
                this.updatePolygonPreview(pointer.x, pointer.y);
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

            if (this.tool === 'polygon' && this.polygonPoints.length) {
                this.updatePolygonPreview(pointer.x, pointer.y);
                return;
            }

            if (!this.drawEnabled || !this.lineStart) return;
            if (this.tool !== 'line') return;

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

            if (this.tool !== 'line') return;
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
            }
            this.historyIndex = this.history.length - 1;
        }

        async undo() {
            if (!this.drawEnabled || this.historyIndex <= 0 || !this.fabric) return;
            this.historyIndex -= 1;
            await this.loadJson(this.history[this.historyIndex], true);
            this.onChange();
            this.broadcastFull();
        }

        async redo() {
            if (!this.drawEnabled || this.historyIndex >= this.history.length - 1 || !this.fabric) return;
            this.historyIndex += 1;
            await this.loadJson(this.history[this.historyIndex], true);
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
                if (obj.type === 'line' && (obj.tacticsType === 'line' || obj.tacticsType === 'arrow')) {
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
            if (this.getSquareSize()) {
                this.resize();
            }
            this.bgImageEl = img;
            this.fitBackground();
            this.syncGridOverlay();
            this.fabric.requestRenderAll();
        }

        async loadSlide(slide, mapUrl) {
            this.initFabric();
            if (!this.fabric || !slide) return;

            this.setMapViewportLoading(true);
            try {
                this.stopPingHold();
                this.clearRemoteCursors();
                this.clearRemoteStrokes();
                this.clearPings();
                this.clearCellFlashes();
                this.clearRuler();
                this.slideId = slide.id;
                this.mapCode = slide.map_code || 'cliff';
                await this.refreshMapScaleInfo(slide);
                await this.ensureCanvasLayout();

                this.isRemote = true;
                this.fabric.clear();
                this.bgImageEl = null;
                this.bgLayout = null;
                this.isRemote = false;

                const publicId = String(window.ABS_TACTICS_PUBLIC_ID || '');
                const resolvedUrl = mapUrl || maps().slideMapUrl(slide, publicId);
                const cached = maps().getCachedImage(resolvedUrl);

                const imgPromise = maps().loadMapImage(
                    this.mapCode,
                    slide.game,
                    slide.battle_mode,
                    resolvedUrl,
                    slide,
                    publicId,
                );
                const jsonPromise = slide.canvas ? this.loadJson(slide.canvas, true) : Promise.resolve();

                if (cached) {
                    this.showBackgroundImage(cached);
                }

                const img = await imgPromise;
                if (img && img !== this.bgImageEl) {
                    this.showBackgroundImage(img);
                }

                await jsonPromise;
                await this.ensureCanvasLayout();

                this.history = [this.exportJson()];
                this.historyIndex = 0;
                this.scheduleResize();
                this.updateGridToggleBtn();
                this.syncInteractionState();
                this.fabric.requestRenderAll();
            } finally {
                this.setMapViewportLoading(false);
            }
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
                if (this.getSquareSize()) {
                    this.resize();
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
                    this.playPing(p.x, p.y, p.color, p.width, p.stroke);
                } else if (msg.op === 'cell' && msg.payload) {
                    const p = msg.payload;
                    const col = Math.min(9, Math.max(0, parseInt(p.col, 10) || 0));
                    const row = Math.min(9, Math.max(0, parseInt(p.row, 10) || 0));
                    this.playCellFlash(col, row, p.color);
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

        exportScreenshot() {
            if (!this.fabric) return null;
            try {
                const w = this.fabric.getWidth();
                const mult = this.bgImageEl && this.bgImageEl.naturalWidth > w
                    ? this.bgImageEl.naturalWidth / w
                    : 2;
                return this.fabric.toDataURL({ format: 'png', multiplier: mult });
            } catch (e) {
                return null;
            }
        }
    }

    window.TacticsCanvas = TacticsCanvas;
})();
