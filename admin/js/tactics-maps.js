let dictionary = [];
let assets = [];
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
        const sideVal = sideLen && sideLen > 0 ? String(sideLen) : '';
        return `<tr>
            <td><img src="${escapeHtml(a.url + cacheBust)}" alt="" class="tactics-map-thumb" loading="lazy"></td>
            <td>${escapeHtml(gameLabels[a.game] || a.game)}</td>
            <td>${escapeHtml(modeLabelForAsset(a))}</td>
            <td><code>${escapeHtml(a.map_code)}</code></td>
            <td>${escapeHtml(mapDisplayName(a.map_code))}</td>
            <td>
                <input type="number" class="tactics-side-length-input" data-code="${escapeHtml(a.map_code)}" min="100" max="20000" step="1" value="${escapeHtml(sideVal)}" placeholder="—" title="Размер поля, м">
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
    document.getElementById('tacticsUploadSideLength').value = '1000';
    updateFileNameLabel();
}

function resolveUploadDisplayName() {
    const nameRu = document.getElementById('tacticsUploadName')?.value.trim() || '';
    const nameEn = document.getElementById('tacticsUploadNameEn')?.value.trim() || '';
    if (nameRu) {
        return { displayNameRu: nameRu, displayNameEn: nameEn };
    }
    if (nameEn) {
        return { displayNameRu: nameEn, displayNameEn: nameEn };
    }
    return null;
}

function syncUploadSideLengthLabel() {
    const game = document.getElementById('tacticsUploadGame')?.value || 'wot';
    const label = document.querySelector('label[for="tacticsUploadSideLength"]');
    const input = document.getElementById('tacticsUploadSideLength');
    if (!label || !input) return;
    const usesUnits = game === 'dota2';
    label.textContent = usesUnits ? 'Размер поля (units)' : 'Размер поля (м)';
    input.title = usesUnits
        ? 'Длина стороны квадратного поля в игровых единицах'
        : 'Длина стороны квадратного поля боя';
}

async function uploadMap(ev) {
    ev.preventDefault();
    const btn = document.getElementById('tacticsUploadBtn');
    const fileInput = document.getElementById('tacticsUploadFile');
    if (!fileInput?.files?.length) {
        showNotification('Выберите файл', 'error');
        return;
    }
    const names = resolveUploadDisplayName();
    if (!names) {
        showNotification('Укажите название в поле «Название карты» (или «Название (EN)»)', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('game', document.getElementById('tacticsUploadGame')?.value || 'wot');
    formData.append('battle_mode', document.getElementById('tacticsUploadMode')?.value || 'random');
    formData.append('display_name_ru', names.displayNameRu);
    if (names.displayNameEn) formData.append('display_name_en', names.displayNameEn);
    const mapCode = document.getElementById('tacticsUploadCode')?.value.trim();
    if (mapCode) formData.append('map_code', mapCode.toLowerCase());
    formData.append('side_length', document.getElementById('tacticsUploadSideLength')?.value || '');
    formData.append('image', fileInput.files[0]);

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) formData.append('csrf_token', csrfMeta.getAttribute('content'));

    if (btn) btn.disabled = true;
    try {
        const res = await fetch('/admin/ajax/tactics_map_upload.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка добавления', 'error');
            return;
        }
        const code = json.data?.map_code ? ` (${json.data.map_code})` : '';
        showNotification(`Карта добавлена${code}`);
        resetCreateForm();
        loadMaps();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    } finally {
        if (btn) btn.disabled = false;
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
        const meters = parseInt(input.value, 10);
        if (!mapCode || !Number.isFinite(meters) || meters < 100 || meters > 20000) {
            showNotification('Размер поля: от 100 до 20000 м', 'error');
            const prev = mapSideLength(mapCode);
            input.value = prev && prev > 0 ? String(prev) : '';
            return;
        }
        const ok = await saveSideLength(mapCode, meters);
        if (!ok) {
            const prev = mapSideLength(mapCode);
            input.value = prev && prev > 0 ? String(prev) : '';
        }
    });
});
