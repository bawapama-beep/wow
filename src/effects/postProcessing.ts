import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// Custom color grading shader
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 1.0 },
    contrast: { value: 1.1 },
    saturation: { value: 1.2 },
    tint: { value: new THREE.Vector3(0.95, 1.0, 1.05) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 tint;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Brightness
      color.rgb *= brightness;
      
      // Contrast
      color.rgb = (color.rgb - 0.5) * contrast + 0.5;
      
      // Saturation
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(gray), color.rgb, saturation);
      
      // Tint
      color.rgb *= tint;
      
      gl_FragColor = color;
    }
  `,
};

export interface PostProcessingSetup {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  update: () => void;
  setQuality: (quality: 'low' | 'medium' | 'high') => void;
  resize: (width: number, height: number) => void;
}

export function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): PostProcessingSetup {
  const composer = new EffectComposer(renderer);
  
  // Base render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Bloom (the most impactful effect)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5,   // strength
    0.4,   // radius
    0.85   // threshold
  );
  composer.addPass(bloomPass);
  
  // Color grading
  const colorGradePass = new ShaderPass(ColorGradeShader);
  composer.addPass(colorGradePass);
  
  // Anti-aliasing (FXAA)
  const fxaaPass = new ShaderPass(FXAAShader);
  const pixelRatio = renderer.getPixelRatio();
  fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
  fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
  composer.addPass(fxaaPass);
  
  // Quality presets
  const setQuality = (quality: 'low' | 'medium' | 'high') => {
    switch (quality) {
      case 'low':
        bloomPass.enabled = false;
        fxaaPass.enabled = false;
        break;
      case 'medium':
        bloomPass.enabled = true;
        bloomPass.strength = 0.3;
        fxaaPass.enabled = false;
        break;
      case 'high':
        bloomPass.enabled = true;
        bloomPass.strength = 0.5;
        fxaaPass.enabled = true;
        break;
    }
  };
  
  // Auto-detect quality based on device
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  setQuality(isMobile ? 'low' : 'high');
  
  const update = () => {
    composer.render();
  };
  
  const resize = (width: number, height: number) => {
    composer.setSize(width, height);
    const pr = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pr);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pr);
  };
  
  return { composer, bloomPass, update, setQuality, resize };
}
