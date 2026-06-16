(() => {
    'use strict';

    const { generateSingle, nextPowerOfTwo } = window.AbsBracketSingle;

    function winnersDropLosersRound(winnersRound, wRounds, lRounds) {
        if (winnersRound >= wRounds) return lRounds;
        if (winnersRound === 1) return 1;
        return winnersRound * 2 - 2;
    }

    function generateDouble(participants, options = {}) {
        const base = generateSingle(participants, options);
        const matches = [...base.matches];
        const size = base.participants.length;
        const wRounds = Math.log2(size);
        const lRounds = Math.max(1, wRounds * 2 - 2);

        const winnersByRound = {};
        for (const m of matches) {
            if (!winnersByRound[m.round]) winnersByRound[m.round] = [];
            winnersByRound[m.round].push(m);
        }
        Object.values(winnersByRound).forEach((round) => {
            round.sort((a, b) => (a.slot || 0) - (b.slot || 0));
        });

        const losersByRound = {};
        for (let r = 1; r <= lRounds; r++) {
            losersByRound[r] = [];
            let count;
            if (r === 1) {
                count = size / 4;
            } else if (r % 2 === 0) {
                count = losersByRound[r - 1].length;
            } else {
                count = Math.max(1, losersByRound[r - 1].length / 2);
            }

            for (let slot = 0; slot < count; slot++) {
                losersByRound[r].push({
                    id: `l-r${r}-m${slot + 1}`,
                    stage: 'losers',
                    group: null,
                    round: r,
                    slot,
                    p1: null,
                    p2: null,
                    winner: null,
                    score1: null,
                    score2: null,
                    nextWin: null,
                    nextLose: null,
                });
            }
        }

        for (let r = 1; r < lRounds; r++) {
            const round = losersByRound[r];
            const nextRound = losersByRound[r + 1];
            round.forEach((m) => {
                const slot = m.slot ?? 0;
                if (r % 2 === 1) {
                    m.nextWin = nextRound[slot]?.id || null;
                } else {
                    m.nextWin = nextRound[Math.floor(slot / 2)]?.id || null;
                }
            });
        }

        if (losersByRound[lRounds]?.[0]) {
            losersByRound[lRounds][0].nextWin = 'gf-m1';
        }

        for (let r = 1; r <= wRounds; r++) {
            const wRound = winnersByRound[r] || [];
            wRound.forEach((m) => {
                const slot = m.slot ?? 0;
                if (r < wRounds) {
                    const dropRound = winnersDropLosersRound(r, wRounds, lRounds);
                    const dropIdx = r === 1 ? Math.floor(slot / 2) : slot;
                    const lMatch = losersByRound[dropRound]?.[
                        Math.min(dropIdx, (losersByRound[dropRound]?.length || 1) - 1)
                    ];
                    m.nextLose = lMatch ? lMatch.id : null;
                } else {
                    m.nextWin = 'gf-m1';
                    m.nextLose = losersByRound[lRounds]?.[0]?.id || null;
                }
            });
        }

        const gf = {
            id: 'gf-m1',
            stage: 'grand_final',
            group: null,
            round: 1,
            slot: 0,
            p1: null,
            p2: null,
            winner: null,
            score1: null,
            score2: null,
            nextWin: null,
            nextLose: null,
        };

        const losersMatches = [];
        for (let r = 1; r <= lRounds; r++) {
            losersMatches.push(...losersByRound[r]);
        }

        matches.push(...losersMatches, gf);

        return {
            participants: base.participants,
            settings: {},
            matches,
        };
    }

    const BRACKET_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

    function resolveLinkBracketSize(data) {
        const settings = data.settings || {};
        const stored = parseInt(settings.bracketSize, 10);
        if (BRACKET_SIZES.includes(stored)) {
            return stored;
        }

        const participants = data.participants || [];
        if (participants.length >= 2) {
            return nextPowerOfTwo(participants.length);
        }

        const realCount = participants.filter((p) => p && !/^BYE/i.test(String(p))).length || participants.length;
        return nextPowerOfTwo(Math.max(2, realCount));
    }

    function findLastLosersMatch(losersByRound) {
        const rounds = Object.keys(losersByRound)
            .map((key) => parseInt(key, 10))
            .filter((round) => round > 0);
        if (!rounds.length) return null;

        const lastRound = Math.max(...rounds);
        const round = [...(losersByRound[lastRound] || [])].sort((a, b) => (a.slot || 0) - (b.slot || 0));
        return round[0] || null;
    }

    function syncGrandFinal(data) {
        const matches = data.matches || [];
        if (!matches.some((m) => m.stage === 'losers')) return data;

        let gf = matches.find((m) => m.id === 'gf-m1') || matches.find((m) => m.stage === 'grand_final');
        if (!gf) return data;

        if (!gf.stage) gf.stage = 'grand_final';
        if (!gf.id) gf.id = 'gf-m1';

        const winnersMatches = matches.filter((m) => m.stage === 'winners' || m.stage === 'playoff');
        const losersMatches = matches.filter((m) => m.stage === 'losers');
        if (!winnersMatches.length || !losersMatches.length) return data;

        const maxWRound = Math.max(...winnersMatches.map((m) => m.round || 1));
        const maxLRound = Math.max(...losersMatches.map((m) => m.round || 1));
        const wFinal = winnersMatches
            .filter((m) => (m.round || 1) === maxWRound)
            .sort((a, b) => (a.slot || 0) - (b.slot || 0))[0];
        const lFinal = losersMatches
            .filter((m) => (m.round || 1) === maxLRound)
            .sort((a, b) => (a.slot || 0) - (b.slot || 0))[0];

        const isValidWinner = (match) => {
            if (!match || match.winner === null || match.winner === undefined) return false;
            return match.winner === match.p1 || match.winner === match.p2;
        };

        if (isValidWinner(wFinal)) {
            gf.p1 = wFinal.winner;
        }
        if (isValidWinner(lFinal)) {
            gf.p2 = lFinal.winner;
        }

        return data;
    }

    function repairLinks(data) {
        const matches = data.matches || [];
        if (!matches.some((m) => m.stage === 'losers')) return data;

        const size = resolveLinkBracketSize(data);
        const wRounds = Math.log2(size);
        const lRounds = Math.max(1, wRounds * 2 - 2);

        const winnersByRound = {};
        const losersByRound = {};
        matches.forEach((m) => {
            if (m.stage === 'winners') {
                if (!winnersByRound[m.round]) winnersByRound[m.round] = [];
                winnersByRound[m.round].push(m);
            } else if (m.stage === 'losers') {
                if (!losersByRound[m.round]) losersByRound[m.round] = [];
                losersByRound[m.round].push(m);
            }
        });

        Object.values(winnersByRound).forEach((round) => round.sort((a, b) => (a.slot || 0) - (b.slot || 0)));
        Object.values(losersByRound).forEach((round) => round.sort((a, b) => (a.slot || 0) - (b.slot || 0)));

        for (let r = 1; r < lRounds; r++) {
            const round = losersByRound[r] || [];
            const nextRound = losersByRound[r + 1] || [];
            round.forEach((m) => {
                const slot = m.slot ?? 0;
                if (r % 2 === 1) {
                    m.nextWin = nextRound[slot]?.id || null;
                } else {
                    m.nextWin = nextRound[Math.floor(slot / 2)]?.id || null;
                }
            });
        }

        const lastLosers = findLastLosersMatch(losersByRound) || losersByRound[lRounds]?.[0];
        if (lastLosers) lastLosers.nextWin = 'gf-m1';

        for (let r = 1; r <= wRounds; r++) {
            const wRound = winnersByRound[r] || [];
            wRound.forEach((m) => {
                const slot = m.slot ?? 0;
                if (r < wRounds) {
                    const dropRound = winnersDropLosersRound(r, wRounds, lRounds);
                    const dropIdx = r === 1 ? Math.floor(slot / 2) : slot;
                    const lMatch = losersByRound[dropRound]?.[
                        Math.min(dropIdx, (losersByRound[dropRound]?.length || 1) - 1)
                    ];
                    m.nextLose = lMatch ? lMatch.id : null;
                } else {
                    m.nextWin = 'gf-m1';
                    m.nextLose = lastLosers ? lastLosers.id : null;
                }
            });
        }

        data.matches = matches.filter((m) => m.stage !== 'grand_final_reset');
        let gf = data.matches.find((m) => m.id === 'gf-m1') || data.matches.find((m) => m.stage === 'grand_final');
        if (!gf && lastLosers) {
            gf = {
                id: 'gf-m1',
                stage: 'grand_final',
                group: null,
                round: 1,
                slot: 0,
                p1: null,
                p2: null,
                winner: null,
                score1: null,
                score2: null,
                nextWin: null,
                nextLose: null,
            };
            data.matches.push(gf);
        }
        if (gf) {
            if (!gf.stage) gf.stage = 'grand_final';
            gf.nextWin = null;
        }

        return syncGrandFinal(data);
    }

    window.AbsBracketDouble = { generateDouble, repairLinks, syncGrandFinal };
})();
