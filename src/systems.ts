import * as THREE from 'three';
import { C, eventBus, SeededRandom, PACING_PHASES, MERCY_WINDOW_DURATION, type PacingPhase, type PatternType } from './core';
import { Player, MeteorData, MeteorPool, PickupPool, ParticlePool, FloatingTextPool, initMeteor, updateMeteor } from './entities';
import { clamp, lerp, dist2D, randRange } from './utils';
import { Audio } from './audio';

// ============ INPUT SYSTEM ============
export class InputSystem {
  targetX = 0;
  targetY = 0;
  private pointerActive = false;
  private keyState: Record<string, boolean> = {};
  private canvas: HTMLCanvasElement;
  private keyboardSpeed = 8;
  private corridorW = C.corridorX[1] - C.corridorX[0];
  private corridorH = C.corridorY[1] - C.corridorY[0];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  private bindEvents() {
    // Pointer events handle BOTH mouse and touch automatically
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerActive = true;
      this.updatePointerTarget(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      // If dragging (touch) or just moving (mouse)
      if (this.pointerActive || e.pointerType === 'mouse') {
        this.updatePointerTarget(e);
      }
    });
    this.canvas.addEventListener('pointerup', () => { this.pointerActive = false; });
    this.canvas.addEventListener('pointercancel', () => { this.pointerActive = false; });
    this.canvas.addEventListener('pointerleave', () => { this.pointerActive = false; });

    // Keyboard
    window.addEventListener('keydown', (e) => { this.keyState[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keyState[e.key.toLowerCase()] = false; });
  }

  private updatePointerTarget(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.targetX = nx * (this.corridorW / 2);
    this.targetY = ny * (this.corridorH / 2);
  }

  update(dt: number) {
    let kx = 0, ky = 0;
    if (this.keyState['a'] || this.keyState['arrowleft']) kx -= 1;
    if (this.keyState['d'] || this.keyState['arrowright']) kx += 1;
    if (this.keyState['w'] || this.keyState['arrowup']) ky += 1;
    if (this.keyState['s'] || this.keyState['arrowdown']) ky -= 1;

    if (kx !== 0 || ky !== 0) {
      this.targetX = clamp(this.targetX + kx * this.keyboardSpeed * dt, C.corridorX[0], C.corridorX[1]);
      this.targetY = clamp(this.targetY + ky * this.keyboardSpeed * dt, C.corridorY[0], C.corridorY[1]);
    }
  }

  isPausePressed(): boolean {
    return !!this.keyState['escape'] || !!this.keyState['p'];
  }

  consumePause() {
    this.keyState['escape'] = false;
    this.keyState['p'] = false;
  }
}

// ============ SPAWN SYSTEM ============
export class SpawnSystem {
  private meteorPool: MeteorPool;
  private pickupPool: PickupPool;
  private rng: SeededRandom;
  private spawnTimer = 0;
  private pickupTimer = 0;

  // Pacing wave system
  private phaseIndex = 0;
  private phaseElapsed = 0;
  private currentPhase: PacingPhase = 'BREATHE';

  // Mercy window
  private mercyWindowEnd = 0;

  // Weighted random with memory
  private lastPattern: PatternType = 'single';

  constructor(meteorPool: MeteorPool, pickupPool: PickupPool, seed?: number) {
    this.meteorPool = meteorPool;
    this.pickupPool = pickupPool;
    this.rng = new SeededRandom(seed || Math.floor(Math.random() * 999999));
  }

  reset(seed?: number) {
    this.spawnTimer = 0;
    this.pickupTimer = 0;
    this.rng = new SeededRandom(seed || Math.floor(Math.random() * 999999));
    this.phaseIndex = 0;
    this.phaseElapsed = 0;
    this.currentPhase = 'BREATHE';
    this.mercyWindowEnd = 0;
    this.lastPattern = 'single';
  }

