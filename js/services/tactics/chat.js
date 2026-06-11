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
            this.dockEl = options.dockEl || document.getElementById('tacticsChatDock');
            this.panelEl = options.panelEl || document.getElementById('tacticsChatPanel');
            this.toggleEl = options.toggleEl || document.getElementById('tacticsChatToggle');
            this.bodyEl = options.bodyEl || document.getElementById('tacticsChatBody');
            this.listEl = options.listEl || document.getElementById('tacticsChatMessages');
            this.emptyEl = options.emptyEl || document.getElementById('tacticsChatEmpty');
            this.errorEl = options.errorEl || document.getElementById('tacticsChatError');
            this.formEl = options.formEl || document.getElementById('tacticsChatForm');
            this.inputEl = options.inputEl || document.getElementById('tacticsChatInput');
            this.lastId = 0;
            this.pollTimer = null;
            this.sending = false;
            this.storageKey = `abs_tactics_chat_collapsed_${this.publicId}`;
            this.bindEvents();
            this.resetDockPosition();
            this.restoreCollapsed();
            this.updateEmptyState();
            this.loadHistory();
            this.startPolling();
        }

        setCollapsed(collapsed) {
            const isCollapsed = !!collapsed;
            this.panelEl?.classList.toggle('is-collapsed', isCollapsed);
            this.toggleEl?.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            try {
                sessionStorage.setItem(this.storageKey, isCollapsed ? '1' : '0');
            } catch (e) {
                // ignore
            }
        }

        setInputEnabled(enabled) {
            const on = !!enabled;
            if (this.inputEl) {
                this.inputEl.disabled = !on;
            }
            const sendBtn = this.formEl?.querySelector('.tactics-chat-send');
            if (sendBtn) {
                sendBtn.disabled = !on;
            }
            this.formEl?.classList.toggle('is-disabled', !on);
        }

        bindEvents() {
            this.toggleEl?.addEventListener('click', () => {
                const collapsed = this.panelEl?.classList.toggle('is-collapsed');
                const isCollapsed = !!collapsed;
                this.toggleEl?.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
                try {
                    sessionStorage.setItem(this.storageKey, isCollapsed ? '1' : '0');
                } catch (e) {
                    // ignore
                }
                if (!isCollapsed) {
                    this.clearError();
                    this.inputEl?.focus();
                    this.scrollMessagesToEnd();
                }
            });

            this.formEl?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                this.sendMessage();
            });
        }

        resetDockPosition() {
            if (!this.dockEl) return;
            this.dockEl.classList.remove('is-floating');
            this.dockEl.style.removeProperty('left');
            this.dockEl.style.removeProperty('top');
            this.dockEl.style.removeProperty('bottom');
            try {
                sessionStorage.removeItem(`abs_tactics_chat_pos_${this.publicId}`);
            } catch (e) {
                // ignore
            }
        }

        restoreCollapsed() {
            let collapsed = false;
            try {
                if (sessionStorage.getItem(this.storageKey) === '1') {
                    collapsed = true;
                }
            } catch (e) {
                collapsed = false;
            }
            this.setCollapsed(collapsed);
            if (!collapsed) {
                this.scrollMessagesToEnd();
            }
        }

        clearError() {
            if (!this.errorEl) return;
            this.errorEl.hidden = true;
            this.errorEl.textContent = '';
        }

        showError(message) {
            if (!this.errorEl) return;
            const text = String(message || '').trim();
            if (!text) {
                this.clearError();
                return;
            }
            this.errorEl.textContent = text;
            this.errorEl.hidden = false;
        }

        updateEmptyState() {
            if (!this.emptyEl || !this.listEl) return;
            const hasMessages = this.listEl.children.length > 0;
            this.emptyEl.hidden = hasMessages;
        }

        scrollMessagesToEnd() {
            if (!this.listEl) return;
            this.listEl.scrollTop = this.listEl.scrollHeight;
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
            li.appendChild(nick);
            li.appendChild(text);
            this.listEl.appendChild(li);
            this.updateEmptyState();
            this.scrollMessagesToEnd();
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
                if (!res.ok || !data?.success) {
                    return;
                }
                if (Array.isArray(data.messages)) {
                    this.renderMessages(data.messages);
                }
            } catch (e) {
                // ignore
            }
        }

        startPolling() {
            this.stopPolling();
            this.pollTimer = setInterval(() => {
                this.loadHistory(this.lastId);
            }, 3000);
        }

        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        }

        normalizeRemoteMessage(msg) {
            if (!msg || typeof msg !== 'object') return null;
            const src = (msg.payload && typeof msg.payload === 'object')
                ? msg.payload
                : msg;
            return {
                id: src.id ?? msg.id,
                nickname: src.nickname ?? msg.nickname,
                message: typeof src.message === 'string'
                    ? src.message
                    : (typeof msg.message === 'string' ? msg.message : ''),
                createdAt: src.createdAt || src.created_at || msg.createdAt || msg.created_at,
                clientId: src.clientId || src.client_id || msg.clientId || msg.from,
            };
        }

        applyRemote(msg) {
            const normalized = this.normalizeRemoteMessage(msg);
            if (!normalized) return;
            this.renderMessage(normalized);
        }

        getCsrfToken() {
            return window.ABS_TACTICS_CSRF || window.ABS_SITE_CSRF || '';
        }

        async sendMessage() {
            const text = String(this.inputEl?.value || '').trim();
            if (!text || this.sending) return;

            const token = this.getWsToken();
            if (!token) {
                this.showError(i18n()?.t('chatErrorNoToken') || 'Нет доступа к чату');
                return;
            }

            this.sending = true;
            this.clearError();

            try {
                const res = await fetch(this.apiUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCsrfToken(),
                    },
                    body: JSON.stringify({
                        public_id: this.publicId,
                        message: text,
                        ws_token: token,
                        csrf_token: this.getCsrfToken(),
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.success || !data.message) {
                    const err = data?.error || i18n()?.t('chatErrorSend') || 'Не удалось отправить';
                    this.showError(err);
                    return;
                }
                this.renderMessage(data.message);
                if (this.inputEl) {
                    this.inputEl.value = '';
                }
                this.onSendWs(data.message);
            } catch (e) {
                this.showError(i18n()?.t('chatErrorSend') || 'Не удалось отправить');
            } finally {
                this.sending = false;
            }
        }

        destroy() {
            this.stopPolling();
        }
    }

    window.TacticsChat = TacticsChat;
})();
