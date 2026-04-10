// game.js — Game state machine, multi-tower rounds, wrecking ball collision, score/combo/XP
import {
    generateTower, getIntegrity, updateTower, cleanupTower,
    damageBlock, aoeDamageTower, getMaterialForRound, MATERIALS
} from './tower.js';
import {
    createPlayer, updatePlayer, swingBall, turboSwing, ballDrop,
    getBallPosition, getBallSpeed, getBallRadius, bounceBall,
    getPlayerPosition, damagePlayer, resetPlayer
} from './player.js';
import { updatePortals } from './portal.js';
import { updateParticles, emitExplosion } from './particles.js';
import { stepPhysics, enforceBodyLimit } from './physics.js';
import {
    initUI, showHUD, hideHUD, updateHUD, triggerCameraShake, updateCameraShake,
    screenFlash, showFloatingScore, worldToScreen, showRoundSummary, hideRoundSummary,
    showLevelUpBanner, showGameOver, hideGameOver, showClickHint, hideClickHint,
    resetDisplayScore
} from './ui.js';
import { saveScore } from './leaderboard.js';
import { playComboTick, playRoundComplete, playLevelUp, playHit, playDestroy, playCollapse } from './audio.js';

const STATES = { MENU: 0, PLAYING: 1, ROUND_END: 2, GAME_OVER: 3 };
const BALL_HIT_CD = 0.05; // minimum time between ball hits

export function createGameState() {
    return {
        state: STATES.MENU,
        round: 1,
        score: 0,
        totalScore: 0,
        combo: 1.0,
        streak: 0,
        peakCombo: 1.0,
        comboTimer: 0,
        xp: 0,
        level: 1,
        stars: 0,
        roundTimer: 0,
        roundScore: 0,
        towers: [],
        player: null,
        username: '',
        params: {},
        summaryTimer: 0,
        ballHitCd: 0,
    };
}

// Tower placement positions
function getTowerPositions(round) {
    const count = Math.min(2 + Math.floor(round / 2), 6);
    const positions = [];
    const spread = 14;

    if (count === 1) {
        positions.push({ x: 0, z: -20 });
    } else if (count === 2) {
        positions.push({ x: -8, z: -20 }, { x: 8, z: -20 });
    } else {
        // Spread towers in an arc ahead
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI * 0.6 + (i / (count - 1)) * Math.PI * 1.2;
            const dist = 20 + Math.random() * 6;
            positions.push({
                x: Math.sin(angle) * dist + (Math.random() - 0.5) * 3,
                z: -Math.cos(angle) * dist - 5
            });
        }
    }
    return positions;
}

export function startGame(gs, scene, camera, username, params) {
    gs.username = username;
    gs.params = params;
    gs.state = STATES.PLAYING;
    gs.round = 1;
    gs.score = 0;
    gs.totalScore = 0;
    gs.combo = 1.0;
    gs.streak = 0;
    gs.peakCombo = 1.0;
    gs.xp = 0;
    gs.level = 1;
    gs.stars = 0;

    initUI();
    showHUD();
    hideGameOver();
    resetDisplayScore();

    gs.player = createPlayer(camera, scene);
    gs.player.lockedIn = false;
    showClickHint();

    startRound(gs, scene);
}

export function restartGame(gs, scene, camera) {
    cleanupAllTowers(gs, scene);
    if (gs.player) resetPlayer(gs.player);

    gs.state = STATES.PLAYING;
    gs.round = 1;
    gs.score = 0;
    gs.totalScore = 0;
    gs.combo = 1.0;
    gs.streak = 0;
    gs.peakCombo = 1.0;
    gs.xp = 0;
    gs.level = 1;
    gs.stars = 0;

    hideGameOver();
    showHUD();
    resetDisplayScore();

    startRound(gs, scene);
}

function cleanupAllTowers(gs, scene) {
    for (const tower of gs.towers) {
        cleanupTower(tower, scene);
    }
    gs.towers = [];
}

function startRound(gs, scene) {
    cleanupAllTowers(gs, scene);

    const positions = getTowerPositions(gs.round);
    const matKey = getMaterialForRound(gs.round);

    for (const pos of positions) {
        const tower = generateTower(scene, gs.round, pos.x, pos.z);
        gs.towers.push(tower);
    }

    gs.roundTimer = 0;
    gs.roundScore = 0;
    gs.combo = 1.0;
    gs.streak = 0;
    gs.peakCombo = 1.0;
    gs.comboTimer = 0;
    gs.stars = 0;

    if (gs.player) resetPlayer(gs.player);
}

