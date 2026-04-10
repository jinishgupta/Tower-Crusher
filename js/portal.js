// portal.js — Vibe Jam exit portal + conditional return portal
// Portals now require pressing F to enter (no more accidental redirect)
import * as THREE from 'three';
import { emitPortalSparkles } from './particles.js';
import { playPortalHum } from './audio.js';

const PORTAL_INTERACT_DIST = 4;
let exitPortal = null;
let returnPortal = null;
let portalLabelsContainer = null;
let exitLabelEl = null;
let returnLabelEl = null;
let portalHumTimer = 0;
let nearExitPortal = false;
let nearReturnPortal = false;
let interactPromptEl = null;

export function createPortals(scene, camera, params) {
    portalLabelsContainer = document.getElementById('portal-labels');

    // Create interact prompt
    interactPromptEl = document.createElement('div');
    interactPromptEl.classList.add('portal-label');
    interactPromptEl.style.fontSize = '14px';
    interactPromptEl.style.padding = '8px 18px';
    interactPromptEl.style.background = 'rgba(0,0,0,0.7)';
    interactPromptEl.style.color = '#FFD700';
    interactPromptEl.style.border = '2px solid #FFD700';
    interactPromptEl.style.borderRadius = '8px';
    interactPromptEl.style.display = 'none';
    interactPromptEl.style.zIndex = '20';
    interactPromptEl.textContent = 'Press F to enter portal';
    portalLabelsContainer.appendChild(interactPromptEl);

    // --- EXIT PORTAL (always present) ---
    exitPortal = createPortalMesh(scene, 20, 2, -5, 0xb44dff, 0xffd700);
    exitLabelEl = createPortalLabel('⚠️ VIBE JAM PORTAL (leaves game)', 'exit');

    // --- RETURN PORTAL (conditional) ---
    if (params.portalMode && params.refDomain) {
        returnPortal = createPortalMesh(scene, -20, 2, -5, 0x0088ff, 0x00ccff);
        returnLabelEl = createPortalLabel(`↩ Return to ${params.refDomain}`, 'return');
    }

    // Listen for F key
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF') {
            if (nearExitPortal) {
                handleExitPortalEnter();
            } else if (nearReturnPortal) {
                handleReturnPortalEnter();
            }
        }
    });

    return { exitPortal, returnPortal };
}

// Store params for redirect
let _username = '';
let _params = {};
let _playerPos = {};

function handleExitPortalEnter() {
    const domain = window.location.hostname || 'localhost';
    const url = new URL('https://vibejam.cc/portal/2026');
    url.searchParams.set('username', _username);
    url.searchParams.set('color', 'red');
    url.searchParams.set('speed', '5');
    url.searchParams.set('ref', domain);
    url.searchParams.set('hp', String(Math.round(_playerPos.hp || 100)));
    url.searchParams.set('score', String(_params.currentScore || 0));
    window.location.href = url.toString();
}

function handleReturnPortalEnter() {
    const domain = window.location.hostname || 'localhost';
    const refUrl = _params.refUrl || `https://${_params.refDomain}`;
    const url = new URL(refUrl);
    url.searchParams.set('username', _username);
    url.searchParams.set('color', 'red');
    url.searchParams.set('speed', '5');
    url.searchParams.set('ref', domain);
    url.searchParams.set('hp', String(Math.round(_playerPos.hp || 100)));
    url.searchParams.set('score', String(_params.currentScore || 0));
    url.searchParams.set('portal', 'true');
    window.location.href = url.toString();
}

function createPortalMesh(scene, x, y, z, color1, color2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Torus ring
    const torusGeo = new THREE.TorusGeometry(1.8, 0.18, 14, 36);
    const torusMat = new THREE.MeshStandardMaterial({
        color: color1,
        emissive: color1,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.5
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);

    // Inner swirl
    const discCanvas = document.createElement('canvas');
    discCanvas.width = 256;
    discCanvas.height = 256;
    const dctx = discCanvas.getContext('2d');
    const gradient = dctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gradient.addColorStop(0, `rgba(${(color2 >> 16) & 255}, ${(color2 >> 8) & 255}, ${color2 & 255}, 0.9)`);
    gradient.addColorStop(0.5, `rgba(${(color1 >> 16) & 255}, ${(color1 >> 8) & 255}, ${color1 & 255}, 0.4)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    dctx.fillStyle = gradient;
    dctx.fillRect(0, 0, 256, 256);

    dctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    dctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        dctx.beginPath();
        for (let r = 10; r < 120; r += 2) {
            const a = angle + r * 0.05;
            dctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
        }
        dctx.stroke();
    }

    const discTex = new THREE.CanvasTexture(discCanvas);
    const discGeo = new THREE.CircleGeometry(1.65, 32);
    const discMat = new THREE.MeshBasicMaterial({
        map: discTex,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    // Glow light
    const light = new THREE.PointLight(color1, 1.2, 12);
    light.position.set(0, 0, 0.5);
    group.add(light);

    // Ground ring marker
    const ringGeo = new THREE.RingGeometry(2.5, 3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: color1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z);
    scene.add(ring);

    scene.add(group);

    return {
        group,
        torus,
        disc,
        discTex,
        light,
        position: { x, y, z },
        color1,
        color2
    };
}

function createPortalLabel(text, type) {
    const el = document.createElement('div');
    el.classList.add('portal-label', type);
    el.textContent = text;
    portalLabelsContainer.appendChild(el);
    return el;
}

export function updatePortals(camera, playerPos, dt, username, params) {
    portalHumTimer += dt;
    _username = username;
    _params = params;
    _playerPos = playerPos;

    nearExitPortal = false;
    nearReturnPortal = false;

    if (exitPortal) {
        animatePortal(exitPortal, dt);
        updateLabel(exitPortal, exitLabelEl, camera);
        emitPortalSparkles(exitPortal.position, 0xb44dff, 1);

        const distToExit = distance(playerPos, exitPortal.position);

        // Portal hum when near
        if (distToExit < 12 && portalHumTimer > 0.3) {
            const vol = Math.max(0, 0.04 * (1 - distToExit / 12));
            if (vol > 0.01) playPortalHum(vol);
            portalHumTimer = 0;
        }

        // Near portal — show interact prompt
        if (distToExit < PORTAL_INTERACT_DIST) {
            nearExitPortal = true;
        }
    }

    if (returnPortal) {
        animatePortal(returnPortal, dt);
        updateLabel(returnPortal, returnLabelEl, camera);
        emitPortalSparkles(returnPortal.position, 0x0088ff, 1);

        const distToReturn = distance(playerPos, returnPortal.position);
        if (distToReturn < PORTAL_INTERACT_DIST) {
            nearReturnPortal = true;
        }
    }

    // Show/hide interact prompt
    if (nearExitPortal || nearReturnPortal) {
        const portal = nearExitPortal ? exitPortal : returnPortal;
        const pos3D = new THREE.Vector3(portal.position.x, portal.position.y + 0.5, portal.position.z);
        pos3D.project(camera);
        if (pos3D.z < 1) {
            const sx = (pos3D.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-pos3D.y * 0.5 + 0.5) * window.innerHeight;
            interactPromptEl.style.display = 'block';
            interactPromptEl.style.left = `${sx}px`;
            interactPromptEl.style.top = `${sy + 50}px`;
            interactPromptEl.textContent = nearExitPortal
                ? '⚠️ Press F to enter Vibe Jam Portal (leaves this game)'
                : '↩ Press F to return to ' + (_params.refDomain || 'origin');
        }
    } else {
        interactPromptEl.style.display = 'none';
    }

    return false; // Never auto-redirect
}

function animatePortal(portal, dt) {
    portal.torus.rotation.z += dt * 1.2;
    portal.torus.rotation.x = Math.sin(performance.now() * 0.001) * 0.1;
    portal.disc.rotation.z -= dt * 0.8;
    const pulse = 0.8 + Math.sin(performance.now() * 0.003) * 0.4;
    portal.light.intensity = pulse;
    portal.torus.material.emissiveIntensity = 0.4 + pulse * 0.3;
}

function updateLabel(portal, labelEl, camera) {
    if (!labelEl) return;
    const pos = new THREE.Vector3(portal.position.x, portal.position.y + 2.8, portal.position.z);
    pos.project(camera);

    if (pos.z > 1) {
        labelEl.style.display = 'none';
        return;
    }

    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    labelEl.style.display = 'block';
    labelEl.style.left = `${x}px`;
    labelEl.style.top = `${y}px`;
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function cleanupPortals(scene) {
    if (exitPortal) { scene.remove(exitPortal.group); exitPortal = null; }
    if (returnPortal) { scene.remove(returnPortal.group); returnPortal = null; }
    if (exitLabelEl) { exitLabelEl.remove(); exitLabelEl = null; }
    if (returnLabelEl) { returnLabelEl.remove(); returnLabelEl = null; }
}
