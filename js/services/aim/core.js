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

    function pointerPos(canvas, event) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return { x: 0, y: 0 };
        }
        const logicalW = Number(canvas.dataset.aimLogicalWidth) || AIM_ARENA_WIDTH;
        const logicalH = Number(canvas.dataset.aimLogicalHeight) || AIM_ARENA_HEIGHT;
        return {
            x: (event.clientX - rect.left) * (logicalW / rect.width),
            y: (event.clientY - rect.top) * (logicalH / rect.height),
        };
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
        createHudController(options) {
            const hudTime = document.getElementById('aimHudTime');
            const hudScore = document.getElementById('aimHudScore');
            const hudExtraWrap = document.getElementById('aimHudExtraWrap');
            const hudExtraLabel = document.getElementById('aimHudExtraLabel');
            const hudExtra = document.getElementById('aimHudExtra');
            const hud = document.getElementById('aimHud');

            return {
                show() {
                    if (hud) hud.hidden = false;
                },
                hide() {
                    if (hud) hud.hidden = true;
                },
                setTime(sec) {
                    if (hudTime) hudTime.textContent = formatTime(sec);
                },
                setScore(value) {
                    if (hudScore) hudScore.textContent = String(Math.round(value));
                },
                setExtra(label, value) {
                    if (!hudExtraWrap || !hudExtraLabel || !hudExtra) return;
                    if (label == null) {
                        hudExtraWrap.hidden = true;
                        return;
                    }
                    hudExtraWrap.hidden = false;
                    hudExtraLabel.textContent = label;
                    hudExtra.textContent = value;
                },
                reset() {
                    this.setTime(options.durationSec || '—');
                    this.setScore(0);
                    this.setExtra(null);
                },
            };
        },
        resizeCanvas(canvas) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = AIM_ARENA_WIDTH;
            const h = AIM_ARENA_HEIGHT;
            canvas.width = Math.max(1, Math.floor(w * dpr));
            canvas.height = Math.max(1, Math.floor(h * dpr));
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.dataset.aimLogicalWidth = String(w);
            canvas.dataset.aimLogicalHeight = String(h);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
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
})();
