function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();
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

function openUserModal(user) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const idEl = document.getElementById('user_id');
    const pw = document.getElementById('user_password');
    const hint = document.getElementById('user_password_hint');

    document.getElementById('userForm').reset();
    if (user && user.id) {
        title.innerHTML = '<i class="fas fa-edit"></i> Редактировать пользователя';
        idEl.value = String(user.id);
        document.getElementById('user_username').value = user.username || '';
        document.getElementById('user_role').value = user.role === 'admin' ? 'admin' : 'user';
        pw.required = false;
        pw.placeholder = 'Оставьте пустым, чтобы не менять';
        if (hint) hint.style.display = 'block';
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Новый пользователь';
        idEl.value = '';
        pw.required = true;
        pw.placeholder = 'Не менее 8 символов';
        if (hint) hint.style.display = 'block';
    }
    modal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
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
    if (token) {
        body.set('csrf_token', token);
    }
    return body;
}

async function adminPostJson(url, fields) {
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: adminPostBody(fields),
    });
    const data = await r.json().catch(() => null);
    if (!data) {
        throw new Error(`Ошибка сервера (${r.status})`);
    }
    return data;
}

async function deleteUser(id, username) {
    if (!confirm(`Удалить пользователя «${username}»?`)) return;
    try {
        const data = await adminPostJson('/admin/ajax/users_delete.php', { id: String(id) });
        if (data.success) {
            showNotification('Пользователь удалён');
            window.location.reload();
        } else {
            showNotification(data.error || 'Ошибка', 'error');
        }
    } catch (e) {
        showNotification(e.message || 'Ошибка сети', 'error');
    }
}

async function resetUserPassword(id, username) {
    const ok = confirm(`Сбросить пароль для «${username}»?\nБудет создан временный пароль.`);
    if (!ok) return;

    try {
        const data = await adminPostJson('/admin/ajax/users_reset_password.php', { id: String(id) });
        if (!data.success) {
            showNotification(data.error || 'Ошибка', 'error');
            return;
        }

        const tempPassword = String(data.temporary_password || '');
        const message = `Временный пароль для ${data.username || username}: ${tempPassword}`;

        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(tempPassword);
                showNotification('Временный пароль создан и скопирован в буфер обмена', 'success');
            } catch (e) {
                showNotification('Временный пароль создан. Скопируйте его вручную', 'info');
            }
        } else {
            showNotification('Временный пароль создан. Скопируйте его вручную', 'info');
        }

        window.prompt('Сохраните временный пароль и передайте пользователю:', message);
    } catch (e) {
        showNotification(e.message || 'Ошибка сети', 'error');
    }
}

document.getElementById('userForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const fields = Object.fromEntries(fd.entries());
    if (!fields.id) {
        delete fields.id;
    }
    try {
        const data = await adminPostJson('/admin/ajax/users_save.php', fields);
        if (data.success) {
            showNotification('Сохранено');
            closeUserModal();
            window.location.reload();
        } else {
            showNotification(data.error || 'Ошибка', 'error');
        }
    } catch (err) {
        showNotification(err.message || 'Ошибка сети', 'error');
    }
});

document.getElementById('userModal')?.addEventListener('click', e => {
    if (e.target.id === 'userModal') closeUserModal();
});
