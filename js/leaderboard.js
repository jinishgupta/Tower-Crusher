// leaderboard.js — Supabase-backed leaderboard
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabase = null;
let panelEl = null;
let tbodyEl = null;
let isOpen = false;
let currentUsername = '';

function initSupabase() {
    if (supabase) return;
    if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('⚠️ Supabase not configured. Leaderboard will be local-only.');
        return;
    }
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase connected');
    } catch (err) {
        console.warn('Supabase init failed:', err);
    }
}

export function initLeaderboard(username) {
    currentUsername = username;
    panelEl = document.getElementById('leaderboard-panel');
    tbodyEl = document.getElementById('lb-tbody');

    initSupabase();

    document.getElementById('leaderboard-btn').addEventListener('click', toggleLeaderboard);
    document.getElementById('lb-close-btn').addEventListener('click', () => hideLeaderboard());
}

export function toggleLeaderboard() {
    if (isOpen) hideLeaderboard();
    else showLeaderboard();
}

export function showLeaderboard() {
    if (!panelEl) return;
    fetchAndRender();
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

function rankValue(entry) {
    return (entry.stars || 0) * 500 + (entry.score || 0);
}

// Save score to Supabase (upsert — updates if rank value improves)
export async function saveScore(username, score, stars, round) {
    const entry = {
        username: String(username).slice(0, 16),
        score: Math.round(score),
        stars: Math.max(0, Math.round(stars || 0)),
        round: round || 1,
        updated_at: new Date().toISOString()
    };

    // Always save to localStorage as backup
    saveToLocal(entry);

    if (!supabase) return;

    try {
        const { error: upsertErr } = await supabase
            .from('scores')
            .upsert(entry, { onConflict: 'username' });

        if (upsertErr) throw upsertErr;
    } catch (err) {
        console.warn('Could not save score/stars to Supabase:', err);
    }
}

// Fetch leaderboard from Supabase and render
async function fetchAndRender() {
    if (!tbodyEl) return;

    tbodyEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6a6a8a;padding:20px;">Loading...</td></tr>';

    let entries = [];

    if (supabase) {
        try {
            const withStars = await supabase
                .from('scores')
                .select('username, score, stars, round')
                .order('stars', { ascending: false })
                .order('score', { ascending: false })
                .limit(20);

            if (!withStars.error && withStars.data) {
                entries = withStars.data;
            }
        } catch (err) {
            console.warn('Could not fetch leaderboard from Supabase:', err);
        }
    }

    // Fallback to localStorage if Supabase returned nothing
    if (entries.length === 0) {
        entries = getFromLocal();
    }

    renderEntries(entries);
}

function renderEntries(entries) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    if (!entries || entries.length === 0) {
        tbodyEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6a6a8a;padding:20px;">No scores yet. Start demolishing!</td></tr>';
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
            <td>${Math.round(entry.score || 0).toLocaleString()}</td>
            <td>${Math.max(0, Math.round(entry.stars || 0))}</td>
            <td>${entry.round || 1}</td>
        `;
        tbodyEl.appendChild(tr);
    });
}

// ---- localStorage fallback ----
const STORAGE_KEY = 'tower_destroyer_leaderboard';

function saveToLocal(entry) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const existing = data.find(e => e.username === entry.username);
        if (existing) {
            existing.score = entry.score;
            existing.stars = entry.stars;
            existing.round = entry.round;
            existing.updated_at = entry.updated_at;
        } else {
            data.push(entry);
        }
        data.sort((a, b) => rankValue(b) - rankValue(a));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(0, 50)));
    } catch { /* storage full */ }
}

function getFromLocal() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').slice(0, 20);
    } catch { return []; }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
