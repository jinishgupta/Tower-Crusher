// player.js — Third-person crane vehicle with wrecking ball, directional swing
import * as THREE from 'three';

const MOVE_SPEED = 14;
const SPRINT_MULT = 1.6;
const MOUSE_SENSITIVITY = 0.003;
const ROPE_LENGTH = 15;       // long enough to reach ground from boom tip
const BALL_RADIUS = 0.9;      // big wrecking ball
const SWING_FORCE = 55;
const TURBO_FORCE = 140;
const SWING_CD = 0.3;
const TURBO_CD = 5;
const DROP_CD = 10;
const GRAVITY = 20;
const BALL_DAMPING = 0.992;
const MAX_HP = 100;
const MAX_ENERGY = 100;
const ENERGY_REGEN = 6;
const TURBO_COST = 30;
const DROP_COST = 50;
const CAMERA_DIST = 20;
const CAMERA_HEIGHT = 12;
const BOOM_HEIGHT = 14;       // tall crane boom
const BOOM_FORWARD = 10;      // long boom arm

export function createPlayer(camera, scene) {
    const vehicle = new THREE.Group();

    // ---- BASE BODY (large construction yellow) ----
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xF9A825, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 5.0), baseMat);
    base.position.y = 0.8;
    base.castShadow = true;
    vehicle.add(base);

    // ---- TRACKS ----
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
    [[-1.6, 0], [1.6, 0]].forEach(([x]) => {
        const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 5.4), trackMat);
        track.position.set(x, 0.35, 0);
        track.castShadow = true;
        vehicle.add(track);
        for (let z = -2; z <= 2; z += 0.8) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.3, 0.65, 8),
                trackMat
            );
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.3, z);
            vehicle.add(wheel);
        }
    });

    // ---- CABIN ----
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xF57F17, roughness: 0.5 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), cabMat);
    cabin.position.set(0, 2.2, 1.0);
    cabin.castShadow = true;
    vehicle.add(cabin);

    // Windows
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x90CAF9, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7
    });
    const windowFront = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), glassMat);
    windowFront.position.set(0, 2.3, -0.1);
    vehicle.add(windowFront);
    const windowSide = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), glassMat);
    windowSide.rotation.y = Math.PI / 2;
    windowSide.position.set(1.11, 2.3, 1.0);
    vehicle.add(windowSide);
    const windowSide2 = windowSide.clone();
    windowSide2.position.x = -1.11;
    vehicle.add(windowSide2);

    // ---- TURNTABLE ----
    const turntable = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.25, 12),
        new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.6, metalness: 0.5 })
    );
    turntable.position.set(0, 1.5, -0.5);
    vehicle.add(turntable);

    // ---- CRANE MAST (tall vertical tower) ----
    const boomMat = new THREE.MeshStandardMaterial({ color: 0xE65100, roughness: 0.5, metalness: 0.3 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, BOOM_HEIGHT, 0.5), boomMat);
    mast.position.set(0, BOOM_HEIGHT / 2 + 1.5, -0.5);
    mast.castShadow = true;
    vehicle.add(mast);

    // Mast cross braces
    for (let y = 2.5; y < BOOM_HEIGHT + 1; y += 1.5) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), boomMat);
        brace.rotation.z = Math.PI / 4;
        brace.position.set(0, y, -0.5);
        vehicle.add(brace);
    }

    // Mast support wires (decorative lines)
    const wireMat = new THREE.LineBasicMaterial({ color: 0x888888 });
    [-0.3, 0.3].forEach(side => {
        const wirePoints = [
            new THREE.Vector3(side * 3, 1.5, -0.5),
            new THREE.Vector3(0, BOOM_HEIGHT + 1.5, -0.5)
        ];
        const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePoints);
        vehicle.add(new THREE.Line(wireGeo, wireMat));
    });

    // ---- BOOM ARM (long horizontal, extends forward) ----
    const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.35, BOOM_FORWARD),
        boomMat
    );
    arm.position.set(0, BOOM_HEIGHT + 1.2, -0.5 - BOOM_FORWARD / 2);
    arm.castShadow = true;
    vehicle.add(arm);

    // Boom underside braces
    for (let z = -2; z > -BOOM_FORWARD; z -= 2) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), boomMat);
        b.position.set(0, BOOM_HEIGHT + 0.7, z - 0.5);
        vehicle.add(b);
    }

    // Boom tip
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xDD2C00, roughness: 0.4 });
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), tipMat);
    tip.position.set(0, BOOM_HEIGHT + 1.2, -0.5 - BOOM_FORWARD);
    vehicle.add(tip);

    // ---- COUNTERWEIGHT ----
    const cwMat = new THREE.MeshStandardMaterial({ color: 0x616161, roughness: 0.7, metalness: 0.4 });
    const cw = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2.0), cwMat);
    cw.position.set(0, 2.2, 2.2);
    cw.castShadow = true;
    vehicle.add(cw);

    // Warning stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.52, 0.1, 0.6), stripeMat);
    stripe.position.set(0, 1.25, -2.5);
    vehicle.add(stripe);

    // Exhaust
    const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 })
    );
    exhaust.position.set(1.2, 2.5, 1.8);
    vehicle.add(exhaust);

    vehicle.position.set(0, 0, 10);
    scene.add(vehicle);

    // ---- WRECKING BALL ----
    const ballGroup = new THREE.Group();
    const ballMesh = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.25, metalness: 0.9 })
    );
    ballMesh.castShadow = true;
    ballGroup.add(ballMesh);

    // Ball hook ring
    const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.05, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
    );
    hook.position.y = BALL_RADIUS;
    hook.rotation.x = Math.PI / 2;
    ballGroup.add(hook);

    // Ball stripe/band for visual weight
    const band = new THREE.Mesh(
        new THREE.TorusGeometry(BALL_RADIUS + 0.02, 0.04, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 })
    );
    band.rotation.x = Math.PI / 2;
    ballGroup.add(band);

    scene.add(ballGroup);

    // ---- CHAIN ----
    const chainPoints = [];
    for (let i = 0; i <= 16; i++) chainPoints.push(new THREE.Vector3());
    const chainGeo = new THREE.BufferGeometry().setFromPoints(chainPoints);
    const chain = new THREE.Line(chainGeo,
        new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 2 })
    );
    scene.add(chain);

    // Chain link meshes for visual thickness
    const chainLinks = [];
    const linkGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);
    const linkMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
        const link = new THREE.Mesh(linkGeo, linkMat);
        scene.add(link);
        chainLinks.push(link);
    }

    // ---- PLAYER STATE ----
    const player = {
        vehicle, ballGroup, ballMesh, chain, chainGeo, chainPoints, chainLinks,
        camera, scene,
        posX: 0, posZ: 10,
        yaw: 0,
        // Ball pendulum
        ballX: 0, ballY: 0, ballZ: 0,
        ballVX: 0, ballVY: 0, ballVZ: 0,
        prevBallX: 0, prevBallY: 0, prevBallZ: 0,
        ballSpeed: 0,
        tipX: 0, tipY: BOOM_HEIGHT + 1.2, tipZ: 0,
        // mouse movement for directional swing
        lastMouseDX: 0, lastMouseDY: 0,
        // Controls
        keys: {},
        swingCd: 0, turboCd: 0, dropCd: 0,
        isDropping: false, dropTimer: 0,
        // Stats
        hp: MAX_HP, maxHp: MAX_HP,
        energy: MAX_ENERGY, maxEnergy: MAX_ENERGY,
        // Camera
        cameraPitch: -0.2,
        lockedIn: false,
        shockwaveCooldown: 0,
        slamCooldown: 0,
    };

    // Init ball at hanging position
    updateBoomTip(player);
    player.ballX = player.tipX;
    player.ballY = player.tipY - ROPE_LENGTH;
    player.ballZ = player.tipZ;

    // Input
    document.addEventListener('keydown', (e) => { player.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { player.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
        if (!player.lockedIn) return;
        player.lastMouseDX = e.movementX;
        player.lastMouseDY = e.movementY;
        player.yaw -= e.movementX * MOUSE_SENSITIVITY;
        player.cameraPitch -= e.movementY * MOUSE_SENSITIVITY * 0.4;
        player.cameraPitch = Math.max(-0.7, Math.min(0.1, player.cameraPitch));
    });

    return player;
}

