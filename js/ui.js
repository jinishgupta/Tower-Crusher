// ui.js — HUD updates, camera shake, screen flash, floating text, combo/streak, level-up
import * as THREE from 'three';

let cameraShakeIntensity = 0;
let cameraShakeDecay = 0;
const cameraOffset = new THREE.Vector3();

// DOM references
const dom = {};

export function initUI() {
    dom.hpBar = document.getElementById('hp-bar');
    dom.hpText = document.getElementById('hp-text');
    dom.energyBar = document.getElementById('energy-bar');
    dom.energyText = document.getElementById('energy-text');
    dom.scoreDisplay = document.getElementById('score-display');
    dom.comboDisplay = document.getElementById('combo-display');
    dom.streakText = document.getElementById('streak-text');
    dom.roundDisplay = document.getElementById('round-display');
    dom.integrityBar = document.getElementById('integrity-bar');
    dom.integrityText = document.getElementById('integrity-text');
    dom.starsDisplay = document.getElementById('stars-display');
    dom.levelDisplay = document.getElementById('level-display');
    dom.xpBar = document.getElementById('xp-bar');
    dom.xpText = document.getElementById('xp-text');
    dom.shockwaveSlot = document.getElementById('ability-shockwave');
    dom.slamSlot = document.getElementById('ability-slam');
    dom.screenFlash = document.getElementById('screen-flash');
    dom.floatingTexts = document.getElementById('floating-texts');
    dom.hud = document.getElementById('hud');
    dom.roundSummary = document.getElementById('round-summary');
    dom.levelUpBanner = document.getElementById('level-up-banner');
    dom.gameOver = document.getElementById('game-over');
    dom.clickHint = document.getElementById('click-hint');
}

export function showHUD() {
    dom.hud.classList.remove('hidden');
}

export function hideHUD() {
    dom.hud.classList.add('hidden');
}

export function showClickHint() {
    dom.clickHint.classList.remove('hidden');
}

export function hideClickHint() {
    dom.clickHint.classList.add('hidden');
}

// -- Update bars and stats --
let displayScore = 0;

export function updateHUD(state, dt) {
    // HP bar
    const hpPct = (state.hp / state.maxHp) * 100;
    dom.hpBar.style.width = `${hpPct}%`;
    dom.hpText.textContent = Math.round(state.hp);

    // Energy bar
    const energyPct = (state.energy / state.maxEnergy) * 100;
    dom.energyBar.style.width = `${energyPct}%`;
    dom.energyText.textContent = Math.round(state.energy);

    // Score ticker (animated)
    const scoreDiff = state.score - displayScore;
    displayScore += scoreDiff * Math.min(dt * 8, 1);
    dom.scoreDisplay.textContent = Math.round(displayScore).toLocaleString();

    // Combo
    dom.comboDisplay.textContent = `${state.combo.toFixed(1)}x`;
    if (state.combo > 1.5) {
        dom.comboDisplay.style.transform = `scale(${1 + (state.combo - 1) * 0.1})`;
    } else {
        dom.comboDisplay.style.transform = 'scale(1)';
    }

    // Streak text
    if (state.streak >= 20) {
        dom.streakText.textContent = '⚡ LEGENDARY ⚡';
        dom.streakText.className = 'streak-legendary';
    } else if (state.streak >= 10) {
        dom.streakText.textContent = '🔥 UNSTOPPABLE 🔥';
        dom.streakText.className = 'streak-unstoppable';
    } else if (state.streak >= 5) {
        dom.streakText.textContent = '🔥 ON FIRE 🔥';
        dom.streakText.className = 'streak-fire';
    } else {
        dom.streakText.textContent = '';
        dom.streakText.className = '';
    }

    // Round
    dom.roundDisplay.textContent = `ROUND ${state.round}`;

    // Tower integrity
    const intPct = Math.round(state.integrity * 100);
    dom.integrityBar.style.width = `${intPct}%`;
    dom.integrityText.textContent = `${intPct}%`;
    dom.integrityBar.classList.remove('low', 'critical');
    if (intPct < 15) dom.integrityBar.classList.add('critical');
    else if (intPct < 40) dom.integrityBar.classList.add('low');

    // Stars
    const stars = dom.starsDisplay.querySelectorAll('.star');
    stars.forEach((s, i) => {
        s.classList.toggle('lit', i < state.stars);
        s.classList.toggle('dim', i >= state.stars);
    });

    // Level + XP
    dom.levelDisplay.textContent = `LVL ${state.level}`;
    const xpForNext = state.level * 100;
    const xpPct = (state.xp / xpForNext) * 100;
    dom.xpBar.style.width = `${Math.min(100, xpPct)}%`;
    dom.xpText.textContent = `${state.xp} / ${xpForNext} XP`;

    // Ability cooldowns
    updateAbilitySlot(dom.shockwaveSlot, state.shockwaveCd, 5);
    updateAbilitySlot(dom.slamSlot, state.slamCd, 10);
}

