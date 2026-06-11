(() => {
    'use strict';

    const STAGE_ORDER = { group: 0, winners: 1, playoff: 2, losers: 3, grand_final: 4, grand_final_reset: 5 };
    const MatchFormat = window.AbsBracketMatchFormat;
    const BRACKET_SIZES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
    const BRACKET_MAX_PARTICIPANTS = 1024;

    function normalizeBracketSize(size) {
        const n = parseInt(size, 10);
        if (BRACKET_SIZES.includes(n)) return n;
        return 8;
    }

    function parseParticipantLines(text, size) {
        const lines = String(text || '').split(/\r?\n/).map((l) => l.trim());
        const names = [];
        const slotCount = normalizeBracketSize(size);
        for (let i = 0; i < slotCount; i++) {
            names.push(lines[i] || '');
        }
        return names;
    }

    function filledParticipantCount(names) {
        return (names || []).filter((n) => n && !/^BYE/i.test(String(n))).length;
    }

    function participantsToEditText(participants) {
        return (participants || [])
            .map((p) => (/^BYE/i.test(String(p || '')) ? '' : String(p || '')))
            .join('\n');
    }

    function resolveBracketSize(data) {
        const stored = data?.settings?.bracketSize;
        if (stored && BRACKET_SIZES.includes(Number(stored))) {
            return Number(stored);
        }
        const count = (data?.participants || []).length;
        if (count >= 2) {
            return window.AbsBracketSingle.nextPowerOfTwo(count);
        }
        return 8;
    }

    function hasMatchResults(bracketData) {
        return (bracketData?.matches || []).some((m) => (
            (m.winner !== null && m.winner !== undefined)
            || (m.score1 !== null && m.score1 !== undefined && m.score1 !== '')
            || (m.score2 !== null && m.score2 !== undefined && m.score2 !== '')
        ));
    }

    /**
     * @param {'single'|'double'|'group'|'group_se'|'group_de'} format
     * @param {string[]} participants
     * @param {object} [settings]
     */
    function generate(format, participants, settings = {}) {
        const list = (participants || [])
            .map((p) => String(p).trim())
            .filter((p) => p && !/^BYE/i.test(p));
        if (list.length < 2) {
            throw new Error('At least 2 participants required');
        }
        if (list.length > BRACKET_MAX_PARTICIPANTS) {
            throw new Error(`Maximum ${BRACKET_MAX_PARTICIPANTS} participants`);
        }

        const genSettings = { ...settings };
        if (genSettings.bracketSize) {
            genSettings.bracketSize = normalizeBracketSize(genSettings.bracketSize);
        }

        let data;
        switch (format) {
            case 'double':
                data = window.AbsBracketDouble.generateDouble(list, genSettings);
                break;
            case 'group':
            case 'group_se':
            case 'group_de':
                data = window.AbsBracketGroup.generateGroup(list, genSettings);
                break;
            case 'single':
            default:
                data = window.AbsBracketSingle.generateSingle(list, genSettings);
                break;
        }

        data.settings = data.settings || {};
        data.settings.matchFormat = MatchFormat.normalize(settings.matchFormat);
        if (genSettings.bracketSize) {
            data.settings.bracketSize = genSettings.bracketSize;
        } else if (window.AbsBracketPrizes?.isGroupFamilyFormat(format)) {
            data.settings.bracketSize = list.length;
        } else {
            data.settings.bracketSize = data.participants.length;
        }

        return data;
    }

    function regenerateWithParticipants(format, oldData, participantNames, options = {}) {
        const names = (participantNames || [])
            .map((p) => String(p).trim())
            .filter((p) => p && !/^BYE/i.test(p));
        if (names.length < 2) {
            throw new Error('At least 2 participants required');
        }

        const settings = {
            ...(oldData?.settings || {}),
            matchFormat: options.matchFormat || oldData?.settings?.matchFormat,
            bracketSize: normalizeBracketSize(options.bracketSize || oldData?.settings?.bracketSize || names.length),
        };

        if (window.AbsBracketPrizes?.isGroupFamilyFormat(format)) {
            settings.playoffGenerated = false;
            settings.playoffParticipants = null;
            settings.playoffType = null;
            if (Array.isArray(options.groupParticipants) && options.groupParticipants.length >= 2) {
                settings.groupParticipants = options.groupParticipants.map((g) =>
                    (Array.isArray(g) ? g : [])
                        .map((p) => String(p).trim())
                        .filter((p) => p && !/^BYE/i.test(p))
                );
                settings.groupCount = settings.groupParticipants.length;
                const flatNames = settings.groupParticipants.flat();
                return generate(format, flatNames, settings);
            }
        }

        return generate(format, names, settings);
    }

    function getMatchById(bracketData, id) {
        return (bracketData.matches || []).find((m) => m.id === id) || null;
    }

    function isSeededRound1(match) {
        return match.round === 1 && (match.stage === 'winners' || match.stage === 'playoff');
    }

    function isGroupMatch(match) {
        return match.stage === 'group';
    }

    function shouldResetParticipants(match) {
        if (isGroupMatch(match)) return false;
        if (isSeededRound1(match)) return false;
        return true;
    }

    function isGrandFinalMatch(match) {
        return match?.id === 'gf-m1' || match?.stage === 'grand_final';
    }

    function resolveParticipants(data) {
        return data.settings?.playoffParticipants || data.participants || [];
    }

    function assignToNextSlot(next, source, participantIdx, path) {
        if (participantIdx === null || participantIdx === undefined) return;

        const sourceStage = source.stage || 'winners';
        const nextStage = next.stage || 'winners';

        if (path === 'lose' && sourceStage === 'winners' && nextStage === 'losers') {
            if ((source.round || 1) === 1) {
                const slot = source.slot ?? 0;
                if (slot % 2 === 0) next.p1 = participantIdx;
                else next.p2 = participantIdx;
            } else {
                next.p2 = participantIdx;
            }
            return;
        }

        if (path === 'win' && sourceStage === 'losers' && isGrandFinalMatch(next)) {
            next.p2 = participantIdx;
            return;
        }

        if (path === 'win' && sourceStage === 'winners' && isGrandFinalMatch(next)) {
            next.p1 = participantIdx;
            return;
        }

        if (path === 'win' && sourceStage === 'playoff' && isGrandFinalMatch(next)) {
            next.p1 = participantIdx;
            return;
        }

        if (path === 'win' && sourceStage === 'losers' && nextStage === 'losers') {
            const sourceRound = source.round || 1;
            const nextRound = next.round || 1;
            if (nextRound === sourceRound + 1) {
                if (sourceRound % 2 === 1) {
                    next.p1 = participantIdx;
                    return;
                }
                const slot = source.slot ?? 0;
                if (slot % 2 === 0) next.p1 = participantIdx;
                else next.p2 = participantIdx;
                return;
            }
        }

        const slot = source.slot ?? 0;
        if (slot % 2 === 0) {
            next.p1 = participantIdx;
        } else {
            next.p2 = participantIdx;
        }
    }

    function propagateFromMatch(data, match) {
        if (match.winner === null || match.winner === undefined) return;

        const winnerIdx = match.winner;

        if (match.nextWin) {
            const next = getMatchById(data, match.nextWin);
            if (next) {
                assignToNextSlot(next, match, winnerIdx, 'win');
                autoBye(data, next, resolveParticipants(data));
            }
        }

        if (match.nextLose) {
            const loserIdx = match.winner === match.p1 ? match.p2 : match.p1;
            if (loserIdx !== null && loserIdx !== undefined) {
                const next = getMatchById(data, match.nextLose);
                if (next) {
                    assignToNextSlot(next, match, loserIdx, 'lose');
                    autoBye(data, next, resolveParticipants(data));
                }
            }
        }
    }

    function participantNameAt(data, match, participants, idx) {
        if (idx === null || idx === undefined) return '';
        if (isGroupMatch(match)) {
            return String(data.settings?.groups?.[match.group]?.names?.[idx] ?? '');
        }
        return String(participants[idx] ?? '');
    }

    function isRealParticipantName(name) {
        return Boolean(name && !/^BYE/i.test(name));
    }

    function getFeederMatch(data, match, side) {
        const stage = match.stage || 'winners';
        if (stage !== 'winners' && stage !== 'playoff') return null;
        const round = match.round || 1;
        if (round <= 1) return null;
        const slot = match.slot ?? 0;
        const feederSlot = side === 1 ? slot * 2 : slot * 2 + 1;
        return (data.matches || []).find((m) =>
            (m.stage || 'winners') === stage
            && (m.round || 1) === round - 1
            && (m.slot ?? 0) === feederSlot
        ) || null;
    }

    function feederCanStillPlay(data, feeder, participants) {
        const r1 = isRealParticipantName(participantNameAt(data, feeder, participants, feeder.p1));
        const r2 = isRealParticipantName(participantNameAt(data, feeder, participants, feeder.p2));
        if (r1 && r2) {
            return feeder.winner === null || feeder.winner === undefined;
        }
        return false;
    }

    function hasRealParticipantAt(data, match, participants, side) {
        const idx = side === 1 ? match.p1 : match.p2;
        if (idx === null || idx === undefined) return false;
        return isRealParticipantName(participantNameAt(data, match, participants, idx));
    }

    function matchHasRecordedResult(match) {
        return (match.score1 !== null && match.score1 !== undefined && match.score1 !== '')
            || (match.score2 !== null && match.score2 !== undefined && match.score2 !== '');
    }

    function clearStaleWalkoverWinner(data, match, participants) {
        if (match.winner === null || match.winner === undefined) return;
        if (matchHasRecordedResult(match)) return;
        if (!hasRealParticipantAt(data, match, participants, 1)) return;
        if (!hasRealParticipantAt(data, match, participants, 2)) return;
        match.winner = null;
        match.score1 = null;
        match.score2 = null;
    }

    function isPermanentEmptySlot(data, match, participants, side) {
        const idx = side === 1 ? match.p1 : match.p2;
        if (idx !== null && idx !== undefined) {
            return !isRealParticipantName(participantNameAt(data, match, participants, idx));
        }

        if (isSeededRound1(match)) {
            return true;
        }

        const stage = match.stage || 'winners';
        if (stage !== 'winners' && stage !== 'playoff') {
            return false;
        }

        const feeder = getFeederMatch(data, match, side);
        if (!feeder) {
            return true;
        }

        if (feederCanStillPlay(data, feeder, participants)) {
            return false;
        }

        if (feeder.winner !== null && feeder.winner !== undefined) {
            return false;
        }

        const feederHasReal = hasRealParticipantAt(data, feeder, participants, 1)
            || hasRealParticipantAt(data, feeder, participants, 2);
        return !feederHasReal;
    }

    function applyWalkover(data, match, winnerIdx) {
        if (match.winner !== winnerIdx) {
            match.winner = winnerIdx;
            match.score1 = null;
            match.score2 = null;
        }
        propagateFromMatch(data, match);
    }

    function autoBye(data, match, participants) {
        if (isGroupMatch(match)) {
            if (match.p1 === null || match.p1 === undefined || match.p2 === null || match.p2 === undefined) {
                return;
            }
            const n1 = participantNameAt(data, match, participants, match.p1);
            const n2 = participantNameAt(data, match, participants, match.p2);
            if (/^BYE/i.test(n1) && isRealParticipantName(n2)) {
                applyWalkover(data, match, match.p2);
            } else if (/^BYE/i.test(n2) && isRealParticipantName(n1)) {
                applyWalkover(data, match, match.p1);
            }
            return;
        }

        const stage = match.stage || 'winners';
        if (stage === 'winners' || stage === 'playoff') {
            clearStaleWalkoverWinner(data, match, participants);

            const empty1 = isPermanentEmptySlot(data, match, participants, 1);
            const empty2 = isPermanentEmptySlot(data, match, participants, 2);
            const real1 = hasRealParticipantAt(data, match, participants, 1);
            const real2 = hasRealParticipantAt(data, match, participants, 2);

            if (real1 && empty2 && !real2) {
                applyWalkover(data, match, match.p1);
                return;
            }
            if (real2 && empty1 && !real1) {
                applyWalkover(data, match, match.p2);
                return;
            }

            if (match.p1 === null || match.p1 === undefined || match.p2 === null || match.p2 === undefined) {
                return;
            }

            const n1 = participantNameAt(data, match, participants, match.p1);
            const n2 = participantNameAt(data, match, participants, match.p2);
            if (/^BYE/i.test(n1) && isRealParticipantName(n2)) {
                applyWalkover(data, match, match.p2);
            } else if (/^BYE/i.test(n2) && isRealParticipantName(n1)) {
                applyWalkover(data, match, match.p1);
            }
            return;
        }

        if (match.p1 === null || match.p1 === undefined || match.p2 === null || match.p2 === undefined) {
            return;
        }

        const n1 = participantNameAt(data, match, participants, match.p1);
        const n2 = participantNameAt(data, match, participants, match.p2);
        if (/^BYE/i.test(n1) && isRealParticipantName(n2)) {
            applyWalkover(data, match, match.p2);
        } else if (/^BYE/i.test(n2) && isRealParticipantName(n1)) {
            applyWalkover(data, match, match.p1);
        }
    }

    function sortMatches(matches) {
        return [...matches].sort((a, b) => {
            const sa = STAGE_ORDER[a.stage] ?? 99;
            const sb = STAGE_ORDER[b.stage] ?? 99;
            if (sa !== sb) return sa - sb;
            if (a.round !== b.round) return a.round - b.round;
            return (a.slot || 0) - (b.slot || 0);
        });
    }

    function rebuildBracket(data) {
        if ((data.matches || []).some((m) => m.stage === 'losers')
            && typeof window.AbsBracketDouble?.repairLinks === 'function') {
            window.AbsBracketDouble.repairLinks(data);
        }

        const matches = data.matches || [];
        const participants = resolveParticipants(data);

        matches.forEach((m) => {
            if (m.score1 === undefined) m.score1 = null;
            if (m.score2 === undefined) m.score2 = null;
        });

        for (const m of matches) {
            if (shouldResetParticipants(m)) {
                m.p1 = null;
                m.p2 = null;
            }
        }

        const sorted = sortMatches(matches);
        const maxPasses = Math.max(sorted.length, 4);

        for (let pass = 0; pass < maxPasses; pass++) {
            for (const m of sorted) {
                if (m.winner !== null && m.winner !== undefined) {
                    propagateFromMatch(data, m);
                }
            }
            for (const m of sorted) {
                autoBye(data, m, participants);
            }
        }

        for (const m of matches) {
            if (m.winner !== null && m.winner !== undefined
                && m.winner !== m.p1 && m.winner !== m.p2) {
                m.winner = null;
                m.score1 = null;
                m.score2 = null;
            }
        }

        if (typeof window.AbsBracketDouble?.syncGrandFinal === 'function') {
            window.AbsBracketDouble.syncGrandFinal(data);
        }

        return data;
    }

    function applyScoresToWinner(match, matchFormat) {
        MatchFormat.applyScoresToWinner(match, matchFormat);
    }

    function resolveMatchFormat(bracketData, matchFormat) {
        if (matchFormat) return MatchFormat.normalize(matchFormat);
        return MatchFormat.normalize(bracketData?.settings?.matchFormat);
    }

    function setMatchWinner(bracketData, matchId, winnerSide, matchFormat) {
        const data = JSON.parse(JSON.stringify(bracketData));
        const match = getMatchById(data, matchId);
        if (!match || match.p1 === null || match.p2 === null) return data;

        const fmt = resolveMatchFormat(data, matchFormat);
        const winnerIdx = winnerSide === 1 ? match.p1 : match.p2;
        if (match.winner === winnerIdx) {
            match.winner = null;
            match.score1 = null;
            match.score2 = null;
        } else {
            match.winner = winnerIdx;
            const scores = MatchFormat.winnerScores(winnerSide, fmt);
            match.score1 = scores.score1;
            match.score2 = scores.score2;
        }

        rebuildBracket(data);
        return data;
    }

    function setMatchScores(bracketData, matchId, score1, score2, matchFormat) {
        const data = JSON.parse(JSON.stringify(bracketData));
        const match = getMatchById(data, matchId);
        if (!match || match.p1 === null || match.p2 === null) return data;

        const fmt = resolveMatchFormat(data, matchFormat);
        const parseScore = (v) => {
            if (v === '' || v === null || v === undefined) return null;
            const n = parseInt(String(v), 10);
            return Number.isNaN(n) || n < 0 ? null : n;
        };

        match.score1 = parseScore(score1);
        match.score2 = parseScore(score2);
        applyScoresToWinner(match, fmt);
        rebuildBracket(data);
        return data;
    }

    function getGroupStageStatus(bracketData) {
        return window.AbsBracketGroup.getGroupStageStatus(bracketData);
    }

    function buildPlayoffFromGroups(bracketData, playoffType = 'single') {
        const data = window.AbsBracketGroup.buildPlayoffFromGroups(bracketData, playoffType);
        rebuildBracket(data);
        return data;
    }

    window.AbsBracketEngine = {
        BRACKET_SIZES,
        generate,
        normalizeBracketSize,
        parseParticipantLines,
        filledParticipantCount,
        participantsToEditText,
        resolveBracketSize,
        hasMatchResults,
        regenerateWithParticipants,
        getMatchById,
        setMatchWinner,
        setMatchScores,
        rebuildBracket,
        propagateFromMatch,
        getGroupStageStatus,
        buildPlayoffFromGroups,
        isGroupFamilyFormat: (...args) => window.AbsBracketPrizes?.isGroupFamilyFormat(...args),
        isPureGroupFormat: (...args) => window.AbsBracketPrizes?.isPureGroupFormat(...args),
        hasPlayoffFormat: (...args) => window.AbsBracketPrizes?.hasPlayoffFormat(...args),
    };
})();
