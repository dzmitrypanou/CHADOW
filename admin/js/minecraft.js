function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    const icon = type === 'error' ? 'exclamation-circle' : 'check-circle';
    n.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => {
        n.classList.add('fade-out');
        setTimeout(() => n.remove(), 300);
    }, 3500);
}

function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

function formatPackSize(bytes) {
    const mb = bytes / 1024 / 1024;
    return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} МБ`;
}

function formatPackDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function renderPacksList(packs) {
    const container = document.getElementById('minecraftPacksList');
    if (!container) return;

    if (!packs || packs.length === 0) {
        container.innerHTML = '<p class="minecraft-packs-empty" id="minecraftPacksEmpty">Архивы пока не загружены.</p>';
        return;
    }

    const rows = packs.map(pack => `
        <tr data-version="${escapeHtml(pack.version)}">
            <td><code>${escapeHtml(pack.version)}</code></td>
            <td>${escapeHtml(formatPackSize(pack.size || 0))}</td>
            <td>${escapeHtml(formatPackDate(pack.uploaded_at))}</td>
            <td>
                <button type="button" class="btn btn-sm btn-danger minecraft-pack-delete"
                    data-version="${escapeHtml(pack.version)}">
                    Удалить
                </button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="admin-table" id="minecraftPacksTable">
            <thead>
                <tr>
                    <th>Версия</th>
                    <th>Размер</th>
                    <th>Загружен</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let mcServers = Array.isArray(window.__mcInitialServers) ? [...window.__mcInitialServers] : [];

const BADGE_STYLES = Array.isArray(window.__mcBadgeStyles) ? window.__mcBadgeStyles : ['default'];
const SERVER_ICONS = window.__mcServerIcons && typeof window.__mcServerIcons === 'object'
    ? window.__mcServerIcons
    : { '': 'Без иконки' };
let mcLandingBadges = Array.isArray(window.__mcInitialLandingBadges) ? [...window.__mcInitialLandingBadges] : [];

function slugifyServerId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || `server-${Date.now().toString(36)}`;
}

function syncServersHiddenInput() {
    const input = document.getElementById('mc_servers_json');
    if (input) {
        input.value = JSON.stringify(mcServers);
    }
}

function collectServersFromDom() {
    const rows = document.querySelectorAll('#minecraftServersList .minecraft-server-row');
    const servers = [];
    const usedIds = new Set();

    rows.forEach((row, index) => {
        const id = row.querySelector('[data-field="id"]')?.value.trim() || '';
        const name = row.querySelector('[data-field="name"]')?.value.trim() || '';
        const host = row.querySelector('[data-field="host"]')?.value.trim() || '';
        const port = Number(row.querySelector('[data-field="port"]')?.value || 25565);
        const connectHost = row.querySelector('[data-field="connectHost"]')?.value.trim() || '';
        const connectPortRaw = row.querySelector('[data-field="connectPort"]')?.value.trim() || '';
        const connectPort = connectPortRaw === '' ? null : Number(connectPortRaw);
        const exarotonId = row.querySelector('[data-field="exarotonId"]')?.value.trim() || '';
        const icon = row.querySelector('[data-field="icon"]')?.value.trim() || '';
        const description = row.querySelector('[data-field="description"]')?.value || '';

        if (!name && !host) {
            return;
        }

        let serverId = id || slugifyServerId(name || host);
        while (usedIds.has(serverId)) {
            serverId = `${serverId}-${index + 1}`;
        }
        usedIds.add(serverId);

        const server = {
            id: serverId,
            name,
            host,
            port: Number.isFinite(port) ? port : 25565,
        };
        if (icon) {
            server.icon = icon;
        }
        const descLines = String(description)
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 3)
            .map(line => line.slice(0, 48));
        if (descLines.length) {
            server.description = descLines;
        }
        if (connectHost) {
            server.connectHost = connectHost;
            if (connectPort !== null && Number.isFinite(connectPort)) {
                server.connectPort = connectPort;
            }
        }
        if (exarotonId) {
            server.exarotonId = exarotonId;
        }
        servers.push(server);
    });

    mcServers = servers;
    syncServersHiddenInput();
}

