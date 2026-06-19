let dictionary = [];
let assets = [];
let uploadFormGame = null;
let gameLabels = { wot: 'World of Tanks', lesta: 'Мир танков' };
let modeLabels = {
    random: 'Случайный бой',
    encounter: 'Встречный бой',
    assault: 'Атака/оборона',
    custom: 'Остальное',
};
let gameModes = {};

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icon = type === 'error' ? 'exclamation-circle' : 'check-circle';
    notification.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatHuAsKhu(hu) {
    const n = Number(hu);
    if (!Number.isFinite(n)) return '';
    const fixed = (n / 1000).toFixed(1);
    return fixed.replace(/\.0$/, '');
}

function defaultSideLengthDisplay(game) {
    if (game === 'cs2') return '5.9';
    return '1000';
}

function sideLengthLabel(game) {
    if (game === 'cs2') return 'Размер поля (kHu²)';
    if (game === 'dota2') return 'Размер поля (units)';
    return 'Размер поля (м)';
}

function sideLengthHint(game) {
    if (game === 'cs2') {
        return 'Сторона карты в kHu (Hammer units). Например, Mirage — 5.9 kHu²';
    }
    if (game === 'dota2') {
        return 'Длина стороны в игровых units для линейки (100–20000)';
    }
    return 'Длина стороны квадратного поля боя, метры (100–20000)';
}

function sideLengthValidationMessage(game) {
    if (game === 'cs2') return 'Размер поля: от 0.1 до 20 kHu²';
    if (game === 'dota2') return 'Размер поля: от 100 до 20000 units';
    return 'Размер поля: от 100 до 20000 м';
}

function parseSideLengthInput(value, game) {
    if (game === 'cs2') {
        const khu = parseFloat(String(value ?? '').replace(',', '.'));
        if (!Number.isFinite(khu)) return null;
        return Math.round(Math.max(0.1, Math.min(20, khu)) * 1000);
    }
    const meters = parseInt(value, 10);
    if (!Number.isFinite(meters)) return null;
    return meters;
}

function sideLengthInputAttrs(game) {
    if (game === 'cs2') {
        return {
            min: '0.1',
            max: '20',
            step: '0.1',
            title: 'Размер поля, kHu²',
            placeholder: '5.9',
        };
    }
    if (game === 'dota2') {
        return {
            min: '100',
            max: '20000',
            step: '1',
            title: 'Размер поля, units',
            placeholder: '—',
        };
    }
    return {
        min: '100',
        max: '20000',
        step: '1',
        title: 'Размер поля, м',
        placeholder: '—',
    };
}

function formatSideLengthDisplay(hu, game) {
    if (!hu || hu <= 0) return '';
    if (game === 'cs2') return formatHuAsKhu(hu);
    return String(hu);
}

function mapSideLength(code) {
    const row = dictionary.find((m) => m.map_code === code);
    return row?.side_length ? parseInt(row.side_length, 10) : null;
}

function mapDisplayName(code) {
    const row = dictionary.find((m) => m.map_code === code);
    return row ? (row.display_name_ru || code) : code;
}

function mapDisplayNameEn(code) {
    const row = dictionary.find((m) => m.map_code === code);
    return row ? (row.display_name_en || '') : '';
}

let editMapAsset = null;

function modeLabelForAsset(asset) {
    const game = asset?.game || '';
    const mode = asset?.battle_mode || '';
    const fromGame = (gameModes[game] || []).find((m) => m.id === mode);
    if (fromGame) return fromGame.label;
    return modeLabels[mode] || mode;
}

function populateModeSelect(selectEl, game, selectedMode) {
    if (!selectEl) return;
    const modes = (gameModes[game] || []).filter((m) => {
        if (m.id !== 'custom') return true;
        return game === 'cs2' || game === 'dota2';
    });
    selectEl.innerHTML = modes.map((m) => {
        const selected = m.id === selectedMode ? ' selected' : '';
        return `<option value="${escapeHtml(m.id)}"${selected}>${escapeHtml(m.label)}</option>`;
    }).join('');
}

function syncUploadModeField() {
    const game = document.getElementById('tacticsUploadGame')?.value || 'wot';
    const modeSelect = document.getElementById('tacticsUploadMode');
    const modeLabel = document.getElementById('tacticsUploadModeLabel');
    const current = modeSelect?.value || '';
    populateModeSelect(modeSelect, game, current);
    if (modeLabel) {
        modeLabel.textContent = game === 'cs2' ? 'Тип карты' : 'Режим боя';
    }
    syncUploadSideLengthLabel();
}

function populateModeFilter() {
    const selectEl = document.getElementById('tacticsMapsModeFilter');
    if (!selectEl) return;
    const current = selectEl.value || '';
    const seen = new Set();
    const options = ['<option value="">Все режимы</option>'];
    Object.keys(gameModes).forEach((game) => {
        (gameModes[game] || []).forEach((m) => {
            if (seen.has(m.id)) return;
            seen.add(m.id);
            const selected = m.id === current ? ' selected' : '';
            options.push(`<option value="${escapeHtml(m.id)}"${selected}>${escapeHtml(m.label)}</option>`);
        });
    });
    selectEl.innerHTML = options.join('');
}

function getFilteredAssets() {
    const q = (document.getElementById('tacticsMapsSearch')?.value || '').trim().toLowerCase();
    const game = document.getElementById('tacticsMapsGameFilter')?.value || '';
    const mode = document.getElementById('tacticsMapsModeFilter')?.value || '';

    return assets.filter((a) => {
        if (!a.game) return false;
        if (game && a.game !== game) return false;
        if (mode && a.battle_mode !== mode) return false;
        if (q) {
            const name = mapDisplayName(a.map_code).toLowerCase();
            if (!a.map_code.includes(q) && !name.includes(q)) return false;
        }
        return true;
    });
}

