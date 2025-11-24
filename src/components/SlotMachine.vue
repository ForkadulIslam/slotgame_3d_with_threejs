<template>
  <div class="model-viewer-container">
    <!-- Three.js Canvas -->
    <canvas ref="gameCanvas" class="game-canvas"></canvas>
    
    <!-- Controls Overlay -->
    <div class="controls-overlay">
      <div class="control-panel">
        <h3>3D Model Viewer</h3>
        
        <div class="model-info">
          <div class="info-item">
            <span class="label">Model Status:</span>
            <span class="value" :class="modelStatusClass">{{ modelStatus }}</span>
          </div>
          <div class="info-item" v-if="modelStats">
            <span class="label">Triangles:</span>
            <span class="value">{{ modelStats.triangles.toLocaleString() }}</span>
          </div>
          <div class="info-item" v-if="modelStats">
            <span class="label">Materials:</span>
            <span class="value">{{ modelStats.materials }}</span>
          </div>
        </div>

        <div class="control-buttons">
          <button @click="resetCamera" class="control-btn">
            Reset View
          </button>
          <button @click="toggleAutoRotate" class="control-btn">
            {{ autoRotate ? 'Stop Rotation' : 'Auto Rotate' }}
          </button>
          <button @click="toggleWireframe" class="control-btn">
            {{ showWireframe ? 'Normal View' : 'Wireframe' }}
          </button>
          <button @click="toggleDebugPanel" class="control-btn">
            {{ showDebugPanel ? 'Hide Debug' : 'Show Debug' }}
          </button>
          <button @click="fitCameraToModel" class="control-btn">
            Fit to Model
          </button>
        </div>
      </div>
    </div>

    <!-- Debug Panel -->
    <div v-if="showDebugPanel" class="debug-panel">
      <div class="debug-header">
        <h4>Camera Debug</h4>
        <button @click="toggleDebugPanel" class="debug-close">×</button>
      </div>
      
      <div class="debug-content">
        <div class="debug-section">
          <h5>Camera Position</h5>
          <div class="debug-values">
            <div class="debug-item">
              <span class="debug-label">X:</span>
              <span class="debug-value">{{ cameraPosition.x.toFixed(2) }}</span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Y:</span>
              <span class="debug-value">{{ cameraPosition.y.toFixed(2) }}</span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Z:</span>
              <span class="debug-value">{{ cameraPosition.z.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="debug-section">
          <h5>Camera Controls</h5>
          <div class="camera-controls-grid">
            <button @click="cameraMove('up')" class="cam-btn">↑ Up</button>
            <button @click="cameraMove('down')" class="cam-btn">↓ Down</button>
            <button @click="cameraMove('left')" class="cam-btn">← Left</button>
            <button @click="cameraMove('right')" class="cam-btn">Right →</button>
            <button @click="cameraMove('forward')" class="cam-btn">↗ In</button>
            <button @click="cameraMove('backward')" class="cam-btn">↙ Out</button>
          </div>
        </div>

        <div class="debug-section">
          <h5>Camera Presets</h5>
          <div class="preset-buttons">
            <button @click="applyCameraPreset('front')" class="preset-btn">Front</button>
            <button @click="applyCameraPreset('top')" class="preset-btn">Top</button>
            <button @click="applyCameraPreset('side')" class="preset-btn">Side</button>
            <button @click="applyCameraPreset('diagonal')" class="preset-btn">Diagonal</button>
          </div>
        </div>

        <div class="debug-section" v-if="modelStats">
          <h5>Model Info</h5>
          <div class="debug-values">
            <div class="debug-item">
              <span class="debug-label">Position:</span>
              <span class="debug-value">{{ modelPosition.x.toFixed(2) }}, {{ modelPosition.y.toFixed(2) }}, {{ modelPosition.z.toFixed(2) }}</span>
            </div>
            <div class="debug-item">
              <span class="debug-label">Scale:</span>
              <span class="debug-value">{{ modelScale.x.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="debug-section">
          <h5>Quick Actions</h5>
          <div class="action-buttons">
            <button @click="copyCameraPosition" class="action-btn">Copy Position</button>
            <button @click="addCameraHelper" class="action-btn">Show Camera Helper</button>
            <button @click="logDebugInfo" class="action-btn">Log to Console</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Screen -->
    <div v-if="isLoading" class="loading-screen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading 3D Model...</div>
        <div class="loading-progress" v-if="loadingProgress > 0">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ Math.round(loadingProgress) }}%</div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="loadError" class="error-screen">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Model</h3>
        <p>{{ errorMessage }}</p>
        <button @click="retryLoad" class="retry-btn">Retry Loading</button>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions">
      Drag to rotate • Pinch to zoom • {{ showDebugPanel ? 'Debug panel active' : 'Press Show Debug for tools' }}
    </div>

    <!-- Position Indicator -->
    <div v-if="showDebugPanel" class="position-indicator">
      <div class="indicator-content">
        <div class="indicator-item">
          <span class="indicator-label">Cam:</span>
          <span class="indicator-value">{{ cameraPosition.x.toFixed(1) }}, {{ cameraPosition.y.toFixed(1) }}, {{ cameraPosition.z.toFixed(1) }}</span>
        </div>
        <div class="indicator-item" v-if="model">
          <span class="indicator-label">Target:</span>
          <span class="indicator-value">{{ controls.target.x.toFixed(1) }}, {{ controls.target.y.toFixed(1) }}, {{ controls.target.z.toFixed(1) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Model state
const isLoading = ref(true);
const loadError = ref(false);
const errorMessage = ref('');
const loadingProgress = ref(0);
const modelStatus = ref('Loading...');
const modelStatusClass = ref('status-loading');
const modelStats = ref(null);
const autoRotate = ref(false);
const showWireframe = ref(false);
const showDebugPanel = ref(false);

// Debug state
const cameraPosition = reactive({ x: 0, y: 0, z: 0 });
const modelPosition = reactive({ x: 0, y: 0, z: 0 });
const modelScale = reactive({ x: 1, y: 1, z: 1 });

// Three.js references
const gameCanvas = ref(null);
let scene, camera, renderer, controls, model, mixer;
let animationId;
let clock;

// Camera presets
const cameraPresets = {
  front: { position: { x: 0, y: 0, z: 10 }, target: { x: 0, y: 0, z: 0 } },
  top: { position: { x: 0, y: 10, z: 0 }, target: { x: 0, y: 0, z: 0 } },
  side: { position: { x: 10, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
  diagonal: { position: { x: 5, y: 5, z: 5 }, target: { x: 0, y: 0, z: 0 } }
};

// Initialize Three.js
const initThreeJS = () => {
  // Initialize clock
  clock = new THREE.Clock();
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0a2a);
  
  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 10);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: gameCanvas.value,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // OrbitControls for interactive viewing
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = autoRotate.value;
  controls.autoRotateSpeed = 1.0;
  controls.minDistance = 2;
  controls.maxDistance = 20;
  
  // Lighting
  setupLighting();
  
  // Add helpers for debugging
  addDebugHelpers();
  
  // Load the model
  loadModel();
  
  // Handle resize
  handleResize();
  
  // Start animation loop
  animate();
};

// Setup lighting
const setupLighting = () => {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  // Directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);
  
  // Fill light
  const fillLight = new THREE.DirectionalLight(0x4477ff, 0.3);
  fillLight.position.set(-5, 5, 5);
  scene.add(fillLight);
};

// Add debug helpers
const addDebugHelpers = () => {
  // Grid helper
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
  scene.add(gridHelper);
  
  // Axes helper
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
};

// Load the GLB model
const loadModel = () => {
  const loader = new GLTFLoader();
  
  modelStatus.value = 'Loading model...';
  modelStatusClass.value = 'status-loading';
  
  loader.load(
    // Update this path to your actual model location
    '/models/kiljaeden_animated_blockbench.glb',
    
    // onLoad callback
    (gltf) => {
      model = gltf.scene;
      scene.add(model);
      
      // Center and scale the model
      centerModel();
      
      // Analyze model structure
      analyzeModel();
      
      // Setup animations if available
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.timeScale = 0.1; // Set animation speed to 10%
        // Play only the first animation clip
        const firstClip = gltf.animations[1];
        mixer.clipAction(firstClip).play();
      }
      
      // Update UI
      isLoading.value = false;
      modelStatus.value = 'Model Loaded Successfully';
      modelStatusClass.value = 'status-success';
      
      // Update debug info
      updateDebugInfo();
      
      console.log('Model loaded successfully!', model);
    },
    
    // onProgress callback
    (progress) => {
      const percent = (progress.loaded / progress.total) * 100;
      loadingProgress.value = percent;
      modelStatus.value = `Loading: ${percent.toFixed(1)}%`;
    },
    
    // onError callback
    (error) => {
      console.error('Error loading model:', error);
      isLoading.value = false;
      loadError.value = true;
      errorMessage.value = error.message || 'Failed to load 3D model';
      modelStatus.value = 'Load Failed';
      modelStatusClass.value = 'status-error';
      
      // Create fallback model
      createFallbackModel();
    }
  );
};

// Center the model in the view
const centerModel = () => {
  if (!model) return;
  
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  console.log(center.y)
  // Center the model
  model.position.x = -center.x;
  model.position.y = -center.y+4;
  model.position.z = -center.z-5;
  
  // Rotate the model 180 degrees to face the camera
  model.rotation.y = Math.PI;
  
  // Adjust camera to fit the model
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
  
  // Add some padding
  cameraZ *= 1.5;
  camera.position.set(0, maxDim * 0.5, cameraZ);
  camera.lookAt(0, 0, 0);
  
  controls.update();
  updateDebugInfo();
};

// Analyze the model structure
const analyzeModel = () => {
  if (!model) return;
  
  let triangleCount = 0;
  const materialSet = new Set();
  
  model.traverse((child) => {
    if (child.isMesh) {
      // Count triangles
      if (child.geometry) {
        triangleCount += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
      }
      
      // Count materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            materialSet.add(material.uuid);
          });
        } else {
          materialSet.add(child.material.uuid);
        }
      }
    }
  });
  
  modelStats.value = {
    triangles: Math.round(triangleCount),
    materials: materialSet.size
  };
  
  console.log('Model Analysis:', modelStats.value);
  logModelStructure(model);
};

