(() => {
    'use strict';

    const { dist, clamp, pointerPos, touchTargetScale, touchHitSlop } = window.AbsAimCore;

    function createLeadTrainer() {
        const DURATION_SEC = 60;
        const sfx = (window.AbsAimSounds && window.AbsAimSounds.bindTrainer('lead')) || {
            warmupAudio() {}, start() {}, shot() {}, hit() {}, miss() {},
        };
        const DISTANCE_MIN = 0.12;
        const DISTANCE_MAX = 0.92;
        const SPEED_MIN = 180;
        const SPEED_MAX = 480;
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let endAt = 0;
        let startAt = 0;
        let hits = 0;
        let misses = 0;
        let pointer = { x: 0, y: 0 };
        let body = { x: 0, y: 0, vx: SPEED_MIN };
        let lastUpdate = 0;
        let distance = DISTANCE_MIN;
        let distanceSamples = 0;
        let distanceSum = 0;

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function sessionProgress(now) {
            const elapsed = (now - startAt) / 1000;
            const t = clamp(elapsed / DURATION_SEC, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function currentSpeed(now) {
            return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * sessionProgress(now);
        }

        function updateDistance(now) {
            if (!running) return;
            distance = DISTANCE_MIN + (DISTANCE_MAX - DISTANCE_MIN) * sessionProgress(now);
            distanceSum += distance;
            distanceSamples += 1;
        }

        function bodyRadius() {
            return (12 + (1 - distance) * 18) * touchTargetScale();
        }

        function leadRadius() {
            return (18 + (1 - distance) * 12) * touchTargetScale();
        }

        function leadOffset() {
            return 22 + distance * 98;
        }

        function updateBody(now) {
            const dt = lastUpdate > 0 ? (now - lastUpdate) / 1000 : 0;
            lastUpdate = now;
            updateDistance(now);
            const t = (now - startAt) / 1000;
            const laneY = height * (0.38 + distance * 0.22);
            body.y = laneY + Math.sin(t * 0.8) * (height * 0.04);
            const dir = body.vx >= 0 ? 1 : -1;
            const speed = currentSpeed(now);
            body.vx = dir * speed;
            body.x += body.vx * dt;
            const margin = 48 + distance * 24;
            if (body.x > width - margin) {
                body.x = width - margin;
                body.vx = -speed;
            } else if (body.x < margin) {
                body.x = margin;
                body.vx = speed;
            }
        }

        function leadPoint() {
            const dir = body.vx >= 0 ? 1 : -1;
            return {
                x: body.x + dir * leadOffset(),
                y: body.y,
            };
        }

        function distanceLabel(i18n) {
            if (distance < 0.34) return i18n.t('distanceClose');
            if (distance < 0.67) return i18n.t('distanceMid');
            return i18n.t('distanceFar');
        }

        function getScore() {
            return Math.max(0, hits * 150 - misses * 50);
        }

        function getMetrics() {
            const total = hits + misses;
            return {
                hits,
                misses,
                accuracy_pct: total > 0 ? Math.round((hits / total) * 100) : 0,
                avg_distance_pct: distanceSamples > 0
                    ? Math.round((distanceSum / distanceSamples) * 100)
                    : Math.round(distance * 100),
            };
        }

        return {
            id: 'lead',
            durationSec: DURATION_SEC,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
                body = { x: width * 0.25, y: height / 2, vx: SPEED_MIN };
                distance = DISTANCE_MIN;
            },
            resize(size) {
                width = size.width;
                height = size.height;
            },
            warmupAudio: sfx.warmupAudio,
            start() {
                hits = 0;
                misses = 0;
                running = true;
                startAt = performance.now();
                lastUpdate = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                body = { x: width * 0.25, y: height / 2, vx: SPEED_MIN };
                distance = DISTANCE_MIN;
                distanceSamples = 0;
                distanceSum = 0;
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
            onPointerDown(event) {
                if (!running) return;
                sfx.shot();
                const pos = pointerPos(canvas, event);
                const lead = leadPoint();
                const slop = touchHitSlop();
                const hitLead = dist(pos.x, pos.y, lead.x, lead.y) <= leadRadius() + slop;
                const hitBody = dist(pos.x, pos.y, body.x, body.y) <= bodyRadius() + slop;
                if (hitLead) {
                    hits += 1;
                    sfx.hit();
                } else {
                    misses += 1;
                    sfx.miss();
                    if (hitBody) {
                        // clicked body not lead zone — counts as miss
                    }
                }
            },
            update(now) {
                if (!running) return;
                if (remainingSec() <= 0) {
                    running = false;
                    return;
                }
                updateBody(now);
            },
            render(now) {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);
                const ts = now || performance.now();
                if (running) updateBody(ts);

                const lead = leadPoint();
                const dir = body.vx >= 0 ? 1 : -1;
                const bodyR = bodyRadius();
                const leadR = leadRadius();
                const alpha = 0.55 + (1 - distance) * 0.4;

                ctx.save();
                ctx.setLineDash([6, 6]);
                ctx.strokeStyle = 'rgba(76, 175, 80, 0.45)';
                ctx.beginPath();
                ctx.moveTo(body.x, body.y);
                ctx.lineTo(lead.x, lead.y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.arc(lead.x, lead.y, leadR, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(76, 175, 80, 0.28)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(200, 230, 201, 0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();

                window.AbsAimCore.drawTarget(
                    ctx,
                    body.x,
                    body.y,
                    bodyR,
                    'rgba(66, 165, 245, ' + alpha + ')',
                    'rgba(187, 222, 251, ' + alpha + ')'
                );

                ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + (1 - distance) * 0.35) + ')';
                ctx.beginPath();
                ctx.moveTo(body.x + dir * (bodyR + 4), body.y);
                ctx.lineTo(body.x + dir * (bodyR - 2), body.y - Math.max(6, bodyR * 0.35));
                ctx.lineTo(body.x + dir * (bodyR - 2), body.y + Math.max(6, bodyR * 0.35));
                ctx.closePath();
                ctx.fill();

                ctx.restore();

                window.AbsAimCore.drawCrosshair(ctx, pointer.x, pointer.y);
            },
            getHudExtra(i18n) {
                return {
                    label: i18n.t('distance'),
                    value: distanceLabel(i18n),
                };
            },
        };
    }

    window.AbsAimTrainers = window.AbsAimTrainers || {};
    window.AbsAimTrainers.lead = createLeadTrainer;
})();
