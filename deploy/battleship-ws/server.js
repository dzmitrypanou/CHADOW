'use strict';

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const game = require('./game');

const PORT = parseInt(process.env.BATTLESHIP_WS_PORT || '8793', 10);
const SECRET = process.env.BATTLESHIP_WS_SECRET || '';
const ROOM_TTL_MS = parseInt(process.env.BATTLESHIP_ROOM_TTL_MS || String(4 * 60 * 60 * 1000), 10);

if (!SECRET) {
    console.error('BATTLESHIP_WS_SECRET is required');
    process.exit(1);
}

function b64urlDecode(data) {
    const pad = data.length % 4;
    if (pad > 0) data += '='.repeat(4 - pad);
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const expected = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const sigBuf = Buffer.from(sig, 'utf8');
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
        return null;
    }
    try {
        const payload = JSON.parse(b64urlDecode(payloadB64));
        if (!payload || !payload.pid || !payload.cid || !payload.color) return null;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (payload.color !== 'host' && payload.color !== 'guest') return null;
        return payload;
    } catch (e) {
        return null;
    }
}

const rooms = new Map();

function getRoom(roomId) {
    return rooms.get(roomId) || null;
}

function ensureRoom(roomId, boardSize) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            state: game.createInitialState(boardSize),
            sockets: new Map(),
            touchedAt: Date.now(),
            createdAt: Date.now(),
            chat: [],
            chatSeq: 0,
        });
    }
    const entry = rooms.get(roomId);
    entry.touchedAt = Date.now();
    return entry;
}

function sanitizeChatText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function pushChatMessage(entry, clientId, nickname, text) {
    entry.chatSeq += 1;
    const message = {
        id: entry.chatSeq,
        clientId,
        nickname: String(nickname || 'Guest').slice(0, 32),
        text,
        ts: Date.now(),
    };
    entry.chat.push(message);
    if (entry.chat.length > 100) {
        entry.chat.splice(0, entry.chat.length - 100);
    }
    return message;
}

function listOpenLobbies(limit) {
    const max = Math.max(1, Math.min(Number(limit) || 50, 100));
    const items = [];
    rooms.forEach((entry, roomId) => {
        const state = entry.state;
        if (state.status !== 'waiting') return;
        if (!state.players.host || state.players.guest) return;
        items.push({
            roomId,
            host: state.players.host.nickname || 'Guest',
            boardSize: state.boardSize,
            createdAt: entry.createdAt || entry.touchedAt,
        });
    });
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items.slice(0, max);
}

function broadcastRoom(roomId, message, exceptWs) {
    const entry = rooms.get(roomId);
    if (!entry) return;
    const raw = JSON.stringify(message);
    entry.sockets.forEach((ws) => {
        if (ws !== exceptWs && ws.readyState === 1) {
            ws.send(raw);
        }
    });
}

function sendState(roomId, exceptWs) {
    const entry = rooms.get(roomId);
    if (!entry) return;
    entry.sockets.forEach((ws, clientId) => {
        if (ws === exceptWs || ws.readyState !== 1) return;
        const role = findRoleByClient(entry.state, clientId);
        if (!role) return;
        ws.send(JSON.stringify({
            type: 'state',
            state: game.publicState(entry.state, role),
        }));
    });
}

