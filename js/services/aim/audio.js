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

    function tone(options) {
        const audioCtx = ensureCtx();
        if (!audioCtx || !unlocked) return;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        const startAt = options.delay || 0;
        const duration = options.duration || 0.06;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = options.type || 'triangle';
        osc.frequency.setValueAtTime(options.freq || 440, audioCtx.currentTime + startAt);

        filter.type = options.filterType || 'lowpass';
        filter.frequency.setValueAtTime(options.filter || 1800, audioCtx.currentTime + startAt);

        const peak = (options.gain || 0.08) * (window.AbsAimVolume ? window.AbsAimVolume.get() : 1);
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(peak, audioCtx.currentTime + startAt + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startAt + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + startAt);
        osc.stop(audioCtx.currentTime + startAt + duration + 0.02);
    }

    function noiseBurst(options) {
        const audioCtx = ensureCtx();
        if (!audioCtx || !unlocked) return;

        const duration = options.duration || 0.05;
        const sampleRate = audioCtx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = audioCtx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }

        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = options.filter || 900;
        const peak = (options.gain || 0.05) * (window.AbsAimVolume ? window.AbsAimVolume.get() : 1);
        gain.gain.setValueAtTime(peak, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();
    }

    function warmupAudio() {
        const audioCtx = ensureCtx();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (unlocked) return;

        if (audioCtx) {
            const buffer = audioCtx.createBuffer(1, 1, 22050);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            try {
                source.start(0);
            } catch (e) {
                // ignore
            }
        }

        unlocked = true;
    }

    function playStart() {
        tone({ freq: 420, duration: 0.07, gain: 0.07, type: 'sine', filter: 1400 });
        tone({ freq: 620, duration: 0.08, gain: 0.08, type: 'triangle', delay: 0.06, filter: 1800 });
        tone({ freq: 880, duration: 0.1, gain: 0.07, type: 'sine', delay: 0.12, filter: 2200 });
    }

    function playShot() {
        noiseBurst({ duration: 0.022, gain: 0.04, filter: 2800 });
        tone({ freq: 980, duration: 0.028, gain: 0.055, type: 'square', filter: 2400 });
    }

    function playHit() {
        tone({ freq: 760, duration: 0.05, gain: 0.09, type: 'sine', filter: 2200 });
        tone({ freq: 1180, duration: 0.05, gain: 0.06, type: 'triangle', delay: 0.02, filter: 2600 });
    }

    function playMiss() {
        tone({ freq: 180, duration: 0.1, gain: 0.08, type: 'triangle', filter: 500 });
        tone({ freq: 120, duration: 0.12, gain: 0.05, type: 'sawtooth', delay: 0.04, filter: 400 });
    }

    function playGo() {
        tone({ freq: 520, duration: 0.06, gain: 0.09, type: 'sine', filter: 1600 });
        tone({ freq: 880, duration: 0.08, gain: 0.1, type: 'sine', delay: 0.05, filter: 2200 });
    }

    function playEarly() {
        tone({ freq: 220, duration: 0.12, gain: 0.11, type: 'sawtooth', filter: 700 });
        tone({ freq: 160, duration: 0.14, gain: 0.08, type: 'square', delay: 0.06, filter: 500 });
    }

    function playSuccess() {
        tone({ freq: 640, duration: 0.05, gain: 0.08, type: 'triangle', filter: 1800 });
        tone({ freq: 960, duration: 0.06, gain: 0.06, type: 'sine', delay: 0.03, filter: 2400 });
    }

    function playLockOn() {
        tone({ freq: 420, duration: 0.04, gain: 0.05, type: 'sine', filter: 1200 });
        tone({ freq: 620, duration: 0.05, gain: 0.04, type: 'triangle', delay: 0.025, filter: 1600 });
    }

    function playEscaped() {
        noiseBurst({ duration: 0.07, gain: 0.035, filter: 700 });
        tone({ freq: 280, duration: 0.1, gain: 0.04, type: 'triangle', filter: 900 });
    }

    function bindTrainer(trainerId) {
        if (trainerId === 'vugich') {
            return {
                warmupAudio: () => {},
                start: () => {},
                shot: () => {},
                hit: () => {},
                miss: () => {},
                go: () => {},
                early: () => {},
                success: () => {},
                lockOn: () => {},
                escaped: () => {},
            };
        }

        return {
            warmupAudio,
            start: playStart,
            shot: playShot,
            hit: playHit,
            miss: playMiss,
            go: playGo,
            early: playEarly,
            success: playSuccess,
            lockOn: playLockOn,
            escaped: playEscaped,
        };
    }

    window.AbsAimSounds = {
        warmupAudio,
        bindTrainer,
        playStart,
        playShot,
        playHit,
        playMiss,
        playGo,
        playEarly,
        playSuccess,
        playLockOn,
        playEscaped,
    };
})();
