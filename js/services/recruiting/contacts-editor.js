(() => {
    const TYPE_META = {
        vk: { icon: 'fab fa-vk', labelRu: 'ВКонтакте', labelEn: 'VK', placeholderRu: 'https://vk.com/username', placeholderEn: 'https://vk.com/username' },
        max: { icon: 'recruiting-contact-icon-max', labelRu: 'MAX', labelEn: 'MAX', placeholderRu: 'https://max.ru/join/XXXXXX', placeholderEn: 'https://max.ru/join/XXXXXX' },
        telegram: { icon: 'fab fa-telegram', labelRu: 'Telegram', labelEn: 'Telegram', placeholderRu: '@username', placeholderEn: '@username' },
        viber: { icon: 'fab fa-viber', labelRu: 'Viber', labelEn: 'Viber', placeholderRu: '+79001234567', placeholderEn: '+79001234567' },
        discord: { icon: 'fab fa-discord', labelRu: 'Discord', labelEn: 'Discord', placeholderRu: 'username', placeholderEn: 'username' },
    };
    const TYPE_ORDER = ['vk', 'max', 'telegram', 'viber', 'discord'];
    const MAX_CONTACTS = 10;

    function t(lang, key) {
        const ru = {
            add: 'Добавить контакт',
            remove: 'Удалить',
            empty: 'Контакт не указан',
        };
        const en = {
            add: 'Add contact',
            remove: 'Remove',
            empty: 'No contact',
        };
        return (lang === 'en' ? en : ru)[key] || key;
    }

    function meta(type, lang) {
        const m = TYPE_META[type] || TYPE_META.telegram;
        return {
            type,
            icon: m.icon,
            label: lang === 'en' ? m.labelEn : m.labelRu,
            placeholder: lang === 'en' ? m.placeholderEn : m.placeholderRu,
        };
    }

    function parseInitial(input) {
        if (!input || !input.value) return [];
        try {
            const data = JSON.parse(input.value);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            if (input.value.trim()) {
                return [{ type: 'telegram', value: input.value.trim() }];
            }
            return [];
        }
    }

    function iconHtml(iconClass) {
        if (iconClass === 'recruiting-contact-icon-max') {
            return typeof window.recruitingMaxIconHtml === 'function'
                ? window.recruitingMaxIconHtml('recruiting-contact-icon-max')
                : '<svg class="recruiting-contact-icon-max" viewBox="0 0 42 42" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fill-rule="evenodd" d="M21.47 41.88c-4.11 0-6.02-.6-9.34-3-2.1 2.7-8.75 4.81-9.04 1.2 0-2.71-.6-5-1.28-7.5C1 29.5.08 26.07.08 21.1.08 9.23 9.82.3 21.36.3c11.55 0 20.6 9.37 20.6 20.91a20.6 20.6 0 0 1-20.49 20.67m.17-31.32c-5.62-.29-10 3.6-10.97 9.7-.8 5.05.62 11.2 1.83 11.52.58.14 2.04-1.04 2.95-1.95a10.4 10.4 0 0 0 5.08 1.81 10.7 10.7 0 0 0 11.19-9.97 10.7 10.7 0 0 0-10.08-11.1Z"/></svg>';
        }
        return `<i class="${iconClass}" aria-hidden="true"></i>`;
    }

    function renderRow(row, lang) {
        const wrap = document.createElement('div');
        wrap.className = 'recruiting-contact-row';
        wrap.dataset.type = row.type;

        const typePicker = document.createElement('div');
        typePicker.className = 'recruiting-contact-types';
        typePicker.setAttribute('role', 'group');
        TYPE_ORDER.forEach((type) => {
            const m = meta(type, lang);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'recruiting-contact-type-btn' + (row.type === type ? ' is-active' : '');
            btn.dataset.type = type;
            btn.title = m.label;
            btn.setAttribute('aria-label', m.label);
            btn.innerHTML = iconHtml(m.icon);
            typePicker.appendChild(btn);
        });

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'recruiting-text-input recruiting-contact-value';
        valueInput.maxLength = 128;
        valueInput.value = row.value || '';
        valueInput.placeholder = meta(row.type, lang).placeholder;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'recruiting-contact-remove';
        removeBtn.title = t(lang, 'remove');
        removeBtn.setAttribute('aria-label', t(lang, 'remove'));
        removeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';

        wrap.appendChild(typePicker);
        wrap.appendChild(valueInput);
        wrap.appendChild(removeBtn);
        return wrap;
    }

    function readRows(listEl) {
        const rows = [];
        listEl.querySelectorAll('.recruiting-contact-row').forEach((rowEl) => {
            const type = rowEl.dataset.type || 'telegram';
            const value = rowEl.querySelector('.recruiting-contact-value')?.value.trim() || '';
            if (value) {
                rows.push({ type, value });
            }
        });
        return rows;
    }

    function syncHidden(listEl, hiddenInput) {
        hiddenInput.value = JSON.stringify(readRows(listEl));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const editors = [];

    function initEditor(root) {
        const hiddenInput = document.getElementById(root.id + 'Input');
        if (!hiddenInput) return;

        const state = {
            root,
            hiddenInput,
            rows: [],
            get lang() {
                return root.dataset.lang === 'en' ? 'en' : 'ru';
            },
        };

        state.rows = parseInitial(hiddenInput);
        if (state.rows.length === 0) {
            state.rows = [{ type: 'telegram', value: '' }];
        }

        const listEl = document.createElement('div');
        listEl.className = 'recruiting-contacts-list';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'recruiting-contacts-add';

        root.appendChild(listEl);
        root.appendChild(addBtn);

        function redraw() {
            listEl.innerHTML = '';
            state.rows.forEach((row) => {
                listEl.appendChild(renderRow(row, state.lang));
            });
            syncHidden(listEl, hiddenInput);
            addBtn.disabled = state.rows.length >= MAX_CONTACTS;
            addBtn.innerHTML = `<i class="fas fa-plus" aria-hidden="true"></i> ${t(state.lang, 'add')}`;
        }

        redraw();

        root.addEventListener('click', (e) => {
            const typeBtn = e.target.closest('.recruiting-contact-type-btn');
            if (typeBtn) {
                const rowEl = typeBtn.closest('.recruiting-contact-row');
                if (!rowEl) return;
                const idx = [...listEl.children].indexOf(rowEl);
                if (idx < 0) return;
                state.rows[idx].type = typeBtn.dataset.type || 'telegram';
                redraw();
                return;
            }

            const removeBtn = e.target.closest('.recruiting-contact-remove');
            if (removeBtn) {
                const rowEl = removeBtn.closest('.recruiting-contact-row');
                const idx = [...listEl.children].indexOf(rowEl);
                if (idx >= 0) {
                    state.rows.splice(idx, 1);
                    if (state.rows.length === 0) {
                        state.rows.push({ type: 'telegram', value: '' });
                    }
                    redraw();
                }
                return;
            }

            if (e.target.closest('.recruiting-contacts-add')) {
                if (state.rows.length >= MAX_CONTACTS) return;
                state.rows.push({ type: 'telegram', value: '' });
                redraw();
            }
        });

        root.addEventListener('input', (e) => {
            if (!e.target.classList.contains('recruiting-contact-value')) return;
            const rowEl = e.target.closest('.recruiting-contact-row');
            const idx = [...listEl.children].indexOf(rowEl);
            if (idx >= 0) {
                state.rows[idx].value = e.target.value;
                syncHidden(listEl, hiddenInput);
            }
        });

        state.relocalize = () => redraw();
        editors.push(state);
    }

    function init() {
        document.querySelectorAll('.recruiting-contacts-editor').forEach(initEditor);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function setEditorContacts(editorId, contacts) {
        const state = editors.find((editor) => editor.root.id === editorId);
        if (!state) return false;

        const rows = Array.isArray(contacts) ? contacts : [];
        state.rows = rows.length > 0
            ? rows.map((item) => ({
                type: String(item.type || 'telegram'),
                value: String(item.value || ''),
            }))
            : [{ type: 'telegram', value: '' }];
        state.relocalize();
        return true;
    }

    window.recruitingInitContactsEditors = init;
    window.recruitingSetContactsEditorData = setEditorContacts;
    window.recruitingRelocalizeContactsEditors = () => {
        editors.forEach((editor) => editor.relocalize());
    };

    window.addEventListener('recruiting:langchange', () => {
        window.recruitingRelocalizeContactsEditors();
    });
})();
