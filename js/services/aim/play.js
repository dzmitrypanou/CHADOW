(() => {
    'use strict';

    const i18n = () => window.AbsAimI18n;
    const core = () => window.AbsAimCore;
    const nick = () => window.AbsAimNickname;

    let trainer = null;
    let canvas = null;
    let ctx = null;
    let size = { width: 0, height: 0 };
    let rafId = 0;
    let phase = 'idle';
    let lastResult = null;
    let submitSaved = false;
    let lastCanvasDownAt = 0;

    const els = {};

    function $(id) {
        return document.getElementById(id);
    }

    function setOverlayMode(mode) {
        const overlay = els.aimOverlay;
        if (!overlay) return;
        overlay.classList.remove('aim-overlay--idle', 'aim-overlay--countdown', 'aim-overlay--playing', 'aim-overlay--results');
        if (mode) {
            overlay.classList.add('aim-overlay--' + mode);
        }
    }

    function showOverlay(id) {
        ['aimOverlayIdle', 'aimOverlayCountdown', 'aimOverlayResults'].forEach((key) => {
            const el = els[key];
            if (el) el.hidden = key !== id;
        });
        if (id === 'aimOverlayIdle') {
            setOverlayMode('idle');
        } else if (id === 'aimOverlayCountdown') {
            setOverlayMode('countdown');
        } else if (id === 'aimOverlayResults') {
            setOverlayMode('results');
        } else {
            setOverlayMode('playing');
        }
    }

    function computeGrade(score) {
        const thresholds = window.ABS_AIM_GRADE_THRESHOLDS || {};
        return core().computeGrade(score, thresholds);
    }

    function formatMetrics(metrics) {
        if (!metrics) return '';
        const t = i18n().t.bind(i18n());
        const rows = [];
        if (metrics.misses != null) rows.push([t('misses'), metrics.misses]);
        if (metrics.accuracy_pct != null) rows.push([t('accuracy'), metrics.accuracy_pct + t('metricPct')]);
        if (metrics.best_streak != null) rows.push([t('streak'), metrics.best_streak]);
        if (metrics.on_target_pct != null) rows.push([t('onTarget'), metrics.on_target_pct + t('metricPct')]);
        if (metrics.avg_reaction_ms != null) rows.push([t('avgReaction'), metrics.avg_reaction_ms + ' ' + t('metricMs')]);
        if (metrics.early_clicks != null) rows.push([t('earlyClicks'), metrics.early_clicks]);
        if (metrics.rounds_completed != null) rows.push([t('rounds'), metrics.rounds_completed]);
        if (metrics.avg_distance_pct != null) rows.push([t('distance'), metrics.avg_distance_pct + t('metricPct')]);
        return rows.map(([label, value]) => {
            return '<div class="aim-results-metric"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
        }).join('');
    }

    function setSubmitBtnDefault() {
        submitSaved = false;
        if (els.aimSubmitBtn) {
            els.aimSubmitBtn.disabled = false;
        }
        if (els.aimSubmitBtnLabel) {
            els.aimSubmitBtnLabel.textContent = i18n().t('submitScore');
        }
    }

    function setSubmitBtnSaved() {
        submitSaved = true;
        if (els.aimSubmitBtn) {
            els.aimSubmitBtn.disabled = true;
        }
        if (els.aimSubmitBtnLabel) {
            els.aimSubmitBtnLabel.textContent = i18n().t('submitSaved');
        }
        if (els.aimSubmitNote) {
            els.aimSubmitNote.hidden = true;
            els.aimSubmitNote.textContent = '';
        }
    }

    function setResults(score, grade, metrics) {
        lastResult = { score, grade, metrics };
        if (els.aimResultsScore) els.aimResultsScore.textContent = String(score);
        if (els.aimResultsGrade) {
            const gradeText = core().isMobileDevice() ? grade : i18n().gradeLabel(grade);
            els.aimResultsGrade.textContent = gradeText;
            els.aimResultsGrade.className = 'aim-grade ' + i18n().gradeClass(grade);
        }
        if (els.aimResultsMetrics) {
            els.aimResultsMetrics.innerHTML = formatMetrics(metrics);
        }
        if (els.aimSubmitNote) {
            els.aimSubmitNote.hidden = true;
            els.aimSubmitNote.textContent = '';
        }
    }

    function finishSession() {
        if (!trainer) return;
        trainer.stop();
        phase = 'results';
        const score = trainer.getScore();
        const grade = computeGrade(score);
        const metrics = trainer.getMetrics();
        setResults(score, grade, metrics);
        setSubmitBtnDefault();
        els.hud.hide();
        setArenaInteractive(false);
        showOverlay('aimOverlayResults');
        cancelAnimationFrame(rafId);
        trainer.render(performance.now());
    }

    function setArenaInteractive(active) {
        if (canvas) {
            canvas.style.pointerEvents = active ? 'auto' : 'none';
        }
    }

    function startCountdown() {
        if (phase !== 'idle') return;
        if (trainer && typeof trainer.warmupAudio === 'function') {
            trainer.warmupAudio();
        } else if (window.AbsAimSounds && trainer?.id !== 'vugich') {
            window.AbsAimSounds.warmupAudio();
        }
        phase = 'countdown';
        setArenaInteractive(false);
        showOverlay('aimOverlayCountdown');
        els.hud.showIdle();
        let n = 3;
        if (els.aimCountdownNum) els.aimCountdownNum.textContent = String(n);
        const tick = () => {
            n -= 1;
            if (n <= 0) {
                beginPlay();
                return;
            }
            if (els.aimCountdownNum) els.aimCountdownNum.textContent = String(n);
            setTimeout(tick, 700);
        };
        setTimeout(tick, 700);
    }

    function beginPlay() {
        phase = 'playing';
        showOverlay(null);
        setArenaInteractive(true);
        els.hud.show();
        els.hud.reset();
        trainer.start();
        loop();
    }

    function loop() {
        cancelAnimationFrame(rafId);
        const frame = (now) => {
            if (phase !== 'playing' || !trainer) return;
            trainer.update(now);
            if (trainer.isFinished()) {
                finishSession();
                return;
            }
            const remaining = trainer.getRemainingSec ? trainer.getRemainingSec() : null;
            if (remaining != null) {
                els.hud.setTime(remaining);
            } else if (trainer.id === 'reaction') {
                els.hud.setTime(remaining);
            }
            els.hud.setScore(trainer.getScore());
            const extra = trainer.getHudExtra ? trainer.getHudExtra(i18n()) : null;
            if (extra) {
                els.hud.setExtra(extra.label, extra.value);
            }
            trainer.render(now);
            rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
    }

    async function submitScore() {
        if (!lastResult || !trainer) return;
        const playerName = nick().getForSubmit();
        if (!nick().isValid(playerName)) {
            const msg = i18n().t('submitNeedNickname');
            if (els.aimSubmitNote) {
                els.aimSubmitNote.hidden = false;
                els.aimSubmitNote.textContent = msg;
            }
            if (window.SiteToast) window.SiteToast.show(msg, 'warn');
            return;
        }

        const api = window.ABS_AIM_API_SUBMIT || '/api/aim/submit.php';
        const headers = { 'Content-Type': 'application/json' };
        if (window.ABS_AIM_CSRF) {
            headers['X-CSRF-Token'] = window.ABS_AIM_CSRF;
        }

        try {
            const res = await fetch(api, {
                method: 'POST',
                credentials: 'same-origin',
                headers,
                body: JSON.stringify({
                    trainer: trainer.id,
                    player_name: playerName,
                    score: lastResult.score,
                    grade: lastResult.grade,
                    metrics: lastResult.metrics,
                    device: core().isMobileDevice() ? 'mobile' : 'desktop',
                }),
            });
            const data = await res.json();
            if (!data || !data.success) {
                const err = (data && data.error) || '';
                const msg = res.status === 429
                    ? i18n().t('rateLimited')
                    : (err || i18n().t('submitError'));
                if (els.aimSubmitNote) {
                    els.aimSubmitNote.hidden = false;
                    els.aimSubmitNote.textContent = msg;
                }
                if (window.SiteToast) window.SiteToast.show(msg, 'error');
                return;
            }
            setSubmitBtnSaved();
        } catch (e) {
            const msg = i18n().t('submitError');
            if (els.aimSubmitNote) {
                els.aimSubmitNote.hidden = false;
                els.aimSubmitNote.textContent = msg;
            }
            if (window.SiteToast) window.SiteToast.show(msg, 'error');
        }
    }

    function resetToIdle() {
        phase = 'idle';
        lastResult = null;
        setSubmitBtnDefault();
        els.hud.showIdle();
        showOverlay('aimOverlayIdle');
        setArenaInteractive(false);
        if (trainer) {
            trainer.stop();
            trainer.render(performance.now());
        }
    }

    function handleStageResize() {
        if (!canvas || !core()) return;
        const next = core().resizeCanvas(canvas);
        const changed = next.width !== size.width || next.height !== size.height;
        size = next;
        if (changed && trainer && trainer.resize) {
            trainer.resize(size);
        }
        if (trainer) {
            trainer.render(performance.now());
        }
    }

    function updatePlayLayout() {
        const root = document.documentElement;
        const mobile = core() && core().isMobileDevice();
        const landscape = window.matchMedia('(orientation: landscape)').matches;
        root.classList.toggle('aim-play-landscape', mobile && landscape);
        root.classList.toggle('aim-play-portrait', mobile && !landscape);
        if (els.hud && els.hud.refreshLayout) {
            els.hud.refreshLayout(phase);
        }
        handleStageResize();
    }

    function bindEvents() {
        if (els.aimOverlay) {
            els.aimOverlay.addEventListener('click', () => {
                if (phase === 'idle') {
                    startCountdown();
                }
            });
        }
        if (els.aimRetryBtn) {
            els.aimRetryBtn.addEventListener('click', resetToIdle);
        }
        if (els.aimSubmitBtn) {
            els.aimSubmitBtn.addEventListener('click', submitScore);
        }
        if (canvas) {
            const handleCanvasDown = (e) => {
                if (phase !== 'playing' || !trainer || !trainer.onPointerDown) {
                    return;
                }
                const now = performance.now();
                if (now - lastCanvasDownAt < 320) {
                    return;
                }
                lastCanvasDownAt = now;
                trainer.onPointerDown(e);
            };
            const mobileInput = () => core() && core().isMobileDevice();
            const handlePointerMove = (e) => {
                if (phase !== 'playing' || !trainer || !trainer.onPointerMove) {
                    return;
                }
                trainer.onPointerMove(e);
            };
            canvas.addEventListener('pointermove', (e) => {
                if (mobileInput()) {
                    return;
                }
                handlePointerMove(e);
            });
            canvas.addEventListener('pointerdown', (e) => {
                if (mobileInput()) {
                    return;
                }
                handleCanvasDown(e);
            });
            canvas.addEventListener('touchstart', (e) => {
                if (!mobileInput()) {
                    return;
                }
                if (phase !== 'playing' || !trainer) {
                    return;
                }
                e.preventDefault();
                handlePointerMove(e);
                if (trainer.onPointerDown) {
                    handleCanvasDown(e);
                }
            }, { passive: false });
            canvas.addEventListener('touchmove', (e) => {
                if (!mobileInput()) {
                    return;
                }
                if (phase !== 'playing' || !trainer) {
                    return;
                }
                e.preventDefault();
                handlePointerMove(e);
            }, { passive: false });
        }
        window.addEventListener('resize', updatePlayLayout);
        window.addEventListener('orientationchange', () => {
            window.setTimeout(updatePlayLayout, 150);
        });
        window.addEventListener('aim:devicechange', updatePlayLayout);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updatePlayLayout);
        }
        const stage = $('aimPlayStage');
        const viewport = $('aimPlayViewport');
        if (stage && typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => {
                handleStageResize();
            });
            observer.observe(stage);
            if (viewport) {
                observer.observe(viewport);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const trainerId = window.ABS_AIM_TRAINER;
        const factory = window.AbsAimTrainers && window.AbsAimTrainers[trainerId];
        if (!factory || !core()) return;

        canvas = $('aimCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        size = core().resizeCanvas(canvas);

        els.aimOverlay = $('aimOverlay');
        els.aimOverlayIdle = $('aimOverlayIdle');
        els.aimOverlayCountdown = $('aimOverlayCountdown');
        els.aimOverlayResults = $('aimOverlayResults');
        els.aimCountdownNum = $('aimCountdownNum');
        els.aimResultsScore = $('aimResultsScore');
        els.aimResultsGrade = $('aimResultsGrade');
        els.aimResultsMetrics = $('aimResultsMetrics');
        els.aimSubmitBtn = $('aimSubmitBtn');
        els.aimSubmitBtnLabel = els.aimSubmitBtn ? els.aimSubmitBtn.querySelector('[data-aim-i18n="submitScore"]') : null;
        els.aimRetryBtn = $('aimRetryBtn');
        els.aimSubmitNote = $('aimSubmitNote');
        els.hud = core().createHudController({
            durationSec: window.ABS_AIM_TRAINER_META && window.ABS_AIM_TRAINER_META.duration_sec,
        });

        if (window.AbsAimI18n) window.AbsAimI18n.applyDom();

        trainer = factory();
        trainer.init(canvas, ctx, size);
        trainer.render(performance.now());
        showOverlay('aimOverlayIdle');
        setArenaInteractive(false);
        els.hud.showIdle();
        bindEvents();
        updatePlayLayout();
    });

    function relocalizeView() {
        if (window.AbsAimI18n) {
            window.AbsAimI18n.applyDom();
        }

        const trainerId = window.ABS_AIM_TRAINER;
        const titleEl = $('aimPlayTitle');
        const descEl = $('aimPlayDesc');
        if (titleEl && trainerId) {
            titleEl.textContent = i18n().trainerLabel(trainerId);
        }
        if (descEl && trainerId) {
            descEl.textContent = i18n().trainerDesc(trainerId);
        }
        if (canvas && trainerId) {
            canvas.setAttribute('aria-label', i18n().trainerLabel(trainerId));
        }

        const hubHref = i18n().buildHubBase(i18n().getLang());
        document.querySelectorAll('.aim-back-link, a.aim-btn--ghost[href*="services/aim"]').forEach((link) => {
            link.setAttribute('href', hubHref);
        });

        if (phase === 'results' && lastResult) {
            setResults(lastResult.score, lastResult.grade, lastResult.metrics);
            if (submitSaved) {
                if (els.aimSubmitBtnLabel) {
                    els.aimSubmitBtnLabel.textContent = i18n().t('submitSaved');
                }
            }
        } else if (phase === 'playing' && trainer && trainer.getHudExtra) {
            const extra = trainer.getHudExtra(i18n());
            if (extra) {
                els.hud.setExtra(extra.label, extra.value);
            }
        }
    }

    window.AbsAimPlay = {
        relocalizeView,
    };
})();
