# AGENTS.md

IRONSIGHT is a single-page browser FPS. The React app gives you a loadout menu and HUD; the game itself is an imperative Three.js engine in `src/game/`.

## Architecture

```
src/
├── routes/index.tsx                 # Switches between LoadoutScreen and GameView
├── routes/__root.tsx                # HTML shell, site title/description, Google Fonts
├── components/game/
│   ├── LoadoutScreen.tsx            # Class / weapon / arena / difficulty picker + Controls list
│   ├── GameView.tsx                 # Mounts the engine (dynamic import), start/pause/death/victory overlays
│   └── Hud.tsx                      # Crosshair, scope, hit markers, health, ammo, skills, wave info
├── game/
│   ├── data.ts                      # ALL balance data: weapons, skills, player classes, enemy classes, difficulties, arenas (ASCII maps + waves)
│   ├── types.ts                     # HudState pushed from engine to React
│   ├── engine.ts                    # Game class: loop, input, player, weapons, skills, enemy AI, projectiles, pickups, waves
│   ├── world.ts                     # Builds arena geometry from the ASCII map; collision (moveBody), LOS, A* pathfinding, weather
│   ├── models.ts                    # Procedural gun viewmodels, enemy soldier models, sprite textures
│   └── sfx.ts                       # WebAudio-synthesized sound effects
public/img/hero.png                  # Menu key art (always reference via /.netlify/images?url=/img/hero.png&w=…&fm=webp)
```

## Key decisions

- **Engine is not React.** `Game` owns the WebGL renderer and runs its own `requestAnimationFrame` loop. React only receives a `HudState` snapshot ~20×/s via the `onHud` callback. Don't move per-frame state into React.
- **Engine is loaded with a dynamic `import()` inside `useEffect`** so it never runs during SSR.
- **Two render passes**: world scene, then `clearDepth()`, then the viewmodel scene with a fixed camera so guns never clip into walls. Scoped weapons hide the viewmodel and the HUD draws the scope.
- **Arenas are ASCII grids** in `data.ts` (`#` wall, `C` tall crate, `c` low crate, `o` pillar, `P` player spawn, `E` enemy spawn, `H` health pack). Every row in a map must be the same length and there must be exactly one `P`. Cell size is `CELL = 3` world units.
- **Collision** is axis-separated AABB against `world.colliders`; vision uses a grid sample (`hasLineOfSight`) that ignores low crates; bullets use Three.js raycasts against `world.solids` and enemy hit parts (`userData.part = 'head' | 'body'`).
- **Headshots** (`part === 'head'`, any non-explosive source) set damage to Infinity.
- **Enemy hit chance is probabilistic** (accuracy × difficulty × distance × player movement), but a real raycast still checks for cover before the roll.
- **Lights are pooled.** Adding/removing lights at runtime recompiles every material; explosions reuse a single PointLight.
- ADS zoom uses a proper tangent-based FOV (`zoomFov`); mouse sensitivity scales down with zoom.

## Conventions

- TypeScript strict, no unused locals/params. Import from `src` with `@/`.
- Balance changes belong in `data.ts`, not the engine.
- Use theme variables (`bg-card`, `text-primary`…) in menu UI; the HUD intentionally uses raw white/black for legibility over the 3D scene.
- Fonts: `font-display` = Chakra Petch (headings/HUD), body = Barlow.
