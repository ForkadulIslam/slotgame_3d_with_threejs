<template>
  <div class="model-viewer-container">
    <canvas ref="gameCanvas" class="game-canvas"></canvas>
    <div v-if="isLoading" class="loading-screen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading 3D Model...</div>
      </div>
    </div>
    <div v-if="loadError" class="error-screen">
      <!-- Error content -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// --- State ---
const isLoading = ref(true);
const loadError = ref(false);
const isModelFullScreen = ref(false);
const gameCanvas = ref(null);

// --- Core Three.js ---
let renderer, clock;
let topScene, topCamera, bottomScene, bottomCamera;
let model, mixer, controls, sun;
let animationId;
let autoRotate = false;
let animateEnvironment = null;

// Store model info for camera calculations
let modelBoundingBox = new THREE.Box3();

// --- Main Setup ---
const initThreeJS = () => {
  clock = new THREE.Clock();
  
  renderer = new THREE.WebGLRenderer({ 
    canvas: gameCanvas.value, 
    antialias: true 
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.setScissorTest(true);

  // --- Top Scene (Model) - Enhanced Ancient Theme ---
  topScene = new THREE.Scene();
  topCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  
  initSky();
  
  // Enhanced lighting for ancient warrior
  setupWarriorLighting();

  // --- Bottom Scene (Game Area) - Consistent with original ---
  bottomScene = new THREE.Scene();
  bottomScene.background = new THREE.Color(0x201525);
  bottomCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  
  // Keep original grid but enhance it
  const gridHelper = new THREE.GridHelper(10, 10, 0xff8c00, 0x663300);
  gridHelper.position.y = -1;
  bottomScene.add(gridHelper);

  // Add some simple decorative elements
  const bottomLight = new THREE.DirectionalLight(0xff4500, 0.8);
  bottomLight.position.set(0, 10, 5);
  bottomScene.add(bottomLight);
  bottomScene.add(new THREE.AmbientLight(0xff8c00, 0.4));

  // --- Controls ---
  controls = new OrbitControls(topCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = true;
  controls.minDistance = 1.5;
  controls.maxDistance = 15;
  controls.autoRotate = autoRotate;

  loadModel();
  handleResize();
  animate();
};


const initSky = () => {
  sun = new THREE.Vector3();

  const sky = new Sky();
  sky.scale.setScalar(1000);
  
  const effectController = {
    turbidity: 40,         // Much more haze/dust, darker sky
    rayleigh: 8,           // Even more red scattering
    mieCoefficient: 0.05,  // Much brighter, more defined sun halo
    mieDirectionalG: 0.9,  // More focused sun halo
    elevation: 0,          // Sun exactly on the horizon
    azimuth: 180,
  };

  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = effectController.turbidity;
  uniforms['rayleigh'].value = effectController.rayleigh;
  uniforms['mieCoefficient'].value = effectController.mieCoefficient;
  uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);
  uniforms['sunPosition'].value.copy(sun);

  // Use a temporary scene to generate the environment map
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const tempScene = new THREE.Scene();
  tempScene.add(sky);
  const renderTarget = pmremGenerator.fromScene(tempScene);
  
  topScene.environment = renderTarget.texture;
  topScene.background = renderTarget.texture;
};


const createMagicLamp = () => {
  // --- Lamp Base ---
  const lampBaseGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.3, 32);
  const lampBaseMat = new THREE.MeshStandardMaterial({
    color: 0xffd700, // gold
    metalness: 1,
    roughness: 0.2,
  });
  const lampBase = new THREE.Mesh(lampBaseGeo, lampBaseMat);
  lampBase.castShadow = true;
  lampBase.receiveShadow = true;

  // --- Lamp Position (Left side of top scene) ---
  lampBase.position.set(-1.3, -0.5, .05); 
  topScene.add(lampBase);

  // --- Magical Flame ---
  const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 32);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    emissive: 0xff4500,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.85,
  });

  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, 0.45, 0);
  flame.rotation.x = Math.PI;

  lampBase.add(flame);

  // --- Flame Flicker Animation (store in animateEnvironment) ---
  let t = 0;
  animateEnvironment = () => {
    t += 0.08;
    const scale = 1 + Math.sin(t) * 0.15;
    flame.scale.set(1, scale, 1);

    // Mild flickering color
    flame.material.emissiveIntensity =
      1.8 + Math.sin(Date.now() * 0.005) * 0.6;
  };
};


