let allRooms = [];

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

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function updateStats(stats) {
    if (!stats) return;
    const map = {
        tacticsRoomsTotal: stats.total,
        tacticsRoomsOpen: stats.open,
        tacticsRoomsClosed: stats.closed,
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
    });
}

function getFilteredRooms() {
    const q = (document.getElementById('tacticsRoomsSearch')?.value || '').trim().toLowerCase();
    const visibility = document.getElementById('tacticsRoomsVisibility')?.value || '';
    let rows = allRooms;
    if (visibility) rows = rows.filter((r) => r.visibility === visibility);
    if (q) {
        rows = rows.filter((r) =>
            (r.title || '').toLowerCase().includes(q)
            || (r.public_id || '').toLowerCase().includes(q)
            || (r.owner_name || '').toLowerCase().includes(q)
        );
    }
    return rows;
}

function renderTable() {
    const tbody = document.getElementById('tacticsRoomsTableBody');
    if (!tbody) return;

    const rows = getFilteredRooms();
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет комнат</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((r) => {
        const author = r.user_id
            ? escapeHtml(r.owner_name || r.owner_email || `User #${r.user_id}`)
            : '<span style="color:#9aa5b1;">Гость</span>';
        const visClass = r.visibility === 'closed' ? 'closed' : '';
        const maps = (r.map_codes || []).map(escapeHtml).join(', ') || '—';
        const pwd = r.has_password ? ' <i class="fas fa-key" title="С паролем"></i>' : '';

        return `<tr>
            <td><code>${escapeHtml(r.public_id)}</code></td>
            <td>${escapeHtml(r.title)}${pwd}</td>
            <td><span class="tactics-vis-badge ${visClass}">${escapeHtml(r.visibility_label)}</span></td>
            <td class="tactics-maps-cell">${maps} <span style="color:#6b7c8f;">(${r.slide_count || 0})</span></td>
            <td>${author}</td>
            <td>${formatDate(r.last_active_at || r.updated_at)}</td>
            <td>
                <div class="action-buttons">
                    <a href="${escapeHtml(r.view_url)}" class="action-btn" target="_blank" rel="noopener" title="Открыть"><i class="fas fa-external-link-alt"></i></a>
                    <button type="button" class="action-btn btn-delete" data-id="${r.id}" title="Удалить"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function loadRooms() {
    const search = document.getElementById('tacticsRoomsSearch')?.value || '';
    const visibility = document.getElementById('tacticsRoomsVisibility')?.value || '';
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (visibility) params.set('visibility', visibility);

    try {
        const res = await fetch('/admin/ajax/get_tactics_rooms.php?' + params.toString());
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка загрузки', 'error');
            return;
        }
        allRooms = json.data || [];
        updateStats(json.stats);
        renderTable();
    } catch (e) {
        showNotification('Ошибка загрузки', 'error');
    }
}

async function deleteRoom(id) {
    if (!confirm('Удалить комнату без возможности восстановления?')) return;

    const formData = new FormData();
    formData.append('id', String(id));
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) formData.append('csrf_token', csrfMeta.getAttribute('content'));

    try {
        const res = await fetch('/admin/ajax/tactics_room_delete.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification('Комната удалена');
        loadRooms();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRooms();

    let searchTimer = null;
    document.getElementById('tacticsRoomsSearch')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadRooms, 300);
    });
    document.getElementById('tacticsRoomsVisibility')?.addEventListener('change', loadRooms);
    document.getElementById('tacticsRoomsResetFilters')?.addEventListener('click', () => {
        const search = document.getElementById('tacticsRoomsSearch');
        const visibility = document.getElementById('tacticsRoomsVisibility');
        if (search) search.value = '';
        if (visibility) visibility.value = '';
        loadRooms();
    });

    document.getElementById('tacticsRoomsTableBody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) deleteRoom(parseInt(btn.dataset.id, 10));
    });
});