function updateBoomTip(player) {
    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    player.tipX = player.posX + fwdX * BOOM_FORWARD;
    player.tipY = BOOM_HEIGHT + 1.2;
    player.tipZ = player.posZ + fwdZ * BOOM_FORWARD;
}

export function updatePlayer(player, dt) {
    const keys = player.keys;

    // Cooldowns
    if (player.swingCd > 0) player.swingCd -= dt;
    if (player.turboCd > 0) player.turboCd -= dt;
    if (player.dropCd > 0) player.dropCd -= dt;
    player.shockwaveCooldown = player.turboCd;
    player.slamCooldown = player.dropCd;

    player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN * dt);

    // ---- Movement ----
    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);

    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp'])    { mx += fwdX; mz += fwdZ; }
    if (keys['KeyS'] || keys['ArrowDown'])  { mx -= fwdX; mz -= fwdZ; }
    if (keys['KeyA'] || keys['ArrowLeft'])  { mx -= rightX; mz -= rightZ; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += rightX; mz += rightZ; }

    const sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? SPRINT_MULT : 1;
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) {
        mx = (mx / len) * MOVE_SPEED * sprint * dt;
        mz = (mz / len) * MOVE_SPEED * sprint * dt;
        player.posX += mx;
        player.posZ += mz;
    }

    player.posX = Math.max(-50, Math.min(50, player.posX));
    player.posZ = Math.max(-50, Math.min(50, player.posZ));

    player.vehicle.position.set(player.posX, 0, player.posZ);
    player.vehicle.rotation.y = player.yaw;

    // ---- Boom tip ----
    updateBoomTip(player);

    // ---- Pendulum Physics ----
    player.prevBallX = player.ballX;
    player.prevBallY = player.ballY;
    player.prevBallZ = player.ballZ;

    player.ballVY -= GRAVITY * dt;
    player.ballVX *= BALL_DAMPING;
    player.ballVY *= BALL_DAMPING;
    player.ballVZ *= BALL_DAMPING;

    player.ballX += player.ballVX * dt;
    player.ballY += player.ballVY * dt;
    player.ballZ += player.ballVZ * dt;

    // Rope constraint
    if (!player.isDropping) {
        const dx = player.ballX - player.tipX;
        const dy = player.ballY - player.tipY;
        const dz = player.ballZ - player.tipZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > ROPE_LENGTH) {
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;
            player.ballX = player.tipX + nx * ROPE_LENGTH;
            player.ballY = player.tipY + ny * ROPE_LENGTH;
            player.ballZ = player.tipZ + nz * ROPE_LENGTH;

            const vDot = player.ballVX * nx + player.ballVY * ny + player.ballVZ * nz;
            if (vDot > 0) {
                player.ballVX -= vDot * nx;
                player.ballVY -= vDot * ny;
                player.ballVZ -= vDot * nz;
            }
        }
    }

    // Ball drop mode
    if (player.isDropping) {
        player.dropTimer += dt;
        player.ballVY -= 30 * dt;
        if (player.ballY < BALL_RADIUS) {
            player.ballY = BALL_RADIUS;
            player.ballVY = 0;
            player.isDropping = false;
        }
        if (player.dropTimer > 2) player.isDropping = false;
    }

    // Ground clamp
    if (player.ballY < BALL_RADIUS) {
        player.ballY = BALL_RADIUS;
        player.ballVY *= -0.3;
        player.ballVX *= 0.8;
        player.ballVZ *= 0.8;
    }

    // Ball speed
    const bvx = player.ballX - player.prevBallX;
    const bvy = player.ballY - player.prevBallY;
    const bvz = player.ballZ - player.prevBallZ;
    player.ballSpeed = Math.sqrt(bvx * bvx + bvy * bvy + bvz * bvz) / Math.max(dt, 0.001);

    // ---- Update meshes ----
    player.ballGroup.position.set(player.ballX, player.ballY, player.ballZ);

    // Chain
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        player.chainPoints[i].set(
            player.tipX + (player.ballX - player.tipX) * t,
            player.tipY + (player.ballY - player.tipY) * t - Math.sin(t * Math.PI) * 0.4,
            player.tipZ + (player.ballZ - player.tipZ) * t
        );
    }
    player.chainGeo.setFromPoints(player.chainPoints);

    // Chain links
    for (let i = 0; i < player.chainLinks.length; i++) {
        const t = (i + 0.5) / player.chainLinks.length;
        const link = player.chainLinks[i];
        const x = player.tipX + (player.ballX - player.tipX) * t;
        const y = player.tipY + (player.ballY - player.tipY) * t - Math.sin(t * Math.PI) * 0.4;
        const z = player.tipZ + (player.ballZ - player.tipZ) * t;
        link.position.set(x, y, z);
        const nextT = Math.min(1, t + 0.08);
        const nx = player.tipX + (player.ballX - player.tipX) * nextT - x;
        const ny = player.tipY + (player.ballY - player.tipY) * nextT - y;
        const nz = player.tipZ + (player.ballZ - player.tipZ) * nextT - z;
        link.lookAt(x + nx, y + ny, z + nz);
        link.rotateX(Math.PI / 2);
    }

    // ---- Camera ----
    const camBackX = -fwdX * CAMERA_DIST;
    const camBackZ = -fwdZ * CAMERA_DIST;
    const targetCamX = player.posX + camBackX;
    const targetCamY = CAMERA_HEIGHT + Math.sin(player.cameraPitch) * 8;
    const targetCamZ = player.posZ + camBackZ;

    const lerpSpeed = 5;
    player.camera.position.x += (targetCamX - player.camera.position.x) * lerpSpeed * dt;
    player.camera.position.y += (targetCamY - player.camera.position.y) * lerpSpeed * dt;
    player.camera.position.z += (targetCamZ - player.camera.position.z) * lerpSpeed * dt;

    player.camera.lookAt(
        player.posX + fwdX * 5,
        BOOM_HEIGHT * 0.4,
        player.posZ + fwdZ * 5
    );

    // Decay mouse deltas
    player.lastMouseDX *= 0.8;
    player.lastMouseDY *= 0.8;
}