  triggerMercyWindow() {
    this.mercyWindowEnd = performance.now() / 1000 + MERCY_WINDOW_DURATION;
  }

  private isInMercyWindow(): boolean {
    return (performance.now() / 1000) < this.mercyWindowEnd;
  }

  spawnInitialMeteors() {
    // Pre-populate meteors ahead of the player for immediate action
    const spawnZ = C.spawnZ;
    
    // Spawn several waves at different Z positions
    for (let wave = 0; wave < 8; wave++) {
      const z = spawnZ + wave * 15; // Spread meteors from far to near
      
      // Alternate between patterns for variety
      if (wave % 3 === 0) {
        this.spawnSingle(z, 0, 0.1);
      } else if (wave % 3 === 1) {
        this.spawnCluster(z, 0, 0.2);
      } else {
        this.spawnSingle(z, 0, 0.15);
        this.spawnSingle(z - 5, 0, 0.15);
      }
    }
  }

  update(dt: number, speed: number, elapsed: number) {
    // Update pacing phase
    this.phaseElapsed += dt;
    const currentConfig = PACING_PHASES[this.phaseIndex];
    if (this.phaseElapsed >= currentConfig.duration) {
      this.phaseElapsed = 0;
      this.phaseIndex = (this.phaseIndex + 1) % PACING_PHASES.length;
      const newPhase = PACING_PHASES[this.phaseIndex].phase;
      if (newPhase !== this.currentPhase) {
        this.currentPhase = newPhase;
        eventBus.emit('phaseChanged', newPhase);
      }
    }

    // Apply pacing + mercy window density
    const phaseConfig = PACING_PHASES[this.phaseIndex];
    let densityMult = phaseConfig.densityMultiplier;
    if (this.isInMercyWindow()) {
      densityMult *= 0.3; // Mercy window reduces density
    }

    // Smooth spawn interval based on elapsed time + pacing
    const baseInterval = clamp(0.55 - elapsed * 0.003, 0.18, 0.55);
    const spawnInterval = baseInterval / densityMult;

    this.spawnTimer += dt;
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnPattern(elapsed, speed);
    }

