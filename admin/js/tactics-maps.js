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

function modeLabelForAsset(asset) {
    const game = asset?.game || '';
    const mode = asset?.battle_mode || '';
    const fromGame = (gameModes[game] || []).find((m) => m.id === mode);
    if (fromGame) return fromGame.label;
    return modeLabels[mode] || mode;
}

function populateModeSelect(selectEl, game, selectedMode) {
    if (!selectEl) return;
    const modes = (gameModes[game] || []).filter((m) => !(
        (game === 'cs2' || game === 'dota2') && m.id === 'custom'
    ));
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

document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('tacticsMapsTableBody')?.addEventListener('click', (e) => {
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
