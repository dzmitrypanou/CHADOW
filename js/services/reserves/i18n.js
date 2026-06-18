(() => {
    'use strict';

    const STRINGS = {
        ru: {
            pageTitle: 'Клановые резервы',
            pageHint: 'Управление клановыми резервами по регионам — ручной запуск и расписание для каждого клана.',
            apiNotConfigured: 'API-ключи WG или LESTA не настроены. Обратитесь к администратору сайта.',
            accountTitle: 'Привязанные аккаунты',
            accountsHint: 'Кликните по карточке аккаунта, чтобы выбрать клан для резервов и расписания. В каждом регионе можно добавить несколько аккаунтов.',
            slotEmpty: 'Аккаунты не привязаны.',
            relinkRequired: 'Доступ к игровому API истёк. Обновите привязку, чтобы активировать резервы.',
            activeClanFallback: 'Выбранный клан',
            selectedBadge: 'Выбран/настраивается',
            linkRequired: 'Привяжите аккаунт для резервов — выберите регион и нажмите «Добавить аккаунт».',
            goProfile: 'Открыть профиль',
            relinkAccount: 'Обновить доступ',
            accountNick: 'Ник',
            catalogTitle: 'Клановые резервы',
            refresh: 'Обновить',
            loading: 'Загрузка…',
            catalogEmpty: 'Резервы не найдены.',
            errorNoClan: 'Аккаунт не состоит в клане.',
            catalogLoadError: 'Не удалось загрузить список резервов.',
            noClan: 'Игрок не в клане',
            scheduleTitle: 'Автоматическая активация',
            scheduleHint: 'Расписание применяется к выбранному клану выше.',
            ruleType: 'Тип резерва',
            ruleLevel: 'Уровень',
            ruleTime: 'Время',
            ruleDays: 'Дни',
            dayMon: 'Пн',
            dayTue: 'Вт',
            dayWed: 'Ср',
            dayThu: 'Чт',
            dayFri: 'Пт',
            daySat: 'Сб',
            daySun: 'Вс',
            saveRule: 'Сохранить расписание',
            rulesTitle: 'Сохранённые расписания',
            logTitle: 'Журнал активаций',
            colReserve: 'Резерв',
            colLevel: 'Уровень',
            colStatus: 'Статус',
            colDetails: 'Детали',
            colAction: 'Действие',
            colTime: 'Время',
            colTrigger: 'Источник',
            colResult: 'Результат',
            colError: 'Ошибка',
            colLastRun: 'Последний запуск',
            statusActive: 'Активен',
            statusReady: 'Можно запустить',
            statusUnavailable: 'Недоступен',
            activate: 'Активировать',
            activating: 'Активация…',
            activated: 'Резерв активирован.',
            activateError: 'Не удалось активировать резерв.',
            levelLabel: 'Уровень {level}',
            amountLabel: 'В наличии: {amount}',
            activeTill: 'До {time}',
            rulesEmpty: 'Расписаний пока нет.',
            logEmpty: 'Активаций пока нет.',
            deleteRule: 'Удалить',
            enabled: 'Вкл',
            disabled: 'Выкл',
            ruleSaved: 'Расписание сохранено.',
            ruleDeleted: 'Расписание удалено.',
            selectType: 'Выберите тип',
            selectLevel: 'Выберите уровень',
            triggerManual: 'Вручную',
            triggerSchedule: 'По расписанию',
            logSuccess: 'Успех',
            logError: 'Ошибка',
            wgApiLinked: 'WG API привязан',
            lestaApiLinked: 'LESTA API привязан',
            linkSlot: 'Привязать {slot}',
            addAccountSlot: 'Добавить аккаунт {slot}',
            apiRegionDisabled: 'API не настроен',
            accountAlreadyLinked: 'Этот аккаунт уже привязан.',
            accountLinked: 'Аккаунт привязан для резервов.',
            unlink: 'Отвязать',
            dialogConfirmTitle: 'Подтвердите действие',
            dialogConfirm: 'Подтвердить',
            dialogCancel: 'Отмена',
            unlinkConfirm: 'Отвязать этот аккаунт от клановых резервов? Привязка в профиле не изменится.',
            unlinkSuccess: 'Отвязано.',
            unlinkError: 'Не удалось отвязать.',
        },
        en: {
            pageTitle: 'Clan Reserves',
            pageHint: 'Manage clan reserves per linked region — manual activation and schedules for each clan.',
            apiNotConfigured: 'WG or LESTA API keys are not configured. Ask the site administrator to add them.',
            accountTitle: 'Linked accounts',
            accountsHint: 'Click an account card to choose which clan to manage reserves and schedules for. You can add multiple accounts per region.',
            slotEmpty: 'No accounts linked yet.',
            relinkRequired: 'Game API access expired. Re-link your account to activate reserves.',
            activeClanFallback: 'Selected clan',
            selectedBadge: 'Selected / managing',
            linkRequired: 'Link an account for reserves — pick a region and click «Add account».',
            goProfile: 'Open profile',
            relinkAccount: 'Refresh access',
            accountNick: 'Nickname',
            catalogTitle: 'Clan reserves',
            refresh: 'Refresh',
            loading: 'Loading…',
            catalogEmpty: 'No reserves found.',
            errorNoClan: 'Account is not in a clan.',
            catalogLoadError: 'Could not load reserves list.',
            noClan: 'Player not in a clan',
            scheduleTitle: 'Automatic activation',
            scheduleHint: 'Schedule applies to the selected clan above.',
            ruleType: 'Reserve type',
            ruleLevel: 'Level',
            ruleTime: 'Time',
            ruleDays: 'Days',
            dayMon: 'Mon',
            dayTue: 'Tue',
            dayWed: 'Wed',
            dayThu: 'Thu',
            dayFri: 'Fri',
            daySat: 'Sat',
            daySun: 'Sun',
            saveRule: 'Save schedule',
            rulesTitle: 'Saved schedules',
            logTitle: 'Activation log',
            colReserve: 'Reserve',
            colLevel: 'Level',
            colStatus: 'Status',
            colDetails: 'Details',
            colAction: 'Action',
            colTime: 'Time',
            colTrigger: 'Source',
            colResult: 'Result',
            colError: 'Error',
            colLastRun: 'Last run',
            statusActive: 'Active',
            statusReady: 'Ready to activate',
            statusUnavailable: 'Unavailable',
            activate: 'Activate',
            activating: 'Activating…',
            activated: 'Reserve activated.',
            activateError: 'Could not activate reserve.',
            levelLabel: 'Level {level}',
            amountLabel: 'In stock: {amount}',
            activeTill: 'Until {time}',
            rulesEmpty: 'No schedules yet.',
            logEmpty: 'No activations yet.',
            deleteRule: 'Delete',
            enabled: 'On',
            disabled: 'Off',
            ruleSaved: 'Schedule saved.',
            ruleDeleted: 'Schedule deleted.',
            selectType: 'Select type',
            selectLevel: 'Select level',
            triggerManual: 'Manual',
            triggerSchedule: 'Scheduled',
            logSuccess: 'Success',
            logError: 'Error',
            wgApiLinked: 'WG API linked',
            lestaApiLinked: 'LESTA API linked',
            linkSlot: 'Link {slot}',
            addAccountSlot: 'Add {slot} account',
            apiRegionDisabled: 'API not configured',
            accountAlreadyLinked: 'This account is already linked.',
            accountLinked: 'Account linked for reserves.',
            unlink: 'Unlink',
            dialogConfirmTitle: 'Confirm action',
            dialogConfirm: 'Confirm',
            dialogCancel: 'Cancel',
            unlinkConfirm: 'Unlink this account from clan reserves? Your profile link will stay unchanged.',
            unlinkSuccess: 'Unlinked.',
            unlinkError: 'Could not unlink.',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_RESERVES_LANG = normalized;
        window.ABS_LANG = normalized;
        return normalized;
    }

    function getLang() {
        return normalizeLang(window.ABS_RESERVES_LANG ?? window.ABS_LANG);
    }

    function buildReservesReturnPath(lang) {
        return normalizeLang(lang) === 'en' ? '/en/services/reserves' : '/services/reserves';
    }

    function t(key, vars = {}) {
        const lang = getLang();
        let text = STRINGS[lang][key] || STRINGS.ru[key] || key;
        Object.keys(vars).forEach((k) => {
            text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        });
        return text;
    }

    function translateApiError(data = {}, status = 0) {
        const code = String(data.error_code || '').trim();
        if (code === 'no_clan' || status === 409) {
            return t('errorNoClan');
        }
        if (code === 'token_expired' || code === 'token_missing') {
            return t('relinkRequired');
        }
        return t('catalogLoadError');
    }

    function relocalizeDom(root) {
        const el = root || document;
        el.querySelectorAll('[data-reserves-i18n]').forEach((node) => {
            const key = node.getAttribute('data-reserves-i18n');
            if (key) node.textContent = t(key);
        });

        el.querySelectorAll('[data-reserves-link-slot]').forEach((node) => {
            const slot = node.getAttribute('data-reserves-link-slot') || '';
            const useAdd = node.closest('.reserves-region-column__foot');
            node.textContent = t(useAdd ? 'addAccountSlot' : 'linkSlot', { slot });
        });

        el.querySelectorAll('[data-reserves-i18n-provider]').forEach((node) => {
            const provider = node.getAttribute('data-reserves-i18n-provider') || 'wg';
            node.textContent = t(provider === 'lesta' ? 'lestaApiLinked' : 'wgApiLinked');
        });

        el.querySelectorAll('[data-reserves-i18n-title]').forEach((node) => {
            const key = node.getAttribute('data-reserves-i18n-title');
            if (key) {
                const label = t(key);
                node.setAttribute('title', label);
                node.setAttribute('aria-label', label);
            }
        });

        const realmTabs = el.querySelector('#reservesRealmTabs');
        if (realmTabs) {
            realmTabs.setAttribute('aria-label', t('activeRegion'));
        }

        const typeSel = el.querySelector('#reservesRuleType');
        const levelSel = el.querySelector('#reservesRuleLevel');
        if (typeSel?.options[0]) typeSel.options[0].textContent = t('selectType');
        if (levelSel?.options[0]) levelSel.options[0].textContent = t('selectLevel');
    }

    function updateOAuthReturnLinks(lang) {
        const returnPath = buildReservesReturnPath(lang);
        document.querySelectorAll('a[href*="action=reserve_link"], a[href*="action=reserve_refresh"]').forEach((link) => {
            try {
                const url = new URL(link.href, window.location.origin);
                url.searchParams.set('return', returnPath);
                link.href = url.pathname + url.search;
            } catch (_) {
                /* ignore malformed href */
            }
        });
    }

    function updateStaticDom(lang) {
        const normalized = normalizeLang(lang);
        relocalizeDom(document);
        updateOAuthReturnLinks(normalized);
        if (typeof window.absUpdateDocumentTitle === 'function') {
            window.absUpdateDocumentTitle(normalized);
        }
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        updateStaticDom(normalized);
        if (window.AbsReserves && typeof window.AbsReserves.relocalizeView === 'function') {
            window.AbsReserves.relocalizeView();
        }
        window.dispatchEvent(new CustomEvent('reserves:langchange', { detail: { lang: normalized } }));
        return normalized;
    }

    window.AbsReservesI18n = {
        getLang,
        setLang,
        normalizeLang,
        t,
        translateApiError,
        relocalizeDom,
        updateStaticDom,
        switchLanguage,
        buildReservesReturnPath,
        STRINGS,
    };
})();
