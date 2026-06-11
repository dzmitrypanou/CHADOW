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
            this.bindEvents();
            this.render();
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
        }

        bindEvents() {
            this.addBtn?.addEventListener('click', () => this.toggleAddSelect());
            this.addSelect?.addEventListener('change', () => {
                const pick = this.mapPicker?.getValue() || { map_code: this.addSelect.value };
                if (pick.map_code) {
                    this.addSlide(pick.map_code, pick.game, pick.battle_mode);
                    this.addSelect.value = '';
                    this.refreshAddSelectUi();
                    this.setAddSelectVisible(false);
                }
            });

            document.getElementById('tacticsSlidesScrollLeft')?.addEventListener('click', () => {
                this.listEl?.scrollBy({ left: -120, behavior: 'smooth' });
            });
            document.getElementById('tacticsSlidesScrollRight')?.addEventListener('click', () => {
                this.listEl?.scrollBy({ left: 120, behavior: 'smooth' });
            });
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

        async toggleAddSelect() {
            if (!this.canAddSlides || !this.addSelect) return;
            const wrap = this.getAddSelectWrap();
            if (wrap?.hidden) {
                if (this.mapPicker) {
                    if (this.roomGame) {
                        this.mapPicker.setLockGame(this.roomGame);
                    }
                    await this.mapPicker.init();
                } else {
                    await maps().loadMaps();
                    maps().populateSelect(this.addSelect, this.lang);
                    this.refreshAddSelectUi();
                }
                this.setAddSelectVisible(true);
                wrap.querySelector('.recruiting-select-trigger')?.focus();
            } else {
                this.setAddSelectVisible(false);
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

        getSlideDefaultName(slide) {
            return maps().getSlideTitle(slide, this.lang);
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

        render() {
            if (!this.listEl) return;
            const slides = this.getSlides();
            const activeId = this.getActiveSlideId();
            const canDelete = this.canManage && slides.length > 1;
            const deleteTitle = i18n().t('deleteSlide');
            const renameHint = i18n().t('renameMapHint');

            this.listEl.innerHTML = slides.map((slide) => {
                const name = this.getSlideDisplayName(slide);
                const active = slide.id === activeId ? ' is-active' : '';
                const thumbUrl = escapeHtml(this.getSlideThumbUrl(slide));
                const deleteBtn = canDelete
                    ? '<button type="button" class="tactics-slide-delete" data-slide-id="' + slide.id + '" title="' + escapeHtml(deleteTitle) + '" aria-label="' + escapeHtml(deleteTitle) + '"><i class="fas fa-times" aria-hidden="true"></i></button>'
                    : '';
                return '<li class="tactics-slide-item">'
                    + '<div class="tactics-slide-card tactics-slide-card--thumb' + active + '" data-slide-id="' + slide.id + '">'
                    + deleteBtn
                    + '<button type="button" class="tactics-slide-btn" data-slide-id="' + slide.id + '">'
                    + '<img class="tactics-slide-thumb" src="' + thumbUrl + '" alt="" loading="lazy" crossorigin="anonymous">'
                    + '<span class="tactics-slide-name" data-slide-id="' + slide.id + '" title="' + escapeHtml(renameHint) + '">' + escapeHtml(name) + '</span>'
                    + '</button>'
                    + '</div>'
                    + '</li>';
            }).join('');

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
                activeCard.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
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

            if (!skipBroadcast) {
                this.onBroadcast({
                    action: 'rename',
                    slideId,
                    title: slide.title || '',
                });
            }
        }

        switchSlide(slideId, skipBroadcast) {
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
