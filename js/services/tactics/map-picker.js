(() => {
    'use strict';

    const maps = () => window.AbsTacticsMaps;
    const i18n = () => window.AbsTacticsI18n;

    const GAME_I18N = {
        wot: 'gameWot',
        lesta: 'gameLesta',
        dota2: 'gameDota2',
        cs2: 'gameCs2',
    };

    const MODE_I18N = {
        random: 'modeRandom',
        encounter: 'modeEncounter',
        assault: 'modeAssault',
        custom: 'modeCustom',
        standard: 'modeStandard',
        defuse: 'modeDefuse',
        hostage: 'modeHostage',
        wingman: 'modeWingman',
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function destroySelectEnhancement(select) {
        if (!select || select.dataset.recruitingSelectEnhanced !== '1') return;
        const wrap = select.closest('.recruiting-select-wrap');
        if (wrap?.parentNode) {
            wrap.parentNode.insertBefore(select, wrap);
            wrap.remove();
        }
        select.classList.remove('recruiting-select-native');
        delete select.dataset.recruitingSelectEnhanced;
    }

    class TacticsMapPicker {
        constructor(options) {
            this.modalEl = options.modalId
                ? document.getElementById(options.modalId)
                : null;
            this.root = typeof options.root === 'string'
                ? document.getElementById(options.root)
                : options.root;
            this.selectEl = options.selectEl
                || this.modalEl?.querySelector('select[data-tactics-map-select]')
                || this.root?.querySelector('select[data-tactics-map-select]')
                || this.root?.querySelector('select');
            const queryRoot = this.modalEl || this.root;
            this.gameTabsEl = queryRoot?.querySelector('[data-tactics-game-tabs]');
            this.modeTabsEl = this.root?.querySelector('[data-tactics-mode-tabs]');
            this.modeFieldLabelEl = this.root?.querySelector('[data-tactics-mode-field-label]');
            this.mapFieldEl = this.root?.querySelector('[data-tactics-map-field]')
                || this.modalEl?.querySelector('[data-tactics-map-field]');
            this.modalPreviewEl = this.modalEl?.querySelector('[data-tactics-map-modal-preview]');
            this.modalPreviewPlaceholderEl = this.modalEl?.querySelector('[data-tactics-map-modal-preview-placeholder]');
            this.modalModeEl = this.modalEl?.querySelector('[data-tactics-map-modal-mode]');
            this.modalModeLabelEl = this.modalEl?.querySelector('[data-tactics-map-modal-mode-label]');
            this.modalMapFieldEl = this.modalEl?.querySelector('[data-tactics-map-modal-map-field]');
            this.modalMapsPanelEl = this.modalEl?.querySelector('[data-tactics-map-modal-maps-panel]');
            this.modalSearchEl = this.modalEl?.querySelector('[data-tactics-map-modal-search]');
            this.modalMapListEl = this.modalEl?.querySelector('[data-tactics-map-modal-map-list]');
            this.modalGameFieldEl = this.modalEl?.querySelector('[data-tactics-map-modal-game-field]');
            this.mapSearchQuery = '';
            this.modalCustomPanelEl = this.modalEl?.querySelector('#tacticsCustomMapPanel');
            this.modalScaleWidthEl = this.modalEl?.querySelector('[data-tactics-map-modal-scale-width]');
            this.modalScaleHeightEl = this.modalEl?.querySelector('[data-tactics-map-modal-scale-height]');
            this.modalConfirmBtn = this.modalEl?.querySelector('[data-tactics-map-modal-confirm]');
            this.modalConfirmLabelEl = this.modalEl?.querySelector('[data-tactics-map-modal-confirm-label]');
            this.modalConfirmSpinnerEl = this.modalConfirmBtn?.querySelector('.tactics-map-modal__confirm-spinner');
            this.modalConfirmIconEl = this.modalConfirmBtn?.querySelector('.tactics-map-modal__confirm-icon');
            this.modalSubtitleEl = this.modalEl?.querySelector('.tactics-map-modal__subtitle');
            this.modalConfirmCallback = null;
            this.modalConfirmBusy = false;
            this.modalSubtitleRestore = null;
            this.customPreviewOverrideUrl = null;
            this.game = options.game || 'wot';
            this.battleMode = options.battleMode || 'random';
            this.lockGame = options.lockGame || null;
            this.catalog = null;
            this.onChange = options.onChange || (() => {});
            this.onModalUpdate = options.onModalUpdate || (() => {});
            this.modalCloseCallback = null;
            if (this.selectEl) {
                destroySelectEnhancement(this.selectEl);
            }
            if (this.modalModeEl) {
                destroySelectEnhancement(this.modalModeEl);
            }
            if (this.modalEl) {
                this.bindModal();
            }
            this.catalogUpdatedHandler = () => {
                if (!this.modalEl || this.modalEl.hidden) return;
                void this.refreshModalState();
            };
            window.addEventListener('tactics:catalog-updated', this.catalogUpdatedHandler);
        }

        notifyModalUpdate() {
            this.onModalUpdate();
        }

        usesMapTypeField(gameId) {
            return gameId === 'cs2' || gameId === 'dota2';
        }

        modeLabel(modeId, gameId) {
            if ((gameId === 'cs2' || gameId === 'dota2') && modeId === 'custom') {
                return i18n().t('modeCs2Custom');
            }
            if ((gameId === 'wot' || gameId === 'lesta') && modeId === 'custom') {
                return i18n().t('modeCustom');
            }
            const key = MODE_I18N[modeId];
            if (key) return i18n().t(key);
            const catalog = this.catalog || maps().getCatalog();
            const fromCatalog = catalog?.mode_labels?.[modeId];
            if (fromCatalog) return fromCatalog;
            return modeId;
        }

        gameLabel(gameId) {
            const key = GAME_I18N[gameId];
            if (key) return i18n().t(key);
            const catalog = this.catalog || maps().getCatalog();
            const fromCatalog = catalog?.games?.[gameId]?.label;
            if (fromCatalog) return fromCatalog;
            return gameId;
        }

        shouldHideMapSelect() {
            return this.game === 'dota2' && this.battleMode === 'standard';
        }

        shouldHideModalMapSelect() {
            return this.shouldHideMapSelect() || this.shouldShowCustomUpload();
        }

        shouldShowCustomUpload() {
            return this.battleMode === 'custom'
                && (this.game === 'cs2' || this.game === 'dota2');
        }

        shouldShowCustomScalePanel() {
            return this.shouldShowCustomUpload();
        }

        sanitizeCustomMapScale(value, fallback) {
            const game = this.game;
            const fallbackHu = fallback ?? maps().defaultCustomMapScaleHu(game);
            return maps().parseCustomMapScaleInput(value, game, fallbackHu);
        }

        readCustomMapScale() {
            const fallback = maps().defaultCustomMapScaleHu(this.game);
            return {
                map_width_m: this.sanitizeCustomMapScale(this.modalScaleWidthEl?.value, fallback),
                map_height_m: this.sanitizeCustomMapScale(this.modalScaleHeightEl?.value, fallback),
            };
        }

        writeCustomMapScale(value) {
            const fallback = maps().defaultCustomMapScaleHu(this.game);
            const width = this.sanitizeCustomMapScale(value?.map_width_m, fallback);
            const height = this.sanitizeCustomMapScale(value?.map_height_m, fallback);
            if (this.modalScaleWidthEl) {
                this.modalScaleWidthEl.value = maps().formatCustomMapScaleInput(width, this.game);
            }
            if (this.modalScaleHeightEl) {
                this.modalScaleHeightEl.value = maps().formatCustomMapScaleInput(height, this.game);
            }
        }

        updateCustomPanelVisibility() {
            const showCustom = this.shouldShowCustomScalePanel();
            if (this.modalCustomPanelEl) {
                this.modalCustomPanelEl.hidden = !showCustom;
            }
            this.updateScaleUnitLabels();
        }

        updateScaleUnitLabels() {
            const usesKhu = maps().usesHammerUnits(this.game);
            const usesUnits = maps().usesGameUnits(this.game);
            const hintEl = this.modalCustomPanelEl?.querySelector('[data-tactics-i18n="customMapScaleHint"]');
            const widthLabel = this.modalCustomPanelEl?.querySelector('[data-tactics-i18n="customMapWidth"]');
            const heightLabel = this.modalCustomPanelEl?.querySelector('[data-tactics-i18n="customMapHeight"]');
            if (hintEl) {
                if (usesKhu) {
                    hintEl.textContent = i18n().t('customMapScaleHintKhu');
                } else {
                    hintEl.textContent = i18n().t(usesUnits ? 'customMapScaleHintUnits' : 'customMapScaleHint');
                }
            }
            if (widthLabel) {
                if (usesKhu) {
                    widthLabel.textContent = i18n().t('customMapWidthKhu');
                } else {
                    widthLabel.textContent = i18n().t(usesUnits ? 'customMapWidthUnits' : 'customMapWidth');
                }
            }
            if (heightLabel) {
                if (usesKhu) {
                    heightLabel.textContent = i18n().t('customMapHeightKhu');
                } else {
                    heightLabel.textContent = i18n().t(usesUnits ? 'customMapHeightUnits' : 'customMapHeight');
                }
            }
            const attrs = maps().customMapScaleInputAttrs(this.game);
            [this.modalScaleWidthEl, this.modalScaleHeightEl].forEach((el) => {
                if (!el) return;
                el.min = attrs.min;
                el.max = attrs.max;
                el.step = attrs.step;
            });
        }

        updateMapFieldVisibility() {
            const hidden = this.shouldHideMapSelect();
            if (this.mapFieldEl) {
                this.mapFieldEl.hidden = hidden;
            }
            if (this.modalMapFieldEl) {
                this.modalMapFieldEl.hidden = this.shouldHideModalMapSelect();
            }
            this.updateCustomPanelVisibility();
        }

        resolveMapCode(selectedCode) {
            const rows = this.getMapRows();
            if (this.shouldHideMapSelect()) {
                if (rows.length === 1) {
                    return rows[0].map_code;
                }
                if (rows.length > 1) {
                    return rows[0].map_code;
                }
                return selectedCode || '';
            }
            return this.selectEl?.value || selectedCode || '';
        }

        buildGameTabs() {
            if (!this.gameTabsEl) return;

            const gameField = (this.modalEl || this.root)?.querySelector('[data-tactics-game-field]');
            if (this.lockGame) {
                this.game = this.lockGame;
                this.gameTabsEl.innerHTML = '';
                this.gameTabsEl.hidden = true;
                if (gameField) {
                    gameField.hidden = true;
                }
                if (this.modalGameFieldEl) {
                    this.modalGameFieldEl.hidden = true;
                }
                return;
            }

            if (gameField) {
                gameField.hidden = false;
            }
            if (this.modalGameFieldEl) {
                this.modalGameFieldEl.hidden = false;
            }
            this.gameTabsEl.hidden = false;

            const catalog = this.catalog || {};
            const games = catalog.games || {};
            const ids = Object.keys(games);
            if (!ids.length) return;

            this.gameTabsEl.innerHTML = ids.map((gameId) => {
                const meta = games[gameId] || {};
                const icon = meta.icon || '';
                const label = this.gameLabel(gameId);
                const active = gameId === this.game;
                const iconHtml = icon
                    ? `<span class="tactics-game-tab__icon-wrap" aria-hidden="true">`
                        + `<img class="tactics-game-tab__icon" src="${icon}" width="28" height="28" alt="" loading="lazy" decoding="async">`
                        + '</span>'
                    : '<span class="tactics-game-tab__icon-wrap tactics-game-tab__icon-wrap--empty" aria-hidden="true"></span>';
                return `<button type="button" class="tactics-game-tab${active ? ' is-active' : ''}" data-tactics-game="${gameId}" role="tab" aria-selected="${active ? 'true' : 'false'}">`
                    + iconHtml
                    + `<span class="tactics-game-tab__label">${label}</span>`
                    + '</button>';
            }).join('');

            this.gameTabsEl.querySelectorAll('[data-tactics-game]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const game = btn.getAttribute('data-tactics-game');
                    if (!game || game === this.game) return;
                    this.setGame(game);
                });
            });
        }

        buildModeTabs() {
            if (this.modalEl && this.modalModeEl) {
                this.buildModalModeSelect();
                if (this.modeTabsEl) {
                    this.modeTabsEl.innerHTML = '';
                    this.modeTabsEl.hidden = true;
                }
                return;
            }
            if (!this.modeTabsEl) return;
            const catalog = this.catalog || {};
            const gameMeta = catalog.games?.[this.game] || {};
            const modeIds = gameMeta.mode_ids || Object.keys(gameMeta.modes || {});
            if (!modeIds.length) {
                this.modeTabsEl.innerHTML = '';
                return;
            }

            if (!modeIds.includes(this.battleMode)) {
                this.battleMode = gameMeta.default_mode || modeIds[0];
            }

            this.modeTabsEl.innerHTML = modeIds.map((modeId) => {
                const active = modeId === this.battleMode;
                const label = this.modeLabel(modeId, this.game);
                return `<button type="button" class="recruiting-realm-tab${active ? ' is-active' : ''}" data-tactics-mode="${modeId}" role="tab" aria-selected="${active ? 'true' : 'false'}">${label}</button>`;
            }).join('');

            this.modeTabsEl.querySelectorAll('[data-tactics-mode]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-tactics-mode');
                    if (!mode || mode === this.battleMode) return;
                    this.setBattleMode(mode);
                });
            });

            if (this.modeFieldLabelEl) {
                this.modeFieldLabelEl.textContent = this.usesMapTypeField(this.game)
                    ? i18n().t('fieldMapType')
                    : i18n().t('fieldBattleMode');
            }
            this.buildModalModeSelect();
        }

        buildModalModeSelect() {
            if (!this.modalModeEl) return;
            const catalog = this.catalog || {};
            const gameMeta = catalog.games?.[this.game] || {};
            const modeIds = gameMeta.mode_ids || Object.keys(gameMeta.modes || {});
            if (!modeIds.length) {
                this.modalModeEl.innerHTML = '';
                return;
            }
            if (!modeIds.includes(this.battleMode)) {
                this.battleMode = gameMeta.default_mode || modeIds[0];
            }
            this.modalModeEl.innerHTML = modeIds.map((modeId) => {
                const selected = modeId === this.battleMode ? ' selected' : '';
                return `<option value="${modeId}"${selected}>${this.modeLabel(modeId, this.game)}</option>`;
            }).join('');
            if (this.modalModeLabelEl) {
                this.modalModeLabelEl.textContent = this.usesMapTypeField(this.game)
                    ? i18n().t('fieldMapType')
                    : i18n().t('fieldBattleMode');
            }
            this.refreshModalModeSelect();
        }

        refreshModalModeSelect() {
            if (!this.modalModeEl) return;
            if (window.recruitingRefreshSelect && this.modalModeEl.dataset.recruitingSelectEnhanced === '1') {
                window.recruitingRefreshSelect(this.modalModeEl);
            } else if (window.recruitingEnhanceSelect) {
                window.recruitingEnhanceSelect(this.modalModeEl);
            }
        }

        refreshMapSelect() {
            if (!this.selectEl || this.selectEl.hidden) return;
            if (window.recruitingRefreshSelect && this.selectEl.dataset.recruitingSelectEnhanced === '1') {
                window.recruitingRefreshSelect(this.selectEl);
            } else if (window.recruitingEnhanceSelect) {
                window.recruitingEnhanceSelect(this.selectEl);
            }
        }

        getMapDisplayName(map) {
            const lang = i18n().getLang();
            if (i18n().mapDisplayName) {
                return i18n().mapDisplayName(map, lang);
            }
            return lang === 'en'
                ? (map.display_name_en || map.display_name_ru || map.map_code || '')
                : (map.display_name_ru || map.display_name_en || map.map_code || '');
        }

        getFilteredMapRows() {
            const rows = this.getMapRows();
            const query = (this.mapSearchQuery || '').trim().toLowerCase();
            if (!query) return rows;
            return rows.filter((map) => {
                const label = this.getMapDisplayName(map).toLowerCase();
                const code = String(map.map_code || '').toLowerCase();
                return label.includes(query) || code.includes(query);
            });
        }

        resetMapSearch() {
            this.mapSearchQuery = '';
            if (this.modalSearchEl) {
                this.modalSearchEl.value = '';
            }
        }

        buildModalMapList(selectedCode) {
            if (!this.modalMapListEl) return;

            const rows = this.getFilteredMapRows();
            const code = this.resolveMapCode(selectedCode);
            if (!rows.length) {
                const hasQuery = !!(this.mapSearchQuery || '').trim();
                const message = hasQuery
                    ? i18n().t('noMapsFound')
                    : i18n().t('noMapsForMode');
                this.modalMapListEl.innerHTML = '<div class="tactics-map-modal__map-empty">' + escapeHtml(message) + '</div>';
                return;
            }

            this.modalMapListEl.innerHTML = rows.map((map) => {
                const mapCode = map.map_code;
                const active = mapCode === code;
                const label = this.getMapDisplayName(map);
                return '<button type="button" class="tactics-map-modal__map-item'
                    + (active ? ' is-active' : '')
                    + '" data-map-code="' + escapeHtml(mapCode) + '" role="option" aria-selected="'
                    + (active ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
            }).join('');

            this.modalMapListEl.querySelectorAll('[data-map-code]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const mapCode = btn.getAttribute('data-map-code');
                    if (mapCode) this.selectMapCode(mapCode);
                });
            });

            const activeEl = this.modalMapListEl.querySelector('.tactics-map-modal__map-item.is-active');
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'nearest' });
            }
        }

        updateModalMapListSelection(mapCode) {
            if (!this.modalMapListEl) return;
            this.modalMapListEl.querySelectorAll('.tactics-map-modal__map-item').forEach((btn) => {
                const active = btn.getAttribute('data-map-code') === mapCode;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }

        bindModal() {
            if (!this.modalEl || this.modalEl.dataset.modalBound) return;
            this.modalEl.dataset.modalBound = '1';

            this.modalEl.querySelectorAll('[data-tactics-map-modal-close]').forEach((el) => {
                el.addEventListener('click', () => {
                    if (this.modalConfirmBusy) return;
                    this.closeModal();
                });
            });

            this.modalConfirmBtn?.addEventListener('click', async () => {
                if (this.modalConfirmBusy) return;
                const pick = this.getValue();
                if (!pick.map_code && !this.shouldHideMapSelect()) return;
                if (this.shouldShowCustomScalePanel()) {
                    const scale = this.readCustomMapScale();
                    pick.map_width_m = scale.map_width_m;
                    pick.map_height_m = scale.map_height_m;
                }
                this.setModalBusy(true, i18n().t('changeMapSaving'));
                let shouldClose = true;
                try {
                    if (this.modalConfirmCallback) {
                        const out = await Promise.resolve(this.modalConfirmCallback(pick));
                        if (out === false) shouldClose = false;
                    }
                } finally {
                    this.setModalBusy(false);
                }
                if (shouldClose) {
                    this.closeModal();
                }
            });

            this.modalModeEl?.addEventListener('change', () => {
                const mode = this.modalModeEl.value;
                if (mode && mode !== this.battleMode) {
                    this.setBattleMode(mode);
                } else {
                    this.updateCustomPanelVisibility();
                    this.notifyModalUpdate();
                }
            });

            this.modalScaleWidthEl?.addEventListener('input', () => this.notifyModalUpdate());
            this.modalScaleHeightEl?.addEventListener('input', () => this.notifyModalUpdate());

            this.modalSearchEl?.addEventListener('input', () => {
                this.mapSearchQuery = this.modalSearchEl.value || '';
                this.buildModalMapList();
            });

            this.modalKeydownHandler = (ev) => {
                if (ev.key === 'Escape' && this.modalEl && !this.modalEl.hidden && !this.modalConfirmBusy) {
                    this.closeModal();
                }
            };
            document.addEventListener('keydown', this.modalKeydownHandler);
        }

        openModal(onConfirm, options) {
            if (!this.modalEl) return Promise.resolve();
            const opts = options && typeof options === 'object' ? options : {};
            const initialValue = opts.initialValue || null;
            this.modalConfirmCallback = typeof onConfirm === 'function' ? onConfirm : null;
            this.modalCloseCallback = typeof opts.onClose === 'function' ? opts.onClose : null;
            return this.ensureInitialized().then(() => {
                this.resetMapSearch();
                if (this.selectEl) {
                    destroySelectEnhancement(this.selectEl);
                }
                if (this.modalModeEl) {
                    destroySelectEnhancement(this.modalModeEl);
                }
                return this.refreshModalState(initialValue);
            }).then(() => {
                this.modalEl.hidden = false;
                document.body.classList.add('tactics-map-modal-open');
                if (typeof opts.onOpen === 'function') {
                    opts.onOpen();
                }
                this.notifyModalUpdate();
                this.modalConfirmBtn?.focus();
            });
        }

        closeModal() {
            if (!this.modalEl || this.modalConfirmBusy) return;
            this.modalEl.hidden = true;
            document.body.classList.remove('tactics-map-modal-open');
            this.modalConfirmCallback = null;
            this.setModalBusy(false);
            this.customPreviewOverrideUrl = null;
            const closeCb = this.modalCloseCallback;
            this.modalCloseCallback = null;
            this.notifyModalUpdate();
            if (closeCb) closeCb();
        }

        setModalBusy(busy, statusMessage) {
            this.modalConfirmBusy = !!busy;
            if (this.modalEl) {
                this.modalEl.classList.toggle('is-busy', !!busy);
            }
            if (this.modalConfirmBtn) {
                this.modalConfirmBtn.disabled = !!busy;
                this.modalConfirmBtn.classList.toggle('is-busy', !!busy);
                this.modalConfirmBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
            }
            if (this.modalConfirmSpinnerEl) {
                this.modalConfirmSpinnerEl.hidden = !busy;
            }
            if (this.modalConfirmIconEl) {
                this.modalConfirmIconEl.hidden = !!busy;
            }
            if (this.modalSubtitleEl) {
                if (busy && statusMessage) {
                    if (this.modalSubtitleRestore === null) {
                        this.modalSubtitleRestore = this.modalSubtitleEl.textContent;
                    }
                    this.modalSubtitleEl.textContent = statusMessage;
                } else if (!busy && this.modalSubtitleRestore !== null) {
                    this.modalSubtitleEl.textContent = this.modalSubtitleRestore;
                    this.modalSubtitleRestore = null;
                }
            }
            if (busy && statusMessage && this.modalConfirmLabelEl) {
                this.modalConfirmLabelEl.textContent = statusMessage;
            } else if (!busy && this.modalConfirmLabelEl) {
                this.modalConfirmLabelEl.textContent = i18n().t('changeMapConfirm');
            }
        }

        setCustomPreviewUrl(url) {
            this.customPreviewOverrideUrl = url || null;
            this.updateModalPreview();
        }

        clearCustomPreviewOverride() {
            this.customPreviewOverrideUrl = null;
            this.updateModalPreview();
        }

        updateModalVisibility() {
            this.updateMapFieldVisibility();
        }

        selectMapCode(mapCode) {
            if (!mapCode || !this.selectEl) return;
            this.selectEl.value = mapCode;
            this.refreshMapSelect();
            this.updateModalMapListSelection(mapCode);
            this.updateModalPreview();
            this.onChange(this.getValue());
            this.notifyModalUpdate();
        }

        setModalPreviewVisible(hasImage) {
            if (this.modalPreviewEl) {
                this.modalPreviewEl.hidden = !hasImage;
                if (!hasImage) {
                    this.modalPreviewEl.removeAttribute('src');
                }
            }
            if (this.modalPreviewPlaceholderEl) {
                this.modalPreviewPlaceholderEl.hidden = !!hasImage;
            }
        }

        bindModalPreviewImage() {
            if (!this.modalPreviewEl || this.modalPreviewEl.dataset.previewBound) return;
            this.modalPreviewEl.dataset.previewBound = '1';
            this.modalPreviewEl.addEventListener('error', () => {
                this.setModalPreviewVisible(false);
            });
        }

        updateModalPreview() {
            if (!this.modalPreviewEl) return;
            this.bindModalPreviewImage();
            if (this.shouldShowCustomUpload()) {
                const url = this.customPreviewOverrideUrl;
                if (url) {
                    this.modalPreviewEl.src = url;
                    this.setModalPreviewVisible(true);
                    return;
                }
                this.setModalPreviewVisible(false);
                return;
            }
            const code = this.resolveMapCode(this.selectEl?.value || '');
            if (!code) {
                this.setModalPreviewVisible(false);
                return;
            }
            maps().loadMapImage(code, this.game, this.battleMode).then((img) => {
                if (!this.modalPreviewEl) return;
                if (img?.src) {
                    this.modalPreviewEl.src = img.src;
                    this.setModalPreviewVisible(true);
                    return;
                }
                this.setModalPreviewVisible(false);
            });
        }

        hasCatalogData(catalog) {
            return !!catalog && Object.keys(catalog.games || {}).length > 0;
        }

        applyCatalogDefaults() {
            if (this.lockGame) {
                this.game = this.lockGame;
            } else if (this.catalog?.default_game) {
                this.game = this.catalog.default_game;
            }
            const gameMeta = this.catalog?.games?.[this.game];
            if (gameMeta?.default_mode) {
                this.battleMode = gameMeta.default_mode;
            } else if (this.catalog?.default_mode) {
                this.battleMode = this.catalog.default_mode;
            }
        }

        async loadCatalog(forceReload) {
            const cached = this.catalog;
            if (!forceReload && this.hasCatalogData(cached)) {
                return cached;
            }

            await maps().loadMaps();
            this.catalog = maps().getCatalog();
            if (!this.hasCatalogData(this.catalog)) {
                await maps().loadCatalog(true);
                await maps().loadMaps();
                this.catalog = maps().getCatalog();
            }
            return this.catalog;
        }

        async refreshModalState(initialValue) {
            await this.loadCatalog();
            if (initialValue) {
                if (initialValue.game) this.game = initialValue.game;
                if (initialValue.battle_mode) this.battleMode = initialValue.battle_mode;
                if (this.lockGame) this.game = this.lockGame;
            } else {
                this.applyCatalogDefaults();
            }
            this.buildGameTabs();
            this.buildModeTabs();
            if (initialValue) {
                this.setValue(initialValue);
            } else {
                this.writeCustomMapScale(null);
                this.renderSelect();
            }
            this.updateModalVisibility();
            this.updateModalPreview();
        }

        getMapRows() {
            return maps().getMapsFor(this.game, this.battleMode);
        }

        hasMaps() {
            return this.getMapRows().length > 0;
        }

        renderSelect(selectedCode) {
            if (!this.selectEl) return;
            const rows = this.getMapRows();
            const code = this.resolveMapCode(selectedCode);
            maps().populateSelect(this.selectEl, i18n().getLang(), code, rows);
            if (code && this.selectEl.value !== code) {
                this.selectEl.value = code;
            }
            this.refreshMapSelect();
            this.buildModalMapList(code);
            this.updateMapFieldVisibility();
            this.updateModalVisibility();
            this.updateModalPreview();
        }

        setGame(game) {
            if (this.lockGame) {
                return;
            }
            this.resetMapSearch();
            this.game = game;
            const gameMeta = this.catalog?.games?.[game];
            const modeIds = gameMeta?.mode_ids || Object.keys(gameMeta?.modes || {});
            if (modeIds.length && !modeIds.includes(this.battleMode)) {
                this.battleMode = gameMeta?.default_mode || modeIds[0];
            }
            this.buildGameTabs();
            this.buildModeTabs();
            this.renderSelect();
            this.onChange(this.getValue());
        }

        setBattleMode(mode) {
            this.battleMode = mode;
            this.resetMapSearch();
            this.buildModeTabs();
            this.renderSelect();
            this.onChange(this.getValue());
            this.notifyModalUpdate();
        }

        async ensureInitialized() {
            await this.loadCatalog();
            if (!this.selectEl || this.selectEl.dataset.tacticsMapPickerBound === '1') {
                return;
            }
            this.selectEl.dataset.tacticsMapPickerBound = '1';
            this.selectEl.addEventListener('change', () => {
                this.updateModalPreview();
                this.buildModalMapList();
                this.onChange(this.getValue());
            });
        }

        async init(selectedCode) {
            await this.ensureInitialized();
            this.applyCatalogDefaults();
            this.buildGameTabs();
            this.buildModeTabs();
            this.renderSelect(selectedCode);
        }

        getValue() {
            const value = {
                map_code: this.resolveMapCode(this.selectEl?.value || ''),
                game: this.game,
                battle_mode: this.battleMode,
            };
            if (this.shouldShowCustomScalePanel()) {
                Object.assign(value, this.readCustomMapScale());
            }
            return value;
        }

        setValue(value) {
            if (!value) return;
            if (value.game) this.game = value.game;
            if (value.battle_mode) this.battleMode = value.battle_mode;
            if (this.lockGame) this.game = this.lockGame;
            this.buildGameTabs();
            this.buildModeTabs();
            this.renderSelect(value.map_code || '');
            if (value.map_width_m || value.map_height_m) {
                this.writeCustomMapScale(value);
            } else {
                this.writeCustomMapScale(null);
            }
            this.updateCustomPanelVisibility();
        }

        setLockGame(game) {
            this.lockGame = game ? String(game) : null;
            if (this.lockGame) {
                this.game = this.lockGame;
            }
            if (this.catalog) {
                this.buildGameTabs();
                this.buildModeTabs();
                this.renderSelect();
            }
        }

        async relocalize() {
            if (!this.root && !this.modalEl) return;
            this.catalog = null;
            await this.loadCatalog(true);
            if (this.root) {
                i18n().relocalizeDom(this.root);
            }
            if (this.modalEl) {
                i18n().relocalizeDom(this.modalEl);
            }
            this.buildGameTabs();
            this.buildModeTabs();
            const selected = this.selectEl?.value || '';
            this.renderSelect(selected);
        }
    }

    window.TacticsMapPicker = TacticsMapPicker;
})();
