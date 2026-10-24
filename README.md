# IRONSIGHT — Arena FPS

A first-person shooter that runs in the browser. Pick a class, a starting weapon, an arena and a difficulty, then survive three waves of enemies who hunt you down, shoot back and drop their guns when they fall.

## Features

- **Four player classes**, each with its own health, speed, weapon pool and skills
  - **Ninja** — grappling hook (Q), Shadow Veil invisibility (F), shuriken with heavy bonus damage (G); starts with the Kage Blade katana, Vector-K SMG or Sentinel DMR
  - **Assault** — frag grenade (Q), Adrenaline heal + speed (F)
  - **Heavy** — shoulder rocket (Q), Iron Wall damage reduction (F)
  - **Recon** — Recon Pulse wall-hack (Q), Deadeye Focus slow-motion (F)
- **Nine weapons** (pistol, revolver, SMG, assault rifle, shotgun, DMR, sniper, LMG, katana), each with its own damage, fire rate, spread, recoil and **aim-down-sights magnification** (×1.15 pistol up to ×4.5 scoped sniper)
- **Six enemy classes** — Rifleman, Breacher, Marksman (with a laser sight that warns you), Gunner, Officer and Striker — each carrying a different weapon you can pick up with **E**
- **Enemy AI** that patrols, spots you with a vision cone and line of sight, reacts when shot or when it hears gunfire, calls nearby allies, chases with A* pathfinding, strafes and keeps its preferred range
- **Headshots kill instantly**; body shots do weapon damage
- **Four arenas** — Dockside Warehouse, Desert Outpost, Neon District and Frozen Bunker — with their own layouts, lighting, fog and weather
- **Four difficulties** — Recruit, Veteran, Elite, Nightmare — tuning enemy health, damage, accuracy, reaction time, numbers and health regen
- Health packs, ammo top-ups from dropped weapons, kill feed, hit markers, damage direction indicators, score and end-of-match stats

## Controls

| Key | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Left mouse | Fire |
| Right mouse | Aim down sights |
| Shift | Sprint |
| Space | Jump (or release the grappling hook) |
| C | Crouch |
| R | Reload |
| 1 / 2 / wheel | Switch weapon |
| E | Swap for a dropped weapon |
| Q / F / G | Class skills |
| Esc | Pause |

A keyboard and mouse are required.

## Tech

- [TanStack Start](https://tanstack.com/start) + React 19 for the app shell, menus and HUD
- [Three.js](https://threejs.org) for rendering, with a hand-written game loop, AABB collision, grid line-of-sight and A* pathfinding
- WebAudio for synthesized sound effects (no audio files)
- Tailwind CSS 4 and shadcn/ui components
- Deployed on Netlify; the menu key art is served through the Netlify Image CDN

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
# or, with Netlify emulation:
netlify dev
```

## Ideas for what's next

- Online leaderboard for best scores per arena and difficulty
- More arenas and an endless survival mode
- Gamepad and touch controls
- Settings screen for mouse sensitivity, FOV and volume
