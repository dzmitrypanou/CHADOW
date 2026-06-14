(() => {
    'use strict';

    const BOARD_SIZE = 8;

    function isDark(r, c) {
        return (r + c) % 2 === 1;
    }

    function posKey(r, c) {
        return r + '-' + c;
    }

    function createBoardRenderer(options) {
        const boardEl = options.boardEl;
        const onMove = options.onMove || (() => {});
        let state = null;
        let selected = null;
        let myColor = null;
        let suppressClick = false;
        let drag = null;
        let pointerBound = false;

        function canInteract() {
            return !!(state && state.status === 'playing' && state.turn === myColor);
        }

        function getCellCoords(target) {
            const cell = target && target.closest ? target.closest('.checkers-cell') : null;
            if (!cell || !boardEl.contains(cell)) return null;
            return [parseInt(cell.dataset.r, 10), parseInt(cell.dataset.c, 10)];
        }

        function isOwnPiece(r, c) {
            if (!state || !state.board) return false;
            const piece = state.board[r][c];
            return !!(piece && ((myColor === 'white' && piece > 0) || (myColor === 'black' && piece < 0)));
        }

        function findLegalMove(from, to) {
            const legal = state && state.legalMoves ? state.legalMoves : [];
            return legal.find((m) => m.from[0] === from[0] && m.from[1] === from[1]
                && m.to[0] === to[0] && m.to[1] === to[1]) || null;
        }

        function selectCell(r, c) {
            selected = [r, c];
            clearHighlights();
            const cell = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
            if (cell) cell.classList.add('checkers-cell--selected');
            highlightLegalMoves();
        }

        function executeMove(from, to) {
            onMove(from, to);
            selected = null;
            clearHighlights();
        }

        function clearHoverTarget() {
            if (!boardEl) return;
            boardEl.querySelectorAll('.checkers-cell--drop-hover').forEach((el) => {
                el.classList.remove('checkers-cell--drop-hover');
            });
        }

        function cleanupDrag() {
            if (drag && drag.pieceEl) {
                drag.pieceEl.classList.remove('checkers-piece--dragging');
            }
            if (drag && drag.ghost && drag.ghost.parentNode) {
                drag.ghost.parentNode.removeChild(drag.ghost);
            }
            if (boardEl) {
                boardEl.classList.remove('checkers-board--dragging');
            }
            clearHoverTarget();
            drag = null;
        }

        function positionGhost(clientX, clientY) {
            if (!drag || !drag.ghost) return;
            drag.ghost.style.left = clientX + 'px';
            drag.ghost.style.top = clientY + 'px';
        }

        function createDragGhost(pieceEl) {
            const rect = pieceEl.getBoundingClientRect();
            const ghost = pieceEl.cloneNode(true);
            ghost.classList.add('checkers-piece--ghost');
            ghost.style.width = rect.width + 'px';
            ghost.style.height = rect.height + 'px';
            ghost.style.left = rect.left + rect.width / 2 + 'px';
            ghost.style.top = rect.top + rect.height / 2 + 'px';
            document.body.appendChild(ghost);
            return ghost;
        }

        function highlightDropTarget(clientX, clientY) {
            clearHoverTarget();
            if (!drag) return;
            const coords = getCellCoords(document.elementFromPoint(clientX, clientY));
            if (!coords) return;
            const move = findLegalMove(drag.from, coords);
            if (!move) return;
            const cell = boardEl.querySelector('[data-r="' + coords[0] + '"][data-c="' + coords[1] + '"]');
            if (cell) cell.classList.add('checkers-cell--drop-hover');
        }

        function canStartDragFrom(r, c) {
            if (!canInteract()) return false;
            const legal = state.legalMoves || [];

            if (state.mustContinueFrom) {
                const forced = state.mustContinueFrom;
                return r === forced[0] && c === forced[1];
            }

            if (!isOwnPiece(r, c)) return false;
            return legal.some((m) => m.from[0] === r && m.from[1] === c);
        }

        function onPointerDown(e) {
            if (!boardEl || !canInteract() || e.button !== 0) return;
            const coords = getCellCoords(e.target);
            if (!coords) return;
            const r = coords[0];
            const c = coords[1];
            if (!canStartDragFrom(r, c)) return;

            const cell = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
            const pieceEl = cell ? cell.querySelector('.checkers-piece') : null;
            if (!pieceEl) return;

            selectCell(r, c);
            drag = {
                from: [r, c],
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
                pointerId: e.pointerId,
                pieceEl,
                ghost: null,
            };

            boardEl.classList.add('checkers-board--dragging');
            if (typeof boardEl.setPointerCapture === 'function') {
                boardEl.setPointerCapture(e.pointerId);
            }
        }

        function onPointerMove(e) {
            if (!drag || e.pointerId !== drag.pointerId) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.moved) {
                if ((dx * dx) + (dy * dy) < 36) return;
                drag.moved = true;
                drag.ghost = createDragGhost(drag.pieceEl);
                drag.pieceEl.classList.add('checkers-piece--dragging');
                e.preventDefault();
            }

            positionGhost(e.clientX, e.clientY);
            highlightDropTarget(e.clientX, e.clientY);
        }

        function onPointerUp(e) {
            if (!drag || e.pointerId !== drag.pointerId) return;

            if (typeof boardEl.releasePointerCapture === 'function') {
                try {
                    boardEl.releasePointerCapture(e.pointerId);
                } catch (err) {
                    // ignore
                }
            }

            if (drag.moved) {
                e.preventDefault();
                e.stopPropagation();
                const coords = getCellCoords(document.elementFromPoint(e.clientX, e.clientY));
                if (coords) {
                    const move = findLegalMove(drag.from, coords);
                    if (move) {
                        executeMove(move.from, move.to);
                    }
                }
                suppressClick = true;
                window.setTimeout(() => {
                    suppressClick = false;
                }, 0);
            }

            cleanupDrag();
        }

        function bindPointerDrag() {
            if (!boardEl || pointerBound) return;
            pointerBound = true;
            boardEl.addEventListener('pointerdown', onPointerDown);
            boardEl.addEventListener('pointermove', onPointerMove);
            boardEl.addEventListener('pointerup', onPointerUp);
            boardEl.addEventListener('pointercancel', onPointerUp);
        }

        function clearBoard() {
            if (!boardEl) return;
            boardEl.innerHTML = '';
            boardEl.style.gridTemplateColumns = 'repeat(' + BOARD_SIZE + ', 1fr)';
        }

        function renderPieces(board) {
            if (!boardEl || !board) return;
            boardEl.querySelectorAll('.checkers-piece').forEach((el) => el.remove());

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const piece = board[r][c];
                    if (!piece) continue;
                    const cell = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
                    if (!cell) continue;
                    const el = document.createElement('div');
                    el.className = 'checkers-piece';
                    if (piece > 0) el.classList.add('checkers-piece--white');
                    else el.classList.add('checkers-piece--black');
                    if (Math.abs(piece) === 2) el.classList.add('checkers-piece--king');
                    cell.appendChild(el);
                }
            }
        }

        function highlightLegalMoves() {
            if (!boardEl || !state || !selected) return;
            const legal = state.legalMoves || [];
            legal.forEach((move) => {
                if (move.from[0] !== selected[0] || move.from[1] !== selected[1]) return;
                const cell = boardEl.querySelector('[data-r="' + move.to[0] + '"][data-c="' + move.to[1] + '"]');
                if (cell) cell.classList.add('checkers-cell--target');
            });
        }

        function clearHighlights() {
            if (!boardEl) return;
            boardEl.querySelectorAll('.checkers-cell--selected').forEach((el) => {
                el.classList.remove('checkers-cell--selected');
            });
            boardEl.querySelectorAll('.checkers-cell--target').forEach((el) => {
                el.classList.remove('checkers-cell--target');
            });
        }

        function handleCellClick(r, c) {
            if (suppressClick || !state || state.status !== 'playing' || state.turn !== myColor) return;

            const piece = state.board[r][c];
            const legal = state.legalMoves || [];

            if (state.mustContinueFrom) {
                const forced = state.mustContinueFrom;
                const move = legal.find((m) => m.to[0] === r && m.to[1] === c
                    && m.from[0] === forced[0] && m.from[1] === forced[1]);
                if (move) {
                    onMove(move.from, move.to);
                    selected = null;
                    clearHighlights();
                }
                return;
            }

            if (selected) {
                const move = legal.find((m) => m.to[0] === r && m.to[1] === c
                    && m.from[0] === selected[0] && m.from[1] === selected[1]);
                if (move) {
                    onMove(move.from, move.to);
                    selected = null;
                    clearHighlights();
                    return;
                }
            }

            if (piece && ((myColor === 'white' && piece > 0) || (myColor === 'black' && piece < 0))) {
                const hasMoves = legal.some((m) => m.from[0] === r && m.from[1] === c);
                if (!hasMoves) return;
                selected = [r, c];
                clearHighlights();
                const cell = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
                if (cell) cell.classList.add('checkers-cell--selected');
                highlightLegalMoves();
                return;
            }

            selected = null;
            clearHighlights();
        }

        function buildGrid() {
            clearBoard();
            if (!boardEl) return;

            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = 'checkers-cell';
                    cell.classList.add(isDark(r, c) ? 'checkers-cell--dark' : 'checkers-cell--light');
                    cell.dataset.r = String(r);
                    cell.dataset.c = String(c);
                    cell.addEventListener('click', () => handleCellClick(r, c));
                    boardEl.appendChild(cell);
                }
            }
            bindPointerDrag();
        }

        return {
            mount(color) {
                myColor = color;
                buildGrid();
                const initialBoard = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (!isDark(r, c)) continue;
                        if (r <= 2) initialBoard[r][c] = -1;
                        else if (r >= 5) initialBoard[r][c] = 1;
                    }
                }
                renderPieces(initialBoard);
            },
            update(nextState) {
                cleanupDrag();
                state = nextState;
                renderPieces(nextState.board);
                clearHighlights();
                selected = null;

                if (nextState.mustContinueFrom) {
                    selected = nextState.mustContinueFrom.slice();
                    const selectedCell = boardEl.querySelector('[data-r="' + selected[0] + '"][data-c="' + selected[1] + '"]');
                    if (selectedCell) selectedCell.classList.add('checkers-cell--selected');
                    highlightLegalMoves();
                }

                if (nextState.lastMove) {
                    const fromCell = boardEl.querySelector('[data-r="' + nextState.lastMove.from[0] + '"][data-c="' + nextState.lastMove.from[1] + '"]');
                    const toCell = boardEl.querySelector('[data-r="' + nextState.lastMove.to[0] + '"][data-c="' + nextState.lastMove.to[1] + '"]');
                    if (fromCell) fromCell.classList.add('checkers-cell--last-from');
                    if (toCell) toCell.classList.add('checkers-cell--last-to');
                    window.setTimeout(() => {
                        if (fromCell) fromCell.classList.remove('checkers-cell--last-from');
                        if (toCell) toCell.classList.remove('checkers-cell--last-to');
                    }, 900);
                }
            },
        };
    }

    window.AbsCheckersBoard = {
        createBoardRenderer,
        isDark,
    };
})();