    // Pickup spawning - more frequent during BREATHE phase
    const pickupInterval = this.currentPhase === 'BREATHE' ? 0.7 : 1.2;
    this.pickupTimer += dt;
    if (this.pickupTimer >= pickupInterval) {
      this.pickupTimer = 0;
      this.spawnPickup();
    }
  }

  private spawnPattern(elapsed: number, speed: number) {
    const difficulty = clamp(elapsed / 120, 0, 1);
    const pattern = this.choosePattern(difficulty);
    const spawnZ = C.spawnZ;
    const moveSpeed = speed;

    switch (pattern) {
      case 'single':
        this.spawnSingle(spawnZ, moveSpeed, difficulty);
        break;
      case 'cluster':
        this.spawnCluster(spawnZ, moveSpeed, difficulty);
        break;
      case 'gap':
        this.spawnGap(spawnZ, moveSpeed, difficulty);
        break;
      case 'wall':
        this.spawnWall(spawnZ, moveSpeed, difficulty);
        break;
      case 'diagonal':
        this.spawnDiagonal(spawnZ, moveSpeed, difficulty);
        break;
    }
  }

  private choosePattern(_difficulty: number): PatternType {
    const phaseConfig = PACING_PHASES[this.phaseIndex];
    const allowed = phaseConfig.allowedPatterns;

    // During mercy window, only allow safe patterns
    if (this.isInMercyWindow()) {
      const mercyAllowed = allowed.filter(p => p === 'single' || p === 'gap');
      if (mercyAllowed.length > 0) {
        return mercyAllowed[Math.floor(this.rng.next() * mercyAllowed.length)];
      }
      return 'single';
    }

    // Weighted random with memory - avoid repeating same pattern
    const weights: Record<PatternType, number> = {
      single: 1,
      cluster: 1,
      gap: 1,
      wall: 1,
      diagonal: 1,
    };

    // Penalize the last pattern to encourage variety
    weights[this.lastPattern] *= 0.2;

    // Penalize intense patterns if last was also intense
    if (this.lastPattern === 'wall' || this.lastPattern === 'cluster') {
      weights.wall *= 0.5;
      weights.cluster *= 0.5;
      weights.gap *= 2.0; // Favor gaps after intense patterns
    }

    // Filter to allowed patterns only
    const totalWeight = allowed.reduce((sum, p) => sum + weights[p], 0);
    let roll = this.rng.next() * totalWeight;

    for (const pattern of allowed) {
      roll -= weights[pattern];
      if (roll <= 0) {
        this.lastPattern = pattern;
        return pattern;
      }
    }

    this.lastPattern = allowed[allowed.length - 1];
    return allowed[allowed.length - 1];
  }

  private getMovement(difficulty: number): 'static' | 'drift' | 'oscillate' {
    const movingChance = clamp((difficulty - 0.1) / 0.6, 0, 0.55);
    const r = this.rng.next();
    if (r < movingChance * 0.5) return 'drift';
    if (r < movingChance) return 'oscillate';
    return 'static';
  }

  private spawnSingle(z: number, _speed: number, difficulty: number) {
    const m = this.meteorPool.acquire();
    if (!m) return;
    const x = this.rng.range(C.corridorX[0] + 1, C.corridorX[1] - 1);
    const y = this.rng.range(C.corridorY[0] + 0.5, C.corridorY[1] - 0.5);
    const radius = this.rng.range(C.meteorRadiusMin, C.meteorRadiusMax * (0.5 + difficulty * 0.5));
    initMeteor(m, x, y, z, radius, this.getMovement(difficulty), difficulty);
  }

  private spawnCluster(z: number, _speed: number, difficulty: number) {
    const count = 3 + Math.floor(this.rng.next() * 4);
    const cx = this.rng.range(-2, 2);
    const cy = this.rng.range(-1.5, 1.5);
    for (let i = 0; i < count; i++) {
      const m = this.meteorPool.acquire();
      if (!m) break;
      const angle = (i / count) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const dist = this.rng.range(1.2, 2.8);
      const x = clamp(cx + Math.cos(angle) * dist, C.corridorX[0] + 1, C.corridorX[1] - 1);
      const y = clamp(cy + Math.sin(angle) * dist, C.corridorY[0] + 0.5, C.corridorY[1] - 0.5);
      const radius = this.rng.range(C.meteorRadiusMin, C.meteorRadiusMax * 0.7);
      initMeteor(m, x, y, z + this.rng.range(-2, 2), radius, this.getMovement(difficulty), difficulty);
    }
  }

  private spawnGap(z: number, _speed: number, difficulty: number) {
    const gapX = this.rng.range(C.corridorX[0] + 2, C.corridorX[1] - 2);
    const gapY = this.rng.range(C.corridorY[0] + 1, C.corridorY[1] - 1);
    const gapWidth = C.safeGapWidth + this.rng.range(0, 1) * (1 - difficulty * 0.3);

    // Spawn meteors on both sides of the gap
    const sides = [
      { x: gapX - gapWidth - this.rng.range(0.5, 2), y: gapY + this.rng.range(-1, 1) },
      { x: gapX + gapWidth + this.rng.range(0.5, 2), y: gapY + this.rng.range(-1, 1) },
      { x: gapX + this.rng.range(-0.5, 0.5), y: gapY + gapWidth + this.rng.range(0.5, 1.5) },
      { x: gapX + this.rng.range(-0.5, 0.5), y: gapY - gapWidth - this.rng.range(0.5, 1.5) },
    ];

    for (const s of sides) {
      if (this.rng.next() < 0.7) {
        const m = this.meteorPool.acquire();
        if (!m) break;
        const x = clamp(s.x, C.corridorX[0] + 0.5, C.corridorX[1] - 0.5);
        const y = clamp(s.y, C.corridorY[0] + 0.5, C.corridorY[1] - 0.5);
        const radius = this.rng.range(C.meteorRadiusMin, C.meteorRadiusMax * 0.8);
        initMeteor(m, x, y, z, radius, 'static', difficulty);
      }
    }

    // Register gap trigger for immediate feedback when player passes through
    eventBus.emit('registerGapTrigger', z);
  }

  private spawnWall(z: number, _speed: number, difficulty: number) {
    const holeX = this.rng.range(C.corridorX[0] + 2, C.corridorX[1] - 2);
    const holeY = this.rng.range(C.corridorY[0] + 1, C.corridorY[1] - 1);
    const holeSize = C.safeGapWidth * 1.1;

    for (let x = C.corridorX[0] + 1; x <= C.corridorX[1] - 1; x += 2.0) {
      for (let y = C.corridorY[0] + 1; y <= C.corridorY[1] - 1; y += 2.0) {
        if (Math.abs(x - holeX) < holeSize && Math.abs(y - holeY) < holeSize) continue;
        const m = this.meteorPool.acquire();
        if (!m) break;

        // Add jitter to prevent overlapping and grid-looking walls
        const jitterX = this.rng.range(-0.6, 0.6);
        const jitterY = this.rng.range(-0.6, 0.6);
        const jitterZ = this.rng.range(-1.5, 1.5);

        const radius = this.rng.range(C.meteorRadiusMin, C.meteorRadiusMax * 0.6);
        initMeteor(m, x + jitterX, y + jitterY, z + jitterZ, radius, this.getMovement(difficulty), difficulty);
      }
    }
  }

  private spawnDiagonal(z: number, _speed: number, difficulty: number) {
    const startX = this.rng.next() < 0.5 ? C.corridorX[0] + 1 : C.corridorX[1] - 1;
    const endX = startX === C.corridorX[0] + 1 ? C.corridorX[1] - 1 : C.corridorX[0] + 1;
    const count = 5 + Math.floor(this.rng.next() * 4);
    for (let i = 0; i < count; i++) {
      const m = this.meteorPool.acquire();
      if (!m) break;
      const t = i / (count - 1);
      const x = lerp(startX, endX, t);
      const y = this.rng.range(C.corridorY[0] + 1, C.corridorY[1] - 1);
      const radius = this.rng.range(C.meteorRadiusMin, C.meteorRadiusMax * 0.6);
      initMeteor(m, x, y, z - i * 3, radius, this.getMovement(difficulty), difficulty);
    }
  }

  private spawnPickup() {
    const p = this.pickupPool.acquire();
    if (!p) return;
    p.active = true;
    p.mesh.visible = true;
    p.position.set(
      this.rng.range(C.corridorX[0] + 1, C.corridorX[1] - 1),
      this.rng.range(C.corridorY[0] + 0.5, C.corridorY[1] - 0.5),
      C.spawnZ
    );
    p.mesh.position.copy(p.position);
    p.attracted = false;
  }
}

