(() => {
    'use strict';

    const STRINGS = {
        ru: {
            installerBadge: 'Обязательный шаг',
            installerTitle: 'Выберите корневую папку игры',
            installerDesc: 'Выберите основную папку клиента, в которой находится game_info.xml. Например: D:\\Games\\Tanki. Папки mods и mods\\1.43.0.0 не подходят: браузеру нужен доступ к корню игры.',
            installerStep1: '1. Нажмите «Выбрать папку игры»',
            installerStep2: '2. Откройте папку с Tanki.exe или WorldOfTanks.exe',
            installerStep3: '3. Подтвердите доступ и дождитесь установки',
            installerPickBtn: 'Выбрать папку игры',
            installerInstallBtn: 'Установить мод',
            installerUnsupported: 'Автоустановка работает в Chrome и Edge на компьютере. В других браузерах скачайте файлы вручную ниже.',
            statusPicking: 'Ожидание выбора папки…',
            statusInvalidRoot: 'Это не корень игры. Выберите папку, где лежат version.xml и game_info.xml.',
            statusInstalling: 'Установка… {current} / {total}',
            statusSuccess: 'Готово. Установлено в {path}. Запустите игру и проверьте python.log: [chadow.battle_limit] loaded',
            statusError: 'Ошибка: {message}',
            statusNoManifest: 'Не удалось загрузить манифест установки.',
            statusNoConfig: 'Файл конфигурации недоступен на сервере.',
            statusPermission: 'Нужен доступ на запись в папку игры. Выберите папку снова и подтвердите доступ.',
            modsSectionTitle: 'Моды Chadow',
        },
        en: {
            installerBadge: 'Required step',
            installerTitle: 'Select the game root folder',
            installerDesc: 'Pick the main client folder that contains game_info.xml. Example: D:\\Games\\Tanki. Do not select mods or mods\\1.43.0.0 — the browser needs the game root.',
            installerStep1: '1. Click “Select game folder”',
            installerStep2: '2. Open the folder with Tanki.exe or WorldOfTanks.exe',
            installerStep3: '3. Confirm access and wait for installation',
            installerPickBtn: 'Select game folder',
            installerInstallBtn: 'Install mod',
            installerUnsupported: 'Auto-install works in desktop Chrome and Edge. Use manual downloads below in other browsers.',
            statusPicking: 'Waiting for folder selection…',
            statusInvalidRoot: 'This is not the game root. Pick the folder that contains version.xml and game_info.xml.',
            statusInstalling: 'Installing… {current} / {total}',
            statusSuccess: 'Done. Installed into {path}. Launch the game and check python.log for [chadow.battle_limit] loaded',
            statusError: 'Error: {message}',
            statusNoManifest: 'Could not load install manifest.',
            statusNoConfig: 'Config file is not available on the server.',
            statusPermission: 'Write access is required. Select the folder again and confirm permission.',
            modsSectionTitle: 'Chadow mods',
        },
    };

    function lang() {
        return window.ABS_LANG === 'en' ? 'en' : 'ru';
    }

    function t(key, vars = {}) {
        const dict = STRINGS[lang()] || STRINGS.ru;
        let text = dict[key] || STRINGS.ru[key] || key;
        Object.keys(vars).forEach((name) => {
            text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(vars[name]));
        });
        return text;
    }

    function applyI18n(root) {
        root.querySelectorAll('[data-wotmods-i18n]').forEach((node) => {
            const key = node.getAttribute('data-wotmods-i18n');
            if (!key) return;
            const value = t(key);
            if (node.tagName === 'BUTTON') {
                node.textContent = value;
            } else {
                node.textContent = value;
            }
        });
    }

    function supportsInstaller() {
        return typeof window.showDirectoryPicker === 'function';
    }

    async function fileExists(dirHandle, name) {
        try {
            await dirHandle.getFileHandle(name);
            return true;
        } catch (error) {
            return false;
        }
    }

    async function readTextFile(dirHandle, name) {
        const handle = await dirHandle.getFileHandle(name);
        const file = await handle.getFile();
        return file.text();
    }

    async function validateGameRoot(dirHandle) {
        const hasVersion = await fileExists(dirHandle, 'version.xml');
        const hasGameInfo = await fileExists(dirHandle, 'game_info.xml');
        const hasPaths = await fileExists(dirHandle, 'paths.xml');
        return hasVersion || hasGameInfo || hasPaths;
    }

    async function detectClientVersion(dirHandle) {
        if (await fileExists(dirHandle, 'version.xml')) {
            try {
                const xml = await readTextFile(dirHandle, 'version.xml');
                const match = xml.match(/<version>\s*v?\s*([0-9]+(?:\.[0-9]+){2,3})/i);
                if (match) {
                    return match[1];
                }
            } catch (error) {
                /* fall through */
            }
        }

        try {
            const modsDir = await dirHandle.getDirectoryHandle('mods');
            const versions = [];
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of modsDir.values()) {
                if (entry.kind === 'directory' && /^[0-9]+(?:\.[0-9]+){2,3}$/.test(entry.name)) {
                    versions.push(entry.name);
                }
            }
            versions.sort((a, b) => {
                const pa = a.split('.').map(Number);
                const pb = b.split('.').map(Number);
                for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
                    const diff = (pb[i] || 0) - (pa[i] || 0);
                    if (diff !== 0) return diff;
                }
                return 0;
            });
            if (versions[0]) {
                return versions[0];
            }
        } catch (error) {
            /* no mods dir */
        }

        return null;
    }

    async function ensureDir(root, parts) {
        let current = root;
        for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    }

    async function writeTextFile(root, relativePath, contents) {
        const parts = relativePath.split('/').filter(Boolean);
        const fileName = parts.pop();
        const dir = parts.length ? await ensureDir(root, parts) : root;
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(contents);
        await writable.close();
    }

    async function fetchText(url) {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.text();
    }

    function formatTemplate(template, vars) {
        return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
    }

    class WotmodsInstaller {
        constructor(root) {
            this.root = root;
            this.modId = root.getAttribute('data-wotmods-mod') || '';
            this.statusEl = document.getElementById('wotmodsInstallerStatus');
            this.unsupportedEl = document.getElementById('wotmodsInstallerUnsupported');
            this.pickBtn = document.getElementById('wotmodsPickFolderBtn');
            this.gameDir = null;
            this.gameLabel = '';
            this.clientVersion = '';
            this.manifest = null;
            this.bind();
            this.init();
        }

        bind() {
            if (this.pickBtn) {
                this.pickBtn.addEventListener('click', () => this.pickFolder());
            }
        }

        init() {
            if (!supportsInstaller()) {
                if (this.unsupportedEl) this.unsupportedEl.hidden = false;
                if (this.pickBtn) this.pickBtn.disabled = true;
                return;
            }
            if (this.unsupportedEl) this.unsupportedEl.hidden = true;
        }

        setStatus(kind, vars = {}) {
            if (!this.statusEl) return;
            const map = {
                installing: t('statusInstalling', vars),
                success: t('statusSuccess', vars),
                invalid: t('statusInvalidRoot'),
                error: t('statusError', { message: vars.message || '' }),
                picking: t('statusPicking'),
            };
            this.statusEl.textContent = map[kind] || vars.message || '';
            this.statusEl.hidden = !this.statusEl.textContent;
            this.statusEl.classList.toggle('is-success', kind === 'success');
            this.statusEl.classList.toggle('is-error', kind === 'error' || kind === 'invalid');
        }

        async loadManifest() {
            const query = this.modId ? '?mod=' + encodeURIComponent(this.modId) : '';
            const response = await fetch('/api/wotmods/manifest' + query, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error(t('statusNoManifest'));
            }
            const data = await response.json();
            if (!data.ok || !Array.isArray(data.mods) || !data.mods.length) {
                throw new Error(t('statusNoManifest'));
            }
            return data.mods;
        }

        async pickFolder() {
            if (!supportsInstaller()) return;
            this.setStatus('picking');
            if (this.pickBtn) this.pickBtn.disabled = true;
            try {
                const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
                const valid = await validateGameRoot(dir);
                if (!valid) {
                    this.gameDir = null;
                    this.setStatus('invalid');
                    return;
                }
                const version = await detectClientVersion(dir);
                if (!version) {
                    throw new Error(lang() === 'en'
                        ? 'Could not detect client version from version.xml or mods folder.'
                        : 'Не удалось определить версию клиента из version.xml или папки mods.');
                }
                this.gameDir = dir;
                this.gameLabel = dir.name;
                this.clientVersion = version;
                await this.install();
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    this.setStatus('error', { message: lang() === 'en' ? 'Folder selection cancelled.' : 'Выбор папки отменён.' });
                    return;
                }
                this.setStatus('error', { message: error.message || String(error) });
            } finally {
                if (this.pickBtn) this.pickBtn.disabled = false;
            }
        }

        async install() {
            if (!this.gameDir || !this.clientVersion) {
                return;
            }
            try {
                const mods = this.manifest || await this.loadManifest();
                this.manifest = mods;
                let total = 0;
                mods.forEach((mod) => {
                    total += 1;
                    total += (mod.scripts || []).length;
                });
                let current = 0;

                for (const mod of mods) {
                    if (!mod.configUrl) {
                        throw new Error(t('statusNoConfig'));
                    }
                    const configPath = String(mod.configGamePath || '');
                    const configBody = await fetchText(mod.configUrl);
                    await writeTextFile(this.gameDir, configPath, configBody);
                    current += 1;
                    this.setStatus('installing', { current, total });

                    const scripts = mod.scripts || [];
                    for (const script of scripts) {
                        const rel = String(script.path || '');
                        const target = formatTemplate(String(mod.resRoot || 'res_mods/{clientVersion}/res') + '/' + rel, {
                            clientVersion: this.clientVersion,
                        });
                        const body = await fetchText(script.url);
                        await writeTextFile(this.gameDir, target, body);
                        current += 1;
                        this.setStatus('installing', { current, total });
                    }
                }

                this.setStatus('success', { path: this.gameLabel + ' (v' + this.clientVersion + ')' });
            } catch (error) {
                if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
                    this.setStatus('error', { message: t('statusPermission') });
                } else {
                    this.setStatus('error', { message: error.message || String(error) });
                }
            }
        }
    }

    function init() {
        const root = document.getElementById('wotmodsInstaller');
        if (!root) return;
        new WotmodsInstaller(root);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.WotmodsInstallerI18n = { STRINGS, t, applyI18n };
})();
