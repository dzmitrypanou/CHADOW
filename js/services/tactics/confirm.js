(() => {
    'use strict';

    const i18n = () => window.AbsTacticsI18n || window.AbsCheckersI18n;

    let modalEl = null;
    let titleEl = null;
    let messageEl = null;
    let actionsConfirmEl = null;
    let actionsAlertEl = null;
    let confirmBtn = null;
    let cancelBtn = null;
    let alertOkBtn = null;
    let backdropEl = null;
    let dialogEl = null;

    let activeMode = 'confirm';
    let activeResolve = null;
    let keydownHandler = null;

    function t(key, fallback) {
        try {
            return i18n()?.t(key) || fallback;
        } catch (err) {
            return fallback;
        }
    }

    function ensureModal() {
        if (modalEl) return;

        modalEl = document.getElementById('tacticsConfirmModal');
        if (modalEl) {
            titleEl = modalEl.querySelector('[data-tactics-confirm-title]');
            messageEl = modalEl.querySelector('[data-tactics-confirm-message]');
            actionsConfirmEl = modalEl.querySelector('[data-tactics-confirm-actions]');
            actionsAlertEl = modalEl.querySelector('[data-tactics-confirm-actions-alert]');
            confirmBtn = modalEl.querySelector('[data-tactics-confirm-ok]');
            cancelBtn = modalEl.querySelector('button[data-tactics-confirm-cancel]');
            alertOkBtn = modalEl.querySelector('[data-tactics-confirm-alert-ok]');
            backdropEl = modalEl.querySelector('[data-tactics-confirm-backdrop]');
            dialogEl = modalEl.querySelector('.tactics-confirm__dialog');
        } else {
            modalEl = document.createElement('div');
            modalEl.id = 'tacticsConfirmModal';
            modalEl.className = 'tactics-confirm';
            modalEl.hidden = true;
            modalEl.innerHTML = ''
                + '<div class="tactics-confirm__backdrop" data-tactics-confirm-backdrop tabindex="-1" aria-hidden="true"></div>'
                + '<div class="tactics-confirm__dialog" role="alertdialog" aria-modal="true" aria-labelledby="tacticsConfirmTitle" aria-describedby="tacticsConfirmMessage">'
                + '<h2 class="tactics-confirm__title" id="tacticsConfirmTitle" data-tactics-confirm-title></h2>'
                + '<p class="tactics-confirm__message" id="tacticsConfirmMessage" data-tactics-confirm-message></p>'
                + '<div class="tactics-confirm__actions" data-tactics-confirm-actions>'
                + '<button type="button" class="tactics-confirm__btn tactics-confirm__btn--ghost" data-tactics-confirm-cancel></button>'
                + '<button type="button" class="tactics-confirm__btn tactics-confirm__btn--primary" data-tactics-confirm-ok></button>'
                + '</div>'
                + '<div class="tactics-confirm__actions" data-tactics-confirm-actions-alert hidden>'
                + '<button type="button" class="tactics-confirm__btn tactics-confirm__btn--primary" data-tactics-confirm-alert-ok></button>'
                + '</div>'
                + '</div>';
            document.body.appendChild(modalEl);

            titleEl = modalEl.querySelector('[data-tactics-confirm-title]');
            messageEl = modalEl.querySelector('[data-tactics-confirm-message]');
            actionsConfirmEl = modalEl.querySelector('[data-tactics-confirm-actions]');
            actionsAlertEl = modalEl.querySelector('[data-tactics-confirm-actions-alert]');
            confirmBtn = modalEl.querySelector('[data-tactics-confirm-ok]');
            cancelBtn = modalEl.querySelector('button[data-tactics-confirm-cancel]');
            alertOkBtn = modalEl.querySelector('[data-tactics-confirm-alert-ok]');
            backdropEl = modalEl.querySelector('[data-tactics-confirm-backdrop]');
            dialogEl = modalEl.querySelector('.tactics-confirm__dialog');
        }

        if (modalEl.dataset.bound === '1') return;
        modalEl.dataset.bound = '1';

        relocalizeButtons();

        cancelBtn?.addEventListener('click', () => close(false));
        backdropEl?.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        alertOkBtn.addEventListener('click', () => close(true));
    }

    function relocalizeButtons(options = {}) {
        if (!modalEl) return;
        if (cancelBtn) {
            cancelBtn.textContent = options.cancelText || t('dialogCancel', 'Отмена');
        }
        if (confirmBtn) {
            confirmBtn.textContent = options.confirmText || t('dialogConfirm', 'Подтвердить');
        }
        if (alertOkBtn) {
            alertOkBtn.textContent = options.alertOkText || t('dialogOk', 'OK');
        }
    }

    function relocalize() {
        relocalizeButtons();
    }

    function detachKeydown() {
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler, true);
            keydownHandler = null;
        }
    }

    function close(result) {
        if (!activeResolve) return;

        const resolve = activeResolve;
        activeResolve = null;
        detachKeydown();

        modalEl.hidden = true;
        document.body.classList.remove('tactics-confirm-open');
        resolve(!!result);
    }

    function open(options = {}) {
        ensureModal();
        relocalize();

        if (activeResolve) {
            activeResolve(false);
            activeResolve = null;
            detachKeydown();
        }

        activeMode = options.mode === 'alert' ? 'alert' : 'confirm';
        const isAlert = activeMode === 'alert';

        titleEl.textContent = options.title
            || (isAlert ? t('dialogAlertTitle', 'Уведомление') : t('dialogConfirmTitle', 'Подтвердите действие'));
        messageEl.textContent = String(options.message || '');
        relocalizeButtons(options);

        actionsConfirmEl.hidden = isAlert;
        actionsAlertEl.hidden = !isAlert;

        modalEl.hidden = false;
        document.body.classList.add('tactics-confirm-open');

        keydownHandler = (ev) => {
            if (modalEl.hidden) return;
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                close(isAlert);
                return;
            }
            if (ev.key === 'Enter') {
                ev.preventDefault();
                ev.stopPropagation();
                close(true);
            }
        };
        document.addEventListener('keydown', keydownHandler, true);

        const focusTarget = isAlert ? alertOkBtn : confirmBtn;
        requestAnimationFrame(() => focusTarget?.focus());

        return new Promise((resolve) => {
            activeResolve = resolve;
        });
    }

    window.AbsTacticsConfirm = {
        confirm(message, options = {}) {
            return open({ ...options, message, mode: 'confirm' });
        },
        alert(message, options = {}) {
            return open({ ...options, message, mode: 'alert' }).then(() => {});
        },
        relocalize,
    };

    window.addEventListener('tactics:langchange', () => relocalize());
    window.addEventListener('checkers:langchange', () => relocalize());
})();
