(() => {
    const isLocalAccount = window.ABS_PROFILE_IS_LOCAL === true;
    const newInput = document.getElementById('profile_new_password');
    const confirmInput = document.getElementById('profile_new_password_confirm');
    const matchHint = document.getElementById('profilePasswordMatchHint');

    if (!isLocalAccount || !newInput || !confirmInput) {
        return;
    }

    function currentLang() {
        if (window.AbsProfileI18n && typeof window.AbsProfileI18n.getLang === 'function') {
            return window.AbsProfileI18n.getLang();
        }
        if (window.ABS_PROFILE_LANG === 'en' || document.documentElement.lang === 'en' || window.ABS_LANG === 'en') {
            return 'en';
        }
        return 'ru';
    }

    function mismatchText() {
        return currentLang() === 'en'
            ? 'New password and confirmation do not match.'
            : 'Новый пароль и подтверждение не совпадают.';
    }

    function updateMatchHint() {
        if (!matchHint) return;
        const confirmValue = String(confirmInput.value || '');
        if (!confirmValue) {
            matchHint.hidden = true;
            matchHint.textContent = '';
            return;
        }
        if (newInput.value !== confirmValue) {
            matchHint.hidden = false;
            matchHint.textContent = mismatchText();
            matchHint.className = 'auth-password-match auth-password-match--error';
            return;
        }
        matchHint.hidden = true;
        matchHint.textContent = '';
    }

    newInput.addEventListener('input', updateMatchHint);
    confirmInput.addEventListener('input', updateMatchHint);

    window.addEventListener('profile:langchange', updateMatchHint);
})();
