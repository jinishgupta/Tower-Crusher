// tower.js — Procedural tower generation with structural support checking & realistic collapse
import * as THREE from 'three';
import { createBody, removeBody, wakeBody, applyImpulse } from './physics.js';
import { emitHitParticles, emitDust, emitSparks, emitShatter, emitExplosion, emitFireParticles } from './particles.js';
import { playHit, playDestroy, playCollapse } from './audio.js';

// Realistic material definitions
export const MATERIALS = {
    wood:    { name: 'Wooden',  color: 0xA0522D, hpPerBlock: 1, scoreBonus: 1.0, emissive: 0x000000, roughness: 0.9, metalness: 0.0 },
    stone:   { name: 'Stone',   color: 0x9E9E9E, hpPerBlock: 2, scoreBonus: 1.5, emissive: 0x000000, roughness: 0.85, metalness: 0.05 },
    steel:   { name: 'Steel',   color: 0x607D8B, hpPerBlock: 3, scoreBonus: 2.0, emissive: 0x111111, roughness: 0.25, metalness: 0.8 },
    crystal: { name: 'Crystal', color: 0x00BCD4, hpPerBlock: 1, scoreBonus: 3.0, emissive: 0x006064, roughness: 0.05, metalness: 0.3 },
    boss:    { name: 'BOSS',    color: 0xB71C1C, hpPerBlock: 4, scoreBonus: 2.5, emissive: 0x330000, roughness: 0.5, metalness: 0.4 }
};

const MATERIAL_ORDER = ['wood', 'stone', 'steel', 'crystal', 'boss'];

export function getMaterialForRound(round) {
    return MATERIAL_ORDER[(round - 1) % MATERIAL_ORDER.length];
}

const blockSize = 1.0;
const blockGap = 0.04;
const blockUnit = blockSize + blockGap;

function varyColor(baseColor, variation = 0.08) {
    const c = new THREE.Color(baseColor);
    const hsl = {};
    c.getHSL(hsl);
    hsl.l = Math.max(0, Math.min(1, hsl.l + (Math.random() - 0.5) * variation));
    hsl.s = Math.max(0, Math.min(1, hsl.s + (Math.random() - 0.5) * variation * 0.5));
    c.setHSL(hsl.h, hsl.s, hsl.l);
    return c;
}

