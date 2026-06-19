(() => {
    'use strict';

    const maps = () => window.AbsTacticsMaps;

    function createTacticsPencilBrush(canvas, canvasCtrl) {
        if (!window.fabric?.PencilBrush) {
            return null;
        }
        return new (fabric.util.createClass(fabric.PencilBrush, {
            onMouseDown(pointer, options) {
                if (canvasCtrl?.shouldIgnorePenDown?.(pointer)) {
                    canvasCtrl.penStrokeSuppressed = true;
                    this._isCurrentlyDrawing = false;
                    canvasCtrl.cancelPenStroke?.();
                    return;
                }
                canvasCtrl.penStrokeSuppressed = false;
                this.callSuper('onMouseDown', pointer, options);
            },

            onMouseUp(pointer) {
                const result = this.callSuper('onMouseUp', pointer);
                canvasCtrl?.onPenBrushMouseUp?.();
                return result;
            },

            _reset() {
                this.callSuper('_reset');
                this._smoothPoint = null;
                this._lastAddedPoint = null;
            },

            _prepareForDrawing(pointer) {
                this._reset();
                const smoothed = this._smoothPointer(pointer);
                const p = new fabric.Point(smoothed.x, smoothed.y);
                this._addPoint(p);
                this._lastAddedPoint = p;
                this.canvas.contextTop.moveTo(p.x, p.y);
            },

            _captureDrawingPath(pointer) {
                const smoothed = this._smoothPointer(pointer);
                const point = new fabric.Point(smoothed.x, smoothed.y);
                const minDist = TacticsCanvas.PEN_MIN_POINT_DIST;
                if (this._lastAddedPoint) {
                    const dx = point.x - this._lastAddedPoint.x;
                    const dy = point.y - this._lastAddedPoint.y;
                    if (dx * dx + dy * dy < minDist * minDist) {
                        return false;
                    }
                }
                const added = this._addPoint(point);
                if (added) {
                    this._lastAddedPoint = point;
                    canvasCtrl?.queueStrokePointBroadcast?.(pointer);
                }
                return added;
            },

            _smoothPointer(pointer) {
                const factor = TacticsCanvas.PEN_SMOOTHING;
                if (!this._smoothPoint) {
                    this._smoothPoint = { x: pointer.x, y: pointer.y };
                    return this._smoothPoint;
                }
                this._smoothPoint.x += (pointer.x - this._smoothPoint.x) * factor;
                this._smoothPoint.y += (pointer.y - this._smoothPoint.y) * factor;
                return this._smoothPoint;
            },

            needsFullRender() {
                const endType = canvasCtrl?.getEndType?.() || 'none';
                const lineType = canvasCtrl?.getToolSettings?.()?.lineType || 'solid';
                if (endType === 'arrow' || endType === 'bar' || lineType !== 'solid') {
                    return true;
                }
                return this.callSuper('needsFullRender');
            },

            _render(ctx) {
                ctx = ctx || this.canvas.contextTop;
                const endType = canvasCtrl?.getEndType?.() || 'none';
                const lineType = canvasCtrl?.getToolSettings?.()?.lineType || 'solid';
                if ((endType === 'arrow' || endType === 'bar')
                    && canvasCtrl?.renderPenBrushLivePreview?.(ctx, this, endType)) {
                    return;
                }
                if (lineType !== 'solid'
                    && canvasCtrl?.renderPenBrushBodyPreview?.(ctx, this)) {
                    return;
                }
                if (canvasCtrl?.applyPenBrushStrokeStyles) {
                    canvasCtrl.applyPenBrushStrokeStyles(ctx, this);
                } else {
                    this._setBrushStyles(ctx);
                }
                this.callSuper('_render', ctx);
            },
        }))(canvas);
    }

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
            this.game = 'wot';
            this.mapCode = 'cliff';
            this.mapSideLength = null;
            this.mapScale = null;
            this.fabric = null;
            this.tool = 'select';
            this.isRemote = false;
            this.history = [];
            this.historyIndex = -1;
            this.foreignObjectAuthors = new Map();
            this.penLivePointer = null;
            this.penLastDownAt = 0;
            this.penLastDownPoint = null;
            this.penStrokeSuppressed = false;
            this.penMouseUpCleanupRaf = 0;
            this.bgImageEl = null;
            this.layoutCanvasSize = null;
            this.suppressCanvasScale = false;
            this.mapCssZoom = 1;
            this.mapCssPanX = 0;
            this.mapCssPanY = 0;
            this.mapCssLayoutSize = null;
            this.mapPanActive = false;
            this.mapPanStartX = 0;
            this.mapPanStartY = 0;
            this.mapPanOriginX = 0;
            this.mapPanOriginY = 0;
            this.mapPanMoveHandler = null;
            this.mapPanUpHandler = null;
            this.mapWheelBound = false;
            this.resizeObserver = null;
            this.showGrid = options.showGrid !== false;
            this.drawEnabled = options.drawEnabled !== false;
            this.onGridChange = options.onGridChange || (() => {});
            this.cursorPrefsStorageKey = options.cursorPrefsStorageKey !== undefined
                ? options.cursorPrefsStorageKey
                : TacticsCanvas.CURSOR_PREFS_KEY;
            this.onCursorPrefsChange = options.onCursorPrefsChange || null;
            const cursorPrefs = options.initialCursorPrefs
                || (this.cursorPrefsStorageKey
                    ? TacticsCanvas.loadCursorPrefs(this.cursorPrefsStorageKey)
                    : { showRemoteCursors: true, shareMyCursor: true });
            this.showRemoteCursors = cursorPrefs.showRemoteCursors !== false;
            this.shareMyCursor = cursorPrefs.shareMyCursor !== false;
            this.shareMyCursorAllowed = true;
            this.getNickname = options.getNickname || (() => '');
            this.remoteCursors = new Map();
            this.cursorsLayerEl = null;
            this.pingsLayerEl = null;
            this.activeSlide = null;
            this.spawnOverlayGeneration = 0;
            this.cellFlashesLayerEl = null;
            this.pendingCursorPayload = null;
            this.lastCursorPayload = null;
            this.pingHoldActive = false;
            this.pingHoldTimer = null;
            this.pingHoldPointer = null;
            this.cellDragActive = false;
            this.cellDragSeen = new Set();
            this.cellDragLastCol = null;
            this.cellDragLastRow = null;
            this.cellDragReleaseBound = false;
            this.rulerLayerEl = null;
            this.rulerDragStart = null;
            this.rulerDragActive = false;
            this.rulerMeasurement = null;
            this.remoteStrokesLayerEl = null;
            this.remoteStrokes = new Map();
            this.localStrokeId = null;
            this.localStrokeSegments = [];
            this.localStrokeBroadcastPos = { seg: 0, pt: 0 };
            this.localStrokeBroadcastOutside = false;
            this.localStrokeLastOutsideNorm = null;
            this.strokePointBroadcastRaf = 0;
            this.lastStrokePointBroadcastAt = 0;
            this.loadSlideGeneration = 0;
            this.isSlideLoading = false;
            this.shapeStart = null;
            this.shapePreview = null;
            this.polygonPoints = [];
            this.polygonPreview = null;
            this.clipboardData = null;
            this.clipboardPasteCount = 0;
            this.eyedropperActive = false;
            this.eyedropperPickInFlight = false;
            this.eraserStrokeActive = false;
            this.eraserDragStarted = false;
            this.eraserDeferSync = false;
            this.eraserStartPointer = null;
            this.eraserStartEvent = null;
            this.eraserErasedKeys = new Set();
            this.transformMovedTarget = null;
            this.transformModifiedAt = 0;
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
        static ARROW_LOOKBACK = 4;
        static ARROW_HEAD_SPREAD = Math.PI / 4;
        static ARROW_HEAD_LENGTH_SCALE = 2.4;
        static WT_TEND_SCALE2 = 1.5;
        static ICON_LABEL_FONT = 'Segoe UI, sans-serif';
        static ICON_LABEL_GAP = 4;
        static ICON_LABEL_MARKER_GAP_EXTRA = 3;
        static ICON_LABEL_MARKER_BODY_EXTRA = 1;
        static ICON_LABEL_EDGE_MARGIN = 6;
        static DEFAULT_ICON_SIZE = 16;
        static DEFAULT_ICON_LABEL_SIZE = 14;

        static PEN_SMOOTHING = 0.3;
        static PEN_MIN_POINT_DIST = 1.25;
        static PEN_MIN_STROKE_LENGTH = 1.5;
        static PEN_DOUBLE_CLICK_MS = 320;
        static PEN_DOUBLE_CLICK_DIST = 5;
        static ERASER_DRAG_THRESHOLD = 5;
        static PEN_DECIMATE_FACTOR = 0.5;
        static CLIPBOARD_PASTE_STEP = 18;

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
            if (this.cursorPrefsStorageKey) {
                localStorage.setItem(this.cursorPrefsStorageKey, JSON.stringify({
                    showRemoteCursors: this.showRemoteCursors,
                    shareMyCursor: this.shareMyCursor,
                }));
            }
            this.onCursorPrefsChange?.();
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

        static REMOTE_CURSOR_HOTSPOT_X = 2;
        static REMOTE_CURSOR_HOTSPOT_Y = 2;

        static remoteCursorPointerSvg() {
            return '<svg class="tactics-remote-cursor__svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">'
                + '<path fill="currentColor" stroke="rgba(6, 10, 22, 0.78)" stroke-width="1" stroke-linejoin="round"'
                + ' d="M2 1v13l3.2-3.2L8 16l1.6-1.6-2.8-5.2H14L2 1z"></path>'
                + '</svg>';
        }

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

        static getStrokeCursor(strokeWidth) {
            const w = Math.max(1, Number(strokeWidth) || TacticsCanvas.DEFAULT_STROKE_WIDTH);
            const size = Math.max(20, Math.min(96, Math.ceil(w) + 12));
            const cx = size / 2;
            const r = Math.max(2, w / 2);
            const cross = Math.min(7, Math.floor(size / 4));
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
                + `<line x1="${cx}" y1="${cx - cross}" x2="${cx}" y2="${cx + cross}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>`
                + `<line x1="${cx}" y1="${cx - cross}" x2="${cx}" y2="${cx + cross}" stroke="#0a1022" stroke-width="1.25" stroke-linecap="round"/>`
                + `<line x1="${cx - cross}" y1="${cx}" x2="${cx + cross}" y2="${cx}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>`
                + `<line x1="${cx - cross}" y1="${cx}" x2="${cx + cross}" y2="${cx}" stroke="#0a1022" stroke-width="1.25" stroke-linecap="round"/>`
                + `<circle cx="${cx}" cy="${cx}" r="${r + 1.5}" fill="none" stroke="#ffffff" stroke-width="2"/>`
                + `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#0a1022" stroke-width="1.25"/>`
                + '</svg>';
            return TacticsCanvas.cursorFromSvg(svg, cx, cx, 'crosshair');
        }

        static getDrawToolCursor(tool, strokeWidth) {
            return TacticsCanvas.getStrokeCursor(strokeWidth);
        }

        usesStrokeCursor() {
            return ['pen', 'rect', 'circle', 'polygon'].includes(this.tool);
        }

        applyStrokeToolCursor() {
            if (!this.fabric) return;
            const cursor = TacticsCanvas.getDrawToolCursor(this.tool, this.getStrokeWidth());
            if (this.fabric.upperCanvasEl) {
                this.fabric.upperCanvasEl.style.cursor = cursor;
            }
            this.fabric.defaultCursor = cursor;
            this.fabric.freeDrawingCursor = cursor;
        }

        updateDrawToolCursor() {
            if (!this.fabric || !this.drawEnabled || !this.usesStrokeCursor()) return;
            this.applyStrokeToolCursor();
        }

        initFabric() {
            if (this.fabric || !window.fabric || !this.canvasEl) return;
            this.fabric = new fabric.Canvas(this.canvasEl, {
                selection: true,
                preserveObjectStacking: true,
            });
            const ref = TacticsCanvas.COORD_SPACE;
            this.fabric.setWidth(ref);
            this.fabric.setHeight(ref);
            this.layoutCanvasSize = ref;
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
            const onViewportGeometryChange = () => this.scheduleResize();
            window.visualViewport?.addEventListener('resize', onViewportGeometryChange, { passive: true });
            window.visualViewport?.addEventListener('scroll', onViewportGeometryChange, { passive: true });
            this.bindMapWheelZoom();

            this.fabric.on('object:added', (e) => {
                const obj = e?.target;
                if (obj?.type === 'path' && this.tool === 'pen') {
                    return;
                }
                this.handleLocalChange('add', e);
            });
            this.fabric.on('object:modified', (e) => {
                this.transformModifiedAt = Date.now();
                this.transformMovedTarget = null;
                this.handleLocalChange('modify', e);
            });
            this.fabric.on('object:removed', (e) => this.handleLocalChange('remove', e));

            this.fabric.on('mouse:down', (opt) => this.handleMouseDown(opt));
            this.fabric.on('mouse:move', (opt) => {
                this.handleMouseMove(opt);
                this.handleFabricPointerMove(opt);
                if (this.tool === 'pen' && this.fabric?.isDrawingMode) {
                    const pointer = this.fabric.getPointer(opt.e);
                    this.penLivePointer = pointer;
                    if (this.localStrokeId) {
                        this.scheduleStrokePointBroadcast();
                    }
                }
            });
            this.fabric.on('mouse:up', (opt) => {
                this.handleMouseUp(opt);
                this.commitPendingTransform();
            });
            this.fabric.on('object:moving', (e) => {
                this.guardObjectTransform(e);
                this.trackTransformTarget(e);
            });
            this.fabric.on('object:scaling', (e) => {
                this.guardObjectTransform(e);
                this.trackTransformTarget(e);
            });
            this.fabric.on('object:rotating', (e) => {
                this.guardObjectTransform(e);
                this.trackTransformTarget(e);
            });
            this.fabric.on('mouse:dblclick', () => {
                if (this.tool === 'pen') {
                    this.cancelPenStroke();
                }
            });
            this.fabric.on('path:created', (e) => {
                const path = e.path;
                if (path && this.tool === 'pen') {
                    if (!this.isValidPenPath(path)) {
                        this.isRemote = true;
                        this.fabric.remove(path);
                        this.isRemote = false;
                        this.penLivePointer = null;
                        this.finishLocalStrokeBroadcast();
                        this.fabric.discardActiveObject();
                        this.syncInteractionState();
                        this.fabric.requestRenderAll();
                        return;
                    }
                    const endType = this.getEndType();
                    path.set('tacticsType', 'pen');
                    path.set('tacticsEndType', endType);
                    path.set('tacticsLineType', this.getToolSettings().lineType || 'solid');
                    this.applyStrokeStyle(path);
                    this.ensureTacticsId(path);
                    if (endType === 'arrow' || endType === 'bar') {
                        this.isRemote = true;
                        this.setupPenEndCap(path, endType);
                        this.isRemote = false;
                    }
                    this.penLivePointer = null;
                    if (this.fabric) {
                        this.fabric.discardActiveObject();
                        this.syncInteractionState();
                        this.fabric.requestRenderAll();
                    }
                    if (this.penMouseUpCleanupRaf) {
                        cancelAnimationFrame(this.penMouseUpCleanupRaf);
                        this.penMouseUpCleanupRaf = 0;
                    }
                    this.handleLocalChange('add', { target: path });
                    this.finishLocalStrokeBroadcast();
                    return;
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
            this.bindCellDragRelease();
            this.bindEraserStrokeRelease();
            this.bindDeleteKey();
            this.bindUndoRedoKeys();
            this.bindCopyPasteKeys();
            this.fabric.on('mouse:out', () => {
                this.stopPingHold();
                this.stopRulerDrag();
                this.stopCellDrag();
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
            this.syncMapContentLayerGeometry(this.cursorsLayerEl);
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
            this.syncMapContentLayerGeometry(this.pingsLayerEl);
        }

        clearPings() {
            if (this.pingsLayerEl) {
                this.pingsLayerEl.innerHTML = '';
            }
        }

        removeSpawnMarkers() {
            if (!this.fabric) return;
            this.fabric.getObjects().filter((obj) => obj.isSpawnMarker).forEach((obj) => {
                this.fabric.remove(obj);
            });
        }

        applySpawnMarkerLock(obj) {
            if (!obj) return;
            obj.set({
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
                objectCaching: false,
                excludeFromExport: true,
            });
            obj.isSpawnMarker = true;
        }

        createSpawnMarkerObject(point, normX, normY, canvasSize, displayTeam) {
            const mapsApi = window.AbsTacticsMaps;
            const type = String(point?.point_type || '').toLowerCase();
            const team = displayTeam !== undefined && mapsApi?.normalizeSpawnTeam
                ? mapsApi.normalizeSpawnTeam(displayTeam)
                : (mapsApi?.normalizeSpawnTeam
                    ? mapsApi.normalizeSpawnTeam(point?.team)
                    : '');
            const cx = normX * canvasSize;
            const cy = normY * canvasSize;
            const markerScale = mapsApi?.getSpawnPointMarkerScale
                ? mapsApi.getSpawnPointMarkerScale(point)
                : (mapsApi?.normalizeSpawnMarkerScale
                    ? mapsApi.normalizeSpawnMarkerScale(point?.marker_scale ?? 1)
                    : 1);
            const baseRadius = Math.max(28, canvasSize * 0.044) * markerScale;
            const spawnRadius = Math.max(16, canvasSize * 0.028) * markerScale;
            const strokeWidth = Math.max(3, Math.round(baseRadius * 0.14));

            if (type === 'control_point') {
                const ringWidth = Math.max(4, Math.round(baseRadius * 0.16));
                const circle = new fabric.Circle({
                    left: cx,
                    top: cy,
                    radius: baseRadius,
                    fill: 'rgba(18, 18, 20, 0.92)',
                    originX: 'center',
                    originY: 'center',
                    stroke: '#c8ced8',
                    strokeWidth: ringWidth,
                });
                const flagScale = baseRadius * 0.9;
                const flagPathD = mapsApi?.spawnFlagFabricPathD
                    ? mapsApi.spawnFlagFabricPathD(flagScale)
                    : '';
                const flag = new fabric.Path(flagPathD, {
                        left: cx,
                        top: cy,
                        fill: '#ffffff',
                        stroke: null,
                        originX: 'center',
                        originY: 'center',
                    },
                );
                const group = new fabric.Group([circle, flag], {
                    left: cx,
                    top: cy,
                    originX: 'center',
                    originY: 'center',
                });
                this.applySpawnMarkerLock(group);
                return group;
            }

            const isGreen = team === 'team1';
            const ringColor = isGreen ? '#29d500' : '#e03c3c';
            const fillColor = isGreen ? '#36c736' : '#e03c3c';
            const radius = type === 'base' ? baseRadius : spawnRadius;

            if (type === 'base') {
                const ringWidth = Math.max(4, Math.round(baseRadius * 0.16));
                const circle = new fabric.Circle({
                    left: cx,
                    top: cy,
                    radius,
                    fill: 'rgba(18, 18, 20, 0.92)',
                    originX: 'center',
                    originY: 'center',
                    stroke: ringColor,
                    strokeWidth: ringWidth,
                });
                const baseNumber = mapsApi?.spawnBaseDisplayNumber
                    ? mapsApi.spawnBaseDisplayNumber(point)
                    : '';
                const markerItems = [circle];
                if (baseNumber) {
                    markerItems.push(new fabric.Text(baseNumber, {
                        left: cx,
                        top: cy,
                        originX: 'center',
                        originY: 'center',
                        fontSize: Math.max(12, Math.round(radius * 1.05)),
                        fontWeight: 'bold',
                        fill: '#ffffff',
                        fontFamily: 'Arial, Helvetica, sans-serif',
                    }));
                } else {
                    const flagScale = radius * 0.9;
                    const flagPathD = mapsApi?.spawnFlagFabricPathD
                        ? mapsApi.spawnFlagFabricPathD(flagScale)
                        : '';
                    markerItems.push(new fabric.Path(flagPathD, {
                            left: cx,
                            top: cy,
                            fill: '#ffffff',
                            stroke: null,
                            originX: 'center',
                            originY: 'center',
                        },
                    ));
                }
                const group = new fabric.Group(markerItems, {
                    left: cx,
                    top: cy,
                    originX: 'center',
                    originY: 'center',
                });
                this.applySpawnMarkerLock(group);
                return group;
            }

            const circle = new fabric.Circle({
                left: cx,
                top: cy,
                radius,
                fill: fillColor,
                originX: 'center',
                originY: 'center',
                stroke: '#ffffff',
                strokeWidth,
            });

            this.applySpawnMarkerLock(circle);
            return circle;
        }

        syncSpawnOverlay(slide) {
            if (slide) {
                this.activeSlide = slide;
            }
            const generation = ++this.spawnOverlayGeneration;
            this.removeSpawnMarkers();
            if (!this.fabric) return;

            const mapsApi = window.AbsTacticsMaps;
            if (!mapsApi || typeof mapsApi.getSpawnPointsForSlide !== 'function') {
                return;
            }

            const render = () => {
                if (generation !== this.spawnOverlayGeneration || !this.fabric) return;
                const target = this.activeSlide;
                const payload = mapsApi.getSpawnPointsForSlide(target);
                if (!payload || payload.opts?.showOverlay === false) {
                    this.fabric.requestRenderAll();
                    return;
                }

                const size = this.fabric.getWidth();
                if (!size) return;

                const swapped = payload.opts?.spawnSwapped === true;
                const displayOpts = {
                    spawnSwapped: swapped,
                    battleMode: payload.mode || target?.battle_mode || 'random',
                    bounds: payload.bounds,
                };
                payload.points.forEach((point) => {
                    const display = mapsApi.resolveSpawnDisplay
                        ? mapsApi.resolveSpawnDisplay(point, payload.points, displayOpts)
                        : {
                            point: mapsApi.resolveSpawnDisplayPoint
                                ? mapsApi.resolveSpawnDisplayPoint(point, payload.points, swapped)
                                : point,
                            team: point?.team,
                        };
                    const norm = mapsApi.spawnPointToNormalized(display.point, payload.bounds);
                    if (!norm) return;
                    const marker = this.createSpawnMarkerObject(
                        point,
                        norm.x,
                        norm.y,
                        size,
                        display.team,
                    );
                    if (!marker) return;
                    this.isRemote = true;
                    this.fabric.add(marker);
                    this.isRemote = false;
                });
                this.consolidateLayerOrder();
                this.fabric.requestRenderAll();
            };

            const catalog = typeof mapsApi.getCatalog === 'function' ? mapsApi.getCatalog() : null;
            if (catalog?.map_spawns) {
                render();
                return;
            }
            if (typeof mapsApi.loadCatalog === 'function') {
                void mapsApi.loadCatalog().then(render).catch(render);
                return;
            }
            render();
        }

        pinMapBoxElement(el, size) {
            if (!el || !size) return;
            el.style.inset = 'auto';
            el.style.left = '0';
            el.style.top = '0';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
        }

        syncOverlaysRootGeometry() {
            const overlays = this.getOverlaysEl();
            const wrap = this.getWrapEl();
            if (!overlays || !wrap) return;
            const width = wrap.offsetWidth;
            const height = wrap.offsetHeight;
            if (width <= 0 || height <= 0) return;
            overlays.style.inset = 'auto';
            overlays.style.left = '0';
            overlays.style.top = '0';
            overlays.style.right = 'auto';
            overlays.style.bottom = 'auto';
            overlays.style.width = `${width}px`;
            overlays.style.height = `${height}px`;
            overlays.style.overflow = 'visible';
        }

        isPointerOnMap(pointer) {
            const size = this.getGridCanvasSize();
            if (!pointer || size <= 0) return false;
            return pointer.x >= 0
                && pointer.x <= size
                && pointer.y >= 0
                && pointer.y <= size;
        }

        clearCellFlashes() {
            if (!this.fabric) {
                if (this.cellFlashesLayerEl) {
                    this.cellFlashesLayerEl.innerHTML = '';
                }
                return;
            }
            this.isRemote = true;
            this.fabric.getObjects()
                .filter((obj) => obj.isCellFlash)
                .forEach((obj) => this.fabric.remove(obj));
            this.isRemote = false;
            if (this.cellFlashesLayerEl) {
                this.cellFlashesLayerEl.innerHTML = '';
            }
            this.fabric.requestRenderAll();
        }

        static GRID_DIVISIONS = 10;
        static COORD_SPACE = 1000;

        static isMapDecoration(obj) {
            return !!(obj?.isGridLine || obj?.isSpawnMarker);
        }
        static MAP_CSS_ZOOM_MIN = 1;
        static MAP_CSS_ZOOM_MAX = 4;
        static MAP_CSS_ZOOM_WHEEL_FACTOR = 1.08;
        static REMOTE_STROKE_PREVIEW_MAX_POINTS = 280;
        static REMOTE_STROKE_CAP_SOURCE_POINTS = 48;
        static REMOTE_STROKE_BROADCAST_LONG_THRESHOLD = 120;
        static REMOTE_STROKE_BROADCAST_MIN_INTERVAL_MS = 33;
        static LEGACY_COORD_OVERFLOW_RATIO = 1.02;
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

        createCellFlashRect(col, row, color) {
            const size = this.getGridCanvasSize();
            if (size <= 0) return null;
            const left = this.getGridLineCanvasCoord(col, size);
            const top = this.getGridLineCanvasCoord(row, size);
            const width = this.getGridLineCanvasCoord(col + 1, size) - left;
            const height = this.getGridLineCanvasCoord(row + 1, size) - top;
            if (width <= 0 || height <= 0) return null;
            return new fabric.Rect({
                left,
                top,
                width,
                height,
                fill: String(color || '#ff4444'),
                opacity: 0,
                selectable: false,
                evented: false,
                objectCaching: false,
                excludeFromExport: true,
                isCellFlash: true,
            });
        }

        placeCellFlashAboveGrid(flash) {
            if (!this.fabric || !flash) return;
            const objects = this.fabric.getObjects();
            const gridLines = objects.filter((obj) => obj.isGridLine);
            let targetIndex = 0;
            if (gridLines.length) {
                targetIndex = objects.indexOf(gridLines[gridLines.length - 1]) + 1;
            } else {
                const bg = objects.find((obj) => obj.isBackground);
                targetIndex = bg ? objects.indexOf(bg) + 1 : 0;
            }
            this.fabric.moveTo(flash, Math.max(0, targetIndex));
        }

        playCellFlash(col, row, color) {
            if (!this.fabric) return null;
            const rect = this.createCellFlashRect(col, row, color);
            if (!rect) return null;

            const durationMs = this.getCellFlashDuration();
            const removeFlash = () => {
                if (!rect?.canvas) return;
                this.isRemote = true;
                this.fabric.remove(rect);
                this.isRemote = false;
                this.fabric.requestRenderAll();
            };

            this.isRemote = true;
            this.fabric.add(rect);
            this.placeCellFlashAboveGrid(rect);
            this.isRemote = false;

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                rect.set({ opacity: 0.45 });
                this.fabric.requestRenderAll();
                window.setTimeout(removeFlash, durationMs);
                return rect;
            }

            rect.animate('opacity', 0.58, {
                duration: Math.round(durationMs * 0.18),
                onChange: () => this.fabric.requestRenderAll(),
                onComplete: () => {
                    rect.animate('opacity', 0, {
                        duration: Math.round(durationMs * 0.82),
                        onChange: () => this.fabric.requestRenderAll(),
                        onComplete: removeFlash,
                    });
                },
            });
            window.setTimeout(removeFlash, durationMs + 80);
            return rect;
        }

        fireCellFlashAtCell(col, row) {
            const payload = {
                col,
                row,
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

        tryFireCellFlashAtCell(col, row) {
            const key = `${col},${row}`;
            if (this.cellDragSeen.has(key)) return false;
            this.cellDragSeen.add(key);
            this.fireCellFlashAtCell(col, row);
            return true;
        }

        visitGridCellsAlongLine(col0, row0, col1, row1, visitor) {
            let x = col0;
            let y = row0;
            const dx = Math.abs(col1 - col0);
            const dy = Math.abs(row1 - row0);
            const sx = col0 < col1 ? 1 : -1;
            const sy = row0 < row1 ? 1 : -1;
            let err = dx - dy;
            while (true) {
                visitor(x, y);
                if (x === col1 && y === row1) break;
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
        }

        startCellDrag(pointer) {
            this.cellDragActive = true;
            this.cellDragSeen = new Set();
            this.cellDragLastCol = null;
            this.cellDragLastRow = null;
            this.updateCellDrag(pointer);
        }

        updateCellDrag(pointer) {
            if (!this.cellDragActive || !this.isPointerOnMap(pointer)) return;
            const cell = this.getGridCellFromPointer(pointer);
            if (!cell) return;

            if (this.cellDragLastCol == null || this.cellDragLastRow == null) {
                this.tryFireCellFlashAtCell(cell.col, cell.row);
                this.cellDragLastCol = cell.col;
                this.cellDragLastRow = cell.row;
                return;
            }

            if (cell.col === this.cellDragLastCol && cell.row === this.cellDragLastRow) {
                return;
            }

            this.visitGridCellsAlongLine(
                this.cellDragLastCol,
                this.cellDragLastRow,
                cell.col,
                cell.row,
                (col, row) => this.tryFireCellFlashAtCell(col, row),
            );
            this.cellDragLastCol = cell.col;
            this.cellDragLastRow = cell.row;
        }

        stopCellDrag() {
            this.cellDragActive = false;
            this.cellDragSeen.clear();
            this.cellDragLastCol = null;
            this.cellDragLastRow = null;
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
            this.syncMapContentLayerGeometry(this.rulerLayerEl);
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
            const canvasSize = this.fabric?.getWidth() || TacticsCanvas.COORD_SPACE;
            if (canvasSize <= 0) {
                return { x: 0, y: 0 };
            }
            return this.normalizedMapPointToOverlay(x / canvasSize, y / canvasSize);
        }

        getMapContentLayoutSize() {
            const layout = Number(this.mapCssLayoutSize);
            if (Number.isFinite(layout) && layout > 0) {
                return { width: layout, height: layout };
            }

            const wrap = this.getWrapEl();
            if (wrap) {
                const width = wrap.offsetWidth;
                const height = wrap.offsetHeight;
                if (width > 0 && height > 0) {
                    return { width, height };
                }
            }

            const container = this.fabric?.wrapperEl;
            if (container) {
                const width = container.offsetWidth;
                const height = container.offsetHeight;
                if (width > 0 && height > 0) {
                    return { width, height };
                }
            }

            return null;
        }

        getMapContentMetrics() {
            const overlays = this.getOverlaysEl();
            const layout = this.getMapContentLayoutSize();
            if (layout) {
                return {
                    width: layout.width,
                    height: layout.height,
                    offsetX: 0,
                    offsetY: 0,
                    overlayWidth: overlays?.offsetWidth || layout.width,
                    overlayHeight: overlays?.offsetHeight || layout.height,
                };
            }

            const wrap = this.getWrapEl();
            if (wrap) {
                const width = wrap.clientWidth;
                const height = wrap.clientHeight;
                if (width > 0 && height > 0) {
                    return {
                        width,
                        height,
                        offsetX: 0,
                        offsetY: 0,
                        overlayWidth: width,
                        overlayHeight: height,
                    };
                }
            }

            const stack = this.getStackEl();
            const width = stack?.clientWidth || 0;
            const height = stack?.clientHeight || 0;
            return {
                width,
                height,
                offsetX: 0,
                offsetY: 0,
                overlayWidth: width,
                overlayHeight: height,
            };
        }

        normalizedMapPointToOverlay(nx, ny) {
            const metrics = this.getMapContentMetrics();
            if (!metrics || metrics.width <= 0 || metrics.height <= 0) {
                return { x: 0, y: 0 };
            }
            const x = Math.max(0, Math.min(1, Number(nx) || 0));
            const y = Math.max(0, Math.min(1, Number(ny) || 0));
            return {
                x: x * metrics.width,
                y: y * metrics.height,
            };
        }

        syncMapContentLayerGeometry(layer) {
            if (!layer) return;
            const metrics = this.getMapContentMetrics();
            layer.style.inset = 'auto';
            layer.style.right = 'auto';
            layer.style.bottom = 'auto';
            layer.style.overflow = 'visible';
            if (!metrics || metrics.width <= 0 || metrics.height <= 0) {
                layer.style.left = '0';
                layer.style.top = '0';
                layer.style.width = '100%';
                layer.style.height = '100%';
                return;
            }
            layer.style.left = `${metrics.offsetX}px`;
            layer.style.top = `${metrics.offsetY}px`;
            layer.style.width = `${metrics.width}px`;
            layer.style.height = `${metrics.height}px`;
        }

        syncCanvasWrapOverlayLayer(layer) {
            if (!layer) return;
            layer.style.inset = '0';
            layer.style.left = '0';
            layer.style.top = '0';
            layer.style.right = '0';
            layer.style.bottom = '0';
            layer.style.width = '';
            layer.style.height = '';
            layer.style.overflow = 'visible';
        }

        syncAllMapOverlayLayers() {
            this.syncOverlaysRootGeometry();
            this.syncMapContentLayerGeometry(this.cursorsLayerEl);
            this.syncMapContentLayerGeometry(this.pingsLayerEl);
            this.syncMapContentLayerGeometry(this.rulerLayerEl);
            this.syncSpawnOverlay();
        }

        formatRulerDistance(distance) {
            if (distance == null || !Number.isFinite(distance)) {
                const i18n = window.AbsTacticsI18n;
                return i18n ? i18n.t('rulerNoSize') : '—';
            }
            if (maps().usesHammerUnits(this.game)) {
                const unit = window.AbsTacticsI18n?.t('scaleUnitGame') || 'units';
                return `${Math.round(distance)} ${unit}`;
            }
            if (maps().usesGameUnits(this.game)) {
                const unit = window.AbsTacticsI18n?.t('scaleUnitGame') || 'units';
                return `${Math.round(distance)} ${unit}`;
            }
            if (distance >= 1000) {
                return `${(distance / 1000).toFixed(2)} km`;
            }
            const unit = window.AbsTacticsI18n?.t('scaleUnitMetersShort') || 'm';
            return `${Math.round(distance)} ${unit}`;
        }

        updateMapScaleInfo() {
            const el = document.getElementById('tacticsMapScale');
            if (!el) return;
            const wasHidden = el.hidden;
            const i18n = window.AbsTacticsI18n;
            const scale = this.mapScale;
            const usesKhu = maps().usesHammerUnits(this.game);
            const usesUnits = maps().usesGameUnits(this.game);
            if (scale?.width && scale?.height) {
                if (usesKhu) {
                    const width = maps().formatKhuFromHu(scale.width);
                    const height = maps().formatKhuFromHu(scale.height);
                    if (scale.width === scale.height) {
                        const template = i18n ? i18n.t('mapScaleKhu') : 'Масштаб карты: {size} kHu²';
                        el.textContent = template.replace(/\{size\}/g, width);
                    } else {
                        const template = i18n ? i18n.t('mapScaleRectKhu') : 'Масштаб карты: {width}×{height} kHu²';
                        el.textContent = template
                            .replace(/\{width\}/g, width)
                            .replace(/\{height\}/g, height);
                    }
                } else {
                    const width = String(scale.width);
                    const height = String(scale.height);
                    if (scale.width === scale.height) {
                        const key = usesUnits ? 'mapScaleUnits' : 'mapScale';
                        const template = i18n ? i18n.t(key) : (usesUnits
                            ? 'Масштаб карты: {size}×{size} units'
                            : 'Масштаб карты: {size}×{size} м');
                        el.textContent = template.replace(/\{size\}/g, width);
                    } else {
                        const key = usesUnits ? 'mapScaleRectUnits' : 'mapScaleRect';
                        const template = i18n ? i18n.t(key) : (usesUnits
                            ? 'Масштаб карты: {width}×{height} units'
                            : 'Масштаб карты: {width}×{height} м');
                        el.textContent = template
                            .replace(/\{width\}/g, width)
                            .replace(/\{height\}/g, height);
                    }
                }
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
                this.game = 'wot';
                this.mapSideLength = null;
                this.mapScale = null;
                this.updateMapScaleInfo();
                return;
            }
            this.game = slide.game || 'wot';
            this.mapScale = await maps().slideMapScale(slide);
            const scale = this.mapScale;
            this.mapSideLength = scale
                ? Math.max(scale.width || 0, scale.height || 0)
                : null;
            this.updateMapScaleInfo();
        }

        computeRulerDistanceMeters(x1, y1, x2, y2) {
            const canvasSize = this.fabric?.getWidth() || 0;
            const scale = this.mapScale;
            if (canvasSize <= 0 || !scale?.width || !scale?.height) return null;
            const dx = x2 - x1;
            const dy = y2 - y1;
            let worldWidth = scale.width;
            let worldHeight = scale.height;
            if (maps().usesHammerUnits(this.game)) {
                worldWidth = maps().hammerStoredToSideHu(scale.width);
                worldHeight = maps().hammerStoredToSideHu(scale.height);
            }
            const metersX = (Math.abs(dx) / canvasSize) * worldWidth;
            const metersY = (Math.abs(dy) / canvasSize) * worldHeight;
            return Math.hypot(metersX, metersY);
        }

        updateRulerDisplay(x1, y1, x2, y2) {
            this.ensureRulerLayer();
            const metrics = this.getMapContentMetrics();
            const overlayW = metrics?.width || 0;
            const overlayH = metrics?.height || 0;
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
            const metrics = this.getMapContentMetrics();
            if (!this.pingsLayerEl || !metrics || metrics.width <= 0 || metrics.height <= 0) return null;

            const x = Math.max(0, Math.min(1, Number(nx) || 0));
            const y = Math.max(0, Math.min(1, Number(ny) || 0));
            const pingColor = String(color || '#ff4444');
            const sizePx = this.pingSizePx(size);
            const strokePx = this.pingStrokePx(strokeWidth);
            const point = this.normalizedMapPointToOverlay(x, y);

            const ping = document.createElement('div');
            ping.className = 'tactics-ping';
            ping.style.setProperty('--ping-color', pingColor);
            ping.style.setProperty('--ping-size', `${sizePx}px`);
            ping.style.setProperty('--ping-stroke', `${strokePx}px`);
            ping.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;

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

        bindCellDragRelease() {
            if (this.cellDragReleaseBound) return;
            this.cellDragReleaseBound = true;
            window.addEventListener('mouseup', () => this.stopCellDrag());
        }

        bindEraserStrokeRelease() {
            if (this.eraserStrokeReleaseBound) return;
            this.eraserStrokeReleaseBound = true;
            window.addEventListener('mouseup', () => this.finishEraserStroke());
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
                this.unregisterForeignObject(target);
                if (target.tacticsType === 'line' || target.tacticsType === 'pen') {
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

        getSelectedObjectsForClipboard() {
            return this.getSelectedDrawingTargets().filter((obj) => !obj.tacticsArrowHead && !obj.tacticsBarEnd);
        }

        copySelectedObjects() {
            if (!this.fabric || !this.canMoveObjects()) return false;

            const targets = this.getSelectedObjectsForClipboard();
            if (!targets.length) return false;

            this.clipboardData = targets.map((obj) => {
                const data = obj.toObject(TacticsCanvas.EXPORT_PROPS);
                delete data.tacticsParent;
                return data;
            });
            this.clipboardPasteCount = 0;
            return this.clipboardData.length > 0;
        }

        pasteClipboardObjects() {
            if (!this.fabric || !this.canMoveObjects() || !this.clipboardData?.length) {
                return Promise.resolve(false);
            }

            this.clipboardPasteCount += 1;
            const offset = TacticsCanvas.CLIPBOARD_PASTE_STEP * this.clipboardPasteCount;
            const payloads = this.clipboardData.map((data) => {
                const copy = { ...data };
                delete copy.tacticsId;
                delete copy.tacticsParent;
                const left = Number(copy.left);
                const top = Number(copy.top);
                if (Number.isFinite(left)) copy.left = left + offset;
                if (Number.isFinite(top)) copy.top = top + offset;
                return copy;
            });

            return new Promise((resolve) => {
                fabric.util.enlivenObjects(payloads, (objs) => {
                    if (!this.fabric || !objs.length) {
                        resolve(false);
                        return;
                    }

                    const pasted = [];
                    this.isRemote = true;
                    objs.forEach((obj) => {
                        if (!obj) return;
                        this.ensureTacticsId(obj);
                        this.markOwnObject(obj);
                        const isLine = obj.type === 'line'
                            && (obj.tacticsType === 'line' || obj.tacticsType === 'arrow');
                        const isPen = obj.type === 'path' && obj.tacticsType === 'pen';
                        if (isPen || isLine) {
                            this.applyStrokeStyle(obj);
                            const endType = obj.tacticsEndType;
                            if (endType === 'bar' || endType === 'arrow') {
                                this.rebuildParentEndCap(obj);
                            }
                        }
                        this.fabric.add(obj);
                        pasted.push(obj);
                    });
                    this.consolidateLayerOrder();
                    this.isRemote = false;

                    if (pasted.length === 1) {
                        this.fabric.setActiveObject(pasted[0]);
                    } else if (pasted.length > 1) {
                        const selection = new fabric.ActiveSelection(pasted, { canvas: this.fabric });
                        this.fabric.setActiveObject(selection);
                    }

                    this.syncInteractionState();
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
                    resolve(true);
                });
            });
        }

        bindCopyPasteKeys() {
            if (this.copyPasteKeyBound) return;
            this.copyPasteKeyBound = true;

            window.addEventListener('keydown', (ev) => {
                if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
                if (!this.fabric || !this.canMoveObjects()) return;
                if (this.shouldIgnoreCanvasHotkey(ev)) return;

                if (ev.code === 'KeyC') {
                    if (!this.getSelectedObjectsForClipboard().length) return;
                    if (!this.copySelectedObjects()) return;
                    ev.preventDefault();
                    return;
                }

                if (ev.code === 'KeyV') {
                    if (!this.clipboardData?.length) return;
                    ev.preventDefault();
                    void this.pasteClipboardObjects();
                }
            }, true);
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
            const stack = this.getStackEl();
            if (!stack || stack.dataset.cursorBound) return;
            stack.dataset.cursorBound = '1';

            stack.addEventListener('mousemove', (ev) => {
                this.sendCursorFromPointerEvent(ev, true);
            });

            stack.addEventListener('mouseleave', () => {
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
        }

        updateEraserCursor(opt) {
            const upper = this.fabric?.upperCanvasEl;
            if (!upper || !this.drawEnabled || this.tool !== 'eraser') return;

            let overDrawing = false;
            if (opt?.e) {
                const target = this.fabric.findTarget(opt.e, false);
                overDrawing = !!(target && !target.isBackground && !TacticsCanvas.isMapDecoration(target) && !this.isPreviewObject(target));
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
            const hideNow = !broadcastVisible;

            if (hideNow) {
                this.pendingCursorPayload = null;
                this.flushCursorSend(payload);
                return;
            }

            this.pendingCursorPayload = payload;
            const key = `${payload.slideId}:${payload.x}:${payload.y}:${payload.visible}:${payload.nickname}`;
            if (key === this.lastCursorPayload) return;
            this.flushCursorSend();
        }

        flushCursorSend(payloadOverride) {
            const payload = payloadOverride || this.pendingCursorPayload;
            if (!payload) return;

            const key = `${payload.slideId}:${payload.x}:${payload.y}:${payload.visible}:${payload.nickname}`;
            if (key === this.lastCursorPayload) {
                this.pendingCursorPayload = null;
                return;
            }

            this.lastCursorPayload = key;
            this.pendingCursorPayload = null;
            this.onCursorMove(payload);
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
                pointer.innerHTML = TacticsCanvas.remoteCursorPointerSvg();
                const label = document.createElement('span');
                label.className = 'tactics-remote-cursor__label';
                el.appendChild(pointer);
                el.appendChild(label);
                this.cursorsLayerEl.appendChild(el);
                const color = this.cursorColorForClient(clientId);
                pointer.style.color = color;
                label.style.background = color;
                entry = {
                    el,
                    labelEl: label,
                    x: 0,
                    y: 0,
                    nickname: '',
                };
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
            const point = this.normalizedMapPointToOverlay(entry.x, entry.y);
            const px = point.x - TacticsCanvas.REMOTE_CURSOR_HOTSPOT_X;
            const py = point.y - TacticsCanvas.REMOTE_CURSOR_HOTSPOT_Y;
            entry.el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        }

        repositionRemoteCursors() {
            this.remoteCursors.forEach((entry) => {
                this.positionRemoteCursor(entry);
            });
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

        trackTransformTarget(e) {
            const target = e?.target;
            if (!target || this.isPreviewObject(target) || target.isBackground) return;
            this.transformMovedTarget = target;
        }

        commitPendingTransform() {
            if (!this.fabric || this.isRemote || !this.canMoveObjects()) {
                this.transformMovedTarget = null;
                return;
            }

            const target = this.transformMovedTarget;
            this.transformMovedTarget = null;
            if (!target || this.isPreviewObject(target) || target.isBackground) return;
            if (Date.now() - this.transformModifiedAt < 100) return;

            target.setCoords();
            this.handleLocalChange('modify', { target });
        }

        canMoveObjects() {
            return this.drawEnabled && this.tool === 'select';
        }

        isTextObject(obj) {
            if (!obj || obj.isBackground || TacticsCanvas.isMapDecoration(obj) || obj.isDrawingPreview) {
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

        getMapViewportEl() {
            return this.getStackEl()?.querySelector('.tactics-map-viewport') || this.getStackEl();
        }

        getMapZoomEl() {
            return this.getMapViewportEl()?.querySelector('.tactics-map-zoom-layer') || this.getMapViewportEl();
        }

        getOverlaysEl() {
            return document.getElementById('tacticsCanvasOverlays') || this.getStackEl();
        }

        getOverlaySize() {
            const metrics = this.getMapContentMetrics();
            if (metrics?.width > 0 && metrics?.height > 0) {
                return {
                    width: metrics.width,
                    height: metrics.height,
                };
            }
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

        getRemoteStrokeRenderSize() {
            const metrics = this.getMapContentMetrics();
            if (metrics?.width > 0 && metrics?.height > 0) {
                return {
                    width: metrics.width,
                    height: metrics.height,
                };
            }
            const stack = this.getStackEl();
            const w = stack?.clientWidth || 0;
            const h = stack?.clientHeight || 0;
            if (w > 0 && h > 0) {
                return { width: w, height: h };
            }
            const wrap = this.getWrapEl();
            return {
                width: wrap?.clientWidth || 0,
                height: wrap?.clientHeight || 0,
            };
        }

        syncRemoteStrokesLayerGeometry() {
            this.syncMapContentLayerGeometry(this.remoteStrokesLayerEl);
        }

        getMapGridEl() {
            return this.canvasEl?.closest('.tactics-map-grid');
        }

        resetMapCssZoom() {
            this.endMapPan();
            this.mapCssZoom = 1;
            this.mapCssPanX = 0;
            this.mapCssPanY = 0;
            this.applyMapCssZoom();
        }

        clampMapCssPan() {
            const layoutRect = this.getStackLayoutRect();
            if (!layoutRect || this.mapCssZoom <= 1.001) {
                this.mapCssPanX = 0;
                this.mapCssPanY = 0;
                return;
            }
            const minX = layoutRect.width * (1 - this.mapCssZoom);
            const minY = layoutRect.height * (1 - this.mapCssZoom);
            this.mapCssPanX = Math.min(0, Math.max(minX, this.mapCssPanX));
            this.mapCssPanY = Math.min(0, Math.max(minY, this.mapCssPanY));
        }

        applyMapCssZoom() {
            const zoomEl = this.getMapZoomEl();
            const viewport = this.getMapViewportEl();
            if (!zoomEl) return;

            const zoom = this.mapCssZoom;
            if (Math.abs(zoom - 1) < 0.001) {
                this.mapCssPanX = 0;
                this.mapCssPanY = 0;
                zoomEl.style.transform = '';
                zoomEl.style.transformOrigin = '';
                viewport?.classList.remove('is-map-zoomed', 'is-map-panning');
                if (typeof this.fabric?.calcOffset === 'function') {
                    this.fabric.calcOffset();
                }
                this.syncAllMapOverlayLayers();
                this.repositionRemoteCursors();
                this.refreshRemoteStrokes();
                this.refreshRulerOverlay();
                return;
            }

            this.clampMapCssPan();
            zoomEl.style.transformOrigin = '0 0';
            zoomEl.style.transform = `translate(${this.mapCssPanX}px, ${this.mapCssPanY}px) scale(${zoom})`;
            viewport?.classList.add('is-map-zoomed');
            if (typeof this.fabric?.calcOffset === 'function') {
                this.fabric.calcOffset();
            }
            this.syncAllMapOverlayLayers();
            this.repositionRemoteCursors();
            this.refreshRemoteStrokes();
            this.refreshRulerOverlay();
        }

        endMapPan() {
            if (!this.mapPanActive) return;
            this.mapPanActive = false;
            this.getMapViewportEl()?.classList.remove('is-map-panning');
            if (this.mapPanMoveHandler) {
                window.removeEventListener('mousemove', this.mapPanMoveHandler);
                this.mapPanMoveHandler = null;
            }
            if (this.mapPanUpHandler) {
                window.removeEventListener('mouseup', this.mapPanUpHandler);
                this.mapPanUpHandler = null;
            }
        }

        handleMapPanDown(ev) {
            if (ev.button !== 1 || this.mapCssZoom <= 1.001) return;
            ev.preventDefault();
            this.mapPanActive = true;
            this.mapPanStartX = ev.clientX;
            this.mapPanStartY = ev.clientY;
            this.mapPanOriginX = this.mapCssPanX;
            this.mapPanOriginY = this.mapCssPanY;
            this.getMapViewportEl()?.classList.add('is-map-panning');

            this.mapPanMoveHandler = (moveEv) => {
                if (!this.mapPanActive) return;
                moveEv.preventDefault();
                this.mapCssPanX = this.mapPanOriginX + (moveEv.clientX - this.mapPanStartX);
                this.mapCssPanY = this.mapPanOriginY + (moveEv.clientY - this.mapPanStartY);
                this.applyMapCssZoom();
            };
            this.mapPanUpHandler = (upEv) => {
                if (upEv.button !== 1) return;
                this.endMapPan();
            };
            window.addEventListener('mousemove', this.mapPanMoveHandler);
            window.addEventListener('mouseup', this.mapPanUpHandler);
        }

        getStackLayoutRect() {
            const stack = this.getStackEl();
            const grid = this.getMapGridEl();
            if (!stack || !grid) return null;
            const gridRect = grid.getBoundingClientRect();
            return {
                left: gridRect.left + stack.offsetLeft,
                top: gridRect.top + stack.offsetTop,
                width: stack.offsetWidth,
                height: stack.offsetHeight,
            };
        }

        handleMapWheel(ev) {
            if (!ev || ev.defaultPrevented) return;
            const stack = this.getStackEl();
            if (!stack) return;

            ev.preventDefault();

            const layoutRect = this.getStackLayoutRect();
            if (!layoutRect || layoutRect.width <= 0 || layoutRect.height <= 0) return;

            const mx = ev.clientX - layoutRect.left;
            const my = ev.clientY - layoutRect.top;
            const factor = ev.deltaY < 0
                ? TacticsCanvas.MAP_CSS_ZOOM_WHEEL_FACTOR
                : 1 / TacticsCanvas.MAP_CSS_ZOOM_WHEEL_FACTOR;
            const rawZoom = this.mapCssZoom * factor;
            const nextZoom = Math.max(
                TacticsCanvas.MAP_CSS_ZOOM_MIN,
                Math.min(TacticsCanvas.MAP_CSS_ZOOM_MAX, rawZoom),
            );
            if (Math.abs(nextZoom - this.mapCssZoom) < 0.001) return;

            const prevZoom = this.mapCssZoom;
            const contentX = (mx - this.mapCssPanX) / prevZoom;
            const contentY = (my - this.mapCssPanY) / prevZoom;
            this.mapCssZoom = nextZoom;
            if (nextZoom <= 1.001) {
                this.mapCssZoom = 1;
                this.mapCssPanX = 0;
                this.mapCssPanY = 0;
            } else {
                this.mapCssPanX = mx - contentX * nextZoom;
                this.mapCssPanY = my - contentY * nextZoom;
            }
            this.applyMapCssZoom();
        }

        bindMapWheelZoom() {
            if (this.mapWheelBound) return;
            const viewport = this.getMapViewportEl();
            if (!viewport) return;
            viewport.addEventListener('wheel', (ev) => this.handleMapWheel(ev), { passive: false });
            viewport.addEventListener('mousedown', (ev) => this.handleMapPanDown(ev));
            viewport.addEventListener('auxclick', (ev) => {
                if (ev.button === 1) ev.preventDefault();
            });
            this.mapWheelBound = true;
        }

        isCompactMapLayout() {
            const workspace = document.getElementById('tacticsRoomWorkspace');
            return window.innerWidth <= 1340
                || !!workspace?.classList.contains('is-mobile-view')
                || !!workspace?.classList.contains('is-compact-view');
        }

        getSquareSize() {
            const compact = this.isCompactMapLayout();
            const canvasPanel = this.canvasEl?.closest('.tactics-canvas-panel');
            const measureEl = canvasPanel || this.canvasEl?.closest('.tactics-map-column');
            if (!measureEl) return 640;

            const measureWidth = measureEl.clientWidth;
            const measureHeight = measureEl.clientHeight;
            if (measureWidth <= 0 || measureHeight <= 0) return null;

            const labelsW = compact ? 0 : TacticsCanvas.LABEL_LEFT + TacticsCanvas.LABEL_GAP;
            const labelsH = compact ? 0 : TacticsCanvas.LABEL_TOP + TacticsCanvas.LABEL_GAP;
            const scaleEl = document.getElementById('tacticsMapScale');
            const scaleExtra = (scaleEl && !scaleEl.hidden) ? scaleEl.offsetHeight + 6 : 0;

            const maxW = measureWidth - labelsW;
            const maxH = measureHeight - labelsH - scaleExtra;
            const size = Math.floor(Math.min(maxW, maxH));
            const minSize = compact ? 48 : 80;
            if (size < minSize) return null;
            return size;
        }

        isScalableCanvasObject(obj) {
            return !!obj
                && !obj.isBackground
                && !obj.isGridLine
                && !obj.isDrawingPreview
                && !obj.tacticsArrowHead
                && !obj.tacticsBarEnd;
        }

        getContentCoordExtent() {
            if (!this.fabric) return 0;
            let max = 0;
            this.fabric.getObjects().forEach((obj) => {
                if (!this.isScalableCanvasObject(obj)) return;
                const rect = obj.getBoundingRect(true, true);
                if (!rect) return;
                max = Math.max(max, rect.left + rect.width, rect.top + rect.height);
            });
            return Math.ceil(max);
        }

        scaleObjectGeometry(obj, ratio) {
            if (!obj || !Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.001) return;

            const type = obj.type;
            const strokeWidth = obj.strokeWidth ? obj.strokeWidth * ratio : obj.strokeWidth;

            if (type === 'line') {
                obj.set({
                    left: (obj.left || 0) * ratio,
                    top: (obj.top || 0) * ratio,
                    x1: (obj.x1 || 0) * ratio,
                    y1: (obj.y1 || 0) * ratio,
                    x2: (obj.x2 || 0) * ratio,
                    y2: (obj.y2 || 0) * ratio,
                    strokeWidth,
                });
                obj.setCoords();
                return;
            }

            if ((type === 'polygon' || type === 'polyline') && Array.isArray(obj.points)) {
                obj.set({
                    left: (obj.left || 0) * ratio,
                    top: (obj.top || 0) * ratio,
                    points: obj.points.map((point) => ({
                        x: (point.x || 0) * ratio,
                        y: (point.y || 0) * ratio,
                    })),
                    strokeWidth,
                });
                obj.setCoords();
                return;
            }

            if (type === 'rect') {
                obj.set({
                    left: (obj.left || 0) * ratio,
                    top: (obj.top || 0) * ratio,
                    width: (obj.width || 0) * ratio,
                    height: (obj.height || 0) * ratio,
                    strokeWidth,
                });
                obj.setCoords();
                return;
            }

            if (type === 'circle') {
                obj.set({
                    left: (obj.left || 0) * ratio,
                    top: (obj.top || 0) * ratio,
                    radius: (obj.radius || 0) * ratio,
                    strokeWidth,
                });
                obj.setCoords();
                return;
            }

            if (type === 'i-text' || type === 'text' || type === 'textbox') {
                obj.set({
                    left: (obj.left || 0) * ratio,
                    top: (obj.top || 0) * ratio,
                });
                if (obj.fontSize) {
                    obj.set({ fontSize: obj.fontSize * ratio });
                }
                obj.setCoords();
                return;
            }

            obj.set({
                left: (obj.left || 0) * ratio,
                top: (obj.top || 0) * ratio,
                scaleX: (obj.scaleX || 1) * ratio,
                scaleY: (obj.scaleY || 1) * ratio,
                strokeWidth,
            });
            obj.setCoords();
        }

        scaleCanvasContent(fromSize, toSize) {
            if (!this.fabric || !fromSize || !toSize) return false;
            const ratio = toSize / fromSize;
            if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.001) return false;

            const wasRemote = this.isRemote;
            this.isRemote = true;

            this.fabric.getObjects().forEach((obj) => {
                if (!this.isScalableCanvasObject(obj)) return;
                this.scaleObjectGeometry(obj, ratio);
            });

            this.relinkArrowHeads();
            this.isRemote = wasRemote;
            return true;
        }

        withExportCoordSpace(run) {
            if (!this.fabric || typeof run !== 'function') return null;
            return run(TacticsCanvas.COORD_SPACE);
        }

        applyCoordSpaceScale(json) {
            if (!this.fabric || !json) return;
            const target = TacticsCanvas.COORD_SPACE;

            let fromSize = Number(json.coordSpace) || 0;
            if (!fromSize) {
                const extent = this.getContentCoordExtent();
                if (extent > target * TacticsCanvas.LEGACY_COORD_OVERFLOW_RATIO) {
                    fromSize = extent;
                } else {
                    return;
                }
            }

            if (Math.abs(fromSize - target) < 0.5) return;
            this.scaleCanvasContent(fromSize, target);
            this.layoutCanvasSize = target;
        }

        ensureLogicalCoordSpace() {
            if (!this.fabric) return;
            const ref = TacticsCanvas.COORD_SPACE;
            const current = this.fabric.getWidth() || 0;
            if (Math.abs(current - ref) < 0.5) {
                this.layoutCanvasSize = ref;
                return;
            }

            if (current > 0
                && !this.isSlideLoading
                && !this.suppressCanvasScale
                && this.fabric.getObjects().some((obj) => this.isScalableCanvasObject(obj))) {
                this.scaleCanvasContent(current, ref);
            }

            this.fabric.setWidth(ref);
            this.fabric.setHeight(ref);
            this.layoutCanvasSize = ref;
        }

        getCanvasCssSize(displaySize) {
            const size = Number(displaySize);
            if (!Number.isFinite(size) || size <= 0) return TacticsCanvas.COORD_SPACE;
            return Math.max(size, TacticsCanvas.COORD_SPACE);
        }

        applyDisplayZoom(displaySize) {
            if (!this.fabric || !displaySize) return;
            const ref = TacticsCanvas.COORD_SPACE;
            const cssSize = this.getCanvasCssSize(displaySize);

            const zoom = displaySize < ref ? displaySize / ref : 1;
            this.fabric.setZoom(zoom);
            if (typeof this.fabric.setDimensions === 'function') {
                this.fabric.setDimensions({ width: cssSize, height: cssSize }, { cssOnly: true });
            }
            this.syncCanvasDisplaySize(displaySize);
        }

        syncCanvasDisplaySize(displaySize) {
            if (!this.fabric || !displaySize) return;
            const px = `${this.getCanvasCssSize(displaySize)}px`;
            [
                this.fabric.lowerCanvasEl,
                this.fabric.upperCanvasEl,
                this.fabric.wrapperEl,
                this.canvasEl,
            ].forEach((el) => {
                if (!el) return;
                el.style.width = px;
                el.style.height = px;
            });
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

            const canvasCssSize = this.getCanvasCssSize(size);
            container.style.width = `${canvasCssSize}px`;
            container.style.height = `${canvasCssSize}px`;
            this.pinMapBoxElement(container, canvasCssSize);

            if (wrap) {
                this.pinMapBoxElement(wrap, size);
            }

            if (stack) {
                this.pinMapBoxElement(stack, size);
            }

            if (grid) {
                if (this.isCompactMapLayout()) {
                    grid.style.width = size + 'px';
                    grid.style.height = size + 'px';
                } else {
                    grid.style.width = (TacticsCanvas.LABEL_LEFT + TacticsCanvas.LABEL_GAP + size) + 'px';
                    grid.style.height = (TacticsCanvas.LABEL_TOP + TacticsCanvas.LABEL_GAP + size) + 'px';
                }
            }
        }

        resize() {
            if (!this.fabric) return;
            const size = this.getSquareSize();
            if (!size) return;

            if (this.mapCssLayoutSize != null && this.mapCssLayoutSize !== size) {
                this.resetMapCssZoom();
            }
            this.mapCssLayoutSize = size;

            this.ensureLogicalCoordSpace();
            this.applyDisplayZoom(size);
            this.syncFabricContainer(size);
            this.syncCanvasDisplaySize(size);
            if (typeof this.fabric.calcOffset === 'function') {
                this.fabric.calcOffset();
            }
            this.syncOverlaysRootGeometry();
            this.fitBackground();
            this.syncGridOverlay();
            this.ensureCursorsLayer();
            this.ensurePingsLayer();
            this.ensureRulerLayer();
            this.syncAllMapOverlayLayers();
            this.repositionRemoteCursors();
            this.refreshRulerOverlay();
            this.refreshRemoteStrokes();
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

        placeSpawnAboveMap() {
            if (!this.fabric) return;

            const objects = this.fabric.getObjects();
            const bg = objects.find((o) => o.isBackground);
            let targetIndex = bg ? objects.indexOf(bg) + 1 : 0;

            objects.filter((o) => o.isSpawnMarker).forEach((marker) => {
                this.fabric.moveTo(marker, targetIndex);
                targetIndex += 1;
            });
        }

        placeGridAboveMap() {
            if (!this.fabric || !this.showGrid) return;

            const objects = this.fabric.getObjects();
            const bg = objects.find((o) => o.isBackground);
            let targetIndex = bg ? objects.indexOf(bg) + 1 : 0;
            targetIndex += objects.filter((o) => o.isSpawnMarker).length;

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
            this.placeSpawnAboveMap();
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
                if (obj.isDrawingPreview || obj.isRemoteStrokePreview || obj.isCellFlash || TacticsCanvas.isMapDecoration(obj)) {
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
                if (!obj.isBackground && !TacticsCanvas.isMapDecoration(obj) && !obj.isDrawingPreview) {
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
                } else if (this.drawEnabled && this.usesStrokeCursor()) {
                    this.applyStrokeToolCursor();
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
                } else if (this.drawEnabled && this.usesStrokeCursor()) {
                    this.fabric.defaultCursor = TacticsCanvas.getDrawToolCursor(
                        this.tool,
                        this.getStrokeWidth(),
                    );
                    this.fabric.freeDrawingCursor = this.fabric.defaultCursor;
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
                this.updateDrawToolCursor();
                this.saveToolPrefs();
            });
            window.AbsTacticsToolSettings?.onChange(() => {
                this.syncFreeDrawingBrushStyles();
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
            if (!target || TacticsCanvas.isMapDecoration(target)) return null;

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

        getObjectLineType(obj) {
            if (obj?.tacticsLineType) return obj.tacticsLineType;
            const inferred = this.inferLineTypeFromStroke(obj);
            if (inferred) return inferred;
            return this.getToolSettings().lineType || 'solid';
        }

        inferLineTypeFromStroke(obj) {
            const dash = obj?.strokeDashArray;
            if (!dash?.length) return 'solid';
            if (dash[0] <= 0.01) return 'dotted';
            return 'dashed';
        }

        getStrokeLineCapForType(lineType) {
            return window.AbsTacticsToolSettings?.getStrokeLineCap?.(lineType)
                || (lineType === 'dotted' ? 'round' : 'round');
        }

        getStrokeLineCap() {
            return this.getStrokeLineCapForType(this.getToolSettings().lineType || 'solid');
        }

        shouldForceButtCapForEnd(endType) {
            return endType === 'bar';
        }

        resolveStrokeLineCap(obj) {
            const endType = obj?.tacticsEndType;
            const lineType = this.getObjectLineType(obj);
            if (lineType === 'dotted') {
                return 'round';
            }
            if (endType === 'bar') {
                return 'butt';
            }
            if (endType === 'arrow' && obj?.type === 'line') {
                return 'butt';
            }
            if (this.shouldForceButtCapForEnd(endType)) {
                return 'butt';
            }
            return this.getStrokeLineCapForType(lineType);
        }

        applyStrokeStyle(obj) {
            if (!obj) return;
            const lineType = this.getObjectLineType(obj);
            const strokeWidth = obj.strokeWidth || this.getStrokeWidth();
            const dash = window.AbsTacticsToolSettings?.getStrokeDashArray(lineType, strokeWidth) || null;
            obj.set({
                strokeDashArray: dash || null,
                strokeLineCap: this.resolveStrokeLineCap(obj),
                strokeLineJoin: window.AbsTacticsToolSettings?.getStrokeLineJoin?.(lineType) || 'round',
            });
        }

        syncFreeDrawingBrushStyles() {
            const brush = this.fabric?.freeDrawingBrush;
            if (!brush) return;
            const lineType = this.getToolSettings().lineType || 'solid';
            const endType = this.getEndType();
            const useButtEndCap = this.tool === 'pen'
                && lineType !== 'dotted'
                && (this.shouldForceButtCapForEnd(endType) || endType === 'arrow');
            brush.color = this.getStrokeColor();
            brush.width = this.getStrokeWidth();
            brush.strokeDashArray = this.getStrokeDashArray();
            brush.strokeLineCap = useButtEndCap ? 'butt' : this.getStrokeLineCap();
            brush.strokeLineJoin = window.AbsTacticsToolSettings?.getStrokeLineJoin?.(lineType) || 'round';
            if (this.tool === 'pen' && brush.decimate != null) {
                brush.decimate = Math.max(2, brush.width * TacticsCanvas.PEN_DECIMATE_FACTOR);
            }
            this.updateDrawToolCursor();
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

        }

        clearRemoteStrokeFabricPreview(entry) {
            if (!entry?.fabricObjs?.length || !this.fabric) return;
            this.isRemote = true;
            entry.fabricObjs.forEach((obj) => this.fabric.remove(obj));
            this.isRemote = false;
            entry.fabricObjs = [];
        }

        createRemoteStrokeFabricShape(tool, segment, entry, capCtx = null) {
            const space = TacticsCanvas.COORD_SPACE;
            const color = entry.color || '#ff4444';
            const logicalWidth = entry.width || 4;
            const lineType = entry.lineType || 'solid';
            const endType = entry.endType || 'none';
            const isLine = tool === 'line';
            const lineCap = this.resolveRemoteStrokeLineCap(endType, lineType, isLine);
            const lineJoin = window.AbsTacticsToolSettings?.getStrokeLineJoin?.(lineType) || 'round';
            const dash = window.AbsTacticsToolSettings?.getStrokeDashArray(lineType, logicalWidth);
            const baseOpts = {
                stroke: color,
                strokeWidth: logicalWidth,
                fill: 'transparent',
                strokeLineCap: lineCap,
                strokeLineJoin: lineJoin,
                strokeDashArray: dash || null,
                selectable: false,
                evented: false,
                opacity: 0.85,
                isRemoteStrokePreview: true,
            };

            if (isLine && segment.length >= 2) {
                const start = segment[0];
                const end = segment[segment.length - 1];
                let endX = (end.x || 0) * space;
                let endY = (end.y || 0) * space;
                if (capCtx && (endType === 'arrow' || endType === 'bar')) {
                    endX = capCtx.geom.bodyX2;
                    endY = capCtx.geom.bodyY2;
                }
                return new fabric.Line([
                    (start.x || 0) * space,
                    (start.y || 0) * space,
                    endX,
                    endY,
                ], baseOpts);
            }

            if (segment.length < 2) {
                if (segment.length !== 1) return null;
                const p = segment[0];
                const radius = Math.max(1.5, logicalWidth / 2);
                return new fabric.Circle({
                    left: (p.x || 0) * space - radius,
                    top: (p.y || 0) * space - radius,
                    radius,
                    fill: color,
                    stroke: null,
                    selectable: false,
                    evented: false,
                    opacity: 0.85,
                    isRemoteStrokePreview: true,
                });
            }

            const fabricPoints = segment.map((p) => ({
                x: (p.x || 0) * space,
                y: (p.y || 0) * space,
            }));
            const normalized = this.normalizePolygonPoints(fabricPoints);
            return new fabric.Polyline(normalized.points, {
                ...baseOpts,
                left: normalized.left,
                top: normalized.top,
            });
        }

        buildRemoteStrokeCapFabricContext(entry, previewPoints) {
            const endType = entry?.endType || 'none';
            if (endType !== 'arrow' && endType !== 'bar') return null;
            if (!previewPoints || previewPoints.length < 2) return null;

            const space = TacticsCanvas.COORD_SPACE;
            const logicalWidth = entry.width || 4;
            const mode = entry.tool === 'line' ? 'line' : 'pen';
            const logicalPts = previewPoints.map((p) => ({
                x: (p.x || 0) * space,
                y: (p.y || 0) * space,
            }));
            const wt = this.resolveArrowEndpoints({
                points: logicalPts,
                mode,
                strokeWidth: logicalWidth,
            });
            if (!wt) return null;

            const geom = this.getLineEndGeometry(
                wt.a.x,
                wt.a.y,
                wt.b.x,
                wt.b.y,
                endType,
                logicalWidth,
                { pen: mode === 'pen' && endType === 'arrow' },
            );
            if (!geom || geom.dist < 0.5) return null;

            return {
                wt,
                geom,
                endType,
                mode,
                logicalWidth,
                color: entry.color || '#ff4444',
                space,
            };
        }

        createRemoteStrokeFabricCap(capCtx) {
            if (!capCtx) return null;
            const { wt, geom, endType, mode, logicalWidth, color } = capCtx;
            const baseOpts = {
                stroke: color,
                strokeWidth: logicalWidth,
                fill: 'transparent',
                selectable: false,
                evented: false,
                opacity: 0.85,
                isRemoteStrokePreview: true,
            };

            if (endType === 'arrow') {
                let tipX = wt.b.x;
                let tipY = wt.b.y;
                if (mode === 'pen') {
                    const forward = this.getPenArrowTipForward(logicalWidth);
                    const offset = this.offsetPointAlong(
                        tipX - wt.a.x,
                        tipY - wt.a.y,
                        forward,
                    );
                    if (offset) {
                        tipX += offset.x;
                        tipY += offset.y;
                    }
                }
                const arrow = this.buildArrowFromEndpoints(wt.a, { x: tipX, y: tipY }, logicalWidth);
                if (!arrow?.triangle) return null;
                const triangle = arrow.triangle;
                const normalized = this.normalizePolygonPoints([
                    { x: triangle.leftX, y: triangle.leftY },
                    { x: triangle.tipX, y: triangle.tipY },
                    { x: triangle.rightX, y: triangle.rightY },
                ]);
                return new fabric.Polyline(normalized.points, {
                    ...baseOpts,
                    left: normalized.left,
                    top: normalized.top,
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                });
            }

            if (endType === 'bar') {
                const half = this.getBarCapHalfLength(logicalWidth);
                const perp = geom.angle + Math.PI / 2;
                return new fabric.Line([
                    geom.tipX - half * Math.cos(perp),
                    geom.tipY - half * Math.sin(perp),
                    geom.tipX + half * Math.cos(perp),
                    geom.tipY + half * Math.sin(perp),
                ], {
                    ...baseOpts,
                    strokeLineCap: 'butt',
                });
            }

            return null;
        }

        normalizePoint(pointer) {
            const w = this.fabric?.getWidth() || 1;
            const h = this.fabric?.getHeight() || 1;
            return { x: pointer.x / w, y: pointer.y / h };
        }

        isNormalizedPointInside(p) {
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
            return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
        }

        segmentUnitSquareIntersection(inside, outside) {
            if (!inside || !outside) return null;
            const dx = outside.x - inside.x;
            const dy = outside.y - inside.y;
            if (!dx && !dy) return null;

            let bestT = null;
            const consider = (t) => {
                if (!Number.isFinite(t) || t <= 0 || t > 1) return;
                if (bestT !== null && t >= bestT) return;
                const x = inside.x + dx * t;
                const y = inside.y + dy * t;
                if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
                    bestT = t;
                }
            };

            if (dx) {
                consider((0 - inside.x) / dx);
                consider((1 - inside.x) / dx);
            }
            if (dy) {
                consider((0 - inside.y) / dy);
                consider((1 - inside.y) / dy);
            }
            if (bestT === null) return null;
            return { x: inside.x + dx * bestT, y: inside.y + dy * bestT };
        }

        getLocalStrokePointCount() {
            return (this.localStrokeSegments || []).reduce((n, seg) => n + seg.length, 0);
        }

        getLastLocalStrokePoint() {
            const segs = this.localStrokeSegments;
            if (!segs?.length) return null;
            const lastSeg = segs[segs.length - 1];
            return lastSeg?.length ? lastSeg[lastSeg.length - 1] : null;
        }

        ensureLocalStrokeSegment() {
            if (!this.localStrokeSegments.length) {
                this.localStrokeSegments.push([]);
            }
            return this.localStrokeSegments[this.localStrokeSegments.length - 1];
        }

        startNewLocalStrokeSegment() {
            this.localStrokeSegments.push([]);
        }

        appendLocalStrokeBroadcastPoint(pt) {
            const w = this.fabric?.getWidth() || 1;
            const h = this.fabric?.getHeight() || 1;
            const minNorm = TacticsCanvas.PEN_MIN_POINT_DIST / Math.min(w, h);
            const last = this.getLastLocalStrokePoint();
            if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < minNorm) {
                return false;
            }
            this.ensureLocalStrokeSegment().push(pt);
            return true;
        }

        collectPendingStrokeBroadcast() {
            const chunks = [];
            const pos = this.localStrokeBroadcastPos;
            const segs = this.localStrokeSegments;
            if (!segs?.length) return chunks;

            for (let si = pos.seg; si < segs.length; si += 1) {
                const startPt = si === pos.seg ? pos.pt : 0;
                const slice = segs[si].slice(startPt);
                if (!slice.length) continue;
                chunks.push({ segmentBreak: si > pos.seg, points: slice });
            }
            return chunks;
        }

        advanceLocalStrokeBroadcastPos() {
            const segs = this.localStrokeSegments;
            if (!segs.length) {
                this.localStrokeBroadcastPos = { seg: 0, pt: 0 };
                return;
            }
            const seg = segs.length - 1;
            this.localStrokeBroadcastPos = { seg, pt: segs[seg].length };
        }

        sendCursorFromPointerEvent(ev, visible) {
            if (!this.slideId || !ev) return;

            let x;
            let y;
            if (this.fabric) {
                const pointer = this.fabric.getPointer(ev);
                const w = this.fabric.getWidth() || 1;
                const h = this.fabric.getHeight() || 1;
                x = pointer.x / w;
                y = pointer.y / h;
            } else {
                const canvas = this.canvasEl;
                if (!canvas) return;
                const bounds = canvas.getBoundingClientRect();
                if (bounds.width <= 0 || bounds.height <= 0) return;
                x = (ev.clientX - bounds.left) / bounds.width;
                y = (ev.clientY - bounds.top) / bounds.height;
            }

            if (x < 0 || x > 1 || y < 0 || y > 1) {
                if (!visible) this.queueCursorSend(0, 0, false);
                return;
            }
            this.queueCursorSend(x, y, visible);
        }

        shouldIgnorePenDown(pointer) {
            const now = Date.now();
            const pt = { x: pointer.x, y: pointer.y };
            const prevAt = this.penLastDownAt;
            const prevPt = this.penLastDownPoint;
            const isDouble = prevAt
                && now - prevAt < TacticsCanvas.PEN_DOUBLE_CLICK_MS
                && prevPt
                && Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) < TacticsCanvas.PEN_DOUBLE_CLICK_DIST;

            this.penLastDownAt = now;
            this.penLastDownPoint = { x: pt.x, y: pt.y };
            return isDouble;
        }

        getPenPathTravel(path) {
            if (!path?.path?.length || !fabric.util?.getPathSegmentsInfo) return 0;
            try {
                const segments = fabric.util.getPathSegmentsInfo(path.path);
                return segments.length ? segments[segments.length - 1].length : 0;
            } catch (err) {
                return 0;
            }
        }

        isValidPenPath(path) {
            if (!path || path.type !== 'path') return false;
            if (this.getPenPathTravel(path) >= TacticsCanvas.PEN_MIN_STROKE_LENGTH) {
                return true;
            }
            const bounds = typeof path.getBoundingRect === 'function'
                ? path.getBoundingRect(true, true)
                : null;
            return !!(bounds && (bounds.width > 0.75 || bounds.height > 0.75));
        }

        cancelPenStroke() {
            this.penLivePointer = null;
            if (this.strokePointBroadcastRaf) {
                cancelAnimationFrame(this.strokePointBroadcastRaf);
                this.strokePointBroadcastRaf = 0;
            }
            if (this.localStrokeId) {
                this.finishLocalStrokeBroadcast();
            }
            const brush = this.fabric?.freeDrawingBrush;
            if (brush) {
                brush._isCurrentlyDrawing = false;
                if (typeof brush._reset === 'function') {
                    brush._reset();
                }
            }
            if (this.fabric?.contextTop && typeof this.fabric.clearContext === 'function') {
                this.fabric.clearContext(this.fabric.contextTop);
            }
            this.fabric?.requestRenderAll();
        }

        onPenBrushMouseUp() {
            this.penLivePointer = null;
            if (this.penMouseUpCleanupRaf) {
                cancelAnimationFrame(this.penMouseUpCleanupRaf);
            }
            this.penMouseUpCleanupRaf = requestAnimationFrame(() => {
                this.penMouseUpCleanupRaf = 0;
                if (!this.localStrokeId) return;
                this.finishLocalStrokeBroadcast();
            });
        }

        startLocalStrokeBroadcast(pointer) {
            if (!this.slideId) return;
            if (this.localStrokeId) {
                this.finishLocalStrokeBroadcast();
            }
            this.localStrokeId = 'ls' + Math.random().toString(16).slice(2, 10);
            const pt = this.normalizePoint(pointer);
            const inside = this.isNormalizedPointInside(pt);
            this.localStrokeSegments = inside ? [[pt]] : [[]];
            this.localStrokeBroadcastPos = { seg: 0, pt: inside ? 1 : 0 };
            this.localStrokeBroadcastOutside = !inside;
            this.localStrokeLastOutsideNorm = inside ? null : pt;
            this.lastStrokePointBroadcastAt = 0;
            this.onOp({
                op: 'stroke_start',
                slideId: this.slideId,
                payload: {
                    strokeId: this.localStrokeId,
                    tool: this.tool,
                    color: this.getStrokeColor(),
                    width: this.getStrokeWidth(),
                    endType: this.getEndType(),
                    lineType: this.getToolSettings().lineType || 'solid',
                    points: inside ? [pt] : [],
                    segments: this.localStrokeSegments.map((seg) => seg.slice()),
                },
            });
        }

        scheduleStrokePointBroadcast() {
            if (!this.localStrokeId || !this.slideId) return;
            if (this.strokePointBroadcastRaf) return;
            this.strokePointBroadcastRaf = requestAnimationFrame(() => {
                this.strokePointBroadcastRaf = 0;
                this.flushStrokePointBroadcast();
            });
        }

        flushStrokePointBroadcast(minPoints = 2) {
            if (!this.localStrokeId || !this.slideId) return;

            const hasLive = !!this.penLivePointer;
            const liveNorm = hasLive ? this.normalizePoint(this.penLivePointer) : null;
            const liveInside = liveNorm && this.isNormalizedPointInside(liveNorm);
            if (hasLive && !liveInside) {
                this.localStrokeLastOutsideNorm = liveNorm;
                const last = this.getLastLocalStrokePoint();
                if (last && this.isNormalizedPointInside(last) && !this.localStrokeBroadcastOutside) {
                    const edge = this.segmentUnitSquareIntersection(last, liveNorm);
                    if (edge) this.appendLocalStrokeBroadcastPoint(edge);
                    this.localStrokeBroadcastOutside = true;
                }
            } else if (hasLive && liveInside && this.localStrokeBroadcastOutside) {
                const outside = this.localStrokeLastOutsideNorm || liveNorm;
                const edge = this.isNormalizedPointInside(outside)
                    ? outside
                    : this.segmentUnitSquareIntersection(liveNorm, outside);
                if (this.getLastLocalStrokePoint()) {
                    this.startNewLocalStrokeSegment();
                } else if (!this.localStrokeSegments.length) {
                    this.localStrokeSegments.push([]);
                }
                if (edge) this.appendLocalStrokeBroadcastPoint(edge);
                this.localStrokeBroadcastOutside = false;
                this.localStrokeLastOutsideNorm = null;
            }

            const chunks = this.collectPendingStrokeBroadcast();
            if (!chunks.length && !hasLive) return;
            if (this.getLocalStrokePointCount() < minPoints && !chunks.length) return;

            const longStroke = this.getLocalStrokePointCount()
                > TacticsCanvas.REMOTE_STROKE_BROADCAST_LONG_THRESHOLD;
            const minInterval = longStroke
                ? TacticsCanvas.REMOTE_STROKE_BROADCAST_MIN_INTERVAL_MS
                : 0;
            const now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now();
            if (minInterval > 0 && now - this.lastStrokePointBroadcastAt < minInterval) {
                this.scheduleStrokePointBroadcast();
                return;
            }

            if (chunks.length) {
                chunks.forEach((chunk, index) => {
                    const payload = {
                        strokeId: this.localStrokeId,
                        append: chunk.points,
                    };
                    if (chunk.segmentBreak) {
                        payload.segmentBreak = true;
                    }
                    if (index === chunks.length - 1 && hasLive) {
                        payload.livePoint = liveInside ? liveNorm : null;
                    }
                    this.onOp({
                        op: 'stroke_point',
                        slideId: this.slideId,
                        payload,
                    });
                });
                this.advanceLocalStrokeBroadcastPos();
            } else if (hasLive) {
                this.onOp({
                    op: 'stroke_point',
                    slideId: this.slideId,
                    payload: {
                        strokeId: this.localStrokeId,
                        livePoint: liveInside ? liveNorm : null,
                    },
                });
            }
            this.lastStrokePointBroadcastAt = now;
        }

        queueStrokePointBroadcast(pointer) {
            if (!this.localStrokeId || !this.slideId) return;
            const pt = this.normalizePoint(pointer);
            const inside = this.isNormalizedPointInside(pt);

            if (!inside) {
                this.localStrokeLastOutsideNorm = pt;
                const last = this.getLastLocalStrokePoint();
                if (last && this.isNormalizedPointInside(last) && !this.localStrokeBroadcastOutside) {
                    const edge = this.segmentUnitSquareIntersection(last, pt);
                    if (edge) this.appendLocalStrokeBroadcastPoint(edge);
                }
                this.localStrokeBroadcastOutside = true;
                this.scheduleStrokePointBroadcast();
                return;
            }

            if (this.localStrokeBroadcastOutside) {
                const outside = this.localStrokeLastOutsideNorm || pt;
                const edge = this.isNormalizedPointInside(outside)
                    ? outside
                    : this.segmentUnitSquareIntersection(pt, outside);
                if (this.getLastLocalStrokePoint()) {
                    this.startNewLocalStrokeSegment();
                } else if (!this.localStrokeSegments.length) {
                    this.localStrokeSegments.push([]);
                }
                if (edge) {
                    this.appendLocalStrokeBroadcastPoint(edge);
                }
                this.appendLocalStrokeBroadcastPoint(pt);
                this.localStrokeBroadcastOutside = false;
                this.localStrokeLastOutsideNorm = null;
                this.scheduleStrokePointBroadcast();
                return;
            }

            if (this.appendLocalStrokeBroadcastPoint(pt)) {
                this.scheduleStrokePointBroadcast();
            }
        }

        finishLocalStrokeBroadcast() {
            if (this.strokePointBroadcastRaf) {
                cancelAnimationFrame(this.strokePointBroadcastRaf);
                this.strokePointBroadcastRaf = 0;
            }
            this.flushStrokePointBroadcast(1);
            if (!this.localStrokeId || !this.slideId) return;
            this.onOp({
                op: 'stroke_end',
                slideId: this.slideId,
                payload: { strokeId: this.localStrokeId },
            });
            this.localStrokeId = null;
            this.localStrokeSegments = [];
            this.localStrokeBroadcastPos = { seg: 0, pt: 0 };
            this.localStrokeBroadcastOutside = false;
            this.localStrokeLastOutsideNorm = null;
            this.lastStrokePointBroadcastAt = 0;
        }

        getRemoteStrokeKey(clientId, strokeId) {
            return `${clientId || ''}:${strokeId || ''}`;
        }

        removeRemoteStroke(clientId, strokeId) {
            const key = this.getRemoteStrokeKey(clientId, strokeId);
            const entry = this.remoteStrokes.get(key);
            if (!entry) return;
            if (entry.renderRaf) {
                cancelAnimationFrame(entry.renderRaf);
                entry.renderRaf = 0;
            }
            this.clearRemoteStrokeFabricPreview(entry);
            entry.el?.remove();
            this.remoteStrokes.delete(key);
            this.fabric?.requestRenderAll();
        }

        scheduleRemoteStrokeRender(entry) {
            if (!entry) return;
            if (entry.renderRaf) {
                cancelAnimationFrame(entry.renderRaf);
                entry.renderRaf = 0;
            }
            entry.renderRaf = requestAnimationFrame(() => {
                entry.renderRaf = 0;
                this.renderRemoteStrokePath(entry);
            });
        }

        refreshRemoteStrokes() {
            this.remoteStrokes.forEach((entry) => this.scheduleRemoteStrokeRender(entry));
        }

        getSvgStrokeDashAttr(lineType, strokeWidth) {
            const dash = window.AbsTacticsToolSettings?.getStrokeDashArray(lineType, strokeWidth);
            if (!dash?.length) return '';
            return ` stroke-dasharray="${dash.join(',')}"`;
        }

        resolveRemoteStrokeLineCap(endType, lineType, isLine) {
            if (lineType === 'dotted') {
                return 'round';
            }
            if (endType === 'bar' || endType === 'arrow') {
                return 'butt';
            }
            return window.AbsTacticsToolSettings?.getStrokeLineCap?.(lineType)
                || (isLine ? 'butt' : 'round');
        }

        decimateNormalizedStrokePoints(points, maxPoints) {
            if (!Array.isArray(points) || points.length <= maxPoints) {
                return points ? points.slice() : [];
            }
            if (maxPoints < 2) return [points[0]];
            const out = [points[0]];
            const slots = maxPoints - 2;
            const span = points.length - 2;
            for (let i = 1; i <= slots; i += 1) {
                const idx = 1 + Math.round((i * span) / (slots + 1));
                out.push(points[Math.min(points.length - 2, Math.max(1, idx))]);
            }
            out.push(points[points.length - 1]);
            return out;
        }

        getRemoteStrokePreviewSegments(entry) {
            let segments = Array.isArray(entry?.segments) && entry.segments.length
                ? entry.segments.map((seg) => (Array.isArray(seg) ? seg.slice() : []))
                : (Array.isArray(entry?.points) && entry.points.length
                    ? [entry.points.slice()]
                    : []);
            if (!segments.length) {
                segments = [[]];
            }

            const live = entry?.livePoint;
            if (live && this.isNormalizedPointInside(live)) {
                const lastSeg = segments[segments.length - 1];
                const last = lastSeg[lastSeg.length - 1];
                const minNorm = TacticsCanvas.PEN_MIN_POINT_DIST / TacticsCanvas.COORD_SPACE;
                if (!last || Math.hypot(live.x - last.x, live.y - last.y) >= minNorm * 0.25) {
                    lastSeg.push(live);
                }
            }
            return segments.filter((seg) => seg.length);
        }

        getRemoteStrokePreviewPoints(entry) {
            return this.getRemoteStrokePreviewSegments(entry).flat();
        }

        getRemoteStrokeBodyPreviewSegments(entry) {
            const segments = this.getRemoteStrokePreviewSegments(entry);
            if (!segments.length) return [];
            const total = segments.reduce((n, seg) => n + seg.length, 0);
            const maxPoints = TacticsCanvas.REMOTE_STROKE_PREVIEW_MAX_POINTS;
            if (total <= maxPoints) return segments;
            const perSegment = Math.max(2, Math.floor(maxPoints / segments.length));
            return segments.map((seg) => this.decimateNormalizedStrokePoints(seg, perSegment));
        }

        getRemoteStrokeBodyPreviewPoints(entry) {
            return this.getRemoteStrokeBodyPreviewSegments(entry).flat();
        }

        getRemoteStrokeCapSourcePoints(entry) {
            const segments = this.getRemoteStrokePreviewSegments(entry);
            const preview = segments[segments.length - 1] || [];
            const capMax = TacticsCanvas.REMOTE_STROKE_CAP_SOURCE_POINTS;
            if (preview.length <= capMax) return preview;
            return [preview[0], ...preview.slice(-(capMax - 1))];
        }

        buildRemoteStrokeCapPreview(entry, previewPoints, contentWidth) {
            const endType = entry?.endType || 'none';
            if (endType !== 'arrow' && endType !== 'bar') return null;
            if (!previewPoints || previewPoints.length < 2) return null;

            const space = TacticsCanvas.COORD_SPACE;
            const logicalWidth = entry.width || 4;
            const scale = contentWidth / space;
            const mode = entry.tool === 'line' ? 'line' : 'pen';
            const logicalPts = previewPoints.map((p) => ({
                x: (p.x || 0) * space,
                y: (p.y || 0) * space,
            }));
            const wt = this.resolveArrowEndpoints({
                points: logicalPts,
                mode,
                strokeWidth: logicalWidth,
            });
            if (!wt) return null;

            const geom = this.getLineEndGeometry(
                wt.a.x,
                wt.a.y,
                wt.b.x,
                wt.b.y,
                endType,
                logicalWidth,
                { pen: mode === 'pen' && endType === 'arrow' },
            );
            if (!geom || geom.dist < 0.5) return null;

            const toCanvasLogical = (pt) => this.canvasPointToOverlay(pt.x, pt.y);

            return {
                wt,
                geom,
                logicalWidth,
                scale,
                endType,
                mode,
                toCanvasLogical,
            };
        }

        buildRemoteStrokeSvgParts(entry) {
            const metrics = this.getMapContentMetrics();
            const previewSegments = this.getRemoteStrokeBodyPreviewSegments(entry);
            const previewPoints = previewSegments.flat();
            const capSourcePoints = this.getRemoteStrokeCapSourcePoints(entry);
            if (!previewPoints.length || !metrics || metrics.width <= 0 || metrics.height <= 0) return [];

            const toCanvas = (p) => this.normalizedMapPointToOverlay(p.x || 0, p.y || 0);

            const color = entry.color || '#ff4444';
            const logicalWidth = entry.width || 4;
            const scale = metrics.width / TacticsCanvas.COORD_SPACE;
            const strokeWidth = logicalWidth * scale;
            const isLine = entry.tool === 'line';
            const lineType = entry.lineType || 'solid';
            const endType = entry.endType || 'none';
            const lineCap = this.resolveRemoteStrokeLineCap(endType, lineType, isLine);
            const lineJoin = window.AbsTacticsToolSettings?.getStrokeLineJoin?.(lineType) || 'round';
            const dash = window.AbsTacticsToolSettings?.getStrokeDashArray(lineType, logicalWidth);
            const strokeAttrs = {
                stroke: color,
                'stroke-width': strokeWidth,
                'stroke-linecap': lineCap,
                'stroke-linejoin': lineJoin,
                opacity: '0.85',
            };
            if (dash?.length) {
                strokeAttrs['stroke-dasharray'] = dash.map((n) => n * scale).join(',');
            }
            const capPreview = this.buildRemoteStrokeCapPreview(entry, capSourcePoints, metrics.width);
            const parts = [];
            const space = TacticsCanvas.COORD_SPACE;

            if (!isLine && previewPoints.length === 1) {
                const pt = toCanvas(previewPoints[0]);
                const dotR = Math.max(1.5, strokeWidth / 2);
                parts.push({
                    tag: 'circle',
                    attrs: {
                        cx: pt.x,
                        cy: pt.y,
                        r: dotR,
                        fill: color,
                        opacity: '0.85',
                    },
                });
            }

            if (isLine && previewPoints.length >= 2) {
                const start = toCanvas(previewPoints[0]);
                let end = toCanvas(previewPoints[previewPoints.length - 1]);
                if (capPreview) {
                    end = capPreview.toCanvasLogical({
                        x: capPreview.geom.bodyX2,
                        y: capPreview.geom.bodyY2,
                    });
                } else if (endType === 'arrow' || endType === 'bar') {
                    const geom = this.getLineEndGeometry(
                        start.x,
                        start.y,
                        end.x,
                        end.y,
                        endType,
                        strokeWidth,
                    );
                    end = { x: geom.bodyX2, y: geom.bodyY2 };
                }
                parts.push({
                    tag: 'line',
                    attrs: {
                        x1: start.x,
                        y1: start.y,
                        x2: end.x,
                        y2: end.y,
                        ...strokeAttrs,
                    },
                });
            } else {
                const lastSegIdx = previewSegments.length - 1;
                previewSegments.forEach((segment, segIdx) => {
                    if (segment.length < 2) return;
                    const bodyNormPts = segment.slice();
                    if (segIdx === lastSegIdx && capPreview) {
                        bodyNormPts[bodyNormPts.length - 1] = {
                            x: capPreview.geom.bodyX2 / space,
                            y: capPreview.geom.bodyY2 / space,
                        };
                    }
                    const canvasPts = bodyNormPts.map((p) => toCanvas(p));
                    parts.push({
                        tag: 'polyline',
                        attrs: {
                            points: canvasPts.map((pt) => `${pt.x},${pt.y}`).join(' '),
                            fill: 'none',
                            ...strokeAttrs,
                        },
                    });
                });
            }

            if (capPreview) {
                const { wt, geom, mode, toCanvasLogical } = capPreview;
                if (endType === 'arrow') {
                    let tipX = wt.b.x;
                    let tipY = wt.b.y;
                    if (mode === 'pen') {
                        const forward = this.getPenArrowTipForward(logicalWidth);
                        const offset = this.offsetPointAlong(
                            tipX - wt.a.x,
                            tipY - wt.a.y,
                            forward,
                        );
                        if (offset) {
                            tipX += offset.x;
                            tipY += offset.y;
                        }
                    }
                    const arrow = this.buildArrowFromEndpoints(
                        toCanvasLogical(wt.a),
                        toCanvasLogical({ x: tipX, y: tipY }),
                        strokeWidth,
                    );
                    const polyAttr = this.arrowChevronToPolylineAttr(arrow?.triangle);
                    if (polyAttr) {
                        parts.push({
                            tag: 'polyline',
                            attrs: {
                                points: polyAttr,
                                fill: 'none',
                                stroke: color,
                                'stroke-width': strokeWidth,
                                'stroke-linecap': 'round',
                                'stroke-linejoin': 'round',
                                opacity: '0.85',
                            },
                        });
                    }
                } else {
                    const tip = toCanvasLogical({ x: geom.tipX, y: geom.tipY });
                    const half = this.getBarCapHalfLength(logicalWidth) * scale;
                    const perp = geom.angle + Math.PI / 2;
                    const x1 = tip.x - half * Math.cos(perp);
                    const y1 = tip.y - half * Math.sin(perp);
                    const x2 = tip.x + half * Math.cos(perp);
                    const y2 = tip.y + half * Math.sin(perp);
                    parts.push({
                        tag: 'line',
                        attrs: {
                            x1,
                            y1,
                            x2,
                            y2,
                            stroke: color,
                            'stroke-width': strokeWidth,
                            'stroke-linecap': 'butt',
                            opacity: '0.85',
                        },
                    });
                }
            }

            return parts;
        }

        renderRemoteStrokePath(entry) {
            const hasPoints = Array.isArray(entry?.segments)
                ? entry.segments.some((seg) => seg.length)
                : entry.points?.length;
            if (!this.fabric || !entry || !hasPoints) return;

            const previewSegments = this.getRemoteStrokeBodyPreviewSegments(entry);
            if (!previewSegments.length) return;

            const capSourcePoints = this.getRemoteStrokeCapSourcePoints(entry);
            const capCtx = this.buildRemoteStrokeCapFabricContext(entry, capSourcePoints);
            const space = TacticsCanvas.COORD_SPACE;

            this.clearRemoteStrokeFabricPreview(entry);
            const fabricObjs = [];
            this.isRemote = true;
            try {
                const lastSegIdx = previewSegments.length - 1;
                previewSegments.forEach((segment, segIdx) => {
                    if (!segment.length) return;
                    let seg = segment;
                    if (capCtx && segIdx === lastSegIdx && seg.length >= 2 && entry.tool !== 'line') {
                        seg = seg.slice();
                        seg[seg.length - 1] = {
                            x: capCtx.geom.bodyX2 / space,
                            y: capCtx.geom.bodyY2 / space,
                        };
                    }
                    const shape = this.createRemoteStrokeFabricShape(
                        entry.tool,
                        seg,
                        entry,
                        entry.tool === 'line' ? capCtx : null,
                    );
                    if (!shape) return;
                    this.fabric.add(shape);
                    fabricObjs.push(shape);
                });

                const capShape = this.createRemoteStrokeFabricCap(capCtx);
                if (capShape) {
                    this.fabric.add(capShape);
                    fabricObjs.push(capShape);
                }

                entry.fabricObjs = fabricObjs;
            } finally {
                this.isRemote = false;
                this.syncInteractionState();
                this.fabric.requestRenderAll();
            }
        }

        removeRemoteStrokesFromClient(clientId) {
            const prefix = `${clientId}:`;
            for (const [key, entry] of this.remoteStrokes.entries()) {
                if (!key.startsWith(prefix)) continue;
                if (entry.renderRaf) {
                    cancelAnimationFrame(entry.renderRaf);
                    entry.renderRaf = 0;
                }
                this.clearRemoteStrokeFabricPreview(entry);
                entry.el?.remove();
                this.remoteStrokes.delete(key);
            }
            this.fabric?.requestRenderAll();
        }

        applyRemoteStrokeOp(msg) {
            if (!msg?.payload) return;
            const from = String(msg.from || msg.clientId || '');
            if (from && from === String(this.clientId || '')) return;

            const p = msg.payload;
            const key = this.getRemoteStrokeKey(from, p.strokeId);
            let entry = this.remoteStrokes.get(key);

            if (msg.op === 'stroke_start') {
                if (entry) {
                    this.removeRemoteStroke(from, p.strokeId);
                }
                const segments = Array.isArray(p.segments) && p.segments.length
                    ? p.segments.map((seg) => (Array.isArray(seg) ? seg.slice() : []))
                    : (Array.isArray(p.points) && p.points.length ? [p.points.slice()] : [[]]);
                entry = {
                    tool: p.tool || 'pen',
                    segments,
                    points: segments.flat(),
                    color: p.color,
                    width: p.width,
                    endType: p.endType || 'none',
                    lineType: p.lineType || 'solid',
                    fabricObjs: [],
                    renderRaf: 0,
                };
                this.remoteStrokes.set(key, entry);
                this.scheduleRemoteStrokeRender(entry);
                return;
            }

            if (!entry) return;

            if (msg.op === 'stroke_point') {
                if (entry.tool === 'line') {
                    const incoming = Array.isArray(p.append) && p.append.length
                        ? p.append
                        : (Array.isArray(p.points) ? p.points : []);
                    const start = entry.points[0] || incoming[0];
                    const latest = p.livePoint || incoming[incoming.length - 1];
                    entry.points = start && latest ? [start, latest] : incoming.slice(-2);
                    entry.segments = [entry.points.slice()];
                } else {
                    if (!Array.isArray(entry.segments) || !entry.segments.length) {
                        entry.segments = entry.points?.length ? [entry.points.slice()] : [[]];
                    }
                    if (p.segmentBreak) {
                        entry.segments.push([]);
                    }
                    const tail = entry.segments[entry.segments.length - 1];
                    if (Array.isArray(p.append) && p.append.length) {
                        tail.push(...p.append);
                    } else if (Array.isArray(p.points)) {
                        entry.segments = [p.points.slice()];
                    }
                    entry.points = entry.segments.flat();
                }
                const live = p.livePoint;
                entry.livePoint = live && this.isNormalizedPointInside(live) ? live : null;
                this.scheduleRemoteStrokeRender(entry);
                return;
            }

            if (msg.op === 'stroke_end') {
                this.scheduleRemoteStrokeRender(entry);
            }
        }

        clearRemoteStrokes() {
            this.remoteStrokes.forEach((entry) => {
                if (entry.renderRaf) {
                    cancelAnimationFrame(entry.renderRaf);
                }
                this.clearRemoteStrokeFabricPreview(entry);
                entry.el?.remove();
            });
            this.remoteStrokes.clear();
            if (this.remoteStrokesLayerEl) {
                this.remoteStrokesLayerEl.innerHTML = '';
            }
            this.fabric?.requestRenderAll();
        }

        insertImageFromFile(file) {
            if (!this.fabric || !this.drawEnabled || !file) return;
            this.prepareCanvasImageDataUrl(file, (dataUrl) => {
                if (!dataUrl) return;
                fabric.Image.fromURL(dataUrl, (img) => {
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
                    this.markOwnObject(img);
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
            });
        }

        prepareCanvasImageDataUrl(file, callback) {
            const finish = (dataUrl) => callback(dataUrl || null);
            if (!(file instanceof Blob) || !String(file.type || '').startsWith('image/')) {
                finish(null);
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx || canvas.width <= 0 || canvas.height <= 0) {
                    finish(null);
                    return;
                }
                ctx.drawImage(img, 0, 0);
                let dataUrl = '';
                try {
                    dataUrl = canvas.toDataURL('image/webp', 0.88);
                    if (!dataUrl.startsWith('data:image/webp')) {
                        dataUrl = canvas.toDataURL('image/png');
                    }
                } catch (err) {
                    try {
                        dataUrl = canvas.toDataURL('image/png');
                    } catch (fallbackErr) {
                        dataUrl = '';
                    }
                }
                finish(dataUrl);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                const reader = new FileReader();
                reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null);
                reader.onerror = () => finish(null);
                reader.readAsDataURL(file);
            };
            img.src = objectUrl;
        }

        getPaletteControlElements() {
            return document.querySelectorAll(
                '.tactics-palette-swatch, .tactics-palette-action-btn, .tactics-hue-slider, '
                + '#tacticsStrokeWidth, #tacticsStrokeWidthShape, #tacticsFontSize, #tacticsShapeFilled, '
                + '#tacticsShapeFillOpacity, #tacticsIconLabel, #tacticsIconSize, #tacticsIconLabelSize, '
                + '#tacticsPingSize, #tacticsPingStrokeWidth, #tacticsCellFlashDuration, .tactics-option-btn, '
                + '.tactics-icon-grid__btn',
            );
        }

        syncPaletteControlsEnabled() {
            const disabled = this.interactionLocked;
            this.getPaletteControlElements().forEach((el) => {
                el.disabled = disabled;
                el.classList.toggle('is-disabled', disabled);
            });
        }

        setInteractionLocked(locked) {
            this.interactionLocked = !!locked;
            if (!this.interactionLocked) {
                this.syncPaletteControlsEnabled();
                this.setDrawEnabled(this.drawEnabled);
                return;
            }
            const strictDisabled = this.interactionLocked;

            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.disabled = strictDisabled;
                btn.classList.toggle('is-disabled', strictDisabled);
            });
            this.syncPaletteControlsEnabled();
            ['tacticsUndoBtn', 'tacticsRedoBtn', 'tacticsClearBtn'].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = strictDisabled || !this.drawEnabled;
                btn.classList.toggle('is-disabled', btn.disabled);
            });

            if (strictDisabled) {
                this.stopPingHold();
                this.stopCellDrag();
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

            if (disabled) {
                this.cancelPenStroke();
                this.fabric.isDrawingMode = false;
                this.fabric.discardActiveObject();
                if (this.tool !== 'select' && this.tool !== 'cell' && this.tool !== 'ping' && this.tool !== 'ruler') {
                    this.setTool('select');
                }
            } else {
                this.setTool(this.tool || 'select');
            }
            this.syncInteractionState();
            this.fabric.requestRenderAll();
        }

        setTool(tool) {
            if (this.interactionLocked) return;
            if (tool === 'line') {
                tool = 'select';
            }
            if (!this.drawEnabled && tool !== 'select' && tool !== 'cell' && tool !== 'ping' && tool !== 'ruler') return;
            this.stopPingHold();
            this.stopCellDrag();
            if (tool !== 'ruler') {
                this.clearRuler();
            }
            this.clearShapePreview();
            this.clearPolygonPreview();
            this.shapeStart = null;
            this.polygonPoints = [];
            if (this.tool === 'pen' && tool !== 'pen') {
                this.cancelPenStroke();
            }
            this.penLivePointer = null;
            this.tool = tool || 'select';
            this.toolbar?.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.classList.toggle('is-active', btn.getAttribute('data-tool') === this.tool);
            });
            this.updateToolContext();
            if (!this.fabric) return;

            this.fabric.isDrawingMode = this.drawEnabled && this.tool === 'pen';
            this.syncInteractionState();

            if (this.fabric.isDrawingMode) {
                const brush = createTacticsPencilBrush(this.fabric, this);
                if (brush) {
                    this.fabric.freeDrawingBrush = brush;
                } else {
                    this.fabric.freeDrawingBrush = new fabric.PencilBrush(this.fabric);
                }
                this.syncFreeDrawingBrushStyles();
            }
        }

        getCapBaseSize(strokeWidth = this.getStrokeWidth()) {
            const canvasH = this.fabric?.getHeight() || 1000;
            const scale = canvasH / 1000;
            return Math.max(strokeWidth * 2, 12) * scale;
        }

        getArrowHeadLength(strokeWidth = this.getStrokeWidth()) {
            const base = this.getCapBaseSize(strokeWidth);
            return Math.max(strokeWidth * 4.5, base * TacticsCanvas.ARROW_HEAD_LENGTH_SCALE);
        }

        getArrowInnerJoinInset(strokeWidth = this.getStrokeWidth(), headLen = null) {
            const len = headLen ?? this.getArrowHeadLength(strokeWidth);
            return len * Math.cos(TacticsCanvas.ARROW_HEAD_SPREAD);
        }

        getArrowBodyInset(strokeWidth = this.getStrokeWidth(), headLen = null) {
            return this.getArrowInnerJoinInset(strokeWidth, headLen);
        }

        getPenArrowTipForward(strokeWidth = this.getStrokeWidth()) {
            return Math.max(strokeWidth * 0.15, 1);
        }

        getPenArrowBodyInset(strokeWidth = this.getStrokeWidth(), headLen = null) {
            return this.getArrowBodyInset(strokeWidth, headLen) + strokeWidth * 0.2;
        }

        offsetPointAlong(dx, dy, distance) {
            const len = Math.hypot(dx, dy);
            if (len < 1e-6 || distance <= 0) return null;
            return {
                x: (dx / len) * distance,
                y: (dy / len) * distance,
            };
        }

        resolveWtArrowEndpoints(points, mode = 'pen') {
            if (!points?.length) return null;
            const b = points[points.length - 1];
            if (points.length < 2) return null;

            if (mode === 'line') {
                return { a: points[0], b };
            }

            if (points.length < TacticsCanvas.ARROW_LOOKBACK) {
                return null;
            }
            const i = Math.max(0, points.length - TacticsCanvas.ARROW_LOOKBACK);
            return { a: points[i], b };
        }

        resolvePenPathArrowEndpoints(path) {
            const ep = this.extractPathEndpoints(path);
            if (!ep) return null;
            const dist = Math.hypot(ep.end.x - ep.endPrev.x, ep.end.y - ep.endPrev.y);
            if (dist < 1e-6) return null;
            return { a: ep.endPrev, b: ep.end };
        }

        resolveArrowEndpoints({
            points = null,
            mode = 'pen',
            path = null,
            strokeWidth = this.getStrokeWidth(),
        } = {}) {
            if (path?.type === 'path' && path.path?.length) {
                const wt = this.resolvePenPathArrowEndpoints(path);
                return wt ? { ...wt, source: 'path' } : null;
            }
            if (!points?.length) return null;

            let wt = this.resolveWtArrowEndpoints(points, mode);
            if (!wt && mode !== 'line' && points.length >= 2) {
                const end = points[points.length - 1];
                const lookbackDist = this.getArrowLookbackDistance(strokeWidth);
                let endPrev = points[0];
                for (let i = points.length - 2; i >= 0; i -= 1) {
                    if (Math.hypot(end.x - points[i].x, end.y - points[i].y) >= lookbackDist) {
                        endPrev = points[i];
                        break;
                    }
                }
                wt = { a: endPrev, b: end };
            }

            return wt ? { ...wt, source: mode === 'line' ? 'line' : 'brush' } : null;
        }

        resolveRemoteArrowEndpoints(entry) {
            if (!entry?.points?.length) return null;
            const logicalH = TacticsCanvas.COORD_SPACE;
            const logicalPts = entry.points.map((p) => ({
                x: (p.x || 0) * logicalH,
                y: (p.y || 0) * logicalH,
            }));
            const strokeWidth = entry.width || this.getStrokeWidth();
            const mode = entry.tool === 'line' ? 'line' : 'pen';
            const wt = this.resolveArrowEndpoints({
                points: logicalPts,
                mode,
                strokeWidth,
            });
            if (!wt) return null;
            return {
                a: { x: wt.a.x / logicalH, y: wt.a.y / logicalH },
                b: { x: wt.b.x / logicalH, y: wt.b.y / logicalH },
            };
        }

        computeArrowTriangle(tipX, tipY, dirX, dirY, strokeWidth = this.getStrokeWidth()) {
            const len = Math.hypot(dirX, dirY);
            if (len < 1e-6) return null;

            const angle = Math.atan2(dirY, dirX);
            const headLen = this.getArrowHeadLength(strokeWidth);
            const spread = TacticsCanvas.ARROW_HEAD_SPREAD;

            return {
                tipX,
                tipY,
                leftX: tipX - headLen * Math.cos(angle - spread),
                leftY: tipY - headLen * Math.sin(angle - spread),
                rightX: tipX - headLen * Math.cos(angle + spread),
                rightY: tipY - headLen * Math.sin(angle + spread),
            };
        }

        buildArrowFromEndpoints(a, b, strokeWidth = this.getStrokeWidth()) {
            if (!a || !b) return null;
            const dirX = b.x - a.x;
            const dirY = b.y - a.y;
            const triangle = this.computeArrowTriangle(b.x, b.y, dirX, dirY, strokeWidth);
            if (!triangle) return null;
            return { a, b, triangle };
        }

        drawArrowChevronOnCtx(ctx, chevron, strokeStyle, strokeWidth) {
            if (!ctx || !chevron) return;
            ctx.save();
            ctx.strokeStyle = strokeStyle || this.getStrokeColor();
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(chevron.leftX, chevron.leftY);
            ctx.lineTo(chevron.tipX, chevron.tipY);
            ctx.lineTo(chevron.rightX, chevron.rightY);
            ctx.stroke();
            ctx.restore();
        }

        getLineArrowBodyInset(strokeWidth = this.getStrokeWidth()) {
            const inner = this.getArrowInnerJoinInset(strokeWidth);
            return Math.max(inner * 0.72, inner - strokeWidth * 0.18);
        }

        drawLineCapConnector(ctx, x1, y1, x2, y2, color, strokeWidth) {
            if (!ctx || Math.hypot(x2 - x1, y2 - y1) < 0.5) return;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'butt';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        }

        arrowChevronToPolylineAttr(chevron) {
            if (!chevron) return '';
            return `${chevron.leftX},${chevron.leftY} ${chevron.tipX},${chevron.tipY} ${chevron.rightX},${chevron.rightY}`;
        }

        drawWtEndCapLocal(ctx, ax, ay, bx, by, endType, strokeWidth, color) {
            const dx = bx - ax;
            const dy = by - ay;
            if (Math.hypot(dx, dy) < 1e-6) return;

            if (endType === 'arrow') {
                const arrow = this.buildArrowFromEndpoints({ x: ax, y: ay }, { x: bx, y: by }, strokeWidth);
                if (arrow) this.drawArrowChevronOnCtx(ctx, arrow.triangle, color, strokeWidth);
                return;
            }

            if (endType === 'bar') {
                const len = Math.hypot(dx, dy);
                const ux = dx / len;
                const uy = dy / len;
                const px = -uy;
                const py = ux;
                const size = this.getBarCapHalfLength(strokeWidth);
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = strokeWidth;
                ctx.lineCap = 'butt';
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(bx - size * px, by - size * py);
                ctx.lineTo(bx + size * px, by + size * py);
                ctx.stroke();
                ctx.restore();
            }
        }

        getPathEndCapLocalPoints(path) {
            if (!path?.path?.length) return null;
            if (!fabric.util?.getPathSegmentsInfo || !fabric.util?.getPointOnPath) return null;

            const segments = fabric.util.getPathSegmentsInfo(path.path);
            if (!segments.length) return null;

            const totalLen = segments[segments.length - 1].length;
            if (totalLen <= 0) return null;

            const strokeWidth = path.strokeWidth || this.getStrokeWidth();
            const lookback = Math.min(totalLen, this.getArrowLookbackDistance(strokeWidth));
            const endPt = fabric.util.getPointOnPath(path.path, totalLen, segments);
            const prevPt = fabric.util.getPointOnPath(
                path.path,
                Math.max(0, totalLen - lookback),
                segments,
            );
            const ox = path.pathOffset?.x || 0;
            const oy = path.pathOffset?.y || 0;
            const toRender = (p) => ({ x: p.x - ox, y: p.y - oy });
            return { a: toRender(prevPt), b: toRender(endPt) };
        }

        pathCapTipToRender(path, tipX, tipY) {
            const ox = path.pathOffset?.x || 0;
            const oy = path.pathOffset?.y || 0;
            return { x: tipX - ox, y: tipY - oy };
        }

        installWtEndCapRenderer(obj) {
            if (!obj || obj._wtEndCapRendererInstalled) return;

            const self = this;
            const originalRender = obj._render.bind(obj);
            obj._render = function renderWithWtEndCap(ctx) {
                originalRender(ctx);
                const endType = this.tacticsEndType;
                if (!endType || endType === 'none') return;

                const strokeWidth = this.strokeWidth || TacticsCanvas.DEFAULT_STROKE_WIDTH;
                const color = this.stroke || TacticsCanvas.DEFAULT_STROKE_COLOR;

                if (this.type === 'line') {
                    const ep = self.getLineEndCapRenderEndpoints(this, endType);
                    const bodyToTip = Math.hypot(ep.bx - ep.bodyX, ep.by - ep.bodyY);
                    const lineLen = Math.hypot(ep.bx - ep.ax, ep.by - ep.ay);
                    if (lineLen < 1.5) return;

                    if (bodyToTip > 0.5) {
                        self.drawLineCapConnector(
                            ctx,
                            ep.bodyX,
                            ep.bodyY,
                            ep.bx,
                            ep.by,
                            color,
                            strokeWidth,
                        );
                    }

                    self.drawWtEndCapLocal(ctx, ep.ax, ep.ay, ep.bx, ep.by, endType, strokeWidth, color);
                    return;
                }

                if (this.type === 'path' && this.tacticsType === 'pen') {
                    const pts = self.getPathEndCapLocalPoints(this);
                    if (!pts) return;
                    let ax = pts.a.x;
                    let ay = pts.a.y;
                    let bx = pts.b.x;
                    let by = pts.b.y;
                    if ((endType === 'bar' || endType === 'arrow')
                        && this.tacticsCapTipX != null && this.tacticsCapTipY != null) {
                        const tip = self.pathCapTipToRender(this, this.tacticsCapTipX, this.tacticsCapTipY);
                        bx = tip.x;
                        by = tip.y;
                    }
                    if (endType === 'arrow') {
                        const forward = self.getPenArrowTipForward(strokeWidth);
                        const offset = self.offsetPointAlong(bx - ax, by - ay, forward);
                        if (offset) {
                            bx += offset.x;
                            by += offset.y;
                        }
                    }
                    self.drawWtEndCapLocal(ctx, ax, ay, bx, by, endType, strokeWidth, color);
                }
            };

            obj._wtEndCapRendererInstalled = true;
            obj.objectCaching = false;
        }

        drawWtArrowOnCtx(ctx, points, strokeWidth, fillStyle, mode = 'pen') {
            const endpoints = this.resolveArrowEndpoints({ points, mode });
            if (!endpoints || !ctx) return;
            const arrow = this.buildArrowFromEndpoints(endpoints.a, endpoints.b, strokeWidth);
            if (!arrow) return;
            this.drawArrowChevronOnCtx(ctx, arrow.triangle, fillStyle, strokeWidth);
        }

        resolveEndGeometryFromPoints(points, endType, strokeWidth = this.getStrokeWidth()) {
            const wt = this.resolveWtArrowEndpoints(points, 'pen');
            if (!wt) return null;
            return this.getLineEndGeometry(wt.a.x, wt.a.y, wt.b.x, wt.b.y, endType, strokeWidth);
        }

        getArrowLookbackDistance(strokeWidth = this.getStrokeWidth()) {
            return Math.max(strokeWidth * 2.5, 12);
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

        getBarCapHalfLength(strokeWidth = this.getStrokeWidth()) {
            return this.getCapBaseSize(strokeWidth) * TacticsCanvas.WT_TEND_SCALE2;
        }

        getLineEndGeometry(x1, y1, tipX, tipY, endType, strokeWidth = this.getStrokeWidth(), opts = {}) {
            const dx = tipX - x1;
            const dy = tipY - y1;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            let bodyX2 = tipX;
            let bodyY2 = tipY;

            const capPad = strokeWidth / 2;
            if (endType === 'bar' && dist > capPad) {
                bodyX2 = tipX - capPad * Math.cos(angle);
                bodyY2 = tipY - capPad * Math.sin(angle);
            } else if (endType === 'arrow') {
                const inset = opts.pen
                    ? this.getPenArrowBodyInset(strokeWidth)
                    : this.getLineArrowBodyInset(strokeWidth);
                if (dist > inset) {
                    bodyX2 = tipX - inset * Math.cos(angle);
                    bodyY2 = tipY - inset * Math.sin(angle);
                }
            }

            return { bodyX2, bodyY2, tipX, tipY, angle, dist };
        }

        computeLineCapTipParam(x1, y1, x2, y2, tipX, tipY) {
            const vx = x2 - x1;
            const vy = y2 - y1;
            const lenSq = vx * vx + vy * vy;
            if (lenSq < 1e-12) return 1;
            return ((tipX - x1) * vx + (tipY - y1) * vy) / lenSq;
        }

        lineStorageToRenderCoords(line, sx, sy) {
            const p = this.getLineRenderPoints(line);
            if (!p) return { x: sx, y: sy };
            const t = this.computeLineCapTipParam(line.x1, line.y1, line.x2, line.y2, sx, sy);
            return {
                x: p.x1 + t * (p.x2 - p.x1),
                y: p.y1 + t * (p.y2 - p.y1),
            };
        }

        getLineCapTipRenderPoint(line) {
            const p = this.getLineRenderPoints(line);
            if (!p) return { x: line.x2, y: line.y2 };

            const strokeWidth = line.strokeWidth || this.getStrokeWidth();
            const inner = this.getArrowInnerJoinInset(strokeWidth);
            const dx = p.x2 - p.x1;
            const dy = p.y2 - p.y1;
            const bodyLen = Math.hypot(dx, dy);
            if (bodyLen < 1e-6) return { x: p.x2, y: p.y2 };

            let t = line.tacticsCapTipT;
            if (t == null && line.tacticsCapTipX != null && line.tacticsCapTipY != null) {
                t = this.computeLineCapTipParam(
                    line.x1,
                    line.y1,
                    line.x2,
                    line.y2,
                    line.tacticsCapTipX,
                    line.tacticsCapTipY,
                );
            }

            if (Number.isFinite(t) && t >= 1.02 && t <= 3.5) {
                return {
                    x: p.x1 + t * (p.x2 - p.x1),
                    y: p.y1 + t * (p.y2 - p.y1),
                };
            }

            const ux = dx / bodyLen;
            const uy = dy / bodyLen;
            return {
                x: p.x2 + ux * inner,
                y: p.y2 + uy * inner,
            };
        }

        setLineCapTip(line, tipX, tipY) {
            if (!line) return;
            const t = this.computeLineCapTipParam(line.x1, line.y1, line.x2, line.y2, tipX, tipY);
            line.set({
                tacticsCapTipX: tipX,
                tacticsCapTipY: tipY,
                tacticsCapTipT: t,
            });
        }

        ensureLineCapTipParam(line, endType, strokeWidth) {
            if (line.type !== 'line' || (endType !== 'arrow' && endType !== 'bar')) return;

            let tipX = line.tacticsCapTipX;
            let tipY = line.tacticsCapTipY;
            if (tipX == null || tipY == null) {
                const tip = this.reconstructTipFromBody(
                    { x: line.x1, y: line.y1 },
                    { x: line.x2, y: line.y2 },
                    endType,
                    strokeWidth,
                );
                tipX = tip.tipX;
                tipY = tip.tipY;
            }

            const t = this.computeLineCapTipParam(line.x1, line.y1, line.x2, line.y2, tipX, tipY);
            if (!Number.isFinite(t) || t < 0.9 || t > 4) {
                const tip = this.reconstructTipFromBody(
                    { x: line.x1, y: line.y1 },
                    { x: line.x2, y: line.y2 },
                    endType,
                    strokeWidth,
                );
                tipX = tip.tipX;
                tipY = tip.tipY;
            }

            this.setLineCapTip(line, tipX, tipY);
        }

        linePointToCanvas(line, lx, ly) {
            if (!line) return { x: lx, y: ly };
            line.setCoords?.();
            if (line.type === 'line' && line.calcLinePoints) {
                const render = this.lineStorageToRenderCoords(line, lx, ly);
                return fabric.util.transformPoint(
                    new fabric.Point(render.x, render.y),
                    line.calcTransformMatrix(),
                );
            }
            return fabric.util.transformPoint(
                new fabric.Point(lx, ly),
                line.calcTransformMatrix(),
            );
        }

        canvasPointToLine(line, cx, cy) {
            const inv = fabric.util.invertTransform(line.calcTransformMatrix());
            return fabric.util.transformPoint(new fabric.Point(cx, cy), inv);
        }

        getLineRenderPoints(line) {
            if (!line?.calcLinePoints) return null;
            return line.calcLinePoints();
        }

        getLineEndCapRenderEndpoints(line, endType) {
            const p = this.getLineRenderPoints(line);
            if (!p) {
                return {
                    ax: line.x1,
                    ay: line.y1,
                    bx: line.x2,
                    by: line.y2,
                    bodyX: line.x2,
                    bodyY: line.y2,
                };
            }

            const tip = (endType === 'bar' || endType === 'arrow')
                ? this.getLineCapTipRenderPoint(line)
                : { x: p.x2, y: p.y2 };

            return {
                ax: p.x1,
                ay: p.y1,
                bx: tip.x,
                by: tip.y,
                bodyX: p.x2,
                bodyY: p.y2,
            };
        }

        getArrowHeadTipCanvas(arrow) {
            const parent = arrow?.tacticsParent;
            if (parent) {
                if (parent.type === 'line') {
                    if (parent.tacticsCapTipX != null && parent.tacticsCapTipY != null) {
                        return this.linePointToCanvas(parent, parent.tacticsCapTipX, parent.tacticsCapTipY);
                    }
                    return this.linePointToCanvas(parent, parent.x2, parent.y2);
                }
                if (parent.type === 'path') {
                    const ep = this.extractPathEndpoints(parent);
                    if (ep?.end) return ep.end;
                }
            }
            return null;
        }

        getBarEndTipCanvas(bar) {
            if (!bar) return null;
            bar.setCoords?.();
            const p1 = this.linePointToCanvas(bar, bar.x1, bar.y1);
            const p2 = this.linePointToCanvas(bar, bar.x2, bar.y2);
            return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        }

        reconstructTipFromBody(start, bodyEnd, endType, strokeWidth) {
            const dx = bodyEnd.x - start.x;
            const dy = bodyEnd.y - start.y;
            const angle = Math.atan2(dy, dx);
            const capPad = strokeWidth / 2;
            if (endType === 'bar') {
                return {
                    tipX: bodyEnd.x + capPad * Math.cos(angle),
                    tipY: bodyEnd.y + capPad * Math.sin(angle),
                    angle,
                };
            }
            if (endType === 'arrow') {
                const inset = this.getArrowBodyInset(strokeWidth);
                return {
                    tipX: bodyEnd.x + inset * Math.cos(angle),
                    tipY: bodyEnd.y + inset * Math.sin(angle),
                    angle,
                };
            }
            return {
                tipX: bodyEnd.x,
                tipY: bodyEnd.y,
                angle,
            };
        }

        findAttachedEndCap(parent) {
            if (!this.fabric || !parent) return null;
            const parentId = parent.tacticsId;
            return this.fabric.getObjects().find((obj) => {
                if (!obj.tacticsArrowHead && !obj.tacticsBarEnd) return false;
                return obj.tacticsParent === parent || (parentId && obj.tacticsParentId === parentId);
            }) || null;
        }

        parsePathCommandPoints(pathCommands) {
            const points = [];
            if (!Array.isArray(pathCommands)) return points;

            let cx = 0;
            let cy = 0;
            pathCommands.forEach((cmd) => {
                if (!Array.isArray(cmd) || !cmd.length) return;
                const type = String(cmd[0]).toUpperCase();
                if (type === 'M' || type === 'L') {
                    cx = cmd[1];
                    cy = cmd[2];
                    points.push({ x: cx, y: cy });
                } else if (type === 'Q') {
                    cx = cmd[3];
                    cy = cmd[4];
                    points.push({ x: cx, y: cy });
                } else if (type === 'C') {
                    cx = cmd[5];
                    cy = cmd[6];
                    points.push({ x: cx, y: cy });
                }
            });
            return points;
        }

        pathPointToCanvas(path, point) {
            const offset = path.pathOffset || { x: 0, y: 0 };
            const local = new fabric.Point(point.x - offset.x, point.y - offset.y);
            return fabric.util.transformPoint(local, path.calcTransformMatrix());
        }

        canvasPointToPath(path, canvasX, canvasY) {
            const inv = fabric.util.invertTransform(path.calcTransformMatrix());
            const local = fabric.util.transformPoint(new fabric.Point(canvasX, canvasY), inv);
            const offset = path.pathOffset || { x: 0, y: 0 };
            return { x: local.x + offset.x, y: local.y + offset.y };
        }

        extractPathEndpoints(path) {
            if (!path?.path?.length) return null;
            path.setCoords();
            const strokeWidth = path.strokeWidth || this.getStrokeWidth();

            if (fabric.util?.getPathSegmentsInfo && fabric.util?.getPointOnPath) {
                const segments = fabric.util.getPathSegmentsInfo(path.path);
                if (!segments.length) return null;

                const totalLen = segments[segments.length - 1].length;
                if (totalLen <= 0) return null;

                const lookbackDist = this.getArrowLookbackDistance(strokeWidth);
                const lookback = Math.min(totalLen, lookbackDist);
                const endPt = fabric.util.getPointOnPath(path.path, totalLen, segments);
                const prevPt = fabric.util.getPointOnPath(
                    path.path,
                    Math.max(0, totalLen - lookback),
                    segments,
                );
                const startPt = fabric.util.getPointOnPath(path.path, 0, segments);

                const end = this.pathPointToCanvas(path, endPt);
                const endPrev = this.pathPointToCanvas(path, prevPt);
                const start = this.pathPointToCanvas(path, startPt);
                const angle = Math.atan2(end.y - endPrev.y, end.x - endPrev.x);

                return { start, end, endPrev, angle };
            }

            const points = this.parsePathCommandPoints(path.path);
            if (points.length < 1) return null;

            const end = this.pathPointToCanvas(path, points[points.length - 1]);
            const start = this.pathPointToCanvas(path, points[0]);
            const lookbackDist = this.getArrowLookbackDistance(strokeWidth);

            let endPrevPoint = points[0];
            for (let i = points.length - 2; i >= 0; i -= 1) {
                const candidate = this.pathPointToCanvas(path, points[i]);
                if (Math.hypot(end.x - candidate.x, end.y - candidate.y) >= lookbackDist) {
                    endPrevPoint = points[i];
                    break;
                }
            }

            const endPrev = this.pathPointToCanvas(path, endPrevPoint);
            return {
                start,
                end,
                endPrev,
                angle: Math.atan2(end.y - endPrev.y, end.x - endPrev.x),
            };
        }

        trimPathEnd(path, canvasX, canvasY, opts = {}) {
            if (!path?.path?.length) return;

            const local = this.canvasPointToPath(path, canvasX, canvasY);
            const pathCommands = path.path.slice();
            const lastCmd = pathCommands[pathCommands.length - 1];
            if (!Array.isArray(lastCmd) || !lastCmd.length) return;

            const straighten = !!opts.straighten;
            const type = String(lastCmd[0]).toUpperCase();
            if (type === 'Q') {
                pathCommands[pathCommands.length - 1] = straighten
                    ? ['L', local.x, local.y]
                    : ['Q', lastCmd[1], lastCmd[2], local.x, local.y];
            } else if (type === 'C') {
                pathCommands[pathCommands.length - 1] = straighten
                    ? ['L', local.x, local.y]
                    : [
                        'C', lastCmd[1], lastCmd[2], lastCmd[3], lastCmd[4], local.x, local.y,
                    ];
            } else if (type === 'L') {
                pathCommands[pathCommands.length - 1] = ['L', local.x, local.y];
            } else if (type === 'M' && pathCommands.length > 1) {
                const prevCmd = pathCommands[pathCommands.length - 2];
                const prevType = String(prevCmd?.[0] || '').toUpperCase();
                if (prevType === 'Q') {
                    pathCommands[pathCommands.length - 1] = straighten
                        ? ['L', local.x, local.y]
                        : ['Q', prevCmd[1], prevCmd[2], local.x, local.y];
                } else if (prevType === 'L') {
                    pathCommands[pathCommands.length - 1] = ['L', local.x, local.y];
                }
            } else {
                return;
            }

            path.set({ path: pathCommands });
            if (typeof path._setPath === 'function') {
                path._setPath(pathCommands);
            }
            if (typeof path._calcDimensions === 'function') {
                path._calcDimensions();
            }
            if (typeof path.setDimensions === 'function') {
                path.setDimensions();
            }
            path.setCoords();
        }

        collectPenBrushLivePoints(brush) {
            const raw = brush?._points?.map((p) => ({ x: p.x, y: p.y })) || [];
            if (raw.length < 2) return null;

            let points = raw.slice();
            const live = this.penLivePointer;
            if (live && Number.isFinite(live.x) && Number.isFinite(live.y)) {
                const last = points[points.length - 1];
                if (Math.hypot(live.x - last.x, live.y - last.y) > 0.35) {
                    points.push({ x: live.x, y: live.y });
                }
            }
            return points;
        }

        buildPenBrushLiveCapContext(brush, endType) {
            if (endType !== 'arrow' && endType !== 'bar') return null;
            const points = this.collectPenBrushLivePoints(brush);
            if (!points || points.length < 2) return null;

            const strokeWidth = brush?.width || this.getStrokeWidth();
            const wt = this.resolveArrowEndpoints({
                points,
                mode: 'pen',
                strokeWidth,
            });
            if (!wt) return null;

            const geom = this.getLineEndGeometry(
                wt.a.x,
                wt.a.y,
                wt.b.x,
                wt.b.y,
                endType,
                strokeWidth,
                { pen: endType === 'arrow' },
            );
            if (!geom || geom.dist < 3) return null;

            const bodyPoints = points.slice();
            bodyPoints[bodyPoints.length - 1] = { x: geom.bodyX2, y: geom.bodyY2 };
            return {
                bodyPoints,
                wt,
                geom,
                strokeWidth,
                color: brush?.color || this.getStrokeColor(),
            };
        }

        applyPenBrushStrokeStyles(ctx, brush) {
            if (!ctx || !brush) return;
            if (typeof brush._setBrushStyles === 'function') {
                brush._setBrushStyles(ctx);
            }
            if (typeof brush._setShadow === 'function') {
                brush._setShadow();
            }
            const lineType = this.getToolSettings().lineType || 'solid';
            const endType = this.getEndType();
            if (lineType === 'dotted') {
                ctx.lineCap = 'round';
            } else if (this.shouldForceButtCapForEnd(endType) || endType === 'arrow') {
                ctx.lineCap = 'butt';
            } else {
                ctx.lineCap = this.getStrokeLineCap();
            }
            const dash = this.getStrokeDashArray();
            if (dash?.length) {
                ctx.setLineDash(dash);
            } else {
                ctx.setLineDash([]);
            }
        }

        midPoint2d(a, b) {
            return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }

        drawPencilBrushPointsOnCtx(ctx, points, brush) {
            if (!ctx || !points || points.length < 2) return;

            this.applyPenBrushStrokeStyles(ctx, brush);
            ctx.beginPath();

            let r = points[0];
            let n = points[1];
            if (points.length === 2 && r.x === n.x && r.y === n.y) {
                const s = (brush?.width || this.getStrokeWidth()) / 1000;
                r = { x: r.x, y: r.y };
                n = { x: n.x, y: n.y };
                r.x -= s;
                n.x += s;
            }

            ctx.moveTo(r.x, r.y);
            for (let e = 1; e < points.length; e += 1) {
                const control = points[e];
                const next = points[e + 1];
                if (!next) {
                    ctx.lineTo(control.x, control.y);
                    break;
                }
                const mid = this.midPoint2d(control, next);
                ctx.quadraticCurveTo(control.x, control.y, mid.x, mid.y);
                r = control;
                n = next;
            }
            ctx.stroke();
        }

        renderPenBrushBodyPreview(ctx, brush) {
            if (!ctx || !brush) return false;
            if (this.tool !== 'pen' || !this.drawEnabled || !this.fabric?.isDrawingMode) return false;

            const points = this.collectPenBrushLivePoints(brush);
            if (!points || points.length < 2) return false;

            if (typeof brush._saveAndTransform === 'function') {
                brush._saveAndTransform(ctx);
            }
            this.drawPencilBrushPointsOnCtx(ctx, points, brush);
            ctx.restore();
            return true;
        }

        renderPenBrushLivePreview(ctx, brush, endType) {
            if (!ctx || !brush || (endType !== 'arrow' && endType !== 'bar')) return false;
            if (this.tool !== 'pen' || !this.drawEnabled || !this.fabric?.isDrawingMode) return false;

            const capCtx = this.buildPenBrushLiveCapContext(brush, endType);
            if (!capCtx) return false;

            if (typeof brush._saveAndTransform === 'function') {
                brush._saveAndTransform(ctx);
            }

            this.drawPencilBrushPointsOnCtx(ctx, capCtx.bodyPoints, brush);

            let tipX = capCtx.wt.b.x;
            let tipY = capCtx.wt.b.y;
            if (endType === 'arrow') {
                const forward = this.getPenArrowTipForward(capCtx.strokeWidth);
                const offset = this.offsetPointAlong(
                    tipX - capCtx.wt.a.x,
                    tipY - capCtx.wt.a.y,
                    forward,
                );
                if (offset) {
                    tipX += offset.x;
                    tipY += offset.y;
                }
            }

            this.drawWtEndCapLocal(
                ctx,
                capCtx.wt.a.x,
                capCtx.wt.a.y,
                tipX,
                tipY,
                endType,
                capCtx.strokeWidth,
                capCtx.color,
            );
            ctx.restore();
            return true;
        }

        retunePenEndCap(path, endType, endpoints = null) {
            if (!path || (endType !== 'arrow' && endType !== 'bar')) return false;

            const strokeWidth = path.strokeWidth || this.getStrokeWidth();
            let tipX;
            let tipY;
            let prevX;
            let prevY;

            if (endpoints?.a && endpoints?.b) {
                prevX = endpoints.a.x;
                prevY = endpoints.a.y;
                tipX = endpoints.b.x;
                tipY = endpoints.b.y;
            } else {
                const ep = this.extractPathEndpoints(path);
                if (!ep) return false;
                prevX = ep.endPrev.x;
                prevY = ep.endPrev.y;
                if (path.tacticsCapTipX != null && path.tacticsCapTipY != null) {
                    const tipCanvas = this.pathPointToCanvas(path, {
                        x: path.tacticsCapTipX,
                        y: path.tacticsCapTipY,
                    });
                    tipX = tipCanvas.x;
                    tipY = tipCanvas.y;
                } else {
                    tipX = ep.end.x;
                    tipY = ep.end.y;
                }
            }

            const geom = this.getLineEndGeometry(
                prevX,
                prevY,
                tipX,
                tipY,
                endType,
                strokeWidth,
                { pen: endType === 'arrow' },
            );
            if (!geom || geom.dist < 3) return false;

            this.trimPathEnd(path, geom.bodyX2, geom.bodyY2, { straighten: true });
            const tipLocal = this.canvasPointToPath(path, geom.tipX, geom.tipY);
            path.set({
                tacticsCapTipX: tipLocal.x,
                tacticsCapTipY: tipLocal.y,
            });
            return true;
        }

        setupPenEndCap(path, endType) {
            if (!path) return;

            const strokeWidth = path.strokeWidth || this.getStrokeWidth();
            path.set({ strokeWidth });

            const wt = this.resolvePenPathArrowEndpoints(path);
            if (!wt) return;

            if (endType === 'bar' || endType === 'arrow') {
                if (!this.retunePenEndCap(path, endType, wt)) return;
            }

            this.applyStrokeStyle(path);
            this.installWtEndCapRenderer(path);
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
            return !!(obj?.isDrawingPreview || obj?.isRemoteStrokePreview || obj?.isCellFlash || TacticsCanvas.isMapDecoration(obj) || obj?.isBackground);
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
            this.markOwnObject(shape);
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
            this.markOwnObject(poly);
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

        ensureTacticsId(obj) {
            if (!obj.tacticsId) {
                obj.tacticsId = 't' + Math.random().toString(16).slice(2, 10);
            }
            return obj.tacticsId;
        }

        findObjectByTacticsId(tacticsId) {
            if (!this.fabric || !tacticsId) return null;
            const id = String(tacticsId).trim();
            if (!id) return null;
            return this.fabric.getObjects().find((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o)
                && String(o.tacticsId || '').trim() === id) || null;
        }

        findObjectByPosition(payload) {
            if (!this.fabric || !payload) return null;
            const left = Math.round(payload.left);
            const top = Math.round(payload.top);
            return this.fabric.getObjects().find((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o)
                && o.type === payload.type
                && Math.round(o.left) === left
                && Math.round(o.top) === top) || null;
        }

        async applyRemoteObjectAdd(msg, remoteClientId, payload) {
            const liveStrokeId = payload.tacticsLiveStrokeId;
            delete payload.tacticsLiveStrokeId;
            this.syncFabricLayoutSize();
            const target = TacticsCanvas.COORD_SPACE;
            const fromSize = Number(msg.coordSpace) || 0;
            let addedCount = 0;
            await new Promise((resolve) => {
                fabric.util.enlivenObjects([payload], (objs) => {
                    (Array.isArray(objs) ? objs : []).forEach((obj) => {
                        if (!obj) return;
                        if (fromSize && Math.abs(fromSize - target) > 0.5) {
                            this.scaleObjectGeometry(obj, target / fromSize);
                        }
                        if (remoteClientId) {
                            this.markRemoteObject(obj, remoteClientId);
                        }
                        this.fabric.add(obj);
                        addedCount += 1;
                    });
                    if (addedCount > 0) {
                        this.relinkArrowHeads();
                        this.syncInteractionState();
                        this.fabric.requestRenderAll();
                    }
                    resolve();
                });
            });
            if (remoteClientId && addedCount > 0) {
                if (liveStrokeId) {
                    this.removeRemoteStroke(remoteClientId, liveStrokeId);
                } else {
                    this.removeRemoteStrokesFromClient(remoteClientId);
                }
            }
            if (addedCount > 0) {
                this.rebuildForeignObjectRegistry();
            }
            return addedCount;
        }

        async applyRemoteObjectModify(msg, remoteClientId, payload) {
            const tacticsId = String(payload.tacticsId || '').trim();
            let existing = tacticsId ? this.findObjectByTacticsId(tacticsId) : null;
            if (!existing) {
                existing = this.findObjectByPosition(payload);
            }
            if (!existing) {
                return this.applyRemoteObjectAdd(msg, remoteClientId, { ...payload });
            }

            this.syncFabricLayoutSize();
            const target = TacticsCanvas.COORD_SPACE;
            const fromSize = Number(msg.coordSpace) || 0;
            await new Promise((resolve) => {
                fabric.util.enlivenObjects([payload], (objs) => {
                    const obj = Array.isArray(objs) ? objs[0] : null;
                    if (obj) {
                        if (fromSize && Math.abs(fromSize - target) > 0.5) {
                            this.scaleObjectGeometry(obj, target / fromSize);
                        }
                        const props = obj.toObject(TacticsCanvas.EXPORT_PROPS);
                        existing.set(props);
                        existing.setCoords();
                        if (remoteClientId) {
                            this.markRemoteObject(existing, remoteClientId);
                        }
                        this.relinkArrowHeads();
                        this.syncInteractionState();
                        this.fabric.requestRenderAll();
                        this.rebuildForeignObjectRegistry();
                    }
                    resolve();
                });
            });
            return 1;
        }

        isForeignObject(obj) {
            const authorId = String(obj?.tacticsAuthorId || '').trim();
            const selfId = String(this.clientId || '').trim();
            if (authorId && selfId && authorId !== selfId) {
                return true;
            }
            const tacticsId = String(obj?.tacticsId || '').trim();
            if (!tacticsId || !selfId) return false;
            const foreignAuthor = String(this.foreignObjectAuthors.get(tacticsId) || '').trim();
            return !!(foreignAuthor && foreignAuthor !== selfId);
        }

        registerForeignObject(obj, clientId) {
            if (!obj || !clientId) return;
            const selfId = String(this.clientId || '').trim();
            const authorId = String(clientId || '').trim();
            if (!authorId || authorId === selfId) return;
            this.ensureTacticsId(obj);
            this.foreignObjectAuthors.set(obj.tacticsId, authorId);
            if (!String(obj.tacticsAuthorId || '').trim()) {
                obj.set('tacticsAuthorId', authorId);
            }
        }

        unregisterForeignObject(obj) {
            const tacticsId = String(obj?.tacticsId || '').trim();
            if (tacticsId) {
                this.foreignObjectAuthors.delete(tacticsId);
            }
        }

        rebuildForeignObjectRegistry() {
            this.foreignObjectAuthors = new Map();
            if (!this.fabric) return;
            const selfId = String(this.clientId || '').trim();
            this.fabric.getObjects().forEach((obj) => {
                if (this.isPreviewObject(obj) || obj.isBackground || TacticsCanvas.isMapDecoration(obj)) return;
                const authorId = String(obj.tacticsAuthorId || '').trim();
                if (!authorId || authorId === selfId || !obj.tacticsId) return;
                this.foreignObjectAuthors.set(obj.tacticsId, authorId);
            });
        }

        getObjectAuthorId(obj) {
            const authorId = String(obj?.tacticsAuthorId || '').trim();
            if (authorId) return authorId;
            const tacticsId = String(obj?.tacticsId || '').trim();
            return tacticsId ? String(this.foreignObjectAuthors.get(tacticsId) || '').trim() : '';
        }

        markOwnObject(obj) {
            if (!obj || this.isForeignObject(obj)) return;
            const selfId = String(this.clientId || '').trim();
            if (!selfId) return;
            obj.set('tacticsAuthorId', selfId);
            this.unregisterForeignObject(obj);
        }

        markRemoteObject(obj, clientId) {
            const authorId = String(clientId || '').trim();
            if (!obj || !authorId) return;
            obj.set('tacticsAuthorId', authorId);
            this.registerForeignObject(obj, authorId);
        }

        static EXPORT_PROPS = [
            'tacticsType',
            'tacticsAuthorId',
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
            'tacticsLineType',
            'tacticsCapTipX',
            'tacticsCapTipY',
            'tacticsCapTipT',
        ];

        removeLegacyEndCapObjects() {
            if (!this.fabric) return;
            this.fabric.getObjects().forEach((obj) => {
                if (!obj.tacticsArrowHead && !obj.tacticsBarEnd) return;
                this.isRemote = true;
                this.fabric.remove(obj);
                this.isRemote = false;
            });
        }

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

        removeDrawingTarget(target, options = {}) {
            if (!this.fabric || !target || this.isPreviewObject(target)) return;

            this.unregisterForeignObject(target);
            this.isRemote = true;
            if (target.tacticsArrowHead || target.tacticsBarEnd) {
                this.fabric.remove(target);
            } else if (target.tacticsType === 'line' || target.tacticsType === 'pen') {
                this.removeAttachedArrowHeads(target);
                this.fabric.remove(target);
            } else {
                this.fabric.remove(target);
            }
            this.isRemote = false;

            this.fabric.discardActiveObject();
            this.fabric.requestRenderAll();
            if (!options.deferSync) {
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
        }

        isErasableTarget(target) {
            return !!(target && !this.isPreviewObject(target));
        }

        getEraserTargetKey(target) {
            if (!target) return '';
            if (target.tacticsId) return String(target.tacticsId);
            if (target.tacticsParentId) return `parent:${target.tacticsParentId}`;
            return `${target.type}:${target.left}:${target.top}`;
        }

        tryEraseAtEvent(event, options = {}) {
            if (!this.fabric || !event) return false;
            const target = this.fabric.findTarget(event, false);
            if (!this.isErasableTarget(target)) return false;
            const key = this.getEraserTargetKey(target);
            if (this.eraserErasedKeys.has(key)) return false;
            this.eraserErasedKeys.add(key);
            this.removeDrawingTarget(target, options);
            return true;
        }

        startEraserStroke(opt) {
            this.eraserStrokeActive = true;
            this.eraserDragStarted = false;
            this.eraserDeferSync = false;
            this.eraserErasedKeys = new Set();
            this.eraserStartPointer = this.fabric.getPointer(opt.e);
            this.eraserStartEvent = opt.e;
        }

        updateEraserStroke(opt) {
            if (!this.eraserStrokeActive || !this.drawEnabled || !opt?.e) return;

            const pointer = this.fabric.getPointer(opt.e);
            if (!this.eraserDragStarted && this.eraserStartPointer) {
                const dx = pointer.x - this.eraserStartPointer.x;
                const dy = pointer.y - this.eraserStartPointer.y;
                if (Math.hypot(dx, dy) >= TacticsCanvas.ERASER_DRAG_THRESHOLD) {
                    this.eraserDragStarted = true;
                    this.eraserDeferSync = true;
                }
            }

            if (this.eraserDragStarted) {
                this.tryEraseAtEvent(opt.e, { deferSync: true });
            }
        }

        finishEraserStroke() {
            if (!this.eraserStrokeActive) return;

            if (!this.eraserDragStarted && this.eraserStartEvent) {
                this.tryEraseAtEvent(this.eraserStartEvent);
            } else if (this.eraserDeferSync && this.eraserErasedKeys.size > 0) {
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

            this.eraserStrokeActive = false;
            this.eraserDragStarted = false;
            this.eraserDeferSync = false;
            this.eraserStartPointer = null;
            this.eraserStartEvent = null;
            this.eraserErasedKeys.clear();
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
            const markerSizeScale = Number(markerDef.sizeScale);
            const sizeScale = Number.isFinite(markerSizeScale) && markerSizeScale > 0
                ? markerSizeScale
                : 1;
            return (size / Math.max(1, height)) * sizeScale;
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

        createMarkerClipPath(diamondPath, markerLayout) {
            return new fabric.Path(diamondPath, {
                originX: markerLayout.originX,
                originY: markerLayout.originY,
                left: 0,
                top: 0,
                scaleX: markerLayout.scaleX,
                scaleY: markerLayout.scaleY,
            });
        }

        createMarkerFabricParts(markerDef, color, markerLayout) {
            const outline = window.AbsTacticsIcons?.MARKER_OUTLINE || '#000000';
            const stripeColor = window.AbsTacticsIcons?.MARKER_STRIPE || '#000000';
            const innerParts = [];
            const diamondPath = markerDef.path;
            const pathLayout = {
                originX: markerLayout.originX,
                originY: markerLayout.originY,
                left: 0,
                top: 0,
                scaleX: 1,
                scaleY: 1,
            };
            const outlineOpts = {
                ...pathLayout,
                fill: 'transparent',
                stroke: outline,
                strokeWidth: 1,
                strokeUniform: true,
                strokeLineJoin: 'miter',
            };
            let bodyPart = null;

            if (markerDef.mask) {
                innerParts.push(new fabric.Path(diamondPath, {
                    ...pathLayout,
                    fill: stripeColor,
                    stroke: null,
                    strokeWidth: 0,
                }));
                bodyPart = new fabric.Path(markerDef.mask, {
                    ...pathLayout,
                    fill: color,
                    stroke: null,
                    strokeWidth: 0,
                    fillRule: 'evenodd',
                    clipPath: this.createMarkerClipPath(diamondPath, {
                        ...markerLayout,
                        scaleX: 1,
                        scaleY: 1,
                    }),
                });
                innerParts.push(bodyPart);
            } else {
                bodyPart = new fabric.Path(diamondPath, {
                    ...pathLayout,
                    fill: color,
                    stroke: null,
                    strokeWidth: 0,
                });
                innerParts.push(bodyPart);
            }

            innerParts.push(new fabric.Path(diamondPath, outlineOpts));

            const markerGroup = new fabric.Group(innerParts, {
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0,
                scaleX: markerLayout.scaleX,
                scaleY: markerLayout.scaleY,
            });
            return { parts: [markerGroup], bodyPart: markerGroup };
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
                const markerLayout = {
                    originX: 'center',
                    originY: 'center',
                    scaleX: markerScale,
                    scaleY: markerScale,
                };
                const markerParts = this.createMarkerFabricParts(markerDef, color, markerLayout);
                bodyPart = markerParts.bodyPart;
                parts.push(...markerParts.parts);
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
            this.markOwnObject(group);

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
                this.startEraserStroke(opt);
                return;
            }

            if (this.tool === 'ping') {
                this.startPingHold(pointer);
                return;
            }

            if (this.tool === 'cell') {
                this.startCellDrag(pointer);
                return;
            }

            if (this.tool === 'pen' && this.drawEnabled && this.fabric.isDrawingMode) {
                if (this.penStrokeSuppressed) {
                    this.penStrokeSuppressed = false;
                    this.cancelPenStroke();
                    return;
                }
                this.penLivePointer = pointer;
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
                if (settings.textType === 'callout') {
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

            if (this.tool === 'eraser' && this.eraserStrokeActive) {
                this.updateEraserStroke(opt);
                return;
            }

            if (this.tool === 'cell' && this.cellDragActive) {
                this.updateCellDrag(this.fabric.getPointer(opt.e));
                return;
            }

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
        }

        handleMouseUp(opt) {
            if (!this.fabric || this.isRemote) return;
            if (this.tool === 'eraser') {
                this.finishEraserStroke();
                return;
            }
            if (this.tool === 'ping') {
                this.stopPingHold();
                return;
            }

            if (this.tool === 'cell') {
                this.stopCellDrag();
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

            if (this.tool === 'pen' && this.drawEnabled) {
                this.onPenBrushMouseUp();
                return;
            }

            if (!this.drawEnabled) return;

            const pointer = this.fabric.getPointer(opt.e);

            if (this.shapeStart && (this.tool === 'rect' || this.tool === 'circle')) {
                this.finishShapeDraw(pointer.x, pointer.y);
                return;
            }
        }

        getOpCoordSpace() {
            return TacticsCanvas.COORD_SPACE;
        }

        handleLocalChange(type, e) {
            if (this.isRemote || !this.drawEnabled) return;
            const obj = e?.target;
            if (!obj || this.isPreviewObject(obj)) return;

            obj.setCoords();
            this.markOwnObject(obj);
            this.pushHistory();
            this.onChange();

            if (!this.slideId) return;
            const coordSpace = this.getOpCoordSpace();

            if (obj.type === 'path' && (this.tool === 'pen' || obj.tacticsType === 'pen')) {
                const payload = obj.toObject(TacticsCanvas.EXPORT_PROPS);
                if (this.localStrokeId) {
                    payload.tacticsLiveStrokeId = this.localStrokeId;
                }
                this.onOp({
                    op: 'add',
                    slideId: this.slideId,
                    coordSpace,
                    payload,
                });
                return;
            }

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
                coordSpace,
                payload: obj.toObject(TacticsCanvas.EXPORT_PROPS),
            });
        }

        exportDrawingsJson() {
            return this.withExportCoordSpace((coordSpace) => {
                if (!this.fabric) return null;
                const objects = this.fabric.getObjects()
                    .filter((o) => !this.isPreviewObject(o) && !o.isBackground && !TacticsCanvas.isMapDecoration(o)
                        && !o.tacticsArrowHead && !o.tacticsBarEnd)
                    .map((o) => {
                        const data = o.toObject(TacticsCanvas.EXPORT_PROPS);
                        delete data.tacticsParent;
                        return data;
                    });
                return {
                    version: this.fabric.version || '5.3.0',
                    coordSpace,
                    objects,
                };
            });
        }

        pushHistory() {
            if (!this.fabric) return;
            const json = this.exportOwnJson();
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
            await this.applyOwnHistory(this.history[this.historyIndex]);
            this.onChange();
            this.broadcastOwnDrawings();
        }

        async redo() {
            if (!this.drawEnabled || this.historyIndex >= this.history.length - 1 || !this.fabric) return;
            this.historyIndex += 1;
            await this.applyOwnHistory(this.history[this.historyIndex]);
            this.onChange();
            this.broadcastOwnDrawings();
        }

        broadcastOwnDrawings() {
            if (!this.slideId) return;
            this.onOp({
                op: 'sync_own',
                slideId: this.slideId,
                payload: this.exportOwnJson(),
            });
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
            if (!this.drawEnabled || !this.fabric) return;
            this.fabric.getObjects().forEach((obj) => {
                if (!obj.isBackground && !TacticsCanvas.isMapDecoration(obj)) {
                    this.fabric.remove(obj);
                }
            });
            this.consolidateLayerOrder();
            this.fabric.requestRenderAll();
            this.pushHistory();
            this.onChange();
            this.onOp({ op: 'clear', slideId: this.slideId, payload: null });
        }

        exportJson(options = {}) {
            const ownOnly = options.ownOnly === true;
            return this.withExportCoordSpace((coordSpace) => {
                if (!this.fabric) return null;
                const objects = this.fabric.getObjects()
                    .filter((o) => !o.isGridLine && !o.isDrawingPreview
                        && (!ownOnly || !this.isForeignObject(o)))
                    .map((o) => {
                        const data = o.toObject([...TacticsCanvas.EXPORT_PROPS, 'isBackground', 'isGridLine']);
                        delete data.tacticsParent;
                        return data;
                    });
                return {
                    version: this.fabric.version || '5.3.0',
                    coordSpace,
                    objects,
                };
            });
        }

        exportOwnJson() {
            return this.exportJson({ ownOnly: true });
        }

        removeObjectsByAuthor(authorId) {
            if (!this.fabric || !authorId) return;

            const targets = this.fabric.getObjects().filter((obj) => (
                !obj.isBackground
                && !obj.isGridLine
                && !this.isPreviewObject(obj)
                && this.getObjectAuthorId(obj) === authorId
            ));
            const targetSet = new Set(targets);
            targets.forEach((obj) => {
                if ((obj.tacticsArrowHead || obj.tacticsBarEnd)
                    && obj.tacticsParent
                    && targetSet.has(obj.tacticsParent)) {
                    return;
                }
                this.unregisterForeignObject(obj);
                if (obj.tacticsType === 'line' || obj.tacticsType === 'pen') {
                    this.removeAttachedArrowHeads(obj);
                }
                this.fabric.remove(obj);
            });
        }

        removeOwnDrawingObjects() {
            if (!this.fabric) return;

            const ownObjects = this.fabric.getObjects().filter((obj) => (
                !obj.isBackground
                && !obj.isGridLine
                && !this.isPreviewObject(obj)
                && !this.isForeignObject(obj)
            ));
            const ownSet = new Set(ownObjects);
            ownObjects.forEach((obj) => {
                if ((obj.tacticsArrowHead || obj.tacticsBarEnd)
                    && obj.tacticsParent
                    && ownSet.has(obj.tacticsParent)) {
                    return;
                }
                this.unregisterForeignObject(obj);
                if (obj.tacticsType === 'line' || obj.tacticsType === 'pen') {
                    this.removeAttachedArrowHeads(obj);
                }
                this.fabric.remove(obj);
            });
        }

        async applyRemoteOwnDrawings(remoteClientId, json) {
            if (!this.fabric || !remoteClientId) return;
            const authorId = String(remoteClientId || '').trim();
            const selfId = String(this.clientId || '').trim();
            if (!authorId || authorId === selfId) return;

            this.syncFabricLayoutSize();
            this.isRemote = true;
            try {
                this.removeObjectsByAuthor(authorId);

                const objects = (json && Array.isArray(json.objects) ? json.objects : [])
                    .filter((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o));
                if (!objects.length) {
                    this.consolidateLayerOrder();
                    this.relinkArrowHeads();
                    this.syncInteractionState();
                    this.fabric.renderAll();
                    return;
                }

                await new Promise((resolve) => {
                    fabric.util.enlivenObjects(objects, (objs) => {
                        (Array.isArray(objs) ? objs : []).forEach((obj) => {
                            if (!obj) return;
                            this.markRemoteObject(obj, authorId);
                            this.fabric.add(obj);
                        });
                        this.applyCoordSpaceScale(json);
                        this.relinkArrowHeads();
                        this.syncInteractionState();
                        resolve();
                    });
                });
                this.consolidateLayerOrder();
                this.fabric.renderAll();
            } finally {
                this.isRemote = false;
            }
        }

        async applyOwnHistory(json) {
            if (!this.fabric) return;

            this.syncFabricLayoutSize();
            this.isRemote = true;
            try {
                this.removeOwnDrawingObjects();

                const objects = (json && Array.isArray(json.objects) ? json.objects : [])
                    .filter((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o));
                if (!objects.length) {
                    this.consolidateLayerOrder();
                    this.relinkArrowHeads();
                    this.syncInteractionState();
                    this.fabric.renderAll();
                    return;
                }

                await new Promise((resolve) => {
                    fabric.util.enlivenObjects(objects, (objs) => {
                        (Array.isArray(objs) ? objs : []).forEach((obj) => {
                            if (!obj) return;
                            this.markOwnObject(obj);
                            this.fabric.add(obj);
                        });
                        this.applyCoordSpaceScale(json);
                        this.relinkArrowHeads();
                        this.syncInteractionState();
                        resolve();
                    });
                });
                this.consolidateLayerOrder();
                this.fabric.renderAll();
            } finally {
                this.isRemote = false;
            }
            this.rebuildForeignObjectRegistry();
        }

        relinkArrowHeads() {
            if (!this.fabric) return;

            const parentsById = new Map();
            this.fabric.getObjects().forEach((obj) => {
                const isLine = obj.type === 'line'
                    && (obj.tacticsType === 'line' || obj.tacticsType === 'arrow');
                const isPen = obj.type === 'path' && obj.tacticsType === 'pen';
                if (!isLine && !isPen) return;
                this.ensureTacticsId(obj);
                parentsById.set(obj.tacticsId, obj);
            });

            this.fabric.getObjects().forEach((obj) => {
                if (!obj.tacticsArrowHead && !obj.tacticsBarEnd) return;
                const parent = obj.tacticsParent
                    || (obj.tacticsParentId && parentsById.get(obj.tacticsParentId));
                if (!parent) return;
                if (!parent.tacticsEndType || parent.tacticsEndType === 'none') {
                    parent.set('tacticsEndType', obj.tacticsArrowHead ? 'arrow' : 'bar');
                }
            });

            this.removeLegacyEndCapObjects();
            this.rebuildEndCaps();
        }

        rebuildParentEndCap(parent) {
            const endType = parent.tacticsEndType;
            if (!endType || endType === 'none') return;

            this.ensureTacticsId(parent);
            const strokeWidth = parent.strokeWidth || TacticsCanvas.DEFAULT_STROKE_WIDTH;
            this.applyStrokeStyle(parent);
            this.removeAttachedArrowHeads(parent);

            const isLine = parent.type === 'line'
                && (parent.tacticsType === 'line' || parent.tacticsType === 'arrow');
            const isPen = parent.type === 'path' && parent.tacticsType === 'pen';

            if (isPen && (endType === 'bar' || endType === 'arrow')) {
                if (parent.tacticsCapTipX == null) {
                    this.setupPenEndCap(parent, endType);
                } else {
                    this.retunePenEndCap(parent, endType);
                    this.applyStrokeStyle(parent);
                    this.installWtEndCapRenderer(parent);
                }
                return;
            }

            if (isLine && endType === 'bar' && parent.tacticsCapTipX == null) {
                this.ensureLineCapTipParam(parent, endType, strokeWidth);
            }

            if (isLine && endType === 'arrow' && parent.tacticsCapTipX == null) {
                const tipX = parent.x2;
                const tipY = parent.y2;
                const geom = this.getLineEndGeometry(
                    parent.x1,
                    parent.y1,
                    tipX,
                    tipY,
                    'arrow',
                    strokeWidth,
                );
                parent.set({ x2: geom.bodyX2, y2: geom.bodyY2 });
                this.setLineCapTip(parent, tipX, tipY);
            }

            if (isLine && (endType === 'bar' || endType === 'arrow')) {
                this.ensureLineCapTipParam(parent, endType, strokeWidth);
            }

            if (isLine || isPen) {
                this.installWtEndCapRenderer(parent);
            }
        }

        rebuildEndCaps() {
            if (!this.fabric) return;

            const parents = [];
            this.fabric.getObjects().forEach((obj) => {
                if (obj.isDrawingPreview || TacticsCanvas.isMapDecoration(obj) || obj.isBackground) return;
                if (obj.tacticsArrowHead || obj.tacticsBarEnd) return;

                const isLine = obj.type === 'line'
                    && (obj.tacticsType === 'line' || obj.tacticsType === 'arrow');
                const isPen = obj.type === 'path' && obj.tacticsType === 'pen';
                if (!isLine && !isPen) return;

                let endType = obj.tacticsEndType;
                if (!endType || endType === 'none') {
                    const cap = this.findAttachedEndCap(obj);
                    if (cap?.tacticsArrowHead) endType = 'arrow';
                    else if (cap?.tacticsBarEnd) endType = 'bar';
                    else return;
                    obj.set('tacticsEndType', endType);
                }

                parents.push(obj);
            });

            if (!parents.length) return;

            const wasRemote = this.isRemote;
            this.isRemote = true;
            parents.forEach((parent) => this.rebuildParentEndCap(parent));
            this.isRemote = wasRemote;
        }

        syncFabricLayoutSize() {
            const size = this.getSquareSize();
            if (!this.fabric || !size) return null;
            this.ensureLogicalCoordSpace();
            this.applyDisplayZoom(size);
            this.syncFabricContainer(size);
            this.syncCanvasDisplaySize(size);
            return size;
        }

        async loadDrawings(json) {
            if (!this.fabric || !json) return;
            this.syncFabricLayoutSize();
            this.isRemote = true;
            this.fabric.getObjects().filter((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o)).forEach((o) => {
                this.fabric.remove(o);
            });
            const objects = (Array.isArray(json.objects) ? json.objects : [])
                .filter((o) => !o.isBackground && !TacticsCanvas.isMapDecoration(o));
            await new Promise((resolve) => {
                if (!objects.length) {
                    resolve();
                    return;
                }
                fabric.util.enlivenObjects(objects, (objs) => {
                    objs.forEach((obj) => this.fabric.add(obj));
                    this.applyCoordSpaceScale(json);
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
            this.syncSpawnOverlay();
            this.fabric.requestRenderAll();
        }

        async loadSlide(slide, mapUrl) {
            this.initFabric();
            if (!this.fabric || !slide) return;

            const generation = ++this.loadSlideGeneration;
            const isCurrentLoad = () => generation === this.loadSlideGeneration;

            this.isSlideLoading = true;
            this.slideId = null;
            this.resetMapCssZoom();
            this.setMapViewportLoading(true);
            this.setInteractionLocked(true);
            this.cancelPenStroke();
            try {
                this.stopPingHold();
                this.stopCellDrag();
                this.clearRemoteCursors();
                this.clearRemoteStrokes();
                this.clearPings();
                this.clearCellFlashes();
                this.clearRuler();
                this.foreignObjectAuthors = new Map();
                this.mapCode = slide.map_code || 'cliff';
                this.game = slide.game || 'wot';
                const scalePromise = this.refreshMapScaleInfo(slide);
                await this.ensureCanvasLayout(3);
                if (!isCurrentLoad()) return;

                this.isRemote = true;
                this.fabric.clear();
                this.layoutCanvasSize = this.fabric.getWidth() || null;
                this.bgImageEl = null;
                this.bgLayout = null;
                this.isRemote = false;
                this.slideId = slide.id;
                this.activeSlide = slide;

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
                if (!isCurrentLoad()) return;
                if (img && img !== this.bgImageEl) {
                    this.showBackgroundImage(img);
                }

                await jsonPromise;
                if (!isCurrentLoad()) return;
                void scalePromise;
                await this.ensureCanvasLayout(2);
                if (!isCurrentLoad()) return;

                this.history = [this.exportOwnJson()];
                this.historyIndex = 0;
                this.rebuildForeignObjectRegistry();
                this.scheduleResize();
                this.updateGridToggleBtn();
                this.syncSpawnOverlay(slide);
                if (this.drawEnabled && !this.interactionLocked) {
                    this.setTool(this.tool || 'select');
                } else {
                    this.syncInteractionState();
                }
                this.fabric.requestRenderAll();
            } finally {
                if (isCurrentLoad()) {
                    this.isSlideLoading = false;
                    this.setMapViewportLoading(false);
                    this.setInteractionLocked(false);
                }
            }
        }

        stripBackground(json) {
            if (!json || !Array.isArray(json.objects)) return json;
            return {
                ...json,
                objects: json.objects.filter((obj) => !obj.isBackground && !obj.isGridLine && !obj.isSpawnMarker),
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
                this.syncFabricLayoutSize();
                const cleaned = this.stripBackground(json);
                this.isRemote = !!silent;
                this.fabric.loadFromJSON(cleaned, () => {
                    this.fabric.getObjects().forEach((obj) => {
                        if (obj.isBackground) {
                            this.fabric.remove(obj);
                        }
                    });
                    this.applyCoordSpaceScale(cleaned);
                    this.fitBackground();
                    this.syncGridOverlay();
                    this.relinkArrowHeads();
                    this.syncInteractionState();
                    this.fabric.renderAll();
                    this.isRemote = false;
                    if (silent) {
                        this.rebuildForeignObjectRegistry();
                    }
                    resolve();
                });
            });
        }

        async applyRemoteOp(msg) {
            if (!this.fabric || !msg) return;
            const msgSlideId = msg.slideId != null ? String(msg.slideId) : '';
            const activeSlideId = this.slideId != null ? String(this.slideId) : '';
            if (msgSlideId && activeSlideId && msgSlideId !== activeSlideId) return;

            const remoteClientId = String(msg.from || msg.clientId || '');

            this.isRemote = true;
            try {
                if (msg.op === 'clear') {
                    this.fabric.getObjects().forEach((obj) => {
                        if (!obj.isBackground && !TacticsCanvas.isMapDecoration(obj)) this.fabric.remove(obj);
                    });
                    this.consolidateLayerOrder();
                    if (remoteClientId) {
                        this.removeRemoteStrokesFromClient(remoteClientId);
                    }
                } else if (msg.op === 'full' && msg.payload) {
                    await this.loadDrawings(msg.payload);
                    if (remoteClientId) {
                        this.removeRemoteStrokesFromClient(remoteClientId);
                    }
                    this.rebuildForeignObjectRegistry();
                } else if (msg.op === 'sync_own' && msg.payload && remoteClientId) {
                    await this.applyRemoteOwnDrawings(remoteClientId, msg.payload);
                    this.rebuildForeignObjectRegistry();
                } else if (msg.op === 'remove' && msg.payload) {
                    const payload = msg.payload;
                    const tacticsId = String(payload.tacticsId || '').trim();
                    let match = tacticsId ? this.findObjectByTacticsId(tacticsId) : null;
                    if (!match) {
                        match = this.findObjectByPosition(payload);
                    }
                    if (match) this.fabric.remove(match);
                } else if (msg.op === 'add' && msg.payload) {
                    await this.applyRemoteObjectAdd(msg, remoteClientId, { ...msg.payload });
                } else if (msg.op === 'modify' && msg.payload) {
                    await this.applyRemoteObjectModify(msg, remoteClientId, { ...msg.payload });
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