function findRoleByClient(state, clientId) {
    if (state.players.host && state.players.host.clientId === clientId) return 'host';
    if (state.players.guest && state.players.guest.clientId === clientId) return 'guest';
    return null;
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 65536) {
                reject(new Error('Body too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (raw.trim() === '') {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function jsonResponse(res, code, payload) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    if (url.pathname === '/health') {
        jsonResponse(res, 200, { success: true, rooms: rooms.size });
        return;
    }

    if (url.pathname === '/lobbies' && req.method === 'GET') {
        const limit = url.searchParams.get('limit');
        jsonResponse(res, 200, {
            success: true,
            lobbies: listOpenLobbies(limit),
        });
        return;
    }

    if (url.pathname === '/rooms' && req.method === 'POST') {
        try {
            const body = await readJsonBody(req);
            const roomId = String(body.roomId || '').trim();
            const hostCid = String(body.hostCid || body.whiteCid || '').trim();
            const hostNick = String(body.hostNick || body.whiteNick || 'Guest').slice(0, 32);
            const boardSize = game.normalizeBoardSize(body.boardSize);
            if (!/^[A-Z0-9]{6}$/.test(roomId) || hostCid.length < 8) {
                jsonResponse(res, 400, { success: false, error: 'Invalid payload' });
                return;
            }
            if (rooms.has(roomId)) {
                jsonResponse(res, 409, { success: false, error: 'Room exists' });
                return;
            }
            const entry = ensureRoom(roomId, boardSize);
            game.registerPlayer(entry.state, 'host', hostCid, hostNick);
            jsonResponse(res, 200, { success: true, boardSize: entry.state.boardSize });
        } catch (e) {
            jsonResponse(res, 400, { success: false, error: 'Bad request' });
        }
        return;
    }

    const joinMatch = url.pathname.match(/^\/rooms\/([A-Z0-9]{6})\/join$/);
    if (joinMatch && req.method === 'POST') {
        const roomId = joinMatch[1];
        try {
            const body = await readJsonBody(req);
            const clientId = String(body.clientId || body.guestCid || '').trim();
            const nickname = String(body.nickname || body.guestNick || 'Guest').slice(0, 32);
            if (clientId.length < 8) {
                jsonResponse(res, 400, { success: false, error: 'Invalid payload' });
                return;
            }
            const entry = getRoom(roomId);
            if (!entry) {
                jsonResponse(res, 404, { success: false, error: 'Room not found' });
                return;
            }

            let role = null;
            if (entry.state.players.host && entry.state.players.host.clientId === clientId) {
                role = 'host';
                entry.state.players.host.nickname = nickname;
            } else if (entry.state.players.guest && entry.state.players.guest.clientId === clientId) {
                role = 'guest';
                entry.state.players.guest.nickname = nickname;
            } else if (!entry.state.players.guest) {
                game.registerPlayer(entry.state, 'guest', clientId, nickname);
                role = 'guest';
                broadcastRoom(roomId, { type: 'opponent_joined', players: entry.state.players });
                sendState(roomId);
            } else {
                jsonResponse(res, 409, { success: false, error: 'Room full' });
                return;
            }

            entry.touchedAt = Date.now();
            jsonResponse(res, 200, {
                success: true,
                status: entry.state.status,
                color: role,
                boardSize: entry.state.boardSize,
            });
        } catch (e) {
            jsonResponse(res, 400, { success: false, error: 'Bad request' });
        }
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('chadow battleship ws\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const auth = verifyToken(token);
    if (!auth) {
        ws.close(4401, 'Unauthorized');
        return;
    }

    const roomId = auth.pid;
    const clientId = auth.cid;
    const role = auth.color;
    const nickname = auth.nick || 'Guest';
    const entry = getRoom(roomId);
    if (!entry) {
        ws.close(4404, 'Room not found');
        return;
    }

    const registered = entry.state.players[role];
    if (!registered || registered.clientId !== clientId) {
        ws.close(4403, 'Forbidden');
        return;
    }

    entry.sockets.set(clientId, ws);
    entry.touchedAt = Date.now();
    registered.nickname = String(nickname).slice(0, 32);

    ws.send(JSON.stringify({
        type: 'joined',
        roomId,
        clientId,
        color: role,
        players: entry.state.players,
        state: game.publicState(entry.state, role),
        chat: entry.chat.slice(-100),
    }));

    broadcastRoom(roomId, {
        type: 'presence',
        players: entry.state.players,
    }, ws);

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(String(data));
        } catch (e) {
            return;
        }
        if (!msg || !msg.type) return;

        if (msg.type === 'auto_place') {
            const result = game.autoPlace(entry.state, role);
            if (!result.ok) {
                ws.send(JSON.stringify({ type: 'error', error: result.error }));
                return;
            }
            sendState(roomId);
            return;
        }

        if (msg.type === 'place_ships') {
            const validated = game.validateShips(entry.state.boardSize, msg.ships);
            if (!validated.ok) {
                ws.send(JSON.stringify({ type: 'error', error: validated.error }));
                return;
            }
            const result = game.setPlayerShips(entry.state, role, validated.ships);
            if (!result.ok) {
                ws.send(JSON.stringify({ type: 'error', error: result.error }));
                return;
            }
            sendState(roomId);
            if (entry.state.status === 'finished') {
                broadcastRoom(roomId, {
                    type: 'game_over',
                    winner: entry.state.winner,
                    reason: entry.state.finishReason,
                });
            }
            return;
        }

        if (msg.type === 'shoot') {
            const result = game.applyShot(entry.state, role, msg.r, msg.c);
            if (!result.ok) {
                ws.send(JSON.stringify({ type: 'shot_rejected', error: result.error }));
                return;
            }
            sendState(roomId);
            if (entry.state.status === 'finished') {
                broadcastRoom(roomId, {
                    type: 'game_over',
                    winner: entry.state.winner,
                    reason: entry.state.finishReason,
                });
            }
            return;
        }

        if (msg.type === 'resign') {
            const result = game.resign(entry.state, role);
            if (!result.ok) {
                ws.send(JSON.stringify({ type: 'error', error: result.error }));
                return;
            }
            sendState(roomId);
            broadcastRoom(roomId, {
                type: 'game_over',
                winner: entry.state.winner,
                reason: entry.state.finishReason,
            });
            return;
        }

        if (msg.type === 'chat') {
            const text = sanitizeChatText(msg.text);
            if (!text) return;
            const chatMessage = pushChatMessage(entry, clientId, registered.nickname, text);
            broadcastRoom(roomId, { type: 'chat', message: chatMessage });
        }
    });

    ws.on('close', () => {
        const current = entry.sockets.get(clientId);
        if (current === ws) {
            entry.sockets.delete(clientId);
        }
        broadcastRoom(roomId, {
            type: 'presence',
            players: entry.state.players,
            disconnected: clientId,
        });
    });
});

setInterval(() => {
    const now = Date.now();
    rooms.forEach((entry, roomId) => {
        if (now - entry.touchedAt > ROOM_TTL_MS) {
            entry.sockets.forEach((ws) => {
                try {
                    ws.close(1000, 'Room expired');
                } catch (e) {

                }
            });
            rooms.delete(roomId);
        }
    });
}, 60 * 1000);

server.listen(PORT, '127.0.0.1', () => {
    console.log('Battleship WS listening on 127.0.0.1:' + PORT);
});
