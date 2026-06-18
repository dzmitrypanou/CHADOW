'use strict';

const BOARD_SIZES = [10, 20, 50];

const FLEETS = {
    10: [
        { len: 4, count: 1 },
        { len: 3, count: 2 },
        { len: 2, count: 3 },
        { len: 1, count: 4 },
    ],
    20: [
        { len: 6, count: 1 },
        { len: 5, count: 2 },
        { len: 4, count: 3 },
        { len: 3, count: 5 },
        { len: 2, count: 8 },
        { len: 1, count: 12 },
    ],
    50: [
        { len: 10, count: 2 },
        { len: 8, count: 3 },
        { len: 6, count: 5 },
        { len: 5, count: 6 },
        { len: 4, count: 10 },
        { len: 3, count: 15 },
        { len: 2, count: 25 },
        { len: 1, count: 40 },
    ],
};

function normalizeBoardSize(value) {
    const size = Number(value);
    return BOARD_SIZES.includes(size) ? size : 10;
}

function expandFleet(size) {
    const spec = FLEETS[size] || FLEETS[10];
    const lengths = [];
    spec.forEach(({ len, count }) => {
        for (let i = 0; i < count; i += 1) {
            lengths.push(len);
        }
    });
    return lengths;
}

function inBounds(size, r, c) {
    return r >= 0 && r < size && c >= 0 && c < size;
}

function cellKey(r, c) {
    return `${r},${c}`;
}

function getShipCells(r, c, len, horizontal) {
    const cells = [];
    for (let i = 0; i < len; i += 1) {
        cells.push(horizontal ? [r, c + i] : [r + i, c]);
    }
    return cells;
}

function neighbors(size, r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (inBounds(size, nr, nc)) out.push([nr, nc]);
        }
    }
    return out;
}

function canPlaceShip(occupied, size, cells) {
    const cellSet = new Set(cells.map(([r, c]) => cellKey(r, c)));
    for (const [r, c] of cells) {
        if (!inBounds(size, r, c)) return false;
        if (occupied.has(cellKey(r, c))) return false;
        for (const [nr, nc] of neighbors(size, r, c)) {
            if (cellSet.has(cellKey(nr, nc))) continue;
            if (occupied.has(cellKey(nr, nc))) return false;
        }
    }
    return true;
}

function randomPlacement(size) {
    const lengths = expandFleet(size).sort((a, b) => b - a);
    const occupied = new Set();
    const ships = [];

    for (const len of lengths) {
        let placed = false;
        for (let tries = 0; tries < 800 && !placed; tries += 1) {
            const horizontal = Math.random() < 0.5;
            const maxR = horizontal ? size : size - len;
            const maxC = horizontal ? size - len : size;
            if (maxR <= 0 || maxC <= 0) break;
            const r = Math.floor(Math.random() * maxR);
            const c = Math.floor(Math.random() * maxC);
            const cells = getShipCells(r, c, len, horizontal);
            if (!canPlaceShip(occupied, size, cells)) continue;
            cells.forEach(([cr, cc]) => occupied.add(cellKey(cr, cc)));
            ships.push({ len, cells, hits: [] });
            placed = true;
        }
        if (!placed) return null;
    }

    return ships;
}

function validateShips(size, shipsInput) {
    if (!Array.isArray(shipsInput)) {
        return { ok: false, error: 'invalid_fleet' };
    }

    const expected = expandFleet(size).sort((a, b) => b - a);
    const got = shipsInput.map((ship) => Number(ship.len) || 0).sort((a, b) => b - a);
    if (expected.length !== got.length) {
        return { ok: false, error: 'wrong_fleet' };
    }
    for (let i = 0; i < expected.length; i += 1) {
        if (expected[i] !== got[i]) {
            return { ok: false, error: 'wrong_fleet' };
        }
    }

    const occupied = new Set();
    const normalized = [];
    for (const ship of shipsInput) {
        const len = Number(ship.len) || 0;
        const cells = Array.isArray(ship.cells)
            ? ship.cells.map((pair) => [Number(pair[0]), Number(pair[1])])
            : [];
        if (cells.length !== len) {
            return { ok: false, error: 'invalid_ship' };
        }
        if (!canPlaceShip(occupied, size, cells)) {
            return { ok: false, error: 'invalid_placement' };
        }
        cells.forEach(([r, c]) => occupied.add(cellKey(r, c)));
        normalized.push({ len, cells, hits: [] });
    }

    return { ok: true, ships: normalized };
}

function createPlayerBoard() {
    return { ships: [], shots: [], ready: false };
}

function createInitialState(boardSize = 10) {
    const size = normalizeBoardSize(boardSize);
    return {
        boardSize: size,
        fleet: FLEETS[size],
        status: 'waiting',
        turn: 'host',
        winner: null,
        finishReason: null,
        lastShot: null,
        players: { host: null, guest: null },
        boards: { host: createPlayerBoard(), guest: createPlayerBoard() },
        updatedAt: Date.now(),
    };
}