// ============ COLLISION SYSTEM ============
export class CollisionSystem {
  private spawnSystem: SpawnSystem | null = null;

  setSpawnSystem(spawn: SpawnSystem) {
    this.spawnSystem = spawn;
  }

  update(player: Player, meteorPool: MeteorPool, pickupPool: PickupPool, magnetRadius: number, elapsed: number, dt: number, isOverdrive: boolean, canBreakSmall: boolean) {
    if (!player.alive) return;

    const px = player.position.x;
    const py = player.position.y;
    let anyInSkimZone = false;

    // Meteor collisions - only check when meteor is near player in Z
    for (const m of meteorPool.pool) {
      if (!m.active) continue;
      const mz = m.mesh.position.z;

      // Only check collision when meteor is within player's Z range
      if (mz < -3 || mz > 3) {
        // Still track near-miss zone for meteors approaching
        if (mz > -8 && mz < 3) {
          const mx = m.mesh.position.x;
          const my = m.mesh.position.y;
          const dist = dist2D(px, py, mx, my);
          if (dist < m.minDistRecorded) {
            m.minDistRecorded = dist;
          }
          if (dist <= m.nearMissRadius) {
            m.wasInNearMissZone = true;
          }
        }
        continue;
      }

      const mx = m.mesh.position.x;
      const my = m.mesh.position.y;
      const dist = dist2D(px, py, mx, my);

      // Track minimum distance for near-miss detection
      if (dist < m.minDistRecorded) {
        m.minDistRecorded = dist;
      }

      // Core collision - triggers when ship visibly overlaps the meteor
      if (dist <= m.coreRadius + player.radius * 0.8) {
        // Overdrive: destroy small meteors if ship can break them
        if (isOverdrive && canBreakSmall && m.coreRadius < 1.2) {
          m.active = false;
          m.mesh.visible = false;
          eventBus.emit('meteorDestroyed', m.mesh.position.clone(), m.coreRadius);
          continue;
        }
        if (!m.hasDamagedPlayer && !player.isInvuln()) {
          m.hasDamagedPlayer = true;
          this.handleCoreHit(player, m);
        }
        continue;
      }

      // Graze collision - outer dangerous surface (skim zone)
      if (dist <= m.grazeRadius) {
        anyInSkimZone = true;
        if (!m.hasDamagedPlayer) {
          m.hasGrazedPlayer = true;
          m.grazeAccum += dt;
          if (m.grazeAccum >= C.grazeTickInterval) {
            m.grazeAccum = 0;
            eventBus.emit('graze', m);
          }
        }
        continue;
      }

      // Near-miss zone tracking - large safe zone around meteor
      if (dist <= m.nearMissRadius) {
        anyInSkimZone = true; // Also counts as being in the skim zone indicator range
        m.wasInNearMissZone = true;
      }
    }

    // Update player's skim zone visual state
    player.setSkimZone(anyInSkimZone);

    // Pickup collection & magnet
    for (const p of pickupPool.pool) {
      if (!p.active) continue;
      const dist = dist2D(px, py, p.position.x, p.position.y);

      if (dist < magnetRadius) {
        p.attracted = true;
      }

      if (p.attracted) {
        const dir = new THREE.Vector3(px - p.position.x, py - p.position.y, 0).normalize();
        p.position.add(dir.multiplyScalar(15 * dt));
        p.mesh.position.copy(p.position);
      }

      if (dist < player.radius + 0.3) {
        p.active = false;
        p.mesh.visible = false;
        eventBus.emit('pickupCollected', p.position.clone());
      }
    }
  }

