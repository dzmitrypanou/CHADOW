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

document.getElementById('dashboardPasswordForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newPass = (fd.get('new_password') || '').toString();
    const confirm = (fd.get('new_password_confirm') || '').toString();

    if (newPass !== confirm) {
        showNotification('Новый пароль и подтверждение не совпадают', 'error');
        return;
    }

    try {
        const r = await fetch('/admin/ajax/profile_password.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (data.success) {
            showNotification('Пароль успешно изменён');
            e.target.reset();
        } else {
            showNotification(data.error || 'Ошибка', 'error');
        }
    } catch (err) {
        showNotification('Ошибка сети', 'error');
    }
});

document.getElementById('siteSettingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const checkbox = document.getElementById('replay_storage_enabled');
    fd.set('replay_storage_enabled', checkbox && checkbox.checked ? '1' : '0');

    try {
        const r = await fetch('/admin/ajax/site_settings_save.php', { method: 'POST', body: fd });
        const data = await r.json();
        if (data.success) {
            if (checkbox) checkbox.checked = data.replay_storage_enabled === true;
            const siteNameRu = document.getElementById('site_name_ru');
            const siteNameEn = document.getElementById('site_name_en');
            const wgApplicationId = document.getElementById('wg_application_id');
            const lestaApplicationId = document.getElementById('lesta_application_id');
            if (siteNameRu && typeof data.site_name_ru === 'string') siteNameRu.value = data.site_name_ru;
            if (siteNameEn && typeof data.site_name_en === 'string') siteNameEn.value = data.site_name_en;
            if (wgApplicationId && typeof data.wg_application_id === 'string') wgApplicationId.value = data.wg_application_id;
            if (lestaApplicationId && typeof data.lesta_application_id === 'string') lestaApplicationId.value = data.lesta_application_id;
            const seoGoogleVerification = document.getElementById('seo_google_verification');
            const seoYandexVerification = document.getElementById('seo_yandex_verification');
            if (seoGoogleVerification && typeof data.seo_google_verification === 'string') seoGoogleVerification.value = data.seo_google_verification;
            if (seoYandexVerification && typeof data.seo_yandex_verification === 'string') seoYandexVerification.value = data.seo_yandex_verification;
            showNotification('Настройки сайта сохранены');
        } else {
            showNotification(data.error || 'Ошибка', 'error');
        }
    } catch (err) {
        showNotification('Ошибка сети', 'error');
    }
});