// Log the model structure to console
const logModelStructure = (object, depth = 0) => {
  const indent = '  '.repeat(depth);
  console.log(`${indent}${object.type}: ${object.name || 'unnamed'} (${object.uuid})`);
  
  if (object.children) {
    object.children.forEach(child => {
      logModelStructure(child, depth + 1);
    });
  }
};

// Create fallback model if loading fails
const createFallbackModel = () => {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xff6b00,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const fallbackModel = new THREE.Mesh(geometry, material);
  scene.add(fallbackModel);
  console.log('Created fallback model');
};

// Update debug information
const updateDebugInfo = () => {
  cameraPosition.x = camera.position.x;
  cameraPosition.y = camera.position.y;
  cameraPosition.z = camera.position.z;
  
  if (model) {
    modelPosition.x = model.position.x;
    modelPosition.y = model.position.y;
    modelPosition.z = model.position.z;
    modelScale.x = model.scale.x;
    modelScale.y = model.scale.y;
    modelScale.z = model.scale.z;
  }
};

// Debug functions
const toggleDebugPanel = () => {
  showDebugPanel.value = !showDebugPanel.value;
};

const cameraMove = (direction) => {
  const step = 0.5;
  switch (direction) {
    case 'left': camera.position.x -= step; break;
    case 'right': camera.position.x += step; break;
    case 'up': camera.position.y += step; break;
    case 'down': camera.position.y -= step; break;
    case 'forward': camera.position.z -= step; break;
    case 'backward': camera.position.z += step; break;
  }
  controls.update();
  updateDebugInfo();
};