const setupWarriorLighting = () => {
  // 1. BACKLIGHT (The Sun) - creates a rim light effect from the sunset
  const mainLight = new THREE.DirectionalLight(0xffd700, 1.5);
  mainLight.position.copy(sun);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 50;
  topScene.add(mainLight);

  // 2. AMBIENT FILL - simulates general bounced light from the environment
  const hemisphereLight = new THREE.HemisphereLight(0x443355, 0x885533, 0.6); // Slightly toned down
  topScene.add(hemisphereLight);

  // 3. KEY LIGHT (Hero Light) - a more intense and focused main light for the front
  const heroLight = new THREE.SpotLight(0xffeedd, 3.5, 45, Math.PI / 5, 0.4, 1);
  heroLight.position.set(2, 5, 5); // Raised higher
  heroLight.target.position.set(0, 1.2, 0);
  heroLight.castShadow = true;
  heroLight.shadow.mapSize.width = 2048;
  heroLight.shadow.mapSize.height = 2048;
  topScene.add(heroLight);
  topScene.add(heroLight.target);
  
  // 4. BOUNCE FILL - a soft light from the front-left to soften shadows
  const bounceLight = new THREE.DirectionalLight(0xffaa55, 0.6);
  bounceLight.position.set(-3, 2, 5);
  topScene.add(bounceLight);
};

const loadModel = () => {
  const loader = new GLTFLoader();
  loader.load('/models/holy_dragon_arena_of_valor.glb', (gltf) => {
    model = gltf.scene;
    topScene.add(model);
    
    // Enhanced material processing for better look
    model.traverse(node => { 
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        // More balanced PBR material properties
        node.material.roughness = 0.4;
        node.material.metalness = 0.6;

        // Fire-like emissive for glowing areas (names may vary depending on model)
        if (
        node.material.name?.toLowerCase().includes("fire") ||
        node.material.name?.toLowerCase().includes("glow") ||
        node.material.name?.toLowerCase().includes("energy")
        ) {
        
            node.material.emissive = node.material.emissive || new THREE.Color(0x000000);
            node.material.emissiveIntensity = 0.25;  

        
        }
      }
    });

    // Calculate and store model bounding box
    modelBoundingBox.setFromObject(model);
    
    // Position and scale the model properly
    positionAndScaleModel();
    
    // Setup animations
    mixer = new THREE.AnimationMixer(model);
    mixer.timeScale = 1;
    if (gltf.animations.length > 0) {
      mixer.clipAction(gltf.animations[4]).play();
    }
    
    // Set up initial camera position
    setupCameraForCurrentMode();
    
    createMagicLamp();
    isLoading.value = false;
  }, undefined, (error) => {
    console.error('Error loading model:', error);
    loadError.value = true;
  });
};

// Position and scale the model to fit properly
const positionAndScaleModel = () => {
  if (!model) return;
  
  const center = modelBoundingBox.getCenter(new THREE.Vector3());
  const size = modelBoundingBox.getSize(new THREE.Vector3());
  
  // Calculate scale to fit the model nicely
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.0 / maxDim;
  model.scale.setScalar(scale);
  
  // Center the model at origin
  const scaledCenter = center.clone().multiplyScalar(scale);
  model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
  
  // Update bounding box after scaling/positioning
  modelBoundingBox.setFromObject(model);
};

// Calculate optimal camera distance for different view modes
const calculateCameraDistance = (forSplitView = false) => {
  const size = modelBoundingBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = topCamera.fov * (Math.PI / 180);
  
  if (forSplitView) {
    return Math.abs(maxDim / Math.sin(fov / 2)); // Move camera further away for smaller model
  } else {
    return Math.abs(maxDim / Math.sin(fov / 2));
  }
};

// Set up camera positions based on current mode
const setupCameraForCurrentMode = () => {
  if (isModelFullScreen.value) {
    const cameraZ = calculateCameraDistance(false);
    topCamera.position.set(0, 0, cameraZ);
    controls.target.set(0, 0, 0);
  } else {
    const cameraZ = calculateCameraDistance(true);
    console.log(cameraZ)
    topCamera.position.set(0, 0, cameraZ-3);
    controls.target.set(0, 0, 0);
  }
  controls.update();
};

