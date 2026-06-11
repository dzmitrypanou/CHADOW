(() => {
    'use strict';

    const FORMATS = {
        bo1: { bestOf: 1, winsNeeded: 1 },
        bo3: { bestOf: 3, winsNeeded: 2 },
        bo7: { bestOf: 7, winsNeeded: 4 },
        bo9: { bestOf: 9, winsNeeded: 5 },
    };

    const ALL = ['bo1', 'bo3', 'bo7', 'bo9'];

    function normalize(matchFormat) {
        const key = String(matchFormat || 'bo1').toLowerCase();
        return FORMATS[key] ? key : 'bo1';
    }

    function winsNeeded(matchFormat) {
        return FORMATS[normalize(matchFormat)].winsNeeded;
    }

    function maxScore(matchFormat) {
        return winsNeeded(matchFormat);
    }

    function label(matchFormat) {
        return normalize(matchFormat).toUpperCase();
    }

    function applyScoresToWinner(match, matchFormat) {
        const wins = winsNeeded(matchFormat);
        const s1 = match.score1;
        const s2 = match.score2;

        if ((s1 === null || s1 === undefined || s1 === '')
            && (s2 === null || s2 === undefined || s2 === '')) {
            match.winner = null;
            return;
        }
        if (s1 === null || s1 === undefined || s1 === ''
            || s2 === null || s2 === undefined || s2 === '') {
            return;
        }

        const n1 = parseInt(String(s1), 10);
        const n2 = parseInt(String(s2), 10);
        if (Number.isNaN(n1) || Number.isNaN(n2) || n1 < 0 || n2 < 0) {
            match.winner = null;
            return;
        }
        if (n1 > wins || n2 > wins) {
            match.winner = null;
            return;
        }
        if (n1 === n2) {
            match.winner = null;
            return;
        }
        if (Math.max(n1, n2) === wins) {
            match.winner = n1 > n2 ? match.p1 : match.p2;
        } else {
            match.winner = null;
        }
    }

    function winnerScores(winnerSide, matchFormat) {
        const wins = winsNeeded(matchFormat);
        return winnerSide === 1
            ? { score1: wins, score2: 0 }
            : { score1: 0, score2: wins };
    }

    window.AbsBracketMatchFormat = {
        ALL,
        normalize,
        winsNeeded,
        maxScore,
        label,
        applyScoresToWinner,
        winnerScores,
    };
})();
