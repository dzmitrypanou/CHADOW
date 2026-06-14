(() => {
    'use strict';

    const { dist, pointerPos } = window.AbsAimCore;

    function createTrackingTrainer() {
        const DURATION_SEC = 30;
        const sfx = (window.AbsAimSounds && window.AbsAimSounds.bindTrainer('tracking')) || {
            warmupAudio() {}, start() {}, lockOn() {},
        };
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let startAt = 0;
        let onTargetMs = 0;
        let lastTick = 0;
        let pointer = { x: 0, y: 0 };
        const TARGET_RADIUS = 42;
        let target = { x: 0, y: 0 };
        let wasOnTarget = false;
        let lastLockSfxAt = 0;

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function updateTarget(now) {
            const t = (now - startAt) / 1000;
            const margin = 60;
            target.x = width / 2 + Math.sin(t * 1.15) * (width / 2 - margin);
            target.y = height / 2 + Math.sin(t * 1.7 + 1.2) * (height / 2 - margin);
        }

        function getScore() {
            const totalMs = running
                ? Math.max(1, performance.now() - startAt)
                : DURATION_SEC * 1000;
            const pct = clampPct(onTargetMs / totalMs);
            return Math.round(pct * 1000);
        }

        function clampPct(v) {
            return Math.min(1, Math.max(0, v));
        }

        function getMetrics() {
            const totalMs = DURATION_SEC * 1000;
            const pct = Math.round(clampPct(onTargetMs / totalMs) * 100);
            return {
                on_target_pct: pct,
                on_target_ms: Math.round(onTargetMs),
            };
        }

        return {
            id: 'tracking',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
                target = { x: width / 2, y: height / 2 };
            },
            resize(size) {
                width = size.width;
                height = size.height;
            },
            warmupAudio: sfx.warmupAudio,
            start() {
                onTargetMs = 0;
                running = true;
                startAt = performance.now();
                lastTick = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                wasOnTarget = false;
                sfx.start();
            },
            stop() {
                running = false;
            },
            destroy() {
                running = false;
            },
            isFinished() {
                return endAt > 0 && remainingSec() <= 0;
            },
            getScore,
            getMetrics,
            getRemainingSec: remainingSec,
            onPointerMove(event) {
                pointer = pointerPos(canvas, event);
            },
            onPointerDown() {},
            update(now) {
                if (!running) return;
                if (remainingSec() <= 0) {
                    running = false;
                    return;
                }
                const dt = now - lastTick;
                lastTick = now;
                updateTarget(now);
                const onTarget = dist(pointer.x, pointer.y, target.x, target.y) <= TARGET_RADIUS;
                if (onTarget && !wasOnTarget && now - lastLockSfxAt > 220) {
                    sfx.lockOn();
                    lastLockSfxAt = now;
                }
                wasOnTarget = onTarget;
                if (onTarget) {
                    onTargetMs += dt;
                }
            },
            render(now) {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);
                if (!running) return;

                updateTarget(now || performance.now());

                ctx.save();
                ctx.beginPath();
                ctx.arc(target.x, target.y, TARGET_RADIUS, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(76, 175, 80, 0.55)';
                ctx.lineWidth = 3;
                ctx.stroke();
                window.AbsAimCore.drawTarget(
                    ctx,
                    target.x,
                    target.y,
                    16,
                    'rgba(76, 175, 80, 0.9)',
                    'rgba(200, 230, 201, 0.9)'
                );
                ctx.restore();

                const onTarget = dist(pointer.x, pointer.y, target.x, target.y) <= TARGET_RADIUS;
                window.AbsAimCore.drawCrosshair(
                    ctx,
                    pointer.x,
                    pointer.y,
                    onTarget ? 'rgba(76, 175, 80, 0.95)' : 'rgba(100, 181, 246, 0.9)'
                );
            },
            getHudExtra(i18n) {
                const totalMs = Math.max(1, performance.now() - (startAt || performance.now()));
                const pct = Math.round(clampPct(onTargetMs / totalMs) * 100);
                return {
                    label: i18n.t('onTarget'),
                    value: pct + i18n.t('metricPct'),
                };
            },
        };
    }

    window.AbsAimTrainers = window.AbsAimTrainers || {};
    window.AbsAimTrainers.tracking = createTrackingTrainer;
})();
