import * as THREE from 'three';
import { C, eventBus, GameState, loadSave, writeSave, SHIPS, MISSIONS, getDailySeed, SeededRandom, type SaveData, type GameStateType } from './core';
import { Player, MeteorPool, PickupPool, ParticlePool, FloatingTextPool, Trail, updateMeteor } from './entities';
import { InputSystem, SpawnSystem, CollisionSystem, CameraSystem, EffectSystem } from './systems';
import { Audio, initAudio, setMuted } from './audio';
import { clamp } from './utils';

export interface RunStats {
  score: number;
  distance: number;
  time: number;
  nearMisses: number;
  gapSkips: number;
  shardsCollected: number;
  bestCombo: number;
  bestMultiplier: number;
  stardustEarned: number;
  isNewRecord: boolean;
}

export class Game {
  // Three.js
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // Systems
  private input!: InputSystem;
  private spawn!: SpawnSystem;
  private collision!: CollisionSystem;
  private cameraSys!: CameraSystem;
  private effects!: EffectSystem;

  // Entities
  private player!: Player;
  private meteorPool!: MeteorPool;
  private pickupPool!: PickupPool;
  private particlePool!: ParticlePool;
  private floatingTextPool!: FloatingTextPool;
  private trail!: Trail;

  // Game state
  private save: SaveData;
  private elapsedTime = 0;
  private currentSpeed: number = C.baseSpeed;
  private score = 0;
  private distanceScore = 0;
  private skillScore = 0;
  private combo = 0;
  private multiplier = 1;
  private boostMeter = 0;
  private boostActive = false;
  private boostTimer = 0;
  private shardsThisRun = 0;
  private nearMissesThisRun = 0;
  private gapSkipsThisRun = 0;
  private bestComboThisRun = 0;
  private runStats: RunStats | null = null;
  private isDailyChallenge = false;
  private streakTimer = 0;
  private lastPauseState = false;

  // Starfield
  private stars!: THREE.Points;

  // Gap triggers for immediate feedback
  private gapTriggers: { z: number; active: boolean }[] = [];

  // Callbacks for React UI
  onStateChange?: (state: GameStateType) => void;
  onScoreUpdate?: (data: { score: number; multiplier: number; combo: number; shields: number; boost: number; distance: number; bestScore: number }) => void;
  onRunEnd?: (stats: RunStats) => void;
  onFloatingText?: (text: string, color: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.save = loadSave();
    this.initRenderer();
    this.initScene();
    this.initEntities();
    this.initSystems();
    this.bindEvents();
    this.animate();
  }

