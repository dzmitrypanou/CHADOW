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
        let placementOverlay = null;
        let layoutMode = 'dual';
        let resizeObserver = null;

        function neighbors(r, c) {
            const out = [];
            for (let dr = -1; dr <= 1; dr += 1) {
                for (let dc = -1; dc <= 1; dc += 1) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                        out.push([nr, nc]);
                    }
                }
            }
            return out;
        }

        function cellLimits(size) {
            if (size <= 10) return { min: 18, max: 36 };
            if (size <= 20) return { min: 6, max: 22 };
            return { min: 4, max: 14 };
        }

        function applyCellSize(el, cellPx) {
            if (!el) return;
            el.style.setProperty('--bs-cell-size', `${cellPx}px`);
        }

        function fitBoardInWrap(boardEl, wrapEl, size) {
            if (!boardEl || !wrapEl || size <= 0) return;
            const rect = wrapEl.getBoundingClientRect();
            const limits = cellLimits(size);
            const availW = Math.max(0, rect.width - 8);
            const availH = Math.max(0, rect.height - 8);
            if (availW < 8 || availH < 8) return;

            const fromW = availW / size;
            const fromH = availH / size;
            const cellPx = Math.max(
                limits.min,
                Math.min(limits.max, Math.floor(Math.min(fromW, fromH)))
            );
            applyCellSize(boardEl, cellPx);
        }

        function getVisibleBoardBlocks() {
            const blocks = [];
            document.querySelectorAll('.battleship-board-block').forEach((block) => {
                if (block.hidden || block.offsetParent === null) return;
                if (layoutMode === 'tabs' && !block.classList.contains('is-active')) return;
                blocks.push(block);
            });
            return blocks;
        }

        function resize() {
            if (layoutMode === 'placement') {
                const ownBlock = ownEl && ownEl.closest('.battleship-board-block');
                const ownWrap = ownBlock && ownBlock.querySelector('.battleship-board-wrap');
                fitBoardInWrap(ownEl, ownWrap, boardSize);
                return;
            }

            getVisibleBoardBlocks().forEach((block) => {
                const board = block.querySelector('.battleship-board');
                const wrap = block.querySelector('.battleship-board-wrap');
                if (board && wrap) {
                    fitBoardInWrap(board, wrap, boardSize);
                }
            });
        }

        function bindResizeObserver() {
            if (resizeObserver) return;
            const root = document.querySelector('.battleship-room-main');
            if (!root || typeof ResizeObserver === 'undefined') return;

            resizeObserver = new ResizeObserver(() => {
                window.requestAnimationFrame(() => resize());
            });
            resizeObserver.observe(root);
            const playLayout = root.querySelector('.battleship-play-layout');
            if (playLayout) resizeObserver.observe(playLayout);
        }

        function setLayoutMode(mode) {
            layoutMode = mode || 'dual';
            window.requestAnimationFrame(() => resize());
        }

        function buildGrid(el, size) {
            if (!el) return;
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
            const usePlacement = (state.status === 'placement' || state.status === 'waiting')
                && !own.ready
                && placementOverlay
                && Array.isArray(placementOverlay.ships);
            const ships = usePlacement
                ? shipCellSet(placementOverlay.ships)
                : shipCellSet(own.ships);
            const incoming = shotMap(own.incomingShots);
            const showShips = state.status === 'placement'
                || state.status === 'waiting'
                || state.status === 'playing'
                || state.status === 'finished';
            const preview = placementOverlay && placementOverlay.preview ? placementOverlay.preview : null;
            const previewKeys = new Set(
                preview && Array.isArray(preview.cells)
                    ? preview.cells.map(([pr, pc]) => cellKey(pr, pc))
                    : []
            );
            const placementActive = (state.status === 'placement' || state.status === 'waiting') && !own.ready;

            ownEl.querySelectorAll('.battleship-cell').forEach((cell) => {
                const r = Number(cell.dataset.r);
                const c = Number(cell.dataset.c);
                const key = cellKey(r, c);
                const alt = (r + c) % 2 ? ' battleship-cell--alt' : '';
                cell.className = 'battleship-cell' + alt;
                cell.disabled = !placementActive;
                cell.style.pointerEvents = placementActive ? '' : 'none';

                const shipInfo = ships.get(key);
                const incomingResult = incoming.get(key);

                if (showShips && shipInfo && shipInfo.ship) {
                    cell.classList.add('battleship-cell--ship');
                }

                if (previewKeys.has(key)) {
                    cell.classList.add('battleship-cell--ship');
                    cell.classList.add(preview.valid ? 'battleship-cell--preview' : 'battleship-cell--preview-invalid');
                }

                if (incomingResult === 'miss' || incomingResult === 'around') {
                    cell.classList.add(incomingResult === 'around' ? 'battleship-cell--around' : 'battleship-cell--miss');
                } else if (incomingResult === 'hit' || incomingResult === 'sunk') {
                    cell.classList.add('battleship-cell--hit');
                }

                if (!usePlacement && shipInfo && shipInfo.hit) {
                    cell.classList.add('battleship-cell--hit');
                }
                if (!usePlacement && shipInfo && shipInfo.sunk) {
                    cell.classList.add('battleship-cell--sunk');
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
                } else if (result === 'around') {
                    cell.classList.add('battleship-cell--around');
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
            bindResizeObserver();

            if (enemyEl) {
                enemyEl.onclick = (event) => {
                    const cell = event.target.closest('.battleship-cell');
                    if (!cell || cell.disabled) return;
                    const r = Number(cell.dataset.r);
                    const c = Number(cell.dataset.c);
                    onShoot(r, c);
                };
            }

            resize();
        }

        function update(state) {
            if (!state) return;
            if (Number(state.boardSize) !== boardSize) {
                mount(state.you || myRole, state.boardSize);
            }
            paintOwnBoard(state);
            paintEnemyBoard(state);
            resize();
        }

        function setPlacementOverlay(overlay) {
            placementOverlay = overlay;
        }

        function getBoardSize() {
            return boardSize;
        }

        function cellFromPoint(clientX, clientY) {
            if (!ownEl) return null;
            const target = document.elementFromPoint(clientX, clientY);
            const cell = target ? target.closest('.battleship-cell') : null;
            if (!cell || !ownEl.contains(cell)) return null;
            return {
                r: Number(cell.dataset.r),
                c: Number(cell.dataset.c),
            };
        }

        function getOwnEl() {
            return ownEl;
        }

        return {
            mount,
            update,
            setPlacementOverlay,
            setLayoutMode,
            resize,
            getBoardSize,
            getOwnEl,
            cellFromPoint,
            cellKey,
        };
    }

    window.AbsBattleshipBoard = {
        createBoardRenderer,
    };
})();
