// physics.js — Cannon-es physics world wrapper
// Uses a simple custom physics engine (no external dependency) for maximum reliability

const GRAVITY = -25;
const GROUND_Y = 0;
const MAX_BODIES = 300;
const RESTITUTION = 0.25;
const FRICTION_FACTOR = 0.92;

let bodies = [];
let nextId = 1;

export function createPhysicsWorld() {
    bodies = [];
    return { bodies };
}

export function createBody(options) {
    const body = {
        id: nextId++,
        position: { x: options.x || 0, y: options.y || 0, z: options.z || 0 },
        velocity: { x: 0, y: 0, z: 0 },
        halfExtents: {
            x: (options.width || 1) / 2,
            y: (options.height || 1) / 2,
            z: (options.depth || 1) / 2
        },
        mass: options.mass || 1,
        isStatic: options.isStatic || false,
        isDynamic: false,
        isSleeping: true,
        radius: options.radius || 0,
        isProjectile: options.isProjectile || false,
        createdAt: performance.now(),
        onCollide: options.onCollide || null,
        userData: options.userData || null,
        damping: options.damping || 0.02,
        grounded: false,
        removed: false
    };
    bodies.push(body);
    return body;
}

export function removeBody(body) {
    body.removed = true;
    const idx = bodies.indexOf(body);
    if (idx !== -1) bodies.splice(idx, 1);
}

export function wakeBody(body) {
    if (body.isStatic) return;
    body.isSleeping = false;
    body.isDynamic = true;
}

export function applyImpulse(body, ix, iy, iz) {
    if (body.isStatic || body.removed) return;
    wakeBody(body);
    body.velocity.x += ix / Math.max(body.mass, 0.1);
    body.velocity.y += iy / Math.max(body.mass, 0.1);
    body.velocity.z += iz / Math.max(body.mass, 0.1);
}

function aabbOverlap(a, b) {
    const ax = a.position, bx = b.position;
    const ah = a.halfExtents, bh = b.halfExtents;
    return Math.abs(ax.x - bx.x) < (ah.x + bh.x) &&
           Math.abs(ax.y - bx.y) < (ah.y + bh.y) &&
           Math.abs(ax.z - bx.z) < (ah.z + bh.z);
}

function resolveCollision(a, b) {
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;
    const ox = (a.halfExtents.x + b.halfExtents.x) - Math.abs(dx);
    const oy = (a.halfExtents.y + b.halfExtents.y) - Math.abs(dy);
    const oz = (a.halfExtents.z + b.halfExtents.z) - Math.abs(dz);

    if (ox <= 0 || oy <= 0 || oz <= 0) return;

    if (oy < ox && oy < oz) {
        const sign = dy > 0 ? 1 : -1;
        if (!a.isStatic) a.position.y += (oy / 2) * sign;
        if (!b.isStatic) b.position.y -= (oy / 2) * sign;
        if (!a.isStatic) { a.velocity.y *= -RESTITUTION; if (sign > 0) a.grounded = true; }
        if (!b.isStatic) { b.velocity.y *= -RESTITUTION; if (sign < 0) b.grounded = true; }
    } else if (ox < oz) {
        const sign = dx > 0 ? 1 : -1;
        if (!a.isStatic) a.position.x += (ox / 2) * sign;
        if (!b.isStatic) b.position.x -= (ox / 2) * sign;
        if (!a.isStatic) a.velocity.x *= -RESTITUTION;
        if (!b.isStatic) b.velocity.x *= -RESTITUTION;
    } else {
        const sign = dz > 0 ? 1 : -1;
        if (!a.isStatic) a.position.z += (oz / 2) * sign;
        if (!b.isStatic) b.position.z -= (oz / 2) * sign;
        if (!a.isStatic) a.velocity.z *= -RESTITUTION;
        if (!b.isStatic) b.velocity.z *= -RESTITUTION;
    }

    if (a.onCollide) a.onCollide(b);
    if (b.onCollide) b.onCollide(a);
}

export function stepPhysics(dt) {
    dt = Math.min(dt, 0.033);
    const activeBodies = [];

    for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        if (b.removed) { bodies.splice(i, 1); continue; }
        if (b.isStatic || b.isSleeping) continue;

        // Gravity
        b.velocity.y += GRAVITY * dt;

        // Damping
        b.velocity.x *= (1 - b.damping);
        b.velocity.z *= (1 - b.damping);

        // Integrate
        b.position.x += b.velocity.x * dt;
        b.position.y += b.velocity.y * dt;
        b.position.z += b.velocity.z * dt;

        // Ground collision
        const bottomY = b.position.y - b.halfExtents.y;
        if (bottomY < GROUND_Y) {
            b.position.y = GROUND_Y + b.halfExtents.y;
            b.velocity.y *= -RESTITUTION;
            b.velocity.x *= FRICTION_FACTOR;
            b.velocity.z *= FRICTION_FACTOR;
            b.grounded = true;
            if (Math.abs(b.velocity.y) < 0.3) b.velocity.y = 0;
        } else {
            b.grounded = false;
        }

        // Speed check for sleeping
        const speed = Math.abs(b.velocity.x) + Math.abs(b.velocity.y) + Math.abs(b.velocity.z);
        if (speed < 0.05 && b.grounded) {
            b.velocity.x = 0; b.velocity.y = 0; b.velocity.z = 0;
            b.isSleeping = true;
        }

        activeBodies.push(b);
    }

    // Broad-phase: only check dynamic vs all
    for (let i = 0; i < activeBodies.length; i++) {
        for (let j = 0; j < bodies.length; j++) {
            const a = activeBodies[i];
            const bdy = bodies[j];
            if (a === bdy || bdy.removed) continue;
            if (a.isProjectile && bdy.isProjectile) continue;
            if (aabbOverlap(a, bdy)) {
                resolveCollision(a, bdy);
            }
        }
    }
}

export function enforceBodyLimit() {
    // Remove oldest dynamic sleeping bodies if over limit
    const dynamicBodies = bodies.filter(b => b.isDynamic && !b.isProjectile);
    if (dynamicBodies.length > MAX_BODIES) {
        dynamicBodies.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = dynamicBodies.length - MAX_BODIES;
        for (let i = 0; i < toRemove; i++) {
            dynamicBodies[i].removed = true;
        }
    }
}

export function getBodies() {
    return bodies;
}

export function distanceBetween(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
