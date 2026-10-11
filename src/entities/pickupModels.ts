import * as THREE from 'three';

export enum PickupType {
  STARDUST = 'stardust',   // Common currency
  SHIELD = 'shield',       // Defensive
  BOOST = 'boost',         // Speed
  MULTIPLIER = 'multiplier', // Score
}

interface PickupConfig {
  color: number;
  emissive: number;
  geometry: THREE.BufferGeometry;
  rotationSpeed: number;
  pulseSpeed: number;
}

const PICKUP_CONFIGS: Record<PickupType, PickupConfig> = {
  [PickupType.STARDUST]: {
    color: 0xffd700,
    emissive: 0xffd700,
    geometry: new THREE.OctahedronGeometry(0.3, 0),
    rotationSpeed: 2.0,
    pulseSpeed: 3.0,
  },
  [PickupType.SHIELD]: {
    color: 0x00ff88,
    emissive: 0x00ff88,
    geometry: new THREE.IcosahedronGeometry(0.35, 0),
    rotationSpeed: 1.5,
    pulseSpeed: 2.0,
  },
  [PickupType.BOOST]: {
    color: 0xff4400,
    emissive: 0xff4400,
    geometry: new THREE.TetrahedronGeometry(0.35, 0),
    rotationSpeed: 3.0,
    pulseSpeed: 4.0,
  },
  [PickupType.MULTIPLIER]: {
    color: 0xaa00ff,
    emissive: 0xaa00ff,
    geometry: new THREE.DodecahedronGeometry(0.3, 0),
    rotationSpeed: 1.0,
    pulseSpeed: 2.5,
  },
};

export interface PickupModel {
  group: THREE.Group;
  update: (delta: number, time: number) => void;
}

export function createPickupModel(type: PickupType): PickupModel {
  const config = PICKUP_CONFIGS[type];
  const group = new THREE.Group();

  // === MAIN GEM ===
  const gemMaterial = new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.emissive,
    emissiveIntensity: 0.5,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9,
    flatShading: true,
  });

  const gem = new THREE.Mesh(config.geometry, gemMaterial);
  group.add(gem);

  // === OUTER RING (Orbiting) ===
  const ringGeometry = new THREE.TorusGeometry(0.5, 0.02, 8, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // === INNER GLOW (Sprite) ===
  const glowTexture = createGlowTexture();
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: config.color,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(1.5);
  group.add(glow);

  // === POINT LIGHT ===
  const light = new THREE.PointLight(config.color, 0.8, 3);
  group.add(light);

  // === UPDATE ===
  let time = 0;
  const update = (delta: number, globalTime: number) => {
    time += delta;

    // Rotate the gem
    gem.rotation.y += config.rotationSpeed * delta;
    gem.rotation.x += config.rotationSpeed * 0.5 * delta;

    // Pulse the glow
    const pulse = Math.sin(time * config.pulseSpeed) * 0.3 + 0.7;
    gemMaterial.emissiveIntensity = 0.3 + pulse * 0.4;
    glowMaterial.opacity = 0.3 + pulse * 0.3;
    light.intensity = 0.5 + pulse * 0.5;

    // Orbit the ring
    ring.rotation.z = time * 0.5;
    ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.3) * 0.2;

    // Gentle float
    group.position.y = Math.sin(time * 2) * 0.1;
  };

  return { group, update };
}

// === GLOW TEXTURE GENERATOR ===
function createGlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
