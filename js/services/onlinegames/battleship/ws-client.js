(() => {
    'use strict';

    class BattleshipWsClient {
        constructor(options) {
            this.wsUrl = options.wsUrl;
            this.wsToken = options.wsToken;
            this.onState = options.onState || (() => {});
            this.onPresence = options.onPresence || (() => {});
            this.onGameOver = options.onGameOver || (() => {});
            this.onConnection = options.onConnection || (() => {});
            this.onError = options.onError || (() => {});
            this.onChat = options.onChat || (() => {});
            this.onReconnectFailed = options.onReconnectFailed || (() => {});
            this.onWsClose = options.onWsClose || (() => {});
            this.clientId = null;
            this.ws = null;
            this.reconnectTimer = null;
            this.shouldReconnect = true;
            this.failedAttempts = 0;
        }

        connect() {
            if (!this.wsUrl || !this.wsToken) {
                this.onConnection('offline');
                return;
            }

            this.releaseWs();

            let url = this.wsUrl;
            url += (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(this.wsToken);

            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                this.onConnection('offline');
                this.scheduleReconnect();
                return;
            }

            this.ws.addEventListener('open', () => {
                this.failedAttempts = 0;
                this.onConnection('connected');
            });

            this.ws.addEventListener('message', (event) => {
                let msg;
                try {
                    msg = JSON.parse(String(event.data));
                } catch (e) {
                    return;
                }
                if (!msg || !msg.type) return;

                if (msg.type === 'joined' || msg.type === 'state') {
                    if (msg.type === 'joined' && msg.clientId) {
                        this.clientId = msg.clientId;
                    }
                    this.onState(msg.state, msg);
                    if (msg.type === 'joined' && Array.isArray(msg.chat)) {
                        msg.chat.forEach((item) => this.onChat({ message: item }));
                    }
                } else if (msg.type === 'presence' || msg.type === 'opponent_joined') {
                    this.onPresence(msg);
                } else if (msg.type === 'game_over') {
                    this.onGameOver(msg);
                } else if (msg.type === 'chat') {
                    this.onChat(msg);
                } else if (msg.type === 'shot_rejected' || msg.type === 'error') {
                    this.onError(msg.error || msg.type);
                }
            });

            this.ws.addEventListener('close', (event) => {
                this.onConnection('offline');
                this.onWsClose(event);
                this.failedAttempts += 1;
                if (this.failedAttempts >= 6) {
                    this.shouldReconnect = false;
                    this.onReconnectFailed(event);
                    return;
                }
                this.scheduleReconnect();
            });

            this.ws.addEventListener('error', () => {
                this.onConnection('offline');
            });
        }

        scheduleReconnect() {
            if (!this.shouldReconnect || this.reconnectTimer) return;
            this.reconnectTimer = window.setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, 2500);
        }

        releaseWs() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.ws) {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onclose = null;
                this.ws.onerror = null;
                try {
                    this.ws.close();
                } catch (e) {

                }
                this.ws = null;
            }
        }

        disconnect() {
            this.shouldReconnect = false;
            this.releaseWs();
            this.onConnection('offline');
        }

        send(payload) {
            if (!this.ws || this.ws.readyState !== 1) return false;
            this.ws.send(JSON.stringify(payload));
            return true;
        }

        autoPlace() {
            return this.send({ type: 'auto_place' });
        }

        placeShips(ships) {
            return this.send({ type: 'place_ships', ships });
        }

        shoot(r, c) {
            return this.send({ type: 'shoot', r, c });
        }

        resign() {
            return this.send({ type: 'resign' });
        }

        sendChat(text) {
            return this.send({ type: 'chat', text: String(text || '').trim() });
        }
    }

    window.AbsBattleshipWsClient = BattleshipWsClient;
})();
