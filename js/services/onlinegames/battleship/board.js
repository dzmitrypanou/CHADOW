(() => {
    'use strict';

    function cellKey(r, c) {
        return `${r},${c}`;
    }

    function createBoardRenderer(options) {
        const ownEl = options.ownEl;
        const enemyEl = options.enemyEl;
        const onShoot = options.onShoot || (() => {});

        let boardSize = 10;
        let myRole = 'host';

        function maxCellPx(size) {
            if (size <= 10) return 32;
            if (size <= 20) return 18;
            return 10;
        }

        function buildGrid(el, size) {
            if (!el) return;
            const cellPx = maxCellPx(size);
            el.style.setProperty('--bs-cell-size', `${cellPx}px`);
            el.style.setProperty('--bs-board-size', String(size));
            el.dataset.size = String(size);
            el.innerHTML = '';
            for (let r = 0; r < size; r += 1) {
                for (let c = 0; c < size; c += 1) {
                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = 'battleship-cell' + ((r + c) % 2 ? ' battleship-cell--alt' : '');
                    cell.dataset.r = String(r);
                    cell.dataset.c = String(c);
                    cell.setAttribute('aria-label', `${r + 1}, ${c + 1}`);
                    el.appendChild(cell);
                }
            }
        }

        function shipCellSet(ships) {
            const map = new Map();
            if (!Array.isArray(ships)) return map;
            ships.forEach((ship) => {
                const hits = new Set((ship.hits || []).map((key) => String(key)));
                (ship.cells || []).forEach(([r, c]) => {
                    map.set(cellKey(r, c), {
                        ship: true,
                        hit: hits.has(cellKey(r, c)),
                        sunk: !!ship.sunk,
                    });
                });
            });
            return map;
        }

        function shotMap(shots) {
            const map = new Map();
            if (!Array.isArray(shots)) return map;
            shots.forEach((entry) => {
                const r = Number(entry[0]);
                const c = Number(entry[1]);
                const result = entry[2] || 'miss';
                map.set(cellKey(r, c), result);
            });
            return map;
        }

        function paintOwnBoard(state) {
            if (!ownEl || !state) return;
            const own = state.ownBoard || {};
            const ships = shipCellSet(own.ships);
            const incoming = shotMap(own.incomingShots);
            const showShips = state.status === 'placement' || state.status === 'playing' || state.status === 'finished';

            ownEl.querySelectorAll('.battleship-cell').forEach((cell) => {
                const r = Number(cell.dataset.r);
                const c = Number(cell.dataset.c);
                const key = cellKey(r, c);
                const alt = (r + c) % 2 ? ' battleship-cell--alt' : '';
                cell.className = 'battleship-cell' + alt;
                cell.disabled = true;

                const shipInfo = ships.get(key);
                const incomingResult = incoming.get(key);

                if (showShips && shipInfo && shipInfo.ship) {
                    cell.classList.add('battleship-cell--ship');
                    if (shipInfo.hit) {
                        cell.classList.add('battleship-cell--hit');
                    }
                    if (shipInfo.sunk) {
                        cell.classList.add('battleship-cell--sunk');
                    }
                }

                if (incomingResult === 'miss') {
                    cell.classList.add('battleship-cell--miss');
                } else if (incomingResult === 'hit' || incomingResult === 'sunk') {
                    cell.classList.add('battleship-cell--hit');
                }
            });
        }

        function paintEnemyBoard(state) {
            if (!enemyEl || !state) return;
            const enemy = state.enemyBoard || {};
            const shots = shotMap(enemy.shots);
            const revealed = new Map();
            if (state.status === 'finished' && Array.isArray(enemy.ships)) {
                enemy.ships.forEach((ship) => {
                    (ship.cells || []).forEach(([r, c]) => {
                        revealed.set(cellKey(r, c), true);
                    });
                });
            }

            const canShoot = state.status === 'playing' && state.turn === state.you;

            enemyEl.querySelectorAll('.battleship-cell').forEach((cell) => {
                const r = Number(cell.dataset.r);
                const c = Number(cell.dataset.c);
                const key = cellKey(r, c);
                const result = shots.get(key);
                const alt = (r + c) % 2 ? ' battleship-cell--alt' : '';
                cell.className = 'battleship-cell' + alt;
                cell.disabled = !canShoot || !!result;

                if (result === 'miss') {
                    cell.classList.add('battleship-cell--miss');
                } else if (result === 'hit') {
                    cell.classList.add('battleship-cell--hit');
                } else if (result === 'sunk') {
                    cell.classList.add('battleship-cell--sunk');
                }

                if (revealed.has(key) && !result) {
                    cell.classList.add('battleship-cell--ship');
                }

                if (canShoot && !result) {
                    cell.classList.add('battleship-cell--targetable');
                }
            });
        }

        function mount(role, size) {
            myRole = role || 'host';
            boardSize = Number(size) || 10;
            buildGrid(ownEl, boardSize);
            buildGrid(enemyEl, boardSize);

            if (enemyEl) {
                enemyEl.onclick = (event) => {
                    const cell = event.target.closest('.battleship-cell');
                    if (!cell || cell.disabled) return;
                    const r = Number(cell.dataset.r);
                    const c = Number(cell.dataset.c);
                    onShoot(r, c);
                };
            }
        }

        function update(state) {
            if (!state) return;
            if (Number(state.boardSize) !== boardSize) {
                mount(state.you || myRole, state.boardSize);
            }
            paintOwnBoard(state);
            paintEnemyBoard(state);
        }

        return {
            mount,
            update,
        };
    }

    window.AbsBattleshipBoard = {
        createBoardRenderer,
    };
})();
