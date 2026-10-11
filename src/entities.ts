import * as THREE from 'three';
import { C, SHIPS, ShipDef } from './core';
import { clamp, lerp, randRange } from './utils';

// ============ PLAYER ============
export class Player {
  mesh: THREE.Group;
  position = new THREE.Vector3(0, 0, 0);
  targetX = 0;
  targetY = 0;
  velocity = new THREE.Vector3();
  radius = C.playerRadius;
  shields: number = C.startingShields;
  invulnTimer = 0;
  alive = true;
  roll = 0;
  pitch = 0;
  trailIntensity = 1;
  inSkimZone = false;
  isOverdrive = false;
  private bodyMesh!: THREE.Mesh;
  private engineGlow!: THREE.Mesh;
  private skimAura!: THREE.Mesh;
  private shipDef: ShipDef;
  private bodyMat!: THREE.MeshStandardMaterial;
  private auraMat!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, shipId: string) {
    this.shipDef = SHIPS.find(s => s.id === shipId) || SHIPS[0];
    this.mesh = new THREE.Group();

    // Body - sleek ship shape with emissive material
    const bodyGeo = new THREE.ConeGeometry(0.3 * this.shipDef.scale, 1.2 * this.shipDef.scale, 4);
    bodyGeo.rotateX(Math.PI / 2);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.shipDef.bodyColor,
      emissive: this.shipDef.bodyColor,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.mesh.add(this.bodyMesh);

    // Wings
    const wingGeo = new THREE.BoxGeometry(1.4 * this.shipDef.scale, 0.05, 0.5 * this.shipDef.scale);
    const wingMat = new THREE.MeshStandardMaterial({
      color: this.shipDef.accentColor,
      emissive: this.shipDef.accentColor,
      emissiveIntensity: 0.5,
      flatShading: true,
      roughness: 0.4,
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = 0.2;
    this.mesh.add(wings);

    // Engine glow
    const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: this.shipDef.trailColor });
    this.engineGlow = new THREE.Mesh(glowGeo, glowMat);
    this.engineGlow.position.z = 0.7;
    this.mesh.add(this.engineGlow);

    // Skim zone aura - visual indicator of the risk/reward zone
    const auraGeo = new THREE.SphereGeometry(this.shipDef.skimZoneRadius, 16, 16);
    this.auraMat = new THREE.MeshBasicMaterial({
      color: '#00ffff',
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      depthWrite: false,
    });
    this.skimAura = new THREE.Mesh(auraGeo, this.auraMat);
    this.mesh.add(this.skimAura);

    scene.add(this.mesh);
  }

  setSkimZone(active: boolean) {
    this.inSkimZone = active;
  }

  setOverdrive(active: boolean) {
    this.isOverdrive = active;
    if (active) {
      this.bodyMat.emissive.set('#ffaa00');
      this.bodyMat.emissiveIntensity = 1.5;
    } else {
      this.bodyMat.emissive.set(this.shipDef.bodyColor);
      this.bodyMat.emissiveIntensity = 0.8;
    }
  }

  update(dt: number, steeringResponse: number) {
    if (!this.alive) return;

    // Smooth movement toward target
    const t = 1 - Math.exp(-steeringResponse * dt);
    this.position.x = lerp(this.position.x, clamp(this.targetX, C.corridorX[0], C.corridorX[1]), t);
    this.position.y = lerp(this.position.y, clamp(this.targetY, C.corridorY[0], C.corridorY[1]), t);

    // Banking/rolling based on horizontal movement
    const targetRoll = -(this.targetX - this.position.x) * 2.5;
    this.roll = lerp(this.roll, clamp(targetRoll, -0.6, 0.6), t * 0.8);
    const targetPitch = -(this.targetY - this.position.y) * 1.5;
    this.pitch = lerp(this.pitch, clamp(targetPitch, -0.4, 0.4), t * 0.8);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.z = this.roll;
    this.mesh.rotation.x = this.pitch;

    // Invulnerability timer
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.bodyMesh.visible = Math.floor(this.invulnTimer * 10) % 2 === 0;
    } else {
      this.bodyMesh.visible = true;
    }

    // Engine glow pulse
    const pulse = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
    this.engineGlow.scale.setScalar(pulse * this.trailIntensity);

    // Skim aura animation - changes color/opacity based on proximity to meteors
    if (this.inSkimZone) {
      // Bright gold when in danger zone
      this.auraMat.color.lerp(new THREE.Color('#ffaa00'), dt * 8);
      this.auraMat.opacity = lerp(this.auraMat.opacity, 0.25, dt * 6);
      this.skimAura.rotation.y += dt * 2;
      this.skimAura.rotation.x += dt * 1.5;
    } else if (this.isOverdrive) {
      // Pulsing rainbow during overdrive
      const hue = (Date.now() * 0.001) % 1;
      this.auraMat.color.setHSL(hue, 1, 0.5);
      this.auraMat.opacity = lerp(this.auraMat.opacity, 0.3, dt * 4);
      this.skimAura.rotation.y += dt * 4;
    } else {
      // Faint cyan when safe
      this.auraMat.color.lerp(new THREE.Color('#00ffff'), dt * 4);
      this.auraMat.opacity = lerp(this.auraMat.opacity, 0.05, dt * 4);
      this.skimAura.rotation.y += dt * 0.5;
    }
  }

  setInvuln(time: number) {
    this.invulnTimer = time;
  }

  isInvuln(): boolean { return this.invulnTimer > 0; }

  destroy(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
}

