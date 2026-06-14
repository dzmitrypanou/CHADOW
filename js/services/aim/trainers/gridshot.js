(() => {
    'use strict';

    const { dist, rand, pointerPos } = window.AbsAimCore;

    function createGridshotTrainer() {
        const DURATION_SEC = 45;
        const TARGET_COUNT = 3;
        const sfx = (window.AbsAimSounds && window.AbsAimSounds.bindTrainer('gridshot')) || {
            warmupAudio() {}, start() {}, shot() {}, hit() {},
        };
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let hits = 0;
        let targets = [];
        let pointer = { x: 0, y: 0 };

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function spawnOne(index) {
            const margin = 40;
            const radius = 14;
            targets[index] = {
                x: rand(margin + radius, width - margin - radius),
                y: rand(margin + radius, height - margin - radius),
                radius,
            };
        }

        function spawnAll() {
            targets = [];
            for (let i = 0; i < TARGET_COUNT; i += 1) {
                spawnOne(i);
            }
        }

        function getScore() {
            return hits;
        }

        function getMetrics() {
            return {
                hits,
                targets_alive: targets.length,
            };
        }

        return {
            id: 'gridshot',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
            },
            resize(size) {
                if (size.width === width && size.height === height) {
                    return;
                }
                const oldW = width || size.width;
                const oldH = height || size.height;
                width = size.width;
                height = size.height;
                if (!targets.length || oldW <= 0 || oldH <= 0) {
                    return;
                }
                const margin = 40;
                const radius = 14;
                const minX = margin + radius;
                const minY = margin + radius;
                const maxX = width - margin - radius;
                const maxY = height - margin - radius;
                targets.forEach((t) => {
                    if (!t) return;
                    t.x = Math.min(maxX, Math.max(minX, (t.x / oldW) * width));
                    t.y = Math.min(maxY, Math.max(minY, (t.y / oldH) * height));
                });
            },
            warmupAudio: sfx.warmupAudio,
            start() {
                hits = 0;
                running = true;
                endAt = performance.now() + DURATION_SEC * 1000;
                spawnAll();
                sfx.start();
            },
            stop() {
                running = false;
            },
            destroy() {
                running = false;
                targets = [];
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
                if (!running) return;
                sfx.shot();
                const pos = pointerPos(canvas, event);
                for (let i = 0; i < targets.length; i += 1) {
                    const t = targets[i];
                    if (t && dist(pos.x, pos.y, t.x, t.y) <= t.radius) {
                        hits += 1;
                        sfx.hit();
                        spawnOne(i);
                        return;
                    }
                }
            },
            update() {
                if (running && remainingSec() <= 0) {
                    running = false;
                }
            },
            render() {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);
                targets.forEach((t) => {
                    if (!t) return;
                    window.AbsAimCore.drawTarget(
                        ctx,
                        t.x,
                        t.y,
                        t.radius,
                        'rgba(171, 71, 188, 0.9)',
                        'rgba(225, 190, 231, 0.9)'
                    );
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, t.radius * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    ctx.fill();
                });
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
    window.AbsAimTrainers.gridshot = createGridshotTrainer;
})();
