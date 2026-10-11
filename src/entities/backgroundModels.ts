import * as THREE from 'three';

export interface BackgroundModel {
  group: THREE.Group;
  update: (delta: number, playerSpeed: number) => void;
}

export function createBackground(): BackgroundModel {
  const group = new THREE.Group();

  // === DISTANT RINGED PLANET ===
  const planetGroup = createRingedPlanet();
  planetGroup.position.set(-30, 10, -80);
  planetGroup.scale.setScalar(8);
  group.add(planetGroup);

  // === NEBULA CLOUDS (Layered transparent planes) ===
  const nebulaGroup = createNebula();
  nebulaGroup.position.set(0, 0, -50);
  group.add(nebulaGroup);

  // === DISTANT ASTEROID BELT ===
  const asteroidBelt = createAsteroidBelt();
  asteroidBelt.position.set(0, -5, -30);
  group.add(asteroidBelt);

  // === UPDATE ===
  let time = 0;
  const update = (delta: number, playerSpeed: number) => {
    time += delta;

    // Slowly rotate planet
    planetGroup.rotation.y += delta * 0.02;

    // Nebula drift
    nebulaGroup.children.forEach((cloud, i) => {
      cloud.rotation.z += delta * 0.005 * (i + 1);
      cloud.position.x += Math.sin(time * 0.1 + i) * delta * 0.01;
    });

    // Asteroid belt rotation
    asteroidBelt.rotation.y += delta * 0.05;
  };

  return { group, update };
}

// === RINGED PLANET ===
function createRingedPlanet(): THREE.Group {
  const group = new THREE.Group();

  // Planet body
  const planetGeometry = new THREE.SphereGeometry(1, 32, 24);
  const planetMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1a3e,
    roughness: 0.8,
    metalness: 0.1,
    emissive: 0x0a0515,
    emissiveIntensity: 0.2,
  });
  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  group.add(planet);

  // Atmosphere glow
  const atmosphereGeometry = new THREE.SphereGeometry(1.05, 32, 24);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x4400aa,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  group.add(atmosphere);

  // Rings
  const ringGeometry = new THREE.RingGeometry(1.5, 2.5, 64);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x6644aa,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2.5;
  group.add(ring);

  // Ring particles (small dots along the ring)
  const ringParticleCount = 200;
  const ringPositions = new Float32Array(ringParticleCount * 3);
  for (let i = 0; i < ringParticleCount; i++) {
    const angle = (i / ringParticleCount) * Math.PI * 2;
    const radius = 1.5 + Math.random() * 1.0;
    ringPositions[i * 3] = Math.cos(angle) * radius;
    ringPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
    ringPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const ringParticleGeometry = new THREE.BufferGeometry();
  ringParticleGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
  const ringParticleMaterial = new THREE.PointsMaterial({
    color: 0x8866cc,
    size: 0.03,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
  const ringParticles = new THREE.Points(ringParticleGeometry, ringParticleMaterial);
  ringParticles.rotation.x = Math.PI / 2.5;
  group.add(ringParticles);

  return group;
}

// === NEBULA CLOUDS ===
function createNebula(): THREE.Group {
  const group = new THREE.Group();
  const nebulaTexture = createNebulaTexture();

  const colors = [0xff006e, 0x4400aa, 0x00f5ff, 0x220044];

  for (let i = 0; i < 4; i++) {
    const planeGeometry = new THREE.PlaneGeometry(40, 40);
    const material = new THREE.MeshBasicMaterial({
      map: nebulaTexture,
      color: colors[i],
      transparent: true,
      opacity: 0.08 + Math.random() * 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const cloud = new THREE.Mesh(planeGeometry, material);
    cloud.position.z = -i * 10;
    cloud.rotation.z = Math.random() * Math.PI;
    cloud.scale.setScalar(1 + Math.random() * 0.5);
    group.add(cloud);
  }

  return group;
}

// === NEBULA TEXTURE (Procedural) ===
function createNebulaTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark base
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, 256, 256);

  // Soft radial blobs
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = 30 + Math.random() * 60;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }

  return new THREE.CanvasTexture(canvas);
}

// === ASTEROID BELT ===
function createAsteroidBelt(): THREE.Group {
  const group = new THREE.Group();
  const asteroidCount = 30;
  
  // Use InstancedMesh for performance
  const asteroidGeometry = new THREE.IcosahedronGeometry(0.3, 0);
  const asteroidMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a25,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
  });

  const instancedMesh = new THREE.InstancedMesh(
    asteroidGeometry,
    asteroidMaterial,
    asteroidCount
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let i = 0; i < asteroidCount; i++) {
    // Distribute in a ring
    const angle = (i / asteroidCount) * Math.PI * 2;
    const radius = 15 + Math.random() * 10;
    
    position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * 5,
      Math.sin(angle) * radius - 10
    );
    
    rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    quaternion.setFromEuler(rotation);
    
    const s = 0.5 + Math.random() * 1.5;
    scale.set(s, s, s);
    
    matrix.compose(position, quaternion, scale);
    instancedMesh.setMatrixAt(i, matrix);
  }

  group.add(instancedMesh);
  return group;
}