// ============ METEOR ============
export type MeteorMovement = 'static' | 'drift' | 'oscillate';

export interface MeteorData {
  active: boolean;
  mesh: THREE.Mesh;
  coreRadius: number;
  grazeRadius: number;
  nearMissRadius: number;
  hasBeenNearMissed: boolean;
  hasGrazedPlayer: boolean;
  hasDamagedPlayer: boolean;
  wasInNearMissZone: boolean;
  minDistRecorded: number;
  grazeAccum: number;
  movementType: MeteorMovement;
  driftVel: THREE.Vector3;
  oscillatePhase: number;
  oscillateAmp: number;
  baseX: number;
  baseY: number;
  rotSpeed: THREE.Vector3;
}

// Shared geometries for meteors
const meteorGeos: THREE.IcosahedronGeometry[] = [];
function getMeteorGeo(detail: number): THREE.IcosahedronGeometry {
  if (!meteorGeos[detail]) {
    meteorGeos[detail] = new THREE.IcosahedronGeometry(1, detail);
    // Displace vertices for rocky look
    const pos = meteorGeos[detail].getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z);
      const displacement = 0.8 + Math.random() * 0.4;
      pos.setXYZ(i, x / len * displacement, y / len * displacement, z / len * displacement);
    }
    pos.needsUpdate = true;
    meteorGeos[detail].computeVertexNormals();
  }
  return meteorGeos[detail];
}

// Dark, desaturated meteor colors that recede into background
const meteorColors = ['#2a2a35', '#252530', '#2f2835', '#28283a', '#302838', '#2a2530'];
const meteorMats: THREE.MeshStandardMaterial[] = [];
function getMeteorMat(idx: number): THREE.MeshStandardMaterial {
  if (!meteorMats[idx]) {
    meteorMats[idx] = new THREE.MeshStandardMaterial({
      color: meteorColors[idx % meteorColors.length],
      flatShading: true,
      roughness: 0.7,
      metalness: 0.2,
    });
  }
  return meteorMats[idx];
}

export class MeteorPool {
  pool: MeteorData[] = [];
  scene: THREE.Scene;

