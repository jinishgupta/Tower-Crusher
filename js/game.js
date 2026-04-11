// game.js — Game state, multi-tower rounds, wrecking ball collision, score/combo (no HP/energy/stars)
import {
    generateTower, getIntegrity, updateTower, cleanupTower,
    damageBlock
} from './tower.js';
import {
    createPlayer, updatePlayer, swingBall, turboSwing, ballDrop,
    getBallPosition, getBallSpeed, getBallRadius, bounceBall,
    getPlayerPosition, resetPlayer
} from './player.js';
import { updatePortals } from './portal.js';
import { updateParticles } from './particles.js';
import { stepPhysics, enforceBodyLimit } from './physics.js';
import {
    initUI, showHUD, hideHUD, updateHUD, triggerCameraShake, updateCameraShake,
    screenFlash, showFloatingScore, worldToScreen, showRoundSummary, hideRoundSummary,
    showGameOver, hideGameOver, showClickHint,
    resetDisplayScore
} from './ui.js';
import { saveScore } from './leaderboard.js';
import { playComboTick, playRoundComplete } from './audio.js';

const STATES = { MENU: 0, PLAYING: 1, ROUND_END: 2, GAME_OVER: 3 };
const BALL_HIT_CD = 0.05;
const STAR_BONUS_POINTS = 250;
const BASE_OBJECTIVE_TIME_LIMIT = 45;

const ROUND_ARCHETYPES = ['standard', 'shielded', 'segmented', 'regenerating_core'];
const OBJECTIVE_POOL = [
    'destroy_80_in_45',
    'destroy_70_in_35',
    'destroy_90_in_55',
    'destroy_95_in_65',
    'weak_only',
    'weak_target',
    'destroy_blocks_target',
    'no_ability',
    'use_ability_once',
    'combo_target',
    'combo_no_ability',
    'ability_combo_chain',
    'score_target',
    'score_fast',
    'clear_under_time',
];

export function createGameState() {
    return {
        state: STATES.MENU,
        round: 1,
        score: 0,
        totalScore: 0,
        combo: 1.0,
        streak: 0,
        peakCombo: 1.0,
        totalStars: 0,
        roundStars: 0,
        comboTimer: 0,
        roundTimer: 0,
        roundScore: 0,
        roundWeakDestroyed: 0,
        roundNonWeakDestroyed: 0,
        roundAbilityUsed: false,
        roundDestroyed80InTime: false,
        missions: null,
        towers: [],
        player: null,
        username: '',
        params: {},
        summaryTimer: 0,
        ballHitCd: 0,
        _roundEnded: false,
    };
}

function getArchetypeForTower(round, index) {
    if (round <= 1) return 'standard';
    return ROUND_ARCHETYPES[(round + index) % ROUND_ARCHETYPES.length];
}

function createRoundMissions() {
    return [];
}

