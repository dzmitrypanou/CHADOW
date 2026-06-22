(() => {
    'use strict';

    const { dist, rand, randInt, clamp, pointerPos } = window.AbsAimCore;

    function createVugichTrainer() {
        const DURATION_SEC = 60;
        const MAX_TANKS = 10;
        const SPAWN_BASE_MS = 680;
        const SPAWN_MIN_MS = 280;
        const SLOW_TANK_CHANCE = 0.14;
        const LANE_COUNT = 4;
        const LANE_MARGIN_TOP = 72;
        const LANE_MARGIN_BOTTOM = 72;
        const SIGHT_IMAGE_SRC = '/assets/aim/vugich-sight.png?v=4';
        const AUDIO_V = '?v=4';
        const BGM_SRC = `/assets/aim/vugich.m4a${AUDIO_V}`;
        const SFX_SHOT_SRC = `/assets/aim/wot_bigboom_in.mp3${AUDIO_V}`;
        const SFX_MISS_SRC = `/assets/aim/ne-probil.mp3${AUDIO_V}`;
        const SFX_HIT_SRC = `/assets/aim/tank-unichtozhen.mp3${AUDIO_V}`;
        const SFX_BATTLE_START_SRC = `/assets/aim/wot-boi-nachinaetsia.mp3${AUDIO_V}`;
        const SFX_SRCS = [SFX_SHOT_SRC, SFX_MISS_SRC, SFX_HIT_SRC, SFX_BATTLE_START_SRC];
        const BGM_VOLUME = 0.825;
        const SFX_VOLUME = 0.07;

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
        const SIGHT_SCALE = 0.5;
        const SHAKE_MULT = 2.5;
        const TANK_SEPARATION = 88;
        const ORBIT_SLOTS = [
            { cx: 0.24, cy: 0.34, r: 0.11 },
            { cx: 0.76, cy: 0.34, r: 0.11 },
            { cx: 0.24, cy: 0.66, r: 0.11 },
            { cx: 0.76, cy: 0.66, r: 0.11 },
            { cx: 0.5, cy: 0.5, r: 0.075 },
        ];

        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let startAt = 0;
        let tanks = [];
        let explosions = [];
        let fieldDecor = [];
        let hits = 0;
        let misses = 0;
        let escaped = 0;
        let streak = 0;
        let bestStreak = 0;
        let pointer = { x: 0, y: 0 };
        let rawPointer = { x: 0, y: 0 };
        let nextSpawnAt = 0;
        let lastUpdate = 0;
        let shake = { x: 0, y: 0 };
        let shakeTime = 0;
        let cursorShakeLast = 0;
        let sightImage = null;
        let sightImageReady = false;
        let bgmAudio = null;
        let bgmUnlocked = false;
        let audioCtx = null;
        const sfxBuffers = {};
        const sfxLoadPromises = {};
        const sfxHtml5Pools = {};
        let lanes = [];
        let laneHeight = 0;
        let yMin = 0;
        let yMax = 0;

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function sessionProgress(now) {
            if (!running || startAt <= 0) {
                return 0;
            }
            const elapsed = (now - startAt) / 1000;
            const t = clamp(elapsed / DURATION_SEC, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function rebuildLanes() {
            const usable = Math.max(0, height - LANE_MARGIN_TOP - LANE_MARGIN_BOTTOM);
            laneHeight = usable / LANE_COUNT;
            lanes = [];
            for (let i = 0; i < LANE_COUNT; i += 1) {
                lanes.push(LANE_MARGIN_TOP + (i + 0.5) * laneHeight);
            }
            yMin = LANE_MARGIN_TOP + 24;
            yMax = height - LANE_MARGIN_BOTTOM - 24;
        }

        function buildFieldDecor() {
            fieldDecor = [];

            for (let i = 0; i < 140; i += 1) {
                fieldDecor.push({
                    type: 'grass',
                    x: rand(0, width),
                    y: rand(LANE_MARGIN_TOP, height - LANE_MARGIN_BOTTOM),
                    w: rand(2, 5),
                    h: rand(4, 9),
                    rot: rand(-0.4, 0.4),
                    color: `rgba(${randInt(52, 78)}, ${randInt(88, 118)}, ${randInt(38, 58)}, ${rand(0.15, 0.35)})`,
                });
            }

            for (let i = 0; i < 18; i += 1) {
                fieldDecor.push({
                    type: 'crater',
                    x: rand(width * 0.05, width * 0.95),
                    y: rand(LANE_MARGIN_TOP + 10, height - LANE_MARGIN_BOTTOM - 10),
                    rx: rand(22, 48),
                    ry: rand(12, 26),
                });
            }

            for (let i = 0; i < 24; i += 1) {
                fieldDecor.push({
                    type: 'rock',
                    x: rand(0, width),
                    y: rand(LANE_MARGIN_TOP, height - LANE_MARGIN_BOTTOM),
                    r: rand(4, 11),
                });
            }

            for (let i = 0; i < 10; i += 1) {
                fieldDecor.push({
                    type: 'scorch',
                    x: rand(0, width),
                    y: rand(LANE_MARGIN_TOP, height - LANE_MARGIN_BOTTOM),
                    rx: rand(30, 70),
                    ry: rand(14, 32),
                    rot: rand(-0.2, 0.2),
                });
            }

            for (let i = 0; i < 8; i += 1) {
                fieldDecor.push({
                    type: 'trench',
                    x: rand(width * 0.08, width * 0.92),
                    y: rand(LANE_MARGIN_TOP + 20, height - LANE_MARGIN_BOTTOM - 20),
                    len: rand(80, 180),
                    rot: rand(-0.08, 0.08),
                });
            }
        }

        function spawnInterval(now) {
            const progress = sessionProgress(now);
            return SPAWN_BASE_MS - (SPAWN_BASE_MS - SPAWN_MIN_MS) * progress;
        }

        function tankSpeed(now) {
            const progress = sessionProgress(now);
            const mobile = window.AbsAimCore.isMobileDevice();
            if (Math.random() < SLOW_TANK_CHANCE) {
                return rand(mobile ? 70 : 85, mobile ? 120 : 140);
            }
            return (rand(160, 240) + progress * 120) * (mobile ? 0.82 : 1);
        }

        function baseHitRadius() {
            return window.AbsAimCore.isMobileDevice() ? 34 : 32;
        }

        function mobileTapReach() {
            return 130;
        }

        function updateCursorShake(now, dt) {
            const progress = sessionProgress(now);
            const tremor = (5.5 + progress * 7.5) * SHAKE_MULT;
            const sway = (13 + progress * 18) * SHAKE_MULT;
            const step = dt > 0 ? dt : 0.016;
            shakeTime += step;

            const microX = Math.sin(shakeTime * 39) * tremor * 0.48
                + Math.sin(shakeTime * 61 + 0.7) * tremor * 0.34
                + (Math.random() - 0.5) * tremor * 0.42;
            const microY = Math.sin(shakeTime * 47 + 1.1) * tremor * 0.4
                + Math.sin(shakeTime * 53 + 2.2) * tremor * 0.28
                + (Math.random() - 0.5) * tremor * 0.38;

            const swayX = Math.sin(shakeTime * 3.6) * sway * 0.58
                + Math.sin(shakeTime * 2.3 + 1.4) * sway * 0.32;
            const swayY = Math.sin(shakeTime * 4.1 + 0.8) * sway * 0.46
                + Math.cos(shakeTime * 2.8 + 0.5) * sway * 0.3;

            shake.x = microX + swayX;
            shake.y = microY + swayY;
        }

        function syncShakenPointer(now, dt) {
            updateCursorShake(now, dt);
            pointer.x = rawPointer.x + shake.x;
            pointer.y = rawPointer.y + shake.y;
        }

        function loadSightImage() {
            if (sightImage) {
                return;
            }
            sightImage = new Image();
            sightImage.onload = () => {
                sightImageReady = sightImage.naturalWidth > 0 && sightImage.naturalHeight > 0;
            };
            sightImage.onerror = () => {
                sightImageReady = false;
            };
            sightImage.src = SIGHT_IMAGE_SRC;
        }

        function ensureAudioCtx() {
            if (audioCtx) {
                return audioCtx;
            }
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) {
                return null;
            }
            audioCtx = new Ctx();
            return audioCtx;
        }

        function ensureBgm() {
            if (!bgmAudio) {
                bgmAudio = new Audio(BGM_SRC);
                bgmAudio.preload = 'auto';
            }
            return bgmAudio;
        }

        function ensureHtml5Sfx(src) {
            if (!sfxHtml5Pools[src]) {
                const audio = new Audio(src);
                audio.preload = 'auto';
                sfxHtml5Pools[src] = audio;
            }
            return sfxHtml5Pools[src];
        }

        function loadSfxBuffer(src) {
            if (sfxBuffers[src]) {
                return Promise.resolve(sfxBuffers[src]);
            }
            if (sfxLoadPromises[src]) {
                return sfxLoadPromises[src];
            }
            const ctx = ensureAudioCtx();
            if (!ctx) {
                return Promise.resolve(null);
            }
            sfxLoadPromises[src] = fetch(src)
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`sfx fetch failed: ${src}`);
                    }
                    return res.arrayBuffer();
                })
                .then((ab) => ctx.decodeAudioData(ab))
                .then((buf) => {
                    sfxBuffers[src] = buf;
                    return buf;
                })
                .catch(() => null);
            return sfxLoadPromises[src];
        }

        function preloadAllAudio() {
            ensureBgm();
            SFX_SRCS.forEach((src) => {
                loadSfxBuffer(src);
                ensureHtml5Sfx(src);
            });
        }

        function unlockHtml5Audio(audio) {
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

        function warmupAudio() {
            preloadAllAudio();
            const ctx = ensureAudioCtx();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            if (!bgmUnlocked) {
                unlockHtml5Audio(ensureBgm());
                SFX_SRCS.forEach((src) => unlockHtml5Audio(ensureHtml5Sfx(src)));
                bgmUnlocked = true;
            }
        }

        function playBgm() {
            bindVolumeListener();
            const audio = ensureBgm();
            audio.currentTime = 0;
            audio.loop = false;
            audio.volume = aimVol(BGM_VOLUME);
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        }

        function stopBgm() {
            if (!bgmAudio) {
                return;
            }
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        }

        function playSfxHtml5(src, volume) {
            const scaled = aimVol(volume);
            const audio = ensureHtml5Sfx(src);
            try {
                if (!audio.paused && audio.currentTime > 0 && !audio.ended) {
                    const clone = new Audio(src);
                    clone.volume = scaled;
                    const playPromise = clone.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(() => {});
                    }
                    return;
                }
                audio.volume = scaled;
                audio.currentTime = 0;
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
            } catch (e) {

            }
        }

        function playSfx(src) {
            const ctx = ensureAudioCtx();
            if (!ctx) {
                playSfxHtml5(src, SFX_VOLUME);
                return;
            }
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const buffer = sfxBuffers[src];
            if (!buffer) {
                loadSfxBuffer(src).then((buf) => {
                    if (buf) {
                        playSfx(src);
                    } else {
                        playSfxHtml5(src, SFX_VOLUME);
                    }
                });
                return;
            }
            try {
                const source = ctx.createBufferSource();
                const gain = ctx.createGain();
                source.buffer = buffer;
                gain.gain.value = aimVol(SFX_VOLUME);
                source.connect(gain);
                gain.connect(ctx.destination);
                source.start(0);
            } catch (e) {
                playSfxHtml5(src, SFX_VOLUME);
            }
        }

        function playShotSfx() {
            playSfx(SFX_SHOT_SRC);
        }

        function playMissSfx() {
            playSfx(SFX_MISS_SRC);
        }

        function playHitSfx() {
            playSfx(SFX_HIT_SRC);
        }

        function playBattleStartSfx() {
            playSfx(SFX_BATTLE_START_SRC);
        }

        function spawnExplosion(x, y) {
            const particles = [];
            for (let i = 0; i < 22; i += 1) {
                const angle = rand(0, Math.PI * 2);
                const speed = rand(90, 240);
                const life = rand(0.28, 0.52);
                particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life,
                    maxLife: life,
                    size: rand(5, 13),
                    hot: Math.random() < 0.55,
                });
            }
            explosions.push({
                x,
                y,
                age: 0,
                duration: 0.5,
                particles,
            });
        }

        function updateExplosions(dt) {
            if (!explosions.length) {
                return;
            }
            explosions = explosions.filter((ex) => {
                ex.age += dt;
                ex.particles.forEach((p) => {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.vy += 140 * dt;
                    p.vx *= 0.94;
                    p.vy *= 0.96;
                    p.life -= dt;
                });
                ex.particles = ex.particles.filter((p) => p.life > 0);
                return ex.age < ex.duration || ex.particles.length > 0;
            });
        }

        function drawExplosions() {
            explosions.forEach((ex) => {
                const fade = clamp(1 - ex.age / ex.duration, 0, 1);
                const blastR = ex.age * 190;

                ctx.save();
                ctx.globalAlpha = fade * 0.35;
                const blast = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, blastR);
                blast.addColorStop(0, 'rgba(255, 220, 120, 0.95)');
                blast.addColorStop(0.35, 'rgba(255, 120, 40, 0.65)');
                blast.addColorStop(1, 'rgba(80, 20, 10, 0)');
                ctx.fillStyle = blast;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, blastR, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = fade * 0.85;
                ctx.strokeStyle = 'rgba(255, 170, 60, 0.9)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, blastR * 0.55, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                ex.particles.forEach((p) => {
                    const t = clamp(p.life / p.maxLife, 0, 1);
                    ctx.fillStyle = p.hot
                        ? `rgba(255, ${Math.floor(120 + 100 * t)}, 40, ${t})`
                        : `rgba(90, 90, 90, ${t * 0.75})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
        }

        function pickTrajectory() {
            return Math.random() < 0.58 ? 'wave' : 'circle';
        }

        function tankTooClose(x, y, minDist, ignoreId) {
            for (let i = 0; i < tanks.length; i += 1) {
                const other = tanks[i];
                if (!other.alive || other.id === ignoreId) continue;
                if (dist(x, y, other.x, other.y) < minDist) {
                    return true;
                }
            }
            return false;
        }

        function isLaneFree(laneIndex, direction) {
            for (let i = 0; i < tanks.length; i += 1) {
                const other = tanks[i];
                if (!other.alive || other.traj !== 'wave' || other.laneIndex !== laneIndex) {
                    continue;
                }
                if (other.vx * direction > 0) {
                    return false;
                }
            }
            return true;
        }

        function isOrbitFree(slotIndex) {
            return !tanks.some((t) => t.alive && t.traj === 'circle' && t.orbitSlot === slotIndex);
        }

        function findFreeLane(direction) {
            const free = [];
            for (let i = 0; i < LANE_COUNT; i += 1) {
                if (isLaneFree(i, direction)) {
                    free.push(i);
                }
            }
            if (!free.length) {
                return null;
            }
            return free[randInt(0, free.length - 1)];
        }

        function findFreeOrbitSlot() {
            const free = [];
            for (let i = 0; i < ORBIT_SLOTS.length; i += 1) {
                if (isOrbitFree(i)) {
                    free.push(i);
                }
            }
            if (!free.length) {
                return null;
            }
            return free[randInt(0, free.length - 1)];
        }

        function separateTanks() {
            for (let i = 0; i < tanks.length; i += 1) {
                for (let j = i + 1; j < tanks.length; j += 1) {
                    const a = tanks[i];
                    const b = tanks[j];
                    if (!a.alive || !b.alive) continue;

                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d = Math.hypot(dx, dy);
                    if (d >= TANK_SEPARATION || d < 0.01) {
                        continue;
                    }

                    const push = (TANK_SEPARATION - d) * 0.5;
                    const nx = dx / d;
                    const ny = dy / d;
                    a.x = clamp(a.x + nx * push, 40, width - 40);
                    a.y = clamp(a.y + ny * push, yMin, yMax);
                    b.x = clamp(b.x - nx * push, 40, width - 40);
                    b.y = clamp(b.y - ny * push, yMin, yMax);
                }
            }
        }

        function nextTankId() {
            return (nextTankId.counter = (nextTankId.counter || 0) + 1);
        }

        function spawnWaveTank(now, direction) {
            const laneIndex = findFreeLane(direction);
            if (laneIndex == null) {
                return false;
            }

            const speed = tankSpeed(now);
            const baseY = lanes[laneIndex];
            const waveAmp = Math.min(rand(16, 28), laneHeight * 0.3);
            const startX = direction > 0 ? -80 : width + 80;

            if (tankTooClose(startX, baseY, TANK_SEPARATION * 1.2, null)) {
                return false;
            }

            tanks.push({
                id: nextTankId(),
                x: startX,
                y: baseY,
                vx: direction * speed,
                vy: 0,
                baseY,
                laneIndex,
                traj: 'wave',
                waveAmp,
                waveFreq: rand(0.008, 0.014),
                wavePhase: rand(0, Math.PI * 2),
                bodyW: 64,
                bodyH: 30,
                hitRadius: baseHitRadius(),
                alive: true,
            });
            return true;
        }

        function spawnCircleTank(now) {
            const slotIndex = findFreeOrbitSlot();
            if (slotIndex == null) {
                return false;
            }

            const slot = ORBIT_SLOTS[slotIndex];
            const orbitCx = slot.cx * width;
            const orbitCy = slot.cy * height;
            const orbitR = slot.r * Math.min(width, height);
            const orbitAngle = rand(0, Math.PI * 2);
            const x = orbitCx + Math.cos(orbitAngle) * orbitR;
            const y = orbitCy + Math.sin(orbitAngle) * orbitR;

            if (tankTooClose(x, y, TANK_SEPARATION * 1.15, null)) {
                return false;
            }

            const orbitSpeed = rand(0.42, 0.72);
            tanks.push({
                id: nextTankId(),
                x,
                y,
                vx: -Math.sin(orbitAngle) * orbitSpeed * orbitR,
                vy: 0,
                traj: 'circle',
                orbitSlot: slotIndex,
                orbitCx,
                orbitCy,
                orbitR,
                orbitAngle,
                orbitDir: Math.random() < 0.5 ? 1 : -1,
                orbitSpeed,
                bodyW: 64,
                bodyH: 30,
                hitRadius: baseHitRadius(),
                alive: true,
            });
            return true;
        }

        function spawnTank(now) {
            if (!lanes.length) {
                rebuildLanes();
            }

            const traj = pickTrajectory();
            if (traj === 'circle') {
                if (spawnCircleTank(now)) {
                    return true;
                }
                const direction = Math.random() < 0.5 ? 1 : -1;
                return spawnWaveTank(now, direction);
            }

            const direction = Math.random() < 0.5 ? 1 : -1;
            if (spawnWaveTank(now, direction)) {
                return true;
            }
            return spawnCircleTank(now);
        }

        function updateTankPosition(tank, dt) {
            if (tank.traj === 'circle') {
                tank.orbitAngle += tank.orbitDir * tank.orbitSpeed * dt;
                tank.x = tank.orbitCx + Math.cos(tank.orbitAngle) * tank.orbitR;
                tank.y = tank.orbitCy + Math.sin(tank.orbitAngle) * tank.orbitR;
                tank.vx = -Math.sin(tank.orbitAngle) * tank.orbitSpeed * tank.orbitR;
                tank.y = clamp(tank.y, yMin, yMax);
                return;
            }

            tank.x += tank.vx * dt;
            tank.y = tank.baseY + Math.sin(tank.x * tank.waveFreq + tank.wavePhase) * tank.waveAmp;
            tank.y = clamp(tank.y, yMin, yMax);
        }

        function isTankOffScreen(tank) {
            if (tank.traj === 'circle') {
                return false;
            }
            return tank.vx > 0 ? tank.x > width + 90 : tank.x < -90;
        }

        function findTankAt(pos) {
            const mobile = window.AbsAimCore.isMobileDevice();
            let bestIndex = -1;
            let bestDist = Infinity;
            for (let i = 0; i < tanks.length; i += 1) {
                const tank = tanks[i];
                if (!tank.alive) continue;
                const d = dist(pos.x, pos.y, tank.x, tank.y);
                const reach = mobile ? mobileTapReach() : tankHitRadius(tank);
                if (d <= reach && d < bestDist) {
                    bestDist = d;
                    bestIndex = i;
                }
            }
            return bestIndex;
        }

        function trySpawn(now) {
            if (tanks.length >= MAX_TANKS || now < nextSpawnAt) {
                return;
            }
            spawnTank(now);
            const progress = sessionProgress(now);
            if (tanks.length < MAX_TANKS && Math.random() < 0.18 + progress * 0.18) {
                spawnTank(now);
            }
            nextSpawnAt = now + spawnInterval(now) * rand(0.45, 0.85);
        }

        function tankHitRadius(tank) {
            return tank.hitRadius;
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

        function resizeTanks(oldW, oldH) {
            if (!tanks.length || oldW <= 0 || oldH <= 0) return;
            tanks.forEach((tank) => {
                if (tank.traj === 'circle') {
                    const slot = ORBIT_SLOTS[tank.orbitSlot] || ORBIT_SLOTS[0];
                    tank.orbitCx = slot.cx * width;
                    tank.orbitCy = slot.cy * height;
                    tank.orbitR = slot.r * Math.min(width, height);
                    tank.x = tank.orbitCx + Math.cos(tank.orbitAngle) * tank.orbitR;
                    tank.y = tank.orbitCy + Math.sin(tank.orbitAngle) * tank.orbitR;
                    tank.vx = -Math.sin(tank.orbitAngle) * tank.orbitSpeed * tank.orbitR;
                    return;
                }
                tank.x = (tank.x / oldW) * width;
                if (tank.laneIndex != null && lanes[tank.laneIndex] != null) {
                    tank.baseY = lanes[tank.laneIndex];
                } else {
                    tank.baseY = clamp((tank.baseY / oldH) * height, yMin, yMax);
                }
                tank.y = tank.baseY + Math.sin(tank.x * tank.waveFreq + tank.wavePhase) * tank.waveAmp;
                tank.y = clamp(tank.y, yMin, yMax);
            });
        }

        function drawFieldBackground() {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, '#6f8f48');
            grad.addColorStop(0.35, '#8faa58');
            grad.addColorStop(0.65, '#9cb86a');
            grad.addColorStop(1, '#748c44');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            const haze = ctx.createRadialGradient(width * 0.5, height * 0.45, 40, width * 0.5, height * 0.5, width * 0.75);
            haze.addColorStop(0, 'rgba(180, 168, 120, 0.08)');
            haze.addColorStop(1, 'rgba(90, 72, 48, 0.18)');
            ctx.fillStyle = haze;
            ctx.fillRect(0, 0, width, height);

            fieldDecor.forEach((item) => {
                if (item.type === 'grass') {
                    ctx.save();
                    ctx.translate(item.x, item.y);
                    ctx.rotate(item.rot);
                    ctx.fillStyle = item.color;
                    ctx.fillRect(-item.w * 0.5, -item.h, item.w, item.h);
                    ctx.restore();
                } else if (item.type === 'crater') {
                    ctx.fillStyle = 'rgba(62, 52, 38, 0.32)';
                    ctx.beginPath();
                    ctx.ellipse(item.x, item.y, item.rx, item.ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(42, 34, 24, 0.42)';
                    ctx.beginPath();
                    ctx.ellipse(item.x, item.y, item.rx * 0.55, item.ry * 0.55, 0, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.type === 'rock') {
                    ctx.fillStyle = 'rgba(92, 86, 78, 0.75)';
                    ctx.beginPath();
                    ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(68, 62, 56, 0.55)';
                    ctx.beginPath();
                    ctx.arc(item.x - item.r * 0.2, item.y - item.r * 0.15, item.r * 0.55, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.type === 'scorch') {
                    ctx.fillStyle = 'rgba(48, 40, 32, 0.22)';
                    ctx.beginPath();
                    ctx.ellipse(item.x, item.y, item.rx, item.ry, item.rot, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.type === 'trench') {
                    ctx.save();
                    ctx.translate(item.x, item.y);
                    ctx.rotate(item.rot);
                    ctx.fillStyle = 'rgba(54, 44, 32, 0.38)';
                    ctx.fillRect(-item.len * 0.5, -5, item.len, 10);
                    ctx.strokeStyle = 'rgba(34, 28, 20, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-item.len * 0.5, -5, item.len, 10);
                    ctx.restore();
                }
            });

            const usable = Math.max(0, height - LANE_MARGIN_TOP - LANE_MARGIN_BOTTOM);
            const laneH = usable / LANE_COUNT;
            for (let i = 0; i < LANE_COUNT; i += 1) {
                const y = LANE_MARGIN_TOP + i * laneH;
                ctx.fillStyle = i % 2 === 0
                    ? 'rgba(58, 78, 38, 0.16)'
                    : 'rgba(78, 62, 38, 0.12)';
                ctx.fillRect(0, y, width, laneH);

                const trackY = y + laneH * 0.62;
                ctx.strokeStyle = 'rgba(48, 38, 28, 0.34)';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 10, 2, 10]);
                ctx.beginPath();
                ctx.moveTo(0, trackY - 2);
                ctx.lineTo(width, trackY - 2);
                ctx.moveTo(0, trackY + 2);
                ctx.lineTo(width, trackY + 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.strokeStyle = 'rgba(42, 56, 30, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, y + laneH);
                ctx.lineTo(width, y + laneH);
                ctx.stroke();
            }

            const centerX = width * 0.5;
            ctx.strokeStyle = 'rgba(22, 18, 12, 0.62)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(centerX, LANE_MARGIN_TOP - 10);
            ctx.lineTo(centerX, height - LANE_MARGIN_BOTTOM + 10);
            ctx.stroke();

            for (let i = 0; i < LANE_COUNT; i += 1) {
                const dotY = LANE_MARGIN_TOP + (i + 0.5) * laneH;
                ctx.fillStyle = 'rgba(108, 148, 68, 0.95)';
                ctx.beginPath();
                ctx.arc(centerX, dotY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(24, 20, 14, 0.75)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, height * 0.25, width * 0.5, height * 0.5, width * 0.72);
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(1, 'rgba(12, 10, 8, 0.28)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);
        }

        function drawTacticalSight(cx, cy) {
            if (sightImageReady && sightImage) {
                const w = sightImage.naturalWidth * SIGHT_SCALE;
                const h = sightImage.naturalHeight * SIGHT_SCALE;
                ctx.drawImage(sightImage, cx - w * 0.5, cy - h * 0.5, w, h);
                return;
            }
            const ring = 38;
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(cx, cy, ring + 1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, ring, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(198, 40, 40, 0.98)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, ring * 0.58, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            const tickStart = ring - 10;
            const tickLen = 8;
            ctx.beginPath();
            ctx.moveTo(cx, cy - tickStart);
            ctx.lineTo(cx, cy - tickStart + tickLen);
            ctx.moveTo(cx, cy + tickStart);
            ctx.lineTo(cx, cy + tickStart - tickLen);
            ctx.moveTo(cx - tickStart, cy);
            ctx.lineTo(cx - tickStart + tickLen, cy);
            ctx.moveTo(cx + tickStart, cy);
            ctx.lineTo(cx + tickStart - tickLen, cy);
            ctx.stroke();
            ctx.fillStyle = '#ff5252';
            ctx.beginPath();
            ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawDrunkScope() {
            drawTacticalSight(pointer.x, pointer.y);
        }

        function drawCursorSight(now) {
            const ts = now || performance.now();
            const dt = cursorShakeLast > 0 ? (ts - cursorShakeLast) / 1000 : 0.016;
            cursorShakeLast = ts;
            syncShakenPointer(ts, dt);
            drawDrunkScope();
        }

        function drawTank(tank) {
            const facing = tank.vx >= 0 ? 1 : -1;
            const bodyW = tank.bodyW;
            const bodyH = tank.bodyH;

            ctx.save();
            ctx.translate(tank.x, tank.y);
            ctx.scale(facing, 1);

            ctx.fillStyle = 'rgba(196, 74, 58, 0.35)';
            ctx.strokeStyle = 'rgba(220, 60, 45, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(-bodyW * 0.56, -bodyH * 0.62, bodyW * 1.12, bodyH * 1.24, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#b8a878';
            ctx.fillRect(-bodyW * 0.48, -bodyH * 0.22, bodyW * 0.96, bodyH * 0.44);

            ctx.fillStyle = '#8f7d58';
            ctx.fillRect(-bodyW * 0.5, bodyH * 0.18, bodyW, bodyH * 0.24);
            ctx.fillRect(-bodyW * 0.5, -bodyH * 0.42, bodyW, bodyH * 0.16);

            for (let i = -2; i <= 2; i += 1) {
                ctx.fillStyle = 'rgba(58, 48, 34, 0.55)';
                ctx.fillRect(i * 11 - 4, bodyH * 0.2, 8, bodyH * 0.2);
                ctx.fillRect(i * 11 - 4, -bodyH * 0.38, 8, bodyH * 0.12);
            }

            ctx.fillStyle = '#a09068';
            ctx.beginPath();
            ctx.arc(-bodyW * 0.06, -bodyH * 0.02, bodyH * 0.34, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(72, 62, 44, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#8a7a58';
            ctx.fillRect(bodyW * 0.04, -bodyH * 0.12, bodyW * 0.46, bodyH * 0.16);
            ctx.fillStyle = '#5a5040';
            ctx.fillRect(bodyW * 0.44, -bodyH * 0.08, bodyW * 0.28, bodyH * 0.08);

            ctx.restore();
        }

        return {
            id: 'vugich',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
                rebuildLanes();
                buildFieldDecor();
                loadSightImage();
                preloadAllAudio();
            },
            resize(size) {
                if (size.width === width && size.height === height) {
                    return;
                }
                const oldW = width || size.width;
                const oldH = height || size.height;
                width = size.width;
                height = size.height;
                rebuildLanes();
                buildFieldDecor();
                resizeTanks(oldW, oldH);
            },
            start() {
                hits = 0;
                misses = 0;
                escaped = 0;
                streak = 0;
                bestStreak = 0;
                tanks = [];
                explosions = [];
                shake = { x: 0, y: 0 };
                shakeTime = 0;
                cursorShakeLast = 0;
                rawPointer = { x: width * 0.5, y: height * 0.5 };
                pointer = { x: rawPointer.x, y: rawPointer.y };
                running = true;
                startAt = performance.now();
                lastUpdate = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                nextSpawnAt = startAt + 220;
                rebuildLanes();
                buildFieldDecor();
                playBattleStartSfx();
                window.setTimeout(playBgm, 350);
            },
            stop() {
                running = false;
                tanks = [];
                explosions = [];
                stopBgm();
            },
            destroy() {
                running = false;
                tanks = [];
                explosions = [];
                stopBgm();
            },
            isFinished() {
                return endAt > 0 && remainingSec() <= 0;
            },
            getScore,
            getMetrics,
            getRemainingSec: remainingSec,
            warmupAudio,
            onPointerMove(event) {
                rawPointer = pointerPos(canvas, event);
                if (window.AbsAimCore.isMobileDevice()) {
                    pointer = rawPointer;
                }
            },
            onPointerDown(event) {
                if (!running) return;
                let pos;
                if (window.AbsAimCore.isMobileDevice()) {
                    pos = pointerPos(canvas, event);
                } else {
                    rawPointer = pointerPos(canvas, event);
                    syncShakenPointer(performance.now(), 0);
                    pos = pointer;
                }
                const tankIndex = findTankAt(pos);
                playShotSfx();
                if (tankIndex >= 0) {
                    const tank = tanks[tankIndex];
                    spawnExplosion(tank.x, tank.y);
                    tanks.splice(tankIndex, 1);
                    hits += 1;
                    streak += 1;
                    bestStreak = Math.max(bestStreak, streak);
                    playHitSfx();
                    return;
                }
                if (!window.AbsAimCore.isMobileDevice()) {
                    misses += 1;
                    streak = 0;
                    playMissSfx();
                }
            },
            update(now) {
                if (!running) return;
                if (remainingSec() <= 0) {
                    running = false;
                    tanks = [];
                    return;
                }

                const dt = lastUpdate > 0 ? (now - lastUpdate) / 1000 : 0;
                lastUpdate = now;
                updateExplosions(dt);
                trySpawn(now);

                tanks = tanks.filter((tank) => {
                    updateTankPosition(tank, dt);
                    separateTanks();
                    if (isTankOffScreen(tank)) {
                        escaped += 1;
                        streak = 0;
                        return false;
                    }
                    return tank.alive;
                });
            },
            render(now) {
                if (!ctx) return;
                const ts = now || performance.now();
                if (!running && explosions.length) {
                    const dt = cursorShakeLast > 0 ? (ts - cursorShakeLast) / 1000 : 0.016;
                    updateExplosions(dt);
                }
                drawFieldBackground();
                if (running) {
                    tanks.forEach((tank) => {
                        drawTank(tank);
                    });
                }
                drawExplosions();
                if (running && !window.AbsAimCore.isMobileDevice()) {
                    drawCursorSight(ts);
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
    window.AbsAimTrainers.vugich = createVugichTrainer;
})();
