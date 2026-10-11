# Void Skimmer

A 3D endless space survival arcade game built with TypeScript, Three.js, Vite, and React.

## Description

Pilot your spacecraft through increasingly dangerous meteor fields. Skim dangerously close to rocks to build combos, charge boosts, and survive as long as possible while chasing your best score.

**Core Rule:** Flying safe is survivable, but flying close is rewarding.

## Controls

### Desktop
- **Mouse**: Move to steer the ship
- **WASD / Arrow Keys**: Alternative steering
- **Escape / P**: Pause

### Mobile
- **Touch & Drag**: Steer the ship by touching and dragging anywhere on screen

## How to Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Features

### Core Gameplay
- 3D endless forward flight through meteor fields
- Smooth pointer/touch/keyboard steering with ship banking
- Procedural meteor spawning with multiple pattern types (single, cluster, gap, wall, diagonal)
- Object pooling for meteors, pickups, particles, and floating text
- Near-miss skimming rewards (score, combo, boost)
- Gap skip bonuses for flying through narrow formations
- Surface graze with spark effects and score ticks
- Shield system with invulnerability frames
- Auto-activating boost meter
- Progressive difficulty over time
- Combo/multiplier system (up to x10)

### Progression
- Stardust currency earned from runs
- 6 upgrades (shields, magnet, boost, handling, score, graze)
- 3 unlockable ships with different handling characteristics
- 6 missions/achievements to complete
- Daily challenge mode with fixed seed
- Local best score tracking

### Polish
- Engine trail effect
- Spark particles on graze
- Explosion on death
- Screen shake on impacts
- Slow-motion on death
- Floating score text
- Procedural audio (WebAudio API)
- Clean responsive HUD
- Smooth camera follow with FOV changes during boost

### Technical
- Full TypeScript with strict mode
- Object pooling (no runtime allocations)
- Seeded RNG for daily challenges
- localStorage persistence with corruption handling
- WebGL fallback error message
- Tab visibility pause
- Responsive resize handling
- Mobile-optimized touch controls
- Safe area support

## Tuning Constants

All gameplay balance values are in `src/core.ts` under the `C` (Constants) object:

```typescript
playerRadius: 0.45
corridorX: [-5.0, 5.0]
corridorY: [-3.2, 3.2]
baseSpeed: 18
maxSpeed: 52
nearMissScore: 50
gapSkipScore: 150
boostMax: 100
// ... and more
```

## Project Structure

```
src/
  App.tsx          - React UI (menus, HUD, game over, upgrades, hangar, missions)
  game.ts          - Main game orchestrator
  core.ts          - Constants, event bus, save system, seeded RNG, game state
  systems.ts       - Input, spawn, collision, camera, effects systems
  entities.ts      - Player, meteor pool, pickup pool, particles, trail
  audio.ts         - Procedural WebAudio sound effects
  utils.ts         - Math utilities (clamp, lerp, distance, format)
  main.tsx         - Entry point
  index.css        - Global styles + Tailwind
```

## Known Limitations

- No online features (leaderboards, accounts, cloud saves)
- No complex physics (uses simple sphere collision)
- No external 3D models (all procedural geometry)
- No post-processing effects (performance priority)
- Bundle size ~735KB (due to Three.js)
- Daily challenge is locally validated only (no server)

## Tech Stack

- **TypeScript** - Type-safe game code
- **Three.js** - 3D rendering
- **Vite** - Build tool
- **React** - UI overlays
- **Tailwind CSS** - UI styling
- **WebAudio API** - Procedural sound effects
- **localStorage** - Save data persistence
