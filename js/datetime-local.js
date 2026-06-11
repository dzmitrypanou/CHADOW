(() => {
    const DISPLAY_TZ = 'Europe/Moscow';
    const DISPLAY_OFFSET = 'UTC+3';

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function parseUtcTimestamp(utcString) {
        const raw = String(utcString || '').trim();
        if (!raw) {
            return null;
        }

        let normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
        if (!/Z$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
            normalized += 'Z';
        }

        const ts = Date.parse(normalized);
        return Number.isFinite(ts) ? ts : null;
    }

    function formatUtcLocal(utcString) {
        const ts = parseUtcTimestamp(utcString);
        if (ts === null) {
            return String(utcString || '').trim();
        }

        const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-GB', {
                timeZone: DISPLAY_TZ,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).formatToParts(new Date(ts)).map((part) => [part.type, part.value])
        );

        const display = `${parts.year}-${parts.month}-${parts.day} `
            + `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;

        return `${display} ${DISPLAY_OFFSET}`;
    }

    function applyLocalTimes(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('time[datetime]').forEach((el) => {
            const utc = el.getAttribute('datetime');
            if (!utc) {
                return;
            }
            el.textContent = formatUtcLocal(utc);
        });
    }

    window.absFormatUtcLocal = formatUtcLocal;
    window.absApplyLocalTimes = applyLocalTimes;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyLocalTimes(document));
    } else {
        applyLocalTimes(document);
    }
})();
