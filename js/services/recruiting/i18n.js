(() => {
    const POST_TYPES = [
        'clan_seeks_players',
        'team_seeks_players',
        'player_seeks_clan',
        'player_seeks_team',
    ];

    const REALMS = ['ru', 'eu', 'na', 'asia'];

    const REALM_LABELS = {
        ru: 'RU',
        eu: 'EU',
        na: 'NA',
        asia: 'ASIA',
    };

    function realmDisplayLabel(realm) {
        return REALM_LABELS[realm] || String(realm || '').toUpperCase();
    }

    const STRINGS = {
        ru: {
            pageTitleBoard: 'Рекрутинг',
            pageTitlePost: 'Подать объявление',
            pageTitleEdit: 'Редактировать объявление',
            board: {
                title: 'Рекрутинг',
                hint: 'Кланы, команды и игроки ищут друг друга на серверах RU, EU, NA и ASIA.',
                postCta: 'Подать объявление',
            },
            formCreate: {
                title: 'Новое объявление',
                hint: 'Объявление будет проверено модератором перед публикацией.',
                back: 'К рекрутингу',
                submit: 'Отправить',
            },
            formEdit: {
                title: 'Редактирование объявления',
                hint: 'Измените объявление. Опубликованные объявления после сохранения снова попадают на модерацию.',
                back: 'К рекрутингу',
                submit: 'Сохранить',
                status: 'Статус',
                warnPublished: 'Сохранение изменений опубликованного объявления отправит его на повторную модерацию.',
            },
            filters: {
                aria: 'Фильтры',
                type: 'Тип',
                allTypes: 'Все типы',
                region: 'Регион',
                allRealms: 'Все',
                search: 'Поиск',
                searchPlaceholder: 'Текст, тег клана…',
                searchBtn: 'Найти',
            },
            form: {
                adType: 'Тип объявления',
                selectType: 'Выберите тип…',
                region: 'Регион',
                selectRegion: 'Выберите регион…',
                gameNickname: 'Игровой ник',
                gameNicknamePlaceholder: 'Ник на выбранном регионе',
                gameNicknameHint: 'Ник, уже привязанный к другому аккаунту на сайте, использовать нельзя.',
                description: 'Описание',
                descriptionPlaceholder: 'Требования, расписание, контакты в игре…',
                contacts: 'Контакты',
                contactsHint: 'Сохраняются для следующих объявлений. Можно изменить в личном кабинете.',
                clanOrTeam: 'Клан или команда',
                optional: 'Необязательно',
                clanTagPlaceholder: 'Тег клана',
                teamNamePlaceholder: 'Название команды',
                clanTagHint: 'Сохраняется для следующих объявлений. Можно изменить в личном кабинете.',
            },
            boardJs: {
                loading: 'Загрузка…',
                empty: 'Нет объявлений по выбранным фильтрам.',
                error: 'Не удалось загрузить объявления.',
                author: 'Автор',
                clanTagLabel: 'Тег клана',
                teamNameLabel: 'Название команды',
                prev: 'Назад',
                next: 'Вперёд',
                page: 'Страница',
                readMore: 'Читать полностью',
                showLess: 'Свернуть',
                discordCopyHint: 'Нажмите, чтобы скопировать Discord ID',
                discordCopied: 'Discord ID скопирован',
                viberCopyHint: 'Нажмите, чтобы скопировать номер Viber',
                viberCopied: 'Номер Viber скопирован',
            },
            formJs: {
                sending: 'Отправка…',
                successCreate: 'Объявление отправлено на модерацию',
                successEdit: 'Изменения сохранены',
                error: 'Не удалось сохранить объявление.',
                required: 'Заполните все обязательные поля.',
                bodyMin: 'Описание — не менее 10 символов.',
                nicknameInvalid: 'Игровой ник: до 24 символов, латиница, цифры, _ -',
                nicknameTaken: 'Этот ник уже привязан к аккаунту на сайте. Укажите другой ник.',
                clanTagRequired: 'Укажите тег клана.',
                teamNameRequired: 'Укажите название команды.',
            },
            postTypes: {
                clan_seeks_players: 'Клан ищет игроков',
                team_seeks_players: 'Команда ищет игроков',
                player_seeks_clan: 'Игрок ищет клан',
                player_seeks_team: 'Игрок ищет команду',
            },
            clanTagTypes: {
                clan_tag: 'Тег клана',
                team_name: 'Название команды',
            },
            statuses: {
                pending: 'На модерации',
                approved: 'Опубликовано',
                rejected: 'Отклонено',
                hidden: 'Скрыто',
            },
        },
        en: {
            pageTitleBoard: 'Recruiting',
            pageTitlePost: 'Post an ad',
            pageTitleEdit: 'Edit ad',
            board: {
                title: 'Recruiting',
                hint: 'Clans, teams, and players looking for each other across RU, EU, NA, and ASIA.',
                postCta: 'Post an ad',
            },
            formCreate: {
                title: 'New recruiting ad',
                hint: 'Your ad will be reviewed by a moderator before publication.',
                back: 'Back to recruiting',
                submit: 'Submit',
            },
            formEdit: {
                title: 'Edit recruiting ad',
                hint: 'Update your ad. Published ads go back to moderation after saving.',
                back: 'Back to recruiting',
                submit: 'Save changes',
                status: 'Status',
                warnPublished: 'Saving changes to a published ad sends it back for moderation.',
            },
            filters: {
                aria: 'Filters',
                type: 'Type',
                allTypes: 'All types',
                region: 'Region',
                allRealms: 'All',
                search: 'Search',
                searchPlaceholder: 'Text, clan tag…',
                searchBtn: 'Search',
            },
            form: {
                adType: 'Ad type',
                selectType: 'Select type…',
                region: 'Region',
                selectRegion: 'Select region…',
                gameNickname: 'Game nickname',
                gameNicknamePlaceholder: 'Nickname on selected region',
                gameNicknameHint: 'A nickname already linked to another site account cannot be used.',
                description: 'Description',
                descriptionPlaceholder: 'Requirements, schedule, contacts in-game…',
                contacts: 'Contacts',
                contactsHint: 'Saved for your next ads. You can also change defaults in your account.',
                clanOrTeam: 'Clan or team',
                optional: 'Optional',
                clanTagPlaceholder: 'Clan tag',
                teamNamePlaceholder: 'Team name',
                clanTagHint: 'Saved for your next ads. You can also change defaults in your account.',
            },
            boardJs: {
                loading: 'Loading…',
                empty: 'No ads match your filters.',
                error: 'Failed to load ads.',
                author: 'Author',
                clanTagLabel: 'Clan tag',
                teamNameLabel: 'Team name',
                prev: 'Previous',
                next: 'Next',
                page: 'Page',
                readMore: 'Read more',
                showLess: 'Show less',
                discordCopyHint: 'Click to copy Discord ID',
                discordCopied: 'Discord ID copied',
                viberCopyHint: 'Click to copy Viber number',
                viberCopied: 'Viber number copied',
            },
            formJs: {
                sending: 'Sending…',
                successCreate: 'Ad submitted for moderation',
                successEdit: 'Changes saved',
                error: 'Failed to save ad.',
                required: 'Fill in all required fields.',
                bodyMin: 'Description must be at least 10 characters.',
                nicknameInvalid: 'Game nickname: up to 24 characters, Latin letters, digits, _ -',
                nicknameTaken: 'This nickname is already linked to a site account. Choose another one.',
                clanTagRequired: 'Enter clan tag.',
                teamNameRequired: 'Enter team name.',
            },
            postTypes: {
                clan_seeks_players: 'Clan seeks players',
                team_seeks_players: 'Team seeks players',
                player_seeks_clan: 'Player seeks clan',
                player_seeks_team: 'Player seeks team',
            },
            clanTagTypes: {
                clan_tag: 'Clan tag',
                team_name: 'Team name',
            },
            statuses: {
                pending: 'Pending',
                approved: 'Published',
                rejected: 'Rejected',
                hidden: 'Hidden',
            },
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        if (window.ABS_RECRUITING_LANG === 'en' || window.ABS_RECRUITING_LANG === 'ru') {
            return normalizeLang(window.ABS_RECRUITING_LANG);
        }
        if (document.documentElement.lang === 'en') {
            return 'en';
        }
        return normalizeLang(window.ABS_LANG);
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_RECRUITING_LANG = normalized;
        window.ABS_LANG = normalized;
        return normalized;
    }

    function s(lang, section, key) {
        const dict = STRINGS[normalizeLang(lang)];
        return (dict[section] && dict[section][key]) || key;
    }

    function postTypeLabel(type, lang) {
        const dict = STRINGS[normalizeLang(lang)].postTypes;
        return dict[type] || type;
    }

    function clanTagTypeLabel(type, lang) {
        const dict = STRINGS[normalizeLang(lang)].clanTagTypes;
        return dict[type] || type;
    }

    function statusLabel(status, lang) {
        const dict = STRINGS[normalizeLang(lang)].statuses;
        return dict[status] || status;
    }

    function buildHref(lang, slug) {
        const clean = String(slug || '').replace(/^\/+/, '');
        if (!clean) {
            return normalizeLang(lang) === 'en' ? '/en' : '/';
        }
        return normalizeLang(lang) === 'en' ? `/en/${clean}` : `/${clean}`;
    }

    function postTypesForLang(lang) {
        return POST_TYPES.map((value) => ({
            value,
            label: postTypeLabel(value, lang),
        }));
    }

    function updateSelectOptions(select, lang, config) {
        if (!select) return;
        const normalized = normalizeLang(lang);
        const current = select.value;

        select.innerHTML = '';
        if (config.placeholder !== undefined) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = config.placeholder;
            if (config.placeholderDisabled) {
                placeholder.disabled = true;
                if (!current) placeholder.selected = true;
            }
            select.appendChild(placeholder);
        }

        (config.options || []).forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === current) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (current && select.value !== current) {
            select.value = current;
        }

        if (typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(select);
        }
    }

    function setDocumentTitle(pageTitle, lang) {
        if (typeof window.absSetDocumentTitle === 'function') {
            window.absSetDocumentTitle(pageTitle, lang);
            return;
        }
        document.title = pageTitle;
    }

    function updateBoardPage(lang) {
        const normalized = normalizeLang(lang);
        const dict = STRINGS[normalized];

        setDocumentTitle(dict.pageTitleBoard, normalized);

        const title = document.querySelector('.recruiting-board-header .recruiting-section-title');
        if (title) title.textContent = dict.board.title;

        const hint = document.querySelector('.recruiting-board-header .recruiting-section-hint');
        if (hint) hint.textContent = dict.board.hint;

        const cta = document.querySelector('.recruiting-board-header .recruiting-cta-btn');
        if (cta) {
            const icon = cta.querySelector('i');
            cta.textContent = '';
            if (icon) cta.appendChild(icon);
            cta.append(` ${dict.board.postCta}`);
            cta.href = buildHref(normalized, 'services/recruiting/post');
        }

        const filters = document.querySelector('.recruiting-filters');
        if (filters) filters.setAttribute('aria-label', dict.filters.aria);

        const typeLabel = document.querySelector('label[for="recruitingFilterType"]');
        if (typeLabel) typeLabel.textContent = dict.filters.type;

        const realmLabel = document.querySelector('.recruiting-realm-filter .recruiting-filter-label');
        if (realmLabel) realmLabel.textContent = dict.filters.region;

        const searchLabel = document.querySelector('label[for="recruitingFilterSearch"]');
        if (searchLabel) searchLabel.textContent = dict.filters.search;

        const searchInput = document.getElementById('recruitingFilterSearch');
        if (searchInput) searchInput.placeholder = dict.filters.searchPlaceholder;

        const searchBtnLabel = document.querySelector('.recruiting-search-btn__label');
        if (searchBtnLabel) searchBtnLabel.textContent = dict.filters.searchBtn;

        const typeSelect = document.getElementById('recruitingFilterType');
        updateSelectOptions(typeSelect, normalized, {
            placeholder: dict.filters.allTypes,
            options: postTypesForLang(normalized),
        });

        const allRealmTab = document.querySelector('.recruiting-realm-tab[data-realm=""]');
        if (allRealmTab) allRealmTab.textContent = dict.filters.allRealms;

        REALMS.forEach((realm) => {
            const tab = document.querySelector(`.recruiting-realm-tab[data-realm="${realm}"]`);
            if (tab) tab.textContent = realmDisplayLabel(realm);
        });
    }

    function updateFormPage(lang) {
        const normalized = normalizeLang(lang);
        const isEdit = window.ABS_RECRUITING_FORM_MODE === 'edit';
        const dict = STRINGS[normalized];
        const formDict = isEdit ? dict.formEdit : dict.formCreate;

        setDocumentTitle(isEdit ? dict.pageTitleEdit : dict.pageTitlePost, normalized);

        const title = document.querySelector('.recruiting-form-panel .recruiting-section-title');
        if (title) title.textContent = formDict.title;

        const hint = document.querySelector('.recruiting-form-panel .recruiting-section-hint');
        if (hint) hint.textContent = formDict.hint;

        const back = document.querySelector('.recruiting-form-panel .recruiting-back-link');
        if (back) {
            const icon = back.querySelector('i');
            back.textContent = '';
            if (icon) back.appendChild(icon);
            back.append(` ${formDict.back}`);
            back.href = buildHref(normalized, 'services/recruiting');
            window.ABS_RECRUITING_BOARD_HREF = back.href;
        }

        const submitBtn = document.getElementById('recruitingSubmitBtn');
        if (submitBtn && !submitBtn.disabled) {
            const iconClass = isEdit ? 'fas fa-save' : 'fas fa-paper-plane';
            submitBtn.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i> ${formDict.submit}`;
        }

        const postTypeLabelEl = document.querySelector('label[for="recruitingPostType"]');
        if (postTypeLabelEl) {
            postTypeLabelEl.innerHTML = `${dict.form.adType} <span class="recruiting-required">*</span>`;
        }

        const realmLabelEl = document.querySelector('label[for="recruitingRealm"]');
        if (realmLabelEl) {
            realmLabelEl.innerHTML = `${dict.form.region} <span class="recruiting-required">*</span>`;
        }

        const nicknameLabelEl = document.querySelector('label[for="recruitingGameNickname"]');
        if (nicknameLabelEl) {
            nicknameLabelEl.innerHTML = `${dict.form.gameNickname} <span class="recruiting-required">*</span>`;
        }

        const nicknameInput = document.getElementById('recruitingGameNickname');
        if (nicknameInput) {
            nicknameInput.placeholder = dict.form.gameNicknamePlaceholder;
            nicknameInput.title = dict.formJs.nicknameInvalid;
        }

        const nicknameHint = document.getElementById('recruitingGameNicknameHint');
        if (nicknameHint) nicknameHint.textContent = dict.form.gameNicknameHint;

        const bodyLabelEl = document.querySelector('label[for="recruitingBody"]');
        if (bodyLabelEl) {
            bodyLabelEl.innerHTML = `${dict.form.description} <span class="recruiting-required">*</span>`;
        }

        const bodyInput = document.getElementById('recruitingBody');
        if (bodyInput) bodyInput.placeholder = dict.form.descriptionPlaceholder;

        updateSelectOptions(document.getElementById('recruitingPostType'), normalized, {
            placeholder: dict.form.selectType,
            placeholderDisabled: true,
            options: postTypesForLang(normalized),
        });

        updateSelectOptions(document.getElementById('recruitingRealm'), normalized, {
            placeholder: dict.form.selectRegion,
            placeholderDisabled: true,
            options: REALMS.map((value) => ({ value, label: realmDisplayLabel(value) })),
        });

        const contactsLabel = document.querySelector('.recruiting-contacts-editor')?.closest('.recruiting-form-field')?.querySelector('.recruiting-form-label');
        if (contactsLabel) contactsLabel.textContent = dict.form.contacts;

        const contactsHint = document.querySelector('.recruiting-contacts-editor')?.closest('.recruiting-form-field')?.querySelector('.recruiting-form-hint');
        if (contactsHint) contactsHint.textContent = dict.form.contactsHint;

        document.querySelectorAll('.recruiting-clan-tag-field').forEach((field) => {
            field.dataset.lang = normalized;
            const labelText = field.querySelector('.recruiting-clan-tag-label-text');
            if (labelText && field.dataset.autoType !== '1') {
                labelText.textContent = dict.form.clanOrTeam;
            }

            const typeSelect = field.querySelector('select.recruiting-clan-tag-type');
            if (typeSelect) {
                updateSelectOptions(typeSelect, normalized, {
                    options: ['clan_tag', 'team_name'].map((value) => ({
                        value,
                        label: clanTagTypeLabel(value, normalized),
                    })),
                });
            }

            const valueInput = field.querySelector('.recruiting-clan-tag-value');
            if (valueInput && field.dataset.autoType !== '1') {
                valueInput.placeholder = dict.form.optional;
            }

            const clanHint = field.querySelector('.recruiting-form-hint');
            if (clanHint) clanHint.textContent = dict.form.clanTagHint;
        });

        document.querySelectorAll('.recruiting-contacts-editor').forEach((root) => {
            root.dataset.lang = normalized;
        });

        const statusNote = document.querySelector('.recruiting-form-status-note');
        if (statusNote && isEdit) {
            const badge = statusNote.querySelector('.recruiting-status-badge');
            if (badge) {
                const status = badge.className.match(/recruiting-status-badge--(\w+)/);
                if (status && status[1]) {
                    badge.textContent = statusLabel(status[1], normalized);
                }
            }
            const firstChild = statusNote.childNodes[0];
            if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                statusNote.childNodes[0].textContent = `${dict.formEdit.status}: `;
            }
        }

        const warnHint = document.querySelector('.recruiting-form-hint--warn');
        if (warnHint) warnHint.textContent = dict.formEdit.warnPublished;
    }

    function updateStaticDom(lang) {
        const normalized = normalizeLang(lang);
        if (document.getElementById('recruitingPostList')) {
            updateBoardPage(normalized);
        }
        if (document.getElementById('recruitingForm')) {
            updateFormPage(normalized);
        }
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        updateStaticDom(normalized);
        window.dispatchEvent(new CustomEvent('recruiting:langchange', { detail: { lang: normalized } }));
        return true;
    }

    window.AbsRecruitingI18n = {
        STRINGS,
        POST_TYPES,
        REALMS,
        realmDisplayLabel,
        normalizeLang,
        getLang,
        setLang,
        s,
        postTypeLabel,
        clanTagTypeLabel,
        statusLabel,
        buildHref,
        postTypesForLang,
        updateStaticDom,
        switchLanguage,
    };
})();
