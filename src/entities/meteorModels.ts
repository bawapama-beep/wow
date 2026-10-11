import * as THREE from 'three';

export enum MeteorType {
  JAGGED = 'jagged',       // Sharp, aggressive spikes
  ROUNDED = 'rounded',     // Smooth, tumbling boulder
  ELONGATED = 'elongated', // Long, asteroid-like cylinder
  CRYSTAL = 'crystal',     // Rare, glowing crystal formation (bonus)
}

// === SHARED MATERIALS ===
const rockMaterials = [
  new THREE.MeshStandardMaterial({
    color: 0x2a2a35,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x1f2833,
    roughness: 0.85,
    metalness: 0.15,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x3d2b56,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: true,
  }),
];

const crystalMaterial = new THREE.MeshStandardMaterial({
  color: 0xff006e,
  emissive: 0xff006e,
  emissiveIntensity: 0.3,
  roughness: 0.3,
  metalness: 0.5,
  flatShading: true,
  transparent: true,
  opacity: 0.9,
});

// === GEOMETRY GENERATORS ===

/**
 * Type 1: JAGGED - Spiky, threatening rock
 * Uses icosahedron with vertex displacement
 */
function createJaggedGeometry(detail: number = 1): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    // Displace vertices outward randomly for spiky look
    const displacement = 1 + Math.random() * 0.6;
    // Make some vertices spike more than others
    const spike = Math.random() > 0.7 ? displacement * 1.5 : displacement;
    vertex.multiplyScalar(spike);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Type 2: ROUNDED - Smooth, weathered boulder
 * Uses sphere with subtle noise displacement
 */
function createRoundedGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 12, 10);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    // Subtle, smooth displacement
    const noise = 1 + (Math.random() - 0.5) * 0.3;
    vertex.multiplyScalar(noise);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Type 3: ELONGATED - Long, tumbling asteroid
 * Uses stretched dodecahedron
 */
function createElongatedGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    // Stretch along one axis, add noise
    vertex.x *= 2.0 + Math.random() * 0.5;
    vertex.y *= 0.6 + Math.random() * 0.3;
    vertex.z *= 0.8 + Math.random() * 0.4;
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Type 4: CRYSTAL - Rare, glowing formation
 * Uses merged cone/octahedron shapes
 */
function createCrystalGeometry(): THREE.BufferGeometry {
  // Main crystal shard
  const mainShard = new THREE.OctahedronGeometry(0.8, 0);
  mainShard.scale(0.5, 1.5, 0.5);
  
  return mainShard;
}

// === METEOR FACTORY ===
export function createMeteorModel(type: MeteorType, size: number = 1): THREE.Group {
  const group = new THREE.Group();
  
  switch (type) {
    case MeteorType.JAGGED: {
      const geometry = createJaggedGeometry(1);
      const material = rockMaterials[Math.floor(Math.random() * rockMaterials.length)];
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(size);
      group.add(mesh);
      
      // Add smaller spike details
      for (let i = 0; i < 3; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.1 * size, 0.4 * size, 4);
        const spike = new THREE.Mesh(spikeGeo, material);
        const angle = (i / 3) * Math.PI * 2;
        spike.position.set(
          Math.cos(angle) * 0.6 * size,
          Math.sin(angle) * 0.6 * size,
          (Math.random() - 0.5) * 0.3 * size
        );
        spike.rotation.z = angle;
        group.add(spike);
      }
      break;
    }

    case MeteorType.ROUNDED: {
      const geometry = createRoundedGeometry();
      const material = rockMaterials[Math.floor(Math.random() * rockMaterials.length)];
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(size);
      group.add(mesh);
      
      // Add crater indentations (dark circles on surface)
      const craterMaterial = new THREE.MeshStandardMaterial({
        color: 0x111118,
        roughness: 1.0,
        metalness: 0,
      });
      for (let i = 0; i < 4; i++) {
        const craterGeo = new THREE.CircleGeometry(0.15 * size * Math.random(), 8);
        const crater = new THREE.Mesh(craterGeo, craterMaterial);
        // Position on surface of sphere
        const phi = Math.random() * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        crater.position.set(
          size * Math.sin(phi) * Math.cos(theta),
          size * Math.sin(phi) * Math.sin(theta),
          size * Math.cos(phi)
        );
        crater.lookAt(0, 0, 0); // Face outward
        crater.position.multiplyScalar(1.01); // Slightly above surface
        group.add(crater);
      }
      break;
    }

    case MeteorType.ELONGATED: {
      const geometry = createElongatedGeometry();
      const material = rockMaterials[Math.floor(Math.random() * rockMaterials.length)];
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(size * 0.7);
      group.add(mesh);
      
      // Add ring of small debris around it
      const debrisMaterial = rockMaterials[0];
      for (let i = 0; i < 5; i++) {
        const debrisGeo = new THREE.TetrahedronGeometry(0.08 * size);
        const debris = new THREE.Mesh(debrisGeo, debrisMaterial);
        const angle = (i / 5) * Math.PI * 2;
        const radius = size * 1.2;
        debris.position.set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 0.3 * size,
          Math.sin(angle) * radius * 0.5
        );
        group.add(debris);
      }
      break;
    }

    case MeteorType.CRYSTAL: {
      const geometry = createCrystalGeometry();
      const mesh = new THREE.Mesh(geometry, crystalMaterial);
      mesh.scale.setScalar(size);
      group.add(mesh);
      
      // Add inner glow light
      const crystalLight = new THREE.PointLight(0xff006e, 1, 3);
      crystalLight.position.set(0, 0, 0);
      group.add(crystalLight);
      
      // Add orbiting crystal shards
      for (let i = 0; i < 3; i++) {
        const shardGeo = new THREE.OctahedronGeometry(0.15 * size, 0);
        const shard = new THREE.Mesh(shardGeo, crystalMaterial);
        const angle = (i / 3) * Math.PI * 2;
        shard.position.set(
          Math.cos(angle) * size * 0.8,
          Math.sin(angle) * size * 0.8,
          0
        );
        group.add(shard);
      }
      break;
    }
  }

  // Store metadata for gameplay
  group.userData = {
    type,
    rotationSpeed: new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    ),
    size,
  };

  return group;
}

// === UPDATE FUNCTION (call each frame) ===
export function updateMeteorModel(meteor: THREE.Group, delta: number): void {
  const rotSpeed = meteor.userData.rotationSpeed as THREE.Vector3;
  meteor.rotation.x += rotSpeed.x * delta;
  meteor.rotation.y += rotSpeed.y * delta;
  meteor.rotation.z += rotSpeed.z * delta;
}
