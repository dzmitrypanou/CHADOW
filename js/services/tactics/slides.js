(() => {
    'use strict';

    const maps = () => window.AbsTacticsMaps;
    const i18n = () => window.AbsTacticsI18n;

    function generateSlideId() {
        return 's' + Math.random().toString(16).slice(2, 10);
    }

    class TacticsSlides {
        constructor(options) {
            this.roomData = options.roomData;
            this.mapUrls = options.mapUrls || {};
            this.listEl = options.listEl;
            this.addBtn = options.addBtn;
            this.addSelect = options.addSelect;
            this.mapPicker = options.mapPicker || null;
            this.onSwitch = options.onSwitch || (() => {});
            this.onChange = options.onChange || (() => {});
            this.onBroadcast = options.onBroadcast || (() => {});
            this.onDelete = options.onDelete || (() => {});
            this.onRenamed = options.onRenamed || (() => {});
            this.onMapChange = options.onMapChange || (() => {});
            this.onMapModalOpen = options.onMapModalOpen || (() => {});
            this.onMapModalClose = options.onMapModalClose || (() => {});
            this.lang = options.lang || 'ru';
            this.publicId = options.publicId || window.ABS_TACTICS_PUBLIC_ID || '';
            this.roomGame = options.roomGame || null;
            this.canManage = !!options.canManage;
            this.canAddSlides = options.canAddSlides !== undefined
                ? !!options.canAddSlides
                : this.canManage;
            if (this.addBtn) {
                this.addBtn.hidden = !this.canAddSlides;
            }
            this.viewToggleBtn = document.getElementById('tacticsSlidesViewToggle');
            this.viewToggleIcon = document.getElementById('tacticsSlidesViewToggleIcon');
            this.viewMode = this.loadViewMode();
            this.applyViewModeClasses();
            this.bindEvents();
            this.render();
        }

        getViewModeStorageKey() {
            return 'abs_tactics_slides_view_' + (this.publicId || 'default');
        }

        loadViewMode() {
            try {
                const stored = sessionStorage.getItem(this.getViewModeStorageKey());
                return stored === 'list' ? 'list' : 'grid';
            } catch (err) {
                return 'grid';
            }
        }

        persistViewMode() {
            try {
                sessionStorage.setItem(this.getViewModeStorageKey(), this.viewMode);
            } catch (err) {
                // ignore
            }
        }

        applyViewModeClasses() {
            if (!this.listEl) return;
            const isList = this.viewMode === 'list';
            this.listEl.classList.toggle('tactics-slides-list--grid', !isList);
            this.listEl.classList.toggle('tactics-slides-list--list', isList);
            this.listEl.classList.remove('tactics-slides-list--strip');
            const wrap = this.listEl.closest('.tactics-slides-strip-wrap');
            wrap?.classList.toggle('tactics-slides-strip-wrap--grid', !isList);
            wrap?.classList.toggle('tactics-slides-strip-wrap--list', isList);
            this.updateViewToggleUi();
        }

        setViewMode(mode) {
            const next = mode === 'list' ? 'list' : 'grid';
            if (this.viewMode === next) return;
            this.viewMode = next;
            this.persistViewMode();
            this.applyViewModeClasses();
            this.render();
        }

        toggleViewMode() {
            this.setViewMode(this.viewMode === 'grid' ? 'list' : 'grid');
        }

        updateViewToggleUi() {
            const isList = this.viewMode === 'list';
            const labelKey = isList ? 'slidesViewGrid' : 'slidesViewList';
            const label = i18n().t(labelKey);
            if (this.viewToggleBtn) {
                this.viewToggleBtn.title = label;
                this.viewToggleBtn.setAttribute('aria-label', label);
                this.viewToggleBtn.dataset.tacticsI18nTitle = labelKey;
            }
            if (this.viewToggleIcon) {
                this.viewToggleIcon.className = isList ? 'fas fa-th-large' : 'fas fa-list';
            }
        }

        goToAdjacentSlide(delta) {
            const slides = this.getSlides();
            if (slides.length < 2) return;
            const activeId = this.getActiveSlideId();
            const index = slides.findIndex((slide) => slide.id === activeId);
            const start = index >= 0 ? index : 0;
            const nextIndex = (start + delta + slides.length) % slides.length;
            const nextSlide = slides[nextIndex];
            if (nextSlide?.id) {
                this.switchSlide(nextSlide.id);
            }
        }

        setCanManage(canManage) {
            this.canManage = !!canManage;
            this.render();
        }

        setCanAddSlides(canAddSlides) {
            this.canAddSlides = !!canAddSlides;
            if (this.addBtn) {
                this.addBtn.hidden = !this.canAddSlides;
            }
            if (!this.canAddSlides) {
                this.setAddSelectVisible(false);
            }
        }

        setSlidesLocked(locked) {
            this.slidesLocked = !!locked;
            this.listEl?.classList.toggle('is-locked', this.slidesLocked);
            if (this.addBtn) {
                this.addBtn.disabled = this.slidesLocked || !this.canAddSlides;
            }
        }

        setLang(lang) {
            this.lang = lang === 'en' ? 'en' : 'ru';
        }

        relocalizeNames() {
            if (!this.listEl) return;

            const renameHint = i18n().t('renameMapHint');
            const deleteTitle = i18n().t('deleteSlide');

            this.listEl.querySelectorAll('.tactics-slide-name').forEach((el) => {
                const slideId = el.getAttribute('data-slide-id');
                const slide = this.getSlides().find((s) => s.id === slideId);
                if (!slide) return;
                el.textContent = this.getSlideDisplayName(slide);
                el.title = renameHint;
            });

            this.listEl.querySelectorAll('.tactics-slide-delete').forEach((btn) => {
                btn.title = deleteTitle;
                btn.setAttribute('aria-label', deleteTitle);
            });

            const changeMapTitle = i18n().t('changeMapSlide');
            this.listEl.querySelectorAll('.tactics-slide-change-map').forEach((btn) => {
                btn.title = changeMapTitle;
                btn.setAttribute('aria-label', changeMapTitle);
            });

            this.updateViewToggleUi();
        }

        bindEvents() {
            this.addBtn?.addEventListener('click', () => this.addSlideQuick());

            document.getElementById('tacticsSlidesScrollLeft')?.addEventListener('click', () => {
                this.goToAdjacentSlide(-1);
            });
            document.getElementById('tacticsSlidesScrollRight')?.addEventListener('click', () => {
                this.goToAdjacentSlide(1);
            });
            this.viewToggleBtn?.addEventListener('click', () => this.toggleViewMode());
        }

        getAddSelectWrap() {
            return document.getElementById('tacticsAddSlideField')
                || this.addSelect?.closest('.recruiting-select-wrap')
                || this.addSelect;
        }

        setAddSelectVisible(visible) {
            const wrap = this.getAddSelectWrap();
            if (!wrap) return;
            wrap.hidden = !visible;
        }

        refreshAddSelectUi() {
            if (!this.addSelect) return;
            if (window.recruitingRefreshSelect && this.addSelect.dataset.recruitingSelectEnhanced === '1') {
                window.recruitingRefreshSelect(this.addSelect);
            } else if (window.recruitingEnhanceSelect) {
                window.recruitingEnhanceSelect(this.addSelect);
            }
        }

        resolveDefaultMapPick() {
            const game = this.roomGame || maps().getCatalog()?.default_game || 'wot';
            const catalog = maps().getCatalog() || {};
            const gameMeta = catalog.games?.[game] || {};
            const battleMode = gameMeta.default_mode || catalog.default_mode || 'random';
            const rows = maps().getMapsFor(game, battleMode);
            const first = rows[0];
            return {
                map_code: first?.map_code || '',
                game,
                battle_mode: battleMode,
            };
        }

        async addSlideQuick() {
            if (!this.canAddSlides) return;
            await maps().loadMaps();
            const active = this.getActiveSlide();
            let pick;
            if (active?.map_code) {
                pick = {
                    map_code: active.map_code,
                    game: active.game || this.roomGame || 'wot',
                    battle_mode: active.battle_mode || 'random',
                };
            } else {
                pick = this.resolveDefaultMapPick();
            }
            if (!pick.map_code && this.mapPicker?.shouldHideMapSelect?.()) {
                const rows = maps().getMapsFor(pick.game, pick.battle_mode);
                pick.map_code = rows[0]?.map_code || '';
            }
            if (!pick.map_code) return;
            this.addSlide(pick.map_code, pick.game, pick.battle_mode);
        }

        async openChangeMapModal(slideId) {
            if (!this.canAddSlides) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide || !this.mapPicker?.openModal) return;

            if (this.roomGame) {
                this.mapPicker.setLockGame(this.roomGame);
            }

            this.onMapModalOpen(slideId);
            try {
                await this.mapPicker.openModal((pick) => {
                    if (!pick?.map_code && !this.mapPicker?.shouldHideMapSelect?.()) return;
                    this.changeSlideMap(slideId, pick.map_code, pick.game, pick.battle_mode);
                }, {
                    initialValue: {
                        map_code: slide.map_code,
                        game: slide.game || this.roomGame,
                        battle_mode: slide.battle_mode,
                    },
                    onClose: () => this.onMapModalClose(),
                });
            } catch (err) {
                this.onMapModalClose();
                throw err;
            }
        }

        getSlides() {
            return Array.isArray(this.roomData.slides) ? this.roomData.slides : [];
        }

        getActiveSlideId() {
            return this.roomData.active_slide_id || (this.getSlides()[0]?.id || null);
        }

        getActiveSlide() {
            const id = this.getActiveSlideId();
            return this.getSlides().find((s) => s.id === id) || this.getSlides()[0] || null;
        }

        getSlideIndexNumber(slide) {
            if (!slide?.id) {
                return this.getSlides().length + 1;
            }
            const index = this.getSlides().findIndex((s) => s.id === slide.id);
            return index >= 0 ? index + 1 : this.getSlides().length + 1;
        }

        getSlideDefaultName(slide) {
            const number = this.getSlideIndexNumber(slide);
            return i18n().t('slideDefaultTitle').replace('{n}', String(number));
        }

        getSlideDisplayName(slide) {
            const custom = typeof slide?.title === 'string' ? slide.title.trim() : '';
            if (custom) return custom;
            return this.getSlideDefaultName(slide);
        }

        getSlideThumbUrl(slide) {
            if (!slide?.id) return maps().placeholderUrl();
            return this.mapUrls[slide.id] || maps().slideMapUrl(slide, this.publicId);
        }

        renderSlideItem(slide, activeId, canDelete, deleteTitle, renameHint, changeMapTitle) {
            const name = this.getSlideDisplayName(slide);
            const active = slide.id === activeId ? ' is-active' : '';
            const deleteBtn = canDelete
                ? '<button type="button" class="tactics-slide-delete" data-slide-id="' + slide.id + '" title="' + escapeHtml(deleteTitle) + '" aria-label="' + escapeHtml(deleteTitle) + '"><i class="fas fa-times" aria-hidden="true"></i></button>'
                : '';
            const changeMapBtn = this.canAddSlides
                ? '<button type="button" class="tactics-slide-change-map" data-slide-id="' + slide.id + '" title="' + escapeHtml(changeMapTitle) + '" aria-label="' + escapeHtml(changeMapTitle) + '"><i class="fas fa-map" aria-hidden="true"></i></button>'
                : '';

            if (this.viewMode === 'list') {
                return '<li class="tactics-slide-item">'
                    + '<div class="tactics-slide-card tactics-slide-card--list' + active + '" data-slide-id="' + slide.id + '">'
                    + changeMapBtn
                    + deleteBtn
                    + '<button type="button" class="tactics-slide-btn" data-slide-id="' + slide.id + '">'
                    + '<span class="tactics-slide-name" data-slide-id="' + slide.id + '" title="' + escapeHtml(renameHint) + '">' + escapeHtml(name) + '</span>'
                    + '</button>'
                    + '</div>'
                    + '</li>';
            }

            const thumbUrl = escapeHtml(this.getSlideThumbUrl(slide));
            return '<li class="tactics-slide-item">'
                + '<div class="tactics-slide-card tactics-slide-card--thumb' + active + '" data-slide-id="' + slide.id + '">'
                + changeMapBtn
                + deleteBtn
                + '<button type="button" class="tactics-slide-btn" data-slide-id="' + slide.id + '">'
                + '<img class="tactics-slide-thumb" src="' + thumbUrl + '" alt="" loading="lazy" crossorigin="anonymous">'
                + '<span class="tactics-slide-name" data-slide-id="' + slide.id + '" title="' + escapeHtml(renameHint) + '">' + escapeHtml(name) + '</span>'
                + '</button>'
                + '</div>'
                + '</li>';
        }

        render() {
            if (!this.listEl) return;
            const slides = this.getSlides();
            const activeId = this.getActiveSlideId();
            const canDelete = this.canManage && slides.length > 1;
            const deleteTitle = i18n().t('deleteSlide');
            const renameHint = i18n().t('renameMapHint');
            const changeMapTitle = i18n().t('changeMapSlide');

            this.listEl.innerHTML = slides.map((slide) => (
                this.renderSlideItem(slide, activeId, canDelete, deleteTitle, renameHint, changeMapTitle)
            )).join('');

            this.listEl.querySelectorAll('.tactics-slide-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const slideId = btn.getAttribute('data-slide-id');
                    if (slideId) this.switchSlide(slideId);
                });
            });

            this.listEl.querySelectorAll('.tactics-slide-delete').forEach((btn) => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const slideId = btn.getAttribute('data-slide-id');
                    if (slideId) this.deleteSlide(slideId);
                });
            });

            this.listEl.querySelectorAll('.tactics-slide-change-map').forEach((btn) => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const slideId = btn.getAttribute('data-slide-id');
                    if (slideId) this.openChangeMapModal(slideId);
                });
            });

            this.listEl.querySelectorAll('.tactics-slide-name').forEach((el) => {
                el.addEventListener('dblclick', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const slideId = el.getAttribute('data-slide-id');
                    if (slideId) this.startSlideRename(slideId, el);
                });
            });

            const activeCard = this.listEl.querySelector('.tactics-slide-card.is-active');
            if (activeCard) {
                activeCard.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            }
        }

        startSlideRename(slideId, nameEl) {
            if (!this.canAddSlides) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide || !nameEl) return;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tactics-slide-rename-input';
            input.maxLength = 64;
            input.value = typeof slide.title === 'string' ? slide.title : '';
            input.placeholder = this.getSlideDefaultName(slide);

            const finish = (cancel) => {
                if (!cancel) {
                    this.renameSlide(slideId, input.value);
                } else {
                    this.render();
                }
            };

            input.addEventListener('blur', () => finish(false));
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    input.blur();
                }
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    finish(true);
                }
            });

            nameEl.replaceWith(input);
            input.focus();
            input.select();
        }

        renameSlide(slideId, title, skipBroadcast) {
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide) return;

            const clean = String(title || '').trim();
            if (clean) {
                slide.title = clean;
            } else {
                delete slide.title;
            }

            this.render();
            this.onChange();
            this.onRenamed(slideId);

            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'rename',
                    slideId,
                    title: slide.title || '',
                });
            }
        }

        switchSlide(slideId, skipBroadcast) {
            if (this.slidesLocked && !skipBroadcast) return;
            const prevSlideId = this.getActiveSlideId();
            if (slideId === prevSlideId) return;
            this.roomData.active_slide_id = slideId;
            this.render();
            this.onSwitch(slideId, prevSlideId);
            this.onChange();
            if (!skipBroadcast) {
                this.onBroadcast({ action: 'switch', slideId, activeSlideId: slideId });
            }
        }

        changeSlideMap(slideId, mapCode, game, battleMode, skipBroadcast) {
            if (!this.canAddSlides && !skipBroadcast) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide || !mapCode) return;

            if (this.roomGame) {
                game = this.roomGame;
            }

            slide.map_code = mapCode;
            slide.game = game || slide.game || 'wot';
            slide.battle_mode = battleMode || slide.battle_mode || 'random';
            slide.canvas = null;
            this.mapUrls[slide.id] = maps().slideMapUrl(slide, this.publicId);

            const wasActive = this.getActiveSlideId() === slideId;
            this.render();
            this.onChange();

            if (wasActive) {
                this.onMapChange(slideId);
            }

            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'changeMap',
                    slideId,
                    map_code: slide.map_code,
                    game: slide.game,
                    battle_mode: slide.battle_mode,
                    mapUrl: this.mapUrls[slide.id],
                });
            }
        }

        addSlide(mapCode, game, battleMode, skipBroadcast) {
            if (!this.canAddSlides && !skipBroadcast) return;
            if (typeof game === 'boolean') {
                skipBroadcast = game;
                game = 'wot';
                battleMode = 'random';
            }
            if (this.roomGame) {
                game = this.roomGame;
            }
            const slide = {
                id: generateSlideId(),
                map_code: mapCode,
                game: game || 'wot',
                battle_mode: battleMode || 'random',
                canvas: null,
            };
            if (!Array.isArray(this.roomData.slides)) {
                this.roomData.slides = [];
            }
            this.roomData.slides.push(slide);
            this.mapUrls[slide.id] = maps().slideMapUrl(slide, this.publicId);
            this.roomData.active_slide_id = slide.id;
            this.render();
            this.onSwitch(slide.id, null);
            this.onChange();
            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'add',
                    slide,
                    activeSlideId: slide.id,
                    mapUrl: this.mapUrls[slide.id],
                });
            }
        }

        deleteSlide(slideId, skipBroadcast) {
            if (!this.canManage && !skipBroadcast) return;
            const slides = this.getSlides();
            if (slides.length <= 1) {
                window.alert(i18n().t('deleteSlideLast'));
                return;
            }

            const msg = i18n().t('deleteSlideConfirm');
            if (!skipBroadcast && !window.confirm(msg)) {
                return;
            }

            const wasActive = slideId === this.getActiveSlideId();
            this.roomData.slides = slides.filter((s) => s.id !== slideId);
            delete this.mapUrls[slideId];

            if (wasActive) {
                const next = this.getSlides()[0];
                this.roomData.active_slide_id = next?.id || null;
            }

            this.render();
            this.onChange();

            if (wasActive) {
                const next = this.getActiveSlide();
                if (next) {
                    this.onSwitch(next.id, slideId);
                }
            }

            this.onDelete(slideId);

            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'delete',
                    slideId,
                    activeSlideId: this.getActiveSlideId(),
                });
            }
        }

        updateSlideCanvas(slideId, canvasJson) {
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (slide) {
                slide.canvas = canvasJson;
            }
        }

        applyRemote(action, data) {
            if (action === 'switch' && data.slideId) {
                this.switchSlide(data.slideId, true);
                return;
            }
            if (action === 'add' && data.slide) {
                if (!Array.isArray(this.roomData.slides)) {
                    this.roomData.slides = [];
                }
                const exists = this.roomData.slides.some((s) => s.id === data.slide.id);
                if (!exists) {
                    this.roomData.slides.push(data.slide);
                    this.mapUrls[data.slide.id] = data.mapUrl || maps().slideMapUrl(data.slide, this.publicId);
                }
                if (data.activeSlideId) {
                    this.roomData.active_slide_id = data.activeSlideId;
                }
                this.render();
                this.onSwitch(this.getActiveSlideId(), null);
                return;
            }
            if (action === 'delete' && data.slideId) {
                const slides = this.getSlides();
                if (slides.length <= 1) return;
                this.roomData.slides = slides.filter((s) => s.id !== data.slideId);
                delete this.mapUrls[data.slideId];
                if (data.activeSlideId) {
                    this.roomData.active_slide_id = data.activeSlideId;
                } else if (this.getActiveSlideId() === data.slideId) {
                    this.roomData.active_slide_id = this.getSlides()[0]?.id || null;
                }
                this.render();
                const active = this.getActiveSlide();
                if (active) {
                    this.onSwitch(active.id, data.slideId);
                }
                return;
            }
            if (action === 'rename' && data.slideId) {
                this.renameSlide(data.slideId, data.title || '', true);
                return;
            }
            if (action === 'changeMap' && data.slideId && data.map_code) {
                const slide = this.getSlides().find((s) => s.id === data.slideId);
                if (!slide) return;
                slide.map_code = data.map_code;
                if (data.game) slide.game = data.game;
                if (data.battle_mode) slide.battle_mode = data.battle_mode;
                slide.canvas = null;
                this.mapUrls[data.slideId] = data.mapUrl || maps().slideMapUrl(slide, this.publicId);
                const wasActive = this.getActiveSlideId() === data.slideId;
                this.render();
                if (wasActive) {
                    this.onMapChange(data.slideId);
                }
            }
        }

        setRoomData(roomData) {
            this.roomData = roomData;
            this.render();
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.TacticsSlides = TacticsSlides;
})();
