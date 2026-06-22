(() => {
    'use strict';

    const { dist, rand, clamp, pointerPos } = window.AbsAimCore;

    function createDuckhuntTrainer() {
        const DURATION_SEC = 60;
        const MAX_DUCKS = 8;
        const SPAWN_BASE_MS = 720;
        const SPAWN_MIN_MS = 300;
        const SLOW_DUCK_CHANCE = 0.12;
        const AUDIO_V = '?v=2';
        const BGM_SRC = `/assets/aim/duckhunt-bgm.mp3${AUDIO_V}`;
        const SHOT_SRC = `/assets/aim/duckhunt-shotgun.mp3${AUDIO_V}`;
        const QUACK_SRC = `/assets/aim/duckhunt-quack.mp3${AUDIO_V}`;
        const BGM_VOLUME = 0.42;
        const SFX_VOLUME = 0.72;

        function aimVol(base) {
            return window.AbsAimVolume ? window.AbsAimVolume.apply(base) : base;
        }

        function syncBgmVolume() {
            if (bgmAudio) {
                bgmAudio.volume = aimVol(BGM_VOLUME);
            }
        }

        let volumeListenerBound = false;
        function bindVolumeListener() {
            if (volumeListenerBound) {
                return;
            }
            volumeListenerBound = true;
            window.addEventListener('aim:volumechange', syncBgmVolume);
        }

        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let startAt = 0;
        let ducks = [];
        let trees = [];
        let clouds = [];
        let bushes = [];
        let hits = 0;
        let pointsScored = 0;
        let misses = 0;
        let escaped = 0;
        let streak = 0;
        let bestStreak = 0;
        let pointer = { x: 0, y: 0 };
        let nextSpawnAt = 0;
        let lastUpdate = 0;

        let bgmAudio = null;
        let sfxPools = {};
        let audioUnlocked = false;

        function ensureAudio(src) {
            if (!sfxPools[src]) {
                const audio = new Audio(src);
                audio.preload = 'auto';
                sfxPools[src] = audio;
            }
            return sfxPools[src];
        }

        function ensureBgm() {
            if (!bgmAudio) {
                bgmAudio = new Audio(BGM_SRC);
                bgmAudio.preload = 'auto';
            }
            return bgmAudio;
        }

        function unlockAudio(audio) {
            const prevVolume = audio.volume;
            audio.volume = 0.001;
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (!playPromise || typeof playPromise.then !== 'function') {
                audio.volume = prevVolume || 1;
                return;
            }
            playPromise.then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = prevVolume || 1;
            }).catch(() => {
                audio.volume = prevVolume || 1;
            });
        }

        function playSfx(src, volume = SFX_VOLUME) {
            if (!audioUnlocked) return;
            const scaled = aimVol(volume);
            try {
                const audio = ensureAudio(src);
                if (!audio.paused && audio.currentTime > 0 && !audio.ended) {
                    const clone = new Audio(src);
                    clone.volume = scaled;
                    clone.play().catch(() => {});
                    return;
                }
                audio.volume = scaled;
                audio.currentTime = 0;
                audio.play().catch(() => {});
            } catch (e) {

            }
        }

        function warmupAudio() {
            if (audioUnlocked) return;
            unlockAudio(ensureBgm());
            unlockAudio(ensureAudio(SHOT_SRC));
            unlockAudio(ensureAudio(QUACK_SRC));
            audioUnlocked = true;
        }

        function startBgm() {
            bindVolumeListener();
            const audio = ensureBgm();
            audio.loop = true;
            audio.volume = aimVol(BGM_VOLUME);
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }

        function stopBgm() {
            if (!bgmAudio) return;
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        }

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

        function duckScale(duck) {
            return 0.55 + duck.z * 0.55;
        }

        function duckHitRadius(duck) {
            return baseHitRadius() * duckScale(duck);
        }

        function duckPoints(duck) {
            const scale = duckScale(duck);
            const minScale = 0.55 + 0.28 * 0.55;
            const maxScale = 0.55 + 0.92 * 0.55;
            const t = clamp((scale - minScale) / (maxScale - minScale), 0, 1);
            return Math.round(170 - t * 95);
        }

        function horizonY() {
            return height * 0.58;
        }

        function buildScenery() {
            trees = [];
            const slots = [0.06, 0.18, 0.31, 0.44, 0.57, 0.69, 0.82, 0.94];
            slots.forEach((nx, index) => {
                const z = index % 2 === 0
                    ? rand(0.22, 0.48)
                    : rand(0.62, 0.88);
                trees.push({
                    x: nx * width + rand(-18, 18),
                    z,
                    scale: rand(0.75, 1.15),
                    variant: index % 3,
                });
            });

            clouds = [];
            const cloudCount = Math.max(3, Math.floor(width / 320));
            for (let i = 0; i < cloudCount; i += 1) {
                clouds.push({
                    x: rand(0, width),
                    y: rand(height * 0.06, height * 0.28),
                    scale: rand(0.7, 1.25),
                    speed: rand(8, 18),
                });
            }

            bushes = [];
            for (let i = 0; i < 12; i += 1) {
                bushes.push({
                    x: (i + 0.5) * (width / 12),
                    yOffset: rand(18, Math.max(24, height * 0.28)),
                    rx: rand(16, 28),
                    ry: rand(8, 14),
                });
            }
        }

        function findDuckAt(pos) {
            const mobile = window.AbsAimCore.isMobileDevice();
            let bestIndex = -1;
            let bestDist = Infinity;
            for (let i = ducks.length - 1; i >= 0; i -= 1) {
                const duck = ducks[i];
                if (!duck.alive) continue;
                const d = dist(pos.x, pos.y, duck.x, duck.y);
                const reach = mobile ? mobileTapReach() * duckScale(duck) : duckHitRadius(duck);
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
            const z = rand(0.28, 0.92);
            const skyTop = height * 0.1;
            const skyBottom = height * 0.52;
            ducks.push({
                x: fromLeft ? -50 : width + 50,
                y: rand(skyTop, skyBottom),
                z,
                vx: dir * duckSpeed(now),
                vy: rand(-45, 45),
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

        function getScore() {
            const streakBonus = Math.min(bestStreak, 20) * 12;
            return Math.max(0, pointsScored - misses * 25 - escaped * 15 + streakBonus);
        }

        function getMetrics() {
            const total = hits + misses;
            return {
                hits,
                points_scored: pointsScored,
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

        function drawSky() {
            const horizon = horizonY();
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, '#3d8fd9');
            grad.addColorStop(0.45, '#79c3f2');
            grad.addColorStop(0.72, '#a8dafb');
            grad.addColorStop(0.82, '#7ec850');
            grad.addColorStop(1, '#2f7d28');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            clouds.forEach((cloud) => {
                const s = cloud.scale;
                ctx.beginPath();
                ctx.arc(cloud.x, cloud.y, 26 * s, 0, Math.PI * 2);
                ctx.arc(cloud.x + 22 * s, cloud.y - 8 * s, 20 * s, 0, Math.PI * 2);
                ctx.arc(cloud.x + 40 * s, cloud.y, 24 * s, 0, Math.PI * 2);
                ctx.arc(cloud.x + 18 * s, cloud.y + 8 * s, 18 * s, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        function drawMeadow() {
            const horizon = horizonY();
            const meadowGrad = ctx.createLinearGradient(0, horizon, 0, height);
            meadowGrad.addColorStop(0, '#6fbf45');
            meadowGrad.addColorStop(0.35, '#4fa632');
            meadowGrad.addColorStop(1, '#357a24');
            ctx.fillStyle = meadowGrad;
            ctx.fillRect(0, horizon, width, height - horizon);

            ctx.strokeStyle = 'rgba(45, 100, 30, 0.25)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 7; i += 1) {
                const y = horizon + ((height - horizon) / 7) * (i + 1);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(53, 122, 36, 0.35)';
            bushes.forEach((bush) => {
                ctx.beginPath();
                ctx.ellipse(bush.x, horizon + bush.yOffset, bush.rx, bush.ry, 0, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        function drawTree(tree) {
            const baseY = horizonY() + height * (0.04 + tree.z * 0.08);
            const s = tree.scale * (0.55 + tree.z * 0.65);
            const trunkW = 12 * s;
            const trunkH = 48 * s;
            const crownR = 36 * s;

            ctx.save();
            ctx.translate(tree.x, baseY);

            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);

            const greens = ['#2e7d32', '#388e3c', '#43a047'];
            ctx.fillStyle = greens[tree.variant % greens.length];
            ctx.beginPath();
            ctx.arc(0, -trunkH - crownR * 0.35, crownR, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-crownR * 0.45, -trunkH - crownR * 0.1, crownR * 0.78, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(crownR * 0.42, -trunkH - crownR * 0.15, crownR * 0.72, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        function drawDuck(duck, now) {
            const flap = Math.sin((now / 120) + duck.wingPhase) * 0.35;
            const facing = duck.vx >= 0 ? 1 : -1;
            const scale = duckScale(duck);
            const bodyW = 34 * scale;
            const bodyH = 22 * scale;

            ctx.save();
            ctx.translate(duck.x, duck.y);
            ctx.scale(facing * scale, scale);

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

        function updateClouds(dt) {
            clouds.forEach((cloud) => {
                cloud.x += cloud.speed * dt;
                if (cloud.x > width + 80) {
                    cloud.x = -80;
                    cloud.y = rand(height * 0.06, height * 0.28);
                }
            });
        }

        function drawDuckHuntScope(x, y) {
            const ring = 34;
            const tickStart = ring - 11;
            const tickLen = 9;

            ctx.save();

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(x, y, ring + 1, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, ring, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(198, 40, 40, 0.98)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x, y, ring * 0.58, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
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

            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff5252';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 1.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        function renderScene(now) {
            drawSky();
            drawMeadow();

            const drawables = [];
            trees.forEach((tree) => drawables.push({ kind: 'tree', z: tree.z, data: tree }));
            ducks.forEach((duck) => drawables.push({ kind: 'duck', z: duck.z, data: duck }));
            drawables.sort((a, b) => a.z - b.z);
            drawables.forEach((item) => {
                if (item.kind === 'tree') {
                    drawTree(item.data);
                } else {
                    drawDuck(item.data, now);
                }
            });
        }

        return {
            id: 'duckhunt',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
                buildScenery();
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
                buildScenery();
            },
            warmupAudio,
            start() {
                hits = 0;
                pointsScored = 0;
                misses = 0;
                escaped = 0;
                streak = 0;
                bestStreak = 0;
                ducks = [];
                pointer = { x: width * 0.5, y: height * 0.5 };
                running = true;
                startAt = performance.now();
                lastUpdate = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                nextSpawnAt = startAt + 220;
                buildScenery();
                startBgm();
            },
            stop() {
                running = false;
                ducks = [];
                stopBgm();
            },
            destroy() {
                running = false;
                ducks = [];
                stopBgm();
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
                playSfx(SHOT_SRC, 0.85);
                const pos = pointerPos(canvas, event);
                const duckIndex = findDuckAt(pos);
                if (duckIndex >= 0) {
                    const duck = ducks[duckIndex];
                    pointsScored += duckPoints(duck);
                    ducks.splice(duckIndex, 1);
                    hits += 1;
                    streak += 1;
                    bestStreak = Math.max(bestStreak, streak);
                    playSfx(QUACK_SRC, 0.9);
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
                    stopBgm();
                    return;
                }

                const dt = lastUpdate > 0 ? (now - lastUpdate) / 1000 : 0;
                lastUpdate = now;
                updateClouds(dt);
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
                const ts = now || performance.now();
                renderScene(ts);
                if (running && !window.AbsAimCore.isMobileDevice()) {
                    drawDuckHuntScope(pointer.x, pointer.y);
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
