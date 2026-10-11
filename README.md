# Void Skimmer

A high-speed 3D arcade space survival game built with TypeScript, Three.js, React, and Vite.

## 🎮 Game Overview

Pilot your spacecraft through increasingly dangerous meteor fields. Skim dangerously close to rocks to build combos, charge boosts, and survive as long as possible while chasing your best score.

**Core Rule:** Flying safe is survivable, but flying close is rewarding.

## ✨ Features

### Core Gameplay
- **3D Endless Flight**: Automatically fly forward through space
- **Precision Steering**: Smooth pointer/touch/keyboard controls with ship banking
- **Procedural Meteors**: Multiple pattern types (single, cluster, gap, wall, diagonal)
- **Object Pooling**: Efficient memory management for meteors, pickups, and particles
- **Skimming Mechanics**: Near-miss rewards, gap skips, surface grazing
- **Shield System**: Multiple shields with invulnerability frames
- **Auto-Boost**: Boost meter charges from skill actions
- **Progressive Difficulty**: Speed and density increase over time
- **Combo/Multiplier**: Up to x10 multiplier for chaining skills
- **Overdrive Mode**: Enter flow state at high combos for bonus effects

### Visual Polish
- **Detailed 3D Models**: Multi-part player ship, varied meteor types, animated pickups
- **Dynamic Camera**: FOV changes based on speed, combo, and boost
- **Screen Shake**: Impactful feedback on collisions and boosts
- **Hit Stop**: Brief dramatic pause on near-misses
- **Particle Effects**: Sparks, explosions, engine trails
- **Floating Text**: Score popups and combo notifications
- **Post-Processing**: Bloom, FXAA, color grading (auto-adjusted for device)
- **Atmospheric Background**: Ringed planet, nebula clouds, asteroid belt
- **Parallax Depth**: Multiple background layers for sense of scale

### Progression System
- **Stardust Currency**: Earned from runs and missions
- **6 Upgrades**: Shields, magnet range, boost duration, handling, score bonus, graze reward
- **3 Unlockable Ships**: Each with unique traits and visual style
- **6 Missions**: Achievements to complete for bonus stardust
- **Daily Challenge**: Fixed-seed runs for competitive play
- **Local Persistence**: All progress saved to localStorage

### Technical Excellence
- **Swept Collision Detection**: Prevents tunneling at high speeds
- **Pacing Wave System**: BREATHE → BUILD → INTENSE → CHAOS rhythm
- **Mercy Window**: Reduced density after shield loss for fair recovery
- **Weighted Random Spawning**: Prevents repetitive patterns
- **Mobile Optimized**: Touch controls, responsive UI, performance presets
- **Procedural Audio**: WebAudio API sound effects
- **Seeded RNG**: Reproducible daily challenges
- **Event Bus Architecture**: Clean separation of game logic and UI

## 🎯 Controls

### Desktop
- **Mouse**: Move to steer the ship
- **WASD / Arrow Keys**: Alternative steering
- **Escape / P**: Pause

### Mobile
- **Touch & Drag**: Steer by touching and dragging anywhere on screen

