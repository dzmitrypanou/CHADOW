(() => {
    const STORAGE_KEY = 'absRecruitingFormDraft';
    const PENDING_SUBMIT_KEY = 'absRecruitingFormPendingSubmit';

    function safeParse(raw) {
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return data && typeof data === 'object' ? data : null;
        } catch (err) {
            return null;
        }
    }

    function sanitizeContacts(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        raw.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const type = String(item.type || 'telegram').trim();
            const value = String(item.value || '').trim();
            if (value) out.push({ type, value });
        });
        return out;
    }

    function normalizeDraft(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const draft = {
            post_type: String(raw.post_type || '').trim(),
            realm: String(raw.realm || '').trim(),
            game_nickname: String(raw.game_nickname || '').trim(),
            clan_tag: String(raw.clan_tag || '').trim(),
            team_name: String(raw.team_name || '').trim(),
            clan_tag_type: String(raw.clan_tag_type || 'clan_tag').trim() || 'clan_tag',
            contacts: sanitizeContacts(raw.contacts),
        };
        return draftHasContent(draft) ? draft : null;
    }

    function draftHasContent(draft) {
        if (!draft) return false;
        return !!(
            draft.post_type
            || draft.realm
            || draft.game_nickname
            || draft.clan_tag
            || draft.team_name
            || (Array.isArray(draft.contacts) && draft.contacts.length > 0)
        );
    }

    function readCache() {
        try {
            return normalizeDraft(safeParse(localStorage.getItem(STORAGE_KEY)));
        } catch (err) {
            return null;
        }
    }

    function isLoggedIn() {
        return window.ABS_RECRUITING_IS_LOGGED_IN === true;
    }

    function writeCache(data) {
        if (isLoggedIn()) return;

        const draft = normalizeDraft(data);
        try {
            if (!draft) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch (err) {
            // storage unavailable
        }
    }

    function clearCache() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            // ignore
        }
    }

    function readFromDom() {
        const form = document.getElementById('recruitingForm');
        if (!form) return null;

        const fd = new FormData(form);
        const contactsRaw = fd.get('contacts_json');
        let contacts = [];
        if (contactsRaw) {
            try {
                const parsed = JSON.parse(String(contactsRaw));
                contacts = sanitizeContacts(parsed);
            } catch (err) {
                contacts = [];
            }
        }

        let clanTag = String(fd.get('clan_tag') || '').trim();
        let clanTagType = String(fd.get('clan_tag_type') || 'clan_tag').trim() || 'clan_tag';
        if (typeof window.recruitingReadClanTagForSubmit === 'function') {
            const lang = window.AbsRecruitingI18n && typeof window.AbsRecruitingI18n.getLang === 'function'
                ? window.AbsRecruitingI18n.getLang()
                : 'ru';
            const clanFields = window.recruitingReadClanTagForSubmit(lang);
            clanTag = clanFields.clan_tag;
            clanTagType = clanFields.clan_tag_type;
        }

        return normalizeDraft({
            post_type: fd.get('post_type'),
            realm: fd.get('realm'),
            game_nickname: fd.get('game_nickname'),
            clan_tag: clanTag,
            clan_tag_type: clanTagType,
            contacts,
        });
    }

    function setSelectValue(select, value) {
        if (!select || value === undefined || value === null) return;
        const next = String(value);
        if (select.value === next) return;
        select.value = next;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.recruitingRefreshSelect === 'function') {
            window.recruitingRefreshSelect(select);
        }
    }

    function applyDraftToForm(draft) {
        if (!draft) return;

        if (typeof window.recruitingResetClanPostTypeTracking === 'function') {
            window.recruitingResetClanPostTypeTracking();
        }

        if (draft.post_type) {
            setSelectValue(document.getElementById('recruitingPostType'), draft.post_type);
        }
        if (draft.realm) {
            setSelectValue(document.getElementById('recruitingRealm'), draft.realm);
        }

        const nicknameEl = document.getElementById('recruitingGameNickname');
        if (nicknameEl) {
            nicknameEl.value = draft.game_nickname || '';
        }

        const clanTagEl = document.getElementById('recruitingClanTag');
        if (clanTagEl) {
            const lang = window.AbsRecruitingI18n && typeof window.AbsRecruitingI18n.getLang === 'function'
                ? window.AbsRecruitingI18n.getLang()
                : 'ru';
            if (typeof window.recruitingClanValueForPostType === 'function') {
                clanTagEl.value = window.recruitingClanValueForPostType(draft.post_type, draft, lang);
            } else {
                clanTagEl.value = draft.clan_tag || '';
            }
        }

        const clanTagTypeEl = document.querySelector('.recruiting-clan-tag-type');
        if (clanTagTypeEl) {
            clanTagTypeEl.value = draft.clan_tag_type || 'clan_tag';
            clanTagTypeEl.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof window.recruitingRefreshSelect === 'function') {
                window.recruitingRefreshSelect(clanTagTypeEl);
            }
        }

        const contacts = Array.isArray(draft.contacts) ? draft.contacts : [];
        if (typeof window.recruitingSetContactsEditorData === 'function') {
            window.recruitingSetContactsEditorData('recruitingContactsEditor', contacts);
        } else {
            const contactsInput = document.getElementById('recruitingContactsEditorInput');
            if (contactsInput) {
                contactsInput.value = JSON.stringify(contacts);
            }
        }

        if (typeof window.recruitingApplyClanTagPostTypeRules === 'function') {
            window.recruitingApplyClanTagPostTypeRules();
        }
    }

    function mergeDraft(serverDraft, cacheDraft) {
        if (isLoggedIn()) return serverDraft;
        if (!cacheDraft) return serverDraft;
        if (!serverDraft || !draftHasContent(serverDraft)) return cacheDraft;
        return cacheDraft;
    }

    async function syncPrefsToServer(draft) {
        if (!draft || window.ABS_RECRUITING_IS_LOGGED_IN !== true) return;
        const csrf = window.ABS_RECRUITING_CSRF || '';
        const api = window.ABS_RECRUITING_PREFS_API || '/api/auth/save_recruiting_prefs.php';
        if (!csrf) return;

        try {
            await fetch(api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-Token': csrf,
                },
                body: JSON.stringify((() => {
                    const payload = {
                        recruiting_post_type: draft.post_type || '',
                        recruiting_realm: draft.realm || '',
                        recruiting_contacts_json: JSON.stringify(draft.contacts || []),
                        csrf_token: csrf,
                    };
                    const clanType = String(draft.clan_tag_type || 'clan_tag').trim() || 'clan_tag';
                    if (clanType === 'team_name') {
                        payload.recruiting_team_name = draft.clan_tag || '';
                    } else {
                        payload.recruiting_clan_tag = draft.clan_tag || '';
                    }
                    return payload;
                })()),
            });
        } catch (err) {
            // prefs sync is best-effort
        }
    }

    function restoreFromCache() {
        if (window.ABS_RECRUITING_FORM_MODE === 'edit') return null;

        const serverDraft = normalizeDraft(window.ABS_RECRUITING_INITIAL_FORM || null);

        if (isLoggedIn()) {
            clearCache();
            if (serverDraft) {
                applyDraftToForm(serverDraft);
            } else if (typeof window.recruitingApplyClanTagPostTypeRules === 'function') {
                if (typeof window.recruitingResetClanPostTypeTracking === 'function') {
                    window.recruitingResetClanPostTypeTracking();
                }
                window.recruitingApplyClanTagPostTypeRules();
            }
            return serverDraft;
        }

        const cacheDraft = readCache();
        const draft = mergeDraft(serverDraft, cacheDraft);
        if (!draft) return null;

        applyDraftToForm(draft);
        writeCache(draft);
        return draft;
    }

    function setPendingSubmit(value) {
        try {
            if (value) {
                sessionStorage.setItem(PENDING_SUBMIT_KEY, '1');
            } else {
                sessionStorage.removeItem(PENDING_SUBMIT_KEY);
            }
        } catch (err) {
            // ignore
        }
    }

    function consumePendingSubmit() {
        try {
            const pending = sessionStorage.getItem(PENDING_SUBMIT_KEY) === '1';
            sessionStorage.removeItem(PENDING_SUBMIT_KEY);
            return pending;
        } catch (err) {
            return false;
        }
    }

    window.AbsRecruitingFormDraftCache = {
        read: readCache,
        write: writeCache,
        clear: clearCache,
        readFromDom,
        apply: applyDraftToForm,
        restore: restoreFromCache,
        hasContent: draftHasContent,
        setPendingSubmit,
        consumePendingSubmit,
    };
})();
