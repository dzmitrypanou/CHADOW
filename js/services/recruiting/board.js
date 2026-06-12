(() => {
    const i18n = window.AbsRecruitingI18n;
    if (!i18n) return;

    let lang = i18n.getLang();
    let postTypes = i18n.postTypesForLang(lang);

    const listEl = document.getElementById('recruitingPostList');
    const statusEl = document.getElementById('recruitingListStatus');
    const paginationEl = document.getElementById('recruitingPagination');
    const typeSelect = document.getElementById('recruitingFilterType');
    const searchInput = document.getElementById('recruitingFilterSearch');
    const searchBtn = document.getElementById('recruitingSearchBtn');
    const realmTabs = document.getElementById('recruitingRealmTabs');

    if (!listEl) return;

    let listRendered = false;

    function syncLang() {
        lang = i18n.getLang();
        postTypes = i18n.postTypesForLang(lang);
        window.ABS_RECRUITING_POST_TYPES = postTypes;
        return lang;
    }

    function buildT() {
        syncLang();
        return { ...i18n.STRINGS[lang].boardJs };
    }

    let t = buildT();

    const state = {
        postType: '',
        realm: '',
        q: '',
        page: 1,
        limit: 20,
        loading: false,
    };

    let searchDebounce = null;
    let lastItems = [];
    let lastPagination = null;

    function postTypeLabel(value) {
        const found = postTypes.find((item) => item.value === value);
        return found ? found.label : i18n.postTypeLabel(value, lang);
    }

    function postTypeClass(value) {
        const map = {
            clan_seeks_players: 'recruiting-type-badge--clan-seeks',
            team_seeks_players: 'recruiting-type-badge--team-seeks',
            player_seeks_clan: 'recruiting-type-badge--player-clan',
            player_seeks_team: 'recruiting-type-badge--player-team',
        };
        return map[value] || '';
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const CLAN_TAG_PLACEHOLDERS = new Set([
        'Без клана',
        'Without clan',
        'Без команды',
        'Without team',
    ]);

    function isClanTagPlaceholder(tag) {
        return CLAN_TAG_PLACEHOLDERS.has(String(tag || '').trim());
    }

    function formatClanTagBoardDisplay(tag, type) {
        const value = String(tag || '').trim();
        if (!value) return '';
        if (isClanTagPlaceholder(value)) {
            return value;
        }
        const clanLabel = type === 'team_name' ? t.teamNameLabel : t.clanTagLabel;
        return `${clanLabel}: ${value}`;
    }

    function renderClanTagMeta(post) {
        if (!post.clan_tag) return '';
        const tag = String(post.clan_tag || '').trim();
        if (!tag) return '';
        if (isClanTagPlaceholder(tag)) {
            return `<span class="recruiting-post-meta-item recruiting-post-meta-item--clan"><i class="fas fa-shield-alt" aria-hidden="true"></i> ${escapeHtml(tag)}</span>`;
        }

        const type = String(post.clan_tag_type || 'clan_tag');
        const href = post.clan_tag_href ? String(post.clan_tag_href).trim() : '';
        if (href) {
            const label = type === 'team_name' ? t.teamNameLabel : t.clanTagLabel;
            return `<span class="recruiting-post-meta-item recruiting-post-meta-item--clan"><i class="fas fa-shield-alt" aria-hidden="true"></i> ${escapeHtml(label)}: <a class="recruiting-clan-tag-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tag)}</a></span>`;
        }

        const clanDisplay = formatClanTagBoardDisplay(tag, type);
        if (!clanDisplay) return '';
        return `<span class="recruiting-post-meta-item recruiting-post-meta-item--clan"><i class="fas fa-shield-alt" aria-hidden="true"></i> ${escapeHtml(clanDisplay)}</span>`;
    }

    function formatPostDate(iso) {
        if (!iso) return '—';
        if (typeof window.absFormatUtcLocal === 'function') {
            const formatted = window.absFormatUtcLocal(iso);
            return formatted || '—';
        }
        return String(iso).trim() || '—';
    }

    function excerpt(text, maxLen) {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (clean.length <= maxLen) return clean;
        return clean.slice(0, maxLen).trim() + '…';
    }

    function contactHref(type, value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (/^https?:\/\//i.test(raw)) {
            return raw;
        }

        switch (type) {
            case 'vk': {
                const slug = raw.replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?vk\.com\//i, '');
                return slug ? `https://vk.com/${encodeURIComponent(slug)}` : null;
            }
            case 'telegram': {
                const slug = raw.replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, '');
                return slug ? `https://t.me/${encodeURIComponent(slug)}` : null;
            }
            case 'viber': {
                const digits = raw.replace(/\D/g, '');
                return digits ? `viber://chat?number=%2B${digits}` : null;
            }
            case 'discord': {
                if (/discord(?:app)?\.com/i.test(raw) || /^discord\.gg\//i.test(raw)) {
                    return raw.startsWith('http') ? raw : `https://${raw}`;
                }
                return null;
            }
            case 'max': {
                if (/max\.ru\/join\//i.test(raw)) {
                    return raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`;
                }
                const code = raw.replace(/^@/, '').trim();
                return /^[a-zA-Z0-9_-]+$/.test(code) ? `https://max.ru/join/${encodeURIComponent(code)}` : null;
            }
            default:
                return null;
        }
    }

    function discordCopyValue(value) {
        return String(value || '').trim().replace(/^@/, '');
    }

    function viberCopyValue(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits ? `+${digits}` : '';
    }

    function renderContactCopyButton(iconHtml, label, copyValue, hint, copiedHint) {
        return `<button type="button" class="recruiting-post-contact-link recruiting-post-contact-link--copy" data-copy-value="${escapeHtml(copyValue)}" data-copy-done="${escapeHtml(copiedHint)}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}">${iconHtml}<span>${label}</span></button>`;
    }

    function showContactCopiedToast(message) {
        if (typeof window.showSiteToast === 'function') {
            window.showSiteToast(message, 'success', { instant: true, duration: 2600 });
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'site-toast site-toast--success is-visible';
        toast.setAttribute('role', 'status');
        toast.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i><span></span>';
        toast.querySelector('span').textContent = message;
        document.body.appendChild(toast);
        window.setTimeout(() => {
            toast.classList.remove('is-visible');
            toast.classList.add('is-hiding');
            window.setTimeout(() => toast.remove(), 280);
        }, 2600);
    }

    async function copyTextToClipboard(text) {
        const value = String(text || '');
        if (!value) return false;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (_) {
            // fallback below
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (_) {
            copied = false;
        }
        document.body.removeChild(textarea);
        return copied;
    }

    function renderContactLink(type, value) {
        const iconClass = {
            vk: 'fab fa-vk',
            telegram: 'fab fa-telegram',
            viber: 'fab fa-viber',
            discord: 'fab fa-discord',
            max: 'recruiting-contact-icon-max',
        }[type] || 'fas fa-link';
        const iconHtml = iconClass === 'recruiting-contact-icon-max'
            ? (typeof window.recruitingMaxIconHtml === 'function'
                ? window.recruitingMaxIconHtml('recruiting-contact-icon-max')
                : '<svg class="recruiting-contact-icon-max" viewBox="0 0 42 42" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" fill-rule="evenodd" d="M21.47 41.88c-4.11 0-6.02-.6-9.34-3-2.1 2.7-8.75 4.81-9.04 1.2 0-2.71-.6-5-1.28-7.5C1 29.5.08 26.07.08 21.1.08 9.23 9.82.3 21.36.3c11.55 0 20.6 9.37 20.6 20.91a20.6 20.6 0 0 1-20.49 20.67m.17-31.32c-5.62-.29-10 3.6-10.97 9.7-.8 5.05.62 11.2 1.83 11.52.58.14 2.04-1.04 2.95-1.95a10.4 10.4 0 0 0 5.08 1.81 10.7 10.7 0 0 0 11.19-9.97 10.7 10.7 0 0 0-10.08-11.1Z"/></svg>')
            : `<i class="${iconClass}" aria-hidden="true"></i>`;
        const label = escapeHtml(value);
        if (type === 'viber') {
            const copyValue = viberCopyValue(value);
            if (copyValue) {
                return renderContactCopyButton(iconHtml, label, copyValue, t.viberCopyHint, t.viberCopied);
            }
        }
        const href = contactHref(type, value);
        if (type === 'discord' && !href) {
            const copyValue = discordCopyValue(value);
            if (copyValue) {
                return renderContactCopyButton(iconHtml, label, copyValue, t.discordCopyHint, t.discordCopied);
            }
        }
        if (href) {
            return `<a class="recruiting-post-contact-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${iconHtml}<span>${label}</span></a>`;
        }
        return `<span class="recruiting-post-contact-link recruiting-post-contact-link--plain">${iconHtml}<span>${label}</span></span>`;
    }

    function setStatus(message, isError) {
        if (!statusEl) return;
        if (!message) {
            statusEl.textContent = '';
            statusEl.classList.add('hidden');
            statusEl.classList.remove('is-error');
            return;
        }
        statusEl.textContent = message;
        statusEl.classList.remove('hidden');
        statusEl.classList.toggle('is-error', !!isError);
    }

    function showLoading() {
        t = buildT();
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.classList.add('hidden');
            statusEl.classList.remove('is-error');
        }
        listEl.innerHTML = `<p class="recruiting-list-loading" role="status">${escapeHtml(t.loading)}</p>`;
    }

    function getActiveRealm() {
        if (!realmTabs) return '';
        const active = realmTabs.querySelector('.recruiting-realm-tab.is-active');
        return active ? String(active.getAttribute('data-realm') || '') : '';
    }

    function buildQuery() {
        const params = new URLSearchParams();
        if (state.postType) params.set('post_type', state.postType);
        if (state.realm) params.set('realm', state.realm);
        if (state.q) params.set('q', state.q);
        params.set('page', String(state.page));
        params.set('limit', String(state.limit));
        return params.toString();
    }

    function renderPostCard(post) {
        const typeLabel = postTypeLabel(post.post_type);
        const typeClass = postTypeClass(post.post_type);
        const realm = i18n.realmDisplayLabel(String(post.realm || ''));
        const bodyShort = excerpt(post.body, 220);
        const bodyFull = String(post.body || '');
        const hasMore = bodyFull.length > bodyShort.length;

        const metaParts = [];
        if (post.clan_tag) {
            const clanMeta = renderClanTagMeta(post);
            if (clanMeta) {
                metaParts.push(clanMeta);
            }
        }
        const contacts = Array.isArray(post.contacts) ? post.contacts : [];
        const contactLinks = contacts
            .map((item) => {
                const type = String(item.type || 'telegram');
                const value = String(item.value || '').trim();
                if (!value) return '';
                return renderContactLink(type, value);
            })
            .filter(Boolean);

        return `
            <article class="recruiting-post-card" data-post-id="${post.id}">
                <header class="recruiting-post-card-head">
                    <div class="recruiting-post-card-meta">
                        <span class="recruiting-post-author">${t.author}: ${escapeHtml(post.author || '—')}</span>
                        <time class="recruiting-post-date" datetime="${escapeHtml(String(post.published_at || post.created_at || ''))}">${escapeHtml(formatPostDate(post.published_at || post.created_at))}</time>
                    </div>
                </header>
                <div class="recruiting-post-excerpt">${escapeHtml(bodyShort)}</div>
                ${hasMore ? `<div class="recruiting-post-body-full hidden">${escapeHtml(bodyFull)}</div><button type="button" class="recruiting-post-toggle" data-expanded="false">${t.readMore}</button>` : ''}
                <footer class="recruiting-post-card-foot">
                    ${metaParts.length || contactLinks.length ? `<div class="recruiting-post-card-foot-row">${metaParts.join('')}${contactLinks.length ? `<div class="recruiting-post-contacts">${contactLinks.join('')}</div>` : ''}</div>` : ''}
                    <div class="recruiting-post-badges recruiting-post-badges--bottom">
                        <span class="recruiting-type-badge ${typeClass}">${escapeHtml(typeLabel)}</span>
                        <span class="recruiting-realm-badge">${escapeHtml(realm)}</span>
                    </div>
                </footer>
            </article>
        `;
    }

    const MASONRY_MIN_WIDTH = 769;
    let masonryResizeTimer = null;

    function masonryEnabled() {
        return window.matchMedia(`(min-width: ${MASONRY_MIN_WIDTH}px)`).matches;
    }

    function collectPostCards() {
        if (listEl.querySelector('.recruiting-post-column')) {
            return [...listEl.querySelectorAll('.recruiting-post-card')].sort((a, b) => {
                return Number(a.dataset.listOrder ?? 0) - Number(b.dataset.listOrder ?? 0);
            });
        }

        return [...listEl.querySelectorAll(':scope > .recruiting-post-card')];
    }

    function flattenPostList() {
        const cards = collectPostCards();
        if (!cards.length || !listEl.querySelector('.recruiting-post-column')) {
            return;
        }
        listEl.replaceChildren(...cards);
    }

    function hasExpandedPosts() {
        return !!listEl.querySelector('.recruiting-post-toggle[data-expanded="true"]');
    }

    function layoutPostListMasonry() {
        if (listEl.querySelector('.recruiting-list-empty, .recruiting-list-loading')) {
            return;
        }
        if (hasExpandedPosts()) {
            return;
        }

        const cards = collectPostCards();
        if (!cards.length) {
            return;
        }

        cards.forEach((card, index) => {
            card.dataset.listOrder = String(index);
        });

        if (!masonryEnabled()) {
            flattenPostList();
            return;
        }

        let col1 = listEl.querySelector('.recruiting-post-column[data-column="1"]');
        let col2 = listEl.querySelector('.recruiting-post-column[data-column="2"]');

        if (!col1) {
            listEl.replaceChildren();
            col1 = document.createElement('div');
            col2 = document.createElement('div');
            col1.className = 'recruiting-post-column';
            col2.className = 'recruiting-post-column';
            col1.dataset.column = '1';
            col2.dataset.column = '2';
            listEl.append(col1, col2);
        } else {
            col1.replaceChildren();
            col2.replaceChildren();
        }

        cards.forEach((card, index) => {
            let target;
            if (index === 0) {
                target = col1;
            } else if (index === 1) {
                target = col2;
            } else {
                target = col1.offsetHeight <= col2.offsetHeight ? col1 : col2;
            }
            target.appendChild(card);
        });
    }

    function renderList(items) {
        t = buildT();
        listRendered = true;
        if (!items.length) {
            listEl.innerHTML = `<p class="recruiting-list-empty">${t.empty}</p>`;
            return;
        }
        listEl.innerHTML = items.map(renderPostCard).join('');
        if (typeof window.absApplyLocalTimes === 'function') {
            window.absApplyLocalTimes(listEl);
        }
        layoutPostListMasonry();
    }

    function renderPagination(pagination) {
        t = buildT();
        if (!paginationEl || !pagination) {
            if (paginationEl) paginationEl.classList.add('hidden');
            return;
        }

        const pages = Number(pagination.pages || 0);
        const page = Number(pagination.page || 1);
        if (pages <= 1) {
            paginationEl.classList.add('hidden');
            paginationEl.innerHTML = '';
            return;
        }

        paginationEl.classList.remove('hidden');
        paginationEl.innerHTML = `
            <button type="button" class="recruiting-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${t.prev}</button>
            <span class="recruiting-page-info">${t.page} ${page} / ${pages}</span>
            <button type="button" class="recruiting-page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>${t.next}</button>
        `;
    }

    function handlePostToggleClick(btn) {
        const card = btn.closest('.recruiting-post-card');
        const full = card ? card.querySelector('.recruiting-post-body-full') : null;
        const excerptEl = card ? card.querySelector('.recruiting-post-excerpt') : null;
        if (!full || !excerptEl) return;

        const expanded = btn.getAttribute('data-expanded') === 'true';
        if (expanded) {
            full.classList.add('hidden');
            excerptEl.classList.remove('hidden');
            btn.setAttribute('data-expanded', 'false');
            btn.textContent = buildT().readMore;
            requestAnimationFrame(() => layoutPostListMasonry());
            return;
        }

        full.classList.remove('hidden');
        excerptEl.classList.add('hidden');
        btn.setAttribute('data-expanded', 'true');
        btn.textContent = buildT().showLess;
    }

    async function loadPosts() {
        if (state.loading) return;
        state.loading = true;
        showLoading();

        try {
            const res = await fetch(`/api/recruiting/list.php?${buildQuery()}`, {
                headers: { Accept: 'application/json' },
            });
            const json = await res.json();
            t = buildT();
            if (!json.success) {
                throw new Error(json.error || t.error);
            }

            lastItems = Array.isArray(json.data) ? json.data : [];
            lastPagination = json.pagination || null;
            renderList(lastItems);
            renderPagination(lastPagination);
            setStatus('', false);
        } catch (err) {
            t = buildT();
            setStatus(err.message || t.error, true);
        } finally {
            state.loading = false;
        }
    }

    function relocalizeView() {
        t = buildT();
        if (state.loading) {
            showLoading();
            return;
        }
        if (listRendered) {
            renderList(lastItems);
            renderPagination(lastPagination);
        }
    }

    function switchLanguage(newLang) {
        lang = i18n.setLang(newLang);
        relocalizeView();
        return true;
    }

    function applyFilters(resetPage) {
        state.postType = typeSelect ? String(typeSelect.value || '') : '';
        state.realm = getActiveRealm();
        state.q = searchInput ? String(searchInput.value || '').trim() : '';
        if (resetPage) state.page = 1;
        loadPosts();
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', () => applyFilters(true));
    }

    if (realmTabs) {
        realmTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.recruiting-realm-tab');
            if (!tab || tab.classList.contains('is-active')) return;
            realmTabs.querySelectorAll('.recruiting-realm-tab').forEach((el) => {
                const active = el === tab;
                el.classList.toggle('is-active', active);
                el.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            applyFilters(true);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => applyFilters(true));
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyFilters(true);
            }
        });
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => applyFilters(true), 400);
        });
    }

    if (paginationEl) {
        paginationEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.recruiting-page-btn');
            if (!btn || btn.disabled) return;
            const nextPage = Number(btn.getAttribute('data-page'));
            if (!Number.isFinite(nextPage) || nextPage < 1) return;
            state.page = nextPage;
            loadPosts();
        });
    }

    let contactCopyResetTimer = null;

    listEl.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.recruiting-post-toggle');
        if (toggleBtn && listEl.contains(toggleBtn)) {
            handlePostToggleClick(toggleBtn);
            return;
        }

        const btn = e.target.closest('.recruiting-post-contact-link--copy');
        if (!btn || btn.disabled) return;

        const text = btn.getAttribute('data-copy-value') || '';
        if (!text) return;

        const copied = await copyTextToClipboard(text);
        if (!copied) return;

        const copiedHint = btn.getAttribute('data-copy-done') || '';
        showContactCopiedToast(copiedHint);

        btn.classList.add('is-copied');
        clearTimeout(contactCopyResetTimer);
        contactCopyResetTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
        }, 1200);
    });

    window.addEventListener('recruiting:langchange', () => {
        relocalizeView();
    });

    window.addEventListener('resize', () => {
        clearTimeout(masonryResizeTimer);
        masonryResizeTimer = setTimeout(layoutPostListMasonry, 150);
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (typeSelect && urlParams.has('post_type')) {
        typeSelect.value = urlParams.get('post_type') || '';
    }
    if (searchInput && urlParams.has('q')) {
        searchInput.value = urlParams.get('q') || '';
    }
    if (realmTabs && urlParams.has('realm')) {
        const realm = urlParams.get('realm') || '';
        realmTabs.querySelectorAll('.recruiting-realm-tab').forEach((tab) => {
            const active = (tab.getAttribute('data-realm') || '') === realm;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    state.postType = typeSelect ? String(typeSelect.value || '') : '';
    state.realm = getActiveRealm();
    state.q = searchInput ? String(searchInput.value || '').trim() : '';
    if (urlParams.has('page')) {
        const pageFromUrl = Number(urlParams.get('page'));
        if (Number.isFinite(pageFromUrl) && pageFromUrl >= 1) {
            state.page = pageFromUrl;
        }
    }

    function bootstrapList() {
        const initial = window.ABS_RECRUITING_INITIAL;
        const hasServerCards = listEl.getAttribute('data-ssr') === '1'
            && listEl.querySelector('.recruiting-post-card, .recruiting-list-empty');

        if (initial && initial.success) {
            lastItems = Array.isArray(initial.data) ? initial.data : [];
            lastPagination = initial.pagination || null;
            if (hasServerCards) {
                listRendered = true;
                layoutPostListMasonry();
            } else {
                renderList(lastItems);
            }
            renderPagination(lastPagination);
            return;
        }

        if (hasServerCards) {
            listRendered = true;
            layoutPostListMasonry();
            return;
        }

        applyFilters(false);
    }

    window.AbsRecruiting = {
        switchLanguage,
        relocalizeView,
        loadPosts,
    };

    bootstrapList();
})();