// Get overall integrity across all towers
function getOverallIntegrity(gs) {
    if (gs.towers.length === 0) return 0;
    let totalBlocks = 0, totalDestroyed = 0;
    for (const tower of gs.towers) {
        totalBlocks += tower.totalBlocks;
        totalDestroyed += tower.destroyedCount;
    }
    if (totalBlocks === 0) return 0;
    return 1 - (totalDestroyed / totalBlocks);
}

function allTowersDestroyed(gs) {
    for (const tower of gs.towers) {
        if (getIntegrity(tower) > 0) return false;
    }
    return true;
}

export function updateGame(gs, dt, scene, camera) {
    if (gs.state === STATES.MENU) return;

    if (gs.state === STATES.ROUND_END) {
        gs.summaryTimer += dt;
        if (gs.summaryTimer >= 3) {
            hideRoundSummary();
            gs.round++;
            gs.state = STATES.PLAYING;
            startRound(gs, scene);
        }
        return;
    }

    if (gs.state === STATES.GAME_OVER) return;

    // -- PLAYING STATE --
    gs.roundTimer += dt;
    gs.ballHitCd = Math.max(0, gs.ballHitCd - dt);

    // Combo decay
    gs.comboTimer += dt;
    if (gs.comboTimer > 2.0) {
        gs.combo = Math.max(1.0, gs.combo - dt * 1.5);
        if (gs.combo <= 1.0) gs.streak = 0;
    }

    // Stars based on time
    if (gs.roundTimer < 20) gs.stars = 3;
    else if (gs.roundTimer < 40) gs.stars = 2;
    else gs.stars = 1;

    // Update physics
    stepPhysics(dt);
    enforceBodyLimit();

    // Update player
    if (gs.player) {
        updatePlayer(gs.player, dt);

        // ---- Wrecking Ball Collision with Tower Blocks ----
        if (gs.ballHitCd <= 0) {
            checkBallCollisions(gs, camera);
        }
    }

    // Update all towers
    for (const tower of gs.towers) {
        updateTower(tower, dt, scene);
    }

    // Check all towers destroyed
    if (allTowersDestroyed(gs) && !gs._roundEnded) {
        gs._roundEnded = true;
        triggerCameraShake(0.8);
        screenFlash('rgba(255, 106, 0, 0.5)');
        playRoundComplete();
        endRound(gs);
    }

    // Update particles
    updateParticles(dt);

    // Update camera shake
    updateCameraShake(camera, dt);

    // Update portals
    if (gs.player) {
        const pPos = getPlayerPosition(gs.player);
        pPos.hp = gs.player.hp;
        gs.params.currentScore = gs.score;
        updatePortals(camera, pPos, dt, gs.username, gs.params);
    }

    // Check player death
    if (gs.player && gs.player.hp <= 0 && gs.state === STATES.PLAYING) {
        gameOver(gs);
    }

    // Build HUD state
    updateHUD({
        hp: gs.player ? gs.player.hp : 0,
        maxHp: gs.player ? gs.player.maxHp : 100,
        energy: gs.player ? gs.player.energy : 0,
        maxEnergy: gs.player ? gs.player.maxEnergy : 100,
        score: gs.score,
        combo: gs.combo,
        streak: gs.streak,
        round: gs.round,
        integrity: getOverallIntegrity(gs),
        stars: gs.stars,
        level: gs.level,
        xp: gs.xp,
        shockwaveCd: gs.player ? gs.player.shockwaveCooldown : 0,
        slamCd: gs.player ? gs.player.slamCooldown : 0,
    }, dt);
}

