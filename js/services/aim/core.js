(() => {
    'use strict';

    function computeGrade(score, thresholds) {
        const order = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];
        for (let i = 0; i < order.length; i += 1) {
            const grade = order[i];
            if (score >= (thresholds[grade] || 0)) {
                return grade;
            }
        }
        return 'D';
    }

    function formatTime(sec) {
        if (sec == null || Number.isNaN(sec)) {
            return '—';
        }
        const s = Math.max(0, Math.ceil(sec));
        return String(s);
    }

    const AIM_ARENA_WIDTH = 1280;
    const AIM_ARENA_HEIGHT = 720;

    function eventClientPos(event) {
        if (event.touches && event.touches.length > 0) {
            return {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
            };
        }
        if (event.changedTouches && event.changedTouches.length > 0) {
            return {
                x: event.changedTouches[0].clientX,
                y: event.changedTouches[0].clientY,
            };
        }
        return {
            x: event.clientX,
            y: event.clientY,
        };
    }

    function pointerPos(canvas, event) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return { x: 0, y: 0 };
        }
        const logicalW = Number(canvas.dataset.aimLogicalWidth) || AIM_ARENA_WIDTH;
        const logicalH = Number(canvas.dataset.aimLogicalHeight) || AIM_ARENA_HEIGHT;
        const client = eventClientPos(event);
        return {
            x: (client.x - rect.left) * (logicalW / rect.width),
            y: (client.y - rect.top) * (logicalH / rect.height),
        };
    }

    let mobileDeviceCache = null;
    let mobileDeviceCacheKey = '';

    function viewportShortSide() {
        const w = window.innerWidth || 0;
        const h = window.innerHeight || 0;
        const sw = (window.screen && window.screen.width) || w;
        const sh = (window.screen && window.screen.height) || h;
        return Math.min(w, h, sw, sh);
    }

    function viewportCacheKey() {
        return [
            window.innerWidth,
            window.innerHeight,
            window.screen && window.screen.width,
            window.screen && window.screen.height,
            window.matchMedia('(orientation: landscape)').matches ? 'l' : 'p',
        ].join(':');
    }

    function isMobileDevice() {
        if (typeof window === 'undefined') {
            return false;
        }
        const cacheKey = viewportCacheKey();
        if (mobileDeviceCache !== null && mobileDeviceCacheKey === cacheKey) {
            return mobileDeviceCache;
        }

        const ua = navigator.userAgent || '';
        const shortSide = viewportShortSide();
        let mobile = false;

        if (navigator.userAgentData && navigator.userAgentData.mobile === true) {
            mobile = true;
        } else if (/iPhone|iPod/i.test(ua)) {
            mobile = true;
        } else if (/Android/i.test(ua)) {
            mobile = /Mobile/i.test(ua) || shortSide <= 940;
        } else if (/Windows Phone|IEMobile|Opera Mini|webOS|BlackBerry/i.test(ua)) {
            mobile = true;
        } else if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            mobile = shortSide <= 900;
        } else {
            const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
            const touchPoints = navigator.maxTouchPoints || 0;
            const noHover = window.matchMedia('(hover: none)').matches;
            mobile = (coarsePointer && shortSide <= 1024)
                || (noHover && touchPoints > 0 && shortSide <= 940);
        }

        mobileDeviceCache = mobile;
        mobileDeviceCacheKey = cacheKey;
        return mobile;
    }

    function applyDeviceClasses() {
        if (typeof document === 'undefined') {
            return isMobileDevice();
        }
        const mobile = isMobileDevice();
        document.documentElement.classList.toggle('aim-device-mobile', mobile);
        document.documentElement.classList.toggle('aim-device-desktop', !mobile);
        return mobile;
    }

    let lastMobileState = null;

    function refreshDeviceDetection() {
        mobileDeviceCache = null;
        mobileDeviceCacheKey = '';
        const mobile = applyDeviceClasses();
        if (lastMobileState === mobile) {
            return;
        }
        lastMobileState = mobile;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aim:devicechange'));
        }
    }

    function dist(ax, ay, bx, by) {
        const dx = ax - bx;
        const dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function randInt(min, max) {
        return Math.floor(rand(min, max + 1));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function isTouchInput() {
        if (isMobileDevice()) {
            return true;
        }
        return typeof window !== 'undefined'
            && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }

    /** Multiplier for target radii on touch screens. */
    function touchTargetScale() {
        return isTouchInput() ? 1.75 : 1;
    }

    /** Extra hit padding (logical px) for tap detection. */
    function touchHitSlop() {
        return isTouchInput() ? 14 : 0;
    }

    window.AbsAimCore = {
        AIM_ARENA_WIDTH,
        AIM_ARENA_HEIGHT,
        computeGrade,
        formatTime,
        pointerPos,
        dist,
        rand,
        randInt,
        clamp,
        isMobileDevice,
        isTouchInput,
        touchTargetScale,
        touchHitSlop,
        applyDeviceClasses,
        refreshDeviceDetection,
        shouldShowCrosshair() {
            return !isMobileDevice();
        },
        createHudController(options) {
            const hudTime = document.getElementById('aimHudTime');
            const hudScore = document.getElementById('aimHudScore');
            const hudExtraWrap = document.getElementById('aimHudExtraWrap');
            const hudExtraLabel = document.getElementById('aimHudExtraLabel');
            const hudExtra = document.getElementById('aimHudExtra');
            const hud = document.getElementById('aimHud');
            const hudSide = document.getElementById('aimPlaySideHud');
            const hudSideTime = document.getElementById('aimHudSideTime');
            const hudSideScore = document.getElementById('aimHudSideScore');
            const hudSideExtraWrap = document.getElementById('aimHudSideExtraWrap');
            const hudSideExtraLabel = document.getElementById('aimHudSideExtraLabel');
            const hudSideExtra = document.getElementById('aimHudSideExtra');

            function useSideHud() {
                return isMobileDevice()
                    && window.matchMedia('(orientation: landscape)').matches;
            }

            function applyBaselineValues() {
                this.setTime(options.durationSec || '—');
                this.setScore(0);
                this.setExtra(null);
            }

            return {
                showIdle() {
                    applyBaselineValues.call(this);
                    const side = useSideHud();
                    const mobile = isMobileDevice();
                    if (hud) {
                        hud.hidden = side || !mobile;
                    }
                    if (hudSide) {
                        const showSide = side;
                        hudSide.hidden = !showSide;
                        hudSide.setAttribute('aria-hidden', showSide ? 'false' : 'true');
                    }
                },
                show() {
                    const side = useSideHud();
                    if (hud) {
                        hud.hidden = side;
                    }
                    if (hudSide) {
                        hudSide.hidden = !side;
                        hudSide.setAttribute('aria-hidden', side ? 'false' : 'true');
                    }
                },
                hide() {
                    if (hud) {
                        hud.hidden = true;
                    }
                    if (hudSide) {
                        hudSide.hidden = true;
                        hudSide.setAttribute('aria-hidden', 'true');
                    }
                },
                setTime(sec) {
                    const text = formatTime(sec);
                    if (hudTime) hudTime.textContent = text;
                    if (hudSideTime) hudSideTime.textContent = text;
                },
                setScore(value) {
                    const text = String(Math.round(value));
                    if (hudScore) hudScore.textContent = text;
                    if (hudSideScore) hudSideScore.textContent = text;
                },
                setExtra(label, value) {
                    const pairs = [
                        [hudExtraWrap, hudExtraLabel, hudExtra],
                        [hudSideExtraWrap, hudSideExtraLabel, hudSideExtra],
                    ];
                    pairs.forEach(([wrap, labelEl, valueEl]) => {
                        if (!wrap || !labelEl || !valueEl) return;
                        if (label == null) {
                            wrap.hidden = true;
                            return;
                        }
                        wrap.hidden = false;
                        labelEl.textContent = label;
                        valueEl.textContent = value;
                    });
                },
                reset() {
                    applyBaselineValues.call(this);
                },
                refreshLayout(phase) {
                    if (phase === 'playing') {
                        this.show();
                    } else if (phase === 'results') {
                        this.hide();
                    } else {
                        this.showIdle();
                    }
                },
            };
        },
        resizeCanvas(canvas) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = AIM_ARENA_WIDTH;
            const h = AIM_ARENA_HEIGHT;
            const pixelW = Math.max(1, Math.floor(w * dpr));
            const pixelH = Math.max(1, Math.floor(h * dpr));
            const ctx = canvas.getContext('2d');
            if (canvas.width !== pixelW || canvas.height !== pixelH) {
                canvas.width = pixelW;
                canvas.height = pixelH;
                if (ctx) {
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            }
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.dataset.aimLogicalWidth = String(w);
            canvas.dataset.aimLogicalHeight = String(h);
            return { width: w, height: h, dpr };
        },
        drawCrosshair(ctx, x, y, color) {
            const size = 12;
            ctx.save();
            ctx.strokeStyle = color || 'rgba(100, 181, 246, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - size, y);
            ctx.lineTo(x + size, y);
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y + size);
            ctx.stroke();
            ctx.restore();
        },
        drawScope(ctx, x, y, color) {
            const ring = 28;
            const tickStart = ring - 9;
            const tickLen = 7;
            const stroke = color || 'rgba(139, 195, 74, 0.92)';
            const dot = color || 'rgba(255, 235, 59, 0.98)';

            ctx.save();
            ctx.strokeStyle = stroke;
            ctx.fillStyle = dot;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(x, y, ring, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(x, y, ring * 0.62, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.beginPath();
            ctx.moveTo(x, y - tickStart);
            ctx.lineTo(x, y - tickStart + tickLen);
            ctx.moveTo(x, y + tickStart);
            ctx.lineTo(x, y + tickStart - tickLen);
            ctx.moveTo(x - tickStart, y);
            ctx.lineTo(x - tickStart + tickLen, y);
            ctx.moveTo(x + tickStart, y);
            ctx.lineTo(x + tickStart - tickLen, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        },
        drawTarget(ctx, x, y, radius, fill, stroke) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = fill || 'rgba(239, 83, 80, 0.85)';
            ctx.fill();
            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.restore();
        },
        clearArena(ctx, width, height) {
            ctx.fillStyle = 'rgba(8, 14, 28, 0.92)';
            ctx.fillRect(0, 0, width, height);
            ctx.strokeStyle = 'rgba(113, 163, 230, 0.15)';
            ctx.lineWidth = 1;
            const step = 40;
            for (let x = 0; x <= width; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        },
    };

    if (typeof document !== 'undefined') {
        const initDeviceState = () => {
            lastMobileState = applyDeviceClasses();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initDeviceState);
        } else {
            initDeviceState();
        }
        let resizeTimer = 0;
        const scheduleRefresh = () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(refreshDeviceDetection, 120);
        };
        window.addEventListener('orientationchange', scheduleRefresh);
        window.addEventListener('resize', scheduleRefresh);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', scheduleRefresh);
        }
    }
})();
