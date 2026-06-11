(() => {
    const i18n = window.AbsRecruitingI18n;
    if (!i18n) return;

    let lang = i18n.getLang();
    const mode = window.ABS_RECRUITING_FORM_MODE === 'edit' ? 'edit' : 'create';
    const postId = Number(window.ABS_RECRUITING_POST_ID || 0);
    let boardHref = window.ABS_RECRUITING_BOARD_HREF || '/services/recruiting';
    const csrf = window.ABS_RECRUITING_CSRF || '';
    const draftCache = window.AbsRecruitingFormDraftCache || null;

    const form = document.getElementById('recruitingForm');
    const submitBtn = document.getElementById('recruitingSubmitBtn');
    const nicknameInput = document.getElementById('recruitingGameNickname');
    const nicknameErrorEl = document.getElementById('recruitingGameNicknameError');
    const realmSelect = document.getElementById('recruitingRealm');
    const profileNicks = window.ABS_RECRUITING_PROFILE_NICKS || {};

    if (!form) return;

    const showToast = window.showSiteToast || window.showProfileToast || ((message) => window.alert(message));
    const NICKNAME_RE = /^[A-Za-z0-9_-]{1,24}$/;

    let saveDraftTimer = null;
    let submitting = false;

    function persistDraftNow() {
        if (mode !== 'create' || !draftCache) return;
        draftCache.write(readFormData());
    }

    function scheduleDraftSave() {
        if (mode !== 'create' || !draftCache) return;
        clearTimeout(saveDraftTimer);
        saveDraftTimer = setTimeout(persistDraftNow, 300);
    }

    form.addEventListener('input', scheduleDraftSave);
    form.addEventListener('change', scheduleDraftSave);
    window.addEventListener('beforeunload', persistDraftNow);
    window.addEventListener('pagehide', persistDraftNow);

    function restoreDraftWhenReady() {
        if (mode !== 'create' || !draftCache || typeof draftCache.restore !== 'function') return;
        draftCache.restore();
        if (typeof window.recruitingApplyClanTagPostTypeRules === 'function') {
            window.recruitingApplyClanTagPostTypeRules();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreDraftWhenReady);
    } else {
        restoreDraftWhenReady();
    }

    function buildT() {
        lang = i18n.getLang();
        return { ...i18n.STRINGS[lang].formJs };
    }

    let t = buildT();

    function readClanTagFields() {
        if (typeof window.recruitingReadClanTagForSubmit === 'function') {
            return window.recruitingReadClanTagForSubmit(lang);
        }
        const fd = new FormData(form);
        return {
            clan_tag: String(fd.get('clan_tag') || '').trim(),
            clan_tag_type: String(fd.get('clan_tag_type') || 'clan_tag').trim(),
        };
    }

    function readFormData() {
        const fd = new FormData(form);
        const clanFields = readClanTagFields();
        const data = {
            post_type: String(fd.get('post_type') || '').trim(),
            realm: String(fd.get('realm') || '').trim(),
            game_nickname: String(fd.get('game_nickname') || '').trim(),
            body: String(fd.get('body') || '').trim(),
            clan_tag: clanFields.clan_tag,
            clan_tag_type: clanFields.clan_tag_type,
            contacts: [],
        };
        const contactsRaw = fd.get('contacts_json');
        if (contactsRaw) {
            try {
                const parsed = JSON.parse(String(contactsRaw));
                if (Array.isArray(parsed)) {
                    data.contacts = parsed;
                }
            } catch (err) {
                data.contacts = [];
            }
        }
        if (mode === 'edit' && postId > 0) {
            data.id = postId;
        }
        return data;
    }

    function setNicknameError(message) {
        if (!nicknameErrorEl) return;
        if (message) {
            nicknameErrorEl.textContent = message;
            nicknameErrorEl.classList.remove('hidden');
            if (nicknameInput) nicknameInput.setAttribute('aria-invalid', 'true');
        } else {
            nicknameErrorEl.textContent = '';
            nicknameErrorEl.classList.add('hidden');
            if (nicknameInput) nicknameInput.removeAttribute('aria-invalid');
        }
    }

    function validate(data) {
        t = buildT();
        if (!data.post_type || !data.realm || !data.game_nickname || !data.body) {
            return t.required;
        }
        if (!NICKNAME_RE.test(data.game_nickname)) {
            return t.nicknameInvalid;
        }
        if (data.body.length < 10) {
            return t.bodyMin;
        }
        if (data.post_type === 'clan_seeks_players' && !data.clan_tag) {
            return t.clanTagRequired;
        }
        if (data.post_type === 'team_seeks_players' && !data.clan_tag) {
            return t.teamNameRequired;
        }
        return '';
    }

    async function checkNicknameAllowed(data) {
        const res = await fetch('/api/recruiting/check_nickname.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-Token': csrf,
            },
            body: JSON.stringify({
                game_nickname: data.game_nickname,
                realm: data.realm,
                csrf_token: csrf,
            }),
        });
        const json = await res.json();
        if (!json.success || !json.allowed) {
            throw new Error(json.error || t.nicknameTaken);
        }
    }

    let nicknameCheckTimer = null;
    async function scheduleNicknameCheck() {
        clearTimeout(nicknameCheckTimer);
        nicknameCheckTimer = setTimeout(async () => {
            const data = readFormData();
            t = buildT();
            if (!data.game_nickname || !data.realm || !NICKNAME_RE.test(data.game_nickname)) {
                setNicknameError('');
                return;
            }
            try {
                await checkNicknameAllowed(data);
                setNicknameError('');
            } catch (err) {
                setNicknameError(err.message || t.nicknameTaken);
            }
        }, 400);
    }

    if (nicknameInput) {
        nicknameInput.addEventListener('input', scheduleNicknameCheck);
        nicknameInput.addEventListener('blur', scheduleNicknameCheck);
    }
    if (realmSelect) {
        realmSelect.addEventListener('change', () => {
            const realm = String(realmSelect.value || '').trim();
            if (nicknameInput && profileNicks[realm] && !nicknameInput.value.trim()) {
                nicknameInput.value = profileNicks[realm];
            }
            scheduleNicknameCheck();
            scheduleDraftSave();
        });
    }

    function setSubmitting(active) {
        submitting = active;
        if (!submitBtn) return;
        submitBtn.disabled = active;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitting) return;

        const data = readFormData();
        if (mode === 'create' && draftCache) {
            draftCache.write(data);
        }
        const validationError = validate(data);
        if (validationError) {
            setNicknameError('');
            showToast(validationError, 'error');
            return;
        }

        t = buildT();
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        setSubmitting(true);
        if (submitBtn) {
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${t.sending}`;
        }

        try {
            await checkNicknameAllowed(data);
            setNicknameError('');
        } catch (err) {
            t = buildT();
            const message = err.message || t.nicknameTaken;
            setNicknameError(message);
            showToast(message, 'error');
            setSubmitting(false);
            if (submitBtn) {
                submitBtn.innerHTML = originalBtnHtml;
            }
            return;
        }

        const endpoint = mode === 'edit' ? '/api/recruiting/update.php' : '/api/recruiting/create.php';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-Token': csrf,
                },
                body: JSON.stringify({ ...data, csrf_token: csrf }),
            });
            const json = await res.json();
            t = buildT();
            if (!json.success) {
                throw new Error(json.error || t.error);
            }

            if (mode === 'create' && draftCache) {
                draftCache.clear();
            }

            showToast(mode === 'edit' ? t.successEdit : t.successCreate, 'success');
            setTimeout(() => {
                window.location.href = boardHref;
            }, 1200);
        } catch (err) {
            t = buildT();
            showToast(err.message || t.error, 'error');
            if (mode === 'create' && draftCache) {
                draftCache.write(readFormData());
            }
            setSubmitting(false);
            if (submitBtn) {
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    });

    window.addEventListener('recruiting:langchange', () => {
        lang = i18n.getLang();
        t = buildT();
        boardHref = i18n.buildHref(lang, 'services/recruiting');
        window.ABS_RECRUITING_BOARD_HREF = boardHref;
    });

})();