function renderTable() {
    const tbody = document.getElementById('tacticsMapsTableBody');
    if (!tbody) return;

    const rows = getFilteredAssets();
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет загруженных миникарт</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((a) => {
        const cacheBust = a.mtime ? '?t=' + a.mtime : '';
        const sideLen = mapSideLength(a.map_code);
        const attrs = sideLengthInputAttrs(a.game || 'wot');
        const sideVal = formatSideLengthDisplay(sideLen, a.game || 'wot');
        const canEditSpawns = (a.game === 'wot' || a.game === 'lesta')
            && ['random', 'encounter', 'assault'].includes(a.battle_mode);
        const spawnsBtn = canEditSpawns
            ? `<button type="button" class="action-btn spawns" data-game="${escapeHtml(a.game)}" data-mode="${escapeHtml(a.battle_mode)}" data-code="${escapeHtml(a.map_code)}" title="Респы и базы"><i class="fas fa-map-pin" aria-hidden="true"></i></button>`
            : '';
        return `<tr>
            <td><img src="${escapeHtml(a.url + cacheBust)}" alt="" class="tactics-map-thumb" loading="lazy"></td>
            <td>${escapeHtml(gameLabels[a.game] || a.game)}</td>
            <td>${escapeHtml(modeLabelForAsset(a))}</td>
            <td><code>${escapeHtml(a.map_code)}</code></td>
            <td>${escapeHtml(mapDisplayName(a.map_code))}</td>
            <td>
                <input type="number" class="tactics-side-length-input" data-code="${escapeHtml(a.map_code)}" data-game="${escapeHtml(a.game || 'wot')}" min="${attrs.min}" max="${attrs.max}" step="${attrs.step}" value="${escapeHtml(sideVal)}" placeholder="${attrs.placeholder}" title="${escapeHtml(attrs.title)}">
            </td>
            <td>${formatBytes(a.size)}</td>
            <td>
                <div class="action-buttons">
                    <button type="button" class="action-btn edit" data-game="${escapeHtml(a.game)}" data-mode="${escapeHtml(a.battle_mode)}" data-code="${escapeHtml(a.map_code)}" title="Редактировать"><i class="fas fa-edit" aria-hidden="true"></i></button>
                    ${spawnsBtn}
                    <a href="${escapeHtml(a.url)}" class="action-btn" target="_blank" rel="noopener" title="Открыть"><i class="fas fa-external-link-alt"></i></a>
                    <button type="button" class="action-btn delete" data-game="${escapeHtml(a.game)}" data-mode="${escapeHtml(a.battle_mode)}" data-code="${escapeHtml(a.map_code)}" title="Удалить"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function loadMaps() {
    try {
        const res = await fetch('/admin/ajax/get_tactics_maps.php');
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка загрузки', 'error');
            return;
        }
        dictionary = json.dictionary || [];
        assets = json.assets || [];
        (json.games || []).forEach((g) => { gameLabels[g.id] = g.label; });
        (json.modes || []).forEach((m) => { modeLabels[m.id] = m.label; });
        gameModes = json.game_modes || {};
        populateModeFilter();
        syncUploadModeField();
        renderTable();
    } catch (e) {
        showNotification('Ошибка загрузки', 'error');
    }
}

function resetCreateForm() {
    const form = document.getElementById('tacticsMapUploadForm');
    if (!form) return;
    form.reset();
    uploadFormGame = null;
    syncUploadModeField();
    updateFileNameLabel();
    syncUploadSideLengthLabel({ forceDefault: true });
}

function readUploadField(form, name) {
    if (!form) return '';
    const field = form.elements.namedItem(name);
    if (!field) return '';
    if (field instanceof RadioNodeList) {
        return String(field.value || '').trim();
    }
    return String(field.value || '').trim();
}

function resolveUploadDisplayName(form) {
    const nameRu = readUploadField(form, 'display_name_ru');
    const nameEn = readUploadField(form, 'display_name_en');
    if (nameRu) {
        return { displayNameRu: nameRu, displayNameEn: nameEn };
    }
    if (nameEn) {
        return { displayNameRu: nameEn, displayNameEn: nameEn };
    }
    return null;
}

function buildUploadFormData(form, names) {
    const formData = new FormData(form);
    formData.set('display_name_ru', names.displayNameRu);
    if (names.displayNameEn) {
        formData.set('display_name_en', names.displayNameEn);
    } else {
        formData.delete('display_name_en');
    }
    const mapCode = readUploadField(form, 'map_code');
    if (mapCode) {
        formData.set('map_code', mapCode.toLowerCase());
    } else {
        formData.delete('map_code');
    }
    return formData;
}

async function uploadMap(ev) {
    ev.preventDefault();
    const form = document.getElementById('tacticsMapUploadForm');
    const btn = document.getElementById('tacticsUploadBtn');
    if (!form) return;

    const fileInput = form.elements.namedItem('image');
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;
    if (!file) {
        showNotification('Выберите файл', 'error');
        return;
    }
    const maxBytes = window.TACTICS_MAP_UPLOAD_MAX_BYTES || 16 * 1024 * 1024;
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    if (file.size > maxBytes) {
        showNotification(`Файл слишком большой (макс. ${maxMb} МБ)`, 'error');
        return;
    }

    const names = resolveUploadDisplayName(form);
    if (!names) {
        showNotification('Укажите название в поле «Название карты» (или «Название (EN)»)', 'error');
        document.getElementById('tacticsUploadName')?.focus();
        return;
    }

    const formData = buildUploadFormData(form, names);
    const game = readUploadField(form, 'game') || 'wot';
    const sideHu = parseSideLengthInput(readUploadField(form, 'side_length'), game);
    if (!Number.isFinite(sideHu) || sideHu < 100 || sideHu > 20000) {
        showNotification(sideLengthValidationMessage(game), 'error');
        return;
    }
    formData.set('side_length', String(sideHu));
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        formData.set('csrf_token', csrfMeta.getAttribute('content') || '');
    }

    if (btn) btn.disabled = true;
    try {
        const res = await fetch('/admin/ajax/tactics_map_upload.php', { method: 'POST', body: formData });
        let json;
        try {
            json = await res.json();
        } catch (parseErr) {
            showNotification(res.status === 403
                ? 'Сессия истекла — обновите страницу и войдите снова'
                : 'Ошибка сервера', 'error');
            return;
        }
        if (!json.success) {
            showNotification(json.error || 'Ошибка добавления', 'error');
            return;
        }
        const code = json.data?.map_code ? ` (${json.data.map_code})` : '';
        showNotification(`Карта добавлена${code}`);
        resetCreateForm();
        syncUploadSideLengthLabel();
        loadMaps();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function syncUploadSideLengthLabel(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const game = document.getElementById('tacticsUploadGame')?.value || 'wot';
    const label = document.getElementById('tacticsUploadSideLengthLabel')
        || document.querySelector('label[for="tacticsUploadSideLength"]');
    const input = document.getElementById('tacticsUploadSideLength');
    const hint = document.getElementById('tacticsUploadSideLengthHint');
    if (!label || !input) return;

    const gameChanged = uploadFormGame !== null && uploadFormGame !== game;
    uploadFormGame = game;

    label.textContent = sideLengthLabel(game);
    const attrs = sideLengthInputAttrs(game);
    input.min = attrs.min;
    input.max = attrs.max;
    input.step = attrs.step;
    input.title = attrs.title;
    input.placeholder = attrs.placeholder;
    if (hint) {
        hint.textContent = sideLengthHint(game);
    }

    if (opts.forceDefault || gameChanged || opts.isInit) {
        input.value = defaultSideLengthDisplay(game);
    }
}

async function saveSideLength(mapCode, meters) {
    const formData = new FormData();
    formData.append('map_code', mapCode);
    formData.append('side_length', String(meters));
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) formData.append('csrf_token', csrfMeta.getAttribute('content'));

    try {
        const res = await fetch('/admin/ajax/tactics_map_side_length.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка сохранения размера', 'error');
            return false;
        }
        const row = dictionary.find((m) => m.map_code === mapCode);
        if (row) row.side_length = json.side_length;
        showNotification('Размер поля сохранён');
        return true;
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
        return false;
    }
}

function syncEditSideLengthField(game) {
    const label = document.getElementById('tacticsEditMapSideLengthLabel');
    const input = document.getElementById('tacticsEditMapSideLength');
    const hint = document.getElementById('tacticsEditMapSideLengthHint');
    if (!label || !input) return;
    label.textContent = sideLengthLabel(game);
    const attrs = sideLengthInputAttrs(game);
    input.min = attrs.min;
    input.max = attrs.max;
    input.step = attrs.step;
    input.title = attrs.title;
    input.placeholder = attrs.placeholder;
    if (hint) {
        hint.textContent = sideLengthHint(game);
    }
}

function updateEditFileNameLabel() {
    const input = document.getElementById('tacticsEditMapFile');
    const label = document.getElementById('tacticsEditMapFileName');
    if (!label) return;
    const file = input?.files?.[0];
    label.textContent = file ? file.name : 'Файл не выбран';
    label.style.color = file ? '#e8eef2' : '';
}

function openEditMapModal(asset) {
    if (!asset) return;
    editMapAsset = asset;
    const game = asset.game || 'wot';
    const code = asset.map_code || '';
    const cacheBust = asset.mtime ? '?t=' + asset.mtime : '';

    document.getElementById('tacticsEditMapCode').value = code;
    document.getElementById('tacticsEditMapGame').value = game;
    document.getElementById('tacticsEditMapMode').value = asset.battle_mode || '';
    document.getElementById('tacticsEditMapCodeLabel').textContent = code;
    document.getElementById('tacticsEditMapGameLabel').textContent = gameLabels[game] || game;
    document.getElementById('tacticsEditMapModeLabel').textContent = modeLabelForAsset(asset);
    document.getElementById('tacticsEditMapNameRu').value = mapDisplayName(code);
    document.getElementById('tacticsEditMapNameEn').value = mapDisplayNameEn(code);

    syncEditSideLengthField(game);
    const sideLen = mapSideLength(code);
    document.getElementById('tacticsEditMapSideLength').value = formatSideLengthDisplay(sideLen, game)
        || defaultSideLengthDisplay(game);

    const preview = document.getElementById('tacticsEditMapPreview');
    if (preview) {
        preview.src = asset.url + cacheBust;
    }

    const fileInput = document.getElementById('tacticsEditMapFile');
    if (fileInput) {
        fileInput.value = '';
    }
    updateEditFileNameLabel();

    document.getElementById('tacticsEditMapModal')?.classList.add('active');
}

function closeEditMapModal() {
    editMapAsset = null;
    document.getElementById('tacticsEditMapModal')?.classList.remove('active');
}

async function saveEditedMap(ev) {
    ev.preventDefault();
    if (!editMapAsset) return;

    const form = document.getElementById('tacticsEditMapForm');
    const btn = document.getElementById('tacticsEditMapSubmit');
    if (!form) return;

    const game = readUploadField(form, 'game') || 'wot';
    const names = resolveUploadDisplayName(form);
    if (!names) {
        showNotification('Укажите название карты', 'error');
        document.getElementById('tacticsEditMapNameRu')?.focus();
        return;
    }

    const sideHu = parseSideLengthInput(readUploadField(form, 'side_length'), game);
    if (!Number.isFinite(sideHu) || sideHu < 100 || sideHu > 20000) {
        showNotification(sideLengthValidationMessage(game), 'error');
        return;
    }

    const fileInput = form.elements.namedItem('image');
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;
    const maxBytes = window.TACTICS_MAP_UPLOAD_MAX_BYTES || 16 * 1024 * 1024;
    if (file && file.size > maxBytes) {
        const maxMb = Math.round(maxBytes / (1024 * 1024));
        showNotification(`Файл слишком большой (макс. ${maxMb} МБ)`, 'error');
        return;
    }

    const formData = new FormData(form);
    formData.set('display_name_ru', names.displayNameRu);
    if (names.displayNameEn) {
        formData.set('display_name_en', names.displayNameEn);
    } else {
        formData.delete('display_name_en');
    }
    formData.set('side_length', String(sideHu));
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        formData.set('csrf_token', csrfMeta.getAttribute('content') || '');
    }

    if (btn) btn.disabled = true;
    try {
        const res = await fetch('/admin/ajax/tactics_map_update.php', { method: 'POST', body: formData });
        let json;
        try {
            json = await res.json();
        } catch (parseErr) {
            showNotification(res.status === 403
                ? 'Сессия истекла — обновите страницу и войдите снова'
                : 'Ошибка сервера', 'error');
            return;
        }
        if (!json.success) {
            showNotification(json.error || 'Ошибка сохранения', 'error');
            return;
        }
        showNotification('Карта обновлена');
        closeEditMapModal();
        loadMaps();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function deleteAsset(game, mode, mapCode) {
    if (!confirm('Удалить файл миникарты?')) return;

    const formData = new FormData();
    formData.append('game', game);
    formData.append('battle_mode', mode);
    formData.append('map_code', mapCode);
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) formData.append('csrf_token', csrfMeta.getAttribute('content'));

    try {
        const res = await fetch('/admin/ajax/tactics_map_delete.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification('Файл удалён');
        loadMaps();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

function updateFileNameLabel() {
    const input = document.getElementById('tacticsUploadFile');
    const label = document.getElementById('tacticsUploadFileName');
    if (!label) return;
    const file = input?.files?.[0];
    label.textContent = file ? file.name : 'Файл не выбран';
    label.style.color = file ? '#e8eef2' : '';
}

const SPAWN_MARKER_SCALE_DEFAULT = 1;
const SPAWN_MARKER_SCALE_MIN = 0.5;
const SPAWN_MARKER_SCALE_MAX = 2;
const SPAWN_MARKER_OPACITY_DEFAULT = 0.8;
const SPAWN_MARKER_OPACITY_MIN = 0.2;
const SPAWN_MARKER_OPACITY_MAX = 1;

const spawnEditor = {
    asset: null,
    bounds: null,
    points: [],
    defaults: { bounds: null, points: [] },
    selectedIndex: -1,
    drag: null,
};

function normalizeSpawnMarkerScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale) || scale <= 0) return SPAWN_MARKER_SCALE_DEFAULT;
    return Math.min(SPAWN_MARKER_SCALE_MAX, Math.max(SPAWN_MARKER_SCALE_MIN, Math.round(scale * 100) / 100));
}

function getSpawnPointMarkerScale(point) {
    return normalizeSpawnMarkerScale(point?.marker_scale ?? 1);
}

function normalizeSpawnMarkerOpacity(value) {
    const opacity = Number(value);
    if (!Number.isFinite(opacity)) return SPAWN_MARKER_OPACITY_DEFAULT;
    return Math.min(SPAWN_MARKER_OPACITY_MAX, Math.max(SPAWN_MARKER_OPACITY_MIN, Math.round(opacity * 100) / 100));
}

function getSpawnPointMarkerOpacity(point) {
    return normalizeSpawnMarkerOpacity(point?.marker_opacity ?? SPAWN_MARKER_OPACITY_DEFAULT);
}

function applySpawnEditorPointVisuals(index) {
    const point = spawnEditor.points[index];
    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    if (!point || !overlay) return;
    const el = overlay.querySelector(`[data-index="${index}"]`);
    if (el) {
        el.style.setProperty('--spawn-marker-scale', String(getSpawnPointMarkerScale(point)));
        el.style.opacity = String(getSpawnPointMarkerOpacity(point));
    }
}

function syncSpawnEditorSliderStyle(input) {
    if (!input) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const span = max - min;
    const pct = span > 0 ? ((value - min) / span) * 100 : 0;
    input.style.setProperty('--range-pct', `${pct}%`);
}

function syncSpawnEditorSliders() {
    syncSpawnEditorSliderStyle(document.getElementById('tacticsSpawnEditorSize'));
    syncSpawnEditorSliderStyle(document.getElementById('tacticsSpawnEditorOpacity'));
}

function updateSpawnEditorSelectionPanel() {
    const index = spawnEditor.selectedIndex;
    const point = spawnEditor.points[index];
    const sizeBlock = document.getElementById('tacticsSpawnEditorSizeBlock');
    const slider = document.getElementById('tacticsSpawnEditorSize');
    const output = document.getElementById('tacticsSpawnEditorSizeValue');
    const opacitySlider = document.getElementById('tacticsSpawnEditorOpacity');
    const opacityOutput = document.getElementById('tacticsSpawnEditorOpacityValue');
    const hasSelection = point != null;

    if (sizeBlock) sizeBlock.hidden = !hasSelection;
    if (hasSelection) {
        const scale = getSpawnPointMarkerScale(point);
        const opacity = getSpawnPointMarkerOpacity(point);
        if (slider) slider.value = String(Math.round(scale * 100));
        if (output) output.textContent = `${Math.round(scale * 100)}%`;
        if (opacitySlider) opacitySlider.value = String(Math.round(opacity * 100));
        if (opacityOutput) opacityOutput.textContent = `${Math.round(opacity * 100)}%`;
    } else {
        if (slider) slider.value = '100';
        if (output) output.textContent = '100%';
        if (opacitySlider) opacitySlider.value = '80';
        if (opacityOutput) opacityOutput.textContent = '80%';
    }

    updateSpawnEditorPropsPanel();
    syncSpawnEditorSliders();
}

function setSelectedSpawnPointScale(scale) {
    const point = spawnEditor.points[spawnEditor.selectedIndex];
    if (!point) return;
    const normalized = normalizeSpawnMarkerScale(scale);
    if (Math.abs(normalized - 1) < 0.001) {
        delete point.marker_scale;
    } else {
        point.marker_scale = normalized;
    }
    applySpawnEditorPointVisuals(spawnEditor.selectedIndex);
    renderSpawnEditorList();
    const slider = document.getElementById('tacticsSpawnEditorSize');
    const output = document.getElementById('tacticsSpawnEditorSizeValue');
    const pct = Math.round(normalized * 100);
    if (slider) {
        slider.value = String(pct);
        syncSpawnEditorSliderStyle(slider);
    }
    if (output) output.textContent = `${pct}%`;
}

function resetSelectedSpawnPointScale() {
    setSelectedSpawnPointScale(SPAWN_MARKER_SCALE_DEFAULT);
}

function setSelectedSpawnPointOpacity(opacity) {
    const point = spawnEditor.points[spawnEditor.selectedIndex];
    if (!point) return;
    const normalized = normalizeSpawnMarkerOpacity(opacity);
    if (Math.abs(normalized - SPAWN_MARKER_OPACITY_DEFAULT) < 0.001) {
        delete point.marker_opacity;
    } else {
        point.marker_opacity = normalized;
    }
    applySpawnEditorPointVisuals(spawnEditor.selectedIndex);
    renderSpawnEditorList();
    const slider = document.getElementById('tacticsSpawnEditorOpacity');
    const output = document.getElementById('tacticsSpawnEditorOpacityValue');
    const pct = Math.round(normalized * 100);
    if (slider) {
        slider.value = String(pct);
        syncSpawnEditorSliderStyle(slider);
    }
    if (output) output.textContent = `${pct}%`;
}

function resetSelectedSpawnPointOpacity() {
    setSelectedSpawnPointOpacity(SPAWN_MARKER_OPACITY_DEFAULT);
}

function normalizeSpawnBaseNumber(value) {
    const raw = String(value ?? '').trim();
    if (!/^[0-9]{1,3}$/.test(raw)) return '';
    return raw;
}

function spawnPointLabel(point, index) {
    const type = String(point?.point_type || '');
    const team = String(point?.team || '');
    const names = {
        base: 'База',
        spawn: 'Респ',
        control_point: 'База (встречка)',
    };
    const teamLabel = team === 'team1' ? '1' : (team === 'team2' ? '2' : '');
    let suffix = teamLabel ? ` (${teamLabel})` : '';
    if (type === 'base') {
        const baseNumber = normalizeSpawnBaseNumber(point?.base_number);
        if (baseNumber) {
            suffix += ` · ${baseNumber}`;
        }
    }
    const pointScale = getSpawnPointMarkerScale(point);
    if (Math.abs(pointScale - 1) >= 0.001) {
        suffix += ` · ${Math.round(pointScale * 100)}%`;
    }
    const pointOpacity = getSpawnPointMarkerOpacity(point);
    if (Math.abs(pointOpacity - SPAWN_MARKER_OPACITY_DEFAULT) >= 0.001) {
        suffix += ` · α${Math.round(pointOpacity * 100)}%`;
    }
    return `${index + 1}. ${names[type] || type}${suffix}`;
}

function appendSpawnEditorBaseMarkerContent(el, point) {
    if (!el || String(point?.point_type) !== 'base') return;
    const baseNumber = normalizeSpawnBaseNumber(point?.base_number);
    if (baseNumber) {
        const numberEl = document.createElement('span');
        numberEl.className = 'tactics-spawn-base-number';
        numberEl.textContent = baseNumber;
        el.appendChild(numberEl);
        return;
    }
    const flagEl = document.createElement('span');
    flagEl.className = 'tactics-spawn-flag';
    flagEl.setAttribute('aria-hidden', 'true');
    el.appendChild(flagEl);
}

function updateSpawnEditorPropsPanel() {
    const baseGroup = document.getElementById('tacticsSpawnEditorProps');
    const input = document.getElementById('tacticsSpawnEditorBaseNumber');
    if (!baseGroup || !input) return;
    const point = spawnEditor.points[spawnEditor.selectedIndex];
    const isBase = point && String(point.point_type) === 'base';
    baseGroup.classList.toggle('is-disabled', !isBase);
    input.disabled = !isBase;
    if (!isBase) {
        input.value = '';
        return;
    }
    input.value = normalizeSpawnBaseNumber(point.base_number);
}

function updateSpawnEditorBaseMarker(index) {
    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    const point = spawnEditor.points[index];
    if (!overlay || !point) return;
    const el = overlay.querySelector(`[data-index="${index}"]`);
    if (!el) return;
    el.querySelectorAll('.tactics-spawn-flag, .tactics-spawn-base-number').forEach((node) => node.remove());
    appendSpawnEditorBaseMarkerContent(el, point);
}

function setSpawnEditorBaseNumber(value) {
    const point = spawnEditor.points[spawnEditor.selectedIndex];
    if (!point || String(point.point_type) !== 'base') return;
    const normalized = normalizeSpawnBaseNumber(value);
    if (normalized) {
        point.base_number = normalized;
    } else {
        delete point.base_number;
    }
    updateSpawnEditorBaseMarker(spawnEditor.selectedIndex);
    renderSpawnEditorList();
}

function spawnPointClassNames(point) {
    const type = String(point?.point_type || '');
    const team = String(point?.team || '');
    const classes = ['tactics-spawn-editor-point'];
    if (type === 'base') classes.push('is-base');
    if (type === 'control_point') classes.push('is-encounter-cap');
    else if (team === 'team1') classes.push('is-green');
    else if (team === 'team2') classes.push('is-red');
    else classes.push('is-neutral-color');
    return classes.join(' ');
}

function spawnPointToPercent(point, bounds) {
    if (!bounds || !point) return null;
    const x = Number(point.x);
    const y = Number(point.y);
    const dx = bounds.max_x - bounds.min_x;
    const dy = bounds.max_y - bounds.min_y;
    if (!dx || !dy || Number.isNaN(x) || Number.isNaN(y)) return null;
    return {
        left: ((x - bounds.min_x) / dx) * 100,
        top: (1 - ((y - bounds.min_y) / dy)) * 100,
    };
}

function spawnPercentToWorld(left, top, bounds) {
    return {
        x: bounds.min_x + (left / 100) * (bounds.max_x - bounds.min_x),
        y: bounds.min_y + (1 - (top / 100)) * (bounds.max_y - bounds.min_y),
    };
}

function renderSpawnEditorList() {
    const list = document.getElementById('tacticsSpawnEditorList');
    if (!list) return;
    list.innerHTML = spawnEditor.points.map((point, index) => {
        const active = index === spawnEditor.selectedIndex ? ' is-active' : '';
        return `<button type="button" class="spawn-list-item${active}" data-index="${index}">${escapeHtml(spawnPointLabel(point, index))}</button>`;
    }).join('');
}

function createSpawnEditorMarkerEl(point, index) {
    const pos = spawnPointToPercent(point, spawnEditor.bounds);
    if (!pos) return null;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = spawnPointClassNames(point);
    if (index === spawnEditor.selectedIndex) el.classList.add('is-selected');
    el.style.left = `${pos.left}%`;
    el.style.top = `${pos.top}%`;
    el.style.setProperty('--spawn-marker-scale', String(getSpawnPointMarkerScale(point)));
    el.style.opacity = String(getSpawnPointMarkerOpacity(point));
    el.dataset.index = String(index);
    if (String(point.point_type) === 'base') {
        appendSpawnEditorBaseMarkerContent(el, point);
    } else if (String(point.point_type) === 'control_point') {
        const flagEl = document.createElement('span');
        flagEl.className = 'tactics-spawn-flag';
        flagEl.setAttribute('aria-hidden', 'true');
        el.appendChild(flagEl);
    }
    el.addEventListener('pointerdown', (ev) => startSpawnPointDrag(ev, index));
    return el;
}

function updateSpawnMarkerPosition(index) {
    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    const point = spawnEditor.points[index];
    if (!overlay || !point) return;
    const pos = spawnPointToPercent(point, spawnEditor.bounds);
    if (!pos) return;
    const el = overlay.querySelector(`[data-index="${index}"]`);
    if (!el) return;
    el.style.left = `${pos.left}%`;
    el.style.top = `${pos.top}%`;
}

function highlightSpawnSelection() {
    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    if (!overlay) return;
    overlay.querySelectorAll('.tactics-spawn-editor-point').forEach((el) => {
        const idx = parseInt(el.dataset.index, 10);
        el.classList.toggle('is-selected', idx === spawnEditor.selectedIndex);
    });
    renderSpawnEditorList();
    updateSpawnEditorSelectionPanel();
}

function renderSpawnEditorPoints() {
    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    if (!overlay || !spawnEditor.bounds) return;

    overlay.innerHTML = '';
    spawnEditor.points.forEach((point, index) => {
        const el = createSpawnEditorMarkerEl(point, index);
        if (el) overlay.appendChild(el);
    });
    renderSpawnEditorList();
    updateSpawnEditorSelectionPanel();
}

function selectSpawnPoint(index) {
    spawnEditor.selectedIndex = Number.isFinite(index) ? index : -1;
    highlightSpawnSelection();
}

function startSpawnPointDrag(ev, index) {
    if (!spawnEditor.bounds) return;
    ev.preventDefault();
    ev.stopPropagation();
    spawnEditor.selectedIndex = index;
    highlightSpawnSelection();

    const overlay = document.getElementById('tacticsSpawnEditorOverlay');
    const target = overlay?.querySelector(`[data-index="${index}"]`);
    const rect = overlay?.getBoundingClientRect();
    if (!overlay || !target || !rect?.width || !rect?.height) return;

    spawnEditor.drag = {
        index,
        overlay,
        rect,
        pointerId: ev.pointerId,
        target,
    };
    if (target.setPointerCapture) {
        target.setPointerCapture(ev.pointerId);
    }
    target.classList.add('is-dragging');

    const onMove = (moveEv) => {
        if (!spawnEditor.drag || moveEv.pointerId !== spawnEditor.drag.pointerId) return;
        moveEv.preventDefault();
        const drag = spawnEditor.drag;
        const left = Math.max(0, Math.min(100, ((moveEv.clientX - drag.rect.left) / drag.rect.width) * 100));
        const top = Math.max(0, Math.min(100, ((moveEv.clientY - drag.rect.top) / drag.rect.height) * 100));
        const world = spawnPercentToWorld(left, top, spawnEditor.bounds);
        const point = spawnEditor.points[drag.index];
        if (!point) return;
        point.x = Math.round(world.x * 1000) / 1000;
        point.y = Math.round(world.y * 1000) / 1000;
        updateSpawnMarkerPosition(drag.index);
    };

    const onUp = (upEv) => {
        if (!spawnEditor.drag || upEv.pointerId !== spawnEditor.drag.pointerId) return;
        spawnEditor.drag.target?.classList.remove('is-dragging');
        if (spawnEditor.drag.target?.releasePointerCapture) {
            try {
                spawnEditor.drag.target.releasePointerCapture(upEv.pointerId);
            } catch (err) { /* ignore */ }
        }
        spawnEditor.drag = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
}

function closeSpawnEditorModal() {
    const modal = document.getElementById('tacticsSpawnEditorModal');
    if (modal) modal.classList.remove('active');
    spawnEditor.asset = null;
    spawnEditor.points = [];
    spawnEditor.selectedIndex = -1;
    spawnEditor.drag = null;
}

async function openSpawnEditorModal(asset) {
    if (!asset) return;
    const modal = document.getElementById('tacticsSpawnEditorModal');
    const mapImg = document.getElementById('tacticsSpawnEditorMap');
    const meta = document.getElementById('tacticsSpawnEditorMeta');
    if (!modal || !mapImg) return;

    spawnEditor.asset = asset;
    const cacheBust = asset.mtime ? `?t=${asset.mtime}` : '';
    mapImg.src = asset.url + cacheBust;
    if (meta) {
        meta.textContent = `${mapDisplayName(asset.map_code)} · ${modeLabelForAsset(asset)} · ${asset.map_code}`;
    }

    try {
        const res = await fetch(`/admin/ajax/tactics_map_spawns_get.php?map_code=${encodeURIComponent(asset.map_code)}&battle_mode=${encodeURIComponent(asset.battle_mode)}`);
        const json = await res.json();
        if (!json.success || !json.data) {
            showNotification(json.error || 'Не удалось загрузить респы', 'error');
            return;
        }
        spawnEditor.bounds = json.data.bounds;
        spawnEditor.points = JSON.parse(JSON.stringify(json.data.points || []));
        spawnEditor.defaults = json.data.defaults || { bounds: json.data.bounds, points: [] };
        spawnEditor.selectedIndex = spawnEditor.points.length ? 0 : -1;
        renderSpawnEditorPoints();
        modal.classList.add('active');
    } catch (e) {
        showNotification('Ошибка загрузки респов', 'error');
    }
}

function addSpawnEditorPoint(type, team) {
    if (!spawnEditor.bounds) return;
    const center = spawnPercentToWorld(50, 50, spawnEditor.bounds);
    const point = {
        point_type: type,
        x: Math.round(center.x * 10) / 10,
        y: Math.round(center.y * 10) / 10,
        label: `${team || 'neutral'}_${type}_${Date.now()}`,
    };
    if (type !== 'control_point') {
        point.team = team;
    }
    if (type === 'base') {
        point.base_number = team === 'team2' ? '2' : '1';
    }
    spawnEditor.points.push(point);
    spawnEditor.selectedIndex = spawnEditor.points.length - 1;
    renderSpawnEditorPoints();
}

function deleteSelectedSpawnPoint() {
    if (spawnEditor.selectedIndex < 0) return;
    spawnEditor.points.splice(spawnEditor.selectedIndex, 1);
    spawnEditor.selectedIndex = Math.min(spawnEditor.selectedIndex, spawnEditor.points.length - 1);
    renderSpawnEditorPoints();
}

function isSpawnEditorModalOpen() {
    const modal = document.getElementById('tacticsSpawnEditorModal');
    return !!modal?.classList.contains('active');
}

function isSpawnEditorTypingTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!target.isContentEditable;
}

function handleSpawnEditorKeydown(event) {
    if (!isSpawnEditorModalOpen()) return;
    if (isSpawnEditorTypingTarget(event.target)) return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (spawnEditor.selectedIndex < 0) return;
    event.preventDefault();
    deleteSelectedSpawnPoint();
}

function resetSpawnEditorPoints() {
    spawnEditor.bounds = spawnEditor.defaults?.bounds || spawnEditor.bounds;
    spawnEditor.points = JSON.parse(JSON.stringify(spawnEditor.defaults?.points || []));
    spawnEditor.selectedIndex = spawnEditor.points.length ? 0 : -1;
    renderSpawnEditorPoints();
}

async function saveSpawnEditorPoints() {
    if (!spawnEditor.asset) return;
    const btn = document.getElementById('tacticsSpawnEditorSave');
    const formData = new FormData();
    formData.append('map_code', spawnEditor.asset.map_code);
    formData.append('battle_mode', spawnEditor.asset.battle_mode);
    formData.append('points', JSON.stringify(spawnEditor.points));
    if (spawnEditor.bounds) {
        formData.append('bounds', JSON.stringify(spawnEditor.bounds));
    }
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) formData.append('csrf_token', csrfMeta.getAttribute('content') || '');

    if (btn) btn.disabled = true;
    try {
        const res = await fetch('/admin/ajax/tactics_map_spawns_save.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка сохранения', 'error');
            return;
        }
        showNotification('Респы сохранены');
        spawnEditor.bounds = json.data.bounds;
        spawnEditor.points = JSON.parse(JSON.stringify(json.data.points || []));
        spawnEditor.defaults = json.data.defaults || spawnEditor.defaults;
        renderSpawnEditorPoints();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function bindSpawnEditorUi() {
    document.querySelectorAll('[data-spawn-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
            addSpawnEditorPoint(btn.dataset.spawnAdd, btn.dataset.spawnTeam || '');
        });
    });
    document.getElementById('tacticsSpawnEditorDelete')?.addEventListener('click', deleteSelectedSpawnPoint);
    document.getElementById('tacticsSpawnEditorReset')?.addEventListener('click', resetSpawnEditorPoints);
    document.getElementById('tacticsSpawnEditorSizeReset')?.addEventListener('click', resetSelectedSpawnPointScale);
    document.getElementById('tacticsSpawnEditorSize')?.addEventListener('input', (e) => {
        syncSpawnEditorSliderStyle(e.target);
        setSelectedSpawnPointScale(Number(e.target.value) / 100);
    });
    document.getElementById('tacticsSpawnEditorOpacityReset')?.addEventListener('click', resetSelectedSpawnPointOpacity);
    document.getElementById('tacticsSpawnEditorOpacity')?.addEventListener('input', (e) => {
        syncSpawnEditorSliderStyle(e.target);
        setSelectedSpawnPointOpacity(Number(e.target.value) / 100);
    });
    document.getElementById('tacticsSpawnEditorBaseNumber')?.addEventListener('input', (e) => {
        setSpawnEditorBaseNumber(e.target.value);
    });
    document.getElementById('tacticsSpawnEditorSave')?.addEventListener('click', saveSpawnEditorPoints);
    document.getElementById('tacticsSpawnEditorCancel')?.addEventListener('click', closeSpawnEditorModal);
    document.getElementById('tacticsSpawnEditorModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tacticsSpawnEditorModal') closeSpawnEditorModal();
    });
    document.getElementById('tacticsSpawnEditorList')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.spawn-list-item');
        if (!btn) return;
        selectSpawnPoint(parseInt(btn.dataset.index, 10));
    });
    document.addEventListener('keydown', handleSpawnEditorKeydown);
    syncSpawnEditorSliders();
}

document.addEventListener('DOMContentLoaded', () => {
    bindSpawnEditorUi();
    syncUploadSideLengthLabel({ isInit: true });
    loadMaps();

    document.getElementById('tacticsUploadGame')?.addEventListener('change', syncUploadModeField);
    document.getElementById('tacticsUploadFile')?.addEventListener('change', updateFileNameLabel);
    document.getElementById('tacticsMapUploadForm')?.addEventListener('submit', uploadMap);
    document.getElementById('tacticsMapsSearch')?.addEventListener('input', renderTable);
    document.getElementById('tacticsMapsGameFilter')?.addEventListener('change', renderTable);
    document.getElementById('tacticsMapsModeFilter')?.addEventListener('change', renderTable);
    document.getElementById('tacticsMapsResetFilters')?.addEventListener('click', () => {
        const search = document.getElementById('tacticsMapsSearch');
        const game = document.getElementById('tacticsMapsGameFilter');
        const mode = document.getElementById('tacticsMapsModeFilter');
        if (search) search.value = '';
        if (game) game.value = '';
        if (mode) mode.value = '';
        renderTable();
    });

    document.getElementById('tacticsEditMapForm')?.addEventListener('submit', saveEditedMap);
    document.getElementById('tacticsEditMapCancel')?.addEventListener('click', closeEditMapModal);
    document.getElementById('tacticsEditMapFile')?.addEventListener('change', updateEditFileNameLabel);
    document.getElementById('tacticsEditMapModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tacticsEditMapModal') {
            closeEditMapModal();
        }
    });

    document.getElementById('tacticsMapsTableBody')?.addEventListener('click', (e) => {
        const spawnsBtn = e.target.closest('.action-btn.spawns');
        if (spawnsBtn) {
            const asset = assets.find((a) => a.map_code === spawnsBtn.dataset.code
                && a.game === spawnsBtn.dataset.game
                && a.battle_mode === spawnsBtn.dataset.mode);
            if (asset) {
                void openSpawnEditorModal(asset);
            }
            return;
        }
        const editBtn = e.target.closest('.action-btn.edit');
        if (editBtn) {
            const asset = assets.find((a) => a.map_code === editBtn.dataset.code
                && a.game === editBtn.dataset.game
                && a.battle_mode === editBtn.dataset.mode);
            if (asset) {
                openEditMapModal(asset);
            }
            return;
        }
        const btn = e.target.closest('.action-btn.delete');
        if (btn) {
            deleteAsset(btn.dataset.game, btn.dataset.mode, btn.dataset.code);
        }
    });

    document.getElementById('tacticsMapsTableBody')?.addEventListener('change', async (e) => {
        const input = e.target.closest('.tactics-side-length-input');
        if (!input) return;
        const mapCode = input.dataset.code;
        const game = input.dataset.game || 'wot';
        const sideHu = parseSideLengthInput(input.value, game);
        if (!mapCode || !Number.isFinite(sideHu) || sideHu < 100 || sideHu > 20000) {
            showNotification(sideLengthValidationMessage(game), 'error');
            const prev = mapSideLength(mapCode);
            input.value = formatSideLengthDisplay(prev, game);
            return;
        }
        const ok = await saveSideLength(mapCode, sideHu);
        if (!ok) {
            const prev = mapSideLength(mapCode);
            input.value = formatSideLengthDisplay(prev, game);
        }
    });
});