  constructor(scene: THREE.Scene, size: number) {
    this.scene = scene;
    for (let i = 0; i < size; i++) {
      const geo = getMeteorGeo(i % 2 === 0 ? 1 : 0);
      const mat = getMeteorMat(i % meteorColors.length);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        active: false, mesh, coreRadius: 1, grazeRadius: 1.7, nearMissRadius: 1.65,
        hasBeenNearMissed: false, hasGrazedPlayer: false, hasDamagedPlayer: false,
        wasInNearMissZone: false, minDistRecorded: 999,
        grazeAccum: 0, movementType: 'static',
        driftVel: new THREE.Vector3(), oscillatePhase: 0, oscillateAmp: 0,
        baseX: 0, baseY: 0, rotSpeed: new THREE.Vector3(),
      });
    }
  }

  acquire(): MeteorData | null {
    for (const m of this.pool) {
      if (!m.active) return m;
    }
    return null;
  }

  release(m: MeteorData) {
    m.active = false;
    m.mesh.visible = false;
  }

  releaseAll() {
    for (const m of this.pool) this.release(m);
  }
}

export function initMeteor(m: MeteorData, x: number, y: number, z: number, radius: number, movement: MeteorMovement, difficulty: number) {
  m.active = true;
  m.mesh.visible = true;
  m.mesh.position.set(x, y, z);
  m.coreRadius = radius;
  m.grazeRadius = radius + C.playerRadius + C.grazeThickness;
  m.nearMissRadius = radius * C.nearMissMultiplier;
  m.hasBeenNearMissed = false;
  m.hasGrazedPlayer = false;
  m.hasDamagedPlayer = false;
  m.wasInNearMissZone = false;
  m.minDistRecorded = 999;
  m.grazeAccum = 0;
  m.movementType = movement;
  m.baseX = x;
  m.baseY = y;
  m.oscillatePhase = Math.random() * Math.PI * 2;
  m.oscillateAmp = 1.0 + Math.random() * 1.5;

  const scale = radius;
  m.mesh.scale.set(scale, scale * (0.7 + Math.random() * 0.6), scale);
  m.rotSpeed.set(randRange(-1, 1), randRange(-1, 1), randRange(-0.5, 0.5));

  if (movement === 'drift') {
    m.driftVel.set(randRange(-2, 2) * Math.min(difficulty, 1), randRange(-1.5, 1.5) * Math.min(difficulty, 1), 0);
  } else {
    m.driftVel.set(0, 0, 0);
  }
}

export function updateMeteor(m: MeteorData, dt: number, elapsed: number) {
  if (!m.active) return;
  m.mesh.rotation.x += m.rotSpeed.x * dt;
  m.mesh.rotation.y += m.rotSpeed.y * dt;
  m.mesh.rotation.z += m.rotSpeed.z * dt;

  if (m.movementType === 'drift') {
    m.mesh.position.x += m.driftVel.x * dt;
    m.mesh.position.y += m.driftVel.y * dt;
  } else if (m.movementType === 'oscillate') {
    m.mesh.position.x = m.baseX + Math.sin(elapsed * 2 + m.oscillatePhase) * m.oscillateAmp;
    m.mesh.position.y = m.baseY + Math.cos(elapsed * 1.5 + m.oscillatePhase) * m.oscillateAmp * 0.6;
  }
}

// ============ PICKUP ============
export interface PickupData {
  active: boolean;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  attracted: boolean;
}

const pickupGeo = new THREE.OctahedronGeometry(0.2, 0);
const pickupMat = new THREE.MeshStandardMaterial({
  color: '#00ffcc',
  emissive: '#00ffcc',
  emissiveIntensity: 1.2,
  roughness: 0.2,
  metalness: 0.8,
});

export class PickupPool {
  pool: PickupData[] = [];
  scene: THREE.Scene;

  constructor(scene: THREE.Scene, size: number) {
    this.scene = scene;
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(pickupGeo, pickupMat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ active: false, mesh, position: new THREE.Vector3(), attracted: false });
    }
  }

  acquire(): PickupData | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }

  release(p: PickupData) {
    p.active = false;
    p.mesh.visible = false;
    p.attracted = false;
  }

  releaseAll() {
    for (const p of this.pool) this.release(p);
  }
}

// ============ PARTICLES ============
export interface Particle {
  active: boolean;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);

export class ParticlePool {
  pool: Particle[] = [];
  scene: THREE.Scene;

