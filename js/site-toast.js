window.showSiteToast = function showSiteToast(message, type, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const existing = document.querySelector('.site-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `site-toast site-toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = type === 'error' ? 'exclamation-circle' : 'check-circle';
    toast.innerHTML = `<i class="fas fa-${icon}" aria-hidden="true"></i><span></span>`;
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
};
