(() => {
    function normalizeLang(lang) {
        return lang === 'en' ? 'en' : 'ru';
    }

    function siteNameForLang(lang) {
        const normalized = normalizeLang(lang);
        const names = window.ABS_SITE_NAMES || {};
        return String(names[normalized] || names.ru || names.en || '').trim();
    }

    function formatSiteTitle(pageTitle, lang) {
        const title = String(pageTitle || '').trim();
        const siteName = siteNameForLang(lang);
        const names = window.ABS_SITE_NAMES || {};
        const ruName = String(names.ru || '').trim();
        const enName = String(names.en || '').trim();
        if (title !== '' && ruName !== '' && enName !== '' && (title === ruName || title === enName)) {
            return siteName || title;
        }
        if (!title || !siteName || title === siteName) {
            return title || siteName;
        }
        if (title.toLowerCase().includes(siteName.toLowerCase())) {
            return title;
        }
        return `${title} | ${siteName}`;
    }

    function pageTitleForLang(lang) {
        const normalized = normalizeLang(lang);
        const titles = window.ABS_PAGE_TITLES || {};
        const primary = String(titles[normalized] || '').trim();
        if (primary) return primary;
        const fallback = String(titles[normalized === 'en' ? 'ru' : 'en'] || '').trim();
        if (fallback) return fallback;
        const siteName = siteNameForLang(lang);
        if (siteName) return siteName;
        if (document.title.includes(' | ')) {
            return document.title.split(' | ')[0].trim();
        }
        return document.title.trim();
    }

    function setDocumentTitle(pageTitle, lang) {
        document.title = formatSiteTitle(pageTitle, lang);
    }

    function updateDocumentTitle(lang) {
        const pageTitle = pageTitleForLang(lang);
        if (pageTitle) {
            setDocumentTitle(pageTitle, lang);
        }
    }

    window.absFormatSiteTitle = formatSiteTitle;
    window.absSetDocumentTitle = setDocumentTitle;
    window.absUpdateDocumentTitle = updateDocumentTitle;
})();
