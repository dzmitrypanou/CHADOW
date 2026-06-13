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
            ['mc_wg_application_id', 'wg_application_id'],
            ['mc_lesta_application_id', 'lesta_application_id'],
            ['mc_launcher_version', 'launcher_version'],
        ];
        for (const [id, key] of fields) {
            const el = document.getElementById(id);
            if (el && settings[key] !== undefined && settings[key] !== null) {
                el.value = String(settings[key]);
            }
        }
        showNotification('Настройки Minecraft сохранены');
    } catch (err) {
        showNotification('Ошибка сети', 'error');
    }
});
