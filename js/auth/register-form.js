(() => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const password = form.querySelector('#password');
    const confirm = form.querySelector('#password_confirm');
    const hint = document.getElementById('passwordMatchHint');
    if (!password || !confirm || !hint) return;

    const lang = window.ABS_LANG === 'en' ? 'en' : 'ru';
    const mismatchMsg = lang === 'en' ? 'Passwords do not match' : 'Пароли не совпадают';

    function validateMatch(showHint) {
        const confirmValue = confirm.value;

        if (confirmValue === '') {
            confirm.setCustomValidity('');
            hint.hidden = true;
            confirm.classList.remove('auth-input--invalid');
            return true;
        }

        if (password.value !== confirmValue) {
            confirm.setCustomValidity(mismatchMsg);
            if (showHint) {
                hint.textContent = mismatchMsg;
                hint.className = 'auth-password-match auth-password-match--error';
                hint.hidden = false;
                confirm.classList.add('auth-input--invalid');
            }
            return false;
        }

        confirm.setCustomValidity('');
        hint.hidden = true;
        confirm.classList.remove('auth-input--invalid');
        return true;
    }

    password.addEventListener('input', () => {
        validateMatch(confirm.value !== '');
    });

    confirm.addEventListener('input', () => {
        validateMatch(true);
    });

    confirm.addEventListener('blur', () => {
        validateMatch(true);
    });

    form.addEventListener('submit', (e) => {
        if (!validateMatch(true)) {
            e.preventDefault();
            confirm.reportValidity();
            confirm.focus();
        }
    });
})();