  constructor(scene: THREE.Scene, size: number) {
    this.scene = scene;
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true });
      const mesh = new THREE.Mesh(particleGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ active: false, mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1 });
    }
  }

  emit(pos: THREE.Vector3, color: string, count: number, speed: number, life: number) {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.copy(pos);
        (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
        p.velocity.set(randRange(-1, 1), randRange(-1, 1), randRange(-1, 1)).normalize().multiplyScalar(speed * randRange(0.5, 1.5));
        p.life = life;
        p.maxLife = life;
        spawned++;
      }
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.multiplyScalar(0.95);
      const alpha = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      p.mesh.scale.setScalar(alpha);
    }
  }

  releaseAll() {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }
}

// ============ FLOATING TEXT ============
export interface FloatingText {
  active: boolean;
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
}

// Texture cache to prevent GC stutter from creating new canvases every frame
const textureCache = new Map<string, THREE.Texture>();

function createTextTexture(text: string, color: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function getOrCreateTextTexture(text: string, color: string): THREE.Texture {
  const key = `${text}_${color}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }
  const tex = createTextTexture(text, color);
  textureCache.set(key, tex);
  return tex;
}

export class FloatingTextPool {
  pool: FloatingText[] = [];
  scene: THREE.Scene;

  constructor(scene: THREE.Scene, size: number) {
    this.scene = scene;
    for (let i = 0; i < size; i++) {
      const mat = new THREE.SpriteMaterial({ map: createTextTexture('', '#fff'), transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.scale.set(2, 0.5, 1);
      scene.add(sprite);
      this.pool.push({ active: false, sprite, life: 0, maxLife: 1, velocity: new THREE.Vector3() });
    }
  }

  show(text: string, pos: THREE.Vector3, color: string, duration = 1.0) {
    for (const ft of this.pool) {
      if (!ft.active) {
        ft.active = true;
        ft.sprite.visible = true;
        ft.sprite.position.copy(pos);
        ft.sprite.position.y += 1;
        
        // Use cached texture to prevent GC stutter
        const tex = getOrCreateTextTexture(text, color);
        const mat = ft.sprite.material as THREE.SpriteMaterial;
        mat.map = tex;
        mat.opacity = 1;
        mat.needsUpdate = true;
        
        ft.life = duration;
        ft.maxLife = duration;
        ft.velocity.set(0, 2, 0);
        return;
      }
    }
  }

  update(dt: number) {
    for (const ft of this.pool) {
      if (!ft.active) continue;
      ft.life -= dt;
      if (ft.life <= 0) {
        ft.active = false;
        ft.sprite.visible = false;
        continue;
      }
      ft.sprite.position.add(ft.velocity.clone().multiplyScalar(dt));
      ft.velocity.y *= 0.95;
      (ft.sprite.material as THREE.SpriteMaterial).opacity = ft.life / ft.maxLife;
    }
  }

  releaseAll() {
    for (const ft of this.pool) {
      ft.active = false;
      ft.sprite.visible = false;
    }
  }
}

// ============ TRAIL ============
export class Trail {
  private points: THREE.Vector3[] = [];
  private line: THREE.Line;
  private geo: THREE.BufferGeometry;
  private maxPoints = 30;

  constructor(scene: THREE.Scene, color: string) {
    this.geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
    this.line = new THREE.Line(this.geo, mat);
    scene.add(this.line);
  }

  update(pos: THREE.Vector3, intensity: number) {
    this.points.push(pos.clone());
    if (this.points.length > this.maxPoints) this.points.shift();

    const positions = new Float32Array(this.points.length * 3);
    for (let i = 0; i < this.points.length; i++) {
      positions[i * 3] = this.points[i].x;
      positions[i * 3 + 1] = this.points[i].y;
      positions[i * 3 + 2] = this.points[i].z;
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    (this.line.material as THREE.LineBasicMaterial).opacity = 0.4 * intensity;
  }

  clear() {
    this.points.length = 0;
  }

  dispose() {
    this.geo.dispose();
    (this.line.material as THREE.LineBasicMaterial).dispose();
  }
}
