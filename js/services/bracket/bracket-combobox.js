(() => {
    'use strict';

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function filterOptions(options, query) {
        const q = String(query || '').trim();
        if (!q) return options;
        return options.filter((n) => String(n).includes(q));
    }

    function wireNumberCombobox(root, options = {}) {
        if (!root || root.dataset.bracketComboboxEnhanced === '1') return root;

        const min = parseInt(options.min, 10) || 2;
        const max = parseInt(options.max, 10) || 32;
        const defaultValue = parseInt(options.defaultValue, 10) || min;
        const input = root.querySelector('.bracket-combobox__input') || root.querySelector('input');
        const menu = root.querySelector('.bracket-combobox__menu');
        const toggle = root.querySelector('.bracket-combobox__toggle');

        if (!input || !menu) return root;

        root.dataset.bracketComboboxEnhanced = '1';

        const allOptions = [];
        for (let n = min; n <= max; n++) allOptions.push(n);

        let closeTimer = null;

        function renderMenu(query) {
            const filtered = filterOptions(allOptions, query);
            menu.innerHTML = filtered.map((value) => (
                `<button type="button" class="bracket-combobox__option" role="option" data-value="${value}">${value}</button>`
            )).join('');
            if (filtered.length === 0) {
                menu.innerHTML = '<div class="bracket-combobox__empty" aria-hidden="true">—</div>';
            }
        }

        function openMenu() {
            clearTimeout(closeTimer);
            renderMenu(input.value);
            menu.hidden = false;
            root.classList.add('is-open');
            input.setAttribute('aria-expanded', 'true');
        }

        function closeMenu() {
            menu.hidden = true;
            root.classList.remove('is-open');
            input.setAttribute('aria-expanded', 'false');
        }

        function scheduleClose() {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(closeMenu, 120);
        }

        function selectValue(value) {
            input.value = String(value);
            closeMenu();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (!input.value) {
            input.value = String(defaultValue);
        }

        toggle?.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        toggle?.addEventListener('click', () => {
            if (root.classList.contains('is-open')) {
                closeMenu();
            } else {
                input.focus();
                openMenu();
            }
        });

        input.addEventListener('focus', openMenu);

        input.addEventListener('input', () => {
            const digits = String(input.value || '').replace(/[^\d]/g, '');
            if (digits !== input.value) input.value = digits;
            openMenu();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const first = menu.querySelector('.bracket-combobox__option');
                if (first) selectValue(first.getAttribute('data-value'));
            }
        });

        input.addEventListener('blur', scheduleClose);

        menu.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.bracket-combobox__option');
            if (!option) return;
            selectValue(option.getAttribute('data-value'));
        });

        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) closeMenu();
        });

        renderMenu('');
        return root;
    }

    function wireGroupPicker(root, options = {}) {
        if (!root || root.dataset.bracketComboboxEnhanced === '1') return null;

        const input = root.querySelector('.bracket-combobox__input') || root.querySelector('input');
        const menu = root.querySelector('.bracket-combobox__menu');
        const toggle = root.querySelector('.bracket-combobox__toggle');
        const items = options.items || [];
        const onSelect = options.onSelect || (() => {});
        const onFilter = options.onFilter || null;

        if (!input || !menu) return null;

        root.dataset.bracketComboboxEnhanced = '1';
        root.classList.add('bracket-combobox--groups');

        let selectedIndex = Math.max(0, options.initialIndex || 0);
        let closeTimer = null;
        let searching = false;

        function getItem(index) {
            return items.find((item) => item.index === index) || null;
        }

        function filterItems(query) {
            const q = String(query || '').trim().toLowerCase();
            if (!q) return items.slice();
            const num = parseInt(q, 10);
            if (Number.isFinite(num)) {
                const byNum = items.filter((item) => item.index + 1 === num);
                if (byNum.length) return byNum;
            }
            return items.filter((item) => {
                const haystack = item.searchText || `${item.label} ${item.hint || ''}`.toLowerCase();
                return haystack.includes(q);
            });
        }

        function renderMenu(query) {
            const filtered = filterItems(query);
            menu.innerHTML = filtered.map((item) => (
                `<button type="button" class="bracket-combobox__option bracket-combobox__option--group${item.index === selectedIndex ? ' is-active' : ''}"
                    role="option" data-index="${item.index}">
                    <span class="bracket-combobox__option-label">${esc(item.label)}</span>
                    ${item.hint ? `<span class="bracket-combobox__option-hint">${esc(item.hint)}</span>` : ''}
                </button>`
            )).join('');
            if (filtered.length === 0) {
                menu.innerHTML = `<div class="bracket-combobox__empty">${esc(options.emptyLabel || '—')}</div>`;
            }
            onFilter?.(query, filtered);
            return filtered;
        }

        function openMenu() {
            clearTimeout(closeTimer);
            renderMenu(searching ? input.value : '');
            menu.hidden = false;
            root.classList.add('is-open');
            input.setAttribute('aria-expanded', 'true');
        }

        function closeMenu() {
            menu.hidden = true;
            root.classList.remove('is-open');
            input.setAttribute('aria-expanded', 'false');
        }

        function scheduleClose() {
            clearTimeout(closeTimer);
            closeTimer = setTimeout(closeMenu, 120);
        }

        function selectIndex(index) {
            const item = getItem(index);
            if (!item) return;
            selectedIndex = item.index;
            searching = false;
            input.value = item.label;
            closeMenu();
            onSelect(item.index);
        }

        function setIndex(index, options = {}) {
            const syncInput = options.syncInput !== false;
            const item = getItem(index);
            if (!item) return;
            selectedIndex = item.index;
            if (syncInput) {
                searching = false;
                input.value = item.label;
            }
        }

        toggle?.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        toggle?.addEventListener('click', () => {
            if (root.classList.contains('is-open')) {
                closeMenu();
            } else {
                input.focus();
                openMenu();
            }
        });

        input.addEventListener('focus', () => {
            searching = true;
            input.select();
            openMenu();
        });

        input.addEventListener('input', () => {
            searching = true;
            openMenu();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
                setIndex(selectedIndex);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = String(input.value || '').trim();
                if (!q) return;
                const filtered = filterItems(input.value);
                if (filtered.length === 1) {
                    selectIndex(filtered[0].index);
                    return;
                }
                const first = menu.querySelector('.bracket-combobox__option');
                if (first) selectIndex(parseInt(first.getAttribute('data-index'), 10));
            }
        });

        input.addEventListener('blur', () => {
            scheduleClose();
            setTimeout(() => {
                if (!root.classList.contains('is-open')) {
                    setIndex(selectedIndex);
                }
            }, 140);
        });

        menu.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.bracket-combobox__option');
            if (!option) return;
            selectIndex(parseInt(option.getAttribute('data-index'), 10));
        });

        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) closeMenu();
        });

        setIndex(selectedIndex);
        renderMenu('');

        return { setIndex, root };
    }

    window.AbsBracketCombobox = { wireNumber: wireNumberCombobox, wireGroupPicker };
})();
