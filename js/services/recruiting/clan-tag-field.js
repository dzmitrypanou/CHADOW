(() => {
    const MAX = {
        clan_tag: 16,
        team_name: 64,
    };

    const SENTINELS = {
        noClan: { ru: 'Без клана', en: 'Without clan' },
        noTeam: { ru: 'Без команды', en: 'Without team' },
    };

    const POST_TYPE_RULES = {
        player_seeks_clan: { mode: 'locked', type: 'clan_tag', sentinel: 'noClan' },
        player_seeks_team: { mode: 'locked', type: 'team_name', sentinel: 'noTeam' },
        clan_seeks_players: { mode: 'required', type: 'clan_tag' },
        team_seeks_players: { mode: 'required', type: 'team_name' },
    };

    function labelFor(type, lang) {
        if (window.AbsRecruitingI18n) {
            return window.AbsRecruitingI18n.clanTagTypeLabel(type, lang);
        }
        if (lang === 'en') {
            return type === 'team_name' ? 'Team name' : 'Clan tag';
        }
        return type === 'team_name' ? 'Название команды' : 'Тег клана';
    }

    function placeholderFor(type, lang) {
        if (window.AbsRecruitingI18n) {
            const dict = window.AbsRecruitingI18n.STRINGS[lang === 'en' ? 'en' : 'ru'];
            if (type === 'team_name') {
                return dict.form.teamNamePlaceholder || (lang === 'en' ? 'Team name' : 'Название команды');
            }
            return dict.form.clanTagPlaceholder || (lang === 'en' ? 'Clan tag' : 'Тег клана');
        }
        if (lang === 'en') {
            return type === 'team_name' ? 'Team name' : 'Clan tag';
        }
        return type === 'team_name' ? 'Название команды' : 'Тег клана';
    }

    function optionalPlaceholder(lang) {
        if (window.AbsRecruitingI18n) {
            return window.AbsRecruitingI18n.STRINGS[lang === 'en' ? 'en' : 'ru'].form.optional;
        }
        return lang === 'en' ? 'Optional' : 'Необязательно';
    }

    function sentinelValue(key, lang) {
        const bucket = SENTINELS[key];
        if (!bucket) return '';
        return bucket[lang === 'en' ? 'en' : 'ru'] || bucket.ru;
    }

    function isSentinelValue(value) {
        const v = String(value || '').trim();
        return Object.keys(SENTINELS).some((key) => {
            const bucket = SENTINELS[key];
            return bucket.ru === v || bucket.en === v;
        });
    }

    function getLang(field) {
        return field && field.dataset.lang === 'en' ? 'en' : 'ru';
    }

    function getClanPrefs(extra) {
        const prefs = window.ABS_RECRUITING_CLAN_PREFS;
        const initial = window.ABS_RECRUITING_INITIAL_FORM;
        const source = extra && typeof extra === 'object' ? extra : {};
        return {
            clan_tag: String(
                source.clan_tag
                || (prefs && prefs.clan_tag)
                || (initial && initial.clan_tag)
                || ''
            ).trim(),
            team_name: String(
                source.team_name
                || (prefs && prefs.team_name)
                || (initial && initial.team_name)
                || ''
            ).trim(),
            clan_tag_type: String(
                source.clan_tag_type
                || (initial && initial.clan_tag_type)
                || 'clan_tag'
            ).trim() || 'clan_tag',
        };
    }

    function clanValueForPostType(postType, prefs, lang) {
        const source = prefs && typeof prefs === 'object' ? prefs : getClanPrefs();
        const rule = POST_TYPE_RULES[String(postType || '').trim()];
        const normalizedLang = lang === 'en' ? 'en' : 'ru';

        if (rule && rule.mode === 'locked') {
            return sentinelValue(rule.sentinel, normalizedLang);
        }
        if (rule && rule.mode === 'required') {
            return rule.type === 'team_name'
                ? String(source.team_name || '').trim()
                : String(source.clan_tag || '').trim();
        }

        const type = String(source.clan_tag_type || 'clan_tag').trim() || 'clan_tag';
        return type === 'team_name'
            ? String(source.team_name || '').trim()
            : String(source.clan_tag || '').trim();
    }

    function findFormClanField() {
        const form = document.getElementById('recruitingForm');
        if (!form) return null;
        return form.querySelector('.recruiting-clan-tag-field');
    }

    function getPostTypeSelect() {
        const form = document.getElementById('recruitingForm');
        if (!form) return null;
        return form.querySelector('#recruitingPostType');
    }

    function isAutoTypeField(field) {
        return !!(field && field.dataset.autoType === '1');
    }

    function getTypeControl(field) {
        if (!field) return null;
        return field.querySelector('.recruiting-clan-tag-type');
    }

    function setClanTagType(field, type) {
        const control = getTypeControl(field);
        if (!control) return;
        control.value = type;
        if (control.matches('select')) {
            refreshSelect(control);
        }
        applyType(field, type);
    }

    function updateFieldLabel(field, rule, lang) {
        if (!isAutoTypeField(field)) return;
        const labelText = field.querySelector('.recruiting-clan-tag-label-text');
        if (!labelText) return;

        if (rule) {
            labelText.textContent = labelFor(rule.type, lang);
            return;
        }

        if (window.AbsRecruitingI18n) {
            labelText.textContent = window.AbsRecruitingI18n.STRINGS[lang === 'en' ? 'en' : 'ru'].form.clanOrTeam;
            return;
        }
        labelText.textContent = lang === 'en' ? 'Clan or team' : 'Клан или команда';
    }

    function refreshSelect(select) {
        if (!select) return;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(select);
        }
    }

    function setControlEnabled(el, enabled) {
        if (!el) return;
        el.disabled = !enabled;
        if (el.matches('.recruiting-select')) {
            refreshSelect(el);
        }
    }

    function normalizeClanTagValue(value, type) {
        const trimmed = String(value || '').trim();
        if (!trimmed || isSentinelValue(trimmed)) {
            return String(value || '');
        }
        if (type === 'clan_tag') {
            return trimmed.toUpperCase();
        }
        return String(value || '');
    }

    function applyType(field, type) {
        const lang = getLang(field);
        const input = field.querySelector('.recruiting-clan-tag-value');
        if (!input) return;

        const maxLen = MAX[type] || MAX.clan_tag;
        input.maxLength = maxLen;
        input.setAttribute('aria-label', labelFor(type, lang));
        input.classList.toggle('recruiting-clan-tag-value--caps', type === 'clan_tag');
        if (type === 'clan_tag' && input.value && !isSentinelValue(input.value)) {
            const upper = normalizeClanTagValue(input.value, type);
            if (upper !== input.value) {
                input.value = upper;
            }
        }
        if (input.value.length > maxLen) {
            input.value = input.value.slice(0, maxLen);
        }
    }

    let lastAppliedPostType = '';

    function resetPostTypeTracking() {
        lastAppliedPostType = '';
    }

    function shouldUsePrefValue(input, rule, prefs) {
        if (!input || !rule || rule.mode !== 'required') return false;
        const current = String(input.value || '').trim();
        if (!current || isSentinelValue(current)) return true;

        const prefValue = rule.type === 'team_name'
            ? String(prefs.team_name || '').trim()
            : String(prefs.clan_tag || '').trim();
        if (!prefValue) return false;

        const otherType = rule.type === 'team_name' ? 'clan_tag' : 'team_name';
        const otherPref = String(prefs[otherType] || '').trim();
        return otherPref !== '' && current === otherPref;
    }

    function applyPrefValueToInput(input, postType, prefs, lang, force) {
        if (!input) return;
        const rule = POST_TYPE_RULES[String(postType || '').trim()];
        if (!rule || rule.mode !== 'required') return;

        const prefValue = clanValueForPostType(postType, prefs, lang);
        const current = String(input.value || '').trim();
        const shouldFill = force
            || !current
            || isSentinelValue(current)
            || shouldUsePrefValue(input, rule, prefs);

        if (!shouldFill) return;
        if (prefValue || !current) {
            input.value = prefValue;
        }
    }

    function applyPostTypeRules() {
        const field = findFormClanField();
        const postTypeEl = getPostTypeSelect();
        if (!field || !postTypeEl) return;

        const postType = String(postTypeEl.value || '').trim();
        const postTypeChanged = postType !== lastAppliedPostType;
        lastAppliedPostType = postType;
        const rule = POST_TYPE_RULES[postType];
        const lang = getLang(field);
        const typeControl = getTypeControl(field);
        const input = field.querySelector('.recruiting-clan-tag-value');
        const requiredMark = field.querySelector('.recruiting-clan-tag-required');
        const prefs = getClanPrefs();

        field.classList.remove(
            'recruiting-clan-tag-field--locked',
            'recruiting-clan-tag-field--required',
            'recruiting-clan-tag-field--hidden'
        );
        updateFieldLabel(field, rule, lang);

        if (!rule) {
            if (typeControl && typeControl.matches('select')) {
                setControlEnabled(typeControl, true);
            } else if (typeControl) {
                setClanTagType(field, 'clan_tag');
            }
            setControlEnabled(input, true);
            if (input) {
                input.readOnly = false;
                if (isSentinelValue(input.value)) {
                    input.value = '';
                }
                input.placeholder = optionalPlaceholder(lang);
            }
            if (requiredMark) {
                requiredMark.classList.add('hidden');
            }
            if (typeControl && typeControl.matches('select')) {
                applyType(field, typeControl.value || 'clan_tag');
            }
            return;
        }

        if (rule.mode === 'locked') {
            setClanTagType(field, rule.type);
            if (input) {
                input.value = sentinelValue(rule.sentinel, lang);
            }
            field.classList.add('recruiting-clan-tag-field--hidden');
            return;
        }

        field.classList.add('recruiting-clan-tag-field--required');
        setClanTagType(field, rule.type);
        if (typeControl && typeControl.matches('select')) {
            setControlEnabled(typeControl, false);
        }
        if (input) {
            applyPrefValueToInput(input, postType, prefs, lang, postTypeChanged);
            input.readOnly = false;
            setControlEnabled(input, true);
            input.placeholder = placeholderFor(rule.type, lang);
        }
        if (requiredMark) {
            requiredMark.classList.remove('hidden');
        }
    }

    function readClanTagForSubmit(lang) {
        const postTypeEl = getPostTypeSelect();
        const postType = postTypeEl ? String(postTypeEl.value || '').trim() : '';
        const rule = POST_TYPE_RULES[postType];
        const normalizedLang = lang === 'en' ? 'en' : 'ru';

        if (rule && rule.mode === 'locked') {
            return {
                clan_tag: sentinelValue(rule.sentinel, normalizedLang),
                clan_tag_type: rule.type,
            };
        }

        const field = findFormClanField();
        const input = field ? field.querySelector('.recruiting-clan-tag-value') : null;
        const typeControl = field ? getTypeControl(field) : null;

        if (rule && rule.mode === 'required') {
            const raw = String(input && input.value ? input.value : '').trim();
            return {
                clan_tag: normalizeClanTagValue(raw, rule.type),
                clan_tag_type: rule.type,
            };
        }

        const type = String(typeControl && typeControl.value ? typeControl.value : 'clan_tag').trim() || 'clan_tag';
        const raw = String(input && input.value ? input.value : '').trim();
        return {
            clan_tag: normalizeClanTagValue(raw, type),
            clan_tag_type: type,
        };
    }

    function initField(field) {
        const typeControl = getTypeControl(field);
        const input = field.querySelector('.recruiting-clan-tag-value');
        if (!typeControl || !input) return;

        applyType(field, typeControl.value || 'clan_tag');

        input.addEventListener('input', () => {
            const type = typeControl.value || 'clan_tag';
            if (type !== 'clan_tag' || isSentinelValue(input.value)) return;
            const upper = normalizeClanTagValue(input.value, type);
            if (upper === input.value) return;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = upper;
            if (start !== null && end !== null) {
                input.setSelectionRange(start, end);
            }
        });

        if (typeControl.matches('select')) {
            typeControl.addEventListener('change', () => {
                applyType(field, typeControl.value || 'clan_tag');
            });
        }
    }

    function initPostTypeRules() {
        const postTypeEl = getPostTypeSelect();
        if (!postTypeEl) return;

        postTypeEl.addEventListener('change', applyPostTypeRules);
        applyPostTypeRules();
    }

    function init() {
        document.querySelectorAll('.recruiting-clan-tag-field').forEach(initField);
        initPostTypeRules();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.recruitingInitClanTagFields = init;
    window.recruitingApplyClanTagPostTypeRules = applyPostTypeRules;
    window.recruitingResetClanPostTypeTracking = resetPostTypeTracking;
    window.recruitingReadClanTagForSubmit = readClanTagForSubmit;
    window.recruitingClanValueForPostType = clanValueForPostType;

    window.addEventListener('recruiting:langchange', (e) => {
        const lang = e.detail && e.detail.lang ? e.detail.lang : 'ru';
        document.querySelectorAll('.recruiting-clan-tag-field').forEach((field) => {
            field.dataset.lang = lang;
            const typeControl = getTypeControl(field);
            applyType(field, typeControl ? typeControl.value || 'clan_tag' : 'clan_tag');
        });
        applyPostTypeRules();
    });
})();
