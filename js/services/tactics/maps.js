(() => {
    'use strict';

    let mapsCache = null;
    let catalogCache = null;
    let catalogLang = null;
    let mapsPromise = null;
    let catalogPromise = null;
    let catalogReady = false;
    let catalogRefreshPromise = null;

    function currentLang() {
        return window.AbsTacticsI18n?.getLang?.()
            || window.ABS_TACTICS_LANG
            || window.ABS_LANG
            || 'ru';
    }

    function catalogApiUrl() {
        const base = window.ABS_TACTICS_CATALOG_API || '/api/tactics/maps.php';
        const lang = currentLang();
        const sep = base.includes('?') ? '&' : '?';
        return base + sep + 'lang=' + encodeURIComponent(lang);
    }

    function resetCatalogCache() {
        catalogCache = null;
        catalogLang = null;
        catalogPromise = null;
        mapsCache = null;
        mapsPromise = null;
        catalogReady = false;
    }
    /** @type {Map<string, HTMLImageElement>} */
    const imageCache = new Map();
    /** @type {Map<string, Promise<HTMLImageElement|null>>} */
    const imageLoadPromises = new Map();

    function mapUrl(mapCode, game, battleMode) {
        const code = (mapCode || 'cliff').toLowerCase();
        const g = (game || 'wot').toLowerCase();
        const mode = (battleMode || 'random').toLowerCase();
        const root = '/assets/tactics/maps';
        return root + '/' + encodeURIComponent(g) + '/' + encodeURIComponent(mode) + '/' + encodeURIComponent(code) + '.webp';
    }

    function mapUrlCandidates(mapCode, game, battleMode) {
        const code = (mapCode || 'cliff').toLowerCase();
        const g = (game || 'wot').toLowerCase();
        const mode = (battleMode || 'random').toLowerCase();
        const root = '/assets/tactics/maps';
        return [
            root + '/' + g + '/' + mode + '/' + code + '.webp',
            root + '/' + g + '/' + mode + '/' + code + '.png',
            root + '/' + g + '/' + mode + '/' + code + '.jpg',
            root + '/' + g + '/' + code + '.webp',
            root + '/' + g + '/' + code + '.png',
            root + '/' + code + '.webp',
            root + '/' + code + '.png',
            root + '/' + code + '.jpg',
            placeholderUrl(),
        ];
    }

    function placeholderUrl() {
        return '/assets/tactics/maps/placeholder.svg';
    }

    async function loadMaps() {
        const lang = currentLang();
        if (mapsCache && catalogLang === lang) return mapsCache;
        if (mapsPromise && catalogLang === lang) return mapsPromise;

        mapsPromise = (async () => {
            await loadCatalog();
            const all = [];
            const seen = new Set();
            const games = catalogCache?.games || {};
            Object.keys(games).forEach((gameId) => {
                const modes = games[gameId]?.modes || {};
                Object.keys(modes).forEach((modeId) => {
                    (modes[modeId] || []).forEach((row) => {
                        if (!row?.map_code || seen.has(row.map_code)) return;
                        seen.add(row.map_code);
                        all.push(row);
                    });
                });
            });
            mapsCache = all;
            return mapsCache;
        })();

        return mapsPromise;
    }

    async function loadCatalog(forceReload) {
        const lang = currentLang();
        if (!forceReload && catalogCache && catalogLang === lang) {
            return catalogCache;
        }
        if (!forceReload && catalogPromise && catalogLang === lang) {
            return catalogPromise;
        }

        resetCatalogCache();
        catalogLang = lang;

        catalogPromise = (async () => {
            const res = await fetch(catalogApiUrl(), {
                credentials: 'same-origin',
                cache: 'no-cache',
            });
            const json = await res.json().catch(() => ({}));
            if (json.success && json.data) {
                catalogCache = json.data;
                catalogReady = true;
                return catalogCache;
            }
            catalogCache = { games: {}, mode_labels: {}, default_game: 'wot', default_mode: 'random' };
            catalogReady = true;
            return catalogCache;
        })();

        return catalogPromise;
    }

    async function refreshCatalog() {
        if (catalogRefreshPromise) return catalogRefreshPromise;

        catalogRefreshPromise = (async () => {
            await loadCatalog(true);
            mapsCache = null;
            mapsPromise = null;
            await loadMaps();
            window.dispatchEvent(new CustomEvent('tactics:catalog-updated'));
            return catalogCache;
        })().finally(() => {
            catalogRefreshPromise = null;
        });

        return catalogRefreshPromise;
    }

    function getCatalog() {
        return catalogCache;
    }

    function getMapsSync() {
        return mapsCache || [];
    }

    function getMapsFor(game, battleMode) {
        const g = game || 'wot';
        const mode = battleMode || 'random';
        const rows = catalogCache?.games?.[g]?.modes?.[mode];
        return Array.isArray(rows) ? rows : [];
    }

    function findMap(mapCode, game, battleMode) {
        const code = (mapCode || '').toLowerCase();
        const g = game ? String(game).toLowerCase() : '';
        const mode = battleMode ? String(battleMode).toLowerCase() : '';

        if (g && mode) {
            const scoped = getMapsFor(g, mode).find((m) => (m.map_code || '').toLowerCase() === code);
            if (scoped) return scoped;
        }

        const all = getMapsSync();
        if (g) {
            const byGame = all.find((m) => (m.map_code || '').toLowerCase() === code
                && (m.game || g).toLowerCase() === g);
            if (byGame) return byGame;
        }

        return all.find((m) => (m.map_code || '').toLowerCase() === code) || null;
    }

    function getSlideDefaultTitle(mapCode, game, battleMode, lang) {
        const i18n = window.AbsTacticsI18n;
        const normalizedLang = lang === 'en' ? 'en' : 'ru';
        const g = (game || 'wot').toLowerCase();
        const mode = (battleMode || 'random').toLowerCase();
        const code = (mapCode || '').toLowerCase();

        if ((mode === 'custom' && (code === CUSTOM_MAP_CODES.cs2 || code === CUSTOM_MAP_CODES.dota2))
            || code === CUSTOM_MAP_CODES.cs2
            || code === CUSTOM_MAP_CODES.dota2) {
            return i18n ? i18n.t('customMapTitle') : (normalizedLang === 'en' ? 'Custom map' : 'Своя карта');
        }

        const map = findMap(code, g, mode);
        if (map && i18n) {
            return i18n.mapDisplayName(map, normalizedLang);
        }
        if (map) {
            return normalizedLang === 'en'
                ? (map.display_name_en || map.display_name_ru || code)
                : (map.display_name_ru || map.display_name_en || code);
        }

        return code;
    }

    function getSlideTitle(slide, lang) {
        const custom = typeof slide?.title === 'string' ? slide.title.trim() : '';
        if (custom) return custom;
        return getSlideDefaultTitle(slide?.map_code, slide?.game, slide?.battle_mode, lang);
    }

    function populateSelect(selectEl, lang, selectedCode, rows) {
        if (!selectEl) return;
        const list = Array.isArray(rows) ? rows : getMapsSync();
        const i18n = window.AbsTacticsI18n;
        const prev = selectedCode || selectEl.value;
        selectEl.innerHTML = '';
        if (!list.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.selected = true;
            opt.textContent = i18n ? i18n.t('noMapsForMode') : 'No maps';
            selectEl.appendChild(opt);
            return;
        }
        list.forEach((map) => {
            const opt = document.createElement('option');
            opt.value = map.map_code;
            opt.textContent = i18n ? i18n.mapDisplayName(map, lang) : map.display_name_ru;
            if (prev && map.map_code === prev) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        });
        if (!selectEl.value && list[0]) {
            selectEl.value = list[0].map_code;
        }
    }

    function getCachedImage(url) {
        const key = String(url || '').trim();
        return key ? (imageCache.get(key) || null) : null;
    }

    function loadImageUrl(url) {
        const key = String(url || '').trim();
        if (!key) return Promise.resolve(null);

        const cached = imageCache.get(key);
        if (cached) return Promise.resolve(cached);

        const pending = imageLoadPromises.get(key);
        if (pending) return pending;

        const promise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                imageCache.set(key, img);
                imageLoadPromises.delete(key);
                resolve(img);
            };
            img.onerror = () => {
                imageLoadPromises.delete(key);
                resolve(null);
            };
            img.src = key;
        });

        imageLoadPromises.set(key, promise);
        return promise;
    }

    function loadMapImage(mapCode, game, battleMode, preferredUrl, slide, publicId) {
        const preferred = String(preferredUrl || '').trim();
        const baseCandidates = slide
            ? slideMapUrlCandidates(slide, publicId, preferred ? { [slide.id]: preferred } : null)
            : mapUrlCandidates(mapCode, game, battleMode);
        const candidates = preferred
            ? [preferred, ...baseCandidates.filter((url) => url !== preferred)]
            : baseCandidates;

        for (let i = 0; i < candidates.length; i += 1) {
            const cached = imageCache.get(candidates[i]);
            if (cached) return Promise.resolve(cached);
        }

        let index = 0;

        return new Promise((resolve) => {
            const tryNext = () => {
                if (index >= candidates.length) {
                    resolve(null);
                    return;
                }
                const url = candidates[index];
                index += 1;
                loadImageUrl(url).then((img) => {
                    if (img) {
                        resolve(img);
                        return;
                    }
                    tryNext();
                });
            };
            tryNext();
        });
    }

    function preloadMapUrls(urls) {
        const unique = [...new Set((urls || []).map((url) => String(url || '').trim()).filter(Boolean))];
        unique.forEach((url) => {
            if (!imageCache.has(url) && !imageLoadPromises.has(url)) {
                loadImageUrl(url);
            }
        });
    }

    const CUSTOM_MAP_CODES = {
        cs2: 'cs2_custom',
        dota2: 'dota2_custom',
    };

    function isCustomRoomSlide(slide) {
        if (!slide) return false;
        const game = (slide.game || 'wot').toLowerCase();
        const mode = (slide.battle_mode || 'random').toLowerCase();
        const code = (slide.map_code || '').toLowerCase();
        const expected = CUSTOM_MAP_CODES[game];
        return !!expected && mode === 'custom' && code === expected && !!slide.id;
    }

    function customRoomMapBase(slide, publicId) {
        const game = (slide.game || 'wot').toLowerCase();
        return '/assets/tactics/maps/' + encodeURIComponent(game) + '/custom/rooms/'
            + encodeURIComponent(publicId) + '/'
            + encodeURIComponent(slide.id);
    }

    function knownSlideMapUrl(slide, knownUrls) {
        if (!slide?.id) return '';
        const urls = knownUrls
            || (typeof window !== 'undefined' ? window.ABS_TACTICS_MAP_URLS : null)
            || {};
        return String(urls[slide.id] || '').trim();
    }

    function slideMapUrl(slide, publicId, knownUrls) {
        if (!slide) return placeholderUrl();

        const known = knownSlideMapUrl(slide, knownUrls);
        if (known) return known;

        if (publicId && isCustomRoomSlide(slide)) {
            return placeholderUrl();
        }

        return mapUrl(slide.map_code, slide.game, slide.battle_mode);
    }

    function slideMapUrlCandidates(slide, publicId, knownUrls) {
        if (publicId && isCustomRoomSlide(slide)) {
            const known = knownSlideMapUrl(slide, knownUrls);
            if (known && known !== placeholderUrl()) {
                const base = known.replace(/\.(webp|png|jpe?g)$/i, '');
                return [known, base + '.webp', base + '.png', base + '.jpg', placeholderUrl()];
            }
            return [placeholderUrl()];
        }
        return mapUrlCandidates(slide.map_code, slide.game, slide.battle_mode);
    }

    async function slideSideLength(slide) {
        if (!slide) return null;

        await loadMaps();

        const code = (slide.map_code || '').toLowerCase();
        if (!code) return null;

        const game = slide.game || 'wot';
        const mode = slide.battle_mode || 'random';
        const list = getMapsFor(game, mode);
        const row = list.find((m) => (m.map_code || '').toLowerCase() === code) || findMap(code);
        const len = row?.side_length != null ? parseInt(row.side_length, 10) : null;

        return len && len > 0 ? len : null;
    }

    window.addEventListener('tactics:langchange', () => {
        resetCatalogCache();
        catalogReady = false;
    });

    window.addEventListener('pageshow', (ev) => {
        if (!ev.persisted || !catalogReady) return;
        refreshCatalog();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !catalogReady) return;
        refreshCatalog();
    });

    window.AbsTacticsMaps = {
        loadMaps,
        loadCatalog,
        refreshCatalog,
        resetCatalogCache,
        getCatalog,
        getMapsSync,
        getMapsFor,
        findMap,
        getSlideDefaultTitle,
        getSlideTitle,
        populateSelect,
        loadMapImage,
        loadImageUrl,
        getCachedImage,
        preloadMapUrls,
        mapUrl,
        slideMapUrl,
        slideMapUrlCandidates,
        slideSideLength,
        placeholderUrl,
    };
})();
