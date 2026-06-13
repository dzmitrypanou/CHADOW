(() => {
    'use strict';

    const { rand, pointerPos } = window.AbsAimCore;

    function createReactionTrainer() {
        const ROUNDS = 10;
        let canvas = null;
        let ctx = null;
        let width = 0;
        let height = 0;
        let running = false;
        let round = 0;
        let phase = 'idle';
        let signalAt = 0;
        let waitUntil = 0;
        let reactions = [];
        let earlyClicks = 0;
        let roundStartedAt = 0;

        function getScore() {
            if (reactions.length === 0) {
                return 0;
            }
            const avg = reactions.reduce((a, b) => a + b, 0) / reactions.length;
            const penalty = earlyClicks * 400;
            return Math.max(0, Math.round(10000 - avg - penalty));
        }

        function getMetrics() {
            const avg = reactions.length
                ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length)
                : 0;
            return {
                rounds_completed: reactions.length,
                avg_reaction_ms: avg,
                early_clicks: earlyClicks,
            };
        }

        function beginRound(now) {
            round += 1;
            phase = 'wait';
            roundStartedAt = now;
            waitUntil = now + rand(900, 3200);
            signalAt = 0;
        }

        return {
            id: 'reaction',
            durationSec: null,
            init(c, context, size) {
                canvas = c;
                ctx = context;
                width = size.width;
                height = size.height;
            },
            resize(size) {
                width = size.width;
                height = size.height;
            },
            start() {
                running = true;
                round = 0;
                reactions = [];
                earlyClicks = 0;
                beginRound(performance.now());
            },
            stop() {
                running = false;
                phase = 'done';
            },
            destroy() {
                running = false;
            },
            isFinished() {
                return phase === 'done';
            },
            getScore,
            getMetrics,
            getRemainingSec() {
                return running ? Math.max(0, ROUNDS - reactions.length) : 0;
            },
            onPointerMove() {},
            onPointerDown(event) {
                if (!running || phase === 'done') return;
                const now = performance.now();
                if (phase === 'wait') {
                    earlyClicks += 1;
                    phase = 'penalty';
                    setTimeout(() => {
                        if (running && phase === 'penalty') {
                            beginRound(performance.now());
                        }
                    }, 700);
                    return;
                }
                if (phase === 'go' && signalAt > 0) {
                    const ms = now - signalAt;
                    reactions.push(ms);
                    if (reactions.length >= ROUNDS) {
                        running = false;
                        phase = 'done';
                    } else {
                        phase = 'cooldown';
                        window.setTimeout(() => {
                            if (running) {
                                beginRound(performance.now());
                            }
                        }, 550);
                    }
                }
            },
            update(now) {
                if (!running) return;
                if (phase === 'wait' && now >= waitUntil) {
                    phase = 'go';
                    signalAt = now;
                }
            },
            render(now) {
                if (!ctx) return;
                window.AbsAimCore.clearArena(ctx, width, height);

                if (!running) {
                    return;
                }

                let color = 'rgba(239, 83, 80, 0.75)';
                let label = '';
                if (phase === 'go') {
                    color = 'rgba(76, 175, 80, 0.85)';
                    label = 'CLICK';
                } else if (phase === 'penalty') {
                    color = 'rgba(255, 193, 7, 0.85)';
                    label = 'EARLY';
                } else if (phase === 'cooldown') {
                    color = 'rgba(113, 163, 230, 0.45)';
                } else if (phase === 'done') {
                    color = 'rgba(113, 163, 230, 0.5)';
                }

                const size = Math.min(width, height) * 0.28;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
                ctx.fill();

                if (label) {
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    ctx.font = 'bold 28px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, width / 2, height / 2);
                }

                ctx.font = '14px Inter, sans-serif';
                ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
                ctx.fillText(
                    (reactions.length) + ' / ' + ROUNDS,
                    width / 2,
                    height / 2 + size + 28
                );
            },
            getHudExtra(i18n) {
                return {
                    label: i18n.t('rounds'),
                    value: reactions.length + ' / ' + ROUNDS,
                };
            },
        };
    }

    window.AbsAimTrainers = window.AbsAimTrainers || {};
    window.AbsAimTrainers.reaction = createReactionTrainer;
})();
