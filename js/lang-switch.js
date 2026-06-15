(() => {
    function normalizePublicPathname(pathname) {
        let path = typeof pathname === 'string' && pathname !== '' ? pathname : '/';
        path = path.split('?')[0].split('#')[0];
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        path = path.replace(/\/index\.php$/i, '');
        path = path.replace(/\/room\.php$/i, '');
        return path || '/';
    }

    function buildLangPath(pathname, lang) {
        const path = normalizePublicPathname(pathname);
        if (lang === 'en') {
            if (path === '/') return '/en';
            if (path === '/en' || path.indexOf('/en/') === 0) return path;
            return '/en' + path;
        }
        if (path === '/en') return '/';
        if (path.indexOf('/en/') === 0) {
            const ru = path.slice(3);
            return ru === '' ? '/' : ru;
        }
        return path;
    }

    function getHrefForLang(currentHref, lang) {
        if (typeof currentHref !== 'string' || currentHref === '') return currentHref;
        if (/^https?:\/\//i.test(currentHref)) return currentHref;
        if (currentHref[0] !== '/') return currentHref;
        return buildLangPath(currentHref, lang);
    }

    function updateLangLinks(lang) {
        document.querySelectorAll('.site-lang-link').forEach((link) => {
            const linkLang = link.getAttribute('data-lang');
            if (linkLang) {
                link.classList.toggle('is-active', linkLang === lang);
            }
            link.href = getHrefForLang(normalizePublicPathname(window.location.pathname), linkLang || lang);
        });
    }

    function updateHeaderFooterTexts(lang) {
        const isEn = lang === 'en';
        const logo = document.getElementById('siteLogoLink');
        if (logo) {
            const txt = logo.getAttribute(isEn ? 'data-text-en' : 'data-text-ru');
            const href = logo.getAttribute(isEn ? 'data-href-en' : 'data-href-ru');
            if (txt) {
                const logoText = logo.querySelector('.site-logo-text');
                if (logoText) {
                    logoText.textContent = txt;
                } else if (!logo.querySelector('.site-logo-img')) {
                    logo.textContent = txt;
                }
            }
            if (href) logo.href = href;
        }

        document.querySelectorAll('.site-header-nav a, .site-footer-nav a').forEach((a) => {
            const label = a.getAttribute(isEn ? 'data-label-en' : 'data-label-ru');
            const href = a.getAttribute(isEn ? 'data-href-en' : 'data-href-ru');
            if (label) a.textContent = label;
            if (href && !/^https?:\/\//i.test(href)) {
                a.href = href;
            }
        });

        if (typeof window.absUpdateDocumentTitle === 'function'
            && !document.body.classList.contains('page-recruiting')
            && !document.body.classList.contains('page-online')
            && !document.getElementById('uploadArea')) {
            window.absUpdateDocumentTitle(lang);
        }

        updateAuthLinks(lang);
    }

    function initSiteLawHelp() {
        document.querySelectorAll('.site-law-help-wrap').forEach((wrap) => {
            const btn = wrap.querySelector('.site-law-help');
            if (!btn || btn.dataset.lawHelpBound === '1') {
                return;
            }
            btn.dataset.lawHelpBound = '1';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const open = wrap.classList.toggle('is-open');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });

        document.addEventListener('click', (e) => {
            document.querySelectorAll('.site-law-help-wrap.is-open').forEach((wrap) => {
                if (wrap.contains(e.target)) {
                    return;
                }
                wrap.classList.remove('is-open');
                const btn = wrap.querySelector('.site-law-help');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') {
                return;
            }
            document.querySelectorAll('.site-law-help-wrap.is-open').forEach((wrap) => {
                wrap.classList.remove('is-open');
                const btn = wrap.querySelector('.site-law-help');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    function updateAuthLinks(lang) {
        const isEn = lang === 'en';
        const login = document.querySelector('.site-header-auth a[href*="/auth/login"]');
        if (login) {
            login.href = isEn ? '/en/auth/login' : '/auth/login';
            const title = isEn ? 'Log in' : 'Авторизация';
            login.title = title;
            login.setAttribute('aria-label', title);
        }

        const profile = document.querySelector('.site-header-auth a[href*="/auth/profile"]');
        if (profile) {
            profile.href = isEn ? '/en/auth/profile' : '/auth/profile';
            const title = isEn ? 'Account' : 'Аккаунт';
            profile.title = title;
            profile.setAttribute('aria-label', title);
        }

        const logoutForm = document.querySelector('.site-header-logout-form');
        if (logoutForm) {
            logoutForm.action = isEn ? '/en/auth/logout' : '/auth/logout';
            const btn = logoutForm.querySelector('button');
            if (btn) {
                const title = isEn ? 'Log out' : 'Выйти';
                btn.title = title;
                btn.setAttribute('aria-label', title);
            }
        }
    }

    function updateIndexStaticTexts(lang) {
        const isEn = lang === 'en';
        const uploadText = document.getElementById('uploadText');
        if (uploadText) {
            uploadText.innerHTML = isEn
                ? 'Drag replay files here <span>choose files</span>'
                : 'Перетащите файлы реплеев сюда <span>выберите файлы</span>';
        }

        const uploadFormatHint = document.getElementById('uploadFormatHint');
        if (uploadFormatHint) {
            uploadFormatHint.textContent = isEn
                ? 'Formats: .mtreplay, .wotreplay. Maximum file size: 10 MB.'
                : 'Форматы: .mtreplay, .wotreplay. Максимальный размер одного файла: 10 МБ.';
        }

        const saveReplaySwitchText = document.getElementById('saveReplaySwitchText');
        if (saveReplaySwitchText) {
            saveReplaySwitchText.textContent = isEn
                ? 'Save replay copies on the server'
                : 'Сохранять копии реплеев на сервере';
        }

        const saveReplayConsentHint = document.getElementById('saveReplayConsentHint');
        if (saveReplayConsentHint) {
            saveReplayConsentHint.textContent = isEn
                ? 'By default disabled. Without consent, files are analyzed only in your browser. Files are stored for 30 days. When enabled, no more than 50 replays per batch; if you select more, the upload will be cancelled.'
                : 'Без вашего согласия файлы анализируются только в браузере (на вашем устройстве). При включённой опции за один раз не более 50 реплеев; если выбрано больше, загрузка не выполняется.';
        }

        const minBattlesLabel = document.getElementById('minBattlesLabel');
        if (minBattlesLabel) {
            minBattlesLabel.textContent = isEn ? 'Min. battles' : 'Мин. боёв';
        }

        const minBattlesUp = document.getElementById('minBattlesUp');
        if (minBattlesUp) {
            minBattlesUp.title = isEn ? 'Increase' : 'Увеличить';
            minBattlesUp.setAttribute('aria-label', isEn ? 'Increase min battles' : 'Увеличить минимум боёв');
        }
        const minBattlesDown = document.getElementById('minBattlesDown');
        if (minBattlesDown) {
            minBattlesDown.title = isEn ? 'Decrease' : 'Уменьшить';
            minBattlesDown.setAttribute('aria-label', isEn ? 'Decrease min battles' : 'Уменьшить минимум боёв');
        }

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.title = isEn ? 'Download table as JPEG' : 'Скачать таблицу как JPEG';
            downloadBtn.innerHTML = `<i class="fas fa-download"></i> ${isEn ? 'Download statistics' : 'Скачать статистику'}`;
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.innerHTML = `<i class="fas fa-trash-alt"></i> ${isEn ? 'Clear all data' : 'Очистить все данные'}`;
        }

        const loading = document.getElementById('loading');
        if (loading && !loading.classList.contains('is-active')) {
            loading.innerHTML = '';
        }
    }

    async function switchOnlineLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_LANG === lang) return true;

        if (!window.AbsOnline || typeof window.AbsOnline.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsOnline.switchLanguage(lang);
        window.ABS_LANG = lang;
        document.documentElement.lang = lang;

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchRecruitingLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_RECRUITING_LANG === lang) return true;

        if (!window.AbsRecruitingI18n || typeof window.AbsRecruitingI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsRecruitingI18n.switchLanguage(lang);

        if (window.AbsRecruiting && typeof window.AbsRecruiting.relocalizeView === 'function') {
            window.AbsRecruiting.relocalizeView();
        }

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchLandingLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_LANG === lang) return true;

        if (!window.AbsLandingI18n || typeof window.AbsLandingI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsLandingI18n.switchLanguage(lang);

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchTacticsLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_TACTICS_LANG === lang && window.ABS_LANG === lang) return true;

        if (!window.AbsTacticsI18n || typeof window.AbsTacticsI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsTacticsI18n.switchLanguage(lang);

        if (window.AbsTacticsLobby && typeof window.AbsTacticsLobby.relocalizeView === 'function') {
            window.AbsTacticsLobby.relocalizeView();
        }
        if (window.AbsTacticsRoomsPage && typeof window.AbsTacticsRoomsPage.relocalizeView === 'function') {
            window.AbsTacticsRoomsPage.relocalizeView();
        }
        if (window.AbsTacticsRoom && typeof window.AbsTacticsRoom.relocalizeView === 'function') {
            window.AbsTacticsRoom.relocalizeView();
        }

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchBracketLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_BRACKET_LANG === lang && window.ABS_LANG === lang) return true;

        if (!window.AbsBracketI18n || typeof window.AbsBracketI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsBracketI18n.switchLanguage(lang);

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchProfileLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_PROFILE_LANG === lang && window.ABS_LANG === lang) return true;

        if (!window.AbsProfileI18n || typeof window.AbsProfileI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsProfileI18n.switchLanguage(lang);

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchAimLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_AIM_LANG === lang && window.ABS_LANG === lang) return true;

        if (!window.AbsAimI18n || typeof window.AbsAimI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsAimI18n.switchLanguage(lang);

        if (window.AbsAimLobby && typeof window.AbsAimLobby.relocalizeView === 'function') {
            window.AbsAimLobby.relocalizeView();
        }
        if (window.AbsAimPlay && typeof window.AbsAimPlay.relocalizeView === 'function') {
            window.AbsAimPlay.relocalizeView();
        }
        if (window.AbsAimRatings && typeof window.AbsAimRatings.relocalizeView === 'function') {
            window.AbsAimRatings.relocalizeView();
        }

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchCheckersLanguage(lang) {
        if (lang !== 'ru' && lang !== 'en') return false;
        if (window.ABS_CHECKERS_LANG === lang && window.ABS_LANG === lang) return true;

        if (!window.AbsCheckersI18n || typeof window.AbsCheckersI18n.switchLanguage !== 'function') {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return true;
        }

        window.AbsCheckersI18n.switchLanguage(lang);

        if (window.AbsCheckersRoom && typeof window.AbsCheckersRoom.relocalizeView === 'function') {
            window.AbsCheckersRoom.relocalizeView();
        }
        if (window.AbsCheckersLobby && typeof window.AbsCheckersLobby.relocalizeView === 'function') {
            window.AbsCheckersLobby.relocalizeView();
        }
        if (window.AbsOnlinegamesHub && typeof window.AbsOnlinegamesHub.relocalizeView === 'function') {
            window.AbsOnlinegamesHub.relocalizeView();
        }

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        return true;
    }

    async function switchOnlineGamesLanguage(lang) {
        return switchCheckersLanguage(lang);
    }

    async function switchLanguageInPlace(lang) {
        if (document.body.classList.contains('page-auth-profile')) {
            await switchProfileLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-checkers')
            || document.body.classList.contains('page-onlinegames')) {
            await switchOnlineGamesLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-online')) {
            await switchOnlineLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-recruiting')) {
            await switchRecruitingLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-bracket')) {
            await switchBracketLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-tactics')) {
            await switchTacticsLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-aim')) {
            await switchAimLanguage(lang);
            return;
        }

        if (document.body.classList.contains('page-landing')) {
            await switchLandingLanguage(lang);
            return;
        }

        const hasMainApp = typeof AppConstants !== 'undefined'
            && typeof API !== 'undefined'
            && typeof FiltersUI !== 'undefined'
            && typeof Renderer !== 'undefined'
            && typeof UI !== 'undefined';

        if (!hasMainApp || !document.getElementById('uploadArea')) {
            window.location.href = buildLangPath(window.location.pathname, lang) + window.location.search + window.location.hash;
            return;
        }

        if (lang !== 'ru' && lang !== 'en') return;
        if (window.ABS_LANG === lang) return;

        window.ABS_LANG = lang;
        AppConstants.LANG = lang;
        AppConstants.COLUMN_HEADERS = lang === 'en'
            ? AppConstants.COLUMN_HEADERS_EN
            : AppConstants.COLUMN_HEADERS_RU;
        API.lang = lang;

        document.documentElement.lang = lang;
        if (typeof window.absSetDocumentTitle === 'function') {
            window.absSetDocumentTitle(
                lang === 'en' ? 'ABS Replays Analysis' : 'Анализ АБС реплеев',
                lang
            );
        } else {
            document.title = lang === 'en' ? 'ABS Replays Analysis' : 'Анализ АБС реплеев';
        }

        const newPath = buildLangPath(window.location.pathname, lang);
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);

        updateLangLinks(lang);
        updateHeaderFooterTexts(lang);
        updateIndexStaticTexts(lang);

        if (typeof API.relocalizeCaches === 'function') {
            API.relocalizeCaches();
        } else {
            await Promise.all([API.loadTankDictionary(), API.loadMapDictionary()]);
        }

        FiltersUI.renderFilters();
        Renderer.updateDisplay();
        UI.checkAndHideContent();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSiteLawHelp();
        document.querySelectorAll('.site-lang-link[data-lang]').forEach((link) => {
            link.addEventListener('click', async (e) => {
                const lang = link.getAttribute('data-lang');
                if (lang !== 'ru' && lang !== 'en') return;
                e.preventDefault();
                await switchLanguageInPlace(lang);
            });
        });
    });
})();
