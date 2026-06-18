(() => {
    'use strict';

    function cellKey(r, c) {
        return `${r},${c}`;
    }

    function expandFleet(fleetSpec) {
        const lengths = [];
        (fleetSpec || []).forEach((item) => {
            const len = Number(item.len) || 0;
            const count = Number(item.count) || 0;
            for (let i = 0; i < count; i += 1) {
                lengths.push(len);
            }
        });
        return lengths.sort((a, b) => b - a);
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
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    out.push([nr, nc]);
                }
            }
        }
        return out;
    }

    function canPlaceShip(occupied, size, cells) {
        const cellSet = new Set(cells.map(([r, c]) => cellKey(r, c)));
        for (const [r, c] of cells) {
            if (r < 0 || r >= size || c < 0 || c >= size) return false;
            if (occupied.has(cellKey(r, c))) return false;
            for (const [nr, nc] of neighbors(size, r, c)) {
                if (cellSet.has(cellKey(nr, nc))) continue;
                if (occupied.has(cellKey(nr, nc))) return false;
            }
        }
        return true;
    }

    function shipIsHorizontal(cells) {
        if (!cells || cells.length < 2) return true;
        return cells[0][0] === cells[1][0];
    }

    function createPlacementController(options) {
        const boardRenderer = options.boardRenderer;
        const dockEl = options.dockEl;
        const dockRowEl = options.dockRowEl;
        const dockCountEl = options.dockCountEl;
        const confirmBtn = options.confirmBtn;
        const formatDockCount = options.formatDockCount || ((count) => String(count));
        const onPlaceShips = options.onPlaceShips || (() => {});
        const onChange = options.onChange || (() => {});

        let active = false;
        let boardSize = 10;
        let dock = [];
        let placed = [];
        let dragging = null;
        let preview = null;
        let bound = false;
        let pointerId = null;
        let dragGhostEl = null;

        function getDockGroups() {
            const groups = new Map();
            dock.forEach((item, index) => {
                const len = item.len;
                if (!groups.has(len)) {
                    groups.set(len, []);
                }
                groups.get(len).push(index);
            });
            return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
        }

        function dockBarScale(len) {
            if (boardSize >= 50) return Math.min(len, 6);
            if (boardSize >= 20) return Math.min(len, 8);
            return len;
        }

        function removeDragGhost() {
            if (dragGhostEl) {
                dragGhostEl.remove();
                dragGhostEl = null;
            }
        }

        function updateDragGhostOrientation() {
            if (!dragGhostEl || !dragging) return;
            const ship = dragGhostEl.querySelector('.battleship-drag-ghost__ship');
            if (!ship) return;
            ship.classList.toggle('battleship-drag-ghost__ship--vertical', !dragging.horizontal);
        }

        function updateDragGhostPosition(clientX, clientY) {
            if (!dragGhostEl) return;
            dragGhostEl.style.transform = `translate(${clientX}px, ${clientY}px) translate(-50%, -50%)`;
        }

        function createDragGhost(len, horizontal) {
            removeDragGhost();
            dragGhostEl = document.createElement('div');
            dragGhostEl.className = 'battleship-drag-ghost';
            dragGhostEl.setAttribute('aria-hidden', 'true');
            const ship = document.createElement('span');
            ship.className = 'battleship-drag-ghost__ship';
            if (!horizontal) {
                ship.classList.add('battleship-drag-ghost__ship--vertical');
            }
            ship.style.setProperty('--ship-len', String(len));
            dragGhostEl.appendChild(ship);
            document.body.appendChild(dragGhostEl);
        }

        function buildOccupied(excludeId) {
            const occupied = new Set();
            placed.forEach((ship) => {
                if (ship.id === excludeId) return;
                ship.cells.forEach(([r, c]) => occupied.add(cellKey(r, c)));
            });
            return occupied;
        }

        function validateCells(cells, excludeId) {
            const occupied = buildOccupied(excludeId);
            return canPlaceShip(occupied, boardSize, cells);
        }

        function syncOverlay() {
            if (!boardRenderer) return;
            boardRenderer.setPlacementOverlay(active ? {
                ships: placed.map((ship) => ({ len: ship.len, cells: ship.cells, hits: [], sunk: false })),
                preview,
            } : null);
            if (options.onRepaint) {
                options.onRepaint();
            }
            onChange({
                active,
                dockLeft: dock.length,
                placedCount: placed.length,
                complete: active && dock.length === 0 && placed.length > 0,
            });
        }

        function renderDock() {
            if (!dockEl) return;
            const showDock = active && dock.length > 0;
            dockEl.innerHTML = '';
            if (dockRowEl) dockRowEl.hidden = !showDock;
            if (!showDock) {
                if (dockCountEl) dockCountEl.textContent = '';
                return;
            }
            if (dockCountEl) {
                dockCountEl.textContent = formatDockCount(dock.length);
            }
            getDockGroups().forEach(([len, indices]) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'battleship-dock-ship';
                btn.dataset.pickIndex = String(indices[0]);
                btn.dataset.len = String(len);
                btn.title = indices.length > 1 ? `${len} × ${indices.length}` : String(len);
                btn.setAttribute('aria-label', btn.title);
                const bar = document.createElement('span');
                bar.className = 'battleship-dock-ship__bar';
                bar.style.setProperty('--ship-len', String(dockBarScale(len)));
                btn.appendChild(bar);
                if (indices.length > 1) {
                    const count = document.createElement('span');
                    count.className = 'battleship-dock-ship__count';
                    count.textContent = String(indices.length);
                    btn.appendChild(count);
                }
                dockEl.appendChild(btn);
            });
        }

        function updateConfirm() {
            if (!confirmBtn) return;
            const complete = active && dock.length === 0 && placed.length > 0;
            confirmBtn.disabled = !complete;
            confirmBtn.hidden = !active;
        }

        function refresh() {
            renderDock();
            syncOverlay();
            updateConfirm();
        }

        function startDrag(len, horizontal, source) {
            dragging = {
                len,
                horizontal: !!horizontal,
                source,
            };
            preview = null;
            createDragGhost(len, dragging.horizontal);
            document.body.classList.add('battleship-dragging');
        }

        function endDrag() {
            dragging = null;
            preview = null;
            removeDragGhost();
            document.body.classList.remove('battleship-dragging');
            refresh();
        }

        function updatePreviewAt(r, c) {
            if (!dragging) return;
            const cells = getShipCells(r, c, dragging.len, dragging.horizontal);
            preview = {
                cells,
                valid: validateCells(cells, dragging.source && dragging.source.shipId),
            };
            syncOverlay();
        }

        function placeDraggingAt(r, c) {
            if (!dragging) return false;
            const cells = getShipCells(r, c, dragging.len, dragging.horizontal);
            const excludeId = dragging.source && dragging.source.shipId;
            if (!validateCells(cells, excludeId)) {
                return false;
            }

            if (dragging.source && dragging.source.type === 'board' && dragging.source.shipId) {
                placed = placed.filter((ship) => ship.id !== dragging.source.shipId);
            }
            if (dragging.source && dragging.source.type === 'dock' && dragging.source.dockIndex != null) {
                dock.splice(dragging.source.dockIndex, 1);
            }

            placed.push({
                id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
                len: dragging.len,
                cells,
            });
            endDrag();
            return true;
        }

        function pickShipFromBoard(shipId) {
            const ship = placed.find((item) => item.id === shipId);
            if (!ship) return;
            placed = placed.filter((item) => item.id !== shipId);
            startDrag(ship.len, shipIsHorizontal(ship.cells), {
                type: 'board',
                shipId,
                backupShip: { id: ship.id, len: ship.len, cells: ship.cells.slice() },
            });
            refresh();
        }

        function findShipAt(r, c) {
            const key = cellKey(r, c);
            return placed.find((ship) => ship.cells.some(([sr, sc]) => cellKey(sr, sc) === key)) || null;
        }

        function releasePointer(event) {
            if (pointerId != null && event.target && event.target.releasePointerCapture) {
                try {
                    event.target.releasePointerCapture(pointerId);
                } catch (e) {

                }
            }
            pointerId = null;
        }

        function onPointerDown(event) {
            if (!active) return;
            const dockBtn = event.target.closest('.battleship-dock-ship');
            if (dockBtn && dockEl && dockEl.contains(dockBtn)) {
                event.preventDefault();
                const index = Number(dockBtn.dataset.pickIndex);
                const item = dock[index];
                if (!item) return;
                pointerId = event.pointerId;
                if (dockBtn.setPointerCapture) {
                    dockBtn.setPointerCapture(event.pointerId);
                }
                startDrag(item.len, true, { type: 'dock', dockIndex: index });
                updateDragGhostPosition(event.clientX, event.clientY);
                const cell = boardRenderer.cellFromPoint(event.clientX, event.clientY);
                if (cell) updatePreviewAt(cell.r, cell.c);
                if (options.onRepaint) options.onRepaint();
                return;
            }

            const cell = boardRenderer.cellFromPoint(event.clientX, event.clientY);
            if (!cell) return;

            if (dragging) {
                event.preventDefault();
                if (placeDraggingAt(cell.r, cell.c)) {
                    releasePointer(event);
                }
                return;
            }

            const ship = findShipAt(cell.r, cell.c);
            if (!ship) return;
            event.preventDefault();
            const hitCell = event.target.closest('.battleship-cell');
            if (hitCell && hitCell.setPointerCapture) {
                pointerId = event.pointerId;
                hitCell.setPointerCapture(event.pointerId);
            }
            pickShipFromBoard(ship.id);
            updateDragGhostPosition(event.clientX, event.clientY);
            updatePreviewAt(cell.r, cell.c);
            if (options.onRepaint) options.onRepaint();
        }

        function onPointerMove(event) {
            if (!active || !dragging) return;
            updateDragGhostPosition(event.clientX, event.clientY);
            const cell = boardRenderer.cellFromPoint(event.clientX, event.clientY);
            if (!cell) {
                preview = null;
                syncOverlay();
                return;
            }
            updatePreviewAt(cell.r, cell.c);
        }

        function cancelDrag() {
            if (!dragging) return;
            if (dragging.source && dragging.source.type === 'board' && dragging.source.backupShip) {
                placed.push({
                    id: dragging.source.backupShip.id,
                    len: dragging.source.backupShip.len,
                    cells: dragging.source.backupShip.cells.slice(),
                });
            }
            endDrag();
            refresh();
        }

        function onPointerUp(event) {
            if (!active || !dragging) return;
            const cell = boardRenderer.cellFromPoint(event.clientX, event.clientY);
            if (!cell || !placeDraggingAt(cell.r, cell.c)) {
                cancelDrag();
            }
            releasePointer(event);
        }

        function onWheel(event) {
            if (!active || !dragging) return;
            event.preventDefault();
            dragging.horizontal = !dragging.horizontal;
            updateDragGhostOrientation();
            const cell = boardRenderer.cellFromPoint(event.clientX, event.clientY);
            if (cell) {
                updatePreviewAt(cell.r, cell.c);
            } else {
                syncOverlay();
            }
        }

        function bindEvents() {
            if (bound) return;
            bound = true;
            const ownEl = boardRenderer.getOwnEl && boardRenderer.getOwnEl();
            if (ownEl) {
                ownEl.addEventListener('pointerdown', onPointerDown);
                ownEl.addEventListener('pointermove', onPointerMove);
                ownEl.addEventListener('pointerup', onPointerUp);
            }
            if (dockEl) {
                dockEl.addEventListener('pointerdown', onPointerDown);
            }
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
            document.addEventListener('wheel', onWheel, { passive: false });
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    if (!active || dock.length > 0 || !placed.length) return;
                    onPlaceShips(placed.map((ship) => ({
                        len: ship.len,
                        cells: ship.cells.map(([r, c]) => [r, c]),
                    })));
                });
            }
        }

        function unbindEvents() {
            if (!bound) return;
            bound = false;
            const ownEl = boardRenderer.getOwnEl && boardRenderer.getOwnEl();
            if (ownEl) {
                ownEl.removeEventListener('pointerdown', onPointerDown);
                ownEl.removeEventListener('pointermove', onPointerMove);
                ownEl.removeEventListener('pointerup', onPointerUp);
            }
            if (dockEl) {
                dockEl.removeEventListener('pointerdown', onPointerDown);
            }
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            document.removeEventListener('wheel', onWheel);
        }

        function canPlaceNow(state) {
            if (!state || state.ownBoard.ready) return false;
            return state.status === 'placement' || state.status === 'waiting';
        }

        function start(state) {
            if (!canPlaceNow(state)) {
                stop();
                return;
            }
            boardSize = Number(state.boardSize) || boardRenderer.getBoardSize() || 10;
            active = true;
            dock = expandFleet(state.fleet).map((len) => ({ len }));
            placed = [];
            dragging = null;
            preview = null;
            bindEvents();
            refresh();
        }

        function stop() {
            active = false;
            dock = [];
            placed = [];
            dragging = null;
            preview = null;
            endDrag();
            removeDragGhost();
            if (dockRowEl) dockRowEl.hidden = true;
            if (dockEl) {
                dockEl.innerHTML = '';
            }
            if (confirmBtn) {
                confirmBtn.hidden = true;
                confirmBtn.disabled = true;
            }
            if (boardRenderer) {
                boardRenderer.setPlacementOverlay(null);
            }
        }

        function handleState(state) {
            if (!canPlaceNow(state)) {
                stop();
                return;
            }
            if (!active) {
                start(state);
            } else {
                boardSize = Number(state.boardSize) || boardRenderer.getBoardSize() || 10;
            }
        }

        function repaint(state) {
            if (active && state) {
                syncOverlay();
            }
        }

        return {
            handleState,
            repaint,
            stop,
            isActive: () => active,
        };
    }

    window.AbsBattleshipPlacement = {
        createPlacementController,
        expandFleet,
    };
})();
