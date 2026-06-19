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
        const version = window.ABS_APP_VERSION || '';
        const sep = base.includes('?') ? '&' : '?';
        let url = base + sep + 'lang=' + encodeURIComponent(lang);
        if (version) {
            url += '&v=' + encodeURIComponent(version);
        }
        return url;
    }

    function randomOnlyMapCodes() {
        const list = catalogCache?.random_only_maps;
        return Array.isArray(list) ? list.map((c) => String(c).toLowerCase()) : ['karelia'];
    }

    function isMapAllowedForMode(mapCode, game, battleMode) {
        const code = String(mapCode || '').toLowerCase();
        const mode = String(battleMode || 'random').toLowerCase();
        if (mode !== 'random' && randomOnlyMapCodes().includes(code)) {
            return false;
        }
        const rows = getMapsFor(game, battleMode);
        return rows.some((m) => (m.map_code || '').toLowerCase() === code);
    }

    function resetCatalogCache() {
        catalogCache = null;
        catalogLang = null;
        catalogPromise = null;
        mapsCache = null;
        mapsPromise = null;
        catalogReady = false;
    }

    const imageCache = new Map();

    const imageLoadPromises = new Map();

    function mapUrl(mapCode, game, battleMode) {
        const code = (mapCode || 'cliff').toLowerCase();
        const g = (game || 'wot').toLowerCase();
        const mode = (battleMode || 'random').toLowerCase();
        const root = '/assets/tactics/maps';
        return root + '/' + encodeURIComponent(g) + '/' + encodeURIComponent(mode) + '/'
            + encodeURIComponent(code) + '.webp';
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
            window.dispatchEvent(new CustomEvent('tactics:catalog-updated'));
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
            catalogCache = { games: {}, mode_labels: {}, map_spawns: {}, default_game: 'wot', default_mode: 'random' };
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

    function gameHasMaps(game) {
        const gameMeta = catalogCache?.games?.[game];
        if (!gameMeta) return false;
        const modeIds = gameMeta.mode_ids || Object.keys(gameMeta.modes || {});
        return modeIds.some((modeId) => getMapsFor(game, modeId).length > 0);
    }

    function gamesWithMaps() {
        const games = catalogCache?.games || {};
        return Object.keys(games).filter((gameId) => gameHasMaps(gameId));
    }

    function findMap(mapCode, game, battleMode) {
        const code = (mapCode || '').toLowerCase();
        const g = game ? String(game).toLowerCase() : '';
        const mode = battleMode ? String(battleMode).toLowerCase() : '';

        if (g && mode) {
            const scoped = getMapsFor(g, mode).find((m) => (m.map_code || '').toLowerCase() === code);
            if (scoped) return scoped;
        }

        if (mode && mode !== 'random' && randomOnlyMapCodes().includes(code)) {
            return null;
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

    function supportsSpawnSwap(slide) {
        if (!slide) return false;
        const game = (slide.game || 'wot').toLowerCase();
        if (game !== 'wot' && game !== 'lesta') return false;
        return supportsSpawnOverlay(slide);
    }

    function slideSpawnSwapped(slide) {
        return slide?.view?.spawn_swapped === true;
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

        if (publicId && isCustomRoomSlide(slide)) {
            const known = knownSlideMapUrl(slide, knownUrls);
            if (known) return known;
            return placeholderUrl();
        }

        return mapUrl(
            slide.map_code,
            slide.game,
            slide.battle_mode,
        );
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
        return mapUrlCandidates(
            slide.map_code,
            slide.game,
            slide.battle_mode,
        );
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

    async function slideMapScale(slide) {
        if (!slide) return null;

        const width = parseInt(slide.map_width_m, 10);
        const height = parseInt(slide.map_height_m, 10);
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
            return { width, height };
        }

        const side = await slideSideLength(slide);
        if (side && side > 0) {
            return { width: side, height: side };
        }

        return null;
    }

    function slideMapScaleSync(slide) {
        if (!slide) return null;

        const width = parseInt(slide.map_width_m, 10);
        const height = parseInt(slide.map_height_m, 10);
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
            return { width, height };
        }

        const code = (slide.map_code || '').toLowerCase();
        if (!code || !catalogCache) return null;

        const game = slide.game || 'wot';
        const mode = slide.battle_mode || 'random';
        const list = getMapsFor(game, mode);
        const row = list.find((m) => (m.map_code || '').toLowerCase() === code) || findMap(code);
        const len = row?.side_length != null ? parseInt(row.side_length, 10) : null;
        if (len && len > 0) {
            return { width: len, height: len };
        }

        return null;
    }

    function usesGameUnits(game) {
        return String(game || '').toLowerCase() === 'dota2';
    }

    const CS2_HU_PER_KHU = 1000;
    const DEFAULT_CS2_KHU = 5.9;
    const MIN_CS2_KHU = 0.1;
    const MAX_CS2_KHU = 20;
    const MIN_CUSTOM_MAP_SCALE = 100;
    const MAX_CUSTOM_MAP_SCALE = 20000;
    const DEFAULT_CUSTOM_MAP_SCALE = 1000;

    function usesHammerUnits(game) {
        return String(game || '').toLowerCase() === 'cs2';
    }

    function defaultCustomMapScaleHu(game) {
        if (usesHammerUnits(game)) {
            return Math.round(DEFAULT_CS2_KHU * CS2_HU_PER_KHU);
        }
        return DEFAULT_CUSTOM_MAP_SCALE;
    }

    function formatKhuFromHu(hu, decimals = 1) {
        const n = Number(hu);
        if (!Number.isFinite(n)) return '';
        const fixed = (n / CS2_HU_PER_KHU).toFixed(decimals);
        return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }

    function hammerStoredToAreaKhu(stored) {
        const n = Number(stored);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return n / CS2_HU_PER_KHU;
    }

    function hammerStoredToSideHu(stored) {
        const areaKhu = hammerStoredToAreaKhu(stored);
        if (areaKhu <= 0) return 0;
        return Math.sqrt(areaKhu) * CS2_HU_PER_KHU;
    }

    function parseCustomMapScaleInput(value, game, fallbackHu) {
        if (usesHammerUnits(game)) {
            const parsed = parseFloat(String(value ?? '').replace(',', '.'));
            if (!Number.isFinite(parsed)) return fallbackHu;
            const hu = Math.round(parsed * CS2_HU_PER_KHU);
            const minHu = Math.round(MIN_CS2_KHU * CS2_HU_PER_KHU);
            const maxHu = Math.round(MAX_CS2_KHU * CS2_HU_PER_KHU);
            return Math.max(minHu, Math.min(maxHu, hu));
        }
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return fallbackHu;
        return Math.max(MIN_CUSTOM_MAP_SCALE, Math.min(MAX_CUSTOM_MAP_SCALE, parsed));
    }

    function formatCustomMapScaleInput(hu, game) {
        if (usesHammerUnits(game)) return formatKhuFromHu(hu);
        return String(hu);
    }

    function customMapScaleInputAttrs(game) {
        if (usesHammerUnits(game)) {
            return { min: String(MIN_CS2_KHU), max: String(MAX_CS2_KHU), step: '0.1' };
        }
        return {
            min: String(MIN_CUSTOM_MAP_SCALE),
            max: String(MAX_CUSTOM_MAP_SCALE),
            step: '1',
        };
    }

    function scaleUnitLabel(game) {
        const i18n = window.AbsTacticsI18n;
        if (usesHammerUnits(game)) {
            return i18n ? i18n.t('scaleUnitKhu') : 'kHu';
        }
        if (usesGameUnits(game)) {
            return i18n ? i18n.t('scaleUnitGame') : 'units';
        }
        return i18n ? i18n.t('scaleUnitMetersShort') : 'm';
    }

    function formatSlideScaleLabel(scale, game) {
        if (!scale?.width || !scale?.height) return '';
        if (usesHammerUnits(game)) {
            const width = formatKhuFromHu(scale.width);
            const height = formatKhuFromHu(scale.height);
            if (scale.width === scale.height) {
                return `${width} kHu²`;
            }
            return `${width}×${height} kHu²`;
        }
        const unit = scaleUnitLabel(game);
        return scale.width + '\u00d7' + scale.height + (unit ? ` ${unit}` : '');
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

    function customMapCodeForGame(game) {
        return CUSTOM_MAP_CODES[(game || 'wot').toLowerCase()] || null;
    }

    function normalizeCustomRoomSlide(slide) {
        if (!slide) return slide;
        const game = (slide.game || 'wot').toLowerCase();
        const expected = customMapCodeForGame(game);
        if (expected && (slide.battle_mode || '').toLowerCase() === 'custom') {
            slide.map_code = expected;
        }
        return slide;
    }

    function needsCustomMapFileCopy(source, copy, publicId, mapUrls = {}) {
        if (!source || !copy) return false;
        normalizeCustomRoomSlide(source);
        normalizeCustomRoomSlide(copy);
        if (isCustomRoomSlide(source) || isCustomRoomSlide(copy)) return true;
        const sourceUrl = knownSlideMapUrl(source, mapUrls);
        return sourceUrl.includes('/custom/rooms/');
    }

    function swapCustomMapSlideId(sourceUrl, sourceId, targetId) {
        if (!sourceUrl || !sourceId || !targetId || !sourceUrl.includes('/custom/rooms/')) {
            return '';
        }
        if (!sourceUrl.includes(sourceId)) {
            return '';
        }
        const base = sourceUrl.replace(/\?.*$/, '');
        return base.replace(sourceId, targetId) + '?t=' + Date.now();
    }

    function resolveCustomMapUrlAfterCopy(slide, publicId, mapUrls = {}, extHint = 'webp') {
        normalizeCustomRoomSlide(slide);
        if (!publicId || !isCustomRoomSlide(slide)) return '';
        const known = knownSlideMapUrl(slide, mapUrls);
        if (known && known !== placeholderUrl()) return known;
        const base = customRoomMapBase(slide, publicId);
        const ext = (extHint || 'webp').replace(/^\./, '');
        return base + '.' + ext + '?t=' + Date.now();
    }

    function clearStoredSlideMapUrl(slideId, mapUrls) {
        if (!slideId) return;
        if (mapUrls && typeof mapUrls === 'object') {
            delete mapUrls[slideId];
        }
        if (typeof window !== 'undefined' && window.ABS_TACTICS_MAP_URLS) {
            delete window.ABS_TACTICS_MAP_URLS[slideId];
        }
    }

    function previewUrlFromSlide(source, mapUrls = {}) {
        if (!source) return '';
        const known = knownSlideMapUrl(source, mapUrls);
        if (known && known !== placeholderUrl()) {
            if (known.includes('/custom/rooms/') && source.id && known.includes(source.id)) {
                return '';
            }
            return known;
        }
        if (isCustomRoomSlide(source)) return '';
        return mapUrl(source.map_code, source.game, source.battle_mode);
    }

    function refreshSlidePreviewUrl(slide, publicId, mapUrls = {}, opts = {}) {
        if (!slide?.id) return placeholderUrl();
        normalizeCustomRoomSlide(slide);

        if (opts.preferredUrl) {
            return opts.preferredUrl;
        }

        if (opts.resetKnown !== false) {
            clearStoredSlideMapUrl(slide.id, mapUrls);
        }

        if (opts.inheritFromSlide) {
            const inherited = previewUrlFromSlide(opts.inheritFromSlide, mapUrls);
            if (inherited) {
                return inherited;
            }
        }

        const known = knownSlideMapUrl(slide, mapUrls);
        if (known && known !== placeholderUrl()) {
            return known;
        }

        if (isCustomRoomSlide(slide)) {
            if (opts.allowCustomPath) {
                const extHint = opts.extHint || 'webp';
                return resolveCustomMapUrlAfterCopy(slide, publicId, mapUrls, extHint);
            }
            return placeholderUrl();
        }

        return mapUrl(
            slide.map_code,
            slide.game,
            slide.battle_mode,
            slideSpawnSwapped(slide),
        );
    }

    function normalizeMapCode(code) {
        let c = String(code || '').toLowerCase().trim();
        if (!c) return '';
        if (c.endsWith('_sw')) c = c.slice(0, -3);
        const prefixed = c.match(/^\d+_(.+)$/);
        if (prefixed) return prefixed[1];
        return c;
    }

    function normalizeSpawnMarkerScale(value) {
        const scale = Number(value);
        if (!Number.isFinite(scale) || scale <= 0) return 1;
        return Math.min(2, Math.max(0.5, scale));
    }

    const SPAWN_MARKER_OPACITY_DEFAULT = 0.8;

    function normalizeSpawnMarkerOpacity(value) {
        const opacity = Number(value);
        if (!Number.isFinite(opacity)) return SPAWN_MARKER_OPACITY_DEFAULT;
        return Math.min(1, Math.max(0.2, Math.round(opacity * 100) / 100));
    }

    function getSpawnPointMarkerScale(point) {
        return normalizeSpawnMarkerScale(point?.marker_scale ?? 1);
    }

    function getSpawnPointMarkerOpacity(point) {
        return normalizeSpawnMarkerOpacity(point?.marker_opacity ?? SPAWN_MARKER_OPACITY_DEFAULT);
    }

    function spawnMarkerTransform(scale) {
        const normalized = normalizeSpawnMarkerScale(scale);
        const base = 'translate(-50%, -50%)';
        if (Math.abs(normalized - 1) < 0.001) {
            return base;
        }
        return `${base} scale(${normalized})`;
    }

    function getMapSpawnData(mapCode) {
        const spawns = catalogCache?.map_spawns;
        if (!spawns) return null;
        const code = normalizeMapCode(mapCode);
        return spawns[code] || null;
    }

    function normalizeSpawnTeam(team) {
        const t = String(team || '').toLowerCase().replace(/[\s_-]+/g, '');
        if (t === 'team1' || t === '1' || t === 'ally' || t === 'allies') return 'team1';
        if (t === 'team2' || t === '2' || t === 'enemy' || t === 'enemies') return 'team2';
        return t;
    }

    function effectiveSpawnTeam(point, spawnSwapped) {
        let team = normalizeSpawnTeam(point?.team);
        if (!spawnSwapped) return team;
        if (team === 'team1') return 'team2';
        if (team === 'team2') return 'team1';
        return team;
    }

    function spawnPointIndex(point) {
        const label = String(point?.label || '').toLowerCase();
        const match = label.match(/_(\d+)$/);
        return match ? parseInt(match[1], 10) : 1;
    }

    function findSpawnPartner(point, allPoints) {
        if (!Array.isArray(allPoints) || !point) return null;
        const type = String(point.point_type || '').toLowerCase();
        const team = normalizeSpawnTeam(point.team);
        if (team !== 'team1' && team !== 'team2') return null;
        const opposite = team === 'team1' ? 'team2' : 'team1';
        const index = spawnPointIndex(point);
        let partner = allPoints.find((candidate) => {
            if (String(candidate?.point_type || '').toLowerCase() !== type) return false;
            if (normalizeSpawnTeam(candidate?.team) !== opposite) return false;
            return spawnPointIndex(candidate) === index;
        });
        if (!partner) {
            partner = allPoints.find((candidate) => {
                if (String(candidate?.point_type || '').toLowerCase() !== type) return false;
                return normalizeSpawnTeam(candidate?.team) === opposite;
            });
        }
        return partner || null;
    }

    function resolveSpawnDisplayPoint(point, allPoints, spawnSwapped) {
        if (!spawnSwapped || !Array.isArray(allPoints) || !point) return point;
        const partner = findSpawnPartner(point, allPoints);
        if (!partner) return point;
        return {
            ...point,
            x: partner.x,
            y: partner.y,
        };
    }

    function resolveSpawnDisplay(point, allPoints, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const spawnSwapped = opts.spawnSwapped === true;
        const team = normalizeSpawnTeam(point?.team);
        if (!spawnSwapped || !point) {
            return { point, team };
        }

        const type = String(point.point_type || '').toLowerCase();
        const mode = String(opts.battleMode || 'random').toLowerCase();

        if (type === 'control_point') {
            return { point, team };
        }

        if (mode === 'assault') {
            if (type === 'base') {
                return {
                    point,
                    team: effectiveSpawnTeam(point, true),
                };
            }
            if (type === 'spawn') {
                const partner = findSpawnPartner(point, allPoints);
                if (partner) {
                    return {
                        point: { ...point, x: partner.x, y: partner.y },
                        team: effectiveSpawnTeam(point, true),
                    };
                }
                return {
                    point,
                    team: effectiveSpawnTeam(point, true),
                };
            }
            return {
                point,
                team: effectiveSpawnTeam(point, true),
            };
        }

        return {
            point: resolveSpawnDisplayPoint(point, allPoints, true),
            team: effectiveSpawnTeam(point, true),
        };
    }

    function supportsSpawnOverlay(slide) {
        if (!slide) return false;
        const game = (slide.game || 'wot').toLowerCase();
        if (game !== 'wot' && game !== 'lesta') return false;
        if (isCustomRoomSlide(slide)) return false;
        const mode = (slide.battle_mode || 'random').toLowerCase();
        const code = String(slide.map_code || '').toLowerCase();
        if (!isMapAllowedForMode(code, game, mode)) return false;
        const data = getMapSpawnData(slide.map_code);
        const points = data?.modes?.[mode]?.points;
        return Array.isArray(points) && points.length > 0;
    }

    function getSlideSpawnOverlayOpts(slide) {
        const view = slide?.view || {};
        return {
            spawnSwapped: view.spawn_swapped === true,
            showOverlay: view.spawn_overlay !== false,
        };
    }

    function spawnPointClass(point, teamOverride) {
        const type = String(point?.point_type || '').toLowerCase();
        const team = teamOverride !== undefined
            ? normalizeSpawnTeam(teamOverride)
            : normalizeSpawnTeam(point?.team);
        if (type === 'control_point') return 'tactics-map-point--neutral';
        if (type === 'base' || type === 'spawn') {
            if (team === 'team1') {
                return type === 'base' ? 'tactics-map-point--base-green' : 'tactics-map-point--spawn-green';
            }
            if (team === 'team2') {
                return type === 'base' ? 'tactics-map-point--base-red' : 'tactics-map-point--spawn-red';
            }
        }
        return 'tactics-map-point--other';
    }

    const SPAWN_FLAG_INNER_SCALE = 0.72;

    const SPAWN_FLAG_PATH_D = 'M7.85 4.9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0'
        + 'M7.25 6.1h1.2v21.9H7.25z'
        + 'M8.75 7.6L24.75 7.6 19.25 11.1 24.75 14.6 8.75 14.6z';

    const SPAWN_BASE_FLAG_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        + `<path fill="#fff" d="${SPAWN_FLAG_PATH_D}"/>`
        + '</svg>';

    function getSpawnFlagMarkerScale(radius) {
        return radius * SPAWN_FLAG_INNER_SCALE;
    }

    function spawnFlagFabricPathD(scale) {
        const u = scale / 16;
        const x = (vx) => (vx - 16) * u;
        const y = (vy) => (vy - 16) * u;
        const finial = `M ${x(7.85)} ${y(4.9)}`
            + ` m ${-u} 0`
            + ` a ${u} ${u} 0 1 0 ${2 * u} 0`
            + ` a ${u} ${u} 0 1 0 ${-2 * u} 0`;
        const pole = `M ${x(7.25)} ${y(6.1)} h ${1.2 * u} v ${21.9 * u} h ${-1.2 * u} Z`;
        const flag = `M ${x(8.75)} ${y(7.6)}`
            + ` L ${x(24.75)} ${y(7.6)}`
            + ` L ${x(19.25)} ${y(11.1)}`
            + ` L ${x(24.75)} ${y(14.6)}`
            + ` L ${x(8.75)} ${y(14.6)} Z`;
        return `${finial} ${pole} ${flag}`;
    }

    function spawnBaseFlagStyleUrl() {
        return `url("data:image/svg+xml,${encodeURIComponent(SPAWN_BASE_FLAG_SVG)}")`;
    }

    function appendSpawnBaseFlag(containerEl) {
        if (!containerEl) return;
        const flagEl = document.createElement('span');
        flagEl.className = 'tactics-spawn-flag';
        flagEl.setAttribute('aria-hidden', 'true');
        containerEl.appendChild(flagEl);
    }

    function normalizeSpawnBaseNumber(value) {
        const raw = String(value ?? '').trim();
        if (!/^[0-9]{1,3}$/.test(raw)) return '';
        return raw;
    }

    function spawnBaseDisplayNumber(point) {
        return normalizeSpawnBaseNumber(point?.base_number);
    }

    function appendSpawnBaseMarker(containerEl, point) {
        if (!containerEl) return;
        const baseNumber = spawnBaseDisplayNumber(point);
        if (baseNumber) {
            const numberEl = document.createElement('span');
            numberEl.className = 'tactics-spawn-base-number';
            numberEl.textContent = baseNumber;
            containerEl.appendChild(numberEl);
            return;
        }
        appendSpawnBaseFlag(containerEl);
    }

    function spawnBaseLabelForTeam() {
        return '';
    }

    function spawnPointToPercent(point, bounds) {
        if (!bounds) return null;
        const x = Number(point?.x);
        const y = Number(point?.y);
        const minX = Number(bounds.min_x);
        const minY = Number(bounds.min_y);
        const maxX = Number(bounds.max_x);
        const maxY = Number(bounds.max_y);
        const dx = maxX - minX;
        const dy = maxY - minY;
        if (!dx || !dy || Number.isNaN(x) || Number.isNaN(y)) return null;
        return {
            left: ((x - minX) / dx) * 100,
            top: (1 - ((y - minY) / dy)) * 100,
        };
    }

    function spawnPointToNormalized(point, bounds) {
        const pos = spawnPointToPercent(point, bounds);
        if (!pos) return null;
        return {
            x: pos.left / 100,
            y: pos.top / 100,
        };
    }

    function spawnBaseLabel(point) {
        return spawnBaseLabelForTeam(point?.team);
    }

    function getSpawnPointsForSlide(slide) {
        if (!supportsSpawnOverlay(slide)) return null;
        const data = getMapSpawnData(slide.map_code);
        const mode = String(slide.battle_mode || 'random').toLowerCase();
        const modeEntry = data?.modes?.[mode];
        const points = modeEntry?.points;
        const bounds = data?.bounds;
        if (!Array.isArray(points) || !points.length || !bounds) return null;
        return {
            points,
            bounds,
            mode,
            opts: getSlideSpawnOverlayOpts(slide),
        };
    }

    function renderSpawnOverlay(container, mapCode, battleMode, opts) {
        if (!container) return;
        container.innerHTML = '';
        const options = opts && typeof opts === 'object' ? opts : {};
        if (options.showOverlay === false) {
            container.hidden = true;
            return;
        }
        const data = getMapSpawnData(mapCode);
        const mode = String(battleMode || 'random').toLowerCase();
        const modeEntry = data?.modes?.[mode];
        const points = modeEntry?.points;
        const bounds = data?.bounds;
        if (!Array.isArray(points) || !points.length || !bounds) {
            container.hidden = true;
            return;
        }
        const spawnSwapped = options.spawnSwapped === true;
        const displayOpts = {
            spawnSwapped,
            battleMode: mode,
            bounds,
        };
        points.forEach((point) => {
            const display = resolveSpawnDisplay(point, points, displayOpts);
            const pos = spawnPointToPercent(display.point, bounds);
            if (!pos) return;
            const el = document.createElement('span');
            const type = String(point?.point_type || '').toLowerCase();
            el.className = `tactics-map-point ${spawnPointClass(point, display.team)}`;
            el.style.left = `${pos.left}%`;
            el.style.top = `${pos.top}%`;
            el.style.transform = spawnMarkerTransform(getSpawnPointMarkerScale(point));
            el.style.opacity = String(getSpawnPointMarkerOpacity(point));
            if (type === 'base') {
                appendSpawnBaseMarker(el, point);
            } else if (type === 'control_point') {
                appendSpawnBaseFlag(el);
            }
            if (point.label) {
                el.title = String(point.label);
            }
            container.appendChild(el);
        });
        container.hidden = false;
    }

    function renderSlideSpawnOverlay(container, slide) {
        if (!container || !slide) {
            if (container) {
                container.innerHTML = '';
                container.hidden = true;
            }
            return;
        }
        if (!supportsSpawnOverlay(slide)) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }
        renderSpawnOverlay(
            container,
            slide.map_code,
            slide.battle_mode,
            getSlideSpawnOverlayOpts(slide),
        );
    }

    window.AbsTacticsMaps = {
        loadMaps,
        loadCatalog,
        refreshCatalog,
        resetCatalogCache,
        getCatalog,
        getMapsSync,
        getMapsFor,
        gameHasMaps,
        gamesWithMaps,
        findMap,
        getSlideDefaultTitle,
        getSlideTitle,
        populateSelect,
        loadMapImage,
        loadImageUrl,
        getCachedImage,
        preloadMapUrls,
        mapUrl,
        supportsSpawnSwap,
        slideSpawnSwapped,
        slideMapUrl,
        slideMapUrlCandidates,
        slideSideLength,
        slideMapScale,
        slideMapScaleSync,
        usesGameUnits,
        usesHammerUnits,
        defaultCustomMapScaleHu,
        formatKhuFromHu,
        hammerStoredToAreaKhu,
        hammerStoredToSideHu,
        parseCustomMapScaleInput,
        formatCustomMapScaleInput,
        customMapScaleInputAttrs,
        scaleUnitLabel,
        formatSlideScaleLabel,
        placeholderUrl,
        isCustomRoomSlide,
        customRoomMapBase,
        customMapCodeForGame,
        normalizeCustomRoomSlide,
        needsCustomMapFileCopy,
        swapCustomMapSlideId,
        resolveCustomMapUrlAfterCopy,
        clearStoredSlideMapUrl,
        previewUrlFromSlide,
        refreshSlidePreviewUrl,
        normalizeMapCode,
        isMapAllowedForMode,
        normalizeSpawnTeam,
        getMapSpawnData,
        getSpawnPointMarkerScale,
        normalizeSpawnMarkerScale,
        getSpawnPointMarkerOpacity,
        normalizeSpawnMarkerOpacity,
        SPAWN_MARKER_OPACITY_DEFAULT,
        spawnMarkerTransform,
        supportsSpawnOverlay,
        getSlideSpawnOverlayOpts,
        getSpawnPointsForSlide,
        spawnPointToNormalized,
        resolveSpawnDisplayPoint,
        resolveSpawnDisplay,
        effectiveSpawnTeam,
        spawnBaseLabel,
        spawnBaseLabelForTeam,
        spawnBaseFlagStyleUrl,
        spawnFlagFabricPathD,
        getSpawnFlagMarkerScale,
        appendSpawnBaseFlag,
        appendSpawnBaseMarker,
        spawnBaseDisplayNumber,
        normalizeSpawnBaseNumber,
        renderSpawnOverlay,
        renderSlideSpawnOverlay,
    };
})();
