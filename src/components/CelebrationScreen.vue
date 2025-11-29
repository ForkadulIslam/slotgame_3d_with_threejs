<template>
  <div class="celebration-container">
    <canvas ref="celebrationCanvas"></canvas>
    
    <div class="celebration-ui">
      <!-- Number Display -->
      <div class="number-display" :class="{ 'pulse': isCounting }">
        <span class="number" ref="numberElement">0</span>
        <span class="currency">$</span>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container">
        <div class="progress-bar" :style="{ width: progress + '%' }"></div>
      </div>

      <!-- Control Buttons -->
      <div class="controls">
        <button class="start-btn" @click="startCelebration" :disabled="isCounting">
          🎉 START CELEBRATION
        </button>
        <button class="reset-btn" @click="resetCelebration">
          🔄 RESET
        </button>
      </div>

      <!-- Status Message -->
      <div class="status-message" :class="{ 'visible': statusMessage }">
        {{ statusMessage }}
      </div>
    </div>

    <!-- Celebration Overlay -->
    <div class="celebration-overlay" :class="{ 'active': isExploding }">
      <div class="golden-glow"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const celebrationCanvas = ref(null);
const numberElement = ref(null);

// State
const isCounting = ref(false);
const isExploding = ref(false);
const progress = ref(0);
const statusMessage = ref('');
const currentNumber = ref(0);
const targetNumber = ref(1000);
const duration = 5000; // 5 seconds

// Three.js variables
let scene, camera, renderer, composer;
let particles = [];
let goldenExplosion = null;
let confettiSystems = [];
let animationId = null;

