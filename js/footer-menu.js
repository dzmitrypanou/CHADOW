(() => {
    const MOBILE_MQ = window.matchMedia('(max-width: 680px)');

    function isMobileFooterMenu() {
        return MOBILE_MQ.matches;
    }

    function closeFooterMenu(wrap, toggle, panel) {
        wrap.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        if (isMobileFooterMenu()) {
            panel.hidden = true;
        } else {
            panel.hidden = false;
        }
    }

    function openFooterMenu(wrap, toggle, panel) {
        wrap.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
    }

    function syncFooterMenuLayout(wrap, toggle, panel) {
        if (isMobileFooterMenu()) {
            panel.hidden = !wrap.classList.contains('is-open');
            return;
        }
        wrap.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        panel.hidden = false;
    }

    function initFooterMenu() {
        const wrap = document.getElementById('siteFooterMenu');
        const toggle = document.getElementById('siteFooterMenuToggle');
        const panel = document.getElementById('siteFooterMenuPanel');
        if (!wrap || !toggle || !panel || toggle.dataset.footerMenuBound === '1') {
            return;
        }
        toggle.dataset.footerMenuBound = '1';

        syncFooterMenuLayout(wrap, toggle, panel);

        toggle.addEventListener('click', (e) => {
            if (!isMobileFooterMenu()) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const open = wrap.classList.contains('is-open');
            if (open) {
                closeFooterMenu(wrap, toggle, panel);
            } else {
                openFooterMenu(wrap, toggle, panel);
            }
        });

        document.addEventListener('click', (e) => {
            if (!isMobileFooterMenu() || !wrap.classList.contains('is-open') || wrap.contains(e.target)) {
                return;
            }
            closeFooterMenu(wrap, toggle, panel);
        });

        document.addEventListener('keydown', (e) => {
            if (!isMobileFooterMenu() || e.key !== 'Escape' || !wrap.classList.contains('is-open')) {
                return;
            }
            closeFooterMenu(wrap, toggle, panel);
            toggle.focus();
        });

        const onLayoutChange = () => syncFooterMenuLayout(wrap, toggle, panel);
        if (typeof MOBILE_MQ.addEventListener === 'function') {
            MOBILE_MQ.addEventListener('change', onLayoutChange);
        } else if (typeof MOBILE_MQ.addListener === 'function') {
            MOBILE_MQ.addListener(onLayoutChange);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooterMenu);
    } else {
        initFooterMenu();
    }
})();
