function showSiteToast(message, type, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const existing = document.querySelector('.site-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `site-toast site-toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    let iconClass = 'fa-check-circle';
    if (type === 'error') {
        iconClass = 'fa-exclamation-circle';
    } else if (type === 'info') {
        iconClass = 'fa-circle-notch fa-spin';
    }
    toast.innerHTML = `<i class="fas ${iconClass}" aria-hidden="true"></i><span></span>`;
    toast.querySelector('span').textContent = message;
    document.body.appendChild(toast);

    if (opts.instant) {
        void toast.offsetWidth;
        toast.classList.add('is-visible');
    } else {
        requestAnimationFrame(() => toast.classList.add('is-visible'));
    }

    const duration = Number.isFinite(opts.duration) ? opts.duration : 3200;
    window.setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.classList.add('is-hiding');
        window.setTimeout(() => toast.remove(), 280);
    }, duration);
}

window.showSiteToast = showSiteToast;
window.AbsSiteToast = {
    show(message, type, options) {
        showSiteToast(message, type, options);
    },
};
