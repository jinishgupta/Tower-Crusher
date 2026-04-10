// leaderboard.js — localStorage leaderboard, Tab toggle panel

const STORAGE_KEY = 'tower_destroyer_leaderboard';
const MAX_ENTRIES = 20;

let panelEl = null;
let tbodyEl = null;
let isOpen = false;
let currentUsername = '';

export function initLeaderboard(username) {
    currentUsername = username;
    panelEl = document.getElementById('leaderboard-panel');
    tbodyEl = document.getElementById('lb-tbody');

    document.getElementById('leaderboard-btn').addEventListener('click', toggleLeaderboard);
    document.getElementById('lb-close-btn').addEventListener('click', () => hideLeaderboard());
}

export function toggleLeaderboard() {
    if (isOpen) hideLeaderboard();
    else showLeaderboard();
}

export function showLeaderboard() {
    if (!panelEl) return;
    renderLeaderboard();
    panelEl.classList.remove('hidden');
    isOpen = true;
}

export function hideLeaderboard() {
    if (!panelEl) return;
    panelEl.classList.add('hidden');
    isOpen = false;
}

export function isLeaderboardOpen() {
    return isOpen;
}

function getEntries() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveEntries(entries) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { /* storage full */ }
}

export function saveScore(username, score, level, round) {
    const entries = getEntries();
    // Check if user already has an entry — update if higher
    const existing = entries.find(e => e.username === username);
    if (existing) {
        if (score > existing.score) {
            existing.score = score;
            existing.level = level;
            existing.round = round;
            existing.date = Date.now();
        }
    } else {
        entries.push({ username, score, level, round, date: Date.now() });
    }
    // Sort by score desc
    entries.sort((a, b) => b.score - a.score);
    // Keep top N
    const trimmed = entries.slice(0, MAX_ENTRIES);
    saveEntries(trimmed);
    return trimmed;
}

export function getHighScore(username) {
    const entries = getEntries();
    const entry = entries.find(e => e.username === username);
    return entry ? entry.score : 0;
}

function renderLeaderboard() {
    if (!tbodyEl) return;
    const entries = getEntries();
    tbodyEl.innerHTML = '';

    if (entries.length === 0) {
        tbodyEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6a6a8a;padding:20px;">No scores yet. Start playing!</td></tr>';
        return;
    }

    entries.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        const isCurrent = entry.username === currentUsername;
        if (isCurrent) tr.classList.add('current-player');
        tr.style.animationDelay = `${idx * 0.05}s`;

        const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

        tr.innerHTML = `
            <td>${rankEmoji}</td>
            <td style="${isCurrent ? 'color:#ffd700;font-weight:700;' : ''}">${escapeHtml(entry.username)}</td>
            <td>${entry.score.toLocaleString()}</td>
            <td>${entry.level || 1}</td>
            <td>${entry.round || 1}</td>
        `;
        tbodyEl.appendChild(tr);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