// Handle mouse events for the correct viewport
const handleMouseEvents = () => {
  renderer.domElement.removeEventListener('mousedown', handleMouseDown);
  renderer.domElement.removeEventListener('wheel', handleWheel);
  
  renderer.domElement.addEventListener('mousedown', handleMouseDown);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
};

const handleMouseDown = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouseY = rect.height - (event.clientY - rect.top);
  
  if (!isModelFullScreen.value) {
    const topViewStart = rect.height * 0.7;
    controls.enabled = (mouseY > topViewStart);
  }
};

const handleWheel = (event) => {
  if (!isModelFullScreen.value) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseY = rect.height - (event.clientY - rect.top);
    const topViewStart = rect.height * 0.7;
    
    if (mouseY <= topViewStart) {
      event.preventDefault();
    }
  }
};

// --- Main Render Loop ---
const animate = () => {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  
  if (controls.enabled) {
    controls.update();
  }

  if (animateEnvironment) animateEnvironment();

  // --- Viewport Calculation ---
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  renderer.setSize(width, height);
  
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  if (isModelFullScreen.value) {
    topCamera.aspect = width / height;
    topCamera.updateProjectionMatrix();
    
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(topScene, topCamera);
  } else {
    const topViewHeight = height * 0.3;
    const bottomViewHeight = height * 0.7;
    
    // Render Bottom Area (Game)
    bottomCamera.aspect = width / bottomViewHeight;
    bottomCamera.updateProjectionMatrix();
    renderer.setViewport(0, 0, width, bottomViewHeight);
    renderer.setScissor(0, 0, width, bottomViewHeight);
    renderer.render(bottomScene, bottomCamera);
    
    // Render Top Area (Model)
    topCamera.aspect = width / topViewHeight;
    topCamera.updateProjectionMatrix();
    renderer.setViewport(0, bottomViewHeight, width, topViewHeight);
    renderer.setScissor(0, bottomViewHeight, width, topViewHeight);
    renderer.render(topScene, topCamera);
  }
};

const handleResize = () => {
  // Handled in animate loop
};

const toggleFullScreen = () => {
  isModelFullScreen.value = !isModelFullScreen.value;
  setupCameraForCurrentMode();
  controls.update();
  handleMouseEvents();
};

// --- Lifecycle ---
onMounted(() => {
  initThreeJS();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', (e) => { 
    if (e.key.toLowerCase() === 'f') toggleFullScreen(); 
  });
  handleMouseEvents();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  renderer.domElement.removeEventListener('mousedown', handleMouseDown);
  renderer.domElement.removeEventListener('wheel', handleWheel);
  if (animationId) cancelAnimationFrame(animationId);
  if (renderer) renderer.dispose();
});
</script>

<style scoped>
.model-viewer-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0a0a1a 0%, #201525 100%);
  overflow: hidden;
  cursor: grab;
}

.model-viewer-container:active {
  cursor: grabbing;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

#instructions {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffd700;
  font-family: 'Arial', sans-serif;
  background: rgba(10, 10, 26, 0.9);
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  z-index: 10;
  border: 2px solid #ff8c00;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.5);
  font-weight: bold;
  backdrop-filter: blur(10px);
  text-align: center;
  max-width: 90%;
  white-space: nowrap;
}

.loading-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a0a1a 0%, #201525 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
  color: white;
}

.loading-content {
  text-align: center;
  background: rgba(10, 10, 26, 0.8);
  padding: 40px;
  border-radius: 20px;
  border: 2px solid #7b68ee;
  box-shadow: 0 0 30px rgba(123, 104, 238, 0.4);
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #333;
  border-top: 4px solid #ff8c00;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
}

.loading-text {
  font-size: 18px;
  color: #ffd700;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Add some responsive adjustments */
@media (max-width: 768px) {
  #instructions {
    font-size: 11px;
    padding: 8px 16px;
    bottom: 15px;
    white-space: normal;
    max-width: 85%;
  }
  
  .loading-content {
    padding: 30px;
    margin: 20px;
  }
}

/* Add a subtle divider line between sections in split view */
.model-viewer-container::before {
  content: '';
  position: absolute;
  top: 30%;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #ff8c00 50%, transparent 100%);
  z-index: 5;
  pointer-events: none;
  opacity: 0.6;
}
</style>