  private initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x050510);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050510, 40, 130);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 2.2, 8);

    // Lighting
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
    const point = new THREE.PointLight(0x4488ff, 0.5, 50);
    point.position.set(0, 0, -20);
    this.scene.add(point);

    // Starfield
    this.createStarfield();

    // Resize
    window.addEventListener('resize', () => this.onResize());
  }

  private createStarfield() {
    const geo = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  private initEntities() {
    const shipId = this.save.selectedShipId;
    this.player = new Player(this.scene, shipId);
    this.meteorPool = new MeteorPool(this.scene, C.meteorPoolSize);
    this.pickupPool = new PickupPool(this.scene, C.pickupPoolSize);
    this.particlePool = new ParticlePool(this.scene, C.particlePoolSize);
    this.floatingTextPool = new FloatingTextPool(this.scene, C.floatingTextPoolSize);

    const shipDef = SHIPS.find(s => s.id === shipId) || SHIPS[0];
    this.trail = new Trail(this.scene, shipDef.trailColor);
  }

  private initSystems() {
    this.input = new InputSystem(this.canvas);
    this.spawn = new SpawnSystem(this.meteorPool, this.pickupPool);
    this.collision = new CollisionSystem();
    this.cameraSys = new CameraSystem(this.camera);
    this.effects = new EffectSystem(this.particlePool, this.floatingTextPool);
  }

  private bindEvents() {
    eventBus.on('nearMiss', (pos: THREE.Vector3) => {
      this.nearMissesThisRun++;
      this.combo++;
      this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
      this.skillScore += C.nearMissScore * this.multiplier;
      this.boostMeter = Math.min(C.boostMax, this.boostMeter + C.nearMissBoost);
      this.effects.showFloatingText('SKIM!', pos, '#44ffaa');
      this.effects.spawnSparks(pos, '#44ffaa', 6);
      this.cameraSys.shake(0.15);
      Audio.nearMiss();
      this.checkMultiplier();
      this.onFloatingText?.('SKIM!', '#44ffaa');
    });

    eventBus.on('graze', (m: any) => {
      const grazeMult = 1 + this.save.upgradeLevels.grazeStabilizer * 0.15;
      this.skillScore += C.grazeScoreTick * this.multiplier * grazeMult;
      this.boostMeter = Math.min(C.boostMax, this.boostMeter + C.grazeTickBoost);
      this.effects.spawnSparks(m.mesh.position.clone(), '#ffaa00', 3);
      Audio.graze();
    });

    eventBus.on('pickupCollected', (pos: THREE.Vector3) => {
      this.shardsThisRun++;
      this.combo++;
      this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
      this.skillScore += C.pickupScore * this.multiplier;
      this.boostMeter = Math.min(C.boostMax, this.boostMeter + C.pickupBoost);
      this.effects.spawnSparks(pos, '#44ffaa', 5);
      Audio.pickup();
      this.checkMultiplier();
    });

    eventBus.on('shieldLost', (pos: THREE.Vector3) => {
      this.combo = 0;
      this.multiplier = 1;
      this.effects.showFloatingText('SHIELD LOST', pos, '#ff4444');
      this.effects.spawnExplosion(pos);
      this.cameraSys.shake(0.5);
      Audio.shieldHit();
      this.onFloatingText?.('SHIELD LOST', '#ff4444');
    });

    eventBus.on('playerCrashed', (pos: THREE.Vector3) => {
      this.effects.spawnExplosion(pos);
      this.cameraSys.shake(1.0);
      this.effects.triggerSlowMo(0.5, 0.3);
      Audio.crash();
      setTimeout(() => this.endRun(), 800);
    });

    eventBus.on('boostActivated', () => {
      Audio.boost();
      this.onFloatingText?.('BOOST!', '#ffaa00');
    });

    eventBus.on('registerGapTrigger', (z: number) => {
      this.gapTriggers.push({ z, active: true });
    });

    // Visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && GameState.current === 'Running') {
        this.pause();
      }
    });
  }

  private checkMultiplier() {
    const newMult = Math.min(C.maxComboMultiplier, 1 + Math.floor(this.combo / C.comboPerMultiplier));
    if (newMult !== this.multiplier) {
      this.multiplier = newMult;
      if (this.multiplier >= 5) {
        this.onFloatingText?.(`x${this.multiplier} COMBO!`, '#ffaa00');
      }
    }
  }

  // ============ PUBLIC API ============
  startRun(daily = false) {
    initAudio();
    this.isDailyChallenge = daily;
    this.resetRun();
    GameState.set('Running');
    this.onStateChange?.('Running');
    eventBus.emit('runStarted');
  }

  private resetRun() {
    this.elapsedTime = 0;
    this.currentSpeed = C.baseSpeed;
    this.score = 0;
    this.distanceScore = 0;
    this.skillScore = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.boostMeter = 0;
    this.boostActive = false;
    this.boostTimer = 0;
    this.shardsThisRun = 0;
    this.nearMissesThisRun = 0;
    this.gapSkipsThisRun = 0;
    this.bestComboThisRun = 0;
    this.streakTimer = 0;
    this.runStats = null;
    this.gapTriggers = [];

    // Reset entities
    this.meteorPool.releaseAll();
    this.pickupPool.releaseAll();
    this.effects.releaseAll();
    this.trail.clear();

    // Reset player
    this.player.destroy(this.scene);
    const shipDef = SHIPS.find(s => s.id === this.save.selectedShipId) || SHIPS[0];
    this.player = new Player(this.scene, this.save.selectedShipId);
    this.player.shields = Math.min(3, C.startingShields + this.save.upgradeLevels.shieldCapacity);
    this.player.alive = true;
    this.player.position.set(0, 0, 0);
    this.player.targetX = 0;
    this.player.targetY = 0;
    this.input.targetX = 0;
    this.input.targetY = 0;

    // Reset spawn
    const seed = this.isDailyChallenge ? SeededRandom.fromString(getDailySeed()) : undefined;
    this.spawn.reset(seed);
    this.spawn.spawnInitialMeteors();

    // Reset trail
    if (this.trail) this.trail.dispose();
    this.trail = new Trail(this.scene, shipDef.trailColor);
  }

  pause() {
    if (GameState.current === 'Running') {
      GameState.set('Paused');
      this.onStateChange?.('Paused');
    }
  }

  resume() {
    if (GameState.current === 'Paused') {
      GameState.set('Running');
      this.onStateChange?.('Running');
    }
  }

  private endRun() {
    const scoreMult = 1 + this.save.upgradeLevels.scoreCore * 0.04;
    const finalScore = Math.floor((this.distanceScore + this.skillScore) * scoreMult);
    const stardustBonus = Math.floor(finalScore / 500);
    const stardustEarned = this.shardsThisRun + stardustBonus;
    const isNewRecord = finalScore > this.save.bestScore;

    this.runStats = {
      score: finalScore,
      distance: Math.floor(this.elapsedTime * this.currentSpeed * 0.1),
      time: this.elapsedTime,
      nearMisses: this.nearMissesThisRun,
      gapSkips: this.gapSkipsThisRun,
      shardsCollected: this.shardsThisRun,
      bestCombo: this.bestComboThisRun,
      bestMultiplier: this.multiplier,
      stardustEarned,
      isNewRecord,
    };

    // Update save
    this.save.lastScore = finalScore;
    this.save.totalRuns++;
    this.save.totalDistance += this.runStats.distance;
    this.save.totalNearMisses += this.nearMissesThisRun;
    this.save.totalGapSkips += this.gapSkipsThisRun;
    this.save.totalShards += this.shardsThisRun;
    this.save.stardust += stardustEarned;
    if (isNewRecord) {
      this.save.bestScore = finalScore;
      Audio.newRecord();
    }
    this.save.bestDistance = Math.max(this.save.bestDistance, this.runStats.distance);
    this.save.bestCombo = Math.max(this.save.bestCombo, this.bestComboThisRun);

    // Daily challenge
    if (this.isDailyChallenge) {
      const today = new Date().toISOString().slice(0, 10);
      if (this.save.dailyChallenge.date !== today || finalScore > this.save.dailyChallenge.bestScore) {
        this.save.dailyChallenge = { date: today, bestScore: finalScore };
      }
    }

    // Check missions
    this.checkMissions();

    writeSave(this.save);

    GameState.set('GameOver');
    this.onStateChange?.('GameOver');
    this.onRunEnd?.(this.runStats);
    eventBus.emit('runEnded', this.runStats);
  }

  private checkMissions() {
    for (const mission of MISSIONS) {
      const ms = this.save.missions[mission.id] || { progress: 0, completed: false, claimed: false };
      if (ms.completed) continue;

      let progress = ms.progress;
      switch (mission.type) {
        case 'surviveTime': progress = Math.max(progress, this.elapsedTime); break;
        case 'nearMisses': progress = Math.max(progress, this.nearMissesThisRun); break;
        case 'gapSkips': progress = Math.max(progress, this.gapSkipsThisRun); break;
        case 'totalShards': progress = this.save.totalShards; break;
        case 'reachMultiplier': progress = Math.max(progress, this.multiplier); break;
        case 'totalRuns': progress = this.save.totalRuns; break;
      }

      if (progress >= mission.target && !ms.completed) {
        ms.completed = true;
        ms.progress = progress;
        this.save.stardust += mission.rewardStardust;
        Audio.missionComplete();
        this.onFloatingText?.('MISSION COMPLETE!', '#ffdd00');
      } else {
        ms.progress = progress;
      }
      this.save.missions[mission.id] = ms;
    }
  }

  goToMenu() {
    GameState.set('MainMenu');
    this.onStateChange?.('MainMenu');
  }

  getSave(): SaveData { return this.save; }

  getRunStats(): RunStats | null { return this.runStats; }

  purchaseUpgrade(upgradeId: keyof SaveData['upgradeLevels']): boolean {
    const level = this.save.upgradeLevels[upgradeId];
    if (level >= C.maxUpgradeLevel) return false;
    const cost = C.upgradeCosts[level];
    if (this.save.stardust < cost) return false;
    this.save.stardust -= cost;
    this.save.upgradeLevels[upgradeId]++;
    writeSave(this.save);
    Audio.uiClick();
    return true;
  }

  unlockShip(shipId: string): boolean {
    const ship = SHIPS.find(s => s.id === shipId);
    if (!ship || this.save.unlockedShips.includes(shipId)) return false;
    if (this.save.stardust < ship.cost) return false;
    this.save.stardust -= ship.cost;
    this.save.unlockedShips.push(shipId);
    writeSave(this.save);
    Audio.uiClick();
    return true;
  }

  selectShip(shipId: string) {
    if (!this.save.unlockedShips.includes(shipId)) return;
    this.save.selectedShipId = shipId;
    writeSave(this.save);
    Audio.uiClick();
  }

  toggleMute() {
    this.save.settings.muted = !this.save.settings.muted;
    setMuted(this.save.settings.muted);
    writeSave(this.save);
  }

  // ============ GAME LOOP ============
  private lastTime = 0;

  private animate = () => {
    requestAnimationFrame(this.animate);
    const now = performance.now() / 1000;
    let dt = Math.min(now - this.lastTime, 0.05); // Clamp to avoid physics explosion
    this.lastTime = now;

    if (GameState.current === 'Running') {
      // Apply slow motion
      const timeScale = this.effects.getTimeScale();
      const gameDt = dt * timeScale;

      this.update(gameDt, dt);
    }

    this.render();
  };

  private update(dt: number, realDt: number) {
    // Input
    this.input.update(dt);
    this.player.targetX = this.input.targetX;
    this.player.targetY = this.input.targetY;

    // Pause check
    if (this.input.isPausePressed()) {
      this.input.consumePause();
      this.pause();
      return;
    }

    // Difficulty - faster speed ramp
    this.elapsedTime += dt;
    this.currentSpeed = clamp(C.baseSpeed + this.elapsedTime * 0.5, C.baseSpeed, C.maxSpeed);

    // Boost
    if (this.boostMeter >= C.boostMax && !this.boostActive) {
      this.boostActive = true;
      this.boostTimer = C.boostDuration + this.save.upgradeLevels.boostEfficiency * 0.4;
      this.boostMeter = 0;
      eventBus.emit('boostActivated');
    }
    if (this.boostActive) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) {
        this.boostActive = false;
      }
    }

    const speedMult = this.boostActive ? C.boostSpeedMult : 1;
    const effectiveSpeed = this.currentSpeed * speedMult;

    // Move meteors toward player
    const moveZ = effectiveSpeed * dt;
    for (const m of this.meteorPool.pool) {
      if (!m.active) continue;
      m.mesh.position.z += moveZ;
      updateMeteor(m, dt, this.elapsedTime);

      // Despawn
      if (m.mesh.position.z > C.despawnZ) {
        this.meteorPool.release(m);
      }
    }

    // Move pickups
    for (const p of this.pickupPool.pool) {
      if (!p.active) continue;
      p.position.z += moveZ;
      p.mesh.position.z = p.position.z;
      p.mesh.rotation.y += dt * 3;

      if (p.position.z > C.despawnZ) {
        this.pickupPool.release(p);
      }
    }

    // Player
    const steeringResp = C.steeringResponse + this.save.upgradeLevels.handling * 1.2;
    const shipHandling = (SHIPS.find(s => s.id === this.save.selectedShipId) || SHIPS[0]).handling;
    this.player.update(dt, steeringResp * shipHandling);
    this.player.trailIntensity = this.boostActive ? 2.0 : 1.0;

    // Trail
    this.trail.update(this.player.position.clone().add(new THREE.Vector3(0, 0, 0.6)), this.player.trailIntensity);

    // Spawn
    this.spawn.update(dt, effectiveSpeed, this.elapsedTime);

    // Collision
    const magnetRadius = C.magnetBaseRadius + this.save.upgradeLevels.magnet * 0.8;
    this.collision.update(this.player, this.meteorPool, this.pickupPool, magnetRadius, this.elapsedTime, dt);
    this.collision.resolveNearMisses(this.meteorPool, this.player.position.z);

    // Gap triggers - immediate feedback when player passes through
    for (let i = this.gapTriggers.length - 1; i >= 0; i--) {
      const trigger = this.gapTriggers[i];
      trigger.z += moveZ;

      if (trigger.z > this.player.position.z && trigger.active) {
        // Only award if player didn't crash into the gap walls
        if (this.player.alive) {
          trigger.active = false;
          this.gapSkipsThisRun++;
          this.combo += 2;
          this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);
          this.skillScore += C.gapSkipScore * this.multiplier;
          this.boostMeter = Math.min(C.boostMax, this.boostMeter + C.gapSkipBoost);
          const pos = new THREE.Vector3(this.player.position.x, this.player.position.y, trigger.z);
          this.effects.showFloatingText('GAP SKIP!', pos, '#ffdd00');
          this.effects.spawnSparks(pos, '#ffdd00', 12);
          this.cameraSys.shake(0.3);
          Audio.gapSkip();
          this.checkMultiplier();
          this.onFloatingText?.('GAP SKIP!', '#ffdd00');
        }
      }

      // Clean up old triggers
      if (trigger.z > C.despawnZ) {
        this.gapTriggers.splice(i, 1);
      }
    }

    // Scoring
    this.distanceScore += C.distanceScorePerSec * (effectiveSpeed / C.baseSpeed) * dt;

    // Streak bonus
    this.streakTimer += dt;
    if (this.streakTimer >= 10) {
      this.streakTimer = 0;
      this.skillScore += 100 * this.multiplier;
    }

    // Score
    this.score = Math.floor(this.distanceScore + this.skillScore);

    // Effects
    this.effects.update(dt);

    // Camera
    this.cameraSys.update(this.player, dt, this.boostActive);

    // HUD update
    this.onScoreUpdate?.({
      score: this.score,
      multiplier: this.multiplier,
      combo: this.combo,
      shields: this.player.shields,
      boost: this.boostMeter,
      distance: Math.floor(this.elapsedTime * effectiveSpeed * 0.1),
      bestScore: this.save.bestScore,
    });

    // Starfield scroll
    this.stars.position.z += moveZ * 0.1;
    if (this.stars.position.z > 50) this.stars.position.z = 0;
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.renderer.dispose();
  }
}
