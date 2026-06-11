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

    class TacticsMapPicker {
        constructor(options) {
            this.modalEl = options.modalId
                ? document.getElementById(options.modalId)
                : null;
            this.root = typeof options.root === 'string'
                ? document.getElementById(options.root)
                : options.root;
            this.selectEl = options.selectEl
                || this.root?.querySelector('select[data-tactics-map-select]')
                || this.root?.querySelector('select');
            const queryRoot = this.modalEl || this.root;
            this.gameTabsEl = queryRoot?.querySelector('[data-tactics-game-tabs]');
            this.modeTabsEl = this.root?.querySelector('[data-tactics-mode-tabs]');
            this.modeFieldLabelEl = this.root?.querySelector('[data-tactics-mode-field-label]');
            this.mapFieldEl = this.root?.querySelector('[data-tactics-map-field]');
            this.modalPreviewEl = this.modalEl?.querySelector('[data-tactics-map-modal-preview]');
            this.modalPreviewPlaceholderEl = this.modalEl?.querySelector('[data-tactics-map-modal-preview-placeholder]');
            this.modalSearchEl = this.modalEl?.querySelector('[data-tactics-map-modal-search]');
            this.modalListEl = this.modalEl?.querySelector('[data-tactics-map-modal-list]');
            this.modalModeEl = this.modalEl?.querySelector('[data-tactics-map-modal-mode]');
            this.modalMapsColEl = this.modalEl?.querySelector('[data-tactics-map-modal-maps-col]');
            this.modalGameFieldEl = this.modalEl?.querySelector('[data-tactics-map-modal-game-field]');
            this.modalConfirmBtn = this.modalEl?.querySelector('[data-tactics-map-modal-confirm]');
            this.modalConfirmCallback = null;
            this.game = options.game || 'wot';
            this.battleMode = options.battleMode || 'random';
            this.lockGame = options.lockGame || null;
            this.catalog = null;
            this.onChange = options.onChange || (() => {});
            this.onModalUpdate = options.onModalUpdate || (() => {});
            this.modalCloseCallback = null;
            if (this.modalEl) {
                this.bindModal();
            }
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

        updateMapFieldVisibility() {
            const hidden = this.shouldHideMapSelect();
            if (this.mapFieldEl) {
                this.mapFieldEl.hidden = hidden;
            }
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
        }

        bindModal() {
            if (!this.modalEl || this.modalEl.dataset.modalBound) return;
            this.modalEl.dataset.modalBound = '1';

            this.modalEl.querySelectorAll('[data-tactics-map-modal-close]').forEach((el) => {
                el.addEventListener('click', () => this.closeModal());
            });

            this.modalConfirmBtn?.addEventListener('click', () => {
                const pick = this.getValue();
                if (!pick.map_code && !this.shouldHideMapSelect()) return;
                if (this.modalConfirmCallback) {
                    this.modalConfirmCallback(pick);
                }
                this.closeModal();
            });

            this.modalSearchEl?.addEventListener('input', () => this.renderModalMapList());
            this.modalModeEl?.addEventListener('change', () => {
                const mode = this.modalModeEl.value;
                if (mode && mode !== this.battleMode) {
                    this.setBattleMode(mode);
                } else {
                    this.notifyModalUpdate();
                }
            });

            this.modalKeydownHandler = (ev) => {
                if (ev.key === 'Escape' && this.modalEl && !this.modalEl.hidden) {
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
            return this.init().then(() => {
                if (initialValue) {
                    this.setValue(initialValue);
                }
                if (this.modalSearchEl) {
                    this.modalSearchEl.value = '';
                }
                this.updateModalVisibility();
                this.renderModalMapList();
                this.updateModalPreview();
                this.modalEl.hidden = false;
                document.body.classList.add('tactics-map-modal-open');
                this.notifyModalUpdate();
                (this.modalSearchEl || this.modalConfirmBtn)?.focus();
            });
        }

        closeModal() {
            if (!this.modalEl) return;
            this.modalEl.hidden = true;
            document.body.classList.remove('tactics-map-modal-open');
            this.modalConfirmCallback = null;
            const closeCb = this.modalCloseCallback;
            this.modalCloseCallback = null;
            this.notifyModalUpdate();
            if (closeCb) closeCb();
        }

        updateModalVisibility() {
            const hideMaps = this.shouldHideMapSelect();
            if (this.modalMapsColEl) {
                this.modalMapsColEl.hidden = hideMaps;
            }
        }

        selectMapCode(mapCode) {
            if (!mapCode || !this.selectEl) return;
            this.selectEl.value = mapCode;
            this.renderModalMapList();
            this.updateModalPreview();
            this.onChange(this.getValue());
            this.notifyModalUpdate();
        }

        renderModalMapList() {
            if (!this.modalListEl) return;
            const lang = i18n().getLang();
            const query = String(this.modalSearchEl?.value || '').trim().toLowerCase();
            const rows = this.getMapRows();
            const selected = this.resolveMapCode(this.selectEl?.value || '');

            const filtered = query
                ? rows.filter((map) => {
                    const name = i18n().mapDisplayName(map, lang).toLowerCase();
                    const code = String(map.map_code || '').toLowerCase();
                    return name.includes(query) || code.includes(query);
                })
                : rows;

            if (!filtered.length) {
                this.modalListEl.innerHTML = `<li class="tactics-map-modal__empty">${i18n().t('noMapsForMode')}</li>`;
                return;
            }

            this.modalListEl.innerHTML = filtered.map((map) => {
                const code = map.map_code;
                const name = i18n().mapDisplayName(map, lang);
                const active = code === selected;
                return `<li class="tactics-map-modal__item-wrap" role="presentation">`
                    + `<button type="button" class="tactics-map-modal__item${active ? ' is-active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" data-map-code="${code}">${name}</button>`
                    + '</li>';
            }).join('');

            this.modalListEl.querySelectorAll('[data-map-code]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.selectMapCode(btn.getAttribute('data-map-code'));
                });
            });
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

        async loadCatalog(forceReload) {
            if (!forceReload && this.catalog) return this.catalog;
            await maps().loadCatalog(forceReload);
            this.catalog = maps().getCatalog();
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
            return this.catalog;
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
            if (!this.modalEl) {
                if (window.recruitingRefreshSelect && this.selectEl.dataset.recruitingSelectEnhanced === '1') {
                    window.recruitingRefreshSelect(this.selectEl);
                } else if (window.recruitingEnhanceSelect) {
                    window.recruitingEnhanceSelect(this.selectEl);
                }
            }
            this.updateMapFieldVisibility();
            this.updateModalVisibility();
            this.renderModalMapList();
            this.updateModalPreview();
        }

        setGame(game) {
            if (this.lockGame) {
                return;
            }
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
            this.buildModeTabs();
            this.renderSelect();
            this.onChange(this.getValue());
            this.notifyModalUpdate();
        }

        async init(selectedCode) {
            await this.loadCatalog();
            this.buildGameTabs();
            this.buildModeTabs();
            this.renderSelect(selectedCode);
            this.selectEl?.addEventListener('change', () => this.onChange(this.getValue()));
        }

        getValue() {
            return {
                map_code: this.resolveMapCode(this.selectEl?.value || ''),
                game: this.game,
                battle_mode: this.battleMode,
            };
        }

        setValue(value) {
            if (!value) return;
            if (value.game) this.game = value.game;
            if (value.battle_mode) this.battleMode = value.battle_mode;
            this.buildGameTabs();
            this.buildModeTabs();
            this.renderSelect(value.map_code || '');
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
