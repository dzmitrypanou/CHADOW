(() => {

    'use strict';

    const Prizes = window.AbsBracketPrizes;

    const Group = window.AbsBracketGroup;

    function participantName(participants, idx) {

        if (idx === null || idx === undefined) return '';

        const name = participants[idx];

        if (!name || /^BYE/i.test(String(name))) return '';

        return String(name).trim();

    }

    function matchLoser(match) {

        if (match.winner === null || match.winner === undefined) return null;

        if (match.p1 === null || match.p2 === null) return null;

        return match.winner === match.p1 ? match.p2 : match.p1;

    }

    function resolveParticipants(bracketData) {

        if (bracketData.settings?.playoffParticipants) {

            return bracketData.settings.playoffParticipants;

        }

        return bracketData.participants || [];

    }

    function tierPlaceCount(tier) {

        if (tier === '1' || tier === '2') return 1;

        const m = String(tier).match(/^(\d+)-(\d+)$/);

        if (!m) return 0;

        return parseInt(m[2], 10) - parseInt(m[1], 10) + 1;

    }

    function roundForTier(tier, maxRound) {

        const count = tierPlaceCount(tier);

        if (count <= 0) return null;

        if (tier === '1' || tier === '2') return maxRound;

        const depth = Math.log2(count);

        if (!Number.isFinite(depth) || !Number.isInteger(depth)) return null;

        return maxRound - depth;

    }

    function placementsFromElimStage(matches, participants, stage) {

        const stageMatches = matches.filter((m) => m.stage === stage);

        const placements = {};

        if (!stageMatches.length) return placements;

        const byRound = {};

        stageMatches.forEach((m) => {

            const r = m.round || 1;

            if (!byRound[r]) byRound[r] = [];

            byRound[r].push(m);

        });

        const roundKeys = Object.keys(byRound).map(Number);

        if (!roundKeys.length) return placements;

        const maxRound = Math.max(...roundKeys);

        const finalMatches = byRound[maxRound] || [];

        const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;

        if (finalMatch && finalMatch.winner !== null && finalMatch.winner !== undefined) {

            const winnerName = participantName(participants, finalMatch.winner);

            if (winnerName) placements['1'] = [winnerName];

            const loserName = participantName(participants, matchLoser(finalMatch));

            if (loserName) placements['2'] = [loserName];

        }

        const filledCount = participants.filter((p) => p && !/^BYE/i.test(String(p))).length;

        const size = Prizes.nextPowerOfTwo(Math.max(2, filledCount || participants.length));

        const tiers = Prizes.getPrizeTiers(size, { bracketSize: true });

        tiers.forEach((tier) => {

            if (tier === '1' || tier === '2') return;

            const round = roundForTier(tier, maxRound);

            if (!round || round < 1) return;

            const roundMatches = (byRound[round] || []).sort((a, b) => (a.slot || 0) - (b.slot || 0));

            const names = [];

            roundMatches.forEach((match) => {

                const name = participantName(participants, matchLoser(match));

                if (name) names.push(name);

            });

            if (names.length) placements[tier] = names;

        });

        return placements;

    }

    function placementsFromDoubleElim(matches, participants) {

        const placements = {};

        const gf = matches.find((m) => m.stage === 'grand_final');

        if (gf && gf.winner !== null && gf.winner !== undefined) {

            const winnerName = participantName(participants, gf.winner);

            if (winnerName) placements['1'] = [winnerName];

            const loserName = participantName(participants, matchLoser(gf));

            if (loserName) placements['2'] = [loserName];

        }

        const wbPlacements = placementsFromElimStage(matches, participants, 'winners');

        Object.keys(wbPlacements).forEach((tier) => {

            if (tier === '1' || tier === '2') return;

            if (!placements[tier]) placements[tier] = wbPlacements[tier];

        });

        return placements;

    }

    function hasGeneratedPlayoff(bracketData, format) {

        const settings = bracketData?.settings || {};

        if (!settings.playoffGenerated) return false;

        const matches = bracketData?.matches || [];

        if (format === 'group_se' || (format === 'group' && settings.playoffType !== 'double')) {

            return matches.some((m) => m.stage === 'playoff');

        }

        if (format === 'group_de' || settings.playoffType === 'double') {

            return matches.some((m) => m.stage === 'winners' || m.stage === 'losers' || m.stage === 'grand_final');

        }

        return matches.some((m) => m.stage === 'playoff');

    }

    function computePlacements(bracketData, format) {

        if (!bracketData?.matches) return {};

        const matches = bracketData.matches;

        if (format === 'double') {

            return placementsFromDoubleElim(matches, bracketData.participants || []);

        }

        if (Prizes.isPureGroupFormat(format)) {

            return Group.placementsFromGroupWinners(bracketData);

        }

        if (format === 'group_se' || format === 'group') {

            if (!hasGeneratedPlayoff(bracketData, format)) return {};

            const participants = resolveParticipants(bracketData);

            return placementsFromElimStage(matches, participants, 'playoff');

        }

        if (format === 'group_de') {

            if (!hasGeneratedPlayoff(bracketData, format)) return {};

            const participants = resolveParticipants(bracketData);

            return placementsFromDoubleElim(matches, participants);

        }

        const participants = bracketData.participants || [];

        return placementsFromElimStage(matches, participants, 'winners');

    }

    function resolveBracketSize(item) {

        const bracketData = item?.bracket_data || {};

        if (bracketData.settings?.bracketSize) {

            return bracketData.settings.bracketSize;

        }

        if (Prizes.isGroupFamilyFormat(item?.format)) {

            return Math.max(2, (bracketData.participants || []).length);

        }

        const count = (bracketData.participants || []).length;

        return Prizes.nextPowerOfTwo(Math.max(2, count));

    }

    function resolvePrizeTierOptions(item) {

        const format = item?.format || 'single';

        const bracketData = item?.bracket_data || {};

        const participantCount = resolveBracketSize(item);

        if (Prizes.isPureGroupFormat(format)) {

            return {

                groupCount: bracketData.settings?.groupCount || 2,

            };

        }

        return { bracketSize: format !== 'group' && !Prizes.isGroupFamilyFormat(format) };

    }

    function buildResultRows(item) {

        const format = item?.format || 'single';

        const bracketData = item?.bracket_data;

        const prizePool = item?.prize_pool || {};

        const bracketSize = resolveBracketSize(item);

        const tierOptions = resolvePrizeTierOptions(item);

        const tiers = item?.prize_tiers || Prizes.resolvePrizeTiers(format, bracketSize, tierOptions);

        const placements = computePlacements(bracketData, format);

        return tiers.map((tier) => ({

            tier,

            names: placements[tier] || [],

            prize: prizePool[tier] || '',

        }));

    }

    function hasKnownResults(item) {

        return buildResultRows(item).some((row) => row.names.length > 0);

    }

    window.AbsBracketPlacements = {

        computePlacements,

        buildResultRows,

        hasKnownResults,

    };

})();

