let currentPage = 1;
let currentView = 'all';
let trainersMeta = [];

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

function trainerTitle(id) {
    const found = trainersMeta.find((t) => t.id === id);
    return found ? found.title : id;
}

function deviceLabel(device) {
    return device === 'mobile' ? 'Телефон' : 'ПК';
}

function updateStats(stats) {
    if (!stats) return;
    const map = {
        aimScoresTotal: stats.total,
        aimLeaderboardSlots: stats.leaderboard_slots,
        aimScoresLast24h: stats.last24h,
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
    });
}

function updatePagination(pagination) {
    const el = document.getElementById('aimScoresPagination');
    if (!el || !pagination) {
        if (el) el.innerHTML = '';
        return;
    }
    const { page, pages, total } = pagination;
    el.innerHTML = `
        <span class="aim-scores-page-info">Стр. ${page} из ${pages} · всего ${total}</span>
        <button type="button" class="btn btn-secondary aim-scores-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
        <button type="button" class="btn btn-secondary aim-scores-page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

function renderTable(rows, view) {
    const tbody = document.getElementById('aimScoresTableBody');
    const rankHead = document.getElementById('aimScoresRankHead');
    if (!tbody) return;

    if (rankHead) {
        rankHead.hidden = view !== 'leaderboard';
    }

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((row) => {
        const user = row.user_id ? `User #${row.user_id}` : '<span style="color:#9aa5b1;">Гость</span>';
        const rankCell = view === 'leaderboard'
            ? `<td>${escapeHtml(String(row.rank || '—'))}</td>`
            : '';
        const ratingsUrl = `/services/aim/ratings?trainer=${encodeURIComponent(row.trainer)}&device=${encodeURIComponent(row.device)}`;

        return `<tr>
            ${rankCell}
            <td>${escapeHtml(trainerTitle(row.trainer))}</td>
            <td>${escapeHtml(deviceLabel(row.device))}</td>
            <td><strong>${escapeHtml(row.player_name)}</strong></td>
            <td>${escapeHtml(String(row.score))}</td>
            <td><span class="aim-grade-badge">${escapeHtml(row.grade)}</span></td>
            <td>${user}</td>
            <td>${formatDate(row.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <a href="${escapeHtml(ratingsUrl)}" class="action-btn" target="_blank" rel="noopener" title="Топ на сайте"><i class="fas fa-external-link-alt"></i></a>
                    <button type="button" class="action-btn btn-purge-player" data-trainer="${escapeHtml(row.trainer)}" data-device="${escapeHtml(row.device)}" data-player="${escapeHtml(row.player_name)}" title="Удалить все результаты игрока"><i class="fas fa-user-slash"></i></button>
                    <button type="button" class="action-btn btn-delete" data-id="${row.id}" title="Удалить запись"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function loadScores(page = currentPage) {
    currentPage = Math.max(1, page);
    const search = document.getElementById('aimScoresSearch')?.value || '';
    const trainer = document.getElementById('aimScoresTrainer')?.value || '';
    const device = document.getElementById('aimScoresDevice')?.value || '';
    const view = document.getElementById('aimScoresView')?.value || 'all';
    currentView = view;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('view', view);
    if (search) params.set('q', search);
    if (trainer) params.set('trainer', trainer);
    if (device) params.set('device', device);

    try {
        const res = await fetch('/admin/ajax/get_aim_scores.php?' + params.toString());
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка загрузки', 'error');
            return;
        }
        if (Array.isArray(json.trainers)) {
            trainersMeta = json.trainers;
        }
        updateStats(json.stats);
        renderTable(json.data || [], json.view || view);
        updatePagination(json.pagination);
    } catch (e) {
        showNotification('Ошибка загрузки', 'error');
    }
}

function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

async function deleteScore(id) {
    if (!confirm('Удалить эту запись из таблицы?')) return;

    const formData = new FormData();
    formData.append('id', String(id));
    formData.append('csrf_token', getCsrfToken());

    try {
        const res = await fetch('/admin/ajax/aim_score_delete.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification('Запись удалена');
        loadScores(currentPage);
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

async function purgePlayer(trainer, device, playerName) {
    const label = `${playerName} (${trainerTitle(trainer)}, ${deviceLabel(device)})`;
    if (!confirm(`Удалить все результаты игрока ${label}?`)) return;

    const formData = new FormData();
    formData.append('trainer', trainer);
    formData.append('device', device);
    formData.append('player_name', playerName);
    formData.append('csrf_token', getCsrfToken());

    try {
        const res = await fetch('/admin/ajax/aim_player_scores_delete.php', { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) {
            showNotification(json.error || 'Ошибка', 'error');
            return;
        }
        showNotification(`Удалено записей: ${json.deleted || 0}`);
        loadScores(1);
    } catch (e) {
        showNotification('Ошибка сервера', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadScores(1);

    let searchTimer = null;
    document.getElementById('aimScoresSearch')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadScores(1), 300);
    });
    document.getElementById('aimScoresTrainer')?.addEventListener('change', () => loadScores(1));
    document.getElementById('aimScoresDevice')?.addEventListener('change', () => loadScores(1));
    document.getElementById('aimScoresView')?.addEventListener('change', () => loadScores(1));
    document.getElementById('aimScoresResetFilters')?.addEventListener('click', () => {
        const search = document.getElementById('aimScoresSearch');
        const trainer = document.getElementById('aimScoresTrainer');
        const device = document.getElementById('aimScoresDevice');
        const view = document.getElementById('aimScoresView');
        if (search) search.value = '';
        if (trainer) trainer.value = '';
        if (device) device.value = '';
        if (view) view.value = 'all';
        loadScores(1);
    });

    document.getElementById('aimScoresPagination')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.aim-scores-page-btn');
        if (!btn || btn.disabled) return;
        const page = parseInt(btn.dataset.page, 10);
        if (Number.isFinite(page)) loadScores(page);
    });

    document.getElementById('aimScoresTableBody')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            deleteScore(parseInt(deleteBtn.dataset.id, 10));
            return;
        }
        const purgeBtn = e.target.closest('.btn-purge-player');
        if (purgeBtn) {
            purgePlayer(
                purgeBtn.dataset.trainer || '',
                purgeBtn.dataset.device || 'desktop',
                purgeBtn.dataset.player || '',
            );
        }
    });
});
