(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return esc(String(value));
        const lang = I18n.getLang();
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

    function renderRow(item) {
        const viewHref = I18n.buildHref(`services/bracket/${item.public_id}`);
        const editHref = I18n.buildHref(`services/bracket/${item.public_id}/edit`);
        const phase = item.tournament_phase || 'live';
        const phaseBadge = `<span class="bracket-meta-status bracket-meta-status--${esc(phase)}">${esc(I18n.phaseLabel(phase))}</span>`;
        const statusBadge = item.status === 'hidden'
            ? `<span class="bracket-profile-badge bracket-profile-badge--hidden">${esc(I18n.t('statusHidden'))}</span>`
            : '';
        const visBadge = item.visibility === 'hidden'
            ? `<span class="bracket-profile-badge bracket-profile-badge--unlisted">${esc(I18n.t('visibilityHidden'))}</span>`
            : '';

        return `
            <tr data-public-id="${esc(item.public_id)}">
                <td>
                    <div class="bracket-profile-title">
                        <span class="bracket-profile-title__text">${esc(item.title)}</span>
                        <span class="bracket-profile-title__badges">${phaseBadge}${statusBadge}${visBadge}</span>
                    </div>
                </td>
                <td class="bracket-profile-format">${esc(I18n.formatLabel(item.format))}</td>
                <td class="bracket-profile-date">${formatDate(item.updated_at)}</td>
                <td>
                    <div class="bracket-profile-actions">
                        <a href="${esc(viewHref)}" class="bracket-profile-link">${esc(I18n.t('viewTitle'))}</a>
                        <a href="${esc(editHref)}" class="bracket-profile-link">${esc(I18n.t('edit'))}</a>
                        <button type="button" class="bracket-profile-delete" data-public-id="${esc(item.public_id)}">${esc(I18n.t('delete'))}</button>
                    </div>
                </td>
            </tr>
        `;
    }

    async function loadBrackets() {
        const tbody = document.getElementById('profileBracketsBody');
        const api = window.ABS_PROFILE_BRACKETS_API;
        if (!tbody || !api) return;

        tbody.innerHTML = `<tr><td colspan="4">${esc(I18n.t('profileLoading'))}</td></tr>`;

        try {
            const res = await apiFetch(api);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            const items = json.data || [];
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">${esc(I18n.t('profileEmpty'))}</td></tr>`;
                return;
            }
            tbody.innerHTML = items.map(renderRow).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4">${esc(I18n.t('catalogError'))}</td></tr>`;
        }
    }

    async function deleteBracket(publicId) {
        if (!confirm(I18n.t('confirmDelete'))) return;

        try {
            const res = await apiFetch(window.ABS_PROFILE_BRACKETS_DELETE_API, {
                method: 'POST',
                body: JSON.stringify({ public_id: publicId }),
            });
            const json = await res.json();
            if (!json.success) {
                toast(json.error || I18n.t('saveError'), 'error');
                return;
            }
            toast(I18n.t('saved'), 'success');
            loadBrackets();
        } catch (e) {
            toast(I18n.t('saveError'), 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadBrackets();
        document.getElementById('profileBracketsTable')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.bracket-profile-delete');
            if (btn) {
                deleteBracket(btn.dataset.publicId);
            }
        });
    });

    window.addEventListener('profile:langchange', () => {
        loadBrackets();
    });
})();
