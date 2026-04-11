// ui.js — Simplified HUD: score, combo, round, integrity, abilities (no HP/energy/stars/XP)
import * as THREE from 'three';

let cameraShakeIntensity = 0;
let cameraShakeDecay = 0;
const cameraOffset = new THREE.Vector3();

const dom = {};

export function initUI() {
    dom.scoreDisplay = document.getElementById('score-display');
    dom.comboDisplay = document.getElementById('combo-display');
    dom.streakText = document.getElementById('streak-text');
    dom.roundDisplay = document.getElementById('round-display');
    dom.starsDisplay = document.getElementById('stars-display');
    dom.integrityBar = document.getElementById('integrity-bar');
    dom.integrityText = document.getElementById('integrity-text');
    dom.missionSlots = [
        document.getElementById('obj-time'),
        document.getElementById('obj-weak'),
        document.getElementById('obj-ability')
    ];
    dom.shockwaveSlot = document.getElementById('ability-shockwave');
    dom.slamSlot = document.getElementById('ability-slam');
    dom.screenFlash = document.getElementById('screen-flash');
    dom.floatingTexts = document.getElementById('floating-texts');
    dom.hud = document.getElementById('hud');
    dom.roundSummary = document.getElementById('round-summary');
    dom.levelUpBanner = document.getElementById('level-up-banner');
    dom.gameOver = document.getElementById('game-over');
    dom.clickHint = document.getElementById('click-hint');
    dom.summaryMissionSlots = [
        document.getElementById('summary-obj-time'),
        document.getElementById('summary-obj-weak'),
        document.getElementById('summary-obj-ability')
    ];
}

export function showHUD() { dom.hud.classList.remove('hidden'); }
export function hideHUD() { dom.hud.classList.add('hidden'); }
export function showClickHint() { dom.clickHint.classList.remove('hidden'); }
export function hideClickHint() { dom.clickHint.classList.add('hidden'); }

let displayScore = 0;

export function updateHUD(state, dt) {
    // Score ticker
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
    dom.starsDisplay.textContent = `⭐⭐⭐ ${state.totalStars || 0}`;

    // Tower integrity
    const intPct = Math.round(state.integrity * 100);
    dom.integrityBar.style.width = `${intPct}%`;
    dom.integrityText.textContent = `${intPct}%`;
    dom.integrityBar.classList.remove('low', 'critical');
    if (intPct < 15) dom.integrityBar.classList.add('critical');
    else if (intPct < 40) dom.integrityBar.classList.add('low');

    if (state.missions && Array.isArray(state.missions)) {
        for (let i = 0; i < dom.missionSlots.length; i++) {
            const slot = dom.missionSlots[i];
            const mission = state.missions[i];
            if (!slot) continue;
            if (!mission) {
                slot.textContent = '';
                continue;
            }
            setMissionItem(slot, mission.label, mission.completed, mission.failed);
        }
    }

    // Ability cooldowns
    updateAbilitySlot(dom.shockwaveSlot, state.shockwaveCd, 5);
    updateAbilitySlot(dom.slamSlot, state.slamCd, 10);
}

function setMissionItem(el, label, complete, failed) {
    if (!el) return;
    const marker = complete ? '✓' : failed ? '✗' : '○';
    el.textContent = `${marker} ${label}`;
    el.classList.remove('mission-complete', 'mission-fail');
    if (complete) el.classList.add('mission-complete');
    if (failed) el.classList.add('mission-fail');
}

function updateAbilitySlot(slot, cd, maxCd) {
    if (!slot) return;
    const overlay = slot.querySelector('.ability-cd-overlay');
    if (cd > 0) {
        overlay.style.height = `${(cd / maxCd) * 100}%`;
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
    void dom.screenFlash.offsetWidth;
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
    document.getElementById('summary-stars').textContent = '★'.repeat(stats.stars || 0) + '☆'.repeat(3 - (stats.stars || 0));
    document.getElementById('summary-score').textContent = stats.score.toLocaleString();
    document.getElementById('summary-star-bonus').textContent = `+${(stats.starBonus || 0).toLocaleString()}`;
    document.getElementById('summary-total-stars').textContent = (stats.totalStars || 0).toLocaleString();
    document.getElementById('summary-combo').textContent = `${stats.peakCombo.toFixed(1)}x`;
    document.getElementById('summary-time').textContent = `${stats.time.toFixed(1)}s`;

    const objectives = Array.isArray(stats.objectives) ? stats.objectives : [];
    for (let i = 0; i < dom.summaryMissionSlots.length; i++) {
        setSummaryObjective(dom.summaryMissionSlots[i], objectives[i]);
    }
}

function setSummaryObjective(el, objective) {
    if (!el || !objective) return;
    const marker = objective.completed ? '✓' : '✗';
    el.textContent = `${marker} ${objective.label}`;
    el.classList.remove('complete', 'fail');
    el.classList.add(objective.completed ? 'complete' : 'fail');
}

export function hideRoundSummary() {
    dom.roundSummary.classList.add('hidden');
}

// -- Level Up Banner --
export function showLevelUpBanner(level) {
    dom.levelUpBanner.classList.remove('hidden');
    document.getElementById('lu-level').textContent = `LEVEL ${level}`;
    setTimeout(() => dom.levelUpBanner.classList.add('hidden'), 2500);
}

// -- Game Over --
export function showGameOver(score, rounds, level) {
    dom.gameOver.classList.remove('hidden');
    document.getElementById('go-score').textContent = score.toLocaleString();
    document.getElementById('go-rounds').textContent = rounds;
}

export function hideGameOver() {
    dom.gameOver.classList.add('hidden');
}

export function resetDisplayScore() {
    displayScore = 0;
}
