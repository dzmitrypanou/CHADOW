(() => {
    'use strict';

    const { dist, rand, clamp, pointerPos } = window.AbsAimCore;

    function createDuckhuntTrainer() {
        const DURATION_SEC = 60;
        const MAX_DUCKS = 8;
        const SPAWN_BASE_MS = 720;
        const SPAWN_MIN_MS = 300;
        const SLOW_DUCK_CHANCE = 0.12;

        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let startAt = 0;
        let ducks = [];
        let hits = 0;
        let misses = 0;
        let escaped = 0;
        let streak = 0;
        let bestStreak = 0;
        let pointer = { x: 0, y: 0 };
        let nextSpawnAt = 0;
        let lastUpdate = 0;

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function sessionProgress(now) {
            const elapsed = (now - startAt) / 1000;
            const t = clamp(elapsed / DURATION_SEC, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function spawnInterval(now) {
            const progress = sessionProgress(now);
            return SPAWN_BASE_MS - (SPAWN_BASE_MS - SPAWN_MIN_MS) * progress;
        }

        function duckSpeed(now) {
            const progress = sessionProgress(now);
            const mobile = window.AbsAimCore.isMobileDevice();
            if (Math.random() < SLOW_DUCK_CHANCE) {
                return rand(mobile ? 85 : 100, mobile ? 145 : 165);
            }
            return (rand(270, 390) + progress * 210) * (mobile ? 0.82 : 1);
        }

        function baseHitRadius() {
            return window.AbsAimCore.isMobileDevice() ? 28 : 26;
        }

        function mobileTapReach() {
            return 130;
        }

        function findDuckAt(pos) {
            const mobile = window.AbsAimCore.isMobileDevice();
            let bestIndex = -1;
            let bestDist = Infinity;
            for (let i = 0; i < ducks.length; i += 1) {
                const duck = ducks[i];
                if (!duck.alive) continue;
                const d = dist(pos.x, pos.y, duck.x, duck.y);
                const reach = mobile ? mobileTapReach() : duckHitRadius(duck);
                if (d <= reach && d < bestDist) {
                    bestDist = d;
                    bestIndex = i;
                }
            }
            return bestIndex;
        }

        function spawnDuck(now) {
            const fromLeft = Math.random() < 0.5;
            const dir = fromLeft ? 1 : -1;
            const marginY = 80;
            const laneY = rand(marginY, height - marginY);
            const speed = duckSpeed(now);
            const lift = rand(-55, 55);
            ducks.push({
                x: fromLeft ? -50 : width + 50,
                y: laneY,
                vx: dir * speed,
                vy: lift,
                wingPhase: rand(0, Math.PI * 2),
                hitRadius: baseHitRadius(),
                alive: true,
            });
        }

        function trySpawn(now) {
            if (ducks.length >= MAX_DUCKS || now < nextSpawnAt) {
                return;
            }
            spawnDuck(now);
            const progress = sessionProgress(now);
            if (ducks.length < MAX_DUCKS && Math.random() < 0.18 + progress * 0.22) {
                spawnDuck(now);
            }
            nextSpawnAt = now + spawnInterval(now) * rand(0.5, 0.9);
        }

        function duckHitRadius(duck) {
            return duck.hitRadius;
        }

        function getScore() {
            const streakBonus = Math.min(bestStreak, 20) * 12;
            return Math.max(0, hits * 100 - misses * 25 - escaped * 15 + streakBonus);
        }

        function getMetrics() {
            const total = hits + misses;
            return {
                hits,
                misses,
                escaped,
                best_streak: bestStreak,
                accuracy_pct: total > 0 ? Math.round((hits / total) * 100) : 0,
            };
        }

        function resizeDucks(oldW, oldH) {
            if (!ducks.length || oldW <= 0 || oldH <= 0) return;
            ducks.forEach((duck) => {
                duck.x = (duck.x / oldW) * width;
                duck.y = (duck.y / oldH) * height;
            });
        }

        function drawDuck(duck, now) {
            const flap = Math.sin((now / 120) + duck.wingPhase) * 0.35;
            const facing = duck.vx >= 0 ? 1 : -1;
            const bodyW = 34;
            const bodyH = 22;

            ctx.save();
            ctx.translate(duck.x, duck.y);
            ctx.scale(facing, 1);

            ctx.fillStyle = 'rgba(121, 85, 72, 0.95)';
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(139, 195, 74, 0.9)';
            ctx.beginPath();
            ctx.ellipse(-8, -6 - flap * 10, 16, 9, -0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-8, 6 + flap * 10, 16, 9, 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(109, 76, 65, 0.98)';
            ctx.beginPath();
            ctx.arc(24, -8, 11, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 193, 7, 0.95)';
            ctx.beginPath();
            ctx.moveTo(34, -8);
            ctx.lineTo(46, -5);
            ctx.lineTo(34, -2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(28, -11, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(29, -11, 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        return {
            id: 'duckhunt',
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
                resizeDucks(oldW, oldH);
            },
            start() {
                hits = 0;
                misses = 0;
                escaped = 0;
                streak = 0;
                bestStreak = 0;
                ducks = [];
                running = true;
                startAt = performance.now();
                lastUpdate = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                nextSpawnAt = startAt + 220;
            },
            stop() {
                running = false;
                ducks = [];
            },
            destroy() {
                running = false;
                ducks = [];
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
                const pos = pointerPos(canvas, event);
                const duckIndex = findDuckAt(pos);
                if (duckIndex >= 0) {
                    ducks.splice(duckIndex, 1);
                    hits += 1;
                    streak += 1;
                    bestStreak = Math.max(bestStreak, streak);
                    return;
                }
                if (!window.AbsAimCore.isMobileDevice()) {
                    misses += 1;
                    streak = 0;
                }
            },
            update(now) {
                if (!running) return;
                if (remainingSec() <= 0) {
                    running = false;
                    ducks = [];
                    return;
                }

                const dt = lastUpdate > 0 ? (now - lastUpdate) / 1000 : 0;
                lastUpdate = now;
                trySpawn(now);

                ducks = ducks.filter((duck) => {
                    duck.x += duck.vx * dt;
                    duck.y += duck.vy * dt;
                    duck.vy *= 0.985;
                    const offScreen = duck.vx > 0
                        ? duck.x > width + 70
                        : duck.x < -70;
                    if (offScreen) {
                        escaped += 1;
                        streak = 0;
                        return false;
                    }
                    return duck.alive;
                });
            },
            render(now) {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);
                if (!running) return;

                const ts = now || performance.now();
                ducks.forEach((duck) => {
                    drawDuck(duck, ts);
                });
                if (!window.AbsAimCore.isMobileDevice()) {
                    window.AbsAimCore.drawCrosshair(ctx, pointer.x, pointer.y);
                }
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
    window.AbsAimTrainers.duckhunt = createDuckhuntTrainer;
})();