function updateAbilitySlot(slot, cd, maxCd) {
    const overlay = slot.querySelector('.ability-cd-overlay');
    if (cd > 0) {
        const pct = (cd / maxCd) * 100;
        overlay.style.height = `${pct}%`;
        slot.classList.remove('ready');
    } else {
        overlay.style.height = '0%';
        slot.classList.add('ready');
    }
}

// -- Camera Shake --
export function triggerCameraShake(intensity = 0.3) {
    cameraShakeIntensity = Math.max(cameraShakeIntensity, intensity);
    cameraShakeDecay = 8;
}

export function updateCameraShake(camera, dt) {
    if (cameraShakeIntensity > 0.001) {
        cameraOffset.set(
            (Math.random() - 0.5) * cameraShakeIntensity,
            (Math.random() - 0.5) * cameraShakeIntensity,
            (Math.random() - 0.5) * cameraShakeIntensity * 0.5
        );
        camera.position.add(cameraOffset);
        cameraShakeIntensity *= Math.exp(-cameraShakeDecay * dt);
    }
}

// -- Screen Flash --
export function screenFlash(color = 'rgba(0, 240, 255, 0.3)') {
    dom.screenFlash.style.background = color;
    dom.screenFlash.classList.remove('active');
    void dom.screenFlash.offsetWidth; // force reflow
    dom.screenFlash.classList.add('active');
    setTimeout(() => dom.screenFlash.classList.remove('active'), 400);
}

// -- Floating Score Text --
export function showFloatingScore(score, screenX, screenY, color = '#00f0ff') {
    const el = document.createElement('div');
    el.classList.add('floating-text');
    el.textContent = `+${score}`;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;
    dom.floatingTexts.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

export function worldToScreen(pos3D, camera) {
    const v = new THREE.Vector3(pos3D.x, pos3D.y, pos3D.z);
    v.project(camera);
    return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        visible: v.z < 1
    };
}

// -- Round Summary --
export function showRoundSummary(stats) {
    dom.roundSummary.classList.remove('hidden');
    document.getElementById('summary-title').textContent = `ROUND ${stats.round} COMPLETE`;
    document.getElementById('summary-score').textContent = stats.score.toLocaleString();
    document.getElementById('summary-combo').textContent = `${stats.peakCombo.toFixed(1)}x`;
    document.getElementById('summary-time').textContent = `${stats.time.toFixed(1)}s`;
    document.getElementById('summary-xp').textContent = `+${stats.xpEarned}`;

    const starsContainer = document.getElementById('summary-stars');
    starsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.fontSize = '36px';
        star.style.color = i < stats.stars ? '#ffd700' : 'rgba(255,215,0,0.15)';
        if (i < stats.stars) star.style.textShadow = '0 0 10px #ffd700';
        starsContainer.appendChild(star);
    }
}

export function hideRoundSummary() {
    dom.roundSummary.classList.add('hidden');
}

// -- Level Up Banner --
export function showLevelUpBanner(level) {
    dom.levelUpBanner.classList.remove('hidden');
    document.getElementById('lu-level').textContent = `LEVEL ${level}`;
    // Auto-hide after 2.5s
    setTimeout(() => dom.levelUpBanner.classList.add('hidden'), 2500);
}

// -- Game Over --
export function showGameOver(score, rounds, level) {
    dom.gameOver.classList.remove('hidden');
    document.getElementById('go-score').textContent = score.toLocaleString();
    document.getElementById('go-rounds').textContent = rounds;
    document.getElementById('go-level').textContent = level;
}

export function hideGameOver() {
    dom.gameOver.classList.add('hidden');
}

// -- Reset displayed score --
export function resetDisplayScore() {
    displayScore = 0;
}