const applyCameraPreset = (presetName) => {
  const preset = cameraPresets[presetName];
  if (preset) {
    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    controls.target.set(preset.target.x, preset.target.y, preset.target.z);
    controls.update();
    updateDebugInfo();
    console.log(`Applied ${presetName} camera preset`);
  }
};

const fitCameraToModel = () => {
  if (!model) return;
  
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;
  
  camera.position.set(0, center.y, cameraZ);
  controls.target.copy(center);
  controls.update();
  updateDebugInfo();
};

const copyCameraPosition = () => {
  const position = `{ x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)} }`;
  const target = `{ x: ${controls.target.x.toFixed(2)}, y: ${controls.target.y.toFixed(2)}, z: ${controls.target.z.toFixed(2)} }`;
  const text = `Camera Position: ${position}\nCamera Target: ${target}`;
  
  navigator.clipboard.writeText(text).then(() => {
    console.log('Camera position copied to clipboard:', text);
    alert('Camera position copied to clipboard!');
  });
};

const addCameraHelper = () => {
  const cameraHelper = new THREE.CameraHelper(camera);
  scene.add(cameraHelper);
  
  // Remove helper after 3 seconds
  setTimeout(() => {
    scene.remove(cameraHelper);
  }, 3000);
};

const logDebugInfo = () => {
  console.log('=== DEBUG INFO ===');
  console.log('Camera Position:', camera.position);
  console.log('Camera Target:', controls.target);
  console.log('Camera FOV:', camera.fov);
  if (model) {
    console.log('Model Position:', model.position);
    console.log('Model Scale:', model.scale);
  }
};

