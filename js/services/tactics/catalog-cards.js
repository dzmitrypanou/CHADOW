(() => {
    'use strict';

    const i18n = () => window.AbsTacticsI18n;

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        if (!value) return '';
        const d = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
        const lang = i18n().getLang();
        return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function gameBadgeHtml(item) {
        const icon = item.game_icon || '';
        const label = item.game_label || '';
        if (!icon && !label) return '';

        return '<span class="bracket-game-badge tactics-catalog-card__game">'
            + '<img class="bracket-game-badge__icon" src="' + escapeHtml(icon) + '" width="20" height="20" alt="" loading="lazy" decoding="async">'
            + '<span class="bracket-game-badge__label">' + escapeHtml(label) + '</span>'
            + '</span>';
    }

    function renderCard(item, href, t) {
        const creatorName = item.creator_name || t('guestAuthor');
        const creatorHtml = '<span class="tactics-catalog-card__creator" title="' + escapeHtml(t('roomAuthor')) + '">'
            + '<i class="fas fa-user" aria-hidden="true"></i>'
            + escapeHtml(creatorName)
            + '</span>';
        const gameBadge = gameBadgeHtml(item);
        const createdAt = item.created_at
            ? '<time class="tactics-catalog-card__date" datetime="' + escapeHtml(String(item.created_at)) + '">'
                + '<i class="fas fa-calendar-alt" aria-hidden="true"></i>'
                + '<span>' + escapeHtml(t('createdOn')) + ': ' + formatDate(item.created_at) + '</span>'
                + '</time>'
            : '<span class="tactics-catalog-card__date tactics-catalog-card__date--empty">'
                + '<i class="fas fa-calendar-alt" aria-hidden="true"></i>'
                + escapeHtml(t('noDate'))
                + '</span>';
        const passwordBadge = item.has_password
            ? '<span class="tactics-catalog-card__lock" title="' + escapeHtml(t('hasPassword')) + '">'
                + '<i class="fas fa-lock" aria-hidden="true"></i>'
                + '</span>'
            : '';

        return '<a class="tactics-catalog-card" href="' + escapeHtml(href) + '">'
            + '<div class="tactics-catalog-card__head">'
            + '<h3 class="tactics-catalog-card__title">' + escapeHtml(item.title) + '</h3>'
            + passwordBadge
            + '</div>'
            + '<div class="tactics-catalog-card__subhead">'
            + creatorHtml
            + gameBadge
            + '</div>'
            + '<div class="tactics-catalog-card__meta">'
            + '<div class="tactics-catalog-card__meta-row">'
            + '<span class="tactics-catalog-card__code">'
            + '<i class="fas fa-link" aria-hidden="true"></i>'
            + '<span>' + escapeHtml(t('roomCode')) + ': <strong>' + escapeHtml(item.public_id) + '</strong></span>'
            + '</span>'
            + '</div>'
            + '<div class="tactics-catalog-card__meta-row">'
            + createdAt
            + '</div>'
            + '</div>'
            + '</a>';
    }

    function renderCatalog(listEl, items, roomBase) {
        if (!listEl) return;
        const t = i18n().t;
        if (!items || !items.length) {
            listEl.innerHTML = '<p class="tactics-catalog-empty">' + escapeHtml(t('noRooms')) + '</p>';
            return;
        }
        const base = (roomBase || window.ABS_TACTICS_LOBBY_BASE || '/services/tactics').replace(/\/?$/, '');
        listEl.innerHTML = items.map((item) => {
            const href = base + '/' + encodeURIComponent(item.public_id);
            return renderCard(item, href, t);
        }).join('');
    }

    window.AbsTacticsCatalogCards = { renderCatalog, renderCard };
})();
