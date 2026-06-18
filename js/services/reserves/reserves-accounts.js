(() => {
    'use strict';

    const batchApiBase = window.ABS_RESERVES_CLANS_API || '/api/reserves/clans.php';

    function escAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function noClanLabel() {
        if (window.AbsReservesI18n && typeof window.AbsReservesI18n.t === 'function') {
            return window.AbsReservesI18n.t('noClan');
        }
        return window.ABS_RESERVES_LANG === 'en' ? 'Player not in a clan' : 'Игрок не в клане';
    }

    function applyClanToCard(card, clan, nickname = '', options = {}) {
        if (!card) return;

        card.classList.remove('reserves-linked-card--clan-loading');

        const emblemSlot = card.querySelector('[data-reserves-clan-emblem]');
        const clanInfo = card.querySelector('[data-reserves-clan-info]');
        const tagEl = card.querySelector('[data-reserves-clan-tag]');
        const nameEl = card.querySelector('[data-reserves-clan-name]');
        const nickEl = card.querySelector('.reserves-linked-card__nick');

        const cleanNick = String(nickname || '').trim();
        if (nickEl && cleanNick !== '' && !/^#\d+$/.test(cleanNick)) {
            nickEl.textContent = cleanNick;
        }

        if (!clan) {
            if (options.noClan && clanInfo && nameEl) {
                if (tagEl) tagEl.textContent = '';
                nameEl.textContent = noClanLabel();
                nameEl.setAttribute('data-reserves-i18n', 'noClan');
                nameEl.removeAttribute('title');
                nameEl.classList.add('reserves-linked-card__clan-name--no-clan');
                clanInfo.classList.add('reserves-linked-card__clan--no-clan', 'reserves-linked-card__clan--loaded');
            }
            return;
        }

        if (clanInfo) {
            clanInfo.classList.remove('reserves-linked-card__clan--no-clan');
        }
        if (nameEl) {
            nameEl.classList.remove('reserves-linked-card__clan-name--no-clan');
            nameEl.removeAttribute('data-reserves-i18n');
        }

        const tag = String(clan.tag || '').trim();
        const name = String(clan.name || '').trim();
        const emblem = String(clan.emblem_url || '').trim();

        if (emblemSlot && emblem !== '') {
            emblemSlot.innerHTML = '<img class="reserves-linked-card__emblem" src="'
                + escAttr(emblem)
                + '" alt="" loading="lazy" width="52" height="52" decoding="async" fetchpriority="high">';
        }

        if (tagEl) {
            if (tag !== '') {
                tagEl.textContent = '[' + tag + ']';
            } else {
                tagEl.textContent = '';
            }
        }

        if (nameEl) {
            if (name !== '') {
                nameEl.textContent = name;
                nameEl.title = name;
            } else {
                nameEl.textContent = '';
                nameEl.removeAttribute('title');
            }
        }

        if (clanInfo && (tag !== '' || name !== '')) {
            clanInfo.classList.add('reserves-linked-card__clan--loaded');
        }
    }

    async function fetchClansBatch(linkIds) {
        if (!linkIds.length) {
            return {};
        }

        const params = new URLSearchParams({
            link_ids: linkIds.join(','),
            lang: window.AbsReservesI18n?.getLang?.() || window.ABS_RESERVES_LANG || 'ru',
        });

        const url = batchApiBase + (batchApiBase.includes('?') ? '&' : '?') + params.toString();
        const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return {};
        }

        return data?.data?.accounts || {};
    }

    function collectLinkIds(selector) {
        return [...document.querySelectorAll(selector)]
            .map((accountEl) => Number(accountEl.dataset.reserveLinkId || 0))
            .filter((linkId) => linkId > 0);
    }

    async function loadClansForAccounts() {
        const loadIds = collectLinkIds('.reserves-region-account[data-reserves-clan-load="1"]');
        const refreshIds = collectLinkIds('.reserves-region-account[data-reserves-clan-refresh="1"]');
        const linkIds = [...new Set([...loadIds, ...refreshIds])];
        if (!linkIds.length) {
            return;
        }

        const cardsByLinkId = new Map();
        linkIds.forEach((linkId) => {
            const accountEl = document.querySelector(`.reserves-region-account[data-reserve-link-id="${linkId}"]`);
            const card = accountEl?.querySelector('.reserves-linked-card');
            if (card) {
                cardsByLinkId.set(linkId, card);
            }
        });

        try {
            const accounts = await fetchClansBatch(linkIds);
            linkIds.forEach((linkId) => {
                const card = cardsByLinkId.get(linkId);
                if (!card) return;

                const payload = accounts[String(linkId)] || accounts[linkId] || null;
                if (!payload) {
                    if (loadIds.includes(linkId)) {
                        card.classList.remove('reserves-linked-card--clan-loading');
                    }
                    return;
                }

                applyClanToCard(
                    card,
                    payload.clan || null,
                    payload.nickname || '',
                    { noClan: Boolean(payload.no_clan) },
                );

                const accountEl = document.querySelector(`.reserves-region-account[data-reserve-link-id="${linkId}"]`);
                if (accountEl) {
                    accountEl.dataset.reservesClanLoad = '0';
                    accountEl.dataset.reservesClanRefresh = '0';
                }
            });
        } catch {
            loadIds.forEach((linkId) => {
                const card = cardsByLinkId.get(linkId);
                if (card) {
                    card.classList.remove('reserves-linked-card--clan-loading');
                }
            });
        }
    }

    function init() {
        loadClansForAccounts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