// Existing functions
const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value;
  controls.autoRotate = autoRotate.value;
};

const toggleWireframe = () => {
  showWireframe.value = !showWireframe.value;
  
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            material.wireframe = showWireframe.value;
          });
        } else {
          child.material.wireframe = showWireframe.value;
        }
      }
    });
  }
};

const resetCamera = () => {
  camera.position.set(5, 3, 8);
  camera.lookAt(0, 0, 0);
  controls.reset();
  updateDebugInfo();
};

const retryLoad = () => {
  loadError.value = false;
  isLoading.value = true;
  loadingProgress.value = 0;
  
  // Remove old model if exists
  if (model) {
    scene.remove(model);
    model = null;
  }
  
  // Remove old mixer if exists
  if (mixer) {
    mixer = null;
  }
  
  loadModel();
};

// Animation loop
const animate = () => {
  animationId = requestAnimationFrame(animate);
  
  // Get delta time from clock
  const delta = clock.getDelta();
  
  // Update animations with delta time
  if (mixer) {
    mixer.update(delta);
  }
  
  // Update controls
  if (controls) {
    controls.update();
  }
  
  // Update debug info
  if (showDebugPanel.value) {
    updateDebugInfo();
  }
  
  renderer.render(scene, camera);
};

// Handle window resize
const handleResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Update camera
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(width, height);
};

// Lifecycle
onMounted(() => {
  initThreeJS();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
});
</script>

<style scoped>
/* Existing styles remain the same, add these new styles */

.model-viewer-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
  font-family: 'Arial', sans-serif;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.controls-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  display:none
}

.control-panel {
  background: rgba(0, 0, 0, 0.9);
  padding: 20px;
  border-radius: 15px;
  border: 1px solid #333;
  backdrop-filter: blur(10px);
  min-width: 280px;
  max-width: 90vw;
}

.control-panel h3 {
  color: #FFD700;
  margin: 0 0 15px 0;
  font-size: 16px;
  text-align: center;
}

