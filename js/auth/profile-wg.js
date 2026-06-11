(() => {
    function currentLang() {
        if (window.AbsProfileI18n && typeof window.AbsProfileI18n.getLang === 'function') {
            return window.AbsProfileI18n.getLang();
        }
        return window.ABS_PROFILE_LANG === 'en' ? 'en' : 'ru';
    }

    const csrf = window.ABS_PROFILE_CSRF || '';
    const apiUrl = window.ABS_PROFILE_UNLINK_WG_API || '/api/auth/unlink_wg.php';
    const showToast = window.showProfileToast || ((message) => window.alert(message));

    document.querySelectorAll('.profile-linking__unlink[data-game-api-provider]').forEach((unlinkBtn) => {
        unlinkBtn.addEventListener('click', async () => {
            const provider = unlinkBtn.dataset.gameApiProvider || 'wg';
            const lang = currentLang();
            const confirmMsg = provider === 'lesta'
                ? (lang === 'en'
                    ? 'Unlink the Lesta nickname from this profile?'
                    : 'Отвязать ник Lesta от этого профиля?')
                : (lang === 'en'
                    ? 'Unlink the Wargaming nickname from this profile?'
                    : 'Отвязать ник Wargaming от этого профиля?');
            if (!window.confirm(confirmMsg)) return;

            const originalHtml = unlinkBtn.innerHTML;
            unlinkBtn.disabled = true;
            unlinkBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';

            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-Token': csrf,
                    },
                    body: JSON.stringify({ csrf_token: csrf, provider }),
                });
                const json = await res.json();
                if (!json.success) {
                    throw new Error(json.error || (lang === 'en' ? 'Could not unlink.' : 'Не удалось отвязать.'));
                }
                showToast(json.message || (lang === 'en' ? 'Unlinked.' : 'Отвязано.'), 'success');
                window.setTimeout(() => window.location.reload(), 700);
            } catch (err) {
                showToast(err.message, 'error');
                unlinkBtn.disabled = false;
                unlinkBtn.innerHTML = originalHtml;
            }
        });
    });

    const params = new URLSearchParams(window.location.search);
    const wgLinked = params.get('wg_linked');
    const wgError = params.get('wg_error');
    const lang = currentLang();
    if (wgLinked === '1') {
        showToast(lang === 'en' ? 'Game nickname linked.' : 'Игровой ник привязан.', 'success');
        params.delete('wg_linked');
    } else if (wgError) {
        showToast(wgError, 'error');
        params.delete('wg_error');
    }
    if (wgLinked === '1' || wgError) {
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', next);
    }
})();