  private handleCoreHit(player: Player, m: MeteorData) {
    if (player.shields > 0) {
      player.shields--;
      player.setInvuln(C.invulnTime);
      // Knockback - push player away from meteor
      const dx = player.position.x - m.mesh.position.x;
      const dy = player.position.y - m.mesh.position.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      player.targetX += (dx / len) * 2.5;
      player.targetY += (dy / len) * 2.5;
      eventBus.emit('shieldLost', player.position.clone());
    } else {
      player.alive = false;
      eventBus.emit('playerCrashed', player.position.clone());
    }
  }

  resolveNearMisses(meteorPool: MeteorPool, playerZ: number) {
    for (const m of meteorPool.pool) {
      if (!m.active || m.hasBeenNearMissed || m.hasDamagedPlayer) continue;
      // Meteor has passed behind the player
      if (m.mesh.position.z > playerZ + 2) {
        if (m.wasInNearMissZone && m.minDistRecorded <= m.nearMissRadius && m.minDistRecorded > m.coreRadius + player_radius_buffer) {
          // Near-miss - player was close but didn't take damage
          m.hasBeenNearMissed = true;
          eventBus.emit('nearMiss', m.mesh.position.clone());
        }
      }
    }
  }
}

const player_radius_buffer = 0.3;

// ============ CAMERA SYSTEM ============
export class CameraSystem {
  camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDecay = 0.9; // Multiplicative decay per frame
  private baseFOV = 60;
  private maxFOV = 85;
  private currentFOVTarget = 60;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.set(0, C.cameraOffset.y, C.cameraOffset.z);
  }

  update(player: Player, dt: number, speed: number, combo: number, boostActive: boolean, isOverdrive: boolean) {
    // Target position behind player
    this.targetPos.set(
      player.position.x * 0.3 + C.cameraOffset.x,
      player.position.y * 0.3 + C.cameraOffset.y,
      C.cameraOffset.z
    );

    // Smooth follow
    const t = 1 - Math.exp(-C.cameraSmoothing * dt);
    this.camera.position.x = lerp(this.camera.position.x, this.targetPos.x, t);
    this.camera.position.y = lerp(this.camera.position.y, this.targetPos.y, t);
    this.camera.position.z = lerp(this.camera.position.z, this.targetPos.z, t);

    // Look target
    this.targetLook.set(
      player.position.x * 0.5 + C.cameraLookOffset.x,
      player.position.y * 0.3 + C.cameraLookOffset.y,
      C.cameraLookOffset.z
    );
    this.camera.lookAt(this.targetLook);

    // Dynamic FOV based on speed, combo, boost, and overdrive
    const speedFactor = clamp((speed - C.baseSpeed) / (C.maxSpeed - C.baseSpeed), 0, 1);
    const comboFactor = clamp(combo / 20, 0, 1);
    let targetFOV = this.baseFOV;
    targetFOV += speedFactor * 12; // Up to +12 from speed
    targetFOV += comboFactor * 8;  // Up to +8 from combo
    if (boostActive) targetFOV += 8;
    if (isOverdrive) targetFOV += 5;
    targetFOV = clamp(targetFOV, this.baseFOV, this.maxFOV);

    this.currentFOVTarget = lerp(this.currentFOVTarget, targetFOV, dt * 3);
    this.camera.fov = this.currentFOVTarget;
    this.camera.updateProjectionMatrix();

    // Screen shake with multiplicative decay
    if (this.shakeIntensity > 0.001) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        0
      );
      this.camera.position.add(this.shakeOffset);
      this.shakeIntensity *= this.shakeDecay;
    }
  }

  shake(intensity: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }
}

