# Tower Destroyer

> A fast-paced 3D tower destruction game built with Three.js for **Vibe Jam 2026**.

## 🎮 Play

Open `index.html` in a browser, or deploy to any static host (Vercel, Netlify, GitHub Pages).

No build step. No npm install. Just open and play.

## 🕹️ Controls

| Key | Action |
|-----|--------|
| **WASD / Arrow Keys** | Move |
| **Mouse** | Look around (pointer lock) |
| **Left Click** | Fire energy projectile |
| **Right Click / E** | Shockwave (AOE explosion, 5s cooldown) |
| **Space** | Jump |
| **Shift** | Sprint |
| **Q** | Gravity Slam (massive AOE, 10s cooldown) |
| **Tab** | Toggle Leaderboard |

## 🏗️ Tower Types

| Type | Material | HP/Block | Score Bonus |
|------|----------|----------|-------------|
| 🪵 Wooden | Low | 1 | 1.0x |
| 🪨 Stone | Medium | 2 | 1.5x |
| ⚙️ Steel | High | 3 | 2.0x |
| 💎 Crystal | Low (shatters) | 1 | 3.0x |
| 👹 BOSS | Very High | 4 | 2.5x |

Towers cycle through these types each round, growing taller and wider.

## ✨ Features

- **Destructible Physics Towers** — blocks fly, fall, and chain-react
- **Combo System** — consecutive hits build multiplier (up to 10x)
- **Streak Bonuses** — ON FIRE (5+), UNSTOPPABLE (10+), LEGENDARY (20+)
- **XP & Leveling** — level 1–50 progression
- **3-Star Rating** — per round based on speed
- **Local Leaderboard** — persisted in localStorage
- **Procedural Audio** — all sounds generated via Web Audio API
- **Cyberpunk Aesthetic** — neon grid arena, star skybox, city silhouettes

## 🌀 Vibe Jam 2026 Portal

- **Exit Portal**: Always visible in the arena — walk into it to travel to vibejam.cc
- **Return Portal**: Appears when arriving via `?portal=true&ref=DOMAIN`
- Portal params: `username`, `color`, `speed`, `ref`, `hp`, `score`
- `?portal=true` skips the start screen entirely

## 📦 Tech Stack

- **Three.js** r162 (CDN, ESM import map)
- **Custom physics** engine (AABB collision, gravity, impulse)
- **Web Audio API** (procedural sounds)
- **Vanilla JS/HTML/CSS** — zero build tools, zero npm

## 🚀 Deployment

This is a pure static site. Deploy the entire folder to:
- **Vercel**: `vercel --prod`
- **Netlify**: drag & drop the folder
- **GitHub Pages**: push to `gh-pages` branch

Total page weight: ~80KB (excluding Three.js CDN).

## 📁 File Structure

```
├── index.html          # Entry point
├── style.css           # Cyberpunk UI styling
├── js/
│   ├── main.js         # Init + game loop
│   ├── game.js         # State machine, rounds, scoring
│   ├── player.js       # Movement, abilities, projectiles
│   ├── tower.js        # Procedural tower generation
│   ├── physics.js      # Custom physics engine
│   ├── environment.js  # Arena, skybox, city, lighting
│   ├── portal.js       # Vibe Jam portals
│   ├── ui.js           # HUD updates, effects
│   ├── audio.js        # Procedural Web Audio sounds
│   ├── leaderboard.js  # localStorage leaderboard
│   └── particles.js    # Pooled particle effects
└── README.md
```

## License

MIT — Built for Vibe Jam 2026