.model-info {
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-item .label {
  color: #aaa;
}

.info-item .value {
  color: white;
  font-weight: bold;
}

.status-loading {
  color: #FFA500 !important;
}

.status-success {
  color: #00FF00 !important;
}

.status-error {
  color: #FF4444 !important;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-btn {
  background: linear-gradient(145deg, #333, #555);
  border: 1px solid #666;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.control-btn:hover {
  background: linear-gradient(145deg, #444, #666);
  border-color: #FFD700;
  transform: translateY(-1px);
}

/* Debug Panel */
.debug-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid #444;
  border-radius: 15px;
  backdrop-filter: blur(10px);
  z-index: 15;
  max-width: 350px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #444;
}

.debug-header h4 {
  color: #FFD700;
  margin: 0;
  font-size: 16px;
}

.debug-close {
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.debug-close:hover {
  color: white;
}

.debug-content {
  padding: 20px;
}

.debug-section {
  margin-bottom: 20px;
}

.debug-section h5 {
  color: #FFD700;
  margin: 0 0 10px 0;
  font-size: 14px;
}

.debug-values {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 8px;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
}

.debug-item:last-child {
  margin-bottom: 0;
}

.debug-label {
  color: #aaa;
}

.debug-value {
  color: white;
  font-family: 'Courier New', monospace;
}

.camera-controls-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.cam-btn {
  background: #555;
  border: 1px solid #666;
  color: white;
  padding: 8px 5px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.cam-btn:hover {
  background: #666;
  border-color: #FFD700;
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.preset-btn {
  background: #444;
  border: 1px solid #555;
  color: white;
  padding: 8px 5px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: #555;
  border-color: #FFD700;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.action-btn {
  background: #333;
  border: 1px solid #444;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #444;
  border-color: #FFD700;
}

/* Position Indicator */
.position-indicator {
  position: absolute;
  bottom: 60px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 15px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  border: 1px solid #333;
  z-index: 10;
}

.indicator-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.indicator-item {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.indicator-label {
  color: #FFD700;
  font-weight: bold;
}

.indicator-value {
  color: white;
  font-family: 'Courier New', monospace;
}

/* Loading Screen, Error Screen, Instructions - keep existing styles */
.loading-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 10, 26, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
}

.loading-content {
  text-align: center;
  color: white;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #333;
  border-top: 4px solid #FFD700;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.loading-text {
  font-size: 18px;
  margin-bottom: 15px;
  color: #FFD700;
}

.loading-progress {
  width: 200px;
  margin: 0 auto;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFD700, #FF6B00);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #aaa;
}

.error-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 10, 26, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
}

.error-content {
  text-align: center;
  color: white;
  background: rgba(255, 0, 0, 0.1);
  padding: 30px;
  border-radius: 15px;
  border: 1px solid #ff4444;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.error-content h3 {
  color: #ff4444;
  margin: 0 0 10px 0;
}

.error-content p {
  color: #aaa;
  margin: 0 0 20px 0;
}

.retry-btn {
  background: linear-gradient(145deg, #ff4444, #cc0000);
  border: none;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: linear-gradient(145deg, #ff5555, #dd0000);
  transform: translateY(-1px);
}

.instructions {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffffff;
  background: rgba(0, 0, 0, 0.5);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  pointer-events: none;
  text-align: center;
  backdrop-filter: blur(10px);
  z-index: 10;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .controls-overlay {
    top: 10px;
    left: 10px;
    right: 10px;
  }
  
  .control-panel {
    padding: 15px;
    min-width: auto;
  }
  
  .control-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .control-btn {
    padding: 8px 12px;
    font-size: 12px;
  }
  
  .debug-panel {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
  
  .position-indicator {
    bottom: 50px;
    left: 10px;
    right: 10px;
  }
  
  .instructions {
    font-size: 11px;
    padding: 6px 12px;
    bottom: 15px;
  }
}

@media (max-width: 480px) {
  .control-panel {
    padding: 12px;
  }
  
  .control-buttons {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  
  .control-btn {
    padding: 6px 10px;
    font-size: 11px;
  }
  
  .debug-content {
    padding: 15px;
  }
  
  .camera-controls-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .instructions {
    font-size: 10px;
    padding: 5px 10px;
  }
  
  .position-indicator {
    padding: 8px 12px;
  }
  
  .indicator-item {
    font-size: 10px;
  }
}

/* Prevent overlap on very small screens */
@media (max-width: 320px) {
  .controls-overlay {
    top: 5px;
    left: 5px;
    right: 5px;
  }
  
  .debug-panel {
    top: 5px;
    right: 5px;
    left: 5px;
  }
  
  .position-indicator {
    bottom: 40px;
    left: 5px;
    right: 5px;
  }
  
  .instructions {
    bottom: 5px;
  }
}
</style>