// ============ EFFECT SYSTEM ============
export class EffectSystem {
  private particles: ParticlePool;
  private floatingTexts: FloatingTextPool;
  private slowMoTimer = 0;
  private slowMoScale = 1;

  constructor(particles: ParticlePool, floatingTexts: FloatingTextPool) {
    this.particles = particles;
    this.floatingTexts = floatingTexts;
  }

  update(dt: number) {
    this.particles.update(dt);
    this.floatingTexts.update(dt);
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) this.slowMoScale = 1;
    }
  }

  getTimeScale(): number {
    return this.slowMoTimer > 0 ? this.slowMoScale : 1;
  }

  spawnSparks(pos: THREE.Vector3, color: string, count = 8) {
    this.particles.emit(pos, color, count, 5, 0.4);
  }

  spawnExplosion(pos: THREE.Vector3) {
    this.particles.emit(pos, '#ff4400', 30, 8, 0.8);
    this.particles.emit(pos, '#ffaa00', 20, 6, 0.6);
    this.particles.emit(pos, '#ffffff', 10, 10, 0.3);
  }

  showFloatingText(text: string, pos: THREE.Vector3, color: string, duration = 1.0) {
    this.floatingTexts.show(text, pos, color, duration);
  }

  triggerSlowMo(duration: number, scale: number) {
    this.slowMoTimer = duration;
    this.slowMoScale = scale;
  }

  releaseAll() {
    this.particles.releaseAll();
    this.floatingTexts.releaseAll();
  }
}
