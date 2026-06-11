(() => {
    'use strict';

    const i18n = () => window.AbsProfileI18n;
    const bracketI18n = () => window.AbsBracketI18n;

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function t(key) {
        return i18n()?.t(key) || key;
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return esc(String(value));
        const lang = i18n()?.getLang() || 'ru';
        return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function toast(msg, type) {
        if (typeof window.showSiteToast === 'function') {
            window.showSiteToast(msg, type);
        }
    }

    async function apiFetch(url, options = {}) {
        const csrf = window.ABS_PROFILE_CSRF || '';
        return fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf,
                ...(options.headers || {}),
            },
            credentials: 'same-origin',
        });
    }

    function roomHref(publicId) {
        if (bracketI18n()?.buildHref) {
            return bracketI18n().buildHref(`services/tactics/${publicId}`);
        }
        const lang = i18n()?.getLang() || 'ru';
        return lang === 'en' ? `/en/services/tactics/${publicId}` : `/services/tactics/${publicId}`;
    }

    function visibilityLabel(value) {
        return value === 'closed' ? t('tacticsClosedVis') : t('tacticsOpenVis');
    }

    function renderRow(item) {
        const href = roomHref(item.public_id);
        const visBadge = item.visibility === 'closed'
            ? `<span class="bracket-profile-badge bracket-profile-badge--hidden">${esc(t('tacticsClosedVis'))}</span>`
            : '';
        const pwdBadge = item.has_password
            ? `<span class="bracket-profile-badge bracket-profile-badge--unlisted">${esc(t('tacticsPassword'))}</span>`
            : '';

        return `
            <tr data-public-id="${esc(item.public_id)}">
                <td>
                    <div class="bracket-profile-title">
                        <span class="bracket-profile-title__text">${esc(item.title)}</span>
                        <span class="bracket-profile-title__badges">${visBadge}${pwdBadge}</span>
                    </div>
                </td>
                <td class="bracket-profile-format"><code>${esc(item.public_id)}</code></td>
                <td class="bracket-profile-date">${formatDate(item.updated_at)}</td>
                <td>
                    <div class="bracket-profile-actions">
                        <a href="${esc(href)}" class="bracket-profile-link">${esc(t('tacticsOpen'))}</a>
                        <button type="button" class="bracket-profile-delete" data-public-id="${esc(item.public_id)}">${esc(t('tacticsDelete'))}</button>
                    </div>
                </td>
            </tr>
        `;
    }

    async function loadRooms() {
        const tbody = document.getElementById('profileTacticsRoomsBody');
        const api = window.ABS_PROFILE_TACTICS_ROOMS_API;
        if (!tbody || !api) return;

        const loading = bracketI18n()?.t('profileLoading') || (i18n()?.getLang() === 'en' ? 'Loading…' : 'Загрузка…');
        tbody.innerHTML = `<tr><td colspan="4">${esc(loading)}</td></tr>`;

        try {
            const res = await apiFetch(api);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            const items = json.data || [];
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">${esc(t('tacticsEmpty'))}</td></tr>`;
                return;
            }
            tbody.innerHTML = items.map(renderRow).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4">${esc(t('tacticsLoadError'))}</td></tr>`;
        }
    }

    async function deleteRoom(publicId) {
        if (!confirm(t('tacticsConfirmDelete'))) return;

        try {
            const res = await apiFetch(window.ABS_PROFILE_TACTICS_DELETE_API, {
                method: 'POST',
                body: JSON.stringify({ public_id: publicId }),
            });
            const json = await res.json();
            if (!json.success) {
                toast(json.error || t('tacticsDeleteError'), 'error');
                return;
            }
            toast(t('tacticsDeleted'), 'success');
            loadRooms();
        } catch (e) {
            toast(t('tacticsDeleteError'), 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadRooms();
        document.getElementById('profileTacticsRoomsTable')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.bracket-profile-delete');
            if (btn && btn.closest('#profileTacticsRoomsTable')) {
                deleteRoom(btn.dataset.publicId);
            }
        });
    });

    window.addEventListener('profile:langchange', () => {
        loadRooms();
    });
})();
