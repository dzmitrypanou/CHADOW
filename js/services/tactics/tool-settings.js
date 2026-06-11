(() => {
    'use strict';

    const PREFS_KEY = 'abs_tactics_tool_settings';
    const DEFAULTS = {
        lineType: 'solid',
        endType: 'none',
        shapeFilled: false,
        shapeFillOpacity: 50,
        fontSize: 16,
        textType: 'text',
        textAlign: 'center',
        iconMarker: 'heavy',
        iconId: null,
        iconLabel: '',
        iconLabelSize: 14,
        iconSize: 16,
        pingSize: 70,
        pingStrokeWidth: 6,
        cellFlashDuration: 2000,
    };

    const LINE_TYPE_LABELS = {
        solid: 'toolLineSolid',
        dashed: 'toolLineDashed',
        dotted: 'toolLineDotted',
    };

    const END_TYPE_LABELS = {
        none: 'toolEndNone',
        arrow: 'toolEndArrow',
        bar: 'toolEndBar',
    };

    const TEXT_TYPE_LABELS = {
        text: 'toolTextPlain',
        label: 'toolTextLabel',
        callout: 'toolTextCallout',
    };

    const ALIGN_LABELS = {
        left: 'toolAlignLeft',
        center: 'toolAlignCenter',
        right: 'toolAlignRight',
    };

    const PANEL_BY_TOOL = {
        select: 'none',
        cell: 'cell',
        eraser: 'none',
        ping: 'ping',
        ruler: 'none',
        pen: 'draw',
        line: 'draw',
        circle: 'shape',
        rect: 'shape',
        polygon: 'shape',
        text: 'text',
        image: 'icons',
    };

    let state = { ...DEFAULTS };
    const listeners = new Set();

    function normalizeIconSelection() {
        if (state.iconMarker && state.iconId) {
            state.iconId = null;
        }
        if (!state.iconMarker && !state.iconId) {
            state.iconMarker = DEFAULTS.iconMarker;
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            state = { ...DEFAULTS, ...parsed };
            normalizeIconSelection();
        } catch (e) {
            state = { ...DEFAULTS };
        }
    }

    function save() {
        localStorage.setItem(PREFS_KEY, JSON.stringify(state));
    }

    function notify() {
        listeners.forEach((fn) => fn(state));
    }

    function set(partial) {
        state = { ...state, ...partial };
        normalizeIconSelection();
        save();
        syncUi();
        notify();
    }

    function getState() {
        return { ...state };
    }

    function onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function t(key) {
        return window.AbsTacticsI18n?.t(key) || key;
    }

    function updateValueLabel(id, valueKey, map) {
        const el = document.getElementById(id);
        if (!el) return;
        const key = map[state[valueKey]];
        if (key) {
            el.dataset.tacticsI18n = key;
            el.textContent = t(key);
        } else {
            el.textContent = String(state[valueKey]);
        }
    }

    function setActiveOption(group, value) {
        group?.querySelectorAll('[data-value]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.getAttribute('data-value') === value);
        });
    }

    function syncWidthSliders(source) {
        const main = document.getElementById('tacticsStrokeWidth');
        const shape = document.getElementById('tacticsStrokeWidthShape');
        if (!main) return;
        const val = source?.value || main.value;
        main.value = val;
        if (shape) shape.value = val;
        ['tacticsStrokeWidthValue', 'tacticsShapeWidthValue'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    function syncUi() {
        syncWidthSliders();

        const fontEl = document.getElementById('tacticsFontSize');
        const fontVal = document.getElementById('tacticsFontSizeValue');
        if (fontEl) fontEl.value = String(state.fontSize);
        if (fontVal) fontVal.textContent = String(state.fontSize);

        const filledEl = document.getElementById('tacticsShapeFilled');
        if (filledEl) filledEl.checked = !!state.shapeFilled;

        const opacityEl = document.getElementById('tacticsShapeFillOpacity');
        const opacityVal = document.getElementById('tacticsShapeFillOpacityValue');
        const opacityField = document.getElementById('tacticsShapeFillOpacityField');
        if (opacityEl) opacityEl.value = String(state.shapeFillOpacity ?? 50);
        if (opacityVal) opacityVal.textContent = `${state.shapeFillOpacity ?? 50}%`;
        if (opacityField) opacityField.hidden = !state.shapeFilled;

        const labelEl = document.getElementById('tacticsIconLabel');
        if (labelEl && labelEl !== document.activeElement) {
            labelEl.value = state.iconLabel || '';
        }

        const labelSizeEl = document.getElementById('tacticsIconLabelSize');
        const labelSizeVal = document.getElementById('tacticsIconLabelSizeValue');
        if (labelSizeEl) labelSizeEl.value = String(state.iconLabelSize ?? 14);
        if (labelSizeVal) labelSizeVal.textContent = String(state.iconLabelSize ?? 14);

        const pingSizeEl = document.getElementById('tacticsPingSize');
        const pingSizeVal = document.getElementById('tacticsPingSizeValue');
        if (pingSizeEl) pingSizeEl.value = String(state.pingSize ?? 70);
        if (pingSizeVal) pingSizeVal.textContent = String(state.pingSize ?? 70);

        const pingStrokeEl = document.getElementById('tacticsPingStrokeWidth');
        const pingStrokeVal = document.getElementById('tacticsPingStrokeWidthValue');
        if (pingStrokeEl) pingStrokeEl.value = String(state.pingStrokeWidth ?? 6);
        if (pingStrokeVal) pingStrokeVal.textContent = String(state.pingStrokeWidth ?? 6);

        const cellFlashEl = document.getElementById('tacticsCellFlashDuration');
        const cellFlashVal = document.getElementById('tacticsCellFlashDurationValue');
        const cellFlashMs = state.cellFlashDuration ?? DEFAULTS.cellFlashDuration;
        if (cellFlashEl) cellFlashEl.value = String(cellFlashMs);
        if (cellFlashVal) {
            cellFlashVal.textContent = `${(cellFlashMs / 1000).toFixed(1)} ${t('toolCellFlashSeconds')}`;
        }

        const iconSizeEl = document.getElementById('tacticsIconSize');
        const iconSizeVal = document.getElementById('tacticsIconSizeValue');
        if (iconSizeEl) iconSizeEl.value = String(state.iconSize ?? 16);
        if (iconSizeVal) iconSizeVal.textContent = String(state.iconSize ?? 16);

        setActiveOption(document.getElementById('tacticsLineTypeOptions'), state.lineType);
        setActiveOption(document.getElementById('tacticsShapeLineTypeOptions'), state.lineType);
        setActiveOption(document.getElementById('tacticsEndTypeOptions'), state.endType);
        setActiveOption(document.getElementById('tacticsTextTypeOptions'), state.textType);
        setActiveOption(document.getElementById('tacticsTextAlignOptions'), state.textAlign);
        setActiveOption(document.getElementById('tacticsIconMarkerOptions'), state.iconMarker);
        setActiveOption(document.getElementById('tacticsIconGrid'), state.iconId);

        updateValueLabel('tacticsLineTypeValue', 'lineType', LINE_TYPE_LABELS);
        updateValueLabel('tacticsShapeLineTypeValue', 'lineType', LINE_TYPE_LABELS);
        updateValueLabel('tacticsEndTypeValue', 'endType', END_TYPE_LABELS);
        updateValueLabel('tacticsTextTypeValue', 'textType', TEXT_TYPE_LABELS);
        updateValueLabel('tacticsTextAlignValue', 'textAlign', ALIGN_LABELS);
    }

    function showPanel(tool) {
        const panelName = PANEL_BY_TOOL[tool] || 'none';
        document.querySelectorAll('[data-tactics-tool-panel]').forEach((el) => {
            el.hidden = el.getAttribute('data-tactics-tool-panel') !== panelName;
        });

        const content = document.getElementById('tacticsToolContextContent');
        if (content) {
            content.hidden = panelName === 'none';
        }

        const endRow = document.getElementById('tacticsEndTypeRow');
        if (endRow) {
            endRow.hidden = tool === 'pen';
        }

        const titleEl = document.getElementById('tacticsToolContextTitle');
        const key = {
            select: 'toolSelect',
            cell: 'toolCell',
            pen: 'toolPen',
            line: 'toolLine',
            circle: 'toolCircle',
            rect: 'toolRect',
            polygon: 'toolPolygon',
            eraser: 'toolEraser',
            text: 'toolText',
            image: 'toolImage',
            ping: 'toolPing',
            ruler: 'toolRuler',
        }[tool] || 'toolSelect';

        if (titleEl) {
            titleEl.dataset.tacticsI18n = key;
            titleEl.textContent = t(key);
        }
    }

    function bindOptionGroup(id, key) {
        const group = document.getElementById(id);
        if (!group) return;
        group.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-value]');
            if (!btn || btn.disabled) return;
            set({ [key]: btn.getAttribute('data-value') });
        });
    }

    function renderMarkerOptions() {
        const wrap = document.getElementById('tacticsIconMarkerOptions');
        const icons = window.AbsTacticsIcons;
        if (!wrap || !icons) return;

        wrap.innerHTML = '';
        icons.markerKeys().forEach((key) => {
            const marker = icons.MARKERS[key];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tactics-option-btn';
            btn.setAttribute('data-value', key);
            btn.setAttribute('aria-label', key);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', marker.viewBox);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', marker.path);
            path.setAttribute('fill', 'currentColor');
            svg.appendChild(path);
            btn.appendChild(svg);
            wrap.appendChild(btn);
        });
    }

    function renderIconGrid() {
        const grid = document.getElementById('tacticsIconGrid');
        const icons = window.AbsTacticsIcons;
        if (!grid || !icons) return;

        grid.innerHTML = '';
        icons.ICONS.forEach((icon) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tactics-icon-grid__btn';
            btn.setAttribute('data-value', icon.id);
            btn.setAttribute('aria-label', icon.id);
            const i = document.createElement('i');
            i.className = `fas ${icon.fa}`;
            i.setAttribute('aria-hidden', 'true');
            btn.appendChild(i);
            grid.appendChild(btn);
        });

        grid.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-value]');
            if (!btn || btn.disabled) return;
            set({ iconId: btn.getAttribute('data-value'), iconMarker: null });
        });
    }

    function bind() {
        renderMarkerOptions();
        renderIconGrid();

        bindOptionGroup('tacticsLineTypeOptions', 'lineType');
        bindOptionGroup('tacticsShapeLineTypeOptions', 'lineType');
        bindOptionGroup('tacticsEndTypeOptions', 'endType');
        bindOptionGroup('tacticsTextTypeOptions', 'textType');
        bindOptionGroup('tacticsTextAlignOptions', 'textAlign');
        document.getElementById('tacticsIconMarkerOptions')?.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-value]');
            if (!btn) return;
            set({ iconMarker: btn.getAttribute('data-value'), iconId: null });
        });

        document.getElementById('tacticsShapeFilled')?.addEventListener('change', (ev) => {
            set({ shapeFilled: !!ev.target.checked });
        });

        document.getElementById('tacticsShapeFillOpacity')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const opacityVal = document.getElementById('tacticsShapeFillOpacityValue');
            if (opacityVal) opacityVal.textContent = `${val}%`;
            set({ shapeFillOpacity: val });
        });

        document.getElementById('tacticsFontSize')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const fontVal = document.getElementById('tacticsFontSizeValue');
            if (fontVal) fontVal.textContent = String(val);
            set({ fontSize: val });
        });

        document.getElementById('tacticsIconLabel')?.addEventListener('input', (ev) => {
            set({ iconLabel: ev.target.value });
        });

        document.getElementById('tacticsIconLabelSize')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const sizeVal = document.getElementById('tacticsIconLabelSizeValue');
            if (sizeVal) sizeVal.textContent = String(val);
            set({ iconLabelSize: val });
        });

        document.getElementById('tacticsPingSize')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const sizeVal = document.getElementById('tacticsPingSizeValue');
            if (sizeVal) sizeVal.textContent = String(val);
            set({ pingSize: val });
        });

        document.getElementById('tacticsPingStrokeWidth')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const strokeVal = document.getElementById('tacticsPingStrokeWidthValue');
            if (strokeVal) strokeVal.textContent = String(val);
            set({ pingStrokeWidth: val });
        });

        document.getElementById('tacticsCellFlashDuration')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const durationVal = document.getElementById('tacticsCellFlashDurationValue');
            if (durationVal) {
                durationVal.textContent = `${(val / 1000).toFixed(1)} ${t('toolCellFlashSeconds')}`;
            }
            set({ cellFlashDuration: val });
        });

        document.getElementById('tacticsIconSize')?.addEventListener('input', (ev) => {
            const val = parseInt(ev.target.value, 10);
            if (!Number.isFinite(val)) return;
            const sizeVal = document.getElementById('tacticsIconSizeValue');
            if (sizeVal) sizeVal.textContent = String(val);
            set({ iconSize: val });
        });

        const onWidthInput = (ev) => {
            syncWidthSliders(ev.target);
            notify();
        };
        document.getElementById('tacticsStrokeWidth')?.addEventListener('input', onWidthInput);
        document.getElementById('tacticsStrokeWidthShape')?.addEventListener('input', onWidthInput);

        syncUi();
    }

    function getStrokeDashArray(lineType, strokeWidth = 6) {
        const w = Math.max(2, strokeWidth || 6);
        if (lineType === 'dashed') return [w * 4, w * 3];
        if (lineType === 'dotted') return [w * 0.2, w * 3.2];
        return null;
    }

    function colorWithOpacity(color, opacityPercent) {
        const hex = String(color || '#ff4444').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
            return `rgba(255, 68, 68, ${(opacityPercent ?? 50) / 100})`;
        }
        const alpha = Math.max(0, Math.min(100, opacityPercent ?? 50)) / 100;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function getShapeFill(color, filled, opacityPercent = 50) {
        return filled ? colorWithOpacity(color, opacityPercent) : 'transparent';
    }

    load();

    document.addEventListener('DOMContentLoaded', bind);

    window.AbsTacticsToolSettings = {
        getState,
        set,
        onChange,
        showPanel,
        syncUi,
        getStrokeDashArray,
        getShapeFill,
        LINE_TYPE_LABELS,
        END_TYPE_LABELS,
    };
})();
