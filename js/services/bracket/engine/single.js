(() => {
    'use strict';

    function nextPowerOfTwo(n) {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    }

    function bracketSeedOrder(size) {
        if (size <= 1) return [0];
        const half = bracketSeedOrder(size / 2);
        const result = [];
        for (let i = 0; i < half.length; i++) {
            result.push(half[i]);
            result.push(size - 1 - half[i]);
        }
        return result;
    }

    function padParticipants(participants, bracketSize = null) {
        const names = participants
            .map((p) => String(p).trim())
            .filter((p) => p && !/^BYE/i.test(p));
        let size = bracketSize;
        if (!size || size < 2) {
            size = nextPowerOfTwo(Math.max(names.length, 2));
        } else {
            size = nextPowerOfTwo(Math.max(bracketSize, names.length, 2));
        }
        const seeded = new Array(size).fill(null);
        const order = bracketSeedOrder(size);
        for (let i = 0; i < names.length && i < size; i++) {
            seeded[order[i]] = names[i];
        }
        return { seeded, size, names };
    }

    function generateSingle(participants, options = {}) {
        const names = participants
            .map((p) => String(p).trim())
            .filter((p) => p && !/^BYE/i.test(p));
        if (names.length < 2) {
            throw new Error('At least 2 participants required');
        }
        const { seeded, size } = padParticipants(names, options.bracketSize);
        const matches = [];
        const rounds = Math.log2(size);

        const roundMatches = [];
        for (let r = 0; r < rounds; r++) {
            roundMatches[r] = [];
        }

        for (let slot = 0; slot < size / 2; slot++) {
            const p1Idx = slot * 2;
            const p2Idx = slot * 2 + 1;
            const p1 = seeded[p1Idx];
            const p2 = seeded[p2Idx];
            const id = `w-r1-m${slot + 1}`;
            const match = {
                id,
                stage: 'winners',
                group: null,
                round: 1,
                slot,
                p1: p1 !== null ? p1Idx : null,
                p2: p2 !== null ? p2Idx : null,
                winner: null,
                score1: null,
                score2: null,
                nextWin: null,
                nextLose: null,
            };

            if (p1 === null && p2 !== null) {
                match.winner = p2Idx;
            } else if (p2 === null && p1 !== null) {
                match.winner = p1Idx;
            } else if (p1 === null && p2 === null) {
                match.winner = null;
            }

            roundMatches[0].push(match);
            matches.push(match);
        }

        for (let r = 1; r < rounds; r++) {
            const prevCount = roundMatches[r - 1].length;
            const count = prevCount / 2;
            for (let slot = 0; slot < count; slot++) {
                const id = `w-r${r + 1}-m${slot + 1}`;
                const match = {
                    id,
                    stage: 'winners',
                    group: null,
                    round: r + 1,
                    slot,
                    p1: null,
                    p2: null,
                    winner: null,
                    score1: null,
                    score2: null,
                    nextWin: r + 1 < rounds ? `w-r${r + 2}-m${Math.floor(slot / 2) + 1}` : null,
                    nextLose: null,
                };
                roundMatches[r].push(match);
                matches.push(match);
            }
        }

        for (let r = 0; r < rounds - 1; r++) {
            for (let slot = 0; slot < roundMatches[r].length; slot++) {
                const nextSlot = Math.floor(slot / 2);
                roundMatches[r][slot].nextWin = `w-r${r + 2}-m${nextSlot + 1}`;
            }
        }

        propagateByes(matches, seeded);

        return {
            participants: seeded.map((p, i) => p !== null ? p : `BYE ${i + 1}`),
            settings: {},
            matches,
        };
    }

    function propagateByes(matches, seeded) {
        const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
        let changed = true;
        while (changed) {
            changed = false;
            for (const m of matches) {
                if (m.winner === null || m.winner === undefined || !m.nextWin) continue;

                const next = byId[m.nextWin];
                if (!next) continue;

                const slot = m.slot ?? 0;
                const targetField = slot % 2 === 0 ? 'p1' : 'p2';
                if (next[targetField] !== m.winner) {
                    next[targetField] = m.winner;
                    changed = true;
                }

                if (next.p1 !== null && next.p2 !== null) {
                    const n1 = seeded[next.p1];
                    const n2 = seeded[next.p2];
                    if (n1 === null && n2 !== null && next.winner !== next.p2) {
                        next.winner = next.p2;
                        changed = true;
                    } else if (n2 === null && n1 !== null && next.winner !== next.p1) {
                        next.winner = next.p1;
                        changed = true;
                    }
                }
            }
        }
    }

    window.AbsBracketSingle = { generateSingle, padParticipants, nextPowerOfTwo, bracketSeedOrder };
})();
