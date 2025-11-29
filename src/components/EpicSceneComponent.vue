<template>
  <div class="canvas-container">
    <canvas ref="mainCanvas"></canvas>
    <div class="ui-overlay" v-if="showUI">
        <div class="loading" :style="{ display: loading ? 'block' : 'none' }">Loading Epic Scene...</div>
        <button class="spirit-button" @click="releaseSpirit" :style="{ display: !loading ? 'block' : 'none' }">RELEASE SPIRIT</button>
        <div class="custom-cursor" ref="cursor"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import EpicScene from '.././composables/epicScene'; // Adjust path to your EpicScene module

// Refs
const mainCanvas = ref(null);
const cursor = ref(null);
const loading = ref(true);
const showUI = ref(true);

// EpicScene instance
let epicScene = null;

onMounted(async () => {
  if (!mainCanvas.value) {
    console.error('Canvas element not found');
    return;
  }

  try {
    // Initialize EpicScene with the canvas
    epicScene = new EpicScene(mainCanvas.value, {
      autoStart: true,
      showUI: true
    });

    // You can listen for when the scene is loaded if needed
    // For now, we'll simulate loading completion
    setTimeout(() => {
      loading.value = false;
    }, 2000);

    // Setup custom cursor
    setupCursor();

  } catch (error) {
    console.error('Failed to initialize EpicScene:', error);
    loading.value = false;
  }
});

const setupCursor = () => {
  const handleMouseMove = (e) => {
    if (cursor.value) {
      cursor.value.style.left = e.clientX - 10 + 'px';
      cursor.value.style.top = e.clientY - 10 + 'px';
    }
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  
  // Store the handler for cleanup
  epicScene.customMouseHandler = handleMouseMove;
};

const releaseSpirit = () => {
  if (epicScene) {
    epicScene.releaseSpiritEffect();
  }
};

// Optional: Add methods to control the scene
const startScene = () => {
  if (epicScene) {
    epicScene.start();
  }
};

const stopScene = () => {
  if (epicScene) {
    epicScene.stop();
  }
};

onUnmounted(() => {
  // Cleanup
  if (epicScene) {
    // Remove custom mouse handler if it exists
    if (epicScene.customMouseHandler) {
      document.removeEventListener('mousemove', epicScene.customMouseHandler);
    }
    
    // Destroy the scene
    epicScene.destroy();
    epicScene = null;
  }
});

// Expose methods if needed for parent components
defineExpose({
  startScene,
  stopScene,
  releaseSpirit
});
</script>

<style scoped>
.canvas-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.ui-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 18px;
  text-align: center;
  opacity: 0.8;
}

.spirit-button {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid transparent;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: all;
  backdrop-filter: blur(15px);
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  overflow: hidden;
}

.spirit-button::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff);
  background-size: 400% 400%;
  border-radius: 10px;
  z-index: -1;
  animation: borderGlow 3s ease-in-out infinite;
}

.spirit-button::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  z-index: -1;
}

@keyframes borderGlow {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.spirit-button:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: translateX(-50%) scale(1.02);
}

.custom-cursor {
  position: fixed;
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, rgba(0, 255, 255, 0.8) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 2000;
  mix-blend-mode: screen;
}
</style>