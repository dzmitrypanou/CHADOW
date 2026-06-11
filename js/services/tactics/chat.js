(() => {
    'use strict';

    const i18n = () => window.AbsTacticsI18n;

    class TacticsChat {
        constructor(options) {
            this.publicId = options.publicId || '';
            this.clientId = options.clientId || '';
            this.getNickname = options.getNickname || (() => '');
            this.getWsToken = options.getWsToken || (() => '');
            this.onSendWs = options.onSendWs || (() => false);
            this.apiUrl = options.apiUrl || window.ABS_TACTICS_CHAT_API || '/api/tactics/chat.php';
            this.panelEl = options.panelEl || document.getElementById('tacticsChatPanel');
            this.toggleEl = options.toggleEl || document.getElementById('tacticsChatToggle');
            this.bodyEl = options.bodyEl || document.getElementById('tacticsChatBody');
            this.listEl = options.listEl || document.getElementById('tacticsChatMessages');
            this.formEl = options.formEl || document.getElementById('tacticsChatForm');
            this.inputEl = options.inputEl || document.getElementById('tacticsChatInput');
            this.lastId = 0;
            this.pollTimer = null;
            this.storageKey = `abs_tactics_chat_collapsed_${this.publicId}`;
            this.bindEvents();
            this.restoreCollapsed();
            this.loadHistory();
            this.startPolling();
        }

        bindEvents() {
            this.toggleEl?.addEventListener('click', () => {
                const collapsed = this.panelEl?.classList.toggle('is-collapsed');
                this.toggleEl?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                try {
                    sessionStorage.setItem(this.storageKey, collapsed ? '1' : '0');
                } catch (e) {
                    // ignore
                }
            });

            this.formEl?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                this.sendMessage();
            });
        }

        restoreCollapsed() {
            try {
                const collapsed = sessionStorage.getItem(this.storageKey) === '1';
                if (collapsed) {
                    this.panelEl?.classList.add('is-collapsed');
                    this.toggleEl?.setAttribute('aria-expanded', 'false');
                }
            } catch (e) {
                // ignore
            }
        }

        formatTime(createdAt) {
            if (!createdAt) return '';
            const d = new Date(createdAt);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        renderMessage(msg) {
            if (!this.listEl || !msg) return;
            const id = Number(msg.id) || 0;
            if (id > 0 && this.listEl.querySelector(`[data-chat-id="${id}"]`)) {
                return;
            }
            if (id > this.lastId) {
                this.lastId = id;
            }

            const li = document.createElement('li');
            li.className = 'tactics-chat-message';
            if (id > 0) {
                li.dataset.chatId = String(id);
            }
            const nick = document.createElement('span');
            nick.className = 'tactics-chat-message__nick';
            nick.textContent = String(msg.nickname || 'Guest') + ':';
            const text = document.createTextNode(' ' + String(msg.message || ''));
            const time = document.createElement('span');
            time.className = 'tactics-chat-message__time';
            time.textContent = this.formatTime(msg.createdAt);
            li.appendChild(nick);
            li.appendChild(text);
            li.appendChild(time);
            this.listEl.appendChild(li);
            this.listEl.scrollTop = this.listEl.scrollHeight;
        }

        renderMessages(messages) {
            if (!Array.isArray(messages) || !messages.length) return;
            messages.forEach((msg) => this.renderMessage(msg));
        }

        async loadHistory(sinceId) {
            const token = this.getWsToken();
            if (!token || !this.publicId) return;

            const sep = this.apiUrl.includes('?') ? '&' : '?';
            const url = `${this.apiUrl}${sep}public_id=${encodeURIComponent(this.publicId)}`
                + `&since_id=${encodeURIComponent(String(sinceId ?? 0))}`
                + `&ws_token=${encodeURIComponent(token)}`;

            try {
                const res = await fetch(url, { credentials: 'same-origin' });
                const data = await res.json();
                if (data?.success && Array.isArray(data.messages)) {
                    this.renderMessages(data.messages);
                }
            } catch (e) {
                // ignore
            }
        }

        startPolling() {
            this.stopPolling();
            this.pollTimer = setInterval(() => {
                if (this.lastId > 0) {
                    this.loadHistory(this.lastId);
                }
            }, 3000);
        }

        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        }

        applyRemote(msg) {
            if (!msg) return;
            this.renderMessage({
                id: msg.id,
                nickname: msg.nickname,
                message: msg.message,
                createdAt: msg.createdAt,
                clientId: msg.clientId || msg.from,
            });
        }

        async sendMessage() {
            const text = String(this.inputEl?.value || '').trim();
            if (!text) return;

            const token = this.getWsToken();
            if (!token) return;

            try {
                const res = await fetch(this.apiUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': window.ABS_TACTICS_CSRF || '',
                    },
                    body: JSON.stringify({
                        public_id: this.publicId,
                        message: text,
                        ws_token: token,
                    }),
                });
                const data = await res.json();
                if (data?.success && data.message) {
                    this.renderMessage(data.message);
                    if (this.inputEl) {
                        this.inputEl.value = '';
                    }
                    this.onSendWs(data.message);
                }
            } catch (e) {
                // ignore
            }
        }

        destroy() {
            this.stopPolling();
        }
    }

    window.TacticsChat = TacticsChat;
})();