// ---- SWING: Directional based on mouse drag direction ----
export function swingBall(player) {
    if (player.swingCd > 0) return false;
    player.swingCd = SWING_CD;

    // Use recent mouse movement direction to determine swing direction
    const mdx = player.lastMouseDX || 0;
    const mdy = player.lastMouseDY || 0;
    const mouseLen = Math.sqrt(mdx * mdx + mdy * mdy);

    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);

    let swingDirX, swingDirZ;
    if (mouseLen > 2) {
        // Directional swing based on mouse drag!
        // Mouse X maps to left/right, Mouse Y maps to forward/back
        const normX = mdx / mouseLen;
        const normY = mdy / mouseLen;
        // Negative Y = mouse moved up = swing forward, positive = back
        swingDirX = fwdX * (-normY) + rightX * normX;
        swingDirZ = fwdZ * (-normY) + rightZ * normX;
    } else {
        // Default: swing forward
        swingDirX = fwdX;
        swingDirZ = fwdZ;
    }

    player.ballVX += swingDirX * SWING_FORCE;
    player.ballVY += 6;
    player.ballVZ += swingDirZ * SWING_FORCE;

    return true;
}

// ---- TURBO SWING ----
export function turboSwing(player) {
    if (player.turboCd > 0 || player.energy < TURBO_COST) return false;
    player.turboCd = TURBO_CD;
    player.shockwaveCooldown = TURBO_CD;
    player.energy -= TURBO_COST;

    const fwdX = -Math.sin(player.yaw);
    const fwdZ = -Math.cos(player.yaw);
    player.ballVX += fwdX * TURBO_FORCE;
    player.ballVY += 10;
    player.ballVZ += fwdZ * TURBO_FORCE;

    return true;
}

