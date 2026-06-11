(() => {
    'use strict';

    const I18n = window.AbsBracketI18n;

    const ICONS = {
        csgo: '/assets/icons/games/cs2.png',
        dota2: '/assets/icons/games/dota2.png',
        mirTankov: '/assets/icons/games/mir-tankov.png',
        worldOfTanks: '/assets/icons/games/wot-white.png',
    };

    const GAMES = {
        wot: {
            id: 'wot',
            hasRealms: true,
            labelKeyMir: 'gameMirTankov',
            labelKeyWg: 'gameWot',
        },
        csgo: {
            id: 'csgo',
            icon: ICONS.csgo,
            hasRealms: false,
            labelKey: 'gameCsgo',
        },
        dota2: {
            id: 'dota2',
            icon: ICONS.dota2,
            hasRealms: false,
            labelKey: 'gameDota2',
        },
    };

    const PICKER_GAMES = [
        { id: 'mir_tankov', icon: ICONS.mirTankov, labelKey: 'gameMirTankov' },
        { id: 'world_of_tanks', icon: ICONS.worldOfTanks, labelKey: 'gameWot', hasWgRealms: true },
        { id: 'csgo', icon: ICONS.csgo, labelKey: 'gameCsgo', game: 'csgo' },
        { id: 'dota2', icon: ICONS.dota2, labelKey: 'gameDota2', game: 'dota2' },
    ];

    const REALMS = {
        ru: { flag: 'fi-ru', label: 'RU' },
        eu: { flag: 'fi-eu', label: 'EU' },
        na: { flag: 'fi-us', label: 'NA' },
        asia: { flag: 'fi-jp', label: 'ASIA' },
    };

    const WG_REALMS = ['eu', 'na', 'asia'];
    const ALL_GAMES = ['wot', 'csgo', 'dota2'];
    const ALL_REALMS = ['ru', 'eu', 'na', 'asia'];

    function esc(text) {
        const d = document.createElement('span');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function normalizeGame(game) {
        const key = String(game || 'wot').toLowerCase();
        return GAMES[key] ? key : 'wot';
    }

    function normalizeRealm(realm) {
        const key = String(realm || 'ru').toLowerCase();
        return REALMS[key] ? key : 'ru';
    }

    function isMirTankovRealm(realm) {
        const normalized = normalizeRealm(realm);
        return normalized === 'ru';
    }

    function resolvePickerId(game, realm) {
        const g = normalizeGame(game);
        if (g === 'csgo') return 'csgo';
        if (g === 'dota2') return 'dota2';
        return isMirTankovRealm(realm) ? 'mir_tankov' : 'world_of_tanks';
    }

    function resolveWgRealm(realm) {
        const normalized = normalizeRealm(realm);
        return WG_REALMS.includes(normalized) ? normalized : 'eu';
    }

    function gameIconUrl(game, realm) {
        const g = normalizeGame(game);
        if (g === 'wot') {
            return isMirTankovRealm(realm) ? ICONS.mirTankov : ICONS.worldOfTanks;
        }
        return GAMES[g].icon;
    }

    function gameLabel(game, realm) {
        const g = normalizeGame(game);
        const cfg = GAMES[g];
        if (g === 'wot') {
            return I18n?.t(isMirTankovRealm(realm) ? cfg.labelKeyMir : cfg.labelKeyWg) || g;
        }
        return I18n?.t(cfg.labelKey) || g;
    }

    function realmLabel(realm) {
        return REALMS[normalizeRealm(realm)]?.label || String(realm || '').toUpperCase();
    }

    function displayLabel(game, realm) {
        const g = normalizeGame(game);
        let text = gameLabel(g, realm);
        if (g === 'wot' && realm && !isMirTankovRealm(realm)) {
            text += ` · ${realmLabel(realm)}`;
        }
        return text;
    }

    function gameBadgeHtml(game, realm, extraClass) {
        const g = normalizeGame(game);
        const cls = ['bracket-game-badge', extraClass].filter(Boolean).join(' ');
        const icon = gameIconUrl(g, realm);
        const label = displayLabel(g, realm);
        return `<span class="${esc(cls)}">
            <img class="bracket-game-badge__icon" src="${esc(icon)}" width="20" height="20" alt="" loading="lazy" decoding="async">
            <span class="bracket-game-badge__label">${esc(label)}</span>
        </span>`;
    }

    function renderPicker(options = {}) {
        const selectedPicker = resolvePickerId(options.game, options.realm || 'ru');
        const selectedWgRealm = resolveWgRealm(options.realm || 'eu');
        const pickerName = options.pickerInputName || 'game_pick';
        const realmName = options.realmInputName || 'game_realm';
        const gameIdPrefix = options.idPrefix || 'bracketGame';
        const showWgRealms = selectedPicker === 'world_of_tanks';

        const gameOptions = PICKER_GAMES.map((item) => {
            const active = item.id === selectedPicker ? ' is-active' : '';
            const label = I18n.t(item.labelKey);
            return `<label class="bracket-game-option${active}">
                <input type="radio" name="${esc(pickerName)}" value="${esc(item.id)}" class="bracket-game-option__input"${item.id === selectedPicker ? ' checked' : ''}>
                <span class="bracket-game-option__card">
                    <img class="bracket-game-option__icon" src="${esc(item.icon)}" width="32" height="32" alt="">
                    <span class="bracket-game-option__name">${esc(label)}</span>
                </span>
            </label>`;
        }).join('');

        const realmOptions = WG_REALMS.map((id) => {
            const cfg = REALMS[id];
            const active = id === selectedWgRealm ? ' is-active' : '';
            return `<label class="bracket-realm-option${active}">
                <input type="radio" name="${esc(realmName)}" value="${esc(id)}" class="bracket-realm-option__input"${id === selectedWgRealm ? ' checked' : ''}>
                <span class="bracket-realm-option__card">
                    <span class="bracket-realm-option__flag fi ${esc(cfg.flag)}" aria-hidden="true"></span>
                    <span class="bracket-realm-option__name">${esc(cfg.label)}</span>
                </span>
            </label>`;
        }).join('');

        return `
            <div class="bracket-form-group bracket-game-picker-wrap" data-bracket-game-picker>
                <span class="bracket-form-label" id="${esc(gameIdPrefix)}Label">${esc(I18n.t('fieldGame'))}</span>
                <div class="bracket-game-picker" role="radiogroup" aria-labelledby="${esc(gameIdPrefix)}Label">${gameOptions}</div>
                <div class="bracket-realm-picker${showWgRealms ? '' : ' is-hidden'}" data-bracket-realm-picker role="radiogroup" aria-label="${esc(I18n.t('fieldGameRealm'))}">
                    <span class="bracket-form-label bracket-realm-picker__label">${esc(I18n.t('fieldGameRealm'))}</span>
                    <div class="bracket-realm-picker__grid">${realmOptions}</div>
                </div>
            </div>
        `;
    }

    function wirePicker(root) {
        if (!root) return;

        const updateActive = (selector, input) => {
            root.querySelectorAll(selector).forEach((el) => {
                el.classList.toggle('is-active', el.contains(input));
            });
        };

        const syncWgRealmVisibility = () => {
            const pickerInput = root.querySelector('input[name="game_pick"]:checked')
                || root.querySelector('input[name="game_pick"]');
            const realmPicker = root.querySelector('[data-bracket-realm-picker]');
            if (!realmPicker || !pickerInput) return;
            realmPicker.classList.toggle('is-hidden', pickerInput.value !== 'world_of_tanks');
        };

        root.querySelectorAll('.bracket-game-option__input').forEach((input) => {
            input.addEventListener('change', () => {
                updateActive('.bracket-game-option', input.closest('.bracket-game-option'));
                syncWgRealmVisibility();
            });
        });

        root.querySelectorAll('.bracket-realm-option__input').forEach((input) => {
            input.addEventListener('change', () => {
                updateActive('.bracket-realm-option', input.closest('.bracket-realm-option'));
            });
        });

        syncWgRealmVisibility();
    }

    function refreshPickerI18n(root) {
        if (!root || !I18n) return;

        root.querySelectorAll('.bracket-game-option').forEach((option) => {
            const input = option.querySelector('.bracket-game-option__input');
            const name = option.querySelector('.bracket-game-option__name');
            if (!input || !name) return;
            const item = PICKER_GAMES.find((g) => g.id === input.value);
            if (item) name.textContent = I18n.t(item.labelKey);
        });

        const gameLabel = root.querySelector('[data-bracket-game-picker] > .bracket-form-label')
            || root.querySelector('.bracket-form-label');
        if (gameLabel) gameLabel.textContent = I18n.t('fieldGame');

        const realmLabelEl = root.querySelector('.bracket-realm-picker__label');
        if (realmLabelEl) realmLabelEl.textContent = I18n.t('fieldGameRealm');
    }

    function collectFrom(root) {
        if (!root) {
            return { game: 'wot', game_realm: 'ru' };
        }

        const pickerInput = root.querySelector('input[name="game_pick"]:checked');
        const pickerId = pickerInput?.value || 'mir_tankov';

        if (pickerId === 'mir_tankov') {
            return { game: 'wot', game_realm: 'ru' };
        }

        if (pickerId === 'world_of_tanks') {
            const realmInput = root.querySelector('input[name="game_realm"]:checked');
            return { game: 'wot', game_realm: resolveWgRealm(realmInput?.value) };
        }

        if (pickerId === 'csgo' || pickerId === 'dota2') {
            return { game: pickerId, game_realm: null };
        }

        return { game: 'wot', game_realm: 'ru' };
    }

    window.AbsBracketGames = {
        GAMES,
        PICKER_GAMES,
        REALMS,
        WG_REALMS,
        ICONS,
        ALL_GAMES,
        ALL_REALMS,
        normalizeGame,
        normalizeRealm,
        isMirTankovRealm,
        resolvePickerId,
        gameLabel,
        realmLabel,
        gameIconUrl,
        displayLabel,
        gameBadgeHtml,
        renderPicker,
        wirePicker,
        refreshPickerI18n,
        collectFrom,
    };
})();