## 🚀 How to Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
void-skimmer/
├── src/
│   ├── App.tsx              # React UI (menus, HUD, game over, upgrades)
│   ├── game.ts              # Main game orchestrator
│   ├── core.ts              # Constants, event bus, save system, game state
│   ├── systems.ts           # Input, spawn, collision, camera, effects
│   ├── entities.ts          # Player, meteor pool, pickup pool, particles
│   ├── audio.ts             # Procedural WebAudio sound effects
│   ├── utils.ts             # Math utilities
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles + Tailwind
│   ├── entities/
│   │   ├── playerShip.ts    # Detailed multi-part player ship model
│   │   ├── meteorModels.ts  # 4 varied meteor types (jagged, rounded, elongated, crystal)
│   │   ├── pickupModels.ts  # Animated crystalline pickup gems
│   │   └── backgroundModels.ts  # Planet, nebula, asteroid belt
│   ├── effects/
│   │   └── postProcessing.ts  # Bloom, FXAA, color grading
│   └── loaders/
│       └── objLoader.ts     # OBJ model loader utility
├── public/
│   ├── models/              # OBJ model files
│   └── favicon.svg
└── README.md
```

## 🎨 Visual Systems

### Player Ship
- Multi-part angular fighter with swept-back delta wings
- Glowing cockpit canopy with pulsing emissive material
- Twin engine nacelles with animated exhaust cones
- Neon wing edge lights
- Dynamic engine glow that intensifies with speed and boost
- Overdrive mode changes ship color to gold

### Meteor Types
1. **Jagged**: Spiky icosahedron with vertex displacement
2. **Rounded**: Smooth sphere with crater indentations
3. **Elongated**: Stretched dodecahedron with orbiting debris
4. **Crystal**: Rare glowing formation (10% spawn chance)

### Pickup Types
- **Stardust** (gold): Common currency
- **Shield** (green): Defensive pickup
- **Boost** (orange): Speed boost
- **Multiplier** (purple): Score multiplier

### Background
- Distant ringed planet with atmosphere glow
- Layered nebula clouds with procedural textures
- Asteroid belt using InstancedMesh for performance
- Exponential fog for depth

## ⚙️ Game Systems

### Collision System
- **Swept Sphere Collision**: Prevents tunneling at high speeds
- **Z-Axis Filtering**: Only checks collisions when meteors are near player depth
- **Multi-Layer Detection**: Core (deadly), Graze (dangerous), Near-Miss (reward)
- **Overdrive Breaking**: Destroy small meteors during overdrive (ship-dependent)

### Spawn System
- **Pacing Waves**: BREATHE → BUILD → INTENSE → CHAOS cycle
- **Mercy Window**: 2.5s reduced density after shield loss
- **Weighted Random**: Prevents repetitive patterns
- **Pattern Types**: Single, cluster, gap, wall, diagonal
- **Movement Types**: Static, drift, oscillate

### Scoring System
- Distance score (passive)
- Near-miss: 50 × multiplier
- Gap skip: 150 × multiplier
- Graze tick: 5 × multiplier
- Pickup: 25 × multiplier
- Streak bonus: 100 × multiplier every 10s
- Overdrive bonus: Ship-dependent multiplier

### Difficulty Progression
- Base speed: 28 → Max speed: 80
- Acceleration: 0.5 units/sec²
- Spawn interval: 0.55s → 0.14s (minimum)
- Meteor pool: 200 objects
- Moving meteor chance increases over time

## 🎯 Balance Constants

All gameplay values are in `src/core.ts`:

```typescript
playerRadius: 0.45
corridorX: [-5.0, 5.0]
corridorY: [-3.2, 3.2]
baseSpeed: 28
maxSpeed: 80
nearMissMultiplier: 2.2
grazeThickness: 0.6
startingShields: 2
boostMax: 100
boostDuration: 2.5
boostSpeedMult: 1.4
```

## 🏆 Ships

### Starter Skimmer (Free)
- Balanced handling (1.0x)
- Cyan color scheme
- Standard overdrive bonus (1.0x)

### Comet Wing (500 stardust)
- Softer handling (0.85x)
- Orange/red color scheme
- **Can break small meteors in overdrive**
- +50% overdrive score bonus

### Void Razor (1200 stardust)
- Sharper handling (1.2x)
- Purple/pink color scheme
- **Larger skim zone (1.5x radius)**
- +100% overdrive score bonus

## 🔧 Upgrades

1. **Shield Capacity**: Start with more shields (max 3)
2. **Magnet Range**: Increase shard attraction radius
3. **Boost Duration**: Longer boost activation
4. **Handling**: Faster steering response
5. **Score Core**: Percentage bonus to all score
6. **Graze Stabilizer**: Increased graze rewards

## 📊 Performance

### Targets
- 60 FPS on desktop
- Playable on mid-range mobile
- No major frame drops during intense gameplay

### Optimizations
- Object pooling (meteors, pickups, particles)
- Texture caching for floating text
- InstancedMesh for asteroid belt
- Clamped pixel ratio (max 2x)
- Exponential fog to hide spawn/despawn
- Post-processing auto-disabled on mobile
- Tab visibility pause

### Build Size
- ~811 KB JavaScript (217 KB gzipped)
- ~25 KB CSS (5 KB gzipped)

## 🐛 Known Limitations

- No online features (leaderboards, accounts, cloud saves)
- No complex physics (uses simplified sphere collision)
- No external 3D model loading in production (procedural only)
- Post-processing may be disabled on low-end devices
- Daily challenge is locally validated only

## 🎓 Development Notes

### Architecture
- **Event Bus**: Decouples game logic from UI
- **Entity Component**: Clear separation of concerns
- **Object Pooling**: Prevents GC stutter
- **State Machine**: Explicit game state transitions
- **Seeded RNG**: Reproducible daily challenges

### Code Quality
- TypeScript strict mode
- ES modules
- No `any` types (except event callbacks)
- Meaningful names
- No dead code
- Comprehensive error handling

## 📝 License

MIT License - feel free to use this code for your own projects!

## 🙏 Credits

Built with:
- [Three.js](https://threejs.org/) - 3D rendering
- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- WebAudio API - Procedural sound

---

**Enjoy the void! 🚀**