// ---- BALL DROP ----
export function ballDrop(player) {
    if (player.dropCd > 0 || player.energy < DROP_COST || player.isDropping) return false;
    player.dropCd = DROP_CD;
    player.slamCooldown = DROP_CD;
    player.energy -= DROP_COST;

    player.ballX = player.tipX;
    player.ballY = player.tipY + 5;
    player.ballZ = player.tipZ;
    player.ballVX = 0;
    player.ballVY = -5;
    player.ballVZ = 0;
    player.isDropping = true;
    player.dropTimer = 0;

    return true;
}

export function getBallPosition(player) {
    return { x: player.ballX, y: player.ballY, z: player.ballZ };
}

export function getBallSpeed(player) {
    return player.ballSpeed;
}

export function getBallRadius() {
    return BALL_RADIUS;
}

export function bounceBall(player, nx, ny, nz) {
    const dot = player.ballVX * nx + player.ballVY * ny + player.ballVZ * nz;
    if (dot < 0) {
        player.ballVX -= 1.5 * dot * nx;
        player.ballVY -= 1.5 * dot * ny;
        player.ballVZ -= 1.5 * dot * nz;
        player.ballVX *= 0.6;
        player.ballVY *= 0.6;
        player.ballVZ *= 0.6;
    }
}

export function getPlayerPosition(player) {
    return { x: player.posX, y: 1, z: player.posZ };
}

export function damagePlayer(player, amount) {
    player.hp = Math.max(0, player.hp - amount);
}

export function resetPlayer(player) {
    player.posX = 0;
    player.posZ = 10;
    player.yaw = 0;
    player.hp = MAX_HP;
    player.energy = MAX_ENERGY;
    player.swingCd = 0;
    player.turboCd = 0;
    player.dropCd = 0;
    player.shockwaveCooldown = 0;
    player.slamCooldown = 0;
    player.isDropping = false;
    player.ballVX = 0; player.ballVY = 0; player.ballVZ = 0;
    player.lastMouseDX = 0; player.lastMouseDY = 0;
    updateBoomTip(player);
    player.ballX = player.tipX;
    player.ballY = player.tipY - ROPE_LENGTH;
    player.ballZ = player.tipZ;
    player.vehicle.position.set(player.posX, 0, player.posZ);
    player.vehicle.rotation.y = player.yaw;
}
