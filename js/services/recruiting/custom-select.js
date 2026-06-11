(() => {
    function getSelectedOption(select) {
        return select.options[select.selectedIndex] || null;
    }

    function getDisplayLabel(select) {
        const option = getSelectedOption(select);
        if (!option) return '';
        if (option.disabled && option.value === '') {
            return option.textContent.trim();
        }
        return option.textContent.trim();
    }

    function closeAll(except) {
        document.querySelectorAll('.recruiting-select-wrap').forEach((wrap) => {
            if (wrap === except) return;
            wrap.classList.remove('is-open');
            const trigger = wrap.querySelector('.recruiting-select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function syncTrigger(wrap, select) {
        const labelEl = wrap.querySelector('.recruiting-select-trigger-label');
        const trigger = wrap.querySelector('.recruiting-select-trigger');
        if (!labelEl || !trigger) return;

        const option = getSelectedOption(select);
        labelEl.textContent = getDisplayLabel(select);
        trigger.classList.toggle('is-placeholder', !!(option && option.value === ''));

        wrap.querySelectorAll('.recruiting-select-option').forEach((btn) => {
            const active = btn.getAttribute('data-value') === select.value;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function buildMenuOptions(wrap, select, menu, trigger) {
        menu.innerHTML = '';
        Array.from(select.options).forEach((option) => {
            if (option.disabled && option.value === '') return;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'recruiting-select-option';
            item.setAttribute('role', 'option');
            item.setAttribute('data-value', option.value);
            item.textContent = option.textContent.trim();

            item.addEventListener('click', () => {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                wrap.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                syncTrigger(wrap, select);
            });

            menu.appendChild(item);
        });
    }

    function enhanceSelect(select) {
        if (!select || select.dataset.recruitingSelectEnhanced === '1') return;
        select.dataset.recruitingSelectEnhanced = '1';

        const wrap = document.createElement('div');
        wrap.className = 'recruiting-select-wrap';
        if (select.id) {
            wrap.dataset.selectId = select.id;
        }

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        select.classList.add('recruiting-select-native');

        const listId = select.id ? `${select.id}-listbox` : `recruiting-select-${Math.random().toString(36).slice(2, 9)}`;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'recruiting-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        if (select.id) {
            trigger.setAttribute('aria-controls', listId);
        }
        trigger.innerHTML = `
            <span class="recruiting-select-trigger-label"></span>
            <i class="fas fa-chevron-down recruiting-select-trigger-icon" aria-hidden="true"></i>
        `;

        const menu = document.createElement('div');
        menu.className = 'recruiting-select-menu';
        menu.id = listId;
        menu.setAttribute('role', 'listbox');

        buildMenuOptions(wrap, select, menu, trigger);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !wrap.classList.contains('is-open');
            closeAll(willOpen ? wrap : null);
            wrap.classList.toggle('is-open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        wrap.appendChild(trigger);
        wrap.appendChild(menu);
        syncTrigger(wrap, select);

        select.addEventListener('change', () => syncTrigger(wrap, select));
    }

    function refreshSelect(select) {
        if (!select || select.dataset.recruitingSelectEnhanced !== '1') return;
        const wrap = select.closest('.recruiting-select-wrap');
        if (!wrap) return;
        const menu = wrap.querySelector('.recruiting-select-menu');
        const trigger = wrap.querySelector('.recruiting-select-trigger');
        if (!menu || !trigger) return;
        buildMenuOptions(wrap, select, menu, trigger);
        syncTrigger(wrap, select);
    }

    function init() {
        document.querySelectorAll('select.recruiting-select, select.bracket-select').forEach(enhanceSelect);
    }

    document.addEventListener('click', () => closeAll(null));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll(null);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.recruitingEnhanceSelects = init;
    window.recruitingEnhanceSelect = enhanceSelect;
    window.recruitingRefreshSelect = refreshSelect;
})();
