// main.js — Entry point: Three.js setup, game loop, third-person crane controls
import * as THREE from 'three';
import { createPhysicsWorld } from './physics.js';
import { initParticles } from './particles.js';
import { createEnvironment } from './environment.js';
import { createPortals } from './portal.js';
import { initLeaderboard, toggleLeaderboard, isLeaderboardOpen, hideLeaderboard } from './leaderboard.js';
import { initUI } from './ui.js';
import { ensureAudio } from './audio.js';
import {
    createGameState, startGame, updateGame, restartGame,
    handleSwing, handleTurboSwing, handleBallDrop
} from './game.js';

// -- Parse URL params --
const urlParams = new URLSearchParams(window.location.search);
const isPortalEntry = urlParams.get('portal') === 'true';
const refParam = urlParams.get('ref') || '';
const usernameParam = urlParams.get('username') || '';

const gameParams = {
    portalMode: isPortalEntry,
    refDomain: refParam,
    refUrl: refParam ? (refParam.startsWith('http') ? refParam : `https://${refParam}`) : '',
    currentScore: 0
};

// -- Three.js Setup --
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('game-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 10, 22);
scene.add(camera);

// -- Init Systems --
createPhysicsWorld();
initParticles(scene);
createEnvironment(scene);
initUI();

// -- Game State --
const gs = createGameState();

// -- Portal setup --
let portalsCreated = false;
function setupPortals() {
    if (portalsCreated) return;
    portalsCreated = true;
    createPortals(scene, camera, gameParams);
}

// -- Pointer Lock --
const canvas = renderer.domElement;

function requestPointerLock() {
    canvas.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (gs.player) {
        gs.player.lockedIn = locked;
    }
    const clickHint = document.getElementById('click-hint');
    if (locked) {
        clickHint.classList.add('hidden');
    } else if (gs.state === 1) { // PLAYING
        clickHint.classList.remove('hidden');
    }
});

// -- Start Screen Logic --
const usernameOverlay = document.getElementById('username-overlay');
const usernameInput = document.getElementById('username-input');
const playBtn = document.getElementById('play-btn');

let storedUsername = localStorage.getItem('tower_destroyer_username') || '';
if (usernameParam) storedUsername = usernameParam;

function beginGame(username) {
    if (!username.trim()) username = 'Player' + Math.floor(Math.random() * 9999);
    localStorage.setItem('tower_destroyer_username', username);

    usernameOverlay.classList.add('hidden');
    usernameOverlay.style.display = 'none';

    ensureAudio();
    initLeaderboard(username);
    setupPortals();
    startGame(gs, scene, camera, username, gameParams);

    setTimeout(() => requestPointerLock(), 100);
}

if (isPortalEntry) {
    usernameOverlay.style.display = 'none';
    usernameOverlay.classList.add('hidden');
    const username = storedUsername || usernameParam || 'PortalPlayer';
    setTimeout(() => beginGame(username), 50);
} else {
    if (storedUsername) usernameInput.value = storedUsername;
    usernameInput.focus();

    playBtn.addEventListener('click', () => {
        beginGame(usernameInput.value.trim() || storedUsername);
    });
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            beginGame(usernameInput.value.trim() || storedUsername);
        }
    });
}

// -- Input Events --
canvas.addEventListener('mousedown', (e) => {
    if (gs.state === 3) return; // GAME_OVER

    if (document.pointerLockElement !== canvas) {
        requestPointerLock();
        return;
    }

    ensureAudio();

    if (e.button === 0) {
        // Left click: swing wrecking ball
        handleSwing(gs);
    } else if (e.button === 2) {
        // Right click: turbo swing
        handleTurboSwing(gs);
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    if (e.code === 'Tab') {
        e.preventDefault();
        toggleLeaderboard();
        return;
    }

    // E: turbo swing
    if (e.code === 'KeyE') {
        handleTurboSwing(gs);
    }

    // Q: ball drop
    if (e.code === 'KeyQ') {
        handleBallDrop(gs);
    }

    // Escape: close leaderboard
    if (e.code === 'Escape') {
        if (isLeaderboardOpen()) {
            hideLeaderboard();
        }
    }
});

// -- Restart button --
document.getElementById('go-restart-btn').addEventListener('click', () => {
    restartGame(gs, scene, camera);
    setTimeout(() => requestPointerLock(), 100);
});

// -- Resize --
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// -- Game Loop --
let lastTime = performance.now();

function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    updateGame(gs, dt, scene, camera);
    renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
