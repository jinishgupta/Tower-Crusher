# Demolition Drive

> A fast-paced 3D demolition action game built with Three.js and Vite for **Vibe Jam 2026**.

Pilot a heavy construction crane to demolish massive, procedurally-generated towers using a fully rigid-body physics wrecking ball! Race against the clock to score points, build massive combos, and climb the global leaderboard.

## 🎮 Play Locally

Since the game uses Vite to securely handle Supabase environment variables, you need to configure your local environment and run it via Node.js:

1. Create your environment file by copying the example:
   ```bash
   cp .env.example .env
   ```
   *(Be sure to fill in your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the new `.env` file)*
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the provided `localhost` URL in your browser.

## 🕹️ Controls

| Input | Action |
|-------|--------|
| **WASD / Arrow Keys** | Drive the Crane |
| **Mouse** | Look around (Pointer Lock) |
| **Left Click** | Swing Wrecking Ball towards target |
| **Right Click / E** | Turbo Boost Swing (High Impact, Cooldown) |
| **Q** | Gravity Slam / Drop (Vertical Impact, Cooldown) |
| **Shift** | Sprint Drive |
| **Tab** | Toggle Global Leaderboard |
| **F** | Interact / Enter Portals |

## 🏗️ Tower Types & Physics

Towers are procedurally generated and grow taller each round. They feature **Structural Support Checking**, meaning if you knock out the supporting blocks below a structure, the entire upper section will realistically cascade and collapse!

| Material | Resilience | Score Bonus |
|----------|------------|-------------|
| 🪵 Wooden | Low | 1.0x |
| 🪨 Stone | Medium | 1.5x |
| ⚙️ Steel | High | 2.0x |
| 💎 Crystal | Low (Shatters instantly) | 3.0x |
| 👹 BOSS | Very High | 4.0x |

## ✨ Features

- **Directional Pendulum Physics** — Wrecking ball momentum accurately follows your camera and crane movement.
- **Cascading Collapses** — Custom AABB physics engine handles structural integrity checks for realistic, chaotic building falls.
- **Global Leaderboard** — Persistent high scores using **Supabase** via Vite environment variables.
- **Combo System** — Chain destruction rapidly to build massive multipliers.
- **Procedural Audio** — High-impact crunch and collapse sounds generated dynamically via the Web Audio API.

## 🌀 Vibe Jam 2026 Webring

This game natively supports the Vibe Jam 2026 Portal Specification:
- **Instant Load**: Passing `?portal=true` instantly locks the player into the game physics with no start screens.
- **Exit Portal**: A purple portal exists in the arena. Pressing `F` teleports the player to `vibejam.cc/portal/2026` forwarding all states (`username`, `ref`, etc.).
- **Return Portal**: If a player enters this game via another game's portal, a blue return portal spawns, allowing them to bounce straight back to the `?ref=` domain!

## 📦 Tech Stack

- **Three.js** r162
- **Vite** (for fast bundling and `.env` parsing)
- **Supabase** JS Client (Global Leaderboard)
- **Custom Physics** Engine (AABB + Support Logic)
- **Vanilla JS/HTML/CSS** (No heavy component frameworks)

## 🚀 Deployment

Deployment is simple and natively supported by **Vercel**:
1. Push your codebase to GitHub.
2. Import the repository into Vercel.
3. Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` environment variables in the dashboard.
4. Deploy! Vite will automatically build the static bundle.

## License

MIT — Built for Vibe Jam 2026
