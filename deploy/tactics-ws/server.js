'use strict';

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.TACTICS_WS_PORT || '8791', 10);
const SECRET = process.env.TACTICS_WS_SECRET || '';
const MAX_PARTICIPANTS = parseInt(process.env.TACTICS_MAX_PARTICIPANTS || '20', 10);

if (!SECRET) {
    console.error('TACTICS_WS_SECRET is required');
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
    if (expectedBuf.length !== sigBuf.length) {
        return null;
    }
    if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) {
        return null;
    }
    try {
        const payload = JSON.parse(b64urlDecode(payloadB64));
        if (!payload || !payload.pid || !payload.cid) return null;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

const rooms = new Map();

function sanitizeNickColor(color) {
    if (!color || typeof color !== 'string') return null;
    const trimmed = color.trim();
    const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return '#' + hex;
}

function getRoomParticipants(publicId) {
    const room = rooms.get(publicId);
    if (!room) return [];
    return Array.from(room.entries()).map(([clientId, entry]) => {
        const item = {
            clientId,
            nickname: entry.nickname,
        };
        if (entry.nickColor) {
            item.nickColor = entry.nickColor;
        }
        return item;
    });
}

function broadcast(publicId, message, exceptWs) {
    const room = rooms.get(publicId);
    if (!room) return;
    const raw = JSON.stringify(message);
    room.forEach((entry) => {
        if (entry.ws !== exceptWs && entry.ws.readyState === 1) {
            entry.ws.send(raw);
        }
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    if (url.pathname === '/presence') {
        const token = url.searchParams.get('token') || '';
        const auth = verifyToken(token);
        if (!auth) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            success: true,
            participants: getRoomParticipants(auth.pid),
        }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('chadow tactics ws\n');
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

    const publicId = auth.pid;
    const clientId = auth.cid;
    const nickname = auth.nick || 'Guest';

    if (!rooms.has(publicId)) {
        rooms.set(publicId, new Map());
    }
    const room = rooms.get(publicId);

    if (room.size >= MAX_PARTICIPANTS && !room.has(clientId)) {
        ws.close(4429, 'Room full');
        return;
    }

    room.set(clientId, { ws, nickname, nickColor: null });

    ws.send(JSON.stringify({
        type: 'joined',
        publicId,
        clientId,
        revision: null,
        participants: getRoomParticipants(publicId),
    }));

    broadcast(publicId, {
        type: 'presence',
        participants: getRoomParticipants(publicId),
    }, ws);

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(String(data));
        } catch (e) {
            return;
        }
        if (!msg || !msg.type) return;

        if (msg.type === 'join') {
            const entry = room.get(clientId);
            if (entry) {
                if (msg.nickname) {
                    entry.nickname = String(msg.nickname).slice(0, 32);
                }
                if (msg.nickColor) {
                    const color = sanitizeNickColor(String(msg.nickColor));
                    if (color) {
                        entry.nickColor = color;
                    }
                }
            }
            const participants = getRoomParticipants(publicId);
            ws.send(JSON.stringify({ type: 'presence', participants }));
            broadcast(publicId, { type: 'presence', participants }, ws);
            return;
        }

        if (msg.type === 'nick_color') {
            const entry = room.get(clientId);
            if (entry && msg.color) {
                const color = sanitizeNickColor(String(msg.color));
                if (color) {
                    entry.nickColor = color;
                    const participants = getRoomParticipants(publicId);
                    broadcast(publicId, { type: 'presence', participants });
                }
            }
            return;
        }

        if (msg.type === 'op' || msg.type === 'slide' || msg.type === 'settings' || msg.type === 'cursor' || msg.type === 'chat') {
            msg.from = clientId;
            broadcast(publicId, msg, ws);
        }
    });

    ws.on('close', () => {
        const closedWs = ws;
        setTimeout(() => {
            const entry = room.get(clientId);
            if (!entry || entry.ws !== closedWs) {
                return;
            }
            room.delete(clientId);
            if (room.size === 0) {
                rooms.delete(publicId);
            } else {
                broadcast(publicId, {
                    type: 'presence',
                    participants: getRoomParticipants(publicId),
                });
            }
        }, 2500);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Tactics WS listening on 127.0.0.1:' + PORT);
});
