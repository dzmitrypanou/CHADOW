(() => {
    const csrf = window.ABS_PROFILE_CSRF || '';
    const accountApi = window.ABS_PROFILE_ACCOUNT_API || '/api/auth/update_profile.php';
    const recruitingApi = window.ABS_PROFILE_RECRUITING_API || '/api/auth/save_recruiting_prefs.php';
    const passwordApi = window.ABS_PROFILE_PASSWORD_API || '/api/auth/change_password.php';
    const isLocalAccount = window.ABS_PROFILE_IS_LOCAL === true;

    const saveBtn = document.getElementById('profileSaveBtn');
    const accountForm = document.getElementById('profileAccountForm');
    const gameNicksForm = document.getElementById('profileGameNicksForm');
    const recruitingForm = document.getElementById('profileRecruitingForm');
    const currentPasswordInput = document.getElementById('profile_current_password');
    const newPasswordInput = document.getElementById('profile_new_password');
    const confirmPasswordInput = document.getElementById('profile_new_password_confirm');

    if (gameNicksForm) {
        gameNicksForm.querySelectorAll(
            '[data-profile-stats-link], .profile-game-nick-field__stats-sep, .profile-game-nick-field__stats'
        ).forEach((el) => el.remove());
    }

    if (!saveBtn || !recruitingForm) return;

    const USERNAME_RE = /^[A-Za-z0-9_\-.]{3,64}$/;
    const NICKNAME_RE = /^[A-Za-z0-9_-]{0,24}$/;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    [accountForm, gameNicksForm, recruitingForm].forEach((form) => {
        if (form) {
            form.addEventListener('submit', (e) => e.preventDefault());
        }
    });

    function currentLang() {
        if (window.AbsProfileI18n && typeof window.AbsProfileI18n.getLang === 'function') {
            return window.AbsProfileI18n.getLang();
        }
        if (window.ABS_PROFILE_LANG === 'en' || document.documentElement.lang === 'en' || window.ABS_LANG === 'en') {
            return 'en';
        }
        return 'ru';
    }

    function strings() {
        const isEn = currentLang() === 'en';
        return {
            saving: isEn ? 'Saving…' : 'Сохранение…',
            save: isEn ? 'Save' : 'Сохранить',
            error: isEn ? 'Could not save settings.' : 'Не удалось сохранить настройки.',
            invalidNickname: isEn
                ? 'Game nickname: up to 24 characters, Latin letters, digits, _ -'
                : 'Игровой ник: до 24 символов, латиница, цифры, _ -',
            invalidUsername: isEn
                ? 'Username: 3–64 characters, Latin letters, digits, _ - .'
                : 'Логин: 3–64 символа, латиница, цифры, _ - .',
            invalidEmail: isEn ? 'Invalid email.' : 'Некорректный email.',
            saved: isEn ? 'Settings saved.' : 'Настройки сохранены.',
            passwordError: isEn ? 'Could not change password.' : 'Не удалось сменить пароль.',
            currentRequired: isEn ? 'Enter your current password.' : 'Введите текущий пароль.',
            newRequired: isEn ? 'Enter a new password.' : 'Введите новый пароль.',
            confirmRequired: isEn ? 'Confirm the new password.' : 'Подтвердите новый пароль.',
            mismatch: isEn ? 'New password and confirmation do not match.' : 'Новый пароль и подтверждение не совпадают.',
            minLength: isEn ? 'New password must be at least 8 characters.' : 'Новый пароль — не менее 8 символов.',
        };
    }

    const showToast = window.showProfileToast || ((message) => window.alert(message));

    function passwordFieldsPresent() {
        return !!(isLocalAccount && currentPasswordInput && newPasswordInput && confirmPasswordInput);
    }

    function hasPasswordChange() {
        if (!passwordFieldsPresent()) return false;
        return !!(
            String(currentPasswordInput.value || '').trim()
            || String(newPasswordInput.value || '').trim()
            || String(confirmPasswordInput.value || '').trim()
        );
    }

    function clearPasswordFields() {
        if (!passwordFieldsPresent()) return;
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        const matchHint = document.getElementById('profilePasswordMatchHint');
        if (matchHint) {
            matchHint.hidden = true;
            matchHint.textContent = '';
        }
    }

    function validatePasswordChange(t) {
        if (!hasPasswordChange()) return true;

        if (!String(currentPasswordInput.value || '').trim()) {
            showToast(t.currentRequired, 'error');
            currentPasswordInput.focus();
            return false;
        }
        if (!String(newPasswordInput.value || '').trim()) {
            showToast(t.newRequired, 'error');
            newPasswordInput.focus();
            return false;
        }
        if (String(newPasswordInput.value || '').length < 8) {
            showToast(t.minLength, 'error');
            newPasswordInput.focus();
            return false;
        }
        if (!String(confirmPasswordInput.value || '').trim()) {
            showToast(t.confirmRequired, 'error');
            confirmPasswordInput.focus();
            return false;
        }
        if (newPasswordInput.value !== confirmPasswordInput.value) {
            showToast(t.mismatch, 'error');
            confirmPasswordInput.focus();
            return false;
        }
        return true;
    }

    function syncContactsBeforeSave() {
        const editor = document.getElementById('profileContactsEditor');
        const hidden = document.getElementById('profileContactsEditorInput');
        if (!editor || !hidden) return;
        const rows = [];
        editor.querySelectorAll('.recruiting-contact-row').forEach((rowEl) => {
            const type = rowEl.dataset.type || 'telegram';
            const value = rowEl.querySelector('.recruiting-contact-value')?.value.trim() || '';
            if (value) rows.push({ type, value });
        });
        hidden.value = JSON.stringify(rows);
    }

    function readRecruitingPayload() {
        syncContactsBeforeSave();
        const fd = new FormData(recruitingForm);
        let clanTag = String(fd.get('recruiting_clan_tag') || '').trim();
        if (clanTag !== '') {
            clanTag = clanTag.toUpperCase();
        }

        return {
            recruiting_post_type: String(fd.get('recruiting_post_type') || '').trim(),
            recruiting_realm: String(fd.get('recruiting_realm') || '').trim(),
            recruiting_clan_tag: clanTag,
            recruiting_team_name: String(fd.get('recruiting_team_name') || '').trim(),
            recruiting_contacts_json: String(fd.get('recruiting_contacts_json') || '[]'),
            csrf_token: csrf,
        };
    }

    function readAccountPayload() {
        const payload = { csrf_token: csrf };
        if (isLocalAccount && accountForm) {
            const fd = new FormData(accountForm);
            payload.username = String(fd.get('username') || '').trim();
            payload.email = String(fd.get('email') || '').trim();
        }
        if (gameNicksForm) {
            ['ru', 'eu', 'na', 'asia'].forEach((realm) => {
                const input = gameNicksForm.querySelector(`#profile_game_nickname_${realm}`);
                if (input && !input.readOnly) {
                    payload[`game_nickname_${realm}`] = String(input.value || '').trim();
                }
            });
        }
        return payload;
    }

    function readPasswordPayload() {
        return {
            current_password: String(currentPasswordInput.value || ''),
            new_password: String(newPasswordInput.value || ''),
            new_password_confirm: String(confirmPasswordInput.value || ''),
            csrf_token: csrf,
        };
    }

    function validateAccountForm(t) {
        if (!isLocalAccount || !accountForm) return true;

        const usernameInput = accountForm.querySelector('#profile_username');
        const emailInput = accountForm.querySelector('#profile_email');
        const username = usernameInput ? String(usernameInput.value || '').trim() : '';
        const email = emailInput ? String(emailInput.value || '').trim() : '';

        if (!username || !USERNAME_RE.test(username)) {
            showToast(t.invalidUsername, 'error');
            usernameInput?.focus();
            return false;
        }
        if (!email || !EMAIL_RE.test(email)) {
            showToast(t.invalidEmail, 'error');
            emailInput?.focus();
            return false;
        }
        return true;
    }

    function validateGameNicknames(t) {
        if (!gameNicksForm) return true;

        for (const realm of ['ru', 'eu', 'na', 'asia']) {
            const input = gameNicksForm.querySelector(`#profile_game_nickname_${realm}`);
            if (!input || input.readOnly) continue;
            const value = String(input.value || '').trim();
            if (value !== '' && !NICKNAME_RE.test(value)) {
                showToast(t.invalidNickname, 'error');
                input.focus();
                return false;
            }
        }
        return true;
    }

    function validateBeforeSave() {
        const t = strings();
        if (!validateAccountForm(t)) return false;
        if (!validateGameNicknames(t)) return false;
        if (!validatePasswordChange(t)) return false;
        return true;
    }

    async function postJson(url, payload) {
        const t = strings();
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-Token': csrf,
            },
            body: JSON.stringify(payload),
        });
        let json;
        try {
            json = await res.json();
        } catch (err) {
            throw new Error(t.error);
        }
        if (!json.success) {
            throw new Error(json.error || t.error);
        }
        return json;
    }

    async function saveAll() {
        if (!validateBeforeSave()) {
            return;
        }

        const t = strings();
        const hasAccountData = (isLocalAccount && accountForm) || gameNicksForm;
        if (hasAccountData) {
            const accountJson = await postJson(accountApi, readAccountPayload());
            if (accountJson.profile) {
                if (accountJson.profile.username && accountForm) {
                    const usernameInput = accountForm.querySelector('#profile_username');
                    if (usernameInput) usernameInput.value = accountJson.profile.username;
                }
                if (accountJson.profile.email && accountForm) {
                    const emailInput = accountForm.querySelector('#profile_email');
                    if (emailInput) emailInput.value = accountJson.profile.email;
                }
                if (accountJson.profile.game_nicknames && gameNicksForm) {
                    Object.entries(accountJson.profile.game_nicknames).forEach(([realm, value]) => {
                        const input = gameNicksForm.querySelector(`#profile_game_nickname_${realm}`);
                        if (input && !input.readOnly) {
                            input.value = String(value || '');
                        }
                    });
                }
            }
        }

        if (hasPasswordChange()) {
            await postJson(passwordApi, readPasswordPayload());
            clearPasswordFields();
        }

        await postJson(recruitingApi, readRecruitingPayload());
        showToast(t.saved, 'success');
    }

    saveBtn.addEventListener('click', async () => {
        const t = strings();
        const originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ${t.saving}`;

        try {
            await saveAll();
        } catch (err) {
            showToast(err.message || t.error, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    });
})();
