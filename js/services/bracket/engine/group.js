(() => {
    'use strict';

    const BRACKET_MIN_GROUPS = 2;
    const BRACKET_MAX_GROUPS = 32;
    const POST_GROUP_STAGES = new Set(['playoff', 'winners', 'losers', 'grand_final', 'grand_final_reset']);
    const { generateSingle } = window.AbsBracketSingle;

    function distributeGroups(participants, groupCount) {
        const groups = Array.from({ length: groupCount }, () => []);
        participants.forEach((p, i) => {
            groups[i % groupCount].push(p);
        });
        return groups;
    }

    function roundRobinPairs(n) {
        const pairs = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                pairs.push([i, j]);
            }
        }
        return pairs;
    }

    /**
     * @param {string[]} participants
     * @param {{ groupCount?: number, advancePerGroup?: number }} settings
     */
    function generateGroup(participants, settings = {}) {
        let groups;
        let groupCount;

        if (Array.isArray(settings.groupParticipants) && settings.groupParticipants.length >= 2) {
            groups = settings.groupParticipants.map((g) =>
                (Array.isArray(g) ? g : [])
                    .map((p) => String(p).trim())
                    .filter((p) => p && !/^BYE/i.test(p))
            );
            groupCount = groups.length;
        } else {
            const names = participants.map((p) => String(p).trim()).filter(Boolean);
            const n = names.length;
            groupCount = parseInt(settings.groupCount, 10) || Math.min(4, Math.max(BRACKET_MIN_GROUPS, Math.ceil(n / 4)));
            groupCount = Math.max(BRACKET_MIN_GROUPS, Math.min(BRACKET_MAX_GROUPS, groupCount));
            while (groupCount > n) groupCount--;
            groups = distributeGroups(names, groupCount);
        }

        const names = groups.flat();
        if (names.length < 2) {
            throw new Error('At least 2 participants required');
        }
        if (groups.filter((g) => g.length > 0).length < 2) {
            throw new Error('At least 2 groups required');
        }

        groupCount = Math.max(BRACKET_MIN_GROUPS, Math.min(BRACKET_MAX_GROUPS, groupCount));

        let advancePerGroup = parseInt(settings.advancePerGroup, 10) || 2;
        const minGroupSize = Math.min(...groups.map((g) => g.length).filter((n) => n > 0));
        advancePerGroup = Math.max(1, Math.min(minGroupSize || 1, advancePerGroup));
        const matches = [];
        const groupMeta = [];

        groups.forEach((groupNames, g) => {
            const pairs = roundRobinPairs(groupNames.length);
            const standings = groupNames.map((name, idx) => ({
                idx,
                name,
                wins: 0,
                losses: 0,
                points: 0,
            }));

            groupMeta.push({ index: g, names: groupNames, standings });

            pairs.forEach(([a, b], mi) => {
                matches.push({
                    id: `g${g}-r1-m${mi + 1}`,
                    stage: 'group',
                    group: g,
                    round: 1,
                    slot: mi,
                    p1: a,
                    p2: b,
                    winner: null,
                    score1: null,
                    score2: null,
                    nextWin: null,
                    nextLose: null,
                });
            });
        });

        return {
            participants: names,
            settings: {
                groupCount,
                advancePerGroup,
                groups: groupMeta,
                playoffGenerated: false,
                playoffParticipants: null,
                playoffType: null,
            },
            matches,
        };
    }

    function computeGroupStandings(bracketData, groupIndex) {
        const settings = bracketData.settings || {};
        const groups = settings.groups || [];
        const group = groups[groupIndex];
        if (!group) return [];

        const names = group.names || [];
        const stats = names.map((name, idx) => ({
            idx,
            name,
            wins: 0,
            losses: 0,
            points: 0,
        }));

        const groupMatches = (bracketData.matches || []).filter(
            (m) => m.stage === 'group' && m.group === groupIndex && m.winner !== null
        );

        groupMatches.forEach((m) => {
            const w = m.winner;
            const l = w === m.p1 ? m.p2 : m.p1;
            if (typeof w === 'number' && stats[w]) {
                stats[w].wins++;
                stats[w].points += 3;
            }
            if (typeof l === 'number' && stats[l]) {
                stats[l].losses++;
            }
        });

        return stats.sort((a, b) => b.points - a.points || b.wins - a.wins);
    }

    function groupStageMatches(bracketData) {
        return (bracketData.matches || []).filter((m) => m.stage === 'group');
    }

    function collectGroupQualifiers(bracketData) {
        const settings = bracketData.settings || {};
        const groupCount = settings.groupCount || 0;
        const advancePerGroup = settings.advancePerGroup || 1;
        const qualifiers = [];

        for (let g = 0; g < groupCount; g++) {
            const standings = computeGroupStandings(bracketData, g);
            standings.slice(0, advancePerGroup).forEach((row) => {
                if (row.name) qualifiers.push(row.name);
            });
        }

        return qualifiers;
    }

    function getGroupStageStatus(bracketData) {
        const groupMatches = groupStageMatches(bracketData);
        const pending = groupMatches.filter((m) => m.winner === null || m.winner === undefined);
        const complete = groupMatches.length > 0 && pending.length === 0;
        const qualifiers = complete ? collectGroupQualifiers(bracketData) : [];

        return {
            complete,
            pendingCount: pending.length,
            totalGroupMatches: groupMatches.length,
            qualifierCount: qualifiers.length,
        };
    }

    function generatePlayoffSingleBracket(qualifierNames) {
        const playoff = generateSingle(qualifierNames);
        const idMap = {};

        playoff.matches.forEach((m) => {
            const newId = String(m.id).replace(/^w-/, 'p-');
            idMap[m.id] = newId;
            m.id = newId;
            m.stage = 'playoff';
        });

        playoff.matches.forEach((m) => {
            if (m.nextWin && idMap[m.nextWin]) {
                m.nextWin = idMap[m.nextWin];
            }
        });

        return {
            playoffParticipants: playoff.participants,
            matches: playoff.matches,
            playoffType: 'single',
        };
    }

    function generatePlayoffDoubleBracket(qualifierNames) {
        const playoff = window.AbsBracketDouble.generateDouble(qualifierNames);

        return {
            playoffParticipants: playoff.participants,
            matches: playoff.matches,
            playoffType: 'double',
        };
    }

    function stripPostGroupMatches(data) {
        data.matches = (data.matches || []).filter((m) => m.stage === 'group');
    }

    function buildPlayoffFromGroups(bracketData, playoffType = 'single') {
        const status = getGroupStageStatus(bracketData);
        if (!status.complete) {
            throw new Error('GROUP_STAGE_INCOMPLETE');
        }

        const qualifiers = collectGroupQualifiers(bracketData);
        if (qualifiers.length < 2) {
            throw new Error('NOT_ENOUGH_QUALIFIERS');
        }

        const data = JSON.parse(JSON.stringify(bracketData));
        const playoff = playoffType === 'double'
            ? generatePlayoffDoubleBracket(qualifiers)
            : generatePlayoffSingleBracket(qualifiers);

        stripPostGroupMatches(data);
        data.settings = data.settings || {};
        data.settings.playoffGenerated = true;
        data.settings.playoffParticipants = playoff.playoffParticipants;
        data.settings.playoffType = playoff.playoffType;
        data.matches.push(...playoff.matches);

        return data;
    }

    function placementsFromGroupWinners(bracketData) {
        const status = getGroupStageStatus(bracketData);
        if (!status.complete) return {};

        const settings = bracketData.settings || {};
        const groupCount = settings.groupCount || 0;
        const placements = {};

        for (let g = 0; g < groupCount; g++) {
            const standings = computeGroupStandings(bracketData, g);
            const winner = standings[0];
            if (winner?.name) {
                placements[`g${g}`] = [winner.name];
            }
        }

        return placements;
    }

    window.AbsBracketGroup = {
        POST_GROUP_STAGES,
        generateGroup,
        computeGroupStandings,
        distributeGroups,
        getGroupStageStatus,
        collectGroupQualifiers,
        buildPlayoffFromGroups,
        placementsFromGroupWinners,
        stripPostGroupMatches,
    };
})();
