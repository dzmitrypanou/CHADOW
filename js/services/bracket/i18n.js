(() => {
    'use strict';

    const STRINGS = {
        ru: {
            serviceTitle: 'Генератор турнирных сеток',
            serviceHint: 'Создавайте и редактируйте турнирные сетки для клановых и командных ивентов.',
            createCta: 'Создать сетку',
            catalogTitle: 'Публичные сетки',
            catalogEmpty: 'Пока нет публичных сеток.',
            catalogLoading: 'Загрузка…',
            catalogError: 'Не удалось загрузить каталог.',
            guestHint: 'Для создания сетки необходимо войти в аккаунт.',
            loginToCreateCta: 'Войти для создания',
            formatSingle: 'Single Elimination',
            formatDouble: 'Double Elimination',
            formatGroup: 'Group Stage',
            formatGroupSe: 'Group Stage + SE',
            formatGroupDe: 'Group Stage + DE',
            groupWinnerTier: 'Победитель группы {n}',
            visibilityPublic: 'Публичная',
            visibilityHidden: 'По ссылке',
            visibilityPublicCatalog: 'Публичная (каталог)',
            visibilityHiddenLink: 'По ссылке (без каталога)',
            visibilityPublicAccess: 'Публичный доступ',
            visibilityLinkAccess: 'Доступ по ссылке',
            statusHidden: 'Скрыта модератором',
            createTitlePlaceholder: 'Glads Leagues #1',
            participantsPlaceholder: 'Команда А или Игрок 1',
            fieldVisibility: 'Видимость',
            back: 'Назад',
            view: 'Просмотр',
            creator: 'Организатор',
            guestEditingHint: 'Без входа редактирование доступно только с этого браузера.',
            createTitle: 'Новая сетка',
            createHint: 'Заполните параметры и список участников.',
            backToList: 'К сеткам',
            fieldTitle: 'Название',
            fieldFormat: 'Тип сетки',
            fieldMatchFormat: 'Формат матчей',
            fieldGame: 'Игра',
            fieldGameRealm: 'Сервер',
            gameMirTankov: 'Мир танков',
            gameWot: 'WoT',
            gameCsgo: 'CS2',
            gameDota2: 'Dota 2',
            fieldParticipants: 'Участники',
            fieldBracketSize: 'Размер сетки',
            bracketSizeHint: 'Максимальное число участников. Пустые строки — слоты под BYE.',
            applyParticipants: 'Обновить участников',
            participantsEditHint: 'Изменение состава сбросит все результаты матчей.',
            participantsHint: 'Минимум 2 участника.',
            participantsExceedSize: 'Удалите лишних участников или увеличьте размер сетки.',
            fieldGroupCount: 'Число групп',
            fieldAdvancePerGroup: 'Проходит из группы',
            groupParticipantsHint: 'По одной команде или игроку на строку в каждой группе.',
            groupParticipantsPlaceholder: 'Команда А',
            groupMinGroupsHint: 'Заполните минимум две группы.',
            submitCreate: 'Создать',
            editTitle: 'Редактирование',
            viewTitle: 'Просмотр сетки',
            save: 'Сохранить',
            delete: 'Удалить',
            copyLink: 'Копировать ссылку',
            linkCopied: 'Ссылка скопирована',
            edit: 'Редактировать',
            noEditRights: 'Нет прав на редактирование',
            confirmDelete: 'Удалить сетку без возможности восстановления?',
            confirmRegenerate: 'Изменение участников сбросит все результаты. Продолжить?',
            saving: 'Сохранение…',
            saved: 'Сохранено',
            saveError: 'Ошибка сохранения',
            createError: 'Ошибка создания',
            guestTokenWarning: 'Сохраните эту страницу — без входа доступ к редактированию только с этого браузера.',
            claimedToAccount: 'Гостевая сетка привязана к вашему аккаунту.',
            round: 'Раунд',
            bracketWinner: 'Победитель',
            winners: 'Верхняя сетка',
            losers: 'Нижняя сетка',
            grandFinal: 'Финал',
            resetFinal: 'Перезапуск',
            group: 'Группа',
            groupStandings: 'Таблица',
            groupViewSearchLabel: 'Поиск группы',
            groupViewSearchPlaceholder: 'Группа или участник…',
            groupViewNotFound: 'Группа не найдена',
            playoff: 'Плей-офф',
            wins: 'П',
            losses: 'П',
            points: 'О',
            vs: 'против',
            bye: 'BYE',
            clickWinner: 'Нажмите на победителя',
            score: 'Счёт',
            participantCount: 'участников',
            profileTitle: 'Мои сетки',
            profileEmpty: 'У вас пока нет сеток.',
            profileLoading: 'Загрузка…',
            description: 'Описание',
            descriptionPlaceholder: 'Правила, расписание, контакты…',
            startsAt: 'Старт турнира',
            noDate: 'Без даты',
            completedAt: 'Завершён',
            prizePool: 'Призовой фонд',
            prizePlace1: '1 место',
            prizePlace2: '2 место',
            prizePlaceSuffix: 'место',
            prizePlaceholder: 'Награда…',
            prizeUnitNone: '—',
            prizeUnitGold: 'ед. золота',
            prizeUnitRub: 'руб.',
            prizeUnitUsd: '$',
            tournamentResults: 'Результаты',
            resultPending: '—',
            datetimePlaceholder: 'Выберите дату и время…',
            datetimeTime: 'Время',
            datetimeClear: 'Очистить',
            datetimeToday: 'Сегодня',
            datetimeSelect: 'Выбрать',
            datetimePrevMonth: 'Предыдущий месяц',
            datetimeNextMonth: 'Следующий месяц',
            phaseUpcoming: 'Скоро',
            phaseLive: 'Идёт',
            phaseCompleted: 'Завершён',
            markCompleted: 'Зафиксировать завершение',
            reopenTournament: 'Открыть снова',
            confirmComplete: 'Зафиксировать завершение турнира? Результаты нельзя будет менять.',
            tournamentCompletedHint: 'Турнир завершён. Чтобы изменить результаты, нажмите «Открыть снова».',
            generatePlayoff: 'Сформировать плей-офф',
            regeneratePlayoff: 'Пересформировать плей-офф',
            groupStageIncomplete: 'Завершите все матчи группового этапа ({pending} осталось).',
            groupStageComplete: 'Групповой этап завершён — можно сформировать плей-офф ({count} участников).',
            confirmRegeneratePlayoff: 'Пересформировать плей-офф? Текущие результаты плей-офф будут сброшены.',
            notEnoughQualifiers: 'Недостаточно участников для плей-офф.',
        },
        en: {
            serviceTitle: 'Tournament Bracket Generator',
            serviceHint: 'Create and edit tournament brackets for clan and team events.',
            createCta: 'Create bracket',
            catalogTitle: 'Public brackets',
            catalogEmpty: 'No public brackets yet.',
            catalogLoading: 'Loading…',
            catalogError: 'Failed to load catalog.',
            guestHint: 'Sign in to create a bracket.',
            loginToCreateCta: 'Sign in to create',
            formatSingle: 'Single elimination',
            formatDouble: 'Double elimination',
            formatGroup: 'Group stage',
            formatGroupSe: 'Group stage + SE',
            formatGroupDe: 'Group stage + DE',
            groupWinnerTier: 'Group {n} winner',
            visibilityPublic: 'Public',
            visibilityHidden: 'Unlisted',
            visibilityPublicCatalog: 'Public (catalog)',
            visibilityHiddenLink: 'Unlisted (link only)',
            visibilityPublicAccess: 'Public access',
            visibilityLinkAccess: 'Link access',
            statusHidden: 'Hidden by moderator',
            createTitlePlaceholder: 'Glads Leagues #1',
            participantsPlaceholder: 'Team A or Player 1',
            fieldVisibility: 'Visibility',
            back: 'Back',
            view: 'View',
            creator: 'Organizer',
            guestEditingHint: 'Without login, editing is only available in this browser.',
            createTitle: 'New bracket',
            createHint: 'Fill in settings and participant list.',
            backToList: 'Back to brackets',
            fieldTitle: 'Title',
            fieldFormat: 'Bracket type',
            fieldMatchFormat: 'Match format',
            fieldGame: 'Game',
            fieldGameRealm: 'Server',
            gameMirTankov: 'Mir Tankov',
            gameWot: 'WoT',
            gameCsgo: 'CS2',
            gameDota2: 'Dota 2',
            fieldParticipants: 'Participants',
            fieldBracketSize: 'Bracket size',
            bracketSizeHint: 'Maximum participants. Empty lines become BYE slots.',
            applyParticipants: 'Update participants',
            participantsEditHint: 'Changing the roster will reset all match results.',
            participantsHint: 'At least 2 participants.',
            participantsExceedSize: 'Remove extra participants or increase the bracket size.',
            fieldGroupCount: 'Number of groups',
            fieldAdvancePerGroup: 'Advance per group',
            groupParticipantsHint: 'One team or player per line in each group.',
            groupParticipantsPlaceholder: 'Team A',
            groupMinGroupsHint: 'Fill in at least two groups.',
            submitCreate: 'Create',
            editTitle: 'Edit bracket',
            viewTitle: 'View bracket',
            save: 'Save',
            delete: 'Delete',
            copyLink: 'Copy link',
            linkCopied: 'Link copied',
            edit: 'Edit',
            noEditRights: 'No edit permissions',
            confirmDelete: 'Delete bracket permanently?',
            confirmRegenerate: 'Changing participants will reset all results. Continue?',
            saving: 'Saving…',
            saved: 'Saved',
            saveError: 'Save failed',
            createError: 'Create failed',
            guestTokenWarning: 'Bookmark this page — without login, editing is only available in this browser.',
            claimedToAccount: 'Guest bracket linked to your account.',
            round: 'Round',
            bracketWinner: 'Winner',
            winners: 'Winners bracket',
            losers: 'Losers bracket',
            grandFinal: 'Grand final',
            resetFinal: 'Reset match',
            group: 'Group',
            groupStandings: 'Standings',
            groupViewSearchLabel: 'Search groups',
            groupViewSearchPlaceholder: 'Group or participant…',
            groupViewNotFound: 'Group not found',
            playoff: 'Playoff',
            wins: 'W',
            losses: 'L',
            points: 'Pts',
            vs: 'vs',
            bye: 'BYE',
            clickWinner: 'Click the winner',
            score: 'Score',
            participantCount: 'participants',
            profileTitle: 'My brackets',
            profileEmpty: 'You have no brackets yet.',
            profileLoading: 'Loading…',
            description: 'Description',
            descriptionPlaceholder: 'Rules, schedule, contacts…',
            startsAt: 'Tournament start',
            noDate: 'No date',
            completedAt: 'Completed',
            prizePool: 'Prize pool',
            prizePlace1: '1st place',
            prizePlace2: '2nd place',
            prizePlaceSuffix: 'place',
            prizePlaceholder: 'Reward…',
            prizeUnitNone: '—',
            prizeUnitGold: 'gold',
            prizeUnitRub: 'RUB',
            prizeUnitUsd: '$',
            tournamentResults: 'Results',
            resultPending: '—',
            datetimePlaceholder: 'Pick date and time…',
            datetimeTime: 'Time',
            datetimeClear: 'Clear',
            datetimeToday: 'Today',
            datetimeSelect: 'Select',
            datetimePrevMonth: 'Previous month',
            datetimeNextMonth: 'Next month',
            phaseUpcoming: 'Upcoming',
            phaseLive: 'Live',
            phaseCompleted: 'Completed',
            markCompleted: 'Mark as completed',
            reopenTournament: 'Reopen tournament',
            confirmComplete: 'Mark tournament as completed? Results cannot be changed until reopened.',
            tournamentCompletedHint: 'Tournament completed. Click «Reopen» to edit results.',
            generatePlayoff: 'Generate playoff',
            regeneratePlayoff: 'Regenerate playoff',
            groupStageIncomplete: 'Complete all group stage matches ({pending} remaining).',
            groupStageComplete: 'Group stage complete — generate playoff ({count} qualifiers).',
            confirmRegeneratePlayoff: 'Regenerate playoff? Current playoff results will be reset.',
            notEnoughQualifiers: 'Not enough qualifiers for playoff.',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_BRACKET_LANG = normalized;
        window.ABS_LANG = normalized;
        return normalized;
    }

    function getLang() {
        if (window.ABS_BRACKET_LANG === 'en' || window.ABS_PROFILE_LANG === 'en') return 'en';
        if (window.ABS_BRACKET_LANG === 'ru') return 'ru';
        if (window.ABS_LANG === 'en') return 'en';
        return 'ru';
    }

    function t(key) {
        const lang = getLang();
        return STRINGS[lang][key] ?? STRINGS.ru[key] ?? key;
    }

    function updateLinkWithIcon(link, text, href) {
        if (!link) return;
        const icon = link.querySelector('i');
        link.textContent = '';
        if (icon) link.appendChild(icon);
        link.append(` ${text}`);
        if (href) link.href = href;
    }

    function updateSelectOptions(select, lang, options) {
        if (!select) return;
        const current = select.value;
        select.innerHTML = options.map((opt) => (
            `<option value="${opt.value}">${opt.label}</option>`
        )).join('');
        if (current && [...select.options].some((o) => o.value === current)) {
            select.value = current;
        }
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function syncCustomSelect(select) {
        if (!select) return;
        if (typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(select);
        }
    }

    function updateCatalogPage(lang) {
        const title = document.querySelector('.bracket-service-header .bracket-section-title');
        if (title) title.textContent = t('serviceTitle');

        const hint = document.querySelector('.bracket-service-header .bracket-section-hint');
        if (hint) hint.textContent = t('serviceHint');

        const guestHint = document.querySelector('.bracket-service-header .bracket-guest-hint');
        if (guestHint) guestHint.textContent = t('guestHint');

        const cta = document.querySelector('.bracket-service-header .bracket-cta-btn');
        if (cta) {
            const isLoggedIn = window.ABS_BRACKET_IS_LOGGED_IN !== false;
            const icon = cta.querySelector('i');
            cta.textContent = '';
            if (icon) cta.appendChild(icon);
            cta.append(` ${isLoggedIn ? t('createCta') : t('loginToCreateCta')}`);
            cta.href = isLoggedIn
                ? buildHref('services/bracket/create')
                : (window.ABS_BRACKET_LOGIN_HREF || buildHref('auth/login'));
        }

        const catalogTitle = document.querySelector('.bracket-catalog-title');
        if (catalogTitle) catalogTitle.textContent = t('catalogTitle');
    }

    function updateCreatePage(lang) {
        const title = document.querySelector('.bracket-form-panel .bracket-section-title');
        if (title) title.textContent = t('createTitle');

        const hint = document.querySelector('.bracket-form-panel .bracket-section-hint');
        if (hint) hint.textContent = t('createHint');

        updateLinkWithIcon(
            document.querySelector('.bracket-form-panel .bracket-back-link'),
            t('backToList'),
            buildHref('services/bracket')
        );

        const labelMap = [
            ['bracketTitle', 'fieldTitle'],
            ['bracketFormat', 'fieldFormat'],
            ['bracketMatchFormat', 'fieldMatchFormat'],
            ['bracketParticipantSize', 'fieldBracketSize'],
            ['bracketGroupCount', 'fieldGroupCount'],
            ['bracketAdvancePerGroup', 'fieldAdvancePerGroup'],
            ['bracketVisibility', 'fieldVisibility'],
            ['bracketDescription', 'description'],
            ['bracketStartsAt', 'startsAt'],
            ['bracketParticipants', 'fieldParticipants'],
        ];
        labelMap.forEach(([id, key]) => {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) label.textContent = t(key);
            const spanLabel = document.getElementById(`${id}-label`);
            if (spanLabel) spanLabel.textContent = t(key);
        });

        window.AbsBracketEditor?.refreshBracketVisibilitySwitchLabels?.();

        window.AbsBracketDatetime?.refreshAll?.();

        const titleInput = document.getElementById('bracketTitle');
        if (titleInput) titleInput.placeholder = t('createTitlePlaceholder');

        const descInput = document.getElementById('bracketDescription');
        if (descInput) descInput.placeholder = t('descriptionPlaceholder');

        const participantsInput = document.getElementById('bracketParticipants');
        if (participantsInput) participantsInput.placeholder = t('participantsPlaceholder');

        const participantsHint = document.querySelector('#bracketParticipants')?.closest('.bracket-form-group')?.querySelector('.bracket-form-hint');
        if (participantsHint) participantsHint.textContent = t('bracketSizeHint');

        const submitBtn = document.querySelector('#bracketCreateForm .bracket-submit-btn');
        if (submitBtn) {
            const icon = submitBtn.querySelector('i');
            submitBtn.textContent = '';
            if (icon) submitBtn.appendChild(icon);
            submitBtn.append(` ${t('submitCreate')}`);
        }

        updateSelectOptions(document.getElementById('bracketFormat'), lang, [
            { value: 'single', label: STRINGS[lang].formatSingle },
            { value: 'double', label: STRINGS[lang].formatDouble },
            { value: 'group', label: STRINGS[lang].formatGroup },
            { value: 'group_se', label: STRINGS[lang].formatGroupSe },
            { value: 'group_de', label: STRINGS[lang].formatGroupDe },
        ]);
        syncCustomSelect(document.getElementById('bracketFormat'));

        const matchFormatSelect = document.getElementById('bracketMatchFormat');
        if (matchFormatSelect) {
            const options = [...matchFormatSelect.options].map((opt) => ({
                value: opt.value,
                label: window.AbsBracketMatchFormat?.label(opt.value) || opt.value.toUpperCase(),
            }));
            updateSelectOptions(matchFormatSelect, lang, options);
            syncCustomSelect(matchFormatSelect);
        }

        window.AbsBracketEditor?.refreshCreatePrizeFields?.();
        document.querySelectorAll('[data-bracket-game-picker]').forEach((root) => {
            window.AbsBracketGames?.refreshPickerI18n?.(root);
        });
    }

    function updateEditPage(lang) {
        const title = document.querySelector('#bracketEditorRoot .bracket-section-title');
        if (title) title.textContent = t('editTitle');

        const modBadge = document.querySelector('.bracket-moderation-badge');
        if (modBadge) modBadge.textContent = t('statusHidden');

        const viewLink = document.querySelector('#bracketEditorRoot .bracket-section-actions a .fa-eye')?.closest('a');
        if (viewLink) {
            const publicId = window.ABS_BRACKET_PUBLIC_ID;
            const href = publicId ? buildHref(`services/bracket/${publicId}`) : viewLink.href;
            updateLinkWithIcon(viewLink, t('view'), href);
        }

        const backLink = document.querySelector('#bracketEditorRoot .bracket-section-actions__back');
        if (backLink) {
            updateLinkWithIcon(backLink, t('back'), buildHref('services/bracket'));
        }

        const labelMap = [
            ['bracketEditTitle', 'fieldTitle'],
            ['bracketEditVisibility', 'fieldVisibility'],
            ['bracketEditMatchFormat', 'fieldMatchFormat'],
            ['bracketEditParticipantSize', 'fieldBracketSize'],
            ['bracketEditParticipants', 'fieldParticipants'],
            ['bracketEditStartsAt', 'startsAt'],
        ];
        labelMap.forEach(([id, key]) => {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) label.textContent = t(key);
            const spanLabel = document.getElementById(`${id}-label`);
            if (spanLabel) spanLabel.textContent = t(key);
        });

        window.AbsBracketEditor?.refreshBracketVisibilitySwitchLabels?.();

        window.AbsBracketDatetime?.refreshAll?.();

        const saveBtn = document.getElementById('bracketSaveBtn');
        if (saveBtn) {
            const icon = saveBtn.querySelector('i');
            saveBtn.textContent = '';
            if (icon) saveBtn.appendChild(icon);
            saveBtn.append(` ${t('save')}`);
        }

        updateLinkWithIcon(document.getElementById('bracketCopyLinkBtn'), t('copyLink'), null);

        const deleteBtn = document.getElementById('bracketDeleteBtn');
        if (deleteBtn) {
            const icon = deleteBtn.querySelector('i');
            deleteBtn.textContent = '';
            if (icon) deleteBtn.appendChild(icon);
            deleteBtn.append(` ${t('delete')}`);
        }

        const noEditMsg = document.getElementById('bracketNoEditMsg');
        if (noEditMsg) noEditMsg.textContent = t('noEditRights');

        const guestHint = document.querySelector('#bracketEditControls .bracket-guest-hint');
        if (guestHint) guestHint.textContent = t('guestEditingHint');

        const editParticipantsHint = document.querySelector('#bracketParticipantsPanel .bracket-participants-edit-hint');
        if (editParticipantsHint) editParticipantsHint.textContent = t('participantsEditHint');

        document.querySelectorAll('[data-bracket-game-picker]').forEach((root) => {
            window.AbsBracketGames?.refreshPickerI18n?.(root);
        });

        const groupSearch = document.getElementById('bracketGroupViewSearch');
        if (groupSearch) {
            groupSearch.placeholder = t('groupViewSearchPlaceholder');
            groupSearch.setAttribute('aria-label', t('groupViewSearchLabel'));
        }

        document.querySelectorAll('.bracket-group-tab').forEach((tab) => {
            const idx = parseInt(tab.dataset.groupIndex, 10);
            if (Number.isFinite(idx)) {
                tab.textContent = `${t('group')} ${idx + 1}`;
            }
        });

        window.AbsBracketMeta?.renderHeaderMeta?.(
            document.getElementById('bracketHeaderMeta'),
            window.ABS_BRACKET_INITIAL || {}
        );
    }

    function updateViewPage(lang) {
        const item = window.ABS_BRACKET_INITIAL || {};

        window.AbsBracketMeta?.renderHeaderMeta?.(
            document.getElementById('bracketHeaderMeta'),
            item
        );

        updateLinkWithIcon(document.getElementById('bracketCopyLinkBtn'), t('copyLink'), null);

        const creatorLabel = document.querySelector('.bracket-view-creator-label');
        if (creatorLabel) creatorLabel.textContent = `${t('creator')}:`;

        document.querySelectorAll('.page-bracket-view .bracket-cta-btn').forEach((btn) => {
            const icon = btn.querySelector('i');
            btn.textContent = '';
            if (icon) btn.appendChild(icon);
            btn.append(` ${t('edit')}`);
            const publicId = window.ABS_BRACKET_PUBLIC_ID;
            if (publicId) btn.href = buildHref(`services/bracket/${publicId}/edit`);
        });

        updateLinkWithIcon(
            document.querySelector('.page-bracket-view .bracket-section-actions__back'),
            t('back'),
            buildHref('services/bracket')
        );

        const groupSearch = document.getElementById('bracketGroupViewSearch');
        if (groupSearch) {
            groupSearch.placeholder = t('groupViewSearchPlaceholder');
            groupSearch.setAttribute('aria-label', t('groupViewSearchLabel'));
        }

        document.querySelectorAll('.bracket-group-tab').forEach((tab) => {
            const idx = parseInt(tab.dataset.groupIndex, 10);
            if (Number.isFinite(idx)) {
                tab.textContent = `${t('group')} ${idx + 1}`;
            }
        });
    }

    function updateStaticDom(lang) {
        const normalized = normalizeLang(lang);
        if (document.getElementById('bracketCatalogList')) {
            updateCatalogPage(normalized);
        }
        if (document.getElementById('bracketCreateForm')) {
            updateCreatePage(normalized);
            window.dispatchEvent(new CustomEvent('bracket:create-sync'));
        }
        if (document.getElementById('bracketEditorRoot')) {
            updateEditPage(normalized);
        }
        if (document.body.classList.contains('page-bracket-view')) {
            updateViewPage(normalized);
        }
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        updateStaticDom(normalized);
        window.dispatchEvent(new CustomEvent('bracket:langchange', { detail: { lang: normalized } }));
        return normalized;
    }

    function matchFormatLabel(matchFormat) {
        return window.AbsBracketMatchFormat?.label(matchFormat) || String(matchFormat || 'BO1').toUpperCase();
    }

    function formatLabel(format) {
        const map = {
            single: t('formatSingle'),
            double: t('formatDouble'),
            group: t('formatGroup'),
            group_se: t('formatGroupSe'),
            group_de: t('formatGroupDe'),
        };
        return map[format] || format;
    }

    function phaseLabel(phase) {
        const map = {
            upcoming: t('phaseUpcoming'),
            live: t('phaseLive'),
            completed: t('phaseCompleted'),
        };
        return map[phase] || phase;
    }

    function buildHref(path) {
        const lang = getLang();
        const clean = String(path || '').replace(/^\//, '');
        if (lang === 'en') {
            return clean ? `/en/${clean}` : '/en';
        }
        return clean ? `/${clean}` : '/';
    }

    window.AbsBracketI18n = {
        t,
        getLang,
        setLang,
        normalizeLang,
        formatLabel,
        matchFormatLabel,
        phaseLabel,
        buildHref,
        updateStaticDom,
        switchLanguage,
        STRINGS,
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.body.classList.contains('page-bracket')) return;
        const bootLang = normalizeLang(window.ABS_BRACKET_LANG || document.documentElement.lang);
        setLang(bootLang);
        updateStaticDom(bootLang);
    });
})();
