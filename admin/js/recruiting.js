let allRecruitingPosts = [];
let viewRecruitingId = null;

const RECRUITING_STATUS_LABELS = {
    pending: 'На модерации',
    approved: 'Опубликовано',
    rejected: 'Отклонено',
    hidden: 'Скрыто',
};

const RECRUITING_STATUS_ICONS = {
    pending: 'clock',
    approved: 'check-circle',
    rejected: 'times-circle',
    hidden: 'eye-slash',
};

function formatRecruitingContacts(contactRaw) {
    if (!contactRaw) return '';
    let items = [];
    const raw = String(contactRaw).trim();
    if (raw.startsWith('[')) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) items = parsed;
        } catch (e) {
            items = [];
        }
    }
    if (items.length === 0 && raw) {
        items = [{ type: 'telegram', value: raw }];
    }
    if (items.length === 0) return '';
    const labels = { vk: 'VK', max: 'MAX', telegram: 'Telegram', viber: 'Viber', discord: 'Discord' };
    return items.map((item) => {
        const type = labels[item.type] || item.type || 'Contact';
        return `${type}: ${item.value || ''}`;
    }).join('<br>');
}

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

function updateRecruitingStats(stats) {
    if (!stats) return;
    const map = {
        recruitingTotalCount: stats.total,
        recruitingPendingCount: stats.pending,
        recruitingApprovedCount: stats.approved,
        recruitingRejectedCount: stats.rejected,
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
    });
}