export function generateTower(scene, round, centerX = 0, centerZ = -15) {
    const matKey = getMaterialForRound(round);
    const matDef = MATERIALS[matKey];
    const isBoss = matKey === 'boss';

    // TALL buildings — scale aggressively with round
    const baseWidth = isBoss ? 4 : 3 + Math.min(Math.floor(round / 4), 2);
    const baseDepth = isBoss ? 4 : 3 + Math.min(Math.floor(round / 4), 2);
    const height = isBoss ? 14 + round : 10 + round * 2;
    const clampedHeight = Math.min(height, 30); // very tall!

    const blocks = [];

    // Shared geometry for performance
    const geometry = new THREE.BoxGeometry(blockSize * 0.96, blockSize * 0.96, blockSize * 0.96);
    const edgesGeo = new THREE.EdgesGeometry(geometry);

    const offsetX = -((baseWidth - 1) * blockUnit) / 2;
    const offsetZ = -((baseDepth - 1) * blockUnit) / 2;

    // Grid lookup for structural support checking
    const grid = {};

    for (let y = 0; y < clampedHeight; y++) {
        for (let x = 0; x < baseWidth; x++) {
            for (let z = 0; z < baseDepth; z++) {
                // Taper at top for building shape
                if (y > clampedHeight * 0.7) {
                    const taper = (y - clampedHeight * 0.7) / (clampedHeight * 0.3);
                    if (x === 0 && taper > 0.5) continue;
                    if (x === baseWidth - 1 && taper > 0.5) continue;
                    if (z === 0 && taper > 0.5) continue;
                    if (z === baseDepth - 1 && taper > 0.5) continue;
                }

                // Skip some interior blocks to reduce count (hollow building)
                const isEdge = x === 0 || x === baseWidth - 1 || z === 0 || z === baseDepth - 1;
                if (!isEdge && y > 1 && y < clampedHeight - 1) continue;

                const blockColor = varyColor(matDef.color);
                const material = new THREE.MeshStandardMaterial({
                    color: blockColor,
                    emissive: matDef.emissive,
                    roughness: matDef.roughness,
                    metalness: matDef.metalness || 0.1
                });

                const mesh = new THREE.Mesh(geometry, material);
                const wx = centerX + offsetX + x * blockUnit;
                const wy = blockSize / 2 + y * blockUnit;
                const wz = centerZ + offsetZ + z * blockUnit;

                mesh.position.set(wx, wy, wz);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);

                // Edge wireframe
                const edgeMat = new THREE.LineBasicMaterial({
                    color: 0x000000, transparent: true, opacity: 0.12
                });
                mesh.add(new THREE.LineSegments(edgesGeo, edgeMat));

                const body = createBody({
                    x: wx, y: wy, z: wz,
                    width: blockSize, height: blockSize, depth: blockSize,
                    mass: 1, isStatic: true
                });

                const block = {
                    mesh, body,
                    hp: matDef.hpPerBlock,
                    maxHp: matDef.hpPerBlock,
                    materialKey: matKey,
                    destroyed: false,
                    fallen: false,
                    fallenTimer: 0,
                    flashTimer: 0,
                    gridX: x, gridY: y, gridZ: z,
                    originalColor: blockColor
                };
                blocks.push(block);

                // Store in grid for structural lookups
                const key = `${x},${y},${z}`;
                grid[key] = block;
            }
        }
    }

    const tower = {
        blocks, grid,
        totalBlocks: blocks.length,
        destroyedCount: 0,
        matKey, matDef, isBoss,
        collapsed: false,
        wobbleTimer: 0,
        wobbleActive: false,
        centerX, centerZ,
        baseWidth, baseDepth,
        height: clampedHeight,
        bossHp: isBoss ? blocks.length * matDef.hpPerBlock : 0,
        bossMaxHp: isBoss ? blocks.length * matDef.hpPerBlock : 0,
        supportCheckPending: false,
        supportCheckTimer: 0,
    };

    return tower;
}

export function damageBlock(tower, block, damage, impactDir) {
    if (block.destroyed) return { destroyed: false, score: 0 };

    block.hp -= damage;
    block.flashTimer = 0.15;
    playHit();

    const pos = block.mesh.position;
    switch (tower.matKey) {
        case 'wood': emitFireParticles(pos, 4); break;
        case 'stone': emitDust(pos, 6); break;
        case 'steel': emitSparks(pos, 6); break;
        case 'crystal': emitHitParticles(pos, 0x00BCD4, 6); break;
        case 'boss': emitHitParticles(pos, 0xff2244, 6); break;
    }

    if (block.hp <= 0) {
        return destroyBlock(tower, block, impactDir);
    }

    return { destroyed: false, score: 0 };
}

