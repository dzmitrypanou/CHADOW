(() => {
    'use strict';

    const { dist, rand, randInt, clamp, pointerPos } = window.AbsAimCore;

    function createFlickTrainer() {
        const DURATION_SEC = 60;
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let target = null;
        let hits = 0;
        let misses = 0;
        let streak = 0;
        let bestStreak = 0;
        let pointer = { x: 0, y: 0 };

        function spawnTarget() {
            const margin = 48;
            const radius = rand(18, 28);
            target = {
                x: rand(margin + radius, width - margin - radius),
                y: rand(margin + radius, height - margin - radius),
                radius,
            };
        }

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function getScore() {
            const streakBonus = Math.min(bestStreak, 15) * 10;
            return Math.max(0, hits * 100 - misses * 30 + streakBonus);
        }

        function getMetrics() {
            const total = hits + misses;
            return {
                hits,
                misses,
                best_streak: bestStreak,
                accuracy_pct: total > 0 ? Math.round((hits / total) * 100) : 0,
            };
        }

        return {
            id: 'flick',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
            },
            resize(size) {
                width = size.width;
                height = size.height;
                if (target) spawnTarget();
            },
            start() {
                hits = 0;
                misses = 0;
                streak = 0;
                bestStreak = 0;
                running = true;
                endAt = performance.now() + DURATION_SEC * 1000;
                spawnTarget();
            },
            stop() {
                running = false;
            },
            destroy() {
                running = false;
                target = null;
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
            onPointerDown(event) {
                if (!running || !target) return;
                const pos = pointerPos(canvas, event);
                if (dist(pos.x, pos.y, target.x, target.y) <= target.radius) {
                    hits += 1;
                    streak += 1;
                    bestStreak = Math.max(bestStreak, streak);
                    spawnTarget();
                } else {
                    misses += 1;
                    streak = 0;
                }
            },
            update() {
                if (!running) return;
                if (remainingSec() <= 0) {
                    running = false;
                }
            },
            render() {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);
                if (target) {
                    window.AbsAimCore.drawTarget(
                        ctx,
                        target.x,
                        target.y,
                        target.radius,
                        'rgba(239, 83, 80, 0.9)',
                        'rgba(255, 205, 210, 0.9)'
                    );
                    ctx.beginPath();
                    ctx.arc(target.x, target.y, target.radius * 0.45, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.fill();
                }
                window.AbsAimCore.drawCrosshair(ctx, pointer.x, pointer.y);
            },
            getHudExtra(i18n) {
                return {
                    label: i18n.t('hits'),
                    value: String(hits),
                };
            },
        };
    }

    window.AbsAimTrainers = window.AbsAimTrainers || {};
    window.AbsAimTrainers.flick = createFlickTrainer;
})();
