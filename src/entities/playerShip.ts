import * as THREE from 'three';

export interface PlayerShipModel {
  group: THREE.Group;
  engineLights: THREE.PointLight[];
  engineMeshes: THREE.Mesh[];
  cockpitMesh: THREE.Mesh;
  trailPoints: THREE.Vector3[];
  update: (delta: number, speed: number, boostActive: boolean) => void;
}

export function createPlayerShip(): PlayerShipModel {
  const group = new THREE.Group();
  const engineLights: THREE.PointLight[] = [];
  const engineMeshes: THREE.Mesh[] = [];
  const trailPoints: THREE.Vector3[] = [];
  let cockpitMesh: THREE.Mesh;
  let engineGlowIntensity = 1.0;
  let targetGlowIntensity = 1.0;

  // === MATERIALS ===
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.5,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a15,
    metalness: 0.7,
    roughness: 0.4,
  });

  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9,
  });

  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.8,
  });

  const wingEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff006e,
    emissive: 0xff006e,
    emissiveIntensity: 0.4,
    metalness: 0.5,
    roughness: 0.3,
  });

  // === MAIN HULL (Fuselage) ===
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 0.8);      // Nose tip
  hullShape.lineTo(-0.3, 0.2);
  hullShape.lineTo(-0.35, -0.6);
  hullShape.lineTo(-0.2, -1.0);
  hullShape.lineTo(0.2, -1.0);
  hullShape.lineTo(0.35, -0.6);
  hullShape.lineTo(0.3, 0.2);
  hullShape.closePath();

  const hullExtrudeSettings = {
    depth: 0.25,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.05,
    bevelSegments: 3,
  };

  const hullGeometry = new THREE.ExtrudeGeometry(hullShape, hullExtrudeSettings);
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.translate(0, 0, 0.5);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  group.add(hull);

  // === COCKPIT CANOPY ===
  const cockpitGeometry = new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  cockpitGeometry.scale(1, 0.6, 1.8);
  cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpitMesh.position.set(0, 0.15, 0.3);
  group.add(cockpitMesh);

  // === WINGS (Swept-back delta) ===
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-1.4, -0.8);
  wingShape.lineTo(-1.2, -1.0);
  wingShape.lineTo(-0.1, -0.6);
  wingShape.closePath();

  const wingExtrudeSettings = {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  };

  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  
  // Left wing
  const leftWing = new THREE.Mesh(wingGeometry, hullMaterial);
  leftWing.position.set(0, -0.05, -0.2);
  leftWing.rotation.z = 0.05; // Slight dihedral
  group.add(leftWing);

  // Right wing (mirrored)
  const rightWingGeometry = wingGeometry.clone();
  rightWingGeometry.scale(-1, 1, 1); // Mirror
  const rightWing = new THREE.Mesh(rightWingGeometry, hullMaterial);
  rightWing.position.set(0, -0.05, -0.2);
  rightWing.rotation.z = -0.05;
  group.add(rightWing);

  // === WING EDGE LIGHTS (Neon accents) ===
  const wingEdgeGeometry = new THREE.BoxGeometry(0.03, 0.02, 0.8);
  
  const leftEdge = new THREE.Mesh(wingEdgeGeometry, wingEdgeMaterial);
  leftEdge.position.set(-1.1, -0.04, -0.6);
  leftEdge.rotation.y = 0.5;
  group.add(leftEdge);

  const rightEdge = new THREE.Mesh(wingEdgeGeometry, wingEdgeMaterial);
  rightEdge.position.set(1.1, -0.04, -0.6);
  rightEdge.rotation.y = -0.5;
  group.add(rightEdge);

  // === ENGINE NACELLES (Twin) ===
  const nacelleGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8);
  nacelleGeometry.rotateX(Math.PI / 2);

  const leftNacelle = new THREE.Mesh(nacelleGeometry, accentMaterial);
  leftNacelle.position.set(-0.35, -0.1, -0.8);
  group.add(leftNacelle);

  const rightNacelle = new THREE.Mesh(nacelleGeometry, accentMaterial);
  rightNacelle.position.set(0.35, -0.1, -0.8);
  group.add(rightNacelle);

  // === ENGINE EXHAUST GLOW ===
  const exhaustGeometry = new THREE.ConeGeometry(0.1, 0.5, 8);
  exhaustGeometry.rotateX(-Math.PI / 2);

  const leftExhaust = new THREE.Mesh(exhaustGeometry, engineMaterial.clone());
  leftExhaust.position.set(-0.35, -0.1, -1.2);
  group.add(leftExhaust);
  engineMeshes.push(leftExhaust);

  const rightExhaust = new THREE.Mesh(exhaustGeometry, engineMaterial.clone());
  rightExhaust.position.set(0.35, -0.1, -1.2);
  group.add(rightExhaust);
  engineMeshes.push(rightExhaust);

  // === ENGINE POINT LIGHTS ===
  const leftEngineLight = new THREE.PointLight(0x00f5ff, 2, 5);
  leftEngineLight.position.set(-0.35, -0.1, -1.3);
  group.add(leftEngineLight);
  engineLights.push(leftEngineLight);

  const rightEngineLight = new THREE.PointLight(0x00f5ff, 2, 5);
  rightEngineLight.position.set(0.35, -0.1, -1.3);
  group.add(rightEngineLight);
  engineLights.push(rightEngineLight);

  // === TAIL FIN ===
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0, 0.4);
  tailShape.lineTo(-0.15, 0.3);
  tailShape.lineTo(-0.1, 0);
  tailShape.closePath();

  const tailGeometry = new THREE.ExtrudeGeometry(tailShape, { depth: 0.03, bevelEnabled: false });
  const tail = new THREE.Mesh(tailGeometry, accentMaterial);
  tail.position.set(0, 0.1, -0.9);
  group.add(tail);

  // === UPDATE FUNCTION ===
  let time = 0;
  const update = (delta: number, speed: number, boostActive: boolean) => {
    time += delta;

    // Engine glow pulsing
    targetGlowIntensity = boostActive ? 2.5 : 1.0 + speed * 0.5;
    engineGlowIntensity = THREE.MathUtils.lerp(engineGlowIntensity, targetGlowIntensity, 0.1);

    engineMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = engineGlowIntensity;
      // Scale exhaust cone based on speed
      const exhaustScale = 0.5 + speed * 0.5 + (boostActive ? 0.5 : 0);
      mesh.scale.z = exhaustScale;
      mesh.scale.x = 0.8 + Math.sin(time * 20) * 0.1; // Flicker
    });

    engineLights.forEach((light) => {
      light.intensity = engineGlowIntensity * 2;
      light.color.setHex(boostActive ? 0xffd700 : 0x00f5ff);
    });

    // Cockpit glow pulse
    const cockpitMat = cockpitMesh.material as THREE.MeshStandardMaterial;
    cockpitMat.emissiveIntensity = 0.4 + Math.sin(time * 3) * 0.2;
  };

  return {
    group,
    engineLights,
    engineMeshes,
    cockpitMesh,
    trailPoints,
    update,
  };
}