function destroyBlock(tower, block, impactDir) {
    block.destroyed = true;
    tower.destroyedCount++;

    const pos = block.mesh.position.clone();
    playDestroy();

    switch (tower.matKey) {
        case 'wood': emitFireParticles(pos, 10); emitHitParticles(pos, 0xA0522D, 6); break;
        case 'stone': emitDust(pos, 15); break;
        case 'steel': emitSparks(pos, 12); break;
        case 'crystal': emitShatter(pos, 20); break;
        case 'boss': emitExplosion(pos, 12); break;
    }

    // Remove mesh and body
    block.mesh.visible = false;
    block.mesh.parent?.remove(block.mesh);
    removeBody(block.body);

    // Remove from grid
    const key = `${block.gridX},${block.gridY},${block.gridZ}`;
    delete tower.grid[key];

    // Schedule structural support check — blocks above should fall
    tower.supportCheckPending = true;
    tower.supportCheckTimer = 0.05; // slight delay for chain reaction feel

    // Push immediate neighbors outward
    const neighborRadius = 1.6;
    for (const other of tower.blocks) {
        if (other.destroyed || other === block) continue;
        const dx = other.mesh.position.x - pos.x;
        const dy = other.mesh.position.y - pos.y;
        const dz = other.mesh.position.z - pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < neighborRadius && Math.abs(dy) < 0.5) {
            // Only push same-level neighbors outward (not above)
            const force = (1 - dist / neighborRadius) * 3;
            const ndx = dist > 0.01 ? dx / dist : 0;
            const ndz = dist > 0.01 ? dz / dist : 0;
            if (!other.fallen) {
                other.body.isStatic = false;
                wakeBody(other.body);
                other.fallen = true;
                other.fallenTimer = 0;
                applyImpulse(other.body, ndx * force, 1, ndz * force);
            }
        }
    }

    // Full collapse if integrity < 20%
    const integrity = getIntegrity(tower);
    if (integrity <= 0 && !tower.collapsed) {
        tower.collapsed = true;
        playCollapse();
        emitExplosion({ x: tower.centerX, y: 3, z: tower.centerZ }, 40);
    }

    const score = Math.round(10 * tower.matDef.scoreBonus);
    return { destroyed: true, score, pos };
}

// ====== STRUCTURAL SUPPORT CHECK ======
// Key fix: blocks without support below them must fall!
function checkStructuralSupport(tower) {
    let changed = true;
    let iterations = 0;

    // Iteratively find unsupported blocks (cascade from bottom up)
    while (changed && iterations < 50) {
        changed = false;
        iterations++;

        for (const block of tower.blocks) {
            if (block.destroyed || block.fallen) continue;
            if (!block.body.isStatic) continue; // already dynamic

            // Ground level blocks are always supported
            if (block.gridY === 0) continue;

            // Check if any block exists below this one
            const hasSupport = checkBlockSupport(tower, block);

            if (!hasSupport) {
                // This block has no support — make it fall!
                block.body.isStatic = false;
                wakeBody(block.body);
                block.fallen = true;
                block.fallenTimer = 0;

                // Small random push for natural collapse look
                applyImpulse(block.body,
                    (Math.random() - 0.5) * 1.5,
                    -0.5,
                    (Math.random() - 0.5) * 1.5
                );

                changed = true;
            }
        }
    }
}

function checkBlockSupport(tower, block) {
    const x = block.gridX;
    const y = block.gridY;
    const z = block.gridZ;

    // A block is supported if there's at least ONE non-destroyed, static block
    // directly below it OR diagonally below (same Y-1 level, adjacent X/Z)
    // This allows for some overhang but not floating
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const belowKey = `${x + dx},${y - 1},${z + dz}`;
            const belowBlock = tower.grid[belowKey];
            if (belowBlock && !belowBlock.destroyed && !belowBlock.fallen) {
                return true; // has support
            }
        }
    }

    return false; // no support — should fall
}

export function getIntegrity(tower) {
    if (tower.totalBlocks === 0) return 0;
    return 1 - (tower.destroyedCount / tower.totalBlocks);
}

