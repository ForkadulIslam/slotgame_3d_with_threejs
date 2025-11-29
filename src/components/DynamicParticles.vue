<template>
  <div class="dynamic-particles-container">
    <canvas ref="particleCanvas"></canvas>
    <div id="dir">Click Anywhere For More</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const particleCanvas = ref(null);
let animationFrameId;

onMounted(() => {
  // === Settings ===
  var movementSpeed = 80;
  var totalObjects = 1000;
  var objectSize = 3;
  var sizeRandomness = 600;
  var colors = [0xFFD700, 0xFFA500, 0xFFCC00, 0xADD8E6, 0x87CEEB, 0x40E0D0, 0x00BFFF, 0xE0FFFF];

  var dirs = [];
  var parts = [];

  var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 1000;

  var scene = new THREE.Scene();

  // === ExplodeAnimation Class ===
  function ExplodeAnimation(x, y) {
    var geometry = new THREE.BufferGeometry(); // Using BufferGeometry for modern Three.js
    var vertices = [];
    var initialDirs = [];

    for (let i = 0; i < totalObjects; i++) {
      vertices.push(x, y, 0); // All particles start at the same point
      initialDirs.push(
        (Math.random() * movementSpeed) - (movementSpeed / 2),
        (Math.random() * movementSpeed) - (movementSpeed / 2),
        (Math.random() * movementSpeed) - (movementSpeed / 2)
      );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('initialDirection', new THREE.Float32BufferAttribute(initialDirs, 3));

    // Using PointsMaterial for particles
    var material = new THREE.PointsMaterial({ 
      size: objectSize,  
      color: colors[Math.round(Math.random() * (colors.length - 1))], // Fix: colors.length - 1
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    
    var particles = new THREE.Points(geometry, material); // Use Points instead of ParticleSystem

    this.object = particles;
    this.status = true; // Still used by update function, though its purpose is less clear with object removal
    this.initialTime = Date.now(); // For fading out

    scene.add(this.object);

    this.update = function() {
      if (this.status === true) {
        var pCount = totalObjects;
        var positions = this.object.geometry.attributes.position.array;
        var initialDirections = this.object.geometry.attributes.initialDirection.array;
        var elapsedTime = (Date.now() - this.initialTime) / 1000; // Convert to seconds

        // Fade out particles over time
        this.object.material.opacity = Math.max(0, 1 - elapsedTime / 2); // Fade out over 2 seconds

        // Remove particles after a certain time
        if (this.object.material.opacity <= 0) {
          this.status = false; // Mark for removal
          scene.remove(this.object);
          this.object.geometry.dispose();
          this.object.material.dispose();
          return;
        }

        while (pCount--) {
          var i3 = pCount * 3;
          positions[i3] += initialDirections[i3];
          positions[i3 + 1] += initialDirections[i3 + 1];
          positions[i3 + 2] += initialDirections[i3 + 2];
        }
        this.object.geometry.attributes.position.needsUpdate = true;
      }
    };
  }

  var renderer = new THREE.WebGLRenderer({ canvas: particleCanvas.value });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Initial render
  renderer.render(scene, camera);
  parts.push(new ExplodeAnimation(0, 0)); // Initial explosion

  // === Animation Loop ===
  function render() {
    animationFrameId = requestAnimationFrame(render);

    // Update particles and remove finished ones
    var i = parts.length;
    while(i--) {
      parts[i].update();
      if (parts[i].status === false) {
        parts.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }
  render();

  // === Event Listeners ===
  function handleMouseDown(event) {
    event.preventDefault();
    // Convert mouse coordinates to Three.js world coordinates
    var vector = new THREE.Vector3(
      (event.clientX / window.innerWidth) * 2 - 1,
      - (event.clientY / window.innerHeight) * 2 + 1,
      0.5
    );
    vector.unproject(camera);
    var dir = vector.sub(camera.position).normalize();
    var distance = -camera.position.z / dir.z;
    var pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    parts.push(new ExplodeAnimation(
      (Math.random() * sizeRandomness) - (sizeRandomness / 2),
      (Math.random() * sizeRandomness) - (sizeRandomness / 2)
    ));
    // The original script did not use the calculated mouse position directly for particle origin
    // Instead it used random values, matching that behavior here.
  }
  window.addEventListener('mousedown', handleMouseDown, false); // Attach to window for full screen clicks

  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', handleResize, false);

  // === Cleanup ===
  onUnmounted(() => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('mousedown', handleMouseDown, false);
    window.removeEventListener('resize', handleResize, false);
    if (renderer) {
      renderer.dispose();
    }
    if (scene) {
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
    parts.length = 0; // Clear the array of animations
    dirs.length = 0; // Clear the directions array
  });
});
</script>

<style scoped>
body {
  background-color: #000000;
  margin: 0px;
  padding: 0;
  overflow: hidden;
}

.dynamic-particles-container {
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

#dir {
  background-color: #ffffff;
  position: absolute;
  font-family: "Times New Roman";
  font-size: 12px;
  font-weight: bold;
  min-width: 300px;
  text-align: center;
  right: 5px;
  top: 5px;
  opacity: 0.5;
  color: #000000; /* Added for visibility against black background */
  z-index: 1000; /* Ensure it's above the canvas */
}
</style>