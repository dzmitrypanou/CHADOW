window.showProfileToast = function showProfileToast(message, type) {
    if (typeof window.showSiteToast === 'function') {
        window.showSiteToast(message, type);
        return;
    }
    window.alert(message);
};
