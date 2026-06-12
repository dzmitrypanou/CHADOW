(() => {
    'use strict';

    const maps = () => window.AbsTacticsMaps;
    const i18n = () => window.AbsTacticsI18n;
    const confirmUi = () => window.AbsTacticsConfirm;

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
            this.onDuplicate = options.onDuplicate || (() => {});
            this.onRenamed = options.onRenamed || (() => {});
            this.onMapChange = options.onMapChange || (() => {});
            this.onMapModalOpen = options.onMapModalOpen || (() => {});
            this.onMapModalClose = options.onMapModalClose || (() => {});
            this.shouldBroadcastSlideSwitch = options.shouldBroadcastSlideSwitch || (() => false);
            this.shouldFollowRemoteSlideSwitch = options.shouldFollowRemoteSlideSwitch || (() => false);
            this.getCanvasSlideId = options.getCanvasSlideId || (() => null);
            this.getLiveCanvasState = options.getLiveCanvasState || (() => null);
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
            this.carouselViewport = document.getElementById('tacticsSlidesCarouselViewport');
            this.carouselPrevBtn = document.getElementById('tacticsSlidesCarouselPrev');
            this.carouselNextBtn = document.getElementById('tacticsSlidesCarouselNext');
            this.carouselStripWrap = document.getElementById('tacticsSlidesStripWrap');
            this.carouselResizeBound = false;
            this.viewMode = this.loadViewMode();
            this.viewSlideId = this.loadViewSlideId();
            this.pendingPresentationSlideId = null;
            this.applyViewModeClasses();
            this.bindEvents();
            this.render();
            window.addEventListener('tactics:catalog-updated', () => this.updatePreviewScales());
        }

        getViewSlideStorageKey() {
            return 'abs_tactics_view_slide_' + (this.publicId || 'default');
        }

        loadViewSlideId() {
            try {
                const stored = sessionStorage.getItem(this.getViewSlideStorageKey());
                return stored && this.getSlides().some((s) => s.id === stored) ? stored : null;
            } catch (err) {
                return null;
            }
        }

        persistViewSlideId() {
            if (!this.viewSlideId) return;
            try {
                sessionStorage.setItem(this.getViewSlideStorageKey(), this.viewSlideId);
            } catch (err) {
                // ignore
            }
        }

        pinViewSlide(slideId) {
            if (!slideId || !this.getSlides().some((s) => s.id === slideId)) return;
            if (this.viewSlideId === slideId) return;
            this.viewSlideId = slideId;
            this.persistViewSlideId();
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

        isCarouselLayout() {
            return window.innerWidth > 500 && window.innerWidth <= 1340;
        }

        applyViewModeClasses() {
            if (!this.listEl) return;
            if (this.isCarouselLayout()) {
                this.listEl.classList.remove(
                    'tactics-slides-list--list',
                    'tactics-slides-list--strip',
                    'tactics-slides-list--grid',
                );
                this.listEl.classList.add('tactics-slides-list--carousel');
                const wrap = this.carouselStripWrap || this.listEl.closest('.tactics-slides-strip-wrap');
                wrap?.classList.remove('tactics-slides-strip-wrap--list', 'tactics-slides-strip-wrap--grid');
                this.updateViewToggleUi();
                return;
            }
            const isList = this.viewMode === 'list';
            this.listEl.classList.toggle('tactics-slides-list--grid', !isList);
            this.listEl.classList.toggle('tactics-slides-list--list', isList);
            this.listEl.classList.remove('tactics-slides-list--strip');
            const wrap = this.listEl.closest('.tactics-slides-strip-wrap');
            wrap?.classList.toggle('tactics-slides-strip-wrap--grid', !isList);
            wrap?.classList.toggle('tactics-slides-strip-wrap--list', isList);
            this.updateViewToggleUi();
        }

        applyCarouselMode() {
            if (!this.listEl) return;
            const carousel = this.isCarouselLayout();
            const wrap = this.carouselStripWrap || this.listEl.closest('.tactics-slides-strip-wrap');
            wrap?.classList.toggle('tactics-slides-strip-wrap--carousel', carousel);
            this.listEl.classList.toggle('tactics-slides-list--carousel', carousel);
            this.applyViewModeClasses();
            this.updateCarouselControls();
            if (!this.carouselResizeBound) {
                this.carouselResizeBound = true;
                window.addEventListener('resize', () => {
                    this.applyCarouselMode();
                    this.syncCarouselScroll('auto');
                }, { passive: true });
            }
        }

        updateCarouselControls() {
            const carousel = this.isCarouselLayout();
            const slides = this.getSlides();
            const canStep = carousel && slides.length > 1;
            [this.carouselPrevBtn, this.carouselNextBtn].forEach((btn) => {
                if (!btn) return;
                btn.hidden = !carousel;
                btn.classList.toggle('is-disabled', !canStep);
                btn.disabled = !canStep;
            });
        }

        syncCarouselScroll(behavior = 'smooth') {
            if (!this.isCarouselLayout() || !this.carouselViewport || !this.listEl) return;

            const viewport = this.carouselViewport;
            const fits = viewport.clientWidth > 0 && this.listEl.scrollWidth <= viewport.clientWidth;
            viewport.style.justifyContent = fits ? 'center' : 'flex-start';

            const activeCard = this.listEl.querySelector('.tactics-slide-card.is-active');
            const item = activeCard?.closest('.tactics-slide-item');
            if (!item) return;
            if (fits) return;

            const scrollBehavior = behavior === 'auto' ? 'auto' : 'smooth';
            if (typeof item.scrollIntoView === 'function') {
                item.scrollIntoView({
                    behavior: scrollBehavior,
                    block: 'nearest',
                    inline: 'center',
                });
                return;
            }
            const viewportRect = viewport.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const itemCenter = (itemRect.left - viewportRect.left) + viewport.scrollLeft + (itemRect.width / 2);
            const targetLeft = itemCenter - (viewport.clientWidth / 2);
            const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
            viewport.scrollTo({
                left: Math.min(maxScroll, Math.max(0, targetLeft)),
                behavior: scrollBehavior,
            });
        }

        syncCarouselLayout() {
            this.applyCarouselMode();
            requestAnimationFrame(() => this.syncCarouselScroll('auto'));
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
            const next = !!canAddSlides;
            const changed = this.canAddSlides !== next;
            this.canAddSlides = next;
            if (this.addBtn) {
                this.addBtn.hidden = !this.canAddSlides;
            }
            if (!this.canAddSlides) {
                this.setAddSelectVisible(false);
            }
            if (changed) {
                this.render();
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

            const duplicateTitle = i18n().t('duplicateSlide');
            this.listEl.querySelectorAll('.tactics-slide-duplicate').forEach((btn) => {
                btn.title = duplicateTitle;
                btn.setAttribute('aria-label', duplicateTitle);
            });

            const changeMapTitle = i18n().t('changeMapSlide');
            this.listEl.querySelectorAll('.tactics-slide-change-map').forEach((btn) => {
                btn.title = changeMapTitle;
                btn.setAttribute('aria-label', changeMapTitle);
            });
            this.listEl.querySelectorAll('.tactics-slide-change-map__label').forEach((el) => {
                el.textContent = changeMapTitle;
            });

            this.updatePreviewScales();
            this.updateViewToggleUi();
        }

        updatePreviewScales() {
            if (!this.listEl) return;

            const applyScale = (el, slide) => {
                const label = this.getSlideScaleLabel(slide);
                el.textContent = label;
                el.hidden = !label;
            };

            this.listEl.querySelectorAll('.tactics-slide-preview__scale').forEach((el) => {
                const slideId = el.getAttribute('data-slide-id');
                const slide = this.getSlides().find((s) => s.id === slideId);
                applyScale(el, slide);
            });

            if (this.viewMode === 'list') return;

            this.getSlides().forEach((slide) => {
                const card = this.listEl.querySelector('.tactics-slide-card[data-slide-id="' + slide.id + '"]');
                const thumbBtn = card?.querySelector('.tactics-slide-thumb-btn');
                if (!thumbBtn || thumbBtn.querySelector('.tactics-slide-preview__scale')) return;

                const span = document.createElement('span');
                span.className = 'tactics-slide-preview__scale';
                span.setAttribute('data-slide-id', slide.id);
                applyScale(span, slide);
                thumbBtn.appendChild(span);
            });
        }

        getSlideScaleLabel(slide) {
            if (!slide) return '';
            return maps().formatSlideScaleLabel?.(maps().slideMapScaleSync?.(slide)) || '';
        }

        buildDuplicateBtn(slideId, duplicateTitle) {
            if (!this.canAddSlides) return '';
            return '<button type="button" class="tactics-slide-duplicate" data-slide-id="' + slideId + '" title="' + escapeHtml(duplicateTitle) + '" aria-label="' + escapeHtml(duplicateTitle) + '"><i class="fas fa-copy" aria-hidden="true"></i></button>';
        }

        isCustomSlide(slide) {
            const game = String(slide?.game || '').toLowerCase();
            return (game === 'cs2' || game === 'dota2') && slide?.battle_mode === 'custom';
        }

        cloneSlideData(slide) {
            const copy = {
                id: generateSlideId(),
                map_code: slide.map_code,
                game: slide.game,
                battle_mode: slide.battle_mode,
                canvas: slide.canvas ? JSON.parse(JSON.stringify(slide.canvas)) : null,
                view: slide.view ? JSON.parse(JSON.stringify(slide.view)) : { show_grid: true },
            };
            if (slide.title) {
                copy.title = this.buildDuplicateTitle(slide.title);
            }
            if (slide.map_width_m) {
                copy.map_width_m = slide.map_width_m;
            }
            if (slide.map_height_m) {
                copy.map_height_m = slide.map_height_m;
            }
            maps().normalizeCustomRoomSlide?.(copy);
            return copy;
        }

        buildDuplicateTitle(title) {
            const clean = String(title || '').trim();
            if (!clean) return '';
            const suffix = i18n().getLang() === 'en' ? ' (copy)' : ' (копия)';
            if (clean.endsWith(' (copy)') || clean.endsWith(' (копия)')) {
                return clean;
            }
            const next = clean + suffix;
            return next.length <= 64 ? next : clean.slice(0, 64 - suffix.length) + suffix;
        }

        buildChangeMapBtn(slideId, changeMapTitle, isActive) {
            if (!this.canAddSlides) return '';
            if (this.viewMode !== 'list' && !isActive) return '';
            return '<button type="button" class="tactics-slide-change-map" data-slide-id="' + slideId + '" title="' + escapeHtml(changeMapTitle) + '" aria-label="' + escapeHtml(changeMapTitle) + '">'
                + '<i class="fas fa-map" aria-hidden="true"></i>'
                + '<span class="tactics-slide-change-map__label">' + escapeHtml(changeMapTitle) + '</span>'
                + '</button>';
        }

        renderSlideScaleBar(slide) {
            const label = this.getSlideScaleLabel(slide);
            const hiddenAttr = label ? '' : ' hidden';
            return '<span class="tactics-slide-preview__scale"' + hiddenAttr + ' data-slide-id="' + slide.id + '">' + escapeHtml(label) + '</span>';
        }

        bindEvents() {
            this.addBtn?.addEventListener('click', () => this.addSlideQuick());

            document.getElementById('tacticsSlidesScrollLeft')?.addEventListener('click', () => {
                this.goToAdjacentSlide(-1);
            });
            document.getElementById('tacticsSlidesScrollRight')?.addEventListener('click', () => {
                this.goToAdjacentSlide(1);
            });
            this.carouselPrevBtn?.addEventListener('click', () => this.goToAdjacentSlide(-1));
            this.carouselNextBtn?.addEventListener('click', () => this.goToAdjacentSlide(1));
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
            await this.addSlide(pick.map_code, pick.game, pick.battle_mode, false, active);
        }

        async openChangeMapModal(slideId) {
            if (!this.canAddSlides) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide) return;
            if (!this.mapPicker?.openModal) {
                await window.AbsTacticsRoom?.ensureDeferredModules?.();
            }
            if (!this.mapPicker?.openModal) return;

            if (this.roomGame) {
                this.mapPicker.setLockGame(this.roomGame);
            }

            this.onMapModalOpen(slideId);
            try {
                await this.mapPicker.openModal((pick) => {
                    if (!pick?.map_code && !this.mapPicker?.shouldHideMapSelect?.()) return;
                    this.changeSlideMap(slideId, pick.map_code, pick.game, pick.battle_mode, false, {
                        map_width_m: pick.map_width_m,
                        map_height_m: pick.map_height_m,
                    });
                }, {
                    initialValue: {
                        map_code: slide.map_code,
                        game: slide.game || this.roomGame,
                        battle_mode: slide.battle_mode,
                        map_width_m: slide.map_width_m,
                        map_height_m: slide.map_height_m,
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
            const slides = this.getSlides();
            const canvasSlideId = this.getCanvasSlideId?.();
            if (canvasSlideId && slides.some((s) => s.id === canvasSlideId)) {
                return canvasSlideId;
            }
            if (this.viewSlideId && slides.some((s) => s.id === this.viewSlideId)) {
                return this.viewSlideId;
            }
            return this.roomData.active_slide_id || (slides[0]?.id || null);
        }

        getViewSlideId() {
            const slides = this.getSlides();
            if (this.viewSlideId && slides.some((s) => s.id === this.viewSlideId)) {
                return this.viewSlideId;
            }
            return this.getActiveSlideId();
        }

        syncLiveCanvasToSlide(slideId) {
            if (!slideId || !this.getLiveCanvasState) return;
            const canvasSlideId = this.getCanvasSlideId?.();
            if (!canvasSlideId || String(canvasSlideId) !== String(slideId)) return;
            const live = this.getLiveCanvasState();
            if (!live) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (slide) {
                slide.canvas = live;
            }
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
            const mapsApi = maps();
            if (mapsApi?.getSlideTitle) {
                return mapsApi.getSlideTitle(slide, this.lang);
            }
            const custom = typeof slide?.title === 'string' ? slide.title.trim() : '';
            if (custom) return custom;
            return this.getSlideDefaultName(slide);
        }

        applySlideTitle(slideId, title) {
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide) return null;

            const clean = String(title || '').trim();
            if (clean) {
                slide.title = clean;
            } else {
                delete slide.title;
            }

            return this.getSlideDisplayName(slide);
        }

        createSlideNameEl(slideId, displayName) {
            const el = document.createElement('span');
            el.className = 'tactics-slide-name';
            el.setAttribute('data-slide-id', slideId);
            el.title = i18n().t('renameMapHint');
            el.textContent = displayName;
            this.bindSlideNameEl(el);
            return el;
        }

        bindSlideNameEl(el) {
            if (!el || el.dataset.renameBound === '1') return;
            el.dataset.renameBound = '1';
            el.addEventListener('click', () => {
                const slideId = el.getAttribute('data-slide-id');
                if (slideId) this.switchSlide(slideId);
            });
            el.addEventListener('dblclick', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const slideId = el.getAttribute('data-slide-id');
                if (slideId) this.startSlideRename(slideId, el);
            });
        }

        updateSlideNameInDom(slideId, displayName) {
            if (!this.listEl || !displayName) return;
            this.listEl.querySelectorAll(`.tactics-slide-name[data-slide-id="${slideId}"]`).forEach((el) => {
                if (el.classList.contains('tactics-slide-rename-input')) return;
                el.textContent = displayName;
            });
        }

        getSlideThumbUrl(slide) {
            if (!slide?.id) return maps().placeholderUrl();
            return this.mapUrls[slide.id] || maps().slideMapUrl(slide, this.publicId, this.mapUrls);
        }

        setSlidePreviewUrl(slide, opts = {}) {
            if (!slide?.id) return maps().placeholderUrl();
            const url = maps().refreshSlidePreviewUrl(slide, this.publicId, this.mapUrls, opts);
            this.mapUrls[slide.id] = url;
            if (!window.ABS_TACTICS_MAP_URLS) {
                window.ABS_TACTICS_MAP_URLS = {};
            }
            window.ABS_TACTICS_MAP_URLS[slide.id] = url;
            maps().preloadMapUrls([url]);
            return url;
        }

        hydrateSlideThumb(img, slide) {
            if (!img || !slide?.id) return;

            const placeholder = maps().placeholderUrl();
            const preferred = this.mapUrls[slide.id] || img.getAttribute('src') || '';
            void maps().loadMapImage(
                slide.map_code,
                slide.game,
                slide.battle_mode,
                preferred && preferred !== placeholder ? preferred : '',
                slide,
                this.publicId,
            ).then((loaded) => {
                if (!loaded?.src || !img.isConnected) return;
                const url = loaded.src;
                this.mapUrls[slide.id] = url;
                if (!window.ABS_TACTICS_MAP_URLS) {
                    window.ABS_TACTICS_MAP_URLS = {};
                }
                window.ABS_TACTICS_MAP_URLS[slide.id] = url;
                if (img.getAttribute('src') !== url) {
                    img.src = url;
                }
            });
        }

        refreshSlideThumbs() {
            if (!this.listEl || this.viewMode === 'list') return;

            const placeholder = maps().placeholderUrl();
            this.listEl.querySelectorAll('.tactics-slide-thumb').forEach((img) => {
                const slideId = img.closest('[data-slide-id]')?.getAttribute('data-slide-id');
                const slide = this.getSlides().find((s) => s.id === slideId);
                if (!slide) return;

                const thumbSrc = img.getAttribute('src') || '';
                const needsHydrate = !thumbSrc
                    || thumbSrc === placeholder
                    || thumbSrc.endsWith('/placeholder.svg');

                if (!needsHydrate && img.complete && img.naturalWidth > 0) {
                    return;
                }

                if (!needsHydrate && !img.complete) {
                    img.addEventListener('error', () => this.hydrateSlideThumb(img, slide), { once: true });
                    return;
                }

                this.hydrateSlideThumb(img, slide);
            });
        }

        renderSlideItem(slide, activeId, canDelete, canDuplicate, deleteTitle, duplicateTitle, renameHint, changeMapTitle) {
            const name = this.getSlideDisplayName(slide);
            const active = slide.id === activeId ? ' is-active' : '';
            const deleteBtn = canDelete
                ? '<button type="button" class="tactics-slide-delete" data-slide-id="' + slide.id + '" title="' + escapeHtml(deleteTitle) + '" aria-label="' + escapeHtml(deleteTitle) + '"><i class="fas fa-times" aria-hidden="true"></i></button>'
                : '';
            const duplicateBtn = canDuplicate
                ? this.buildDuplicateBtn(slide.id, duplicateTitle)
                : '';
            const changeMapBtn = this.buildChangeMapBtn(slide.id, changeMapTitle, slide.id === activeId);

            if (this.viewMode === 'list') {
                return '<li class="tactics-slide-item">'
                    + '<div class="tactics-slide-card tactics-slide-card--list' + active + '" data-slide-id="' + slide.id + '">'
                    + changeMapBtn
                    + duplicateBtn
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
                + duplicateBtn
                + deleteBtn
                + '<div class="tactics-slide-preview">'
                + '<button type="button" class="tactics-slide-btn tactics-slide-thumb-btn" data-slide-id="' + slide.id + '">'
                + '<img class="tactics-slide-thumb" src="' + thumbUrl + '" alt="" loading="lazy" crossorigin="anonymous">'
                + this.renderSlideScaleBar(slide)
                + '</button>'
                + changeMapBtn
                + '</div>'
                + '<span class="tactics-slide-name" data-slide-id="' + slide.id + '" title="' + escapeHtml(renameHint) + '">' + escapeHtml(name) + '</span>'
                + '</div>'
                + '</li>';
        }

        render() {
            if (!this.listEl) return;
            const slides = this.getSlides();
            const activeId = this.getViewSlideId();
            const canDelete = (this.canManage || this.canAddSlides) && slides.length > 1;
            const canDuplicate = this.canAddSlides;
            const deleteTitle = i18n().t('deleteSlide');
            const duplicateTitle = i18n().t('duplicateSlide');
            const renameHint = i18n().t('renameMapHint');
            const changeMapTitle = i18n().t('changeMapSlide');

            this.listEl.innerHTML = slides.map((slide) => (
                this.renderSlideItem(slide, activeId, canDelete, canDuplicate, deleteTitle, duplicateTitle, renameHint, changeMapTitle)
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
                    if (slideId) void this.deleteSlide(slideId);
                });
            });

            this.listEl.querySelectorAll('.tactics-slide-duplicate').forEach((btn) => {
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const slideId = btn.getAttribute('data-slide-id');
                    if (slideId) this.duplicateSlide(slideId);
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
                this.bindSlideNameEl(el);
            });

            this.refreshSlideThumbs();
            this.updatePreviewScales();
            this.applyCarouselMode();
            requestAnimationFrame(() => this.syncCarouselScroll('smooth'));
        }

        startSlideRename(slideId, nameEl) {
            if (!this.canAddSlides) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide || !nameEl) return;
            if (nameEl.classList?.contains('tactics-slide-rename-input')) return;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tactics-slide-rename-input';
            input.maxLength = 64;
            input.value = typeof slide.title === 'string' ? slide.title : '';
            input.placeholder = this.getSlideDisplayName(slide);

            let finished = false;
            const onBlur = () => finish(false);

            const finish = (cancel) => {
                if (finished) return;
                finished = true;
                input.removeEventListener('blur', onBlur);

                if (cancel) {
                    const displayName = this.getSlideDisplayName(slide);
                    input.replaceWith(this.createSlideNameEl(slideId, displayName));
                    return;
                }

                const displayName = this.applySlideTitle(slideId, input.value);
                if (!displayName) return;

                input.replaceWith(this.createSlideNameEl(slideId, displayName));
                this.onChange();
                this.onRenamed(slideId);
                this.onBroadcast({
                    action: 'rename',
                    slideId,
                    title: slide.title || '',
                });
            };

            input.addEventListener('blur', onBlur);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    finish(false);
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

            const displayName = this.applySlideTitle(slideId, title);
            if (!displayName) return;

            this.updateSlideNameInDom(slideId, displayName);

            if (!skipBroadcast) {
                this.onChange();
                this.onRenamed(slideId);
                this.onBroadcast({
                    action: 'rename',
                    slideId,
                    title: slide.title || '',
                });
            }
        }

        async switchSlide(slideId, skipBroadcast) {
            if (this.slidesLocked && !skipBroadcast) return;
            const prevSlideId = this.getActiveSlideId();
            if (slideId === prevSlideId) return;

            this.viewSlideId = slideId;
            this.persistViewSlideId();

            const presenterBroadcast = !skipBroadcast && this.shouldBroadcastSlideSwitch();
            const remoteFollow = skipBroadcast && this.shouldFollowRemoteSlideSwitch();

            if (presenterBroadcast || remoteFollow) {
                this.roomData.active_slide_id = slideId;
            }

            this.render();
            await Promise.resolve(this.onSwitch(slideId, prevSlideId));
            this.onChange();

            if (presenterBroadcast) {
                this.onBroadcast({ action: 'switch', slideId, activeSlideId: slideId });
            }
        }

        changeSlideMap(slideId, mapCode, game, battleMode, skipBroadcast, scale) {
            if (!this.canAddSlides && !skipBroadcast) return;
            const slide = this.getSlides().find((s) => s.id === slideId);
            if (!slide || !mapCode) return;

            const prevUrl = this.mapUrls[slideId]
                || window.ABS_TACTICS_MAP_URLS?.[slideId]
                || '';
            const hadCustomFile = prevUrl.includes('/custom/rooms/') && prevUrl.includes(slideId);

            if (this.roomGame) {
                game = this.roomGame;
            }

            slide.map_code = mapCode;
            slide.game = game || slide.game || 'wot';
            slide.battle_mode = battleMode || slide.battle_mode || 'random';
            slide.canvas = null;

            const scaleOpts = scale && typeof scale === 'object' ? scale : null;
            if (scaleOpts?.map_width_m && scaleOpts?.map_height_m) {
                slide.map_width_m = parseInt(scaleOpts.map_width_m, 10) || 1000;
                slide.map_height_m = parseInt(scaleOpts.map_height_m, 10) || 1000;
            } else if ((slide.game === 'cs2' || slide.game === 'dota2') && slide.battle_mode === 'custom') {
                slide.map_width_m = slide.map_width_m || 1000;
                slide.map_height_m = slide.map_height_m || 1000;
            } else {
                delete slide.map_width_m;
                delete slide.map_height_m;
            }

            maps().normalizeCustomRoomSlide?.(slide);
            const extMatch = prevUrl.match(/\.(webp|png|jpe?g)(?:\?|$)/i);
            this.setSlidePreviewUrl(slide, {
                resetKnown: true,
                allowCustomPath: maps().isCustomRoomSlide(slide) && hadCustomFile,
                extHint: extMatch ? extMatch[1] : 'webp',
            });

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
                    map_width_m: slide.map_width_m || null,
                    map_height_m: slide.map_height_m || null,
                });
            }
        }

        async addSlide(mapCode, game, battleMode, skipBroadcast, sourceSlide) {
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
                view: { show_grid: true },
            };
            if (!Array.isArray(this.roomData.slides)) {
                this.roomData.slides = [];
            }
            this.roomData.slides.push(slide);
            maps().normalizeCustomRoomSlide?.(slide);

            const source = sourceSlide && sourceSlide.id !== slide.id ? sourceSlide : null;
            const needsMapCopy = source && maps().needsCustomMapFileCopy?.(
                source,
                slide,
                this.publicId,
                this.mapUrls
            );

            if (needsMapCopy) {
                await Promise.resolve(this.onDuplicate(source, slide));
                const sourceUrl = this.mapUrls[source.id]
                    || window.ABS_TACTICS_MAP_URLS?.[source.id]
                    || '';
                const extMatch = sourceUrl.match(/\.(webp|png|jpe?g)(?:\?|$)/i);
                const resolved = this.mapUrls[slide.id]
                    || maps().resolveCustomMapUrlAfterCopy?.(
                        slide,
                        this.publicId,
                        this.mapUrls,
                        extMatch ? extMatch[1] : 'webp'
                    );
                if (resolved) {
                    this.setSlidePreviewUrl(slide, { preferredUrl: resolved, resetKnown: false });
                } else {
                    this.setSlidePreviewUrl(slide, { resetKnown: true, allowCustomPath: true, extHint: extMatch?.[1] || 'webp' });
                }
            } else {
                this.setSlidePreviewUrl(slide, {
                    resetKnown: !source,
                    inheritFromSlide: source || null,
                });
            }

            this.roomData.active_slide_id = slide.id;
            this.viewSlideId = slide.id;
            this.persistViewSlideId();
            this.render();
            this.onSwitch(slide.id, null);
            this.onChange();
            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'add',
                    slide,
                    sourceSlideId: source?.id || null,
                    activeSlideId: slide.id,
                    mapUrl: this.mapUrls[slide.id],
                });
            }
        }

        async duplicateSlide(slideId, skipBroadcast) {
            if (!this.canAddSlides && !skipBroadcast) return;
            const slides = this.getSlides();
            const index = slides.findIndex((s) => s.id === slideId);
            if (index < 0) return;

            const source = slides[index];
            this.syncLiveCanvasToSlide(slideId);
            const copy = this.cloneSlideData(source);
            slides.push(copy);

            const needsMapCopy = maps().needsCustomMapFileCopy?.(
                source,
                copy,
                this.publicId,
                this.mapUrls
            );

            if (needsMapCopy) {
                await Promise.resolve(this.onDuplicate(source, copy));
                const sourceUrl = this.mapUrls[source.id]
                    || window.ABS_TACTICS_MAP_URLS?.[source.id]
                    || '';
                const extMatch = sourceUrl.match(/\.(webp|png|jpe?g)(?:\?|$)/i);
                const extHint = extMatch ? extMatch[1] : 'webp';
                const resolved = this.mapUrls[copy.id]
                    || maps().resolveCustomMapUrlAfterCopy?.(
                        copy,
                        this.publicId,
                        this.mapUrls,
                        extHint
                    );
                if (resolved) {
                    this.setSlidePreviewUrl(copy, { preferredUrl: resolved, resetKnown: false });
                } else {
                    this.setSlidePreviewUrl(copy, { resetKnown: true, allowCustomPath: true, extHint });
                }
            } else {
                this.setSlidePreviewUrl(copy, {
                    resetKnown: false,
                    inheritFromSlide: source,
                });
            }

            this.render();
            this.onChange();

            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'duplicate',
                    slide: copy,
                    sourceSlideId: slideId,
                    mapUrl: this.mapUrls[copy.id],
                });
            }
        }

        async deleteSlide(slideId, skipBroadcast) {
            if (!this.canManage && !this.canAddSlides && !skipBroadcast) return;
            const slides = this.getSlides();
            if (slides.length <= 1) {
                if (confirmUi()?.alert) {
                    await confirmUi().alert(i18n().t('deleteSlideLast'));
                } else {
                    window.alert(i18n().t('deleteSlideLast'));
                }
                return;
            }

            const msg = i18n().t('deleteSlideConfirm');
            if (!skipBroadcast) {
                const confirmed = confirmUi()?.confirm
                    ? await confirmUi().confirm(msg)
                    : window.confirm(msg);
                if (!confirmed) return;
            }

            const wasActive = slideId === this.getActiveSlideId();
            this.roomData.slides = slides.filter((s) => s.id !== slideId);
            delete this.mapUrls[slideId];

            if (wasActive) {
                const next = this.getSlides()[0];
                this.roomData.active_slide_id = next?.id || null;
                this.viewSlideId = next?.id || null;
                this.persistViewSlideId();
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

        syncToPresentationSlide(slideId) {
            const id = this.pendingPresentationSlideId
                || slideId
                || this.roomData.active_slide_id;
            this.pendingPresentationSlideId = null;
            if (id && this.getSlides().some((s) => s.id === id)) {
                this.switchSlide(id, true);
            }
        }

        applyRemote(action, data) {
            if (action === 'switch' && data.slideId) {
                const targetId = data.activeSlideId || data.slideId;
                if (this.shouldFollowRemoteSlideSwitch()) {
                    this.switchSlide(targetId, true);
                } else {
                    this.pendingPresentationSlideId = targetId;
                    this.roomData.active_slide_id = targetId;
                }
                return;
            }
            if (action === 'add' && data.slide) {
                if (!Array.isArray(this.roomData.slides)) {
                    this.roomData.slides = [];
                }
                const exists = this.roomData.slides.some((s) => s.id === data.slide.id);
                const insertRemoteAdd = async () => {
                    if (!exists) {
                        this.roomData.slides.push(data.slide);
                        maps().normalizeCustomRoomSlide?.(data.slide);
                        const source = data.sourceSlideId
                            ? this.getSlides().find((s) => s.id === data.sourceSlideId)
                            : null;
                        const needsMapCopy = maps().needsCustomMapFileCopy?.(
                            source,
                            data.slide,
                            this.publicId,
                            this.mapUrls
                        );
                        if (needsMapCopy && source && !data.mapUrl) {
                            await Promise.resolve(this.onDuplicate(source, data.slide));
                        }
                        this.setSlidePreviewUrl(data.slide, {
                            preferredUrl: data.mapUrl || this.mapUrls[data.slide.id] || undefined,
                            resetKnown: !data.mapUrl,
                            inheritFromSlide: data.sourceSlideId
                                ? this.getSlides().find((s) => s.id === data.sourceSlideId)
                                : null,
                            allowCustomPath: maps().isCustomRoomSlide(data.slide) && !!data.mapUrl,
                        });
                    }
                    this.render();
                    if (this.shouldFollowRemoteSlideSwitch() && data.activeSlideId) {
                        this.switchSlide(data.activeSlideId, true);
                    }
                };

                void insertRemoteAdd();
                return;
            }
            if (action === 'delete' && data.slideId) {
                const slides = this.getSlides();
                if (slides.length <= 1) return;
                const wasViewing = this.viewSlideId === data.slideId;
                this.roomData.slides = slides.filter((s) => s.id !== data.slideId);
                delete this.mapUrls[data.slideId];
                if (data.activeSlideId) {
                    this.roomData.active_slide_id = data.activeSlideId;
                } else if (wasViewing || this.getActiveSlideId() === data.slideId) {
                    this.roomData.active_slide_id = this.getSlides()[0]?.id || null;
                }
                if (wasViewing) {
                    this.viewSlideId = this.roomData.active_slide_id;
                    this.persistViewSlideId();
                }
                this.render();
                if (this.shouldFollowRemoteSlideSwitch()) {
                    const targetId = data.activeSlideId || this.roomData.active_slide_id;
                    if (targetId) this.switchSlide(targetId, true);
                } else if (wasViewing) {
                    const active = this.getActiveSlide();
                    if (active) this.onSwitch(active.id, data.slideId);
                }
                return;
            }
            if (action === 'rename' && data.slideId) {
                this.renameSlide(data.slideId, data.title || '', true);
                return;
            }
            if (action === 'duplicate' && data.slide) {
                if (!Array.isArray(this.roomData.slides)) {
                    this.roomData.slides = [];
                }
                const exists = this.roomData.slides.some((s) => s.id === data.slide.id);
                const insertRemoteDuplicate = async () => {
                    if (!exists) {
                        this.roomData.slides.push(data.slide);
                        maps().normalizeCustomRoomSlide?.(data.slide);
                        const source = data.sourceSlideId
                            ? this.getSlides().find((s) => s.id === data.sourceSlideId)
                            : null;
                        const needsMapCopy = maps().needsCustomMapFileCopy?.(
                            source,
                            data.slide,
                            this.publicId,
                            this.mapUrls
                        );
                        if (needsMapCopy && source && !data.mapUrl) {
                            await Promise.resolve(this.onDuplicate(source, data.slide));
                        }
                        this.setSlidePreviewUrl(data.slide, {
                            preferredUrl: data.mapUrl || this.mapUrls[data.slide.id] || undefined,
                            resetKnown: !data.mapUrl,
                            inheritFromSlide: data.sourceSlideId
                                ? this.getSlides().find((s) => s.id === data.sourceSlideId)
                                : null,
                            allowCustomPath: maps().isCustomRoomSlide(data.slide) && !!data.mapUrl,
                        });
                    }
                    this.render();
                    if (this.shouldFollowRemoteSlideSwitch() && data.activeSlideId) {
                        this.switchSlide(data.activeSlideId, true);
                    }
                };

                void insertRemoteDuplicate();
                return;
            }
            if (action === 'changeMap' && data.slideId && data.map_code) {
                const slide = this.getSlides().find((s) => s.id === data.slideId);
                if (!slide) return;
                slide.map_code = data.map_code;
                if (data.game) slide.game = data.game;
                if (data.battle_mode) slide.battle_mode = data.battle_mode;
                if (data.map_width_m && data.map_height_m) {
                    slide.map_width_m = parseInt(data.map_width_m, 10) || null;
                    slide.map_height_m = parseInt(data.map_height_m, 10) || null;
                }
                slide.canvas = null;
                maps().normalizeCustomRoomSlide?.(slide);
                const prevUrl = this.mapUrls[data.slideId]
                    || window.ABS_TACTICS_MAP_URLS?.[data.slideId]
                    || data.mapUrl
                    || '';
                const hadCustomFile = prevUrl.includes('/custom/rooms/') && prevUrl.includes(data.slideId);
                const extMatch = prevUrl.match(/\.(webp|png|jpe?g)(?:\?|$)/i);
                this.setSlidePreviewUrl(slide, {
                    preferredUrl: data.mapUrl || undefined,
                    resetKnown: !data.mapUrl,
                    allowCustomPath: maps().isCustomRoomSlide(slide) && (hadCustomFile || !!data.mapUrl),
                    extHint: extMatch ? extMatch[1] : 'webp',
                });
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

        setMapPicker(mapPicker) {
            this.mapPicker = mapPicker || null;
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
