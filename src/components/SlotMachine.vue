<template>
  <div class="model-viewer-container">
    <canvas ref="gameCanvas" class="game-canvas"></canvas>
    <div id="instructions">Press 'F' to toggle full-screen model view | Drag to rotate | Scroll to zoom</div>
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

// --- State ---
const isLoading = ref(true);
const loadError = ref(false);
const isModelFullScreen = ref(false);
const gameCanvas = ref(null);

// --- Core Three.js ---
let renderer, clock;
let topScene, topCamera, bottomScene, bottomCamera;
let model, mixer, controls;
let animationId;
let autoRotate = false; // Auto-rotation disabled as per request

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);

  // --- Top Scene (Model) - Cosmic Purple Theme ---
  topScene = new THREE.Scene();
  topScene.background = new THREE.Color(0x0f0824); // Deep cosmic purple
  topCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  
  // Enhanced lighting with purple/blue tones
  topScene.add(new THREE.AmbientLight(0x7b68ee, 0.6)); // Purple ambient
  const topLight = new THREE.DirectionalLight(0xffd700, 1.0); // Golden main light
  topLight.position.set(5, 10, 7);
  topLight.castShadow = true;
  topLight.shadow.mapSize.width = 2048;
  topLight.shadow.mapSize.height = 2048;
  topScene.add(topLight);

  // Add colorful rim lights
  const rimLight1 = new THREE.DirectionalLight(0xff44aa, 0.5); // Pink rim
  rimLight1.position.set(-5, 3, -5);
  topScene.add(rimLight1);

  const rimLight2 = new THREE.DirectionalLight(0x4488ff, 0.4); // Blue rim
  rimLight2.position.set(3, -2, 4);
  topScene.add(rimLight2);

  // Add some floating particles for atmosphere
  createFloatingParticles(topScene, 50, 0x9370db);

  // --- Bottom Scene (Game Area) - Fiery Orange Theme ---
  bottomScene = new THREE.Scene();
  bottomScene.background = new THREE.Color(0x261100); // Deep orange/black
  bottomCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  
  // Create a more interesting game area
  createGameArea();
  
  // Game area lighting with warm tones
  const bottomAmbient = new THREE.AmbientLight(0xff8c00, 0.5); // Orange ambient
  bottomScene.add(bottomAmbient);

  const bottomLight = new THREE.DirectionalLight(0xff4500, 0.8); // Red-orange main light
  bottomLight.position.set(0, 10, 5);
  bottomScene.add(bottomLight);

  const fillLight = new THREE.DirectionalLight(0xffd700, 0.3); // Golden fill
  fillLight.position.set(-5, 5, -3);
  bottomScene.add(fillLight);

  // --- Controls ---
  controls = new OrbitControls(topCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = true; // ALWAYS ENABLED - even in split view
  controls.minDistance = 1;
  controls.maxDistance = 20;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 1.0;

  loadModel();
  handleResize();
  animate();
};

const createFloatingParticles = (scene, count, color) => {
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  const colorObj = new THREE.Color(color);
  
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 20;
    positions[i + 1] = (Math.random() - 0.5) * 10;
    positions[i + 2] = (Math.random() - 0.5) * 20;
    
    colors[i] = colorObj.r * (0.7 + Math.random() * 0.3);
    colors[i + 1] = colorObj.g * (0.7 + Math.random() * 0.3);
    colors[i + 2] = colorObj.b * (0.7 + Math.random() * 0.3);
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.6
  });
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);
};

