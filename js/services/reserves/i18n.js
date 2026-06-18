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
            ruleEveryDay: 'Ежедн.',
            dayMon: 'Пн',
            dayTue: 'Вт',
            dayWed: 'Ср',
            dayThu: 'Чт',
            dayFri: 'Пт',
            daySat: 'Сб',
            daySun: 'Вс',
            dayMonShort: 'пн.',
            dayTueShort: 'вт.',
            dayWedShort: 'ср.',
            dayThuShort: 'чт.',
            dayFriShort: 'пт.',
            daySatShort: 'сб.',
            daySunShort: 'вс.',
            ruleScheduleAt: 'По {days}, в {time}',
            ruleNextActivation: 'Ближайшая активация:',
            rulePausedNoStock: 'Нет в наличии',
            rulePausedHint: 'Приостановлено — резервы закончились',
            saveRule: 'Сохранить расписание',
            rulesTitle: 'Сохранённые расписания',
            logTitle: 'Журнал активаций',
            clearLog: 'Очистить журнал',
            clearLogConfirm: 'Очистить журнал активаций для выбранного аккаунта?',
            logCleared: 'Журнал активаций очищен.',
            logClearError: 'Не удалось очистить журнал.',
            colReserve: 'Резерв',
            colLevel: 'Уровень',
            colStatus: 'Статус',
            colAmount: 'Количество',
            colActivation: 'Активация',
            colDetails: 'Детали',
            colAction: 'Действие',
            colTime: 'Время',
            colTrigger: 'Источник',
            colResult: 'Результат',
            colError: 'Ошибка',
            colLastRun: 'Последний запуск',
            statusActive: 'Активен',
            statusInactive: 'Неактивен',
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
            ruleSaveError: 'Не удалось сохранить расписание.',
            rulesLoadError: 'Не удалось загрузить расписания.',
            ruleValidationTypeLevel: 'Выберите тип и уровень резерва.',
            ruleValidationTime: 'Укажите время запуска.',
            ruleDeleted: 'Расписание удалено.',
            selectType: 'Выберите тип',
            selectLevel: 'Выберите уровень',
            triggerManual: 'Вручную',
            triggerSchedule: 'По расписанию',
            triggerManualShort: 'Ручн.',
            triggerScheduleShort: 'Авто',
            levelLabelShort: 'ур.{level}',
            logColTrigger: 'Источ.',
            logColResult: 'Статус',
            logSuccess: 'Успех',
            logError: 'Ошибка',
            logErrorToken: 'Не удалось получить access token. Откройте страницу резервов и нажмите «Обновить», затем попробуйте снова.',
            logErrorTokenAppId: 'WG API отклонил токен. Перепривяжите аккаунт через «Обновить доступ».',
            logErrorTokenDecrypt: 'Не удалось расшифровать токен. Перепривяжите аккаунт.',
            logErrorLinkMissing: 'Аккаунт не привязан. Перепривяжите доступ.',
            logErrorNoPermission: 'Нет прав на активацию резерва в клане (нужна роль командира/заместителя).',
            logErrorAlreadyActive: 'Резерв уже активен или недоступен для активации.',
            logErrorInvalidLanguage: 'Некорректный язык API. Попробуйте ещё раз.',
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
            ruleEveryDay: 'Daily',
            dayMon: 'Mon',
            dayTue: 'Tue',
            dayWed: 'Wed',
            dayThu: 'Thu',
            dayFri: 'Fri',
            daySat: 'Sat',
            daySun: 'Sun',
            dayMonShort: 'Mon',
            dayTueShort: 'Tue',
            dayWedShort: 'Wed',
            dayThuShort: 'Thu',
            dayFriShort: 'Fri',
            daySatShort: 'Sat',
            daySunShort: 'Sun',
            ruleScheduleAt: 'On {days} at {time}',
            ruleNextActivation: 'Next activation:',
            rulePausedNoStock: 'Out of stock',
            rulePausedHint: 'Paused — reserves depleted',
            saveRule: 'Save schedule',
            rulesTitle: 'Saved schedules',
            logTitle: 'Activation log',
            clearLog: 'Clear log',
            clearLogConfirm: 'Clear the activation log for the selected account?',
            logCleared: 'Activation log cleared.',
            logClearError: 'Could not clear the log.',
            colReserve: 'Reserve',
            colLevel: 'Level',
            colStatus: 'Status',
            colAmount: 'Quantity',
            colActivation: 'Activation',
            colDetails: 'Details',
            colAction: 'Action',
            colTime: 'Time',
            colTrigger: 'Source',
            colResult: 'Result',
            colError: 'Error',
            colLastRun: 'Last run',
            statusActive: 'Active',
            statusInactive: 'Inactive',
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
            ruleSaveError: 'Could not save schedule.',
            rulesLoadError: 'Could not load schedules.',
            ruleValidationTypeLevel: 'Select reserve type and level.',
            ruleValidationTime: 'Enter activation time.',
            ruleDeleted: 'Schedule deleted.',
            selectType: 'Select type',
            selectLevel: 'Select level',
            triggerManual: 'Manual',
            triggerSchedule: 'Scheduled',
            triggerManualShort: 'Manual',
            triggerScheduleShort: 'Auto',
            levelLabelShort: 'Lv{level}',
            logColTrigger: 'Source',
            logColResult: 'Status',
            logSuccess: 'Success',
            logError: 'Error',
            logErrorToken: 'Could not obtain access token. Open the reserves page, click Refresh, then try again.',
            logErrorTokenAppId: 'WG API rejected the token. Re-link the account via Refresh access.',
            logErrorTokenDecrypt: 'Could not decrypt token. Re-link the account.',
            logErrorLinkMissing: 'Account not linked. Re-link access.',
            logErrorNoPermission: 'No permission to activate clan reserves (commander or executive officer role required).',
            logErrorAlreadyActive: 'Reserve is already active or cannot be activated now.',
            logErrorInvalidLanguage: 'Invalid API language. Please try again.',
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

    const RESERVE_TYPES = {
        ru: {
            additionalBriefing: { name: 'Дополнительный инструктаж', description: 'к опыту экипажа' },
            battlePayments: { name: 'Боевые выплаты', description: 'к кредитам' },
            militaryManeuvers: { name: 'Военные манёвры', description: 'к свободному опыту' },
            tacticalTraining: { name: 'Тактическая подготовка', description: 'к боевому опыту' },
            highCapacityTransport: { name: 'Усиленный транспорт', description: '' },
            requisition: { name: 'Реквизиция', description: '' },
            inspire: { name: 'Вдохновение', description: '' },
            artilleryStrike: { name: 'Артиллерийский удар', description: '' },
        },
        en: {
            additionalBriefing: { name: 'Additional Briefing', description: 'to Crew Experience earned' },
            battlePayments: { name: 'Battle Payments', description: 'to credits earned' },
            militaryManeuvers: { name: 'Military Maneuvers', description: 'to Free Experience earned' },
            tacticalTraining: { name: 'Tactical Training', description: 'to Combat Experience earned' },
            highCapacityTransport: { name: 'High-Capacity Transport', description: '' },
            requisition: { name: 'Requisition', description: '' },
            inspire: { name: 'Inspire', description: '' },
            artilleryStrike: { name: 'Artillery Strike', description: '' },
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

    function translateLogError(message) {
        const code = String(message || '').trim().toUpperCase();
        if (!code) return '—';
        if (code === 'ACCESS_TOKEN_NOT_SPECIFIED' || code === 'TOKEN_EMPTY' || code === 'TOKEN_MISSING') {
            return t('logErrorToken');
        }
        if (String(message || '').includes('ACCESS_TOKEN_NOT_SPECIFIED')) {
            return t('logErrorTokenAppId');
        }
        if (code === 'TOKEN_DECRYPT_FAILED') {
            return t('logErrorTokenDecrypt');
        }
        if (code === 'LINK_MISSING') {
            return t('logErrorLinkMissing');
        }
        if (/RESERVE_ACTIVATION_ERROR|NOT_IN_CLAN|WRONG_RESERVE/i.test(code)) {
            return t('logErrorNoPermission');
        }
        if (/INVALID_LANGUAGE/i.test(code) || String(message || '').includes('INVALID_LANGUAGE')) {
            return t('logErrorInvalidLanguage');
        }
        if (/ALREADY|ACTIVE|COOLDOWN/i.test(code)) {
            return t('logErrorAlreadyActive');
        }
        return String(message || '').trim() || '—';
    }

    function translateApiError(data = {}, status = 0) {
        const code = String(data.error_code || '').trim();
        if (code === 'no_clan' || status === 409) {
            return t('errorNoClan');
        }
        if (code === 'token_expired' || code === 'token_missing' || code === 'token_decrypt_failed' || code === 'token_empty') {
            return t('relinkRequired');
        }
        return t('catalogLoadError');
    }

    function translateReserve(type, fallback = {}) {
        const lang = getLang();
        const key = String(type || '').trim();
        const entry = (key && RESERVE_TYPES[lang]?.[key]) || (key && RESERVE_TYPES.ru[key]) || {};
        const apiName = String(fallback.name || '').trim();
        const apiDescription = String(fallback.description || fallback.bonus_type || '').trim();

        return {
            name: entry.name || apiName || key,
            description: entry.description || apiDescription,
        };
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
        translateLogError,
        translateReserve,
        relocalizeDom,
        updateStaticDom,
        switchLanguage,
        buildReservesReturnPath,
        STRINGS,
        RESERVE_TYPES,
    };
})();