function registerPlayer(state, role, clientId, nickname) {
    state.players[role] = { clientId, nickname };
    if (state.players.host && state.players.guest && state.status === 'waiting') {
        state.status = 'placement';
        state.turn = 'host';
    }
    state.updatedAt = Date.now();
}

function maybeStartPlaying(state) {
    if (state.status !== 'placement') return;
    if (state.boards.host.ready && state.boards.guest.ready) {
        state.status = 'playing';
        state.turn = 'host';
        state.lastShot = null;
    }
}

function setPlayerShips(state, role, ships) {
    if (state.status !== 'placement' && state.status !== 'waiting') {
        return { ok: false, error: 'placement_closed' };
    }
    const board = state.boards[role];
    board.ships = ships;
    board.shots = [];
    board.ready = true;
    maybeStartPlaying(state);
    state.updatedAt = Date.now();
    return { ok: true };
}

function autoPlace(state, role) {
    const ships = randomPlacement(state.boardSize);
    if (!ships) {
        return { ok: false, error: 'auto_place_failed' };
    }
    return setPlayerShips(state, role, ships);
}

function applyShot(state, role, r, c) {
    if (state.status !== 'playing') {
        return { ok: false, error: 'game_not_active' };
    }
    if (state.turn !== role) {
        return { ok: false, error: 'not_your_turn' };
    }

    const enemy = role === 'host' ? 'guest' : 'host';
    const size = state.boardSize;
    const row = Number(r);
    const col = Number(c);
    if (!Number.isInteger(row) || !Number.isInteger(col) || !inBounds(size, row, col)) {
        return { ok: false, error: 'out_of_bounds' };
    }

    const shooterBoard = state.boards[role];
    if (shooterBoard.shots.some(([sr, sc]) => sr === row && sc === col)) {
        return { ok: false, error: 'already_shot' };
    }

    const enemyBoard = state.boards[enemy];
    const key = cellKey(row, col);
    let result = 'miss';
    let sunkShip = null;

    for (const ship of enemyBoard.ships) {
        const hitCell = ship.cells.find(([cr, cc]) => cellKey(cr, cc) === key);
        if (!hitCell) continue;
        if (!ship.hits.includes(key)) {
            ship.hits.push(key);
        }
        result = 'hit';
        if (ship.hits.length >= ship.cells.length) {
            result = 'sunk';
            sunkShip = { len: ship.len, cells: ship.cells.slice() };
        }
        break;
    }

    shooterBoard.shots.push([row, col, result]);
    state.lastShot = { r: row, c: col, result, by: role, sunk: sunkShip };

    const allSunk = enemyBoard.ships.length > 0
        && enemyBoard.ships.every((ship) => ship.hits.length >= ship.cells.length);
    if (allSunk) {
        state.status = 'finished';
        state.winner = role;
        state.finishReason = 'all_sunk';
    } else if (result === 'miss') {
        state.turn = enemy;
    }

    state.updatedAt = Date.now();
    return { ok: true, result };
}

function serializeShip(ship) {
    return {
        len: ship.len,
        cells: ship.cells.slice(),
        hits: ship.hits.slice(),
        sunk: ship.hits.length >= ship.cells.length,
    };
}

function publicState(state, role) {
    const own = state.boards[role];
    const enemyRole = role === 'host' ? 'guest' : 'host';
    const enemy = state.boards[enemyRole];

    return {
        boardSize: state.boardSize,
        fleet: state.fleet,
        status: state.status,
        turn: state.turn,
        winner: state.winner,
        finishReason: state.finishReason,
        lastShot: state.lastShot,
        players: state.players,
        you: role,
        placementReady: {
            host: state.boards.host.ready,
            guest: state.boards.guest.ready,
        },
        ownBoard: {
            ships: own.ships.map(serializeShip),
            ready: own.ready,
            incomingShots: enemy.shots.slice(),
        },
        enemyBoard: {
            shots: own.shots.slice(),
            ships: state.status === 'finished'
                ? enemy.ships.map((ship) => ({ len: ship.len, cells: ship.cells.slice() }))
                : [],
        },
        updatedAt: state.updatedAt,
    };
}

function resign(state, role) {
    if (state.status === 'finished') {
        return { ok: false, error: 'game_not_active' };
    }
    state.status = 'finished';
    state.winner = role === 'host' ? 'guest' : 'host';
    state.finishReason = 'resign';
    state.updatedAt = Date.now();
    return { ok: true };
}

module.exports = {
    BOARD_SIZES,
    FLEETS,
    normalizeBoardSize,
    expandFleet,
    createInitialState,
    publicState,
    registerPlayer,
    validateShips,
    autoPlace,
    setPlayerShips,
    applyShot,
    resign,
    randomPlacement,
};
