// audio.js — Procedural Web Audio API sounds (no external files)

let ctx = null;
let masterGain = null;

export function initAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
}

export function ensureAudio() {
    if (!ctx) initAudio();
    if (ctx.state === 'suspended') ctx.resume();
}

function noise(duration, volume = 0.2) {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * volume;
    }
    return buffer;
}

function playBuffer(buffer, volume = 0.3, detune = 0) {
    if (!ctx || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (detune) source.detune.value = detune;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + buffer.duration);
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
}

function playTone(freq, duration, type = 'sine', volume = 0.2, rampDown = true) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    if (rampDown) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

function playSweep(startFreq, endFreq, duration, type = 'sawtooth', volume = 0.15) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

// -- Public Sound Effects --

export function playHit() {
    ensureAudio();
    playTone(120, 0.1, 'sine', 0.25);
    playTone(80, 0.08, 'triangle', 0.15);
    playBuffer(noise(0.05), 0.1);
}

export function playDestroy() {
    ensureAudio();
    playTone(60, 0.2, 'sine', 0.3);
    playTone(90, 0.15, 'square', 0.1);
    playBuffer(noise(0.12, 0.4), 0.2);
}

export function playCollapse() {
    ensureAudio();
    playTone(40, 0.6, 'sine', 0.35);
    playTone(55, 0.5, 'triangle', 0.2);
    playSweep(200, 30, 0.8, 'sawtooth', 0.15);
    playBuffer(noise(0.5, 0.6), 0.25);
}

export function playShockwave() {
    ensureAudio();
    playSweep(800, 60, 0.4, 'sine', 0.25);
    playSweep(600, 40, 0.35, 'triangle', 0.15);
    playBuffer(noise(0.2, 0.5), 0.2);
}

export function playGravitySlam() {
    ensureAudio();
    playSweep(100, 1200, 0.25, 'sine', 0.15);
    setTimeout(() => {
        playTone(35, 0.5, 'sine', 0.35);
        playBuffer(noise(0.3, 0.5), 0.25);
        playSweep(300, 25, 0.6, 'sawtooth', 0.15);
    }, 300);
}

export function playShoot() {
    ensureAudio();
    playSweep(400, 1200, 0.08, 'sine', 0.12);
    playSweep(300, 800, 0.06, 'square', 0.05);
}

export function playJump() {
    ensureAudio();
    playSweep(200, 500, 0.15, 'sine', 0.1);
}

export function playLevelUp() {
    ensureAudio();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 'sine', 0.15), i * 100);
    });
}

export function playRoundComplete() {
    ensureAudio();
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.25, 'triangle', 0.12), i * 120);
    });
}

export function playPortalHum(volume = 0.05) {
    ensureAudio();
    playTone(60, 0.3, 'sine', volume, false);
    playTone(90, 0.3, 'sine', volume * 0.5, false);
}

export function playComboTick() {
    ensureAudio();
    playTone(800 + Math.random() * 400, 0.05, 'sine', 0.08);
}
