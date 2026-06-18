(() => {
    'use strict';

    const csrf = window.ABS_RESERVES_CSRF || '';
    const apiUrl = window.ABS_RESERVES_UNLINK_API || '/api/reserves/unlink.php';
    const showToast = window.showProfileToast || window.showSiteToast || ((message) => {
        if (window.AbsTacticsConfirm?.alert) {
            window.AbsTacticsConfirm.alert(message);
            return;
        }
        window.alert(message);
    });

    function t(key) {
        if (window.AbsReservesI18n && typeof window.AbsReservesI18n.t === 'function') {
            return window.AbsReservesI18n.t(key);
        }
        return '';
    }

    function currentLang() {
        if (window.AbsReservesI18n && typeof window.AbsReservesI18n.getLang === 'function') {
            return window.AbsReservesI18n.getLang();
        }
        return window.ABS_RESERVES_LANG === 'en' ? 'en' : 'ru';
    }

    async function confirmUnlink() {
        const message = t('unlinkConfirm');
        const options = {
            title: t('dialogConfirmTitle'),
            confirmText: t('dialogConfirm'),
            cancelText: t('dialogCancel'),
        };

        if (window.AbsTacticsConfirm?.confirm) {
            return window.AbsTacticsConfirm.confirm(message, options);
        }

        return window.confirm(message);
    }

    document.querySelectorAll('.reserves-linking__unlink[data-reserve-link-id]').forEach((unlinkBtn) => {
        unlinkBtn.addEventListener('click', async () => {
            const linkId = Number(unlinkBtn.dataset.reserveLinkId || 0);
            if (!linkId || !(await confirmUnlink())) return;

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
                    body: JSON.stringify({ csrf_token: csrf, link_id: linkId }),
                });
                const json = await res.json();
                if (!json.success) {
                    throw new Error(json.error || t('unlinkError'));
                }
                showToast(json.message || t('unlinkSuccess'), 'success');
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
    const linkIdFromUrl = Number(params.get('link_id') || 0);

    if (wgLinked === '1') {
        showToast(t('accountLinked'), 'success');
        params.delete('wg_linked');
        params.delete('link_id');
    } else if (wgLinked === 'exists') {
        showToast(t('accountAlreadyLinked'), 'info');
        params.delete('wg_linked');
        if (linkIdFromUrl > 0) {
            params.set('link_id', String(linkIdFromUrl));
        } else {
            params.delete('link_id');
        }
    } else if (wgError) {
        showToast(wgError, 'error');
        params.delete('wg_error');
    }
    if (wgLinked === '1' || wgLinked === 'exists' || wgError) {
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', next);
        if (wgLinked === '1') {
            window.setTimeout(() => window.location.reload(), 700);
        }
    }
})();