const createGameArea = () => {
  // Enhanced grid with gradient colors
  const gridSize = 12;
  const gridDivisions = 12;
  
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0xff8c00, 0x663300);
  gridHelper.position.y = -1;
  bottomScene.add(gridHelper);

  // Add some decorative elements
  const createCrystal = (x, z, color, size = 0.5) => {
    const geometry = new THREE.ConeGeometry(size, size * 2, 4);
    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      metalness: 0.3,
      roughness: 0.2,
      transmission: 0.1
    });
    const crystal = new THREE.Mesh(geometry, material);
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.PI / 4;
    bottomScene.add(crystal);
    return crystal;
  };

  // Create crystal formations around the grid
  createCrystal(-4, -4, 0xff4444, 0.3);
  createCrystal(4, -4, 0x44ff44, 0.4);
  createCrystal(-4, 4, 0x4444ff, 0.35);
  createCrystal(4, 4, 0xffff44, 0.45);

  // Add some floating orbs
  const createOrb = (x, y, z, color, size = 0.2) => {
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6
    });
    const orb = new THREE.Mesh(geometry, material);
    orb.position.set(x, y, z);
    bottomScene.add(orb);
    return orb;
  };

  createOrb(0, 1, 0, 0xff8c00);
  createOrb(2, 1.5, 2, 0xff4500);
  createOrb(-2, 0.8, -2, 0xffd700);
};

