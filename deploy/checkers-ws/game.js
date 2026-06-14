'use strict';

const BOARD_SIZE = 8;

function isDark(r, c) {
    return (r + c) % 2 === 1;
}

function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function pieceColor(piece) {
    if (piece > 0) return 'white';
    if (piece < 0) return 'black';
    return null;
}

function isKing(piece) {
    return Math.abs(piece) === 2;
}

function isMan(piece) {
    return Math.abs(piece) === 1;
}

function createInitialBoard() {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!isDark(r, c)) continue;
            if (r <= 2) board[r][c] = -1;
            else if (r >= 5) board[r][c] = 1;
        }
    }
    return board;
}

function cloneBoard(board) {
    return board.map((row) => row.slice());
}

function forwardDirs(color) {
    return color === 'white' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function kingDirs() {
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}

function manCaptureDirs() {
    return kingDirs();
}

function promoteIfNeeded(board, r, c) {
    const piece = board[r][c];
    if (piece === 1 && r === 0) board[r][c] = 2;
    if (piece === -1 && r === BOARD_SIZE - 1) board[r][c] = -2;
}

function scanKingMoves(board, r, c, color, onlyCaptures) {
    const moves = [];
    const enemy = color === 'white' ? -1 : 1;

    for (const [dr, dc] of kingDirs()) {
        let nr = r + dr;
        let nc = c + dc;
        let sawEnemy = false;
        let enemyPos = null;

        while (inBounds(nr, nc) && isDark(nr, nc)) {
            const cell = board[nr][nc];
            if (cell === 0) {
                if (!sawEnemy) {
                    if (!onlyCaptures) {
                        moves.push({
                            from: [r, c],
                            to: [nr, nc],
                            captures: [],
                        });
                    }
                } else {
                    moves.push({
                        from: [r, c],
                        to: [nr, nc],
                        captures: [enemyPos],
                    });
                    break;
                }
            } else if (Math.sign(cell) === enemy) {
                if (sawEnemy) break;
                sawEnemy = true;
                enemyPos = [nr, nc];
            } else {
                break;
            }
            nr += dr;
            nc += dc;
        }
    }

    return moves;
}

function scanManMoves(board, r, c, color, onlyCaptures) {
    const moves = [];
    const enemy = color === 'white' ? -1 : 1;

    if (!onlyCaptures) {
        for (const [dr, dc] of forwardDirs(color)) {
            const nr = r + dr;
            const nc = c + dc;
            if (inBounds(nr, nc) && isDark(nr, nc) && board[nr][nc] === 0) {
                moves.push({ from: [r, c], to: [nr, nc], captures: [] });
            }
        }
    }

    for (const [dr, dc] of manCaptureDirs()) {
        const mr = r + dr;
        const mc = c + dc;
        const lr = r + dr * 2;
        const lc = c + dc * 2;
        if (!inBounds(mr, mc) || !inBounds(lr, lc)) continue;
        if (!isDark(mr, mc) || !isDark(lr, lc)) continue;
        if (Math.sign(board[mr][mc]) !== enemy) continue;
        if (board[lr][lc] !== 0) continue;
        moves.push({ from: [r, c], to: [lr, lc], captures: [[mr, mc]] });
    }

    return moves;
}

function movesForPiece(board, r, c, onlyCaptures) {
    const piece = board[r][c];
    if (piece === 0) return [];
    const color = pieceColor(piece);
    if (isKing(piece)) return scanKingMoves(board, r, c, color, onlyCaptures);
    return scanManMoves(board, r, c, color, onlyCaptures);
}

function applyMove(board, move) {
    const next = cloneBoard(board);
    const piece = next[move.from[0]][move.from[1]];
    next[move.from[0]][move.from[1]] = 0;
    next[move.to[0]][move.to[1]] = piece;
    for (const [cr, cc] of move.captures) {
        next[cr][cc] = 0;
    }
    return next;
}

function applyMoveAndPromote(board, move) {
    const next = applyMove(board, move);
    promoteIfNeeded(next, move.to[0], move.to[1]);
    return next;
}

function posKey(pos) {
    return pos[0] + ',' + pos[1];
}

function moveKey(move) {
    return posKey(move.from) + '>' + posKey(move.to) + ':' + move.captures.map(posKey).join('|');
}

function collectLegalMoves(board, color, continueFrom) {
    if (continueFrom) {
        const [r, c] = continueFrom;
        if (pieceColor(board[r][c]) !== color) return [];
        return movesForPiece(board, r, c, true).filter((m) => m.captures.length > 0);
    }

    let captureFirstMoves = [];
    let maxJumps = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (pieceColor(board[r][c]) !== color) continue;
            const sequences = buildCaptureSequences(board, color, [r, c]);
            for (const seq of sequences) {
                if (seq.length === 0) continue;
                if (seq.length > maxJumps) {
                    maxJumps = seq.length;
                    captureFirstMoves = [];
                }
                if (seq.length === maxJumps) {
                    captureFirstMoves.push(seq[0]);
                }
            }
        }
    }

    if (maxJumps > 0) {
        const seen = new Set();
        const unique = [];
        for (const move of captureFirstMoves) {
            const key = moveKey(move);
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(move);
        }
        return unique;
    }

    let moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (pieceColor(board[r][c]) !== color) continue;
            moves = moves.concat(movesForPiece(board, r, c, false));
        }
    }
    return moves;
}

function countPieces(board, color) {
    let count = 0;
    const sign = color === 'white' ? 1 : -1;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (Math.sign(board[r][c]) === sign) count++;
        }
    }
    return count;
}

