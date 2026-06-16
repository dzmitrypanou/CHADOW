(() => {
    'use strict';

    const STORAGE_KEY = 'chadow_aim_volume';
    const DEFAULT_VOLUME = 0.75;

    let currentVolume = load();

    function clamp(value) {
        return Math.min(1, Math.max(0, value));
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === null || raw === '') {
                return DEFAULT_VOLUME;
            }
            const parsed = Number.parseFloat(raw);
            if (Number.isFinite(parsed)) {
                return clamp(parsed);
            }
        } catch (e) {

        }
        return DEFAULT_VOLUME;
    }

    function save(value) {
        currentVolume = clamp(value);
        try {
            localStorage.setItem(STORAGE_KEY, String(currentVolume));
        } catch (e) {

        }
        syncControls(currentVolume);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aim:volumechange', {
                detail: { volume: currentVolume },
            }));
        }
        return currentVolume;
    }

    function get() {
        return currentVolume;
    }

    function apply(baseVolume) {
        const base = Number(baseVolume);
        if (!Number.isFinite(base)) {
            return currentVolume;
        }
        return base * currentVolume;
    }

    function volumeLabel() {
        if (window.AbsAimI18n && typeof window.AbsAimI18n.t === 'function') {
            return window.AbsAimI18n.t('volumeLabel');
        }
        return document.documentElement.lang === 'en' ? 'Volume' : 'Громкость';
    }

    function syncControls(value) {
        document.querySelectorAll('[data-aim-volume-slider]').forEach((slider) => {
            if (Number.parseFloat(slider.value) !== value) {
                slider.value = String(value);
            }
        });
        document.querySelectorAll('[data-aim-volume-value]').forEach((el) => {
            el.textContent = Math.round(value * 100) + '%';
        });
    }

    function mount(container) {
        if (!container || container.dataset.aimVolumeMounted === '1') {
            return;
        }
        container.dataset.aimVolumeMounted = '1';

        const compact = container.dataset.aimVolumeCompact === '1'
            || container.classList.contains('aim-volume-mount--compact');

        const wrap = document.createElement('div');
        wrap.className = 'aim-volume-control' + (compact ? ' aim-volume-control--compact' : '');

        const label = document.createElement('span');
        label.setAttribute('data-aim-i18n', 'volumeLabel');
        label.textContent = volumeLabel();

        const icon = compact ? null : document.createElement('i');
        if (icon) {
            icon.className = 'fas fa-volume-up aim-volume-control__icon';
            icon.setAttribute('aria-hidden', 'true');
        }

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.className = 'aim-volume-control__slider';
        slider.value = String(currentVolume);
        slider.setAttribute('data-aim-volume-slider', '1');
        slider.setAttribute('aria-label', volumeLabel());
        slider.title = volumeLabel();

        const valueEl = document.createElement('span');
        valueEl.setAttribute('data-aim-volume-value', '1');
        valueEl.textContent = Math.round(currentVolume * 100) + '%';
        if (!compact) {
            valueEl.className = 'aim-volume-control__value';
        }

        if (compact) {
            wrap.className = 'aim-hud-stat aim-hud-stat--volume';

            const head = document.createElement('div');
            head.className = 'aim-volume-stat__head';

            const title = document.createElement('span');
            title.className = 'aim-volume-stat__title';

            label.className = 'aim-volume-stat__label';
            valueEl.className = 'aim-volume-stat__pct';

            title.appendChild(label);
            title.appendChild(valueEl);
            head.appendChild(title);
            wrap.appendChild(head);
            wrap.appendChild(slider);
        } else {
            label.className = 'aim-volume-control__label';
            wrap.appendChild(label);
            wrap.appendChild(icon);
            wrap.appendChild(slider);
            wrap.appendChild(valueEl);
        }

        slider.addEventListener('input', () => {
            save(Number.parseFloat(slider.value));
            if (icon) {
                const next = get();
                icon.className = next <= 0.01
                    ? 'fas fa-volume-mute aim-volume-control__icon'
                    : (next < 0.45
                        ? 'fas fa-volume-down aim-volume-control__icon'
                        : 'fas fa-volume-up aim-volume-control__icon');
            }
        });

        container.appendChild(wrap);
        syncControls(currentVolume);
    }

    function mountAll() {
        document.querySelectorAll('[data-aim-volume-mount]').forEach(mount);
    }

    window.AbsAimVolume = {
        STORAGE_KEY,
        DEFAULT_VOLUME,
        get,
        load,
        save,
        apply,
        mount,
        mountAll,
    };

    document.addEventListener('DOMContentLoaded', mountAll);
})();