function checkBallCollisions(gs, camera) {
    const ballPos = getBallPosition(gs.player);
    const ballR = getBallRadius();
    const ballSpd = getBallSpeed(gs.player);

    // Only check if ball is moving fast enough
    if (ballSpd < 2) return;

    for (const tower of gs.towers) {
        for (const block of tower.blocks) {
            if (block.destroyed) continue;

            const bpos = block.mesh.position;
            const half = 0.5;

            // Sphere-AABB overlap
            const closestX = Math.max(bpos.x - half, Math.min(ballPos.x, bpos.x + half));
            const closestY = Math.max(bpos.y - half, Math.min(ballPos.y, bpos.y + half));
            const closestZ = Math.max(bpos.z - half, Math.min(ballPos.z, bpos.z + half));

            const dx = ballPos.x - closestX;
            const dy = ballPos.y - closestY;
            const dz = ballPos.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < ballR * ballR) {
                // HIT!
                gs.ballHitCd = BALL_HIT_CD;

                // Damage based on ball speed
                let damage = 1;
                if (ballSpd > 15) damage = 3;
                else if (ballSpd > 8) damage = 2;

                // Collision normal
                const dist = Math.sqrt(distSq) || 0.01;
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                const result = damageBlock(tower, block, damage, { x: nx, y: ny, z: nz });

                if (result.destroyed) {
                    handleBlockDestroyed(gs, result, camera);
                }

                // Bounce the ball
                bounceBall(gs.player, nx, ny, nz);

                // Camera shake proportional to speed
                triggerCameraShake(Math.min(0.3, ballSpd * 0.02));

                return; // One hit per frame
            }
        }
    }
}

function handleBlockDestroyed(gs, result, camera) {
    gs.streak++;
    gs.combo = 1.0 + gs.streak * 0.1;
    gs.combo = Math.min(gs.combo, 10.0);
    gs.comboTimer = 0;
    gs.peakCombo = Math.max(gs.peakCombo, gs.combo);

    playComboTick();

    const points = Math.round(result.score * gs.combo);
    gs.score += points;
    gs.roundScore += points;

    if (result.pos) {
        const screen = worldToScreen(result.pos, camera);
        if (screen.visible) {
            const color = gs.streak >= 20 ? '#ffd700' :
                          gs.streak >= 10 ? '#ff2d7b' :
                          gs.streak >= 5 ? '#ff6a00' : '#00f0ff';
            showFloatingScore(points, screen.x, screen.y, color);
        }
    }

    if (gs.streak >= 10) triggerCameraShake(0.15);
    if (gs.streak === 5) screenFlash('rgba(255, 106, 0, 0.2)');
    if (gs.streak === 10) screenFlash('rgba(255, 45, 123, 0.3)');
    if (gs.streak === 20) screenFlash('rgba(255, 215, 0, 0.4)');
}

function endRound(gs) {
    gs.state = STATES.ROUND_END;
    gs.summaryTimer = 0;
    gs._roundEnded = false;

    const xpEarned = Math.round(gs.roundScore * 0.1);
    gs.xp += xpEarned;

    const xpForNext = gs.level * 100;
    while (gs.xp >= xpForNext && gs.level < 50) {
        gs.xp -= gs.level * 100;
        gs.level++;
        showLevelUpBanner(gs.level);
        playLevelUp();
    }

    gs.totalScore = gs.score;
    saveScore(gs.username, gs.score, gs.level, gs.round);

    showRoundSummary({
        round: gs.round,
        score: gs.roundScore,
        peakCombo: gs.peakCombo,
        time: gs.roundTimer,
        stars: gs.stars,
        xpEarned
    });
}

function gameOver(gs) {
    gs.state = STATES.GAME_OVER;
    gs.totalScore = gs.score;
    saveScore(gs.username, gs.score, gs.level, gs.round);
    showGameOver(gs.score, gs.round, gs.level);
    hideHUD();
}

// -- Input handlers --
export function handleSwing(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player || !gs.player.lockedIn) return;
    swingBall(gs.player);
}

export function handleTurboSwing(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player) return;
    if (turboSwing(gs.player)) {
        triggerCameraShake(0.3);
        screenFlash('rgba(0, 240, 255, 0.25)');
    }
}

export function handleBallDrop(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player) return;
    if (ballDrop(gs.player)) {
        triggerCameraShake(0.2);
        screenFlash('rgba(180, 77, 255, 0.3)');
    }
}

// Keep old exports for compatibility
export function handleShoot(gs, scene) { handleSwing(gs); }
export function handleShockwave(gs) { handleTurboSwing(gs); }
export function handleGravitySlam(gs) { handleBallDrop(gs); }
