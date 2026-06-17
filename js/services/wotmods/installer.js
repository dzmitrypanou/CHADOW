(() => {
    'use strict';

    const STRINGS = {
        ru: {
            statusPicking: 'Ожидание выбора папки…',
            statusInvalidRoot: 'Это не корень игры. Нужна папка с version.xml или game_info.xml.',
            statusInstalling: 'Установка… {current} / {total}',
            statusDeleting: 'Удаление… {current} / {total}',
            statusSuccess: 'Готово: {path}',
            statusDeleteSuccess: 'Удалено файлов: {count}',
            statusError: 'Ошибка: {message}',
            statusNoManifest: 'Не удалось загрузить манифест установки.',
            statusNoConfig: 'Файл конфигурации недоступен на сервере.',
            statusNoPackage: 'Пакет мода недоступен на сервере.',
            statusWrongGame: 'Мод не поддерживается для выбранной игры.',
            statusPackageMismatch: 'Установлен пакет для другой игры. Будет заменён.',
            statusPermission: 'Нужен доступ на запись. Выберите папку снова и подтвердите доступ.',
            statusNoModsSelected: 'Отметьте хотя бы один мод.',
            statusNothingToInstall: 'Выбранные моды уже установлены в этой папке.',
            statusSkippedInstalled: 'Пропущено (уже установлено): {count}',
            statusUpdated: 'Обновлено: {count}',
            badgeUpdate: 'Доступно обновление',
            gameMeta: '{game} · версия {version}',
            folderPath: '{folder}',
            folderPathEditPrompt: 'Укажите полный путь к папке игры:',
            folderPathEditHint: 'Нажмите, чтобы указать полный путь',
            pickFolder: 'Выбрать',
            changeFolder: 'Изменить',
            folderPlaceholder: 'Папка игры не выбрана',
            modsHintReady: 'Отметьте моды и нажмите «Установить выбранные».',
            modsHintLocked: 'Сначала выберите папку игры выше.',
            folderCancelled: 'Выбор папки отменён.',
            versionDetectError: 'Не удалось определить версию из version.xml или папки mods.',
            confirmDeleteChadow: 'Удалить моды установленные на сайте CHADOW из выбранной папки игры?',
            confirmDeleteAll: 'Удалить ВСЕ файлы модов в mods/{version} и res_mods/{version}, а также содержимое mods/configs/? Папки версий останутся пустыми.',
            confirmTitle: 'Подтвердите действие',
            confirmOk: 'Подтвердить',
            confirmCancel: 'Отмена',
        },
        en: {
            statusPicking: 'Waiting for folder selection…',
            statusInvalidRoot: 'Not the game root. Pick the folder with version.xml or game_info.xml.',
            statusInstalling: 'Installing… {current} / {total}',
            statusDeleting: 'Removing… {current} / {total}',
            statusSuccess: 'Done: {path}',
            statusDeleteSuccess: 'Removed files: {count}',
            statusError: 'Error: {message}',
            statusNoManifest: 'Could not load install manifest.',
            statusNoConfig: 'Config file is not available on the server.',
            statusNoPackage: 'Mod package is not available on the server.',
            statusWrongGame: 'This mod is not supported for the selected game.',
            statusPackageMismatch: 'A package for the other game is installed. It will be replaced.',
            statusPermission: 'Write access is required. Select the folder again.',
            statusNoModsSelected: 'Select at least one mod.',
            statusNothingToInstall: 'Selected mods are already installed in this folder.',
            statusSkippedInstalled: 'Skipped (already installed): {count}',
            statusUpdated: 'Updated: {count}',
            badgeUpdate: 'Update available',
            gameMeta: '{game} · version {version}',
            folderPath: '{folder}',
            folderPathEditPrompt: 'Enter the full path to the game folder:',
            folderPathEditHint: 'Click to enter the full path',
            pickFolder: 'Browse',
            changeFolder: 'Change',
            folderPlaceholder: 'No game folder selected',
            modsHintReady: 'Mark mods and click “Install selected”.',
            modsHintLocked: 'Select the game folder above first.',
            folderCancelled: 'Folder selection cancelled.',
            versionDetectError: 'Could not detect version from version.xml or mods folder.',
            confirmDeleteChadow: 'Remove Chadow mods installed from this site?',
            confirmDeleteAll: 'Delete ALL mod files in mods/{version} and res_mods/{version}, and clear mods/configs/? Version folders will stay empty.',
            confirmTitle: 'Confirm action',
            confirmOk: 'Confirm',
            confirmCancel: 'Cancel',
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

    function gameCatalog() {
        return window.WOTMODS_GAMES && typeof window.WOTMODS_GAMES === 'object'
            ? window.WOTMODS_GAMES
            : {};
    }

    function supportsInstaller() {
        return typeof window.showDirectoryPicker === 'function';
    }

    async function fileExists(dirHandle, name) {
        try {
            const parts = String(name).split('/').filter(Boolean);
            let current = dirHandle;
            for (let i = 0; i < parts.length - 1; i += 1) {
                current = await current.getDirectoryHandle(parts[i]);
            }
            await current.getFileHandle(parts[parts.length - 1]);
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
        return (await fileExists(dirHandle, 'version.xml'))
            || (await fileExists(dirHandle, 'game_info.xml'))
            || (await fileExists(dirHandle, 'paths.xml'));
    }

    const VERSION_FOLDER_RE = /^[0-9]+(?:\.[0-9]+){2,3}$/;

    function compareVersionsDesc(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
            const diff = (pb[i] || 0) - (pa[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    function compareVersionsAsc(a, b) {
        return compareVersionsDesc(b, a);
    }

    async function listVersionFolders(dirHandle, parentName) {
        const versions = [];
        try {
            const parent = await dirHandle.getDirectoryHandle(parentName);
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of parent.values()) {
                if (entry.kind === 'directory' && VERSION_FOLDER_RE.test(entry.name)) {
                    versions.push(entry.name);
                }
            }
        } catch (error) {
            /* missing */
        }
        return versions;
    }

    function normalizeGameVersion(version, folderVersions) {
        if (!version) return null;
        const uniqueFolders = [...new Set(folderVersions)];
        if (uniqueFolders.includes(version)) return version;

        const matches = uniqueFolders.filter((folderVersion) => (
            folderVersion === version
            || folderVersion.startsWith(version + '.')
            || version.startsWith(folderVersion + '.')
        ));
        if (matches.length) return matches.sort(compareVersionsDesc)[0];

        if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
            const padded = version + '.0';
            return uniqueFolders.includes(padded) ? padded : padded;
        }
        return version;
    }

    function parseVersionXml(xml) {
        const branchMatch = String(xml || '').match(/<branch>\s*([0-9]+\.[0-9]+)\s*<\/branch>/i);
        const versionMatch = String(xml || '').match(/<version>\s*v?\.?\s*([0-9]+(?:\.[0-9]+){1,3})/i);
        return {
            branch: branchMatch ? branchMatch[1].trim() : null,
            version: versionMatch ? versionMatch[1].trim() : null,
        };
    }

    function folderMatchesBranch(folderVersion, branch) {
        const folder = String(folderVersion || '').trim();
        const branchPrefix = String(branch || '').trim();
        if (!folder || !branchPrefix) return false;
        return folder === branchPrefix || folder.startsWith(branchPrefix + '.');
    }

    function filterFoldersForBranch(folderVersions, branch, maxVersion) {
        return folderVersions.filter((folderVersion) => {
            if (!folderMatchesBranch(folderVersion, branch)) return false;
            if (maxVersion && compareVersionsAsc(folderVersion, maxVersion) > 0) return false;
            return true;
        });
    }

    function resolveClientVersionFromXml(parsed, folderVersions) {
        const uniqueFolders = [...new Set(folderVersions)];
        const branch = parsed.branch;
        const xmlVersion = parsed.version;

        if (branch) {
            const targetVersion = xmlVersion
                ? normalizeGameVersion(xmlVersion, filterFoldersForBranch(uniqueFolders, branch, xmlVersion))
                : null;
            const eligible = filterFoldersForBranch(uniqueFolders, branch, targetVersion || xmlVersion);

            if (targetVersion) {
                if (eligible.includes(targetVersion)) return targetVersion;
                const withinTarget = eligible
                    .filter((folderVersion) => compareVersionsAsc(folderVersion, targetVersion) <= 0)
                    .sort(compareVersionsDesc);
                if (withinTarget.length) return withinTarget[0];
                if (folderMatchesBranch(targetVersion, branch)) return targetVersion;
            }

            if (eligible.length) {
                return eligible.sort(compareVersionsDesc)[0];
            }

            if (xmlVersion) {
                const normalized = normalizeGameVersion(xmlVersion, uniqueFolders);
                if (folderMatchesBranch(normalized, branch)) return normalized;
            }

            return branch + '.0.0';
        }

        if (xmlVersion) {
            const targetVersion = normalizeGameVersion(xmlVersion, uniqueFolders);
            const eligible = uniqueFolders.filter(
                (folderVersion) => compareVersionsAsc(folderVersion, targetVersion) <= 0,
            );
            if (eligible.length) {
                const exact = eligible.find((folderVersion) => folderVersion === targetVersion);
                if (exact) return exact;
                const prefixMatch = eligible
                    .filter((folderVersion) => (
                        folderVersion.startsWith(targetVersion + '.')
                        || targetVersion.startsWith(folderVersion + '.')
                    ))
                    .sort(compareVersionsDesc);
                if (prefixMatch.length) return prefixMatch[0];
                return eligible.sort(compareVersionsDesc)[0];
            }
            return targetVersion;
        }

        if (uniqueFolders.length) {
            return uniqueFolders.sort(compareVersionsDesc)[0];
        }

        return null;
    }

    async function detectClientVersion(dirHandle) {
        const fromMods = await listVersionFolders(dirHandle, 'mods');
        const fromRes = await listVersionFolders(dirHandle, 'res_mods');
        const folderVersions = [...fromMods, ...fromRes];

        if (await fileExists(dirHandle, 'version.xml')) {
            try {
                const xml = await readTextFile(dirHandle, 'version.xml');
                return resolveClientVersionFromXml(parseVersionXml(xml), folderVersions);
            } catch (error) {
                /* fall through */
            }
        }

        if (!folderVersions.length) return null;
        return [...new Set(folderVersions)].sort(compareVersionsDesc)[0];
    }

    async function listRootExeNames(dirHandle) {
        const names = [];
        // eslint-disable-next-line no-restricted-syntax
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && /\.exe$/i.test(entry.name)) {
                names.push(entry.name.toLowerCase());
            }
        }
        return names;
    }

    async function detectGameClient(dirHandle) {
        const exeNames = await listRootExeNames(dirHandle);
        if (exeNames.includes('tanki.exe')) return 'lesta';

        if (await fileExists(dirHandle, 'game_info.xml')) {
            try {
                const xml = (await readTextFile(dirHandle, 'game_info.xml')).toLowerCase();
                if (/lesta|tanki|lesta\.ru|мир танков/.test(xml)) return 'lesta';
                if (/wargaming|worldoftanks\.eu|worldoftanks\.com/.test(xml)) return 'wot';
            } catch (error) {
                /* ignore */
            }
        }

        if (await fileExists(dirHandle, 'paths.xml')) {
            try {
                const xml = (await readTextFile(dirHandle, 'paths.xml')).toLowerCase();
                if (/lesta\.ru/.test(xml)) return 'lesta';
                if (/wargaming/.test(xml)) return 'wot';
            } catch (error) {
                /* ignore */
            }
        }

        const folderName = String(dirHandle.name || '').toLowerCase();
        if (/tanki|world_of_tanks_ru|мир/.test(folderName)) return 'lesta';
        if (/world_of_tanks|worldoftanks/.test(folderName) && !/ru/.test(folderName)) return 'wot';

        if (exeNames.includes('worldoftanks.exe')) {
            return /ru|tanki/.test(folderName) ? 'lesta' : 'wot';
        }

        return 'lesta';
    }

    const FOLDER_PATH_CACHE_KEY = 'wotmods_folder_display_paths';

    function normalizeWindowsPath(path) {
        return String(path || '').trim().replace(/\//g, '\\');
    }

    async function tryGetHandlePath(handle) {
        if (!handle) return '';
        try {
            const fn = handle.getPath;
            if (typeof fn !== 'function') return '';
            const result = fn.call(handle);
            if (typeof result === 'string' && result.trim()) {
                return normalizeWindowsPath(result);
            }
            if (result && typeof result.then === 'function') {
                const resolved = await result;
                if (typeof resolved === 'string' && resolved.trim()) {
                    return normalizeWindowsPath(resolved);
                }
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function dirnameFromPath(path) {
        const normalized = normalizeWindowsPath(path);
        const index = normalized.lastIndexOf('\\');
        if (index <= 0) return normalized;
        return normalized.slice(0, index);
    }

    async function tryGetPathFromGameExe(dirHandle) {
        const exeNames = ['Tanki.exe', 'WorldOfTanks.exe', 'worldoftanks.exe'];
        for (const exeName of exeNames) {
            try {
                const fileHandle = await dirHandle.getFileHandle(exeName);
                const fromHandle = await tryGetHandlePath(fileHandle);
                if (fromHandle) {
                    return dirnameFromPath(fromHandle);
                }
                const file = await fileHandle.getFile();
                if (file && typeof file.path === 'string' && file.path.trim()) {
                    return dirnameFromPath(file.path);
                }
            } catch (error) {
                /* exe missing or unreadable */
            }
        }
        return '';
    }

    function readCachedFolderPath(folderName, clientVersion) {
        try {
            const raw = localStorage.getItem(FOLDER_PATH_CACHE_KEY);
            if (!raw) return '';
            const data = JSON.parse(raw);
            const key = String(folderName || '') + '::' + String(clientVersion || '');
            const cached = data[key];
            return typeof cached === 'string' ? normalizeWindowsPath(cached) : '';
        } catch (error) {
            return '';
        }
    }

    function writeCachedFolderPath(folderName, clientVersion, path) {
        const normalized = normalizeWindowsPath(path);
        if (!normalized || !folderName) return;
        try {
            const raw = localStorage.getItem(FOLDER_PATH_CACHE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            data[String(folderName) + '::' + String(clientVersion || '')] = normalized;
            localStorage.setItem(FOLDER_PATH_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            /* ignore storage errors */
        }
    }

    async function resolveDirectoryDisplayPath(dirHandle, clientVersion) {
        const folderName = String(dirHandle?.name || '').trim();
        if (!dirHandle || !folderName) return '';

        let path = await tryGetHandlePath(dirHandle);
        if (!path) {
            path = await tryGetPathFromGameExe(dirHandle);
        }
        if (path) {
            writeCachedFolderPath(folderName, clientVersion, path);
            return path;
        }

        const cached = readCachedFolderPath(folderName, clientVersion);
        if (cached) return cached;

        return folderName;
    }

    async function getDirHandle(root, relativePath, create = false) {
        const parts = String(relativePath).split('/').filter(Boolean);
        let current = root;
        for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create });
        }
        return current;
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

    async function deleteRelativePath(root, relativePath) {
        const parts = String(relativePath).split('/').filter(Boolean);
        if (!parts.length) return false;
        const name = parts.pop();
        try {
            const parent = parts.length ? await getDirHandle(root, parts.join('/')) : root;
            await parent.removeEntry(name, { recursive: true });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function clearDirectory(dirHandle) {
        let count = 0;
        const entries = [];
        // eslint-disable-next-line no-restricted-syntax
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }
        for (const entry of entries) {
            await dirHandle.removeEntry(entry.name, { recursive: entry.kind === 'directory' });
            count += 1;
        }
        return count;
    }

    async function writeBinaryFile(root, relativePath, data) {
        const parts = relativePath.split('/').filter(Boolean);
        const fileName = parts.pop();
        const dir = parts.length ? await ensureDir(root, parts) : root;
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
    }

    async function fetchArrayBuffer(url) {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.arrayBuffer();
    }

    async function fetchText(url) {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
    }

    function formatTemplate(template, vars) {
        return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
    }

    function catalogEntries() {
        return Array.isArray(window.WOTMODS_CATALOG) ? window.WOTMODS_CATALOG : [];
    }

    function normalizeGameClient(client) {
        const value = String(client || '').toLowerCase();
        if (value === 'wg' || value === 'wargaming' || value === 'worldoftanks' || value === 'wot') {
            return 'wot';
        }
        return 'lesta';
    }

    function packageExtension(gameClient) {
        return normalizeGameClient(gameClient) === 'wot' ? '.wotmod' : '.mtmod';
    }

    function modCatalogEntry(modId) {
        return catalogEntries().find((mod) => String(mod.id) === modId) || null;
    }

    function modSupportedClients(modId) {
        const entry = modCatalogEntry(modId);
        if (!entry || !Array.isArray(entry.clients)) {
            return ['lesta', 'wot'];
        }
        return [...new Set(entry.clients.map((client) => normalizeGameClient(client)))];
    }

    function modSupportsGameClient(modId, gameClient) {
        return modSupportedClients(modId).includes(normalizeGameClient(gameClient));
    }

    let progressToastEl = null;

    function hideProgressToast() {
        if (!progressToastEl) return;
        progressToastEl.classList.remove('is-visible');
        progressToastEl.classList.add('is-hiding');
        const el = progressToastEl;
        progressToastEl = null;
        window.setTimeout(() => el.remove(), 280);
    }

    function showProgressToast(message) {
        if (!progressToastEl) {
            progressToastEl = document.createElement('div');
            progressToastEl.className = 'site-toast site-toast--info';
            progressToastEl.setAttribute('role', 'status');
            progressToastEl.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span></span>';
            document.body.appendChild(progressToastEl);
            requestAnimationFrame(() => progressToastEl.classList.add('is-visible'));
        }
        progressToastEl.querySelector('span').textContent = message;
    }

    function showInstallerToast(message, type, options) {
        hideProgressToast();
        if (typeof window.showSiteToast === 'function') {
            window.showSiteToast(message, type, options);
            return;
        }
        window.alert(message);
    }

    function confirmAction(message, options = {}) {
        if (window.AbsTacticsConfirm?.confirm) {
            return window.AbsTacticsConfirm.confirm(message, {
                title: options.title || t('confirmTitle'),
                confirmText: options.confirmText || t('confirmOk'),
                cancelText: options.cancelText || t('confirmCancel'),
            });
        }
        return Promise.resolve(window.confirm(message));
    }

    async function listPackageFiles(root, relativeDir, nameIncludes) {
        const needle = String(nameIncludes || '').toLowerCase();
        const files = [];
        try {
            const dir = await getDirHandle(root, relativeDir);
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of dir.values()) {
                if (entry.kind === 'file' && entry.name.toLowerCase().includes(needle)) {
                    files.push(entry.name);
                }
            }
        } catch (error) {
            /* missing */
        }
        return files;
    }

    function expectedPackageName(manifestMod) {
        const template = String(manifestMod.packageGamePath || '');
        const parts = template.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
    }

    class WotmodsInstaller {
        constructor(root) {
            this.root = root;
            this.unsupportedEl = document.getElementById('wotmodsInstallerUnsupported');
            this.folderPicker = document.getElementById('wotmodsFolderPicker');
            this.folderContent = document.getElementById('wotmodsFolderContent');
            this.folderPlaceholder = document.getElementById('wotmodsFolderPlaceholder');
            this.folderSelected = document.getElementById('wotmodsFolderSelected');
            this.folderTools = document.getElementById('wotmodsFolderTools');
            this.folderIcon = document.getElementById('wotmodsFolderIcon');
            this.stepMods = document.getElementById('wotmodsStepMods');
            this.modsHint = document.getElementById('wotmodsModsHint');
            this.pickBtn = document.getElementById('wotmodsPickFolderBtn');
            this.pickBtnLabel = document.getElementById('wotmodsPickFolderBtnLabel');
            this.resetBtn = document.getElementById('wotmodsResetFolderBtn');
            this.deleteChadowBtn = document.getElementById('wotmodsDeleteChadowBtn');
            this.deleteAllBtn = document.getElementById('wotmodsDeleteAllBtn');
            this.installBtn = document.getElementById('wotmodsInstallSelectedBtn');
            this.gameTitleEl = document.getElementById('wotmodsGameTitle');
            this.gameIconEl = document.getElementById('wotmodsGameIcon');
            this.gameVersionEl = document.getElementById('wotmodsGameVersion');
            this.modItems = Array.from(document.querySelectorAll('.wotmods-mod-item'));
            this.modChecks = this.modItems.map((item) => item.querySelector('.wotmods-mod-item__check')).filter(Boolean);
            this.gameDir = null;
            this.gameLabel = '';
            this.gameFolderPath = '';
            this.gameClient = 'lesta';
            this.clientVersion = '';
            this.manifest = null;
            this.manifestClient = '';
            this.modInstallState = new Map();
            this.bind();
            this.init();
            this.showFolderEmpty();
        }

        bind() {
            if (this.pickBtn) this.pickBtn.addEventListener('click', () => this.pickFolder());
            if (this.resetBtn) this.resetBtn.addEventListener('click', () => this.resetFolder());
            if (this.folderContent) {
                this.folderContent.addEventListener('click', () => {
                    if (!this.gameDir && supportsInstaller()) {
                        this.pickFolder();
                    }
                });
                this.folderContent.addEventListener('keydown', (event) => {
                    if (this.gameDir || !supportsInstaller()) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.pickFolder();
                    }
                });
            }
            if (this.deleteChadowBtn) this.deleteChadowBtn.addEventListener('click', () => this.deleteChadowMods());
            if (this.deleteAllBtn) this.deleteAllBtn.addEventListener('click', () => this.deleteAllMods());
            if (this.installBtn) this.installBtn.addEventListener('click', () => this.installSelected());
            this.modItems.forEach((item) => {
                const checkbox = item.querySelector('.wotmods-mod-item__check');
                if (!checkbox) return;
                checkbox.addEventListener('change', () => {
                    if (item.classList.contains('is-installed-locked')) {
                        checkbox.checked = true;
                        return;
                    }
                    item.classList.toggle('is-selected', checkbox.checked);
                    this.updateInstallButton();
                });
                item.addEventListener('click', (event) => {
                    if (!item.classList.contains('is-installed-locked')) return;
                    event.preventDefault();
                    event.stopPropagation();
                });
            });
        }

        init() {
            if (!supportsInstaller()) {
                if (this.unsupportedEl) this.unsupportedEl.hidden = false;
                if (this.pickBtn) this.pickBtn.disabled = true;
            } else if (this.unsupportedEl) {
                this.unsupportedEl.hidden = true;
            }
        }

        actionButtons() {
            return [
                this.pickBtn,
                this.resetBtn,
                this.deleteChadowBtn,
                this.deleteAllBtn,
                this.installBtn,
            ].filter(Boolean);
        }

        restoreActionButtons() {
            const folderSelected = !!this.gameDir;
            const installerReady = supportsInstaller();
            if (this.pickBtn) this.pickBtn.disabled = !installerReady;
            if (this.resetBtn) {
                this.resetBtn.hidden = !folderSelected;
                this.resetBtn.disabled = !folderSelected;
            }
            if (this.deleteChadowBtn) this.deleteChadowBtn.disabled = !folderSelected;
            if (this.deleteAllBtn) this.deleteAllBtn.disabled = !folderSelected;
            if (this.folderTools) this.folderTools.classList.toggle('is-locked', !folderSelected);
            this.updateInstallButton();
        }

        setStatus(kind, vars = {}) {
            const map = {
                installing: t('statusInstalling', vars),
                deleting: t('statusDeleting', vars),
                success: t('statusSuccess', vars),
                deleteSuccess: t('statusDeleteSuccess', vars),
                invalid: t('statusInvalidRoot'),
                error: t('statusError', { message: vars.message || '' }),
                picking: t('statusPicking'),
                noMods: t('statusNoModsSelected'),
            };
            const message = map[kind] || vars.message || '';
            if (!message) return;

            if (kind === 'installing' || kind === 'deleting' || kind === 'picking') {
                showProgressToast(message);
                return;
            }

            if (kind === 'success' || kind === 'deleteSuccess') {
                showInstallerToast(message, 'success', { duration: 3200 });
                return;
            }

            if (kind === 'error' || kind === 'invalid' || kind === 'noMods') {
                showInstallerToast(message, 'error', { duration: 4200 });
            }
        }

        clearStatus() {
            hideProgressToast();
        }

        getSelectedModIds() {
            return this.modItems
                .filter((item) => {
                    if (item.classList.contains('is-installed-locked')) return false;
                    if (item.classList.contains('is-unsupported')) return false;
                    const checkbox = item.querySelector('.wotmods-mod-item__check');
                    return checkbox && checkbox.checked;
                })
                .map((item) => item.getAttribute('data-wotmods-mod-id') || '')
                .filter(Boolean);
        }

        setModsLocked(locked) {
            if (this.stepMods) this.stepMods.classList.toggle('is-locked', locked);
            if (this.modsHint) {
                this.modsHint.textContent = locked ? t('modsHintLocked') : t('modsHintReady');
            }
            if (locked) {
                this.modChecks.forEach((checkbox) => {
                    checkbox.disabled = true;
                });
                this.modItems.forEach((item) => {
                    const checkbox = item.querySelector('.wotmods-mod-item__check');
                    if (checkbox) checkbox.checked = false;
                    item.classList.remove('is-selected');
                });
            } else {
                this.modItems.forEach((item) => {
                    const modId = item.getAttribute('data-wotmods-mod-id') || '';
                    const state = this.modInstallState.get(modId);
                    if (state) {
                        this.applyModInstallState(item, state);
                        return;
                    }
                    const checkbox = item.querySelector('.wotmods-mod-item__check');
                    if (checkbox) checkbox.disabled = false;
                });
                this.applyModClientAvailability();
            }
            this.updateInstallButton();
        }

        updateGameDisplay() {
            const games = gameCatalog();
            const info = games[this.gameClient] || games.lesta || { label: 'Мир танков', icon: '/assets/icons/games/mir-tankov.png' };
            if (this.gameTitleEl) this.gameTitleEl.textContent = info.label || this.gameLabel;
            if (this.gameIconEl && info.icon) {
                this.gameIconEl.src = info.icon;
                this.gameIconEl.alt = info.label || '';
            }
            if (this.gameVersionEl) {
                this.gameVersionEl.textContent = this.clientVersion ? ('v' + this.clientVersion) : '';
            }
            this.updateModClientHighlight();
        }

        updateModClientHighlight() {
            const activeClient = normalizeGameClient(this.gameClient);
            const hasFolder = !!this.gameDir;
            document.querySelectorAll('.wotmods-mod-item__client-row').forEach((row) => {
                const rowClient = normalizeGameClient(row.getAttribute('data-wotmods-client') || '');
                row.classList.toggle('is-active', hasFolder && rowClient === activeClient);
                row.classList.toggle('is-inactive', hasFolder && rowClient !== activeClient);
            });
        }

        setFolderContentInteractive(isInteractive) {
            if (!this.folderContent) return;
            if (isInteractive) {
                this.folderContent.setAttribute('role', 'button');
                this.folderContent.setAttribute('tabindex', '0');
            } else {
                this.folderContent.removeAttribute('role');
                this.folderContent.removeAttribute('tabindex');
            }
        }

        showFolderReady() {
            if (this.folderPicker) this.folderPicker.classList.add('is-ready');
            if (this.folderIcon) this.folderIcon.classList.remove('is-visible');
            if (this.gameIconEl) this.gameIconEl.classList.add('is-visible');
            if (this.resetBtn) this.resetBtn.hidden = false;
            this.setFolderContentInteractive(false);
            this.updateGameDisplay();
            this.setModsLocked(false);
            this.restoreActionButtons();
        }

        showFolderEmpty() {
            if (this.folderPicker) this.folderPicker.classList.remove('is-ready');
            if (this.folderPlaceholder) {
                this.folderPlaceholder.textContent = t('folderPlaceholder');
            }
            if (this.folderIcon) this.folderIcon.classList.add('is-visible');
            if (this.gameIconEl) {
                this.gameIconEl.classList.remove('is-visible');
                this.gameIconEl.removeAttribute('src');
                this.gameIconEl.alt = '';
            }
            if (this.gameTitleEl) this.gameTitleEl.textContent = '';
            if (this.gameVersionEl) this.gameVersionEl.textContent = '';
            if (this.resetBtn) this.resetBtn.hidden = true;
            if (this.pickBtnLabel) this.pickBtnLabel.textContent = t('pickFolder');
            this.setFolderContentInteractive(true);
            this.setModsLocked(true);
            this.updateModClientHighlight();
            this.clearStatus();
            this.restoreActionButtons();
        }

        resetFolder() {
            this.gameDir = null;
            this.gameLabel = '';
            this.gameFolderPath = '';
            this.clientVersion = '';
            this.gameClient = 'lesta';
            this.manifest = null;
            this.manifestClient = '';
            this.modInstallState.clear();
            this.modItems.forEach((item) => {
                item.classList.remove('is-installed', 'is-installed-locked', 'is-selected', 'is-updatable', 'is-unsupported');
                const checkbox = item.querySelector('.wotmods-mod-item__check');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                }
                const badge = item.querySelector('[data-wotmods-installed-badge]');
                if (badge) badge.hidden = true;
                const updateBadge = item.querySelector('[data-wotmods-update-badge]');
                if (updateBadge) updateBadge.hidden = true;
                const unsupportedBadge = item.querySelector('[data-wotmods-unsupported-badge]');
                if (unsupportedBadge) unsupportedBadge.hidden = true;
            });
            this.showFolderEmpty();
            this.updateInstallButton();
        }

        updateInstallButton() {
            if (!this.installBtn) return;
            const selected = this.getSelectedModIds();
            const installable = selected.filter((modId) => {
                const state = this.modInstallState.get(modId);
                return !state || !state.upToDate;
            });
            this.installBtn.disabled = !this.gameDir || installable.length === 0;
        }

        async ensureWritePermission() {
            if (!this.gameDir) return false;
            const options = { mode: 'readwrite' };
            try {
                if ((await this.gameDir.queryPermission(options)) === 'granted') {
                    return true;
                }
                return (await this.gameDir.requestPermission(options)) === 'granted';
            } catch (error) {
                return false;
            }
        }

        applyModClientAvailability() {
            this.modItems.forEach((item) => {
                const modId = item.getAttribute('data-wotmods-mod-id') || '';
                const supported = modSupportsGameClient(modId, this.gameClient);
                item.classList.toggle('is-unsupported', !supported);
                const unsupportedBadge = item.querySelector('[data-wotmods-unsupported-badge]');
                if (unsupportedBadge) {
                    unsupportedBadge.hidden = supported;
                    if (!supported) {
                        unsupportedBadge.title = t('statusWrongGame');
                    }
                }
                const checkbox = item.querySelector('.wotmods-mod-item__check');
                if (checkbox && !supported) {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                    item.classList.remove('is-selected');
                }
            });
            this.updateInstallButton();
        }

        async resolveModInstallState(modId, manifestMods) {
            const entry = catalogEntries().find((mod) => String(mod.id) === modId);
            const manifestMod = manifestMods.find((mod) => String(mod.id) === modId);
            if (!modSupportsGameClient(modId, this.gameClient)) {
                return {
                    installed: false,
                    upToDate: false,
                    needsUpdate: false,
                    unsupported: true,
                    targetVersion: manifestMod ? String(manifestMod.version || entry?.version || '') : '',
                    installedPackage: '',
                    expectedPackage: '',
                };
            }
            const marker = entry ? String(entry.configMarker || '') : '';
            const targetVersion = manifestMod ? String(manifestMod.version || entry?.version || '') : '';
            const expectedPackage = manifestMod ? expectedPackageName(manifestMod) : '';
            const packagePath = manifestMod
                ? formatTemplate(String(manifestMod.packageGamePath || ''), { clientVersion: this.clientVersion })
                : '';
            const expectedExt = packageExtension(this.gameClient).toLowerCase();

            let configExists = false;
            if (marker) {
                try {
                    configExists = await fileExists(this.gameDir, marker);
                } catch (error) {
                    configExists = false;
                }
            }

            let packageExists = false;
            let installedPackage = '';
            if (packagePath) {
                try {
                    packageExists = await fileExists(this.gameDir, packagePath);
                    if (packageExists) installedPackage = expectedPackage;
                } catch (error) {
                    packageExists = false;
                }
            }

            if (!packageExists && manifestMod) {
                const markers = (manifestMod.uninstall?.packageMarkers || []).map((m) => String(m).toLowerCase());
                const primaryMarker = markers[0] || 'chadow.battle-limit';
                const found = await listPackageFiles(
                    this.gameDir,
                    `mods/${this.clientVersion}`,
                    primaryMarker,
                );
                if (found.length) {
                    const matching = found.filter((name) => name.toLowerCase().endsWith(expectedExt));
                    const wrong = found.filter((name) => !name.toLowerCase().endsWith(expectedExt));
                    if (matching.length) {
                        installedPackage = matching.sort().pop();
                        packageExists = true;
                    } else if (wrong.length) {
                        installedPackage = wrong.sort().pop();
                        packageExists = true;
                    }
                }
            }

            const installed = configExists && packageExists;
            const upToDate = installed
                && !!expectedPackage
                && installedPackage.toLowerCase() === expectedPackage.toLowerCase();
            const needsUpdate = installed && !upToDate;

            return {
                installed,
                upToDate,
                needsUpdate,
                unsupported: false,
                targetVersion,
                installedPackage,
                expectedPackage,
            };
        }

        applyModInstallState(item, state) {
            const modId = item.getAttribute('data-wotmods-mod-id') || '';
            if (!modSupportsGameClient(modId, this.gameClient)) {
                this.modInstallState.set(modId, state);
                this.applyModClientAvailability();
                return;
            }
            this.modInstallState.set(modId, state);

            const badge = item.querySelector('[data-wotmods-installed-badge]');
            const updateBadge = item.querySelector('[data-wotmods-update-badge]');
            const checkbox = item.querySelector('.wotmods-mod-item__check');

            item.classList.toggle('is-installed', state.installed);
            item.classList.toggle('is-updatable', state.needsUpdate);
            item.classList.toggle('is-installed-locked', state.upToDate);

            if (badge) badge.hidden = !state.installed;
            if (updateBadge) updateBadge.hidden = !state.needsUpdate;

            if (checkbox) {
                if (state.upToDate) {
                    checkbox.checked = true;
                    checkbox.disabled = true;
                    item.classList.remove('is-selected');
                } else {
                    item.classList.remove('is-installed-locked');
                    checkbox.checked = false;
                    if (!this.stepMods?.classList.contains('is-locked')) {
                        checkbox.disabled = false;
                    }
                }
            }
        }

        async scanInstalledMods() {
            if (!this.gameDir) return;

            let manifestMods;
            try {
                manifestMods = await this.loadManifest(true);
            } catch (error) {
                manifestMods = [];
            }

            await Promise.all(this.modItems.map(async (item) => {
                const modId = item.getAttribute('data-wotmods-mod-id') || '';
                const state = await this.resolveModInstallState(modId, manifestMods);
                this.applyModInstallState(item, state);
            }));
            this.applyModClientAvailability();
            this.updateInstallButton();
        }

        relocalizeView() {
            if (this.gameDir) {
                this.updateGameDisplay();
                if (this.modsHint) this.modsHint.textContent = t('modsHintReady');
            } else {
                if (this.folderPlaceholder) this.folderPlaceholder.textContent = t('folderPlaceholder');
                if (this.pickBtnLabel) this.pickBtnLabel.textContent = t('pickFolder');
                if (this.modsHint) this.modsHint.textContent = t('modsHintLocked');
            }
            const updateLabel = t('badgeUpdate');
            document.querySelectorAll('[data-wotmods-update-badge]').forEach((el) => {
                el.textContent = updateLabel;
            });
        }

        async loadManifest(force = false) {
            const client = normalizeGameClient(this.gameClient);
            if (!force && this.manifest && this.manifestClient === client) {
                return this.manifest;
            }
            const response = await fetch(
                '/api/wotmods/manifest?client=' + encodeURIComponent(client),
                { credentials: 'same-origin' },
            );
            if (!response.ok) throw new Error(t('statusNoManifest'));
            const data = await response.json();
            if (!data.ok || !Array.isArray(data.mods) || !data.mods.length) {
                throw new Error(t('statusNoManifest'));
            }
            this.manifest = data.mods;
            this.manifestClient = client;
            return this.manifest;
        }

        buildChadowDeleteTargets(mods) {
            const files = new Set();
            const dirs = new Set();
            const packageMarkers = new Set();
            const configMarkers = new Set(['chadow.']);

            mods.forEach((mod) => {
                const spec = mod.uninstall || {};
                (spec.files || []).forEach((path) => {
                    files.add(formatTemplate(String(path), { clientVersion: this.clientVersion }));
                });
                (spec.dirs || []).forEach((path) => {
                    dirs.add(formatTemplate(String(path), { clientVersion: this.clientVersion }));
                });
                (spec.packageMarkers || []).forEach((marker) => packageMarkers.add(String(marker).toLowerCase()));
                (spec.configMarkers || []).forEach((marker) => configMarkers.add(String(marker).toLowerCase()));
            });

            return {
                files: [...files],
                dirs: [...dirs].sort((a, b) => b.length - a.length),
                packageMarkers: [...packageMarkers],
                configMarkers: [...configMarkers],
            };
        }

        async deleteChadowPackages(targets) {
            let count = 0;
            try {
                const modsRoot = await this.gameDir.getDirectoryHandle('mods');
                const versionDir = await modsRoot.getDirectoryHandle(this.clientVersion);
                const entries = [];
                // eslint-disable-next-line no-restricted-syntax
                for await (const entry of versionDir.values()) {
                    entries.push(entry);
                }
                for (const entry of entries) {
                    const lower = entry.name.toLowerCase();
                    if (targets.packageMarkers.some((marker) => lower.includes(marker))) {
                        await versionDir.removeEntry(entry.name, { recursive: true });
                        count += 1;
                    }
                }
            } catch (error) {
                /* no version packages */
            }
            return count;
        }

        async deleteChadowConfigs(targets) {
            let count = 0;
            try {
                const configsDir = await getDirHandle(this.gameDir, 'mods/configs');
                const entries = [];
                // eslint-disable-next-line no-restricted-syntax
                for await (const entry of configsDir.values()) {
                    entries.push(entry);
                }
                for (const entry of entries) {
                    const lower = entry.name.toLowerCase();
                    if (targets.configMarkers.some((marker) => lower.includes(marker))) {
                        await configsDir.removeEntry(entry.name, { recursive: true });
                        count += 1;
                    }
                }
            } catch (error) {
                /* no configs */
            }
            return count;
        }

        async pickFolder() {
            if (!supportsInstaller()) return;
            this.setStatus('picking');
            this.actionButtons().forEach((btn) => { btn.disabled = true; });

            try {
                const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
                if (!(await validateGameRoot(dir))) {
                    this.gameDir = null;
                    this.setStatus('invalid');
                    return;
                }
                const version = await detectClientVersion(dir);
                if (!version) throw new Error(t('versionDetectError'));

                this.gameDir = dir;
                this.gameLabel = dir.name;
                this.clientVersion = version;
                this.gameClient = normalizeGameClient(await detectGameClient(dir));
                this.gameFolderPath = await resolveDirectoryDisplayPath(dir, version);
                this.manifest = null;
                this.manifestClient = '';
                this.clearStatus();
                await this.scanInstalledMods();
                this.showFolderReady();
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    this.setStatus('error', { message: t('folderCancelled') });
                    return;
                }
                this.setStatus('error', { message: error.message || String(error) });
            } finally {
                this.restoreActionButtons();
            }
        }

        async deleteChadowMods() {
            if (!this.gameDir || !this.clientVersion) return;
            if (!(await confirmAction(t('confirmDeleteChadow')))) return;

            this.actionButtons().forEach((btn) => { btn.disabled = true; });
            let removed = 0;

            try {
                const mods = this.manifest || await this.loadManifest();
                this.manifest = mods;
                const targets = this.buildChadowDeleteTargets(mods);
                const queue = [...targets.dirs, ...targets.files];
                let current = 0;
                const total = queue.length;

                for (const path of queue) {
                    if (await deleteRelativePath(this.gameDir, path)) removed += 1;
                    current += 1;
                    this.setStatus('deleting', { current, total });
                }

                removed += await this.deleteChadowPackages(targets);
                removed += await this.deleteChadowConfigs(targets);

                await this.scanInstalledMods();
                this.setStatus('deleteSuccess', { count: removed });
            } catch (error) {
                const message = (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError'))
                    ? t('statusPermission')
                    : (error.message || String(error));
                this.setStatus('error', { message });
            } finally {
                this.restoreActionButtons();
            }
        }

        async deleteAllMods() {
            if (!this.gameDir || !this.clientVersion) return;
            if (!(await confirmAction(formatTemplate(t('confirmDeleteAll'), { version: this.clientVersion })))) return;

            this.actionButtons().forEach((btn) => { btn.disabled = true; });
            let removed = 0;

            try {
                const targets = [
                    `mods/${this.clientVersion}`,
                    `res_mods/${this.clientVersion}`,
                    'mods/configs',
                ];
                let current = 0;
                const total = targets.length;

                for (const relative of targets) {
                    try {
                        const dir = await getDirHandle(this.gameDir, relative);
                        removed += await clearDirectory(dir);
                    } catch (error) {
                        /* folder missing */
                    }
                    current += 1;
                    this.setStatus('deleting', { current, total });
                }

                await this.scanInstalledMods();
                this.setStatus('deleteSuccess', { count: removed });
            } catch (error) {
                const message = (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError'))
                    ? t('statusPermission')
                    : (error.message || String(error));
                this.setStatus('error', { message });
            } finally {
                this.restoreActionButtons();
            }
        }

        async installSelected() {
            if (!this.gameDir || !this.clientVersion) {
                await this.pickFolder();
                return;
            }

            const selected = this.getSelectedModIds();
            if (!selected.length) {
                this.setStatus('noMods');
                return;
            }

            const skipped = [];
            const toInstall = [];
            selected.forEach((modId) => {
                if (!modSupportsGameClient(modId, this.gameClient)) {
                    skipped.push(modId);
                    return;
                }
                const state = this.modInstallState.get(modId);
                if (state && state.upToDate) {
                    skipped.push(modId);
                    return;
                }
                toInstall.push(modId);
            });

            if (!toInstall.length) {
                showInstallerToast(t('statusNothingToInstall'), 'info', { duration: 3200 });
                return;
            }

            if (!(await this.ensureWritePermission())) {
                this.setStatus('error', { message: t('statusPermission') });
                return;
            }

            this.actionButtons().forEach((btn) => { btn.disabled = true; });

            try {
                const allMods = this.manifest || await this.loadManifest();
                this.manifest = allMods;
                const mods = allMods.filter((mod) => toInstall.includes(String(mod.id || '')));
                if (!mods.length) throw new Error(t('statusNoManifest'));

                let total = 0;
                mods.forEach((mod) => {
                    total += 1 + (mod.packageUrl ? 1 : 0);
                });
                let current = 0;
                let updatedCount = 0;

                for (const mod of mods) {
                    const modId = String(mod.id || '');
                    if (mod.supported === false || !mod.packageUrl) {
                        throw new Error(t('statusWrongGame'));
                    }
                    const state = this.modInstallState.get(modId);
                    if (state && state.needsUpdate) updatedCount += 1;

                    if (!mod.configUrl) throw new Error(t('statusNoConfig'));
                    if (!mod.packageUrl) throw new Error(t('statusNoPackage'));
                    const configBody = await fetchText(mod.configUrl);
                    await writeTextFile(this.gameDir, String(mod.configGamePath || ''), configBody);
                    current += 1;
                    this.setStatus('installing', { current, total });

                    if (mod.packageUrl) {
                        const packageTarget = formatTemplate(
                            String(mod.packageGamePath || ''),
                            { clientVersion: this.clientVersion },
                        );
                        if (!packageTarget) throw new Error(t('statusNoPackage'));

                        const wrongExt = packageExtension(this.gameClient) === '.wotmod' ? '.mtmod' : '.wotmod';
                        const markers = (mod.uninstall?.packageMarkers || []).map((m) => String(m).toLowerCase());
                        const primaryMarker = markers[0] || 'chadow.battle-limit';
                        const existingPackages = await listPackageFiles(
                            this.gameDir,
                            `mods/${this.clientVersion}`,
                            primaryMarker,
                        );
                        for (const name of existingPackages) {
                            if (name.toLowerCase().endsWith(wrongExt)) {
                                await deleteRelativePath(this.gameDir, `mods/${this.clientVersion}/${name}`);
                            }
                        }

                        if (state && state.needsUpdate && state.installedPackage) {
                            const oldPackagePath = `mods/${this.clientVersion}/${state.installedPackage}`;
                            await deleteRelativePath(this.gameDir, oldPackagePath);
                        }

                        const packageBody = await fetchArrayBuffer(mod.packageUrl);
                        await writeBinaryFile(this.gameDir, packageTarget, packageBody);
                        current += 1;
                        this.setStatus('installing', { current, total });
                    }
                }

                await this.scanInstalledMods();
                const games = gameCatalog();
                const gameLabel = (games[this.gameClient] || {}).label || this.gameLabel;
                const pathLabel = this.gameFolderPath || gameLabel;
                let successMessage = t('statusSuccess', { path: pathLabel + ' · v' + this.clientVersion });
                if (skipped.length) {
                    successMessage += ' ' + t('statusSkippedInstalled', { count: skipped.length });
                }
                if (updatedCount) {
                    successMessage += ' ' + t('statusUpdated', { count: updatedCount });
                }
                showInstallerToast(successMessage, 'success', { duration: 3600 });
                this.modItems.forEach((item) => {
                    const modId = item.getAttribute('data-wotmods-mod-id') || '';
                    const state = this.modInstallState.get(modId);
                    if (state) {
                        this.applyModInstallState(item, state);
                        return;
                    }
                    const checkbox = item.querySelector('.wotmods-mod-item__check');
                    if (!checkbox) return;
                    checkbox.checked = false;
                    item.classList.remove('is-selected', 'is-installed-locked');
                });
            } catch (error) {
                const message = (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError'))
                    ? t('statusPermission')
                    : (error.message || String(error));
                this.setStatus('error', { message });
            } finally {
                this.restoreActionButtons();
            }
        }
    }

    function init() {
        const root = document.getElementById('wotmodsInstaller');
        if (!root) return;
        window.AbsWotmodsInstaller = new WotmodsInstaller(root);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