function buildCaptureSequences(board, color, startFrom) {
    const sequences = [];

    function dfs(currentBoard, fromPos, path) {
        const caps = movesForPiece(currentBoard, fromPos[0], fromPos[1], true)
            .filter((m) => m.captures.length > 0);
        if (caps.length === 0) {
            sequences.push(path.slice());
            return;
        }
        for (const move of caps) {
            const nextBoard = applyMoveAndPromote(currentBoard, move);
            path.push(move);
            dfs(nextBoard, move.to, path);
            path.pop();
        }
    }

    dfs(board, startFrom, []);
    return sequences;
}

function chooseBestSequence(board, color, fromPos) {
    const sequences = buildCaptureSequences(board, color, fromPos);
    if (sequences.length === 0) return null;
    sequences.sort((a, b) => b.length - a.length);
    return sequences[0];
}

function finalizeMoveState(board, color, moveSequence) {
    const next = cloneBoard(board);
    let lastMove = null;

    for (const move of moveSequence) {
        const piece = next[move.from[0]][move.from[1]];
        next[move.from[0]][move.from[1]] = 0;
        next[move.to[0]][move.to[1]] = piece;
        for (const [cr, cc] of move.captures) {
            next[cr][cc] = 0;
        }
        lastMove = move;
    }

    if (lastMove) {
        promoteIfNeeded(next, lastMove.to[0], lastMove.to[1]);
    }

    return { board: next, lastMove, captures: moveSequence.reduce((acc, m) => acc + m.captures.length, 0) };
}

function createInitialState() {
    return {
        board: createInitialBoard(),
        turn: 'white',
        status: 'waiting',
        winner: null,
        finishReason: null,
        lastMove: null,
        mustContinueFrom: null,
        legalMoves: [],
        players: { white: null, black: null },
        updatedAt: Date.now(),
    };
}

function refreshLegalMoves(state) {
    if (state.status !== 'playing') {
        state.legalMoves = [];
        return;
    }
    state.legalMoves = collectLegalMoves(state.board, state.turn, state.mustContinueFrom);
    if (state.legalMoves.length === 0) {
        state.status = 'finished';
        state.winner = state.turn === 'white' ? 'black' : 'white';
        state.finishReason = 'no_moves';
    }
}

function startGame(state) {
    state.status = 'playing';
    state.turn = 'white';
    state.winner = null;
    state.finishReason = null;
    state.lastMove = null;
    state.mustContinueFrom = null;
    state.board = createInitialBoard();
    refreshLegalMoves(state);
}

function publicState(state, viewerColor) {
    return {
        board: state.board,
        turn: state.turn,
        status: state.status,
        winner: state.winner,
        finishReason: state.finishReason,
        lastMove: state.lastMove,
        mustContinueFrom: state.mustContinueFrom,
        legalMoves: viewerColor === state.turn || state.status !== 'playing'
            ? state.legalMoves
            : [],
        players: state.players,
        you: viewerColor,
        updatedAt: state.updatedAt,
    };
}

function registerPlayer(state, color, clientId, nickname) {
    state.players[color] = { clientId, nickname };
    if (state.players.white && state.players.black && state.status === 'waiting') {
        startGame(state);
    }
    state.updatedAt = Date.now();
}

function applyPlayerMove(state, color, from, to) {
    if (state.status !== 'playing') {
        return { ok: false, error: 'game_not_active' };
    }
    if (state.turn !== color) {
        return { ok: false, error: 'not_your_turn' };
    }

    const legal = collectLegalMoves(state.board, color, state.mustContinueFrom);
    const requested = legal.find((m) => m.from[0] === from[0] && m.from[1] === from[1]
        && m.to[0] === to[0] && m.to[1] === to[1]);
    if (!requested) {
        return { ok: false, error: 'illegal_move' };
    }

    state.board = applyMoveAndPromote(state.board, requested);
    state.lastMove = {
        from: requested.from,
        to: requested.to,
        captures: requested.captures.slice(),
    };

    if (requested.captures.length > 0) {
        const [tr, tc] = requested.to;
        const continued = movesForPiece(state.board, tr, tc, true)
            .filter((m) => m.captures.length > 0);
        if (continued.length > 0) {
            state.mustContinueFrom = requested.to;
        } else {
            state.mustContinueFrom = null;
            state.turn = color === 'white' ? 'black' : 'white';
        }
    } else {
        state.mustContinueFrom = null;
        state.turn = color === 'white' ? 'black' : 'white';
    }

    if (countPieces(state.board, state.turn === 'white' ? 'white' : 'black') === 0) {
        state.status = 'finished';
        state.winner = color;
        state.finishReason = 'capture_all';
        state.legalMoves = [];
    } else {
        refreshLegalMoves(state);
        if (state.status === 'finished' && state.winner === null) {
            state.winner = color;
        }
    }

    state.updatedAt = Date.now();
    return { ok: true };
}

function resign(state, color) {
    if (state.status !== 'playing' && state.status !== 'waiting') {
        return { ok: false, error: 'game_not_active' };
    }
    state.status = 'finished';
    state.winner = color === 'white' ? 'black' : 'white';
    state.finishReason = 'resign';
    state.mustContinueFrom = null;
    state.legalMoves = [];
    state.updatedAt = Date.now();
    return { ok: true };
}

module.exports = {
    BOARD_SIZE,
    isDark,
    createInitialState,
    publicState,
    registerPlayer,
    applyPlayerMove,
    resign,
    refreshLegalMoves,
};
