(() => {
    const lang = window.ABS_LANG === 'en' ? 'en' : 'ru';
    const labels = {
        show: lang === 'en' ? 'Show password' : 'Показать пароль',
        hide: lang === 'en' ? 'Hide password' : 'Скрыть пароль',
    };

    document.querySelectorAll('.auth-password-wrap').forEach((wrap) => {
        const input = wrap.querySelector('input');
        const btn = wrap.querySelector('.auth-password-toggle');
        if (!input || !btn) return;

        const icon = btn.querySelector('i');

        if (input.disabled) {
            btn.disabled = true;
        }

        btn.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            btn.setAttribute('aria-pressed', visible ? 'false' : 'true');
            btn.setAttribute('aria-label', visible ? labels.show : labels.hide);
            if (icon) {
                icon.classList.toggle('fa-eye', visible);
                icon.classList.toggle('fa-eye-slash', !visible);
            }
        });
    });
})();