function renderServersList() {
    const container = document.getElementById('minecraftServersList');
    if (!container) return;

    if (!mcServers.length) {
        container.innerHTML = '<p class="minecraft-servers-empty">Серверы не добавлены. Нажмите «Добавить сервер».</p>';
        syncServersHiddenInput();
        return;
    }

    const iconOptions = Object.entries(SERVER_ICONS).map(([value, label]) => (
        `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
    )).join('');

    container.innerHTML = mcServers.map((server, index) => {
        const description = Array.isArray(server.description)
            ? server.description.join('\n')
            : String(server.description || '');
        return `
        <div class="minecraft-server-row" data-index="${index}">
            <div>
                <label>ID</label>
                <input type="text" data-field="id" maxlength="32" value="${escapeHtml(server.id || '')}" placeholder="main">
            </div>
            <div>
                <label>Название</label>
                <input type="text" data-field="name" maxlength="80" required value="${escapeHtml(server.name || '')}" placeholder="Chadow Land">
            </div>
            <div>
                <label>Иконка</label>
                <select data-field="icon">${iconOptions}</select>
            </div>
            <div>
                <label>В лаунчере — адрес</label>
                <input type="text" data-field="host" maxlength="253" required value="${escapeHtml(server.host || '')}" placeholder="mc.example.com">
            </div>
            <div>
                <label>В лаунчере — порт</label>
                <input type="number" data-field="port" min="1" max="65535" value="${Number(server.port) || 25565}">
            </div>
            <div>
                <label>Подключение — адрес</label>
                <input type="text" data-field="connectHost" maxlength="253" value="${escapeHtml(server.connectHost || '')}" placeholder="Прямой IP или хост">
            </div>
            <div>
                <label>Подключение — порт</label>
                <input type="number" data-field="connectPort" min="1" max="65535" value="${server.connectPort != null ? Number(server.connectPort) : ''}" placeholder="как в лаунчере">
            </div>
            <button type="button" class="btn btn-sm btn-danger minecraft-server-remove" data-index="${index}">Удалить</button>
            <div class="minecraft-server-row-desc">
                <div class="minecraft-server-row-exo">
                    <label>Exaroton ID</label>
                    <input type="text" data-field="exarotonId" maxlength="64" value="${escapeHtml(server.exarotonId || '')}" placeholder="tgkm731xO7GiHt76">
                    <small class="form-hint">Короткий ID сервера из exaroton (например tgkm731xO7GiHt76), не API-токен.</small>
                </div>
                <label>Описание в лаунчере</label>
                <textarea data-field="description" rows="3" maxlength="150"
                    placeholder="До 3 коротких строк — справа от иконки в карточке сервера">${escapeHtml(description)}</textarea>
                <small class="form-hint">По одной строке на описание, максимум 48 символов в строке. «В лаунчере» — что видит игрок; «Подключение» — куда идёт клиент (если пусто, как в лаунчере).</small>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('select[data-field="icon"]').forEach((select, index) => {
        const icon = mcServers[index]?.icon || '';
        select.value = Object.prototype.hasOwnProperty.call(SERVER_ICONS, icon) ? icon : '';
    });

    syncServersHiddenInput();
}

document.getElementById('mcServerAddBtn')?.addEventListener('click', () => {
    collectServersFromDom();
    mcServers.push({
        id: '',
        name: '',
        host: '',
        port: 25565,
        icon: '',
        description: [],
    });
    renderServersList();
});

document.getElementById('minecraftServersList')?.addEventListener('click', e => {
    const btn = e.target.closest('.minecraft-server-remove');
    if (!btn) return;
    collectServersFromDom();
    const index = Number(btn.getAttribute('data-index'));
    if (!Number.isFinite(index)) return;
    mcServers.splice(index, 1);
    renderServersList();
});

document.getElementById('minecraftServersList')?.addEventListener('input', () => {
    collectServersFromDom();
});

renderServersList();

function syncLandingBadgesHiddenInput() {
    const input = document.getElementById('mc_landing_badges_json');
    if (input) {
        input.value = JSON.stringify(mcLandingBadges);
    }
}

function collectLandingBadgesFromDom() {
    const rows = document.querySelectorAll('#minecraftLandingBadgesList .minecraft-badge-row');
    const badges = [];

    rows.forEach(row => {
        const labelRu = row.querySelector('[data-field="label_ru"]')?.value.trim() || '';
        const labelEn = row.querySelector('[data-field="label_en"]')?.value.trim() || '';
        const style = row.querySelector('[data-field="style"]')?.value || 'default';
        if (!labelRu && !labelEn) return;
        badges.push({ label_ru: labelRu, label_en: labelEn, style });
    });

    mcLandingBadges = badges;
    syncLandingBadgesHiddenInput();
}

function renderLandingBadgesList() {
    const container = document.getElementById('minecraftLandingBadgesList');
    if (!container) return;

    if (!mcLandingBadges.length) {
        container.innerHTML = '<p class="minecraft-badges-empty">Бейджи не добавлены.</p>';
        syncLandingBadgesHiddenInput();
        return;
    }

    const styleOptions = BADGE_STYLES.map(style => {
        const labels = {
            default: 'Обычный',
            test: 'Тест',
            minecraft: 'Minecraft',
            wg: 'WG',
            lesta: 'Lesta',
            cs2: 'CS2',
            dota2: 'Dota 2',
            survival: 'Выживание',
            pvp: 'PvP',
            vip: 'VIP',
            classic: 'Классика',
            beta: 'Бета',
            new: 'Новинка',
        };
        return `<option value="${escapeHtml(style)}">${escapeHtml(labels[style] || style)}</option>`;
    }).join('');

    container.innerHTML = mcLandingBadges.map((badge, index) => `
        <div class="minecraft-badge-row" data-index="${index}">
            <div>
                <label>Текст RU</label>
                <input type="text" data-field="label_ru" maxlength="40" value="${escapeHtml(badge.label_ru || '')}" placeholder="в разработке">
            </div>
            <div>
                <label>Текст EN</label>
                <input type="text" data-field="label_en" maxlength="40" value="${escapeHtml(badge.label_en || '')}" placeholder="In development">
            </div>
            <div>
                <label>Стиль</label>
                <select data-field="style">${styleOptions}</select>
            </div>
            <button type="button" class="btn btn-sm btn-danger minecraft-badge-remove" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    container.querySelectorAll('select[data-field="style"]').forEach((select, index) => {
        const style = mcLandingBadges[index]?.style || 'default';
        select.value = BADGE_STYLES.includes(style) ? style : 'default';
    });

    syncLandingBadgesHiddenInput();
}

function renderLauncherFileInfo(file) {
    const container = document.getElementById('minecraftLauncherFileInfo');
    if (!container) return;

    if (!file) {
        container.classList.add('is-empty');
        container.innerHTML = '<p class="minecraft-launcher-file-empty">Файл не загружен.</p>';
        return;
    }

    container.classList.remove('is-empty');
    const sizeMb = formatPackSize(file.size || 0);
    const uploaded = formatPackDate(file.uploaded_at);
    const url = file.url || '#';
    container.innerHTML = `
        <div class="minecraft-launcher-file-meta">
            <strong>${escapeHtml(file.original_name || file.filename || 'launcher')}</strong>
            <span>${escapeHtml(sizeMb)} · ${escapeHtml(uploaded)}</span>
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Открыть</a>
        </div>
        <button type="button" class="btn btn-sm btn-danger" id="minecraftLauncherDeleteBtn">Удалить файл</button>
    `;
}

document.getElementById('mcLandingBadgeAddBtn')?.addEventListener('click', () => {
    collectLandingBadgesFromDom();
    mcLandingBadges.push({ label_ru: '', label_en: '', style: 'default' });
    renderLandingBadgesList();
});

document.getElementById('minecraftLandingBadgesList')?.addEventListener('click', e => {
    const btn = e.target.closest('.minecraft-badge-remove');
    if (!btn) return;
    collectLandingBadgesFromDom();
    const index = Number(btn.getAttribute('data-index'));
    if (!Number.isFinite(index)) return;
    mcLandingBadges.splice(index, 1);
    renderLandingBadgesList();
});

document.getElementById('minecraftLandingBadgesList')?.addEventListener('input', () => {
    collectLandingBadgesFromDom();
});

document.getElementById('minecraftLandingBadgesList')?.addEventListener('change', () => {
    collectLandingBadgesFromDom();
});

renderLandingBadgesList();

document.getElementById('minecraftLandingForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    collectLandingBadgesFromDom();

    const settingsForm = document.getElementById('minecraftSettingsForm');
    const fd = new FormData();
    const landingFields = [
        'mc_landing_active',
        'mc_landing_desc_ru',
        'mc_landing_desc_en',
        'mc_landing_tile_span',
    ];
    landingFields.forEach(name => {
        const el = document.getElementById(name);
        if (!el) return;
        if (el.type === 'checkbox') {
            fd.set(name, el.checked ? '1' : '0');
        } else {
            fd.set(name, el.value);
        }
    });
    fd.set('mc_landing_badges_json', JSON.stringify(mcLandingBadges));

    if (settingsForm) {
        const enabledCheckbox = document.getElementById('mc_enabled');
        fd.set('mc_enabled', enabledCheckbox && enabledCheckbox.checked ? '1' : '0');
        fd.set('mc_servers_json', JSON.stringify(mcServers));
        ['mc_minecraft_version', 'mc_java_major', 'mc_launcher_version', 'mc_exaroton_api_token'].forEach(id => {
            const el = document.getElementById(id);
            if (el) fd.set(id, el.value);
        });
    }

    try {
        const r = await fetch('/admin/ajax/minecraft_settings_save.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка', 'error');
            return;
        }

        const landing = data.settings?.landing || {};
        const activeCheckbox = document.getElementById('mc_landing_active');
        if (activeCheckbox) activeCheckbox.checked = landing.active === true;
        if (landing.desc_ru !== undefined) {
            const el = document.getElementById('mc_landing_desc_ru');
            if (el) el.value = landing.desc_ru;
        }
        if (landing.desc_en !== undefined) {
            const el = document.getElementById('mc_landing_desc_en');
            if (el) el.value = landing.desc_en;
        }
        if (landing.tile_span !== undefined) {
            const el = document.getElementById('mc_landing_tile_span');
            if (el) el.value = String(landing.tile_span);
        }
        mcLandingBadges = Array.isArray(landing.badges) ? landing.badges : [];
        renderLandingBadgesList();
        renderLauncherFileInfo(landing.launcher_file || null);
        showNotification('Карточка на главной сохранена');
    } catch (err) {
        showNotification('Ошибка сети', 'error');
    }
});

document.getElementById('minecraftLauncherUploadForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('minecraftLauncherUploadBtn');
    const fileInput = document.getElementById('mc_launcher_file');
    if (!fileInput?.files?.length) {
        showNotification('Выберите файл установщика', 'error');
        return;
    }

    const fd = new FormData(form);
    fd.append('csrf_token', getCsrfToken());

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка…';
    }

    try {
        const r = await fetch('/admin/ajax/minecraft_launcher_upload.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка загрузки', 'error');
            return;
        }

        renderLauncherFileInfo(data.file || data.landing?.launcher_file || null);
        fileInput.value = '';
        showNotification('Установщик лаунчера загружен');
    } catch (err) {
        showNotification('Ошибка сети при загрузке', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Загрузить установщик';
        }
    }
});

document.getElementById('minecraftLauncherFileInfo')?.addEventListener('click', async e => {
    const btn = e.target.closest('#minecraftLauncherDeleteBtn');
    if (!btn) return;
    if (!window.confirm('Удалить файл лаунчера?')) return;

    const fd = new FormData();
    fd.append('csrf_token', getCsrfToken());
    btn.disabled = true;

    try {
        const r = await fetch('/admin/ajax/minecraft_launcher_delete.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка удаления', 'error');
            btn.disabled = false;
            return;
        }
        renderLauncherFileInfo(null);
        showNotification('Файл лаунчера удалён');
    } catch (err) {
        showNotification('Ошибка сети', 'error');
        btn.disabled = false;
    }
});

document.getElementById('minecraftSettingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    collectServersFromDom();
    collectLandingBadgesFromDom();
    const fd = new FormData(e.target);
    const enabledCheckbox = document.getElementById('mc_enabled');
    fd.set('mc_enabled', enabledCheckbox && enabledCheckbox.checked ? '1' : '0');
    fd.set('mc_servers_json', JSON.stringify(mcServers));

    const landingActive = document.getElementById('mc_landing_active');
    fd.set('mc_landing_active', landingActive && landingActive.checked ? '1' : '0');
    ['mc_landing_desc_ru', 'mc_landing_desc_en', 'mc_landing_tile_span'].forEach(id => {
        const el = document.getElementById(id);
        if (el) fd.set(id, el.value);
    });
    fd.set('mc_landing_badges_json', JSON.stringify(mcLandingBadges));

    try {
        const r = await fetch('/admin/ajax/minecraft_settings_save.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка', 'error');
            return;
        }

        const settings = data.settings || {};
        if (enabledCheckbox) enabledCheckbox.checked = settings.enabled === true;
        mcServers = Array.isArray(settings.servers) ? settings.servers : [];
        renderServersList();
        const fields = [
            ['mc_minecraft_version', 'minecraft_version'],
            ['mc_java_major', 'java_major'],
            ['mc_launcher_version', 'launcher_version'],
        ];
        for (const [id, key] of fields) {
            const el = document.getElementById(id);
            if (el && settings[key] !== undefined && settings[key] !== null) {
                el.value = String(settings[key]);
            }
        }
        const packVersionInput = document.getElementById('mc_pack_version');
        if (packVersionInput && settings.minecraft_version) {
            packVersionInput.value = String(settings.minecraft_version);
        }
        const landing = settings.landing || {};
        const landingActiveCheckbox = document.getElementById('mc_landing_active');
        if (landingActiveCheckbox) landingActiveCheckbox.checked = landing.active === true;
        if (landing.desc_ru !== undefined) {
            const el = document.getElementById('mc_landing_desc_ru');
            if (el) el.value = landing.desc_ru;
        }
        if (landing.desc_en !== undefined) {
            const el = document.getElementById('mc_landing_desc_en');
            if (el) el.value = landing.desc_en;
        }
        if (landing.tile_span !== undefined) {
            const el = document.getElementById('mc_landing_tile_span');
            if (el) el.value = String(landing.tile_span);
        }
        mcLandingBadges = Array.isArray(landing.badges) ? landing.badges : [];
        renderLandingBadgesList();
        renderLauncherFileInfo(landing.launcher_file || null);
        showNotification('Настройки лаунчера сохранены');
    } catch (err) {
        showNotification('Ошибка сети', 'error');
    }
});

document.getElementById('minecraftPackUploadForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('minecraftPackUploadBtn');
    const fileInput = document.getElementById('mc_pack_archive');
    if (!fileInput?.files?.length) {
        showNotification('Выберите ZIP-архив', 'error');
        return;
    }

    const fd = new FormData(form);
    fd.append('csrf_token', getCsrfToken());

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка…';
    }

    try {
        const r = await fetch('/admin/ajax/minecraft_pack_upload.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка загрузки', 'error');
            return;
        }

        renderPacksList(data.packs || []);
        fileInput.value = '';
        showNotification(`Архив ${data.pack?.version || ''} загружен`);
    } catch (err) {
        showNotification('Ошибка сети при загрузке', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> Загрузить архив';
        }
    }
});

document.getElementById('minecraftPacksList')?.addEventListener('click', async e => {
    const btn = e.target.closest('.minecraft-pack-delete');
    if (!btn) return;

    const version = btn.getAttribute('data-version');
    if (!version) return;
    if (!window.confirm(`Удалить архив версии ${version}?`)) return;

    const fd = new FormData();
    fd.append('mc_pack_version', version);
    fd.append('csrf_token', getCsrfToken());

    btn.disabled = true;
    try {
        const r = await fetch('/admin/ajax/minecraft_pack_delete.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка удаления', 'error');
            btn.disabled = false;
            return;
        }
        renderPacksList(data.packs || []);
        showNotification(`Архив ${version} удалён`);
    } catch (err) {
        showNotification('Ошибка сети', 'error');
        btn.disabled = false;
    }
});
