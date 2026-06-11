(() => {
    'use strict';

    class TacticsWsClient {
        constructor(options) {
            this.publicId = options.publicId;
            this.wsToken = options.wsToken;
            this.clientId = options.clientId;
            this.nickname = options.nickname;
            this.wsUrl = options.wsUrl;
            this.onOp = options.onOp || (() => {});
            this.onSettings = options.onSettings || (() => {});
            this.onPresence = options.onPresence || (() => {});
            this.onCursor = options.onCursor || (() => {});
            this.onChat = options.onChat || (() => {});
            this.onState = options.onState || (() => {});
            this.onConnection = options.onConnection || (() => {});
            this.ws = null;
            this.reconnectTimer = null;
            this.shouldReconnect = true;
        }

        connect() {
            if (!this.wsUrl || !this.wsToken) {
                this.onConnection('offline');
                return;
            }

            this.releaseWs();

            let url = this.wsUrl;
            if (url.indexOf('?') === -1) {
                url += '?';
            } else {
                url += '&';
            }
            url += 'token=' + encodeURIComponent(this.wsToken);

            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                this.onConnection('offline');
                this.scheduleReconnect();
                return;
            }

            this.ws.addEventListener('open', () => {
                this.send({
                    type: 'join',
                    publicId: this.publicId,
                    clientId: this.clientId,
                    nickname: this.nickname,
                });
                this.onConnection('connected');
            });

            this.ws.addEventListener('message', (ev) => {
                let msg;
                try {
                    msg = JSON.parse(ev.data);
                } catch (e) {
                    return;
                }
                this.handleMessage(msg);
            });

            this.ws.addEventListener('close', (ev) => {
                if (ev.code === 4401 || ev.code === 4403) {
                    this.onConnection('auth_failed');
                    return;
                }
                this.onConnection('reconnecting');
                this.scheduleReconnect();
            });

            this.ws.addEventListener('error', () => {
                this.onConnection('offline');
            });
        }

        releaseWs() {
            if (!this.ws) return;
            const prev = this.ws;
            this.ws = null;
            prev.onopen = null;
            prev.onmessage = null;
            prev.onerror = null;
            prev.onclose = null;
            if (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CLOSING) {
                try {
                    prev.close();
                } catch (e) {
                    // ignore
                }
            }
        }

        scheduleReconnect() {
            if (!this.shouldReconnect) return;
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 2500);
        }

        handleMessage(msg) {
            if (!msg || !msg.type) return;
            switch (msg.type) {
                case 'joined':
                    this.onState(msg);
                    if (Array.isArray(msg.participants)) {
                        this.onPresence(msg.participants);
                    }
                    break;
                case 'presence':
                    if (Array.isArray(msg.participants)) {
                        this.onPresence(msg.participants);
                    }
                    break;
                case 'op':
                    if (String(msg.from || '') !== String(this.clientId || '')) {
                        this.onOp(msg);
                    }
                    break;
                case 'slide':
                    if (String(msg.from || '') !== String(this.clientId || '')) {
                        this.onOp(msg);
                    }
                    break;
                case 'settings':
                    if (String(msg.from || '') !== String(this.clientId || '')) {
                        this.onSettings(msg);
                    }
                    break;
                case 'cursor':
                    if (String(msg.from || '') !== String(this.clientId || '')) {
                        this.onCursor(msg);
                    }
                    break;
                case 'chat':
                    if (String(msg.from || '') !== String(this.clientId || '')) {
                        this.onChat(msg);
                    }
                    break;
                case 'error':
                    console.warn('Tactics WS:', msg.message);
                    break;
                default:
                    break;
            }
        }

        send(payload) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
            this.ws.send(JSON.stringify(payload));
            return true;
        }

        sendOp(slideId, op, payload) {
            return this.send({
                type: 'op',
                slideId,
                op,
                payload,
                from: this.clientId,
            });
        }

        sendSlide(action, data) {
            return this.send({
                type: 'slide',
                action,
                from: this.clientId,
                ...data,
            });
        }

        sendSettings(settings) {
            return this.send({
                type: 'settings',
                settings,
                from: this.clientId,
            });
        }

        sendCursor(slideId, x, y, visible, nickname) {
            return this.send({
                type: 'cursor',
                slideId,
                x,
                y,
                visible: !!visible,
                nickname: String(nickname || '').slice(0, 32),
                from: this.clientId,
            });
        }

        sendChat(payload) {
            return this.send({
                type: 'chat',
                from: this.clientId,
                ...payload,
            });
        }

        updateNickname(nickname) {
            this.nickname = nickname;
            return this.send({
                type: 'join',
                publicId: this.publicId,
                clientId: this.clientId,
                nickname: this.nickname,
            });
        }

        reconnectWithToken(wsToken) {
            this.wsToken = wsToken;
            clearTimeout(this.reconnectTimer);
            this.releaseWs();
            this.shouldReconnect = true;
            this.connect();
        }

        disconnect() {
            this.shouldReconnect = false;
            clearTimeout(this.reconnectTimer);
            this.releaseWs();
        }
    }

    window.TacticsWsClient = TacticsWsClient;
})();
