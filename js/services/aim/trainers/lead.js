(() => {
    'use strict';

    const { dist, rand, clamp, pointerPos } = window.AbsAimCore;

    function createLeadTrainer() {
        const DURATION_SEC = 60;
        const DISTANCE_MIN = 0.12;
        const DISTANCE_MAX = 0.92;
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
        let body = { x: 0, y: 0, vx: 180 };
        let lastUpdate = 0;
        let distance = 0.5;
        let distanceTarget = 0.5;
        let nextDistanceChangeAt = 0;
        let distanceSamples = 0;
        let distanceSum = 0;

        function remainingSec() {
            return Math.max(0, (endAt - performance.now()) / 1000);
        }

        function pickDistanceTarget() {
            return rand(DISTANCE_MIN, DISTANCE_MAX);
        }

        function scheduleDistanceChange(now) {
            nextDistanceChangeAt = now + rand(1800, 4200);
            distanceTarget = pickDistanceTarget();
        }

        function updateDistance(now, dt) {
            if (now >= nextDistanceChangeAt) {
                scheduleDistanceChange(now);
            }
            const lerp = 1 - Math.pow(0.001, dt);
            distance += (distanceTarget - distance) * clamp(lerp, 0.02, 0.18);
            distance = clamp(distance, DISTANCE_MIN, DISTANCE_MAX);
            if (running) {
                distanceSum += distance;
                distanceSamples += 1;
            }
        }

        function bodyRadius() {
            return 12 + (1 - distance) * 18;
        }

        function leadRadius() {
            return 18 + (1 - distance) * 12;
        }

        function leadOffset() {
            return 22 + distance * 98;
        }

        function updateBody(now) {
            const dt = lastUpdate > 0 ? (now - lastUpdate) / 1000 : 0;
            lastUpdate = now;
            updateDistance(now, Math.max(dt, 1 / 120));
            const t = (now - startAt) / 1000;
            const laneY = height * (0.38 + distance * 0.22);
            body.y = laneY + Math.sin(t * 0.8) * (height * 0.04);
            body.x += body.vx * dt;
            const margin = 48 + distance * 24;
            if (body.x > width - margin) {
                body.x = width - margin;
                body.vx = -Math.abs(body.vx);
            } else if (body.x < margin) {
                body.x = margin;
                body.vx = Math.abs(body.vx);
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
                body = { x: width * 0.25, y: height / 2, vx: 180 };
                distance = pickDistanceTarget();
                distanceTarget = pickDistanceTarget();
            },
            resize(size) {
                width = size.width;
                height = size.height;
            },
            start() {
                hits = 0;
                misses = 0;
                running = true;
                startAt = performance.now();
                lastUpdate = startAt;
                endAt = startAt + DURATION_SEC * 1000;
                body = { x: width * 0.25, y: height / 2, vx: 180 };
                distance = pickDistanceTarget();
                distanceTarget = pickDistanceTarget();
                distanceSamples = 0;
                distanceSum = 0;
                scheduleDistanceChange(startAt);
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
                const pos = pointerPos(canvas, event);
                const lead = leadPoint();
                const hitLead = dist(pos.x, pos.y, lead.x, lead.y) <= leadRadius();
                const hitBody = dist(pos.x, pos.y, body.x, body.y) <= bodyRadius();
                if (hitLead) {
                    hits += 1;
                } else {
                    misses += 1;
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
                ctx.strokeStyle = 'rgba(255, 193, 7, 0.45)';
                ctx.beginPath();
                ctx.moveTo(body.x, body.y);
                ctx.lineTo(lead.x, lead.y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.arc(lead.x, lead.y, leadR, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 193, 7, 0.28)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
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

                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = 'rgba(175, 200, 228, 0.65)';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(leadOffset()) + 'px', (body.x + lead.x) / 2, body.y - leadR - 8);
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
