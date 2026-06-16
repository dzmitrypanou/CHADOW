(() => {
    'use strict';

    let ctx = null;
    let unlocked = false;

    function ensureCtx() {
        if (!ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            ctx = new Ctx();
        }
        return ctx;
    }

    function unlock() {
        const audioCtx = ensureCtx();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (unlocked) return;

        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        try {
            source.start(0);
        } catch (e) {

        }
        unlocked = true;
    }

    function tone(options) {
        const audioCtx = ensureCtx();
        if (!audioCtx || !unlocked) return;

        const startAt = options.delay || 0;
        const duration = options.duration || 0.06;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = options.type || 'triangle';
        osc.frequency.setValueAtTime(options.freq || 440, audioCtx.currentTime + startAt);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(options.filter || 1800, audioCtx.currentTime + startAt);

        const peak = options.gain || 0.08;
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(peak, audioCtx.currentTime + startAt + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startAt + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + startAt);
        osc.stop(audioCtx.currentTime + startAt + duration + 0.02);
    }

    function playMove() {
        tone({ freq: 620, duration: 0.055, gain: 0.09, type: 'triangle', filter: 1400 });
        tone({ freq: 920, duration: 0.035, gain: 0.04, type: 'sine', delay: 0.018, filter: 2200 });
    }

    function playCapture(captureCount) {
        const count = Math.max(1, Number(captureCount) || 1);
        tone({ freq: 320, duration: 0.07, gain: 0.11, type: 'square', filter: 900 });
        tone({ freq: 180, duration: 0.09, gain: 0.07, type: 'triangle', delay: 0.04, filter: 700 });
        if (count > 1) {
            tone({ freq: 420, duration: 0.05, gain: 0.08, type: 'square', delay: 0.11, filter: 1100 });
        }
    }

    window.AbsCheckersSounds = {
        unlock,
        playMove,
        playCapture,
    };
})();