function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleWithSeed(arr, seed) {
    const out = [...arr];
    const rand = makeRng(seed);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function missionConflicts(a, b) {
    if (!a || !b) return false;
    if ((a === 'no_ability' && b === 'use_ability_once') || (a === 'use_ability_once' && b === 'no_ability')) {
        return true;
    }
    if ((a === 'no_ability' && b === 'ability_combo_chain') || (a === 'ability_combo_chain' && b === 'no_ability')) {
        return true;
    }
    if ((a === 'no_ability' && b === 'combo_no_ability') || (a === 'combo_no_ability' && b === 'no_ability')) {
        return true;
    }
    if ((a === 'use_ability_once' && b === 'combo_no_ability') || (a === 'combo_no_ability' && b === 'use_ability_once')) {
        return true;
    }
    if ((a === 'weak_only' && b === 'weak_target') || (a === 'weak_target' && b === 'weak_only')) {
        return true;
    }
    return false;
}

function buildMission(round, id) {
    switch (id) {
        case 'destroy_80_in_45':
            return { id, label: 'Destroy 80% in 45s', targetRatio: 0.8, targetTime: 45, completed: false, failed: false };
        case 'destroy_70_in_35':
            return { id, label: 'Destroy 70% in 35s', targetRatio: 0.7, targetTime: 35, completed: false, failed: false };
        case 'destroy_90_in_55':
            return { id, label: 'Destroy 90% in 55s', targetRatio: 0.9, targetTime: 55, completed: false, failed: false };
        case 'destroy_95_in_65':
            return { id, label: 'Destroy 95% in 65s', targetRatio: 0.95, targetTime: 65, completed: false, failed: false };
        case 'weak_only':
            return { id, label: 'Only destroy weak-point blocks', completed: false, failed: false };
        case 'weak_target': {
            const target = 2 + Math.min(8, Math.floor(round / 2));
            return { id, label: `Destroy ${target} weak points`, target, completed: false, failed: false };
        }
        case 'destroy_blocks_target': {
            const target = 20 + Math.min(55, round * 3);
            return { id, label: `Destroy ${target} blocks`, target, completed: false, failed: false };
        }
        case 'no_ability':
            return { id, label: 'Do not use abilities', completed: false, failed: false };
        case 'use_ability_once':
            return { id, label: 'Use at least 1 ability', completed: false, failed: false };
        case 'combo_target': {
            const target = 3 + Math.min(7, Math.floor(round / 2));
            return { id, label: `Reach ${target.toFixed(1)}x combo`, target, completed: false, failed: false };
        }
        case 'combo_no_ability': {
            const target = 2.5 + Math.min(6, Math.floor(round / 3));
            return { id, label: `Reach ${target.toFixed(1)}x combo without abilities`, target, completed: false, failed: false };
        }
        case 'ability_combo_chain': {
            const target = 4 + Math.min(7, Math.floor(round / 2));
            return { id, label: `Use ability and reach ${target.toFixed(1)}x combo`, target, completed: false, failed: false };
        }
        case 'score_target': {
            const target = 900 + round * 220;
            return { id, label: `Score ${target.toLocaleString()} this round`, target, completed: false, failed: false };
        }
        case 'score_fast': {
            const target = 650 + round * 170;
            return { id, label: `Score ${target.toLocaleString()} in 30s`, target, targetTime: 30, completed: false, failed: false };
        }
        case 'clear_under_time': {
            const target = Math.max(28, BASE_OBJECTIVE_TIME_LIMIT - Math.min(10, Math.floor(round / 2)));
            return { id, label: `Clear round under ${target}s`, target, completed: false, failed: false };
        }
        default:
            return { id: 'destroy_80_in_45', label: 'Destroy 80% in 45s', targetRatio: 0.8, targetTime: 45, completed: false, failed: false };
    }
}

function createMissionSetForRound(round) {
    const shuffled = shuffleWithSeed(OBJECTIVE_POOL, round * 7919 + 123);
    const picked = [];

    for (const id of shuffled) {
        if (picked.some((p) => missionConflicts(p, id))) continue;
        picked.push(id);
        if (picked.length === 3) break;
    }

    while (picked.length < 3) {
        const fallback = OBJECTIVE_POOL.find((id) => !picked.includes(id) && !picked.some((p) => missionConflicts(p, id)));
        if (!fallback) break;
        picked.push(fallback);
    }

    return picked.slice(0, 3).map((id) => buildMission(round, id));
}

function getTowerPositions(round) {
    const count = Math.min(2 + Math.floor(round / 2), 6);
    const positions = [];

    if (count === 1) {
        positions.push({ x: 0, z: -20 });
    } else if (count === 2) {
        positions.push({ x: -8, z: -20 }, { x: 8, z: -20 });
    } else {
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
    gs.totalStars = 0;
    gs.roundStars = 0;

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
    gs.totalStars = 0;
    gs.roundStars = 0;

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
    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const archetype = getArchetypeForTower(gs.round, i);
        const tower = generateTower(scene, gs.round, pos.x, pos.z, archetype);
        gs.towers.push(tower);
    }

    gs.roundTimer = 0;
    gs.roundScore = 0;
    gs.combo = 1.0;
    gs.streak = 0;
    gs.peakCombo = 1.0;
    gs.comboTimer = 0;
    gs.roundStars = 0;
    gs.roundWeakDestroyed = 0;
    gs.roundNonWeakDestroyed = 0;
    gs.roundAbilityUsed = false;
    gs.roundDestroyed80InTime = false;
    gs.missions = createMissionSetForRound(gs.round);
    gs._roundEnded = false;

    if (gs.player) resetPlayer(gs.player);
}

function updateMissionProgress(gs, isFinal = false) {
    if (!gs.missions) return;

    const destructionRatio = 1 - getOverallIntegrity(gs);
    const destroyedBlocks = gs.towers.reduce((sum, t) => sum + t.destroyedCount, 0);
    if (!gs.roundDestroyed80InTime && gs.roundTimer <= BASE_OBJECTIVE_TIME_LIMIT && destructionRatio >= 0.8) {
        gs.roundDestroyed80InTime = true;
    }

    for (const mission of gs.missions) {
        switch (mission.id) {
            case 'destroy_80_in_45':
            case 'destroy_70_in_35':
            case 'destroy_90_in_55':
            case 'destroy_95_in_65': {
                if (destructionRatio >= mission.targetRatio) mission.completed = true;
                if (!mission.completed && gs.roundTimer > mission.targetTime) mission.failed = true;
                break;
            }
            case 'weak_only': {
                if (gs.roundNonWeakDestroyed > 0) mission.failed = true;
                if (isFinal && !mission.failed && gs.roundWeakDestroyed > 0) mission.completed = true;
                break;
            }
            case 'weak_target': {
                if (gs.roundWeakDestroyed >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'no_ability': {
                if (gs.roundAbilityUsed) mission.failed = true;
                if (isFinal && !mission.failed) mission.completed = true;
                break;
            }
            case 'use_ability_once': {
                if (gs.roundAbilityUsed) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'combo_target': {
                if (gs.peakCombo >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'destroy_blocks_target': {
                if (destroyedBlocks >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'combo_no_ability': {
                if (gs.roundAbilityUsed) mission.failed = true;
                if (!mission.failed && gs.peakCombo >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'ability_combo_chain': {
                if (gs.roundAbilityUsed && gs.peakCombo >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'score_target': {
                if (gs.roundScore >= mission.target) mission.completed = true;
                if (isFinal && !mission.completed) mission.failed = true;
                break;
            }
            case 'score_fast': {
                if (gs.roundScore >= mission.target && gs.roundTimer <= mission.targetTime) mission.completed = true;
                if (!mission.completed && gs.roundTimer > mission.targetTime) mission.failed = true;
                break;
            }
            case 'clear_under_time': {
                if (gs.roundTimer > mission.target) mission.failed = true;
                if (isFinal && !mission.failed) mission.completed = true;
                break;
            }
            default:
                break;
        }

        if (mission.completed) mission.failed = false;
    }
}

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
    if (gs.towers.length === 0) return false;
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

    // -- PLAYING --
    gs.roundTimer += dt;
    gs.ballHitCd = Math.max(0, gs.ballHitCd - dt);

    // Combo decay
    gs.comboTimer += dt;
    if (gs.comboTimer > 2.0) {
        gs.combo = Math.max(1.0, gs.combo - dt * 1.5);
        if (gs.combo <= 1.0) gs.streak = 0;
    }

    stepPhysics(dt);
    enforceBodyLimit();

    if (gs.player) {
        updatePlayer(gs.player, dt);
        if (gs.ballHitCd <= 0) {
            checkBallCollisions(gs, camera);
        }
    }

    for (const tower of gs.towers) {
        updateTower(tower, dt, scene);
    }

    if (allTowersDestroyed(gs) && !gs._roundEnded) {
        gs._roundEnded = true;
        triggerCameraShake(0.8);
        screenFlash('rgba(255, 106, 0, 0.5)');
        playRoundComplete();
        endRound(gs);
    }

    updateParticles(dt);
    updateCameraShake(camera, dt);

    if (gs.player) {
        const pPos = getPlayerPosition(gs.player);
        gs.params.currentScore = gs.score;
        updatePortals(camera, pPos, dt, gs.username, gs.params);
    }

    updateMissionProgress(gs);

    // Update HUD
    updateHUD({
        score: gs.score,
        combo: gs.combo,
        streak: gs.streak,
        round: gs.round,
        totalStars: gs.totalStars,
        roundStars: gs.roundStars,
        integrity: getOverallIntegrity(gs),
        shockwaveCd: gs.player ? gs.player.shockwaveCooldown : 0,
        slamCd: gs.player ? gs.player.slamCooldown : 0,
        missions: gs.missions,
    }, dt);
}

function checkBallCollisions(gs, camera) {
    const ballPos = getBallPosition(gs.player);
    const ballR = getBallRadius();
    const ballSpd = getBallSpeed(gs.player);

    if (ballSpd < 2) return;

    for (const tower of gs.towers) {
        for (const block of tower.blocks) {
            if (block.destroyed) continue;

            const bpos = block.mesh.position;
            const half = 0.5;

            const closestX = Math.max(bpos.x - half, Math.min(ballPos.x, bpos.x + half));
            const closestY = Math.max(bpos.y - half, Math.min(ballPos.y, bpos.y + half));
            const closestZ = Math.max(bpos.z - half, Math.min(ballPos.z, bpos.z + half));

            const dx = ballPos.x - closestX;
            const dy = ballPos.y - closestY;
            const dz = ballPos.z - closestZ;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < ballR * ballR) {
                gs.ballHitCd = BALL_HIT_CD;

                let damage = 1;
                if (ballSpd > 15) damage = 3;
                else if (ballSpd > 8) damage = 2;

                const dist = Math.sqrt(distSq) || 0.01;
                const nx = dx / dist, ny = dy / dist, nz = dz / dist;

                const result = damageBlock(tower, block, damage, { x: nx, y: ny, z: nz });

                if (result.destroyed) {
                    handleBlockDestroyed(gs, result, camera);
                }

                bounceBall(gs.player, nx, ny, nz);
                triggerCameraShake(Math.min(0.3, ballSpd * 0.02));

                return;
            }
        }
    }
}

function handleBlockDestroyed(gs, result, camera) {
    if (result.weakPoint) gs.roundWeakDestroyed++;
    else gs.roundNonWeakDestroyed++;

    gs.streak++;
    gs.combo = 1.0 + gs.streak * 0.1;
    gs.combo = Math.min(gs.combo, 10.0);
    gs.comboTimer = 0;
    gs.peakCombo = Math.max(gs.peakCombo, gs.combo);

    playComboTick();

    const weakPointBonus = result.weakPoint ? 1.5 : 1.0;
    const points = Math.round(result.score * weakPointBonus * gs.combo);
    gs.score += points;
    gs.roundScore += points;

    if (result.pos) {
        const screen = worldToScreen(result.pos, camera);
        if (screen.visible) {
            const color = result.weakPoint ? '#ff4d91' :
                          gs.streak >= 20 ? '#ffd700' :
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
    updateMissionProgress(gs, true);

    gs.roundStars = gs.missions.filter((m) => m.completed).length;
    gs.totalStars += gs.roundStars;

    const starBonus = gs.roundStars * STAR_BONUS_POINTS;
    gs.score += starBonus;
    gs.roundScore += starBonus;

    gs.state = STATES.ROUND_END;
    gs.summaryTimer = 0;
    gs._roundEnded = false;

    gs.totalScore = gs.score;
    saveScore(gs.username, gs.score, gs.totalStars, gs.round);

    showRoundSummary({
        round: gs.round,
        score: gs.roundScore,
        peakCombo: gs.peakCombo,
        time: gs.roundTimer,
        stars: gs.roundStars,
        totalStars: gs.totalStars,
        objectives: gs.missions,
        starBonus,
    });
}

function gameOver(gs) {
    gs.state = STATES.GAME_OVER;
    gs.totalScore = gs.score;
    saveScore(gs.username, gs.score, gs.totalStars, gs.round);
    showGameOver(gs.score, gs.round);
    hideHUD();
}

export function handleSwing(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player) return;
    if (!gs.player.lockedIn && !gs.params.touchMode) return;
    swingBall(gs.player);
}

export function handleTurboSwing(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player) return;
    if (turboSwing(gs.player)) {
        gs.roundAbilityUsed = true;
        triggerCameraShake(0.3);
        screenFlash('rgba(0, 240, 255, 0.25)');
    }
}

export function handleBallDrop(gs) {
    if (gs.state !== STATES.PLAYING || !gs.player) return;
    if (ballDrop(gs.player)) {
        gs.roundAbilityUsed = true;
        triggerCameraShake(0.2);
        screenFlash('rgba(180, 77, 255, 0.3)');
    }
}

// Compat exports
export function handleShoot(gs, scene) { handleSwing(gs); }
export function handleShockwave(gs) { handleTurboSwing(gs); }
export function handleGravitySlam(gs) { handleBallDrop(gs); }
