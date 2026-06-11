(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function formatDate(value) {
        if (!value) return '';
        const d = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return esc(String(value));
        const lang = I18n.getLang();
        return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function renderPhaseBadge(item) {
        const phase = item.tournament_phase || 'live';
        return `<span class="bracket-meta-status bracket-meta-status--${esc(phase)}">${esc(I18n.phaseLabel(phase))}</span>`;
    }

    function renderCard(item) {
        const href = I18n.buildHref(`services/bracket/${item.public_id}`);
        const count = item.participant_count ?? '—';
        const Games = window.AbsBracketGames;
        const gameBadge = Games?.gameBadgeHtml
            ? Games.gameBadgeHtml(item.game || 'wot', item.game_realm, 'bracket-catalog-card__game')
            : '';
        const startDateHtml = item.starts_at
            ? `<time class="bracket-catalog-card__date" datetime="${esc(String(item.starts_at))}">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                ${formatDate(item.starts_at)}
               </time>`
            : `<span class="bracket-catalog-card__date bracket-catalog-card__date--empty">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                ${esc(I18n.t('noDate'))}
               </span>`;
        const creatorHtml = item.creator_name
            ? `<span class="bracket-catalog-card__creator"><i class="fas fa-user" aria-hidden="true"></i>${esc(item.creator_name)}</span>`
            : '<span class="bracket-catalog-card__creator bracket-catalog-card__creator--empty"></span>';
        return `
            <a class="bracket-catalog-card" href="${esc(href)}">
                <div class="bracket-catalog-card__head">
                    <h3 class="bracket-catalog-card__title">${esc(item.title)}</h3>
                    ${renderPhaseBadge(item)}
                </div>
                <div class="bracket-catalog-card__subhead">
                    ${creatorHtml}
                    ${gameBadge}
                </div>
                <div class="bracket-catalog-card__meta">
                    <div class="bracket-catalog-card__meta-row">
                        <span class="bracket-catalog-card__format">${esc(I18n.formatLabel(item.format))}</span>
                        <span class="bracket-catalog-card__match-format">${esc(I18n.matchFormatLabel(item.match_format))}</span>
                    </div>
                    <div class="bracket-catalog-card__meta-row">
                        <span class="bracket-catalog-card__count">
                            <i class="fas fa-users" aria-hidden="true"></i>
                            ${esc(count)} ${esc(I18n.t('participantCount'))}
                        </span>
                        ${startDateHtml}
                    </div>
                </div>
            </a>
        `;
    }

    async function loadCatalog() {
        const listEl = document.getElementById('bracketCatalogList');
        const api = window.ABS_BRACKET_LIST_API;
        if (!listEl || !api) return;

        listEl.innerHTML = `<p class="bracket-catalog-loading">${esc(I18n.t('catalogLoading'))}</p>`;

        try {
            const initial = window.ABS_BRACKET_INITIAL_LIST;
            let items = initial?.data;
            if (!items) {
                const res = await fetch(api, { credentials: 'same-origin' });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                items = json.data;
            }
            if (!items || items.length === 0) {
                listEl.innerHTML = `<p class="bracket-catalog-empty">${esc(I18n.t('catalogEmpty'))}</p>`;
                return;
            }
            listEl.innerHTML = items.map(renderCard).join('');
        } catch (e) {
            listEl.innerHTML = `<p class="bracket-catalog-error">${esc(I18n.t('catalogError'))}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', loadCatalog);
    window.addEventListener('bracket:langchange', () => {
        loadCatalog();
    });
})();
