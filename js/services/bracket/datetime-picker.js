(() => {
    'use strict';

    const WEEKDAYS = {
        ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };

    function getLang() {
        if (window.AbsBracketI18n?.getLang) {
            return window.AbsBracketI18n.getLang();
        }
        return window.ABS_BRACKET_LANG === 'en' ? 'en' : 'ru';
    }

    function dt(key) {
        if (window.AbsBracketI18n?.t) {
            return window.AbsBracketI18n.t(key);
        }
        const fallbacks = {
            datetimePlaceholder: { ru: 'Выберите дату и время…', en: 'Pick date and time…' },
            datetimeTime: { ru: 'Время', en: 'Time' },
            datetimeClear: { ru: 'Очистить', en: 'Clear' },
            datetimeToday: { ru: 'Сегодня', en: 'Today' },
            datetimeSelect: { ru: 'Выбрать', en: 'Select' },
            datetimePrevMonth: { ru: 'Предыдущий месяц', en: 'Previous month' },
            datetimeNextMonth: { ru: 'Следующий месяц', en: 'Next month' },
        };
        const lang = getLang();
        return fallbacks[key]?.[lang] || fallbacks[key]?.ru || key;
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function parseInputValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const d = new Date(raw.replace(' ', 'T'));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function toInputValue(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatDisplay(date, lang) {
        return date.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function monthLabel(year, month, lang) {
        const d = new Date(year, month, 1);
        return d.toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            month: 'long',
            year: 'numeric',
        });
    }

    function closeAll(except) {
        document.querySelectorAll('.bracket-datetime-wrap.is-open').forEach((wrap) => {
            if (wrap === except) return;
            wrap.classList.remove('is-open');
            const trigger = wrap.querySelector('.bracket-datetime-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function syncTrigger(wrap, hiddenInput) {
        const labelEl = wrap.querySelector('.bracket-datetime-trigger-label');
        const trigger = wrap.querySelector('.bracket-datetime-trigger');
        if (!labelEl || !trigger) return;

        const lang = getLang();
        const date = parseInputValue(hiddenInput.value);
        if (date) {
            labelEl.textContent = formatDisplay(date, lang);
            trigger.classList.remove('is-placeholder');
        } else {
            labelEl.textContent = dt('datetimePlaceholder');
            trigger.classList.add('is-placeholder');
        }
    }

    function buildCalendarDays(viewYear, viewMonth, selectedDate) {
        const firstDay = new Date(viewYear, viewMonth, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cells = [];
        for (let i = 0; i < startOffset; i++) {
            cells.push('<span class="bracket-datetime-day is-empty" aria-hidden="true"></span>');
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const cellDate = new Date(viewYear, viewMonth, day);
            const classes = ['bracket-datetime-day'];
            if (cellDate.getTime() === today.getTime()) classes.push('is-today');
            if (selectedDate
                && cellDate.getFullYear() === selectedDate.getFullYear()
                && cellDate.getMonth() === selectedDate.getMonth()
                && cellDate.getDate() === selectedDate.getDate()) {
                classes.push('is-selected');
            }
            cells.push(`<button type="button" class="${classes.join(' ')}" data-day="${day}">${day}</button>`);
        }
        return cells.join('');
    }

    function enhanceInput(hiddenInput) {
        if (!hiddenInput || hiddenInput.dataset.bracketDatetimeEnhanced === '1') return;
        hiddenInput.dataset.bracketDatetimeEnhanced = '1';
        hiddenInput.type = 'hidden';

        let viewYear;
        let viewMonth;
        const initial = parseInputValue(hiddenInput.value) || new Date();
        viewYear = initial.getFullYear();
        viewMonth = initial.getMonth();

        const wrap = document.createElement('div');
        wrap.className = 'bracket-datetime-wrap';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'bracket-datetime-trigger recruiting-select-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        if (hiddenInput.id) {
            const labelledBy = hiddenInput.getAttribute('aria-labelledby')
                || `${hiddenInput.id}-label`;
            if (document.getElementById(labelledBy)) {
                trigger.setAttribute('aria-labelledby', labelledBy);
            }
        }
        trigger.innerHTML = `
            <span class="bracket-datetime-trigger-label"></span>
            <i class="fas fa-calendar-alt bracket-datetime-trigger-icon" aria-hidden="true"></i>
        `;

        const popup = document.createElement('div');
        popup.className = 'bracket-datetime-popup';
        popup.setAttribute('role', 'dialog');
        popup.hidden = true;

        const renderPopup = () => {
            const lang = getLang();
            const selected = parseInputValue(hiddenInput.value) || new Date(viewYear, viewMonth, 1, 12, 0);
            const weekdays = WEEKDAYS[lang] || WEEKDAYS.ru;

            popup.innerHTML = `
                <div class="bracket-datetime-popup__head">
                    <button type="button" class="bracket-datetime-nav" data-nav="-1" aria-label="${dt('datetimePrevMonth')}">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <div class="bracket-datetime-popup__title">${monthLabel(viewYear, viewMonth, lang)}</div>
                    <button type="button" class="bracket-datetime-nav" data-nav="1" aria-label="${dt('datetimeNextMonth')}">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="bracket-datetime-weekdays">${weekdays.map((d) => `<span>${d}</span>`).join('')}</div>
                <div class="bracket-datetime-grid">${buildCalendarDays(viewYear, viewMonth, parseInputValue(hiddenInput.value))}</div>
                <div class="bracket-datetime-time">
                    <label class="bracket-datetime-time__label">${dt('datetimeTime')}</label>
                    <div class="bracket-datetime-time__fields">
                        <input type="number" class="bracket-datetime-hour" min="0" max="23" step="1" value="${pad(selected.getHours())}">
                        <span class="bracket-datetime-time__sep">:</span>
                        <input type="number" class="bracket-datetime-minute" min="0" max="59" step="1" value="${pad(selected.getMinutes())}">
                    </div>
                </div>
                <div class="bracket-datetime-popup__actions">
                    <button type="button" class="bracket-datetime-clear">${dt('datetimeClear')}</button>
                    <div class="bracket-datetime-popup__actions-right">
                        <button type="button" class="bracket-datetime-today">${dt('datetimeToday')}</button>
                        <button type="button" class="bracket-datetime-apply">${dt('datetimeSelect')}</button>
                    </div>
                </div>
            `;

            const closePopup = () => {
                wrap.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                popup.hidden = true;
            };

            const readTimeFields = () => {
                let hour = parseInt(popup.querySelector('.bracket-datetime-hour')?.value || '12', 10);
                let minute = parseInt(popup.querySelector('.bracket-datetime-minute')?.value || '0', 10);
                if (Number.isNaN(hour)) hour = 12;
                if (Number.isNaN(minute)) minute = 0;
                return {
                    hour: Math.max(0, Math.min(23, hour)),
                    minute: Math.max(0, Math.min(59, minute)),
                };
            };

            const applySelection = () => {
                const { hour, minute } = readTimeFields();
                const selectedDayBtn = popup.querySelector('.bracket-datetime-day.is-selected');
                let day;
                if (selectedDayBtn) {
                    day = parseInt(selectedDayBtn.getAttribute('data-day'), 10);
                } else {
                    const current = parseInputValue(hiddenInput.value);
                    day = current ? current.getDate() : 1;
                }
                const next = new Date(viewYear, viewMonth, day, hour, minute, 0, 0);
                hiddenInput.value = toInputValue(next);
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger(wrap, hiddenInput);
                closePopup();
            };

            const wireTimeInput = (input) => {
                if (!input) return;
                input.addEventListener('focus', () => {
                    input.select();
                });
                input.addEventListener('mouseup', (e) => {
                    e.preventDefault();
                });
            };

            wireTimeInput(popup.querySelector('.bracket-datetime-hour'));
            wireTimeInput(popup.querySelector('.bracket-datetime-minute'));

            popup.querySelector('[data-nav="-1"]')?.addEventListener('click', () => {
                viewMonth -= 1;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear -= 1;
                }
                renderPopup();
            });

            popup.querySelector('[data-nav="1"]')?.addEventListener('click', () => {
                viewMonth += 1;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear += 1;
                }
                renderPopup();
            });

            popup.querySelectorAll('.bracket-datetime-day[data-day]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const day = parseInt(btn.getAttribute('data-day'), 10);
                    const hour = parseInt(popup.querySelector('.bracket-datetime-hour')?.value || '12', 10);
                    const minute = parseInt(popup.querySelector('.bracket-datetime-minute')?.value || '0', 10);
                    const next = new Date(viewYear, viewMonth, day, hour, minute, 0, 0);
                    hiddenInput.value = toInputValue(next);
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                    syncTrigger(wrap, hiddenInput);
                    renderPopup();
                });
            });

            const syncTime = () => {
                const current = parseInputValue(hiddenInput.value);
                if (!current) return;
                let hour = parseInt(popup.querySelector('.bracket-datetime-hour')?.value || '0', 10);
                let minute = parseInt(popup.querySelector('.bracket-datetime-minute')?.value || '0', 10);
                if (Number.isNaN(hour)) hour = 0;
                if (Number.isNaN(minute)) minute = 0;
                hour = Math.max(0, Math.min(23, hour));
                minute = Math.max(0, Math.min(59, minute));
                current.setHours(hour, minute, 0, 0);
                hiddenInput.value = toInputValue(current);
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger(wrap, hiddenInput);
            };

            popup.querySelector('.bracket-datetime-hour')?.addEventListener('change', syncTime);
            popup.querySelector('.bracket-datetime-minute')?.addEventListener('change', syncTime);

            popup.querySelector('.bracket-datetime-clear')?.addEventListener('click', () => {
                hiddenInput.value = '';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger(wrap, hiddenInput);
                wrap.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                popup.hidden = true;
            });

            popup.querySelector('.bracket-datetime-today')?.addEventListener('click', () => {
                const now = new Date();
                viewYear = now.getFullYear();
                viewMonth = now.getMonth();
                hiddenInput.value = toInputValue(now);
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger(wrap, hiddenInput);
                renderPopup();
            });

            popup.querySelector('.bracket-datetime-apply')?.addEventListener('click', applySelection);
        };

        wrap._bracketDatetimeRenderPopup = renderPopup;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !wrap.classList.contains('is-open');
            closeAll(willOpen ? wrap : null);
            wrap.classList.toggle('is-open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            popup.hidden = !willOpen;
            if (willOpen) {
                const current = parseInputValue(hiddenInput.value);
                if (current) {
                    viewYear = current.getFullYear();
                    viewMonth = current.getMonth();
                }
                renderPopup();
            }
        });

        hiddenInput.parentNode.insertBefore(wrap, hiddenInput);
        wrap.appendChild(hiddenInput);
        wrap.appendChild(trigger);
        wrap.appendChild(popup);
        syncTrigger(wrap, hiddenInput);
    }

    function init(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('input.bracket-datetime-input').forEach(enhanceInput);
    }

    function refreshAll() {
        document.querySelectorAll('.bracket-datetime-wrap').forEach((wrap) => {
            const hiddenInput = wrap.querySelector('input.bracket-datetime-input');
            if (!hiddenInput) return;
            syncTrigger(wrap, hiddenInput);
            if (wrap.classList.contains('is-open') && typeof wrap._bracketDatetimeRenderPopup === 'function') {
                wrap._bracketDatetimeRenderPopup();
            }
        });
    }

    document.addEventListener('click', () => closeAll(null));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll(null);
    });

    document.addEventListener('DOMContentLoaded', () => init(document));
    window.addEventListener('bracket:langchange', refreshAll);

    window.AbsBracketDatetime = { init, enhanceInput, refreshAll };
})();
