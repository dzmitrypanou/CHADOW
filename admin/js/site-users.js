let currentPage = 1;
let searchTimer = null;

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
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
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

function adminCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || window.__csrfToken
        || '';
}

function adminPostBody(fields) {
    const body = new URLSearchParams();
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            body.set(key, String(value));
        }
    });
    const token = adminCsrfToken();
    if (token) body.set('csrf_token', token);
    return body;
}

function updateStats(stats) {
    if (!stats) return;
    const map = {
        siteUsersTotal: stats.total,
        siteUsersActive: stats.active,
        siteUsersBlocked: stats.blocked,
        siteUsersLast24h: stats.last24h,
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
    });
}

function updatePagination(pagination) {
    const el = document.getElementById('siteUsersPagination');
    if (!el || !pagination) {
        if (el) el.innerHTML = '';
        return;
    }
    const { page, pages, total } = pagination;
    el.innerHTML = `
        <span class="site-users-page-info">Стр. ${page} из ${pages} · всего ${total}</span>
        <button type="button" class="btn btn-secondary site-users-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
        <button type="button" class="btn btn-secondary site-users-page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

function renderTable(rows) {
    const tbody = document.getElementById('siteUsersTableBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет пользователей</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((row) => {
        const statusClass = row.is_active ? 'active' : 'blocked';
        const statusLabel = row.is_active ? 'Активен' : 'Заблокирован';
        const toggleLabel = row.is_active ? 'Заблокировать' : 'Разблокировать';
        const toggleIcon = row.is_active ? 'fa-ban' : 'fa-check';
        const toggleClass = row.is_active ? 'btn-hide' : 'btn-restore';

        return `<tr>
            <td>${escapeHtml(String(row.id))}</td>
            <td><code>${escapeHtml(row.username)}</code></td>
            <td>${escapeHtml(row.email)}</td>
            <td><span class="site-user-provider-badge">${escapeHtml(row.auth_label || row.auth_provider)}</span></td>
            <td>${escapeHtml(row.linked_label || '—')}</td>
            <td><span class="site-user-status-badge ${statusClass}">${statusLabel}</span></td>
            <td>${formatDate(row.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button type="button" class="action-btn ${toggleClass}" data-id="${row.id}" data-active="${row.is_active ? '1' : '0'}" title="${toggleLabel}">
                        <i class="fas ${toggleIcon}"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function loadSiteUsers(page = currentPage) {
    currentPage = page;
    const q = (document.getElementById('siteUsersSearch')?.value || '').trim();
    const provider = document.getElementById('siteUsersProvider')?.value || '';
    const active = document.getElementById('siteUsersActive')?.value || '';

    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (provider) params.set('provider', provider);
    if (active !== '') params.set('active', active);

    try {
        const res = await fetch(`/admin/ajax/get_site_users.php?${params.toString()}`);
        const data = await res.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка загрузки', 'error');
            return;
        }
        renderTable(data.data || []);
        updateStats(data.stats);
        updatePagination(data.pagination);
    } catch (e) {
        showNotification('Ошибка сети', 'error');
    }
}

async function toggleUserActive(id, currentlyActive) {
    const nextActive = !currentlyActive;
    const action = nextActive ? 'разблокировать' : 'заблокировать';
    if (!confirm(`Вы уверены, что хотите ${action} пользователя #${id}?`)) return;

    try {
        const res = await fetch('/admin/ajax/site_user_set_active.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: adminPostBody({ id: String(id), is_active: nextActive ? '1' : '0' }),
        });
        const data = await res.json();
        if (!data.success) {
            showNotification(data.error || 'Ошибка', 'error');
            return;
        }
        showNotification(nextActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
        updateStats(data.stats);
        loadSiteUsers(currentPage);
    } catch (e) {
        showNotification('Ошибка сети', 'error');
    }
}

function bindEvents() {
    document.getElementById('siteUsersSearch')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadSiteUsers(1), 250);
    });
    document.getElementById('siteUsersProvider')?.addEventListener('change', () => loadSiteUsers(1));
    document.getElementById('siteUsersActive')?.addEventListener('change', () => loadSiteUsers(1));
    document.getElementById('siteUsersResetFilters')?.addEventListener('click', () => {
        const search = document.getElementById('siteUsersSearch');
        const provider = document.getElementById('siteUsersProvider');
        const active = document.getElementById('siteUsersActive');
        if (search) search.value = '';
        if (provider) provider.value = '';
        if (active) active.value = '';
        loadSiteUsers(1);
    });
    document.getElementById('siteUsersPagination')?.addEventListener('click', (event) => {
        const btn = event.target.closest('.site-users-page-btn');
        if (!btn || btn.disabled) return;
        const page = Number(btn.getAttribute('data-page'));
        if (Number.isFinite(page) && page >= 1) loadSiteUsers(page);
    });
    document.getElementById('siteUsersTableBody')?.addEventListener('click', (event) => {
        const btn = event.target.closest('.action-btn[data-id]');
        if (!btn) return;
        const id = Number(btn.getAttribute('data-id'));
        const active = btn.getAttribute('data-active') === '1';
        if (id > 0) toggleUserActive(id, active);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadSiteUsers(1);
});
