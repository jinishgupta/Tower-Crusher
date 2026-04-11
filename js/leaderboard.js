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

// Save score to Supabase (upsert — only update if new score is higher)
export async function saveScore(username, score, level, round) {
    const entry = {
        username: String(username).slice(0, 16),
        score: Math.round(score),
        round: round || 1,
        updated_at: new Date().toISOString()
    };

    // Always save to localStorage as backup
    saveToLocal(entry);

    if (!supabase) return;

    try {
        // Check if user exists
        const { data: existing } = await supabase
            .from('scores')
            .select('score')
            .eq('username', entry.username)
            .single();

        if (existing) {
            // Only update if new score is higher
            if (entry.score > existing.score) {
                await supabase
                    .from('scores')
                    .update({ score: entry.score, round: entry.round, updated_at: entry.updated_at })
                    .eq('username', entry.username);
            }
        } else {
            // Insert new entry
            await supabase
                .from('scores')
                .insert(entry);
        }
    } catch (err) {
        console.warn('Could not save score to Supabase:', err);
    }
}

// Fetch leaderboard from Supabase and render
async function fetchAndRender() {
    if (!tbodyEl) return;

    tbodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6a6a8a;padding:20px;">Loading...</td></tr>';

    let entries = [];

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('username, score, round')
                .order('score', { ascending: false })
                .limit(20);

            if (!error && data) {
                entries = data;
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
        tbodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6a6a8a;padding:20px;">No scores yet. Start demolishing!</td></tr>';
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
            if (entry.score > existing.score) {
                existing.score = entry.score;
                existing.round = entry.round;
            }
        } else {
            data.push(entry);
        }
        data.sort((a, b) => b.score - a.score);
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
