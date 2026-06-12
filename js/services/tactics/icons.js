(() => {
    'use strict';

    const MARKERS = {
        heavy: {
            viewBox: '0 0 14 18',
            path: 'M 7 0 L 12.02 6.45 L 5.02 15.45 L 0 9 Z M 11.49 5.77 L 9.51 3.22 L 2.51 12.22 L 4.49 14.77 Z M 14 9 L 8.98 2.55 L 1.98 11.55 L 7 18 Z',
            striped: true,
        },
        medium: {
            viewBox: '0 0 10 14',
            path: 'M 5 0 L 10 7 L 5 14 L 0 7 Z',
        },
        light: {
            viewBox: '0 0 10 14',
            path: 'M 5 0 L 7.75 3.85 L 2.75 10.85 L 0 7 Z M 10 7 L 7.25 3.15 L 2.25 10.15 L 5 14 Z',
        },
        td: {
            viewBox: '0 0 12 11',
            path: 'M 0 0 L 12 0 L 6 11 Z',
            sizeScale: 0.8,
        },
        spg: {
            viewBox: '0 0 8 8',
            path: 'M 0 0 L 8 0 L 8 8 L 0 8 Z',
            sizeScale: 0.8,
        },
    };

    const ICONS = [
        { id: 'check', fa: 'fa-check' },
        { id: 'xmark', fa: 'fa-xmark' },
        { id: 'circle-question', fa: 'fa-circle-question' },
        { id: 'circle-info', fa: 'fa-circle-info' },
        { id: 'triangle-exclamation', fa: 'fa-triangle-exclamation' },
        { id: 'house', fa: 'fa-house' },
        { id: 'ban', fa: 'fa-ban' },
        { id: 'car-side', fa: 'fa-car-side' },
        { id: 'face-smile', fa: 'fa-face-smile' },
        { id: 'face-frown', fa: 'fa-face-frown' },
        { id: 'crosshairs', fa: 'fa-crosshairs' },
        { id: 'flag', fa: 'fa-flag' },
        { id: 'shield', fa: 'fa-shield' },
        { id: 'tree', fa: 'fa-tree' },
        { id: 'gem', fa: 'fa-gem' },
        { id: 'location-dot', fa: 'fa-location-dot' },
        { id: 'map-pin', fa: 'fa-map-pin' },
        { id: 'user', fa: 'fa-user' },
        { id: 'skull-crossbones', fa: 'fa-skull-crossbones' },
        { id: 'square', fa: 'fa-square' },
        { id: 'circle', fa: 'fa-circle' },
        { id: 'magnifying-glass', fa: 'fa-magnifying-glass' },
    ];

    const GLYPHS = {
        'fa-check': '\uf00c',
        'fa-xmark': '\uf00d',
        'fa-circle-question': '\uf059',
        'fa-circle-info': '\uf05a',
        'fa-triangle-exclamation': '\uf071',
        'fa-comment-exclamation': '\uf4af',
        'fa-comment-dots': '\uf4ad',
        'fa-house': '\uf015',
        'fa-ban': '\uf05e',
        'fa-binoculars': '\uf1e5',
        'fa-bomb': '\uf1e2',
        'fa-car-side': '\uf5e4',
        'fa-truck-pickup': '\uf63c',
        'fa-face-smile': '\uf118',
        'fa-face-frown': '\uf119',
        'fa-crosshairs': '\uf05b',
        'fa-flag': '\uf024',
        'fa-shield': '\uf132',
        'fa-tree': '\uf1bb',
        'fa-gem': '\uf3a5',
        'fa-location-dot': '\uf3c5',
        'fa-map-pin': '\uf276',
        'fa-user': '\uf007',
        'fa-skull-crossbones': '\uf714',
        'fa-square': '\uf0c8',
        'fa-circle': '\uf111',
        'fa-magnifying-glass': '\uf002',
    };

    window.AbsTacticsIcons = {
        MARKERS,
        ICONS,
        GLYPHS,
        markerKeys: () => Object.keys(MARKERS),
        getGlyph: (faClass) => GLYPHS[faClass] || '',
    };
})();
