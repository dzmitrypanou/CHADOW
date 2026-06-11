let allBrackets = [];

const BRACKET_STATUS_LABELS = {
    active: 'Активна',
    hidden: 'Скрыта',
};

function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    let icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
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

function updateBracketsStats(stats) {
    if (!stats) return;
    const map = {
        bracketsTotalCount: stats.total,
        bracketsActiveCount: stats.active,
        bracketsHiddenCount: stats.hidden,
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
    });
}

function getFilteredBrackets() {
    const q = (document.getElementById('bracketsSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('bracketsStatus')?.value || '';
    const visibility = document.getElementById('bracketsVisibility')?.value || '';

    let rows = allBrackets;

    if (status) {
        rows = rows.filter((b) => b.status === status);
    }
    if (visibility) {
        rows = rows.filter((b) => b.visibility === visibility);
    }
    if (q) {
        rows = rows.filter((b) =>
            (b.title || '').toLowerCase().includes(q)
            || (b.username || '').toLowerCase().includes(q)
            || (b.public_id || '').toLowerCase().includes(q)
        );
    }

    return rows;
}

function renderBracketsTable() {
    const tbody = document.getElementById('bracketsTableBody');
    if (!tbody) return;

    const rows = getFilteredBrackets();
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Нет сеток</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((b) => {
        const author = b.user_id
            ? escapeHtml(b.username || b.email || `User #${b.user_id}`)
            : '<span style="color:#9aa5b1;">Гость</span>';
        const statusClass = b.status === 'active' ? 'active' : 'hidden';

        let actions = '';
        if (b.status === 'active') {
            actions += `<button type="button" class="action-btn btn-hide" data-id="${b.id}" title="Скрыть"><i class="fas fa-eye-slash"></i></button>`;
        } else {
            actions += `<button type="button" class="action-btn btn-restore" data-id="${b.id}" title="Восстановить"><i class="fas fa-eye"></i></button>`;
        }
        actions += `<a href="${escapeHtml(b.view_url)}" class="action-btn" target="_blank" rel="noopener" title="Просмотр"><i class="fas fa-external-link-alt"></i></a>`;
        actions += `<button type="button" class="action-btn btn-delete" data-id="${b.id}" title="Удалить"><i class="fas fa-trash"></i></button>`;

        return `<tr>
            <td><code>${escapeHtml(b.public_id)}</code></td>
            <td>${escapeHtml(b.title)}</td>
            <td>${escapeHtml(b.format_label)}</td>
            <td><span class="bracket-vis-badge">${escapeHtml(b.visibility_label)}</span></td>
            <td><span class="bracket-status-badge ${statusClass}">${escapeHtml(BRACKET_STATUS_LABELS[b.status] || b.status)}</span></td>
            <td>${author}</td>
            <td>${formatDate(b.updated_at)}</td>
            <td><div class="action-buttons">${actions}</div></td>
        </tr>`;
    }).join('');
}

async function loadBrackets() {
    try {
        const res = await fetch('/admin/ajax/get_brackets.php');
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка загрузки', 'error');
            return;
        }
        allBrackets = json.data || [];
        updateBracketsStats(json.stats);
        renderBracketsTable();
    } catch (e) {
        showNotification('Ошибка загрузки', 'error');
    }
}

async function moderateBracket(id, status) {
    let note = '';
    if (status === 'hidden') {
        note = prompt('Примечание (необязательно):') || '';
    }

    const formData = new FormData();
    formData.append('id', String(id));
    formData.append('status', status);
    if (note) formData.append('note', note);

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        formData.append('csrf_token', csrfMeta.getAttribute('content'));
    }

    try {
        const res = await fetch('/admin/ajax/bracket_moderate.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification(status === 'active' ? 'Сетка восстановлена' : 'Сетка скрыта');
        loadBrackets();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

async function deleteBracket(id) {
    if (!confirm('Удалить сетку без возможности восстановления?')) return;

    const formData = new FormData();
    formData.append('id', String(id));
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        formData.append('csrf_token', csrfMeta.getAttribute('content'));
    }

    try {
        const res = await fetch('/admin/ajax/bracket_delete.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification('Сетка удалена');
        loadBrackets();
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadBrackets();

    document.getElementById('bracketsSearch')?.addEventListener('input', renderBracketsTable);
    document.getElementById('bracketsStatus')?.addEventListener('change', renderBracketsTable);
    document.getElementById('bracketsVisibility')?.addEventListener('change', renderBracketsTable);
    document.getElementById('bracketsResetFilters')?.addEventListener('click', () => {
        const search = document.getElementById('bracketsSearch');
        const status = document.getElementById('bracketsStatus');
        const visibility = document.getElementById('bracketsVisibility');
        if (search) search.value = '';
        if (status) status.value = '';
        if (visibility) visibility.value = '';
        renderBracketsTable();
    });

    document.getElementById('bracketsTableBody')?.addEventListener('click', (e) => {
        const hideBtn = e.target.closest('.btn-hide');
        if (hideBtn) {
            moderateBracket(parseInt(hideBtn.dataset.id, 10), 'hidden');
            return;
        }
        const restoreBtn = e.target.closest('.btn-restore');
        if (restoreBtn) {
            moderateBracket(parseInt(restoreBtn.dataset.id, 10), 'active');
            return;
        }
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            deleteBracket(parseInt(deleteBtn.dataset.id, 10));
        }
    });
});