// Shaders for golden effects
const GoldenParticleShader = {
  uniforms: {
    time: { value: 0.0 },
    size: { value: 100.0 },
    progress: { value: 0.0 }
  },
  vertexShader: `
    uniform float time;
    uniform float size;
    uniform float progress;
    attribute float scale;
    attribute vec3 velocity;
    attribute float life;
    attribute vec3 color;
    varying float vLife;
    varying vec3 vColor;
    
    void main() {
      vLife = life;
      vColor = color;
      
      // Explosive movement
      vec3 pos = position + velocity * time * progress * 3.0;
      
      // Add some turbulence
      pos.x += sin(time * 5.0 + position.y) * 0.5 * progress;
      pos.z += cos(time * 4.0 + position.x) * 0.5 * progress;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * scale * (1.0 / -mvPosition.z) * progress;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float progress;
    varying float vLife;
    varying vec3 vColor;
    
    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      
      // Golden glow with sparkle
      float alpha = (1.0 - smoothstep(0.0, 0.5, dist * 2.0)) * vLife * progress;
      
      // Sparkle effect
      float sparkle = sin(gl_PointCoord.x * 100.0) * sin(gl_PointCoord.y * 100.0) * 0.5 + 0.5;
      alpha *= sparkle;
      
      if(alpha < 0.01) discard;
      
      vec3 finalColor = vColor * (1.0 + dist * 0.8); // Brighter edges
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

const ConfettiShader = {
  uniforms: {
    time: { value: 0.0 },
    progress: { value: 0.0 }
  },
  vertexShader: `
    uniform float time;
    uniform float progress;
    attribute vec3 color;
    attribute float rotationSpeed;
    attribute float fallSpeed;
    varying vec3 vColor;
    
    void main() {
      vColor = color;
      
      vec3 pos = position;
      
      // Falling motion with rotation
      pos.y -= fallSpeed * time * progress;
      pos.x += sin(time * rotationSpeed + position.y) * 0.3;
      pos.z += cos(time * rotationSpeed * 0.7 + position.x) * 0.3;
      
      // Reset when out of view
      if(pos.y < -10.0) {
        pos.y = 10.0;
      }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    
    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      
      if(dist > 0.5) discard;
      
      // Confetti shape with sharp edges
      float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
      gl_FragColor = vec4(vColor, alpha);
    }
  `
};

onMounted(() => {
  initThreeJS();
});

onUnmounted(() => {
  cleanup();
});

const initThreeJS = () => {
  if (!celebrationCanvas.value) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a2a);

  // Camera setup
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 15;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ 
    canvas: celebrationCanvas.value,
    antialias: true,
    alpha: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Lighting
  setupLighting();

  // Handle resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
};

const setupLighting = () => {
  const ambientLight = new THREE.AmbientLight(0x404080, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffd700, 1.5);
  directionalLight.position.set(10, 10, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffaa00, 2, 50);
  pointLight.position.set(0, 0, 10);
  scene.add(pointLight);
};

const createGoldenExplosion = () => {
  const particleCount = 2000;
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const scales = new Float32Array(particleCount);
  const lives = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);

  // Golden color palette
  const goldenColors = [
    [1.0, 0.84, 0.0],  // Gold
    [1.0, 0.75, 0.0],  // Orange Gold
    [1.0, 0.9, 0.4],   // Light Gold
    [1.0, 0.6, 0.2],   // Amber
    [0.9, 0.7, 0.1]    // Dark Gold
  ];

  for (let i = 0; i < particleCount; i++) {
    // Random positions in sphere
    const radius = Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
    positions[i * 3 + 2] = Math.cos(phi) * radius;

    // Explosive velocities
    velocities[i * 3] = (Math.random() - 0.5) * 20;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 20;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 20;

    scales[i] = Math.random() * 1.5 + 0.5;
    lives[i] = Math.random() * 2 + 1;

    // Random golden color
    const colorIndex = Math.floor(Math.random() * goldenColors.length);
    colors[i * 3] = goldenColors[colorIndex][0];
    colors[i * 3 + 1] = goldenColors[colorIndex][1];
    colors[i * 3 + 2] = goldenColors[colorIndex][2];
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('life', new THREE.BufferAttribute(lives, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: JSON.parse(JSON.stringify(GoldenParticleShader.uniforms)),
    vertexShader: GoldenParticleShader.vertexShader,
    fragmentShader: GoldenParticleShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  goldenExplosion = new THREE.Points(geometry, material);
  goldenExplosion.userData = {
    startTime: performance.now(),
    life: 3,
    maxLife: 3
  };
  
  scene.add(goldenExplosion);
};

const createConfetti = () => {
  const confettiCount = 500;
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(confettiCount * 3);
  const confettiColors = new Float32Array(confettiCount * 3);
  const rotationSpeeds = new Float32Array(confettiCount);
  const fallSpeeds = new Float32Array(confettiCount);

  // Celebration colors
  const colors = [
    [1.0, 0.0, 0.0],    // Red
    [0.0, 1.0, 0.0],    // Green
    [0.0, 0.0, 1.0],    // Blue
    [1.0, 1.0, 0.0],    // Yellow
    [1.0, 0.0, 1.0],    // Magenta
    [0.0, 1.0, 1.0]     // Cyan
  ];

  for (let i = 0; i < confettiCount; i++) {
    // Random positions at top
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = 10 + Math.random() * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

    // Random color
    const colorIndex = Math.floor(Math.random() * colors.length);
    confettiColors[i * 3] = colors[colorIndex][0];
    confettiColors[i * 3 + 1] = colors[colorIndex][1];
    confettiColors[i * 3 + 2] = colors[colorIndex][2];

    rotationSpeeds[i] = Math.random() * 2 + 1;
    fallSpeeds[i] = Math.random() * 2 + 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(confettiColors, 3));
  geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
  geometry.setAttribute('fallSpeed', new THREE.BufferAttribute(fallSpeeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: JSON.parse(JSON.stringify(ConfettiShader.uniforms)),
    vertexShader: ConfettiShader.vertexShader,
    fragmentShader: ConfettiShader.fragmentShader,
    transparent: true,
    depthWrite: false
  });

  const confettiSystem = new THREE.Points(geometry, material);
  confettiSystem.userData = {
    startTime: performance.now()
  };
  
  confettiSystems.push(confettiSystem);
  scene.add(confettiSystem);
};

const startCelebration = () => {
  if (isCounting.value) return;
  
  isCounting.value = true;
  progress.value = 0;
  currentNumber.value = 0;
  statusMessage.value = '🎉 Celebration Started!';
  
  const startTime = performance.now();
  const endTime = startTime + duration;

  const updateNumber = () => {
    if (!isCounting.value) return;

    const now = performance.now();
    const elapsed = now - startTime;
    const totalDuration = duration;

    if (now >= endTime) {
      // Celebration complete
      currentNumber.value = targetNumber.value;
      progress.value = 100;
      triggerFinalExplosion();
      statusMessage.value = '🎊 CELEBRATION COMPLETE!';
      isCounting.value = false;
      return;
    }

    // Ease out function for smooth ending
    const progressRatio = elapsed / totalDuration;
    const easeOut = 1 - Math.pow(1 - progressRatio, 3);
    
    currentNumber.value = Math.floor(easeOut * targetNumber.value);
    progress.value = progressRatio * 100;

    // Update number display with formatting
    if (numberElement.value) {
      numberElement.value.textContent = currentNumber.value.toLocaleString();
    }

    // Create mini effects during counting
    if (Math.random() < 0.1) {
      createMiniSpark();
    }

    requestAnimationFrame(updateNumber);
  };

  // Start confetti immediately
  createConfetti();
  
  updateNumber();
};

const triggerFinalExplosion = () => {
  isExploding.value = true;
  statusMessage.value = '💥 GOLDEN EXPLOSION!';
  
  // Create the main golden explosion
  createGoldenExplosion();
  
  // Create multiple confetti systems
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      createConfetti();
    }, i * 500);
  }

  // Reset explosion state after 3 seconds
  setTimeout(() => {
    isExploding.value = false;
    statusMessage.value = '✨ Amazing! Ready for another round?';
  }, 3000);
};

const createMiniSpark = () => {
  const sparkCount = 30;
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(sparkCount * 3);
  const velocities = new Float32Array(sparkCount * 3);
  const scales = new Float32Array(sparkCount);
  const lives = new Float32Array(sparkCount);

  for (let i = 0; i < sparkCount; i++) {
    // Random positions around center
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

    velocities[i * 3] = (Math.random() - 0.5) * 5;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 5;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 5;

    scales[i] = Math.random() * 0.5 + 0.2;
    lives[i] = Math.random() * 0.5 + 0.3;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('life', new THREE.BufferAttribute(lives, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffd700,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const sparkSystem = new THREE.Points(geometry, material);
  sparkSystem.userData = {
    startTime: performance.now(),
    life: 1,
    maxLife: 1
  };
  
  particles.push(sparkSystem);
  scene.add(sparkSystem);
};

const resetCelebration = () => {
  isCounting.value = false;
  isExploding.value = false;
  progress.value = 0;
  currentNumber.value = 0;
  statusMessage.value = 'Ready to celebrate!';
  
  if (numberElement.value) {
    numberElement.value.textContent = '0';
  }

  // Clear all particles
  particles.forEach(particle => {
    scene.remove(particle);
    particle.geometry.dispose();
    particle.material.dispose();
  });
  particles = [];

  // Clear confetti
  confettiSystems.forEach(confetti => {
    scene.remove(confetti);
    confetti.geometry.dispose();
    confetti.material.dispose();
  });
  confettiSystems = [];

  // Clear golden explosion
  if (goldenExplosion) {
    scene.remove(goldenExplosion);
    goldenExplosion.geometry.dispose();
    goldenExplosion.material.dispose();
    goldenExplosion = null;
  }
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  const time = performance.now() * 0.001;

  // Update particles
  particles.forEach((particle, index) => {
    const life = particle.userData.life - 0.016;
    particle.userData.life = life;
    
    if (life > 0) {
      const progress = life / particle.userData.maxLife;
      particle.material.opacity = progress;
    } else {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
      particles.splice(index, 1);
    }
  });

  // Update golden explosion
  if (goldenExplosion) {
    const life = goldenExplosion.userData.life - 0.016;
    goldenExplosion.userData.life = life;
    
    if (life > 0) {
      const progress = 1 - (life / goldenExplosion.userData.maxLife);
      goldenExplosion.material.uniforms.time.value = time;
      goldenExplosion.material.uniforms.progress.value = progress;
    } else {
      scene.remove(goldenExplosion);
      goldenExplosion.geometry.dispose();
      goldenExplosion.material.dispose();
      goldenExplosion = null;
    }
  }

  // Update confetti
  confettiSystems.forEach(confetti => {
    confetti.material.uniforms.time.value = time;
    confetti.material.uniforms.progress.value = 1.0;
  });

  renderer.render(scene, camera);
};

const onWindowResize = () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  if (renderer) {
    renderer.dispose();
  }
  
  // Dispose geometries and materials
  particles.forEach(particle => {
    particle.geometry.dispose();
    particle.material.dispose();
  });
  
  confettiSystems.forEach(confetti => {
    confetti.geometry.dispose();
    confetti.material.dispose();
  });
  
  if (goldenExplosion) {
    goldenExplosion.geometry.dispose();
    goldenExplosion.material.dispose();
  }
};
</script>

<style scoped>
.celebration-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.celebration-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
}

.number-display {
  font-size: clamp(3rem, 10vw, 8rem);
  font-weight: 900;
  color: #ffffff;
  text-shadow: 
    0 0 20px #ffd700,
    0 0 40px #ff6b00,
    0 0 60px #ff0080;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.7);
  padding: 2rem 4rem;
  border-radius: 20px;
  backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 215, 0, 0.3);
  transform: scale(1);
  transition: all 0.3s ease;
}

.number-display.pulse {
  animation: numberPulse 0.5s ease-in-out infinite alternate;
}

.currency {
  color: #ffd700;
  font-size: 0.8em;
}

@keyframes numberPulse {
  0% {
    transform: scale(1);
    text-shadow: 0 0 20px #ffd700;
  }
  100% {
    transform: scale(1.05);
    text-shadow: 0 0 30px #ff6b00, 0 0 50px #ff0080;
  }
}

.progress-container {
  width: 80%;
  max-width: 500px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ff6b00, #ff0080);
  border-radius: 10px;
  transition: width 0.1s ease;
  position: relative;
  overflow: hidden;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.controls {
  display: flex;
  gap: 1rem;
  pointer-events: all;
}

.start-btn, .reset-btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 700;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: relative;
  overflow: hidden;
}

.start-btn {
  background: linear-gradient(135deg, #ffd700, #ff6b00);
  color: #000;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.start-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: scale(0.95);
}

.start-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.8);
}

.reset-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.status-message {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  background: rgba(0, 0, 0, 0.8);
  padding: 1rem 2rem;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.3s ease;
}

.status-message.visible {
  opacity: 1;
  transform: translateY(0);
}

.celebration-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.celebration-overlay.active {
  opacity: 1;
}

.golden-glow {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, 
    rgba(255, 215, 0, 0.3) 0%,
    rgba(255, 107, 0, 0.2) 30%,
    rgba(255, 0, 128, 0.1) 60%,
    transparent 100%);
  animation: glowPulse 2s ease-in-out infinite alternate;
}

@keyframes glowPulse {
  0% {
    opacity: 0.3;
    transform: scale(1);
  }
  100% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .celebration-ui {
    gap: 1.5rem;
    padding: 1rem;
  }
  
  .number-display {
    padding: 1.5rem 2rem;
    font-size: clamp(2rem, 8vw, 4rem);
  }
  
  .controls {
    flex-direction: column;
    align-items: center;
  }
  
  .start-btn, .reset-btn {
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
  }
}
</style>