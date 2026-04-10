// particles.js — Pooled particle system for hit effects, dust, sparks, shatter, portal sparkles
import * as THREE from 'three';

const MAX_PARTICLES = 250;
const pool = [];
let scene = null;
const tempVec = new THREE.Vector3();

const sharedGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const matCache = {};

function getMaterial(color) {
    const hex = typeof color === 'number' ? color : color;
    if (!matCache[hex]) {
        matCache[hex] = new THREE.MeshBasicMaterial({
            color: hex,
            transparent: true,
            depthWrite: false
        });
    }
    return matCache[hex];
}

export function initParticles(sceneRef) {
    scene = sceneRef;
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const mesh = new THREE.Mesh(sharedGeo, getMaterial(0xffffff).clone());
        mesh.visible = false;
        scene.add(mesh);
        pool.push({
            mesh,
            vx: 0, vy: 0, vz: 0,
            life: 0,
            maxLife: 1,
            active: false,
            scale: 1,
            gravity: true
        });
    }
}

function getParticle() {
    for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) return pool[i];
    }
    // Recycle oldest
    let oldest = pool[0];
    for (let i = 1; i < pool.length; i++) {
        if (pool[i].life > oldest.life) oldest = pool[i];
    }
    return oldest;
}

function emit(x, y, z, vx, vy, vz, color, life, scale, gravity) {
    const p = getParticle();
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.mesh.scale.setScalar(scale);
    p.mesh.visible = true;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = 0;
    p.maxLife = life;
    p.active = true;
    p.scale = scale;
    p.gravity = gravity;
}

export function emitHitParticles(pos, color = 0xff4444, count = 8) {
    for (let i = 0; i < count; i++) {
        const speed = 2 + Math.random() * 4;
        const angle = Math.random() * Math.PI * 2;
        const up = Math.random() * 3;
        emit(
            pos.x + (Math.random() - 0.5) * 0.3,
            pos.y + (Math.random() - 0.5) * 0.3,
            pos.z + (Math.random() - 0.5) * 0.3,
            Math.cos(angle) * speed,
            up + Math.random() * 2,
            Math.sin(angle) * speed,
            color, 0.6 + Math.random() * 0.4,
            0.8 + Math.random() * 0.5,
            true
        );
    }
}

export function emitDust(pos, count = 12) {
    for (let i = 0; i < count; i++) {
        const speed = 1 + Math.random() * 2;
        const angle = Math.random() * Math.PI * 2;
        emit(
            pos.x + (Math.random() - 0.5) * 0.5,
            pos.y + (Math.random() - 0.5) * 0.3,
            pos.z + (Math.random() - 0.5) * 0.5,
            Math.cos(angle) * speed,
            Math.random() * 2,
            Math.sin(angle) * speed,
            0x888888, 0.8 + Math.random() * 0.5,
            1 + Math.random() * 0.8,
            false
        );
    }
}

export function emitSparks(pos, count = 10) {
    for (let i = 0; i < count; i++) {
        const speed = 4 + Math.random() * 6;
        const angle = Math.random() * Math.PI * 2;
        emit(
            pos.x, pos.y, pos.z,
            Math.cos(angle) * speed,
            Math.random() * 5,
            Math.sin(angle) * speed,
            0xffdd44, 0.3 + Math.random() * 0.3,
            0.4 + Math.random() * 0.3,
            true
        );
    }
}

export function emitShatter(pos, count = 20) {
    for (let i = 0; i < count; i++) {
        const speed = 3 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        const elevAngle = (Math.random() - 0.3) * Math.PI;
        emit(
            pos.x, pos.y, pos.z,
            Math.cos(angle) * Math.cos(elevAngle) * speed,
            Math.sin(elevAngle) * speed + 2,
            Math.sin(angle) * Math.cos(elevAngle) * speed,
            0x44ffff, 0.5 + Math.random() * 0.5,
            0.3 + Math.random() * 0.5,
            true
        );
    }
}

export function emitExplosion(pos, count = 30) {
    for (let i = 0; i < count; i++) {
        const speed = 5 + Math.random() * 8;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        emit(
            pos.x, pos.y, pos.z,
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed,
            [0xff4444, 0xff8800, 0xffdd00, 0xff2266][Math.floor(Math.random() * 4)],
            0.6 + Math.random() * 0.6,
            0.8 + Math.random() * 1.0,
            true
        );
    }
}

export function emitPortalSparkles(pos, color = 0xb44dff, count = 2) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 0.5;
        emit(
            pos.x + Math.cos(angle) * r,
            pos.y + (Math.random() - 0.5) * 2,
            pos.z + Math.sin(angle) * r,
            (Math.random() - 0.5) * 0.5,
            0.5 + Math.random() * 1,
            (Math.random() - 0.5) * 0.5,
            color, 0.8 + Math.random() * 0.5,
            0.5 + Math.random() * 0.5,
            false
        );
    }
}

export function emitFireParticles(pos, count = 6) {
    for (let i = 0; i < count; i++) {
        const speed = 1 + Math.random() * 2;
        const angle = Math.random() * Math.PI * 2;
        emit(
            pos.x + (Math.random() - 0.5) * 0.3,
            pos.y,
            pos.z + (Math.random() - 0.5) * 0.3,
            Math.cos(angle) * speed * 0.3,
            2 + Math.random() * 3,
            Math.sin(angle) * speed * 0.3,
            Math.random() > 0.5 ? 0xff4400 : 0xffaa00,
            0.4 + Math.random() * 0.3,
            0.6 + Math.random() * 0.6,
            false
        );
    }
}

export function updateParticles(dt) {
    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;

        p.life += dt;
        if (p.life >= p.maxLife) {
            p.active = false;
            p.mesh.visible = false;
            continue;
        }

        const t = p.life / p.maxLife;

        // Move
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        // Gravity
        if (p.gravity) {
            p.vy -= 12 * dt;
        }

        // Damping
        p.vx *= 0.98;
        p.vz *= 0.98;

        // Fade
        p.mesh.material.opacity = 1 - t;

        // Shrink
        const s = p.scale * (1 - t * 0.5);
        p.mesh.scale.setScalar(s);

        // Ground bounce
        if (p.mesh.position.y < 0.05) {
            p.mesh.position.y = 0.05;
            p.vy *= -0.3;
        }
    }
}
