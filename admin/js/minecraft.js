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

document.getElementById('minecraftSettingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const enabledCheckbox = document.getElementById('mc_enabled');
    fd.set('mc_enabled', enabledCheckbox && enabledCheckbox.checked ? '1' : '0');

    try {
        const r = await fetch('/admin/ajax/minecraft_settings_save.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка', 'error');
            return;
        }

        const settings = data.settings || {};
        if (enabledCheckbox) enabledCheckbox.checked = settings.enabled === true;
        const fields = [
            ['mc_server_name', 'server_name'],
            ['mc_server_host', 'server_host'],
            ['mc_server_port', 'server_port'],
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
        showNotification('Настройки Minecraft сохранены');
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