function getFilteredPosts() {
    const q = (document.getElementById('recruitingSearch')?.value || '').trim().toLowerCase();
    const status = document.getElementById('recruitingStatus')?.value || '';
    const postType = document.getElementById('recruitingPostType')?.value || '';
    const realm = document.getElementById('recruitingRealm')?.value || '';

    let rows = allRecruitingPosts;

    if (status) {
        rows = rows.filter(p => p.status === status);
    }
    if (postType) {
        rows = rows.filter(p => p.post_type === postType);
    }
    if (realm) {
        rows = rows.filter(p => p.realm === realm);
    }
    if (q) {
        rows = rows.filter(p => {
            const hay = [
                p.title,
                p.body,
                p.author,
                p.username,
                p.clan_tag,
                p.post_type_label,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }

    return rows;
}

function renderStatusBadge(post) {
    const status = post.status || 'pending';
    const label = post.status_label || RECRUITING_STATUS_LABELS[status] || status;
    const icon = RECRUITING_STATUS_ICONS[status] || 'circle';
    const quickClass = status === 'pending' ? ' js-quick-approve' : '';
    const roleAttr = status === 'pending' ? ' role="button" tabindex="0" title="Быстро одобрить"' : '';
    return `<span class="recruiting-status-badge ${escapeHtml(status)}${quickClass}"${roleAttr}>
        <i class="fas fa-${icon}"></i> ${escapeHtml(label)}
    </span>`;
}

function renderRecruitingTable() {
    const tbody = document.getElementById('recruitingTableBody');
    const rows = getFilteredPosts();

    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align: center;">Нет объявлений</td></tr>';
        return;
    }

    tbody.innerHTML = rows
        .map(post => {
            const dateVal = post.status === 'approved' && post.published_at
                ? post.published_at
                : post.updated_at || post.created_at;
            const canModerate = post.status === 'pending' || post.status === 'approved';
            const canHide = post.status === 'approved';
            return `
        <tr data-id="${post.id}">
            <td><span class="recruiting-type-badge">${escapeHtml(post.post_type_label || post.post_type)}</span></td>
            <td><span class="recruiting-realm-badge">${escapeHtml(post.realm_label || post.realm?.toUpperCase())}</span></td>
            <td class="recruiting-title-cell">${escapeHtml(post.title)}</td>
            <td>${escapeHtml(post.author || post.username || '—')}</td>
            <td>${formatDate(dateVal)}</td>
            <td>${renderStatusBadge(post)}</td>
            <td class="recruiting-actions-cell">
                <div class="action-buttons">
                    <button type="button" class="action-btn js-view-post" title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${canModerate ? `<button type="button" class="action-btn js-approve-post" title="Одобрить">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    ${canModerate ? `<button type="button" class="action-btn js-reject-post" title="Отклонить">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                    ${canHide ? `<button type="button" class="action-btn js-hide-post" title="Скрыть">
                        <i class="fas fa-eye-slash"></i>
                    </button>` : ''}
                    <button type="button" class="action-btn delete js-delete-post" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
        })
        .join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
        const id = parseInt(tr.dataset.id, 10);
        const post = rows.find(p => p.id === id);
        if (!post) return;

        tr.querySelector('.js-view-post')?.addEventListener('click', () => openViewRecruitingModal(post));
        tr.querySelector('.js-approve-post')?.addEventListener('click', () => approvePost(id));
        tr.querySelector('.js-reject-post')?.addEventListener('click', () => openRejectRecruitingModal(id));
        tr.querySelector('.js-hide-post')?.addEventListener('click', () => hidePost(id));
        tr.querySelector('.js-delete-post')?.addEventListener('click', () => deletePost(id));

        const quick = tr.querySelector('.js-quick-approve');
        if (quick) {
            quick.addEventListener('click', () => approvePost(id));
            quick.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    approvePost(id);
                }
            });
        }
    });
}

function findPost(id) {
    return allRecruitingPosts.find(p => p.id === id) || null;
}

function openViewRecruitingModal(post) {
    viewRecruitingId = post.id;
    const meta = document.getElementById('viewRecruitingMeta');
    const body = document.getElementById('viewRecruitingBody');
    const noteWrap = document.getElementById('viewRecruitingNoteWrap');
    const noteEl = document.getElementById('viewRecruitingNote');

    if (meta) {
        meta.innerHTML = `
            <div><dt>Тип</dt><dd>${escapeHtml(post.post_type_label || post.post_type)}</dd></div>
            <div><dt>Регион</dt><dd>${escapeHtml(post.realm_label || post.realm)}</dd></div>
            <div><dt>Заголовок</dt><dd>${escapeHtml(post.title)}</dd></div>
            <div><dt>Автор</dt><dd>${escapeHtml(post.author || post.username)}${post.email ? ` (${escapeHtml(post.email)})` : ''}</dd></div>
            ${post.clan_tag ? `<div><dt>${escapeHtml(post.clan_tag_type === 'team_name' ? 'Название команды' : 'Тег клана')}</dt><dd>${post.clan_tag_href ? `<a href="${escapeHtml(post.clan_tag_href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.clan_tag)}</a>` : escapeHtml(post.clan_tag)}</dd></div>` : ''}
            ${post.contact ? `<div><dt>Контакты</dt><dd>${formatRecruitingContacts(post.contact)}</dd></div>` : ''}
            <div><dt>Статус</dt><dd>${renderStatusBadge(post)}</dd></div>
            <div><dt>Создано</dt><dd>${formatDate(post.created_at)}</dd></div>
            <div><dt>Обновлено</dt><dd>${formatDate(post.updated_at)}</dd></div>
        `;
    }
    if (body) body.textContent = post.body || '';

    if (post.moderation_note) {
        noteWrap.style.display = 'block';
        noteEl.textContent = post.moderation_note;
    } else {
        noteWrap.style.display = 'none';
        noteEl.textContent = '';
    }

    const canModerate = post.status === 'pending' || post.status === 'approved';
    const approveBtn = document.querySelector('#viewRecruitingModal .js-view-approve');
    const rejectBtn = document.querySelector('#viewRecruitingModal .js-view-reject');
    const hideBtn = document.querySelector('#viewRecruitingModal .js-view-hide');

    if (approveBtn) approveBtn.style.display = canModerate ? '' : 'none';
    if (rejectBtn) rejectBtn.style.display = canModerate ? '' : 'none';
    if (hideBtn) hideBtn.style.display = post.status === 'approved' ? '' : 'none';

    document.getElementById('viewRecruitingModal')?.classList.add('active');
}

function closeViewRecruitingModal() {
    viewRecruitingId = null;
    document.getElementById('viewRecruitingModal')?.classList.remove('active');
}

function openRejectRecruitingModal(id) {
    document.getElementById('reject_recruiting_id').value = String(id);
    document.getElementById('reject_recruiting_note').value = '';
    document.getElementById('rejectRecruitingModal')?.classList.add('active');
}

function closeRejectRecruitingModal() {
    document.getElementById('rejectRecruitingModal')?.classList.remove('active');
}

async function moderatePost(id, status, note = '') {
    const fd = new FormData();
    fd.append('id', String(id));
    fd.append('status', status);
    if (note) fd.append('note', note);

    try {
        const response = await fetch('/admin/ajax/recruiting_moderate.php', {
            method: 'POST',
            body: fd,
        });
        const result = await response.json();
        if (result.success) {
            const messages = {
                approved: 'Объявление одобрено',
                rejected: 'Объявление отклонено',
                hidden: 'Объявление скрыто',
            };
            showNotification(messages[status] || 'Сохранено');
            closeViewRecruitingModal();
            closeRejectRecruitingModal();
            await loadRecruiting();
            return true;
        }
        showNotification(result.error || 'Ошибка', 'error');
        return false;
    } catch (e) {
        showNotification('Ошибка сети', 'error');
        return false;
    }
}

async function approvePost(id) {
    const post = findPost(id);
    const title = post ? `"${post.title}"` : '';
    if (!confirm(`Одобрить объявление ${title}?`)) return;
    await moderatePost(id, 'approved');
}

async function hidePost(id) {
    if (!confirm('Скрыть объявление? Оно исчезнет с публичной доски.')) return;
    await moderatePost(id, 'hidden');
}

async function deletePost(id) {
    const post = findPost(id);
    const title = post ? `"${post.title}"` : '';
    if (!confirm(`Удалить объявление ${title}? Это действие необратимо.`)) return;

    const fd = new FormData();
    fd.append('id', String(id));
    try {
        const response = await fetch('/admin/ajax/recruiting_delete.php', {
            method: 'POST',
            body: fd,
        });
        const result = await response.json();
        if (result.success) {
            showNotification('Объявление удалено');
            closeViewRecruitingModal();
            await loadRecruiting();
        } else {
            showNotification(result.error || 'Ошибка удаления', 'error');
        }
    } catch (e) {
        showNotification('Ошибка сети', 'error');
    }
}

async function loadRecruiting() {
    try {
        const response = await fetch('/admin/ajax/get_recruiting.php');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) {
            showNotification('Не удалось загрузить объявления', 'error');
            allRecruitingPosts = [];
        } else {
            allRecruitingPosts = data.data;
            if (data.stats) updateRecruitingStats(data.stats);
        }
        renderRecruitingTable();
    } catch (e) {
        showNotification('Ошибка сети при загрузке', 'error');
        const tbody = document.getElementById('recruitingTableBody');
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="7" style="text-align: center;">Ошибка загрузки</td></tr>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRecruiting();

    const search = document.getElementById('recruitingSearch');
    if (search) search.addEventListener('input', () => renderRecruitingTable());

    ['recruitingStatus', 'recruitingPostType', 'recruitingRealm'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => renderRecruitingTable());
    });

    document.getElementById('recruitingResetFilters')?.addEventListener('click', () => {
        if (search) search.value = '';
        const status = document.getElementById('recruitingStatus');
        const type = document.getElementById('recruitingPostType');
        const realm = document.getElementById('recruitingRealm');
        if (status) status.value = '';
        if (type) type.value = '';
        if (realm) realm.value = '';
        renderRecruitingTable();
    });

    document.querySelector('#viewRecruitingModal .js-view-approve')?.addEventListener('click', () => {
        if (viewRecruitingId) approvePost(viewRecruitingId);
    });
    document.querySelector('#viewRecruitingModal .js-view-reject')?.addEventListener('click', () => {
        if (viewRecruitingId) openRejectRecruitingModal(viewRecruitingId);
    });
    document.querySelector('#viewRecruitingModal .js-view-hide')?.addEventListener('click', () => {
        if (viewRecruitingId) hidePost(viewRecruitingId);
    });

    document.getElementById('rejectRecruitingForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id = parseInt(document.getElementById('reject_recruiting_id').value, 10);
        const note = document.getElementById('reject_recruiting_note').value.trim();
        if (!id || !note) {
            showNotification('Укажите причину отклонения', 'error');
            return;
        }
        await moderatePost(id, 'rejected', note);
    });

    document.getElementById('viewRecruitingModal')?.addEventListener('click', e => {
        if (e.target.id === 'viewRecruitingModal') closeViewRecruitingModal();
    });
    document.getElementById('rejectRecruitingModal')?.addEventListener('click', e => {
        if (e.target.id === 'rejectRecruitingModal') closeRejectRecruitingModal();
    });
});