const loadModel = () => {
  const loader = new GLTFLoader();
  loader.load('/models/kiljaeden_animated_blockbench.glb', (gltf) => {
    model = gltf.scene;
    topScene.add(model);
    
    // Enable shadows for all meshes
    model.traverse(node => { 
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        // Add some emissive materials for extra glow
        if (node.material) {
          node.material.emissive = new THREE.Color(0x330066);
          node.material.emissiveIntensity = 0.1;
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
      mixer.clipAction(gltf.animations[3]).play();
    }
    
    // Set up initial camera position
    setupCameraForCurrentMode();
    
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
  const scale = 2.0 / maxDim; // Slightly smaller scale for better fit
  model.scale.setScalar(scale);
  
  // Center the model at origin
  const scaledCenter = center.clone().multiplyScalar(scale);
  model.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
  
  // Rotate model to face the camera
  model.rotation.y = Math.PI;
  
  // Update bounding box after scaling/positioning
  modelBoundingBox.setFromObject(model);
  
  console.log('Model positioned:', {
    scale: scale,
    position: model.position,
    size: size
  });
};

// Calculate optimal camera distance for different view modes
const calculateCameraDistance = (forSplitView = false) => {
  const size = modelBoundingBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = topCamera.fov * (Math.PI / 180);
  
  if (forSplitView) {
    // For split view (40% height), we need to be closer and account for reduced vertical space
    return Math.abs(maxDim / Math.sin(fov / 2)) * 0.8; // Closer for split view
  } else {
    // For full screen, standard distance
    return Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;
  }
};

// Set up camera positions based on current mode
const setupCameraForCurrentMode = () => {
  if (isModelFullScreen.value) {
    // Full screen - position camera to see entire model
    const cameraZ = calculateCameraDistance(false);
    topCamera.position.set(0, 0, cameraZ);
    controls.target.set(0, 0, 0);
  } else {
    // Split view - optimized for top 40% area
    const cameraZ = calculateCameraDistance(true);
    topCamera.position.set(0, 0.5, cameraZ); // Slightly higher for better composition
    controls.target.set(0, 0.5, 0);
  }
  controls.update();
};

// Handle mouse events for the correct viewport
const handleMouseEvents = () => {
  // Remove any existing event listeners
  renderer.domElement.removeEventListener('mousedown', handleMouseDown);
  renderer.domElement.removeEventListener('wheel', handleWheel);
  
  // Add new event listeners
  renderer.domElement.addEventListener('mousedown', handleMouseDown);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
};

const handleMouseDown = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouseY = rect.height - (event.clientY - rect.top); // Convert to WebGL coordinates
  
  if (isModelFullScreen.value) {
    // In full screen, always enable controls
    controls.enabled = true;
    autoRotate = false;
    controls.autoRotate = false;
  } else {
    // In split view, only enable controls if clicking in top 40% area
    const topViewStart = rect.height * 0.6; // Bottom of top area in WebGL coords
    if (mouseY > topViewStart) {
      controls.enabled = true;
      autoRotate = false;
      controls.autoRotate = false;
    } else {
      controls.enabled = false;
    }
  }
};

const handleWheel = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouseY = rect.height - (event.clientY - rect.top); // Convert to WebGL coordinates
  
  if (isModelFullScreen.value) {
    // In full screen, always allow zoom
    return; // Let OrbitControls handle it
  } else {
    // In split view, only allow zoom if mouse is in top 40% area
    const topViewStart = rect.height * 0.6; // Bottom of top area in WebGL coords
    if (mouseY > topViewStart) {
      return; // Let OrbitControls handle it
    } else {
      // Prevent zoom if in bottom area
      event.preventDefault();
      return false;
    }
  }
};

// --- Main Render Loop ---
const animate = () => {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  
  // Auto-rotate when not interacting
  if (autoRotate && !isModelFullScreen.value) {
    if (model) {
      model.rotation.y += delta * 0.5; // Slow auto-rotation
    }
  }
  
  if (controls.enabled) {
    controls.update();
  }

  // --- Viewport Calculation ---
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Set renderer size
  renderer.setSize(width, height);
  
  // Clear the entire canvas first
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  if (isModelFullScreen.value) {
    // --- Full Screen Mode: Model takes entire window ---
    topCamera.aspect = width / height;
    topCamera.updateProjectionMatrix();
    
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(topScene, topCamera);
  } else {
    // --- Split View Mode: Top 40% for model, bottom 60% for game ---
    const topViewHeight = height * 0.3;
    const bottomViewHeight = height * 0.7;
    
    // Render Bottom Area (Game) - 60% - at bottom of screen
    bottomCamera.aspect = width / bottomViewHeight;
    bottomCamera.updateProjectionMatrix();
    renderer.setViewport(0, 0, width, bottomViewHeight);
    renderer.setScissor(0, 0, width, bottomViewHeight);
    renderer.render(bottomScene, bottomCamera);
    
    // Render Top Area (Model) - 40% - above the bottom area
    topCamera.aspect = width / topViewHeight;
    topCamera.updateProjectionMatrix();
    renderer.setViewport(0, bottomViewHeight, width, topViewHeight);
    renderer.setScissor(0, bottomViewHeight, width, topViewHeight);
    renderer.render(topScene, topCamera);
  }
};

const handleResize = () => {
  // The resize is handled in the animate loop
};

const toggleFullScreen = () => {
  isModelFullScreen.value = !isModelFullScreen.value;
  
  if (isModelFullScreen.value) {
    // Full screen mode - enable controls and disable auto-rotate
    controls.enabled = true;
    autoRotate = false;
    controls.autoRotate = false;
  } else {
    // Split view mode - enable auto-rotate by default
    controls.enabled = true; // Keep controls enabled but auto-rotate
    autoRotate = true;
  }

  // Update camera position for the new mode
  setupCameraForCurrentMode();
  
  // Force immediate update
  controls.update();
  
  // Update mouse event handling
  handleMouseEvents();
};

// --- Lifecycle ---
onMounted(() => {
  initThreeJS();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', (e) => { 
    if (e.key.toLowerCase() === 'f') {
      toggleFullScreen(); 
    }
  });
  
  // Set up initial mouse event handling
  handleMouseEvents();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  // Clean up mouse event listeners
  renderer.domElement.removeEventListener('mousedown', handleMouseDown);
  renderer.domElement.removeEventListener('wheel', handleWheel);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
});
</script>

<style scoped>
.model-viewer-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0f0824 0%, #261100 100%);
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
  background: rgba(15, 8, 36, 0.9);
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
  background: linear-gradient(135deg, #0f0824 0%, #261100 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
  color: white;
}

.loading-content {
  text-align: center;
  background: rgba(15, 8, 36, 0.8);
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
  top: 40%;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #ff8c00 50%, transparent 100%);
  z-index: 5;
  pointer-events: none;
  opacity: 0.6;
}
</style>