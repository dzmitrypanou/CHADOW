(() => {
    'use strict';

    const GROUP_FAMILY = ['group', 'group_se', 'group_de'];

    function nextPowerOfTwo(n) {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    }

    function getGroupWinnerTiers(groupCount) {
        const n = Math.max(2, Math.min(32, parseInt(groupCount, 10) || 2));
        return Array.from({ length: n }, (_, i) => `g${i}`);
    }

    function getPrizeTiers(participantCount, options = {}) {
        const cap = 1024;
        const raw = parseInt(participantCount, 10) || 2;
        const n = Math.max(2, Math.min(cap, raw));
        const size = options.bracketSize ? n : nextPowerOfTwo(n);
        const tiers = ['1', '2'];
        if (size >= 4) tiers.push('3-4');
        if (size >= 8) tiers.push('5-8');
        if (size >= 16) tiers.push('9-16');
        if (size >= 32) tiers.push('17-32');
        if (size >= 64) tiers.push('33-64');
        if (size >= 128) tiers.push('65-128');
        if (size >= 256) tiers.push('129-256');
        if (size >= 512) tiers.push('257-512');
        if (size >= 1024) tiers.push('513-1024');
        return tiers;
    }

    function isGroupFamilyFormat(format) {
        return GROUP_FAMILY.includes(String(format || ''));
    }

    function isPureGroupFormat(format) {
        return String(format || '') === 'group';
    }

    function hasPlayoffFormat(format) {
        const f = String(format || '');
        return f === 'group_se' || f === 'group_de';
    }

    function resolvePrizeTiers(format, participantCount, options = {}) {
        if (isPureGroupFormat(format)) {
            return getGroupWinnerTiers(options.groupCount || 2);
        }
        return getPrizeTiers(participantCount, options);
    }

    const PRIZE_UNIT_SUFFIX = {
        gold: { ru: 'ед. золота', en: 'gold' },
        rub: { ru: 'руб.', en: 'RUB' },
        usd: { ru: '$', en: '$' },
    };

    const PRIZE_UNIT_PARSE = [
        { unit: 'gold', suffixes: ['ед. золота', 'gold'] },
        { unit: 'rub', suffixes: ['руб.', 'RUB'] },
        { unit: 'usd', suffixes: ['$'] },
    ];

    function formatPrizeEntry(text, unit, lang = 'ru') {
        const value = String(text || '').trim();
        if (!value) return '';
        if (!unit) return value;
        const suffix = PRIZE_UNIT_SUFFIX[unit]?.[lang] || PRIZE_UNIT_SUFFIX[unit]?.ru;
        if (!suffix) return value;
        return `${value} ${suffix}`;
    }

    function parsePrizeEntry(stored) {
        const raw = String(stored || '').trim();
        if (!raw) return { text: '', unit: '' };

        for (const { unit, suffixes } of PRIZE_UNIT_PARSE) {
            for (const suffix of suffixes) {
                const tail = ` ${suffix}`;
                if (raw.endsWith(tail)) {
                    return {
                        text: raw.slice(0, raw.length - tail.length).trim(),
                        unit,
                    };
                }
            }
        }

        return { text: raw, unit: '' };
    }

    window.AbsBracketPrizes = {
        getPrizeTiers,
        getGroupWinnerTiers,
        resolvePrizeTiers,
        isGroupFamilyFormat,
        isPureGroupFormat,
        hasPlayoffFormat,
        nextPowerOfTwo,
        formatPrizeEntry,
        parsePrizeEntry,
        PRIZE_UNIT_SUFFIX,
    };
})();
