import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const loader = new OBJLoader();
const modelCache = new Map<string, THREE.Group>();

export async function loadModel(name: string): Promise<THREE.Group> {
  if (modelCache.has(name)) {
    return modelCache.get(name)!.clone();
  }

  try {
    const group = await loader.loadAsync(`/models/${name}.obj`);
    
    // Center and normalize the model
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1 / maxDim;
    
    group.position.sub(center);
    group.scale.setScalar(scale);
    
    // Cache the original
    modelCache.set(name, group);
    
    return group.clone();
  } catch (error) {
    console.warn(`Failed to load model: ${name}`, error);
    // Return empty group as fallback
    return new THREE.Group();
  }
}

export async function preloadModels(modelNames: string[]): Promise<void> {
  const promises = modelNames.map(name => loadModel(name));
  await Promise.all(promises);
}

export function clearModelCache(): void {
  modelCache.forEach((group) => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  });
  modelCache.clear();
}
