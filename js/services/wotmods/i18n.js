(() => {
    'use strict';

    const STRINGS = {
        ru: {
            title: 'Установка модов',
            lead: 'Пошаговая установка модов для World of Tanks или Мира танков.',
            unsupported: 'Автоустановка работает в Chrome и Edge на компьютере. В других браузерах скачайте файлы вручную.',
            stepFolder: 'Папка игры',
            folderPlaceholder: 'Папка игры не выбрана',
            resetFolderAria: 'Сбросить папку',
            pickFolder: 'Выбрать',
            deleteChadow: 'Удалить моды CHADOW',
            deleteAll: 'Удалить все моды',
            stepMods: 'Выберите моды',
            modsHintLocked: 'Сначала выберите папку игры выше.',
            modsHintReady: 'Отметьте моды и нажмите «Установить выбранные».',
            installed: 'Установлен',
            badgeUpdate: 'Доступно обновление',
            modUnsupported: 'Не поддерживается',
            modVersionLabel: 'Версия мода',
            installSelected: 'Установить выбранные',
        },
        en: {
            title: 'Mod Installation',
            lead: 'Step-by-step installation and setup of Chadow mods for World of Tanks and Mir Tankov.',
            unsupported: 'Auto-install works in Chrome and Edge on desktop. Use another browser to download mod files manually.',
            stepFolder: 'Game folder',
            folderPlaceholder: 'No game folder selected',
            resetFolderAria: 'Reset folder',
            pickFolder: 'Browse',
            deleteChadow: 'Remove CHADOW mods',
            deleteAll: 'Clear all mods',
            stepMods: 'Select mods',
            modsHintLocked: 'Select the game folder above first.',
            modsHintReady: 'Mark mods and click “Install selected”.',
            installed: 'Installed',
            badgeUpdate: 'Update available',
            modUnsupported: 'Not supported',
            modVersionLabel: 'Mod version',
            installSelected: 'Install selected',
        },
    };

    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function getLang() {
        if (window.ABS_WOTMODS_LANG === 'en' || window.ABS_WOTMODS_LANG === 'ru') {
            return normalizeLang(window.ABS_WOTMODS_LANG);
        }
        if (document.documentElement.lang === 'en') {
            return 'en';
        }
        return normalizeLang(window.ABS_LANG);
    }

    function setLang(lang) {
        const normalized = normalizeLang(lang);
        window.ABS_WOTMODS_LANG = normalized;
        window.ABS_LANG = normalized;
        applyLocaleData(normalized);
        return normalized;
    }

    function t(key) {
        const lang = getLang();
        return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.ru[key] || key;
    }

    function localeData(lang) {
        const data = window.WOTMODS_I18N_DATA;
        if (!data || typeof data !== 'object') {
            return null;
        }
        return data[normalizeLang(lang)] || data.ru || null;
    }

    function applyLocaleData(lang) {
        const pack = localeData(lang);
        if (!pack) {
            return;
        }
        if (Array.isArray(pack.catalog)) {
            window.WOTMODS_CATALOG = pack.catalog;
        }
        if (pack.games && typeof pack.games === 'object') {
            window.WOTMODS_GAMES = pack.games;
        }
        if (pack.meta && typeof pack.meta === 'object' && window.ABS_PAGE_TITLES) {
            window.ABS_PAGE_TITLES.ru = window.WOTMODS_I18N_DATA.ru?.meta?.title || window.ABS_PAGE_TITLES.ru;
            window.ABS_PAGE_TITLES.en = window.WOTMODS_I18N_DATA.en?.meta?.title || window.ABS_PAGE_TITLES.en;
        }
    }

    function setButtonLabel(btn, label) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        btn.replaceChildren();
        if (icon) {
            btn.appendChild(icon);
            btn.appendChild(document.createTextNode(' ' + label));
            return;
        }
        btn.textContent = label;
    }

    function updateModList() {
        const catalog = Array.isArray(window.WOTMODS_CATALOG) ? window.WOTMODS_CATALOG : [];
        const installedLabel = t('installed');
        document.querySelectorAll('.wotmods-mod-item[data-wotmods-mod-id]').forEach((item) => {
            const modId = item.getAttribute('data-wotmods-mod-id') || '';
            const entry = catalog.find((mod) => String(mod.id) === modId);
            if (!entry) return;
            const titleEl = item.querySelector('.wotmods-mod-item__title');
            const authorLabelEl = item.querySelector('[data-wotmods-author-label]');
            const authorNameEl = item.querySelector('.wotmods-mod-item__author-name');
            const descEl = item.querySelector('.wotmods-mod-item__desc');
            const badgeEl = item.querySelector('[data-wotmods-installed-badge]');
            const updateBadgeEl = item.querySelector('[data-wotmods-update-badge]');
            const unsupportedBadgeEl = item.querySelector('[data-wotmods-unsupported-badge]');
            if (titleEl) titleEl.textContent = String(entry.title || '');
            if (authorLabelEl) {
                authorLabelEl.textContent = String(
                    entry.authorLabel || (getLang() === 'en' ? 'Author:' : 'Автор:')
                );
            }
            if (authorNameEl) authorNameEl.textContent = String(entry.author || '');
            if (descEl) descEl.textContent = String(entry.short || '');
            if (badgeEl) badgeEl.textContent = installedLabel;
            if (updateBadgeEl) updateBadgeEl.textContent = t('badgeUpdate');
            if (unsupportedBadgeEl) unsupportedBadgeEl.textContent = t('modUnsupported');
        });

        document.querySelectorAll('.wotmods-mod-block[data-wotmods-mod-block]').forEach((block) => {
            const modId = block.getAttribute('data-wotmods-mod-block') || '';
            const entry = catalog.find((mod) => String(mod.id) === modId);
            if (!entry) return;
            const usageTitleEl = block.querySelector('.wotmods-mod-usage__title');
            const usageListEl = block.querySelector('.wotmods-mod-usage__list');
            if (usageTitleEl) {
                usageTitleEl.textContent = String(
                    entry.usageTitle || (getLang() === 'en' ? 'How to use' : 'Как пользоваться')
                );
            }
            if (usageListEl && Array.isArray(entry.usage)) {
                usageListEl.replaceChildren();
                entry.usage.forEach((line) => {
                    const text = String(line || '').trim();
                    if (!text) return;
                    const li = document.createElement('li');
                    li.textContent = text;
                    usageListEl.appendChild(li);
                });
            }
        });
    }

    function applyDom() {
        const titleEl = document.querySelector('.wotmods-workspace__title');
        const leadEl = document.querySelector('.wotmods-workspace__lead');
        const unsupportedEl = document.getElementById('wotmodsInstallerUnsupported');
        const stepFolderTitle = document.getElementById('wotmodsStepFolderTitle');
        const folderPlaceholder = document.getElementById('wotmodsFolderPlaceholder');
        const pickBtnLabel = document.getElementById('wotmodsPickFolderBtnLabel');
        const resetBtn = document.getElementById('wotmodsResetFolderBtn');
        const deleteChadowBtn = document.getElementById('wotmodsDeleteChadowBtn');
        const deleteAllBtn = document.getElementById('wotmodsDeleteAllBtn');
        const stepModsTitle = document.getElementById('wotmodsStepModsTitle');
        const modsHint = document.getElementById('wotmodsModsHint');
        const installBtn = document.getElementById('wotmodsInstallSelectedBtn');
        const installBtnLabel = installBtn ? installBtn.querySelector('span') : null;

        if (titleEl) titleEl.textContent = t('title');
        if (leadEl) leadEl.textContent = t('lead');
        if (unsupportedEl) unsupportedEl.textContent = t('unsupported');
        if (stepFolderTitle) stepFolderTitle.textContent = t('stepFolder');
        if (folderPlaceholder) folderPlaceholder.textContent = t('folderPlaceholder');
        if (pickBtnLabel) pickBtnLabel.textContent = t('pickFolder');
        if (resetBtn) resetBtn.setAttribute('aria-label', t('resetFolderAria'));
        setButtonLabel(deleteChadowBtn, t('deleteChadow'));
        setButtonLabel(deleteAllBtn, t('deleteAll'));
        if (stepModsTitle) stepModsTitle.textContent = t('stepMods');
        if (modsHint) {
            const locked = document.getElementById('wotmodsStepMods')?.classList.contains('is-locked');
            modsHint.textContent = locked ? t('modsHintLocked') : t('modsHintReady');
        }
        if (installBtnLabel) installBtnLabel.textContent = t('installSelected');
        document.querySelectorAll('[data-wotmods-version-label]').forEach((el) => {
            el.textContent = t('modVersionLabel');
        });
        updateModList();
    }

    function switchLanguage(newLang) {
        const normalized = setLang(newLang);
        document.documentElement.lang = normalized;
        applyDom();
        if (window.AbsWotmodsInstaller && typeof window.AbsWotmodsInstaller.relocalizeView === 'function') {
            window.AbsWotmodsInstaller.relocalizeView();
        }
        if (typeof window.absUpdateDocumentTitle === 'function') {
            window.absUpdateDocumentTitle(normalized);
        }
        window.dispatchEvent(new CustomEvent('wotmods:langchange', { detail: { lang: normalized } }));
        return true;
    }

    window.AbsWotmodsI18n = {
        getLang,
        setLang,
        normalizeLang,
        t,
        applyDom,
        switchLanguage,
    };
})();