export function updateTower(tower, dt, scene) {
    tower.wobbleTimer += dt;

    // Run structural support check after block destruction
    if (tower.supportCheckPending) {
        tower.supportCheckTimer -= dt;
        if (tower.supportCheckTimer <= 0) {
            tower.supportCheckPending = false;
            checkStructuralSupport(tower);
        }
    }

    for (const block of tower.blocks) {
        if (block.destroyed) continue;

        // Flash on hit
        if (block.flashTimer > 0) {
            block.flashTimer -= dt;
            block.mesh.material.emissive.setHex(0xff0000);
            block.mesh.material.emissiveIntensity = (block.flashTimer / 0.15) * 0.8;
        } else {
            block.mesh.material.emissive.setHex(tower.matDef.emissive);
            block.mesh.material.emissiveIntensity = tower.matKey === 'crystal' ? 0.3 : 0;
        }

        // Sync dynamic blocks to physics body
        if (!block.body.isStatic && !block.body.removed) {
            block.mesh.position.set(
                block.body.position.x,
                block.body.position.y,
                block.body.position.z
            );
            if (block.fallen) {
                block.mesh.rotation.x += dt * 2;
                block.mesh.rotation.z += dt * 1.5;
            }
        }

        // Fade out and cleanup fallen blocks
        if (block.fallen) {
            block.fallenTimer += dt;
            if (block.fallenTimer > 3) {
                const fadeT = (block.fallenTimer - 3) / 1;
                block.mesh.material.transparent = true;
                block.mesh.material.opacity = 1 - fadeT;
            }
            if (block.fallenTimer > 4) {
                block.destroyed = true;
                tower.destroyedCount++;
                block.mesh.visible = false;
                block.mesh.parent?.remove(block.mesh);
                block.mesh.material.dispose();
                removeBody(block.body);
                // Remove from grid
                const key = `${block.gridX},${block.gridY},${block.gridZ}`;
                delete tower.grid[key];
                // Re-check support after fallen block clears
                tower.supportCheckPending = true;
                tower.supportCheckTimer = 0.1;
            }
        }
    }
}

export function cleanupTower(tower, scene) {
    for (const block of tower.blocks) {
        if (block.mesh.parent) block.mesh.parent.remove(block.mesh);
        block.mesh.geometry.dispose();
        if (block.mesh.material.dispose) block.mesh.material.dispose();
        if (!block.body.removed) removeBody(block.body);
    }
    tower.blocks = [];
    tower.grid = {};
}

export function aoeDamageTower(tower, centerX, centerY, centerZ, radius, damage) {
    const results = [];
    for (const block of tower.blocks) {
        if (block.destroyed) continue;
        const dx = block.mesh.position.x - centerX;
        const dy = block.mesh.position.y - centerY;
        const dz = block.mesh.position.z - centerZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < radius) {
            const falloff = 1 - (dist / radius);
            const actualDamage = Math.ceil(damage * falloff);
            const result = damageBlock(tower, block, actualDamage, { x: dx, y: dy, z: dz });
            if (result.destroyed) results.push(result);
        }
    }
    return results;
}

export function raycastTower(tower, origin, direction, maxDist = 80) {
    let closest = null;
    let closestDist = maxDist;
    for (const block of tower.blocks) {
        if (block.destroyed) continue;
        const pos = block.mesh.position;
        const half = blockSize / 2;
        const hit = rayAABB(origin, direction,
            pos.x - half, pos.y - half, pos.z - half,
            pos.x + half, pos.y + half, pos.z + half);
        if (hit !== null && hit < closestDist) {
            closestDist = hit;
            closest = block;
        }
    }
    return closest;
}

function rayAABB(origin, dir, minX, minY, minZ, maxX, maxY, maxZ) {
    let tmin = -Infinity, tmax = Infinity;
    if (dir.x !== 0) {
        let t1 = (minX - origin.x) / dir.x, t2 = (maxX - origin.x) / dir.x;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    } else if (origin.x < minX || origin.x > maxX) return null;
    if (dir.y !== 0) {
        let t1 = (minY - origin.y) / dir.y, t2 = (maxY - origin.y) / dir.y;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    } else if (origin.y < minY || origin.y > maxY) return null;
    if (dir.z !== 0) {
        let t1 = (minZ - origin.z) / dir.z, t2 = (maxZ - origin.z) / dir.z;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    } else if (origin.z < minZ || origin.z > maxZ) return null;
    if (tmin > tmax || tmax < 0) return null;
    return tmin >= 0 ? tmin : tmax;
}
