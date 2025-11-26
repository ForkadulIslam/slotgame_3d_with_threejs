<template>
  <div class="canvas-container">
    <canvas ref="threeCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const threeCanvas = ref(null);

// --- Helper function to create the particle texture ---
function createParticleTexture() {
  const canvas = document.createElement('CANVAS');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.globalAlpha = 0.3;
  context.filter = 'blur(16px)';
  context.fillStyle = 'white';
  context.beginPath();
  context.arc(64, 64, 40, 0, 2 * Math.PI);
  context.fill();
  context.globalAlpha = 1;
  context.filter = 'blur(5px)';
  context.fillStyle = 'white';
  context.beginPath();
  context.arc(64, 64, 16, 0, 2 * Math.PI);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

// --- Satellite Class ---
class Satellite {
  constructor(scene, texture, size, trailLength) {
    this.trailLength = trailLength;
    this.trailIndex = 0;

    // Create the satellite mesh
    this.mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size),
      new THREE.MeshPhysicalMaterial({
        color: 0xffd700, metalness: 1.0, roughness: 0.3, flatShading: true,
      })
    );
    scene.add(this.mesh);

    // Create the particle trail
    const trailGeo = new THREE.BufferGeometry();
    this.trailPositions = new THREE.BufferAttribute(new Float32Array(3 * this.trailLength), 3);
    this.trailColors = new THREE.BufferAttribute(new Float32Array(3 * this.trailLength), 3);
    trailGeo.setAttribute('position', this.trailPositions);
    trailGeo.setAttribute('color', this.trailColors);

    const trailMat = new THREE.PointsMaterial({
      color: 'white', vertexColors: true, size: 2, sizeAttenuation: true,
      map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.trail = new THREE.Points(trailGeo, trailMat);
    scene.add(this.trail);

    // Create the "torch" beam mesh
    const torchGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const torchMat = new THREE.MeshBasicMaterial({
      color: 0x87CEFA, // Bluish color
      transparent: true,
      opacity: 0.4,    // More transparent
      blending: THREE.AdditiveBlending,
    });
    this.torchMesh = new THREE.Mesh(torchGeo, torchMat);
    this.torchMesh.visible = false;
    scene.add(this.torchMesh);
  }

  updateTrail() {
    const M = 3; // Particles to update per frame
    const v = new THREE.Vector3();

    for (let j = 0; j < M; j++) {
      v.randomDirection().divideScalar(4).add(this.mesh.position);
      this.trailPositions.setXYZ(this.trailIndex, v.x, v.y, v.z);
      this.trailColors.setXYZ(this.trailIndex, 1, 1, 2);
      this.trailIndex = (this.trailIndex + 1) % this.trailLength;
    }

    let k = 1;
    for (let j = this.trailIndex + this.trailLength; j > this.trailIndex - M; j--) {
      this.trailColors.setXYZ(j % this.trailLength, k, k ** 1.5, 5 * (k ** 3));
      k = 0.98 * k;
    }
    this.trailPositions.needsUpdate = true;
    this.trailColors.needsUpdate = true;
  }

  setVisible(isVisible) {
    this.mesh.visible = isVisible;
    this.trail.visible = isVisible;
  }
}

// --- Burst Animation Class ---
class Burst {
    constructor(scene, texture, count = 300) {
        this.particleCount = count;
        this.particles = null;
        this.particleData = [];
        this.texture = texture;
        this.scene = scene;
        this.isActive = false;
    }

    trigger(position) {
        if (!this.particles) {
            this._createParticles();
        }
        this.particles.position.copy(position);
        this.isActive = true;
        this.particles.visible = true;

        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particleData[i];
            p.lifetime = Math.random() * 0.8 + 0.4;
            p.velocity.randomDirection().multiplyScalar(Math.random() * 10 + 5);
            this.particles.geometry.attributes.position.setXYZ(i, 0, 0, 0);
        }
    }

    _createParticles() {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const colorHot = new THREE.Color(0xffddaa);

        for (let i = 0; i < this.particleCount; i++) {
            this.particleData.push({ velocity: new THREE.Vector3(), lifetime: 0 });
            colorHot.toArray(colors, i * 3);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 3, vertexColors: true, map: this.texture, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });

        this.particles = new THREE.Points(geo, mat);
        this.scene.add(this.particles);
    }

    update(delta) {
        if (!this.isActive) return;

        let activeParticles = 0;
        const pos = this.particles.geometry.attributes.position;
        const col = this.particles.geometry.attributes.color;

        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particleData[i];
            if (p.lifetime > 0) {
                activeParticles++;
                p.lifetime -= delta;

                const currentPos = new THREE.Vector3().fromBufferAttribute(pos, i);
                currentPos.add(p.velocity.clone().multiplyScalar(delta));
                pos.setXYZ(i, currentPos.x, currentPos.y, currentPos.z);
                
                const lifePercent = Math.max(0, p.lifetime / 1.2);
                col.setXYZ(i, lifePercent, lifePercent * 0.5, lifePercent * 0.2);
            }
        }

        pos.needsUpdate = true;
        col.needsUpdate = true;

        if (activeParticles === 0) {
            this.isActive = false;
            this.particles.visible = false;
        }
    }
}


onMounted(() => {
  const clock = new THREE.Clock();
  let renderer;

  // General setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000410);

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight);
  camera.position.set(0, 0, 50);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: threeCanvas.value,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2;

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  const particleTexture = createParticleTexture();

  // The original orbiting satellite
  const orbitingSatellite = new Satellite(scene, particleTexture, 1, 200);

  // --- Impacting Satellites Setup ---
  const impactingSatellites = [];
  const startPositions = [
      new THREE.Vector3(-20, 20, 5), // Top-Left
      new THREE.Vector3(20, 20, 5),  // Top-Right
      new THREE.Vector3(0, 25, 5),   // Top
  ];

  for(let i = 0; i < 3; i++) {
      const sat = new Satellite(scene, particleTexture, 0.5, 100);
      sat.state = 'waiting';
      sat.startPosition = startPositions[i];
      sat.targetPosition = new THREE.Vector3().randomDirection().setLength(3);
      sat.waitTimeout = Math.random() * 5 + 2;
      sat.velocity = sat.targetPosition.clone().sub(sat.startPosition).normalize().multiplyScalar(0.2);
      sat.setVisible(false);
      impactingSatellites.push(sat);
  }

  const burstPool = [
      new Burst(scene, particleTexture),
      new Burst(scene, particleTexture),
      new Burst(scene, particleTexture),
  ];
  let nextBurst = 0;

  // Scenery
  const starsMaterial = new THREE.PointsMaterial({
    size: 1 / 6, sizeAttenuation: true, map: particleTexture, transparent: true,
  });
  for (let i = 0; i < 20; i++) {
    const dome = new THREE.Points(new THREE.IcosahedronGeometry(20, 4), starsMaterial);
    dome.rotation.set(6 * Math.random(), 6 * Math.random(), 6 * Math.random());
    scene.add(dome);
  }

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(3, 64, 32),
    new THREE.MeshPhongMaterial({ color: 0x2266aa })
  );
  scene.add(earth);

  const light = new THREE.DirectionalLight('white', 2);
  light.position.set(1, 1, 1);
  scene.add(light);

  // Animation Loop
  const animationLoop = (t) => {
    const delta = clock.getDelta();

    // Animate original satellite
    orbitingSatellite.mesh.rotation.set(t / 400, t / 500, t / 470);
    orbitingSatellite.mesh.position.setFromSphericalCoords(4, Math.PI / 2 + 0.5 * Math.sin(t / 300 + Math.sin(t / 1120 + Math.cos(t / 1720))), -t / 700);
    orbitingSatellite.updateTrail();

    // Animate impacting satellites
    impactingSatellites.forEach(sat => {
        switch(sat.state) {
            case 'waiting':
                sat.waitTimeout -= delta;
                if (sat.waitTimeout <= 0) {
                    // Instantly create the beam and start the satellite's flight
                    const start = sat.startPosition;
                    const end = sat.targetPosition;
                    const distance = start.distanceTo(end);
                    
                    sat.torchMesh.position.copy(start).lerp(end, 0.5);
                    sat.torchMesh.lookAt(end);
                    sat.torchMesh.scale.set(1, distance, 1);
                    sat.torchMesh.rotateX(Math.PI / 2);
                    sat.torchMesh.visible = true;

                    sat.mesh.position.copy(sat.startPosition);
                    sat.setVisible(true);
                    sat.state = 'in_flight';
                }
                break;

            case 'in_flight':
                sat.mesh.position.add(sat.velocity);
                sat.updateTrail();
                if (sat.mesh.position.length() <= 3.1) { // Collision check
                    burstPool[nextBurst].trigger(sat.mesh.position);
                    nextBurst = (nextBurst + 1) % burstPool.length;
                    
                    // Hide satellite AND torch on impact
                    sat.setVisible(false);
                    sat.torchMesh.visible = false; 
                    
                    sat.waitTimeout = Math.random() * 8 + 5;
                    sat.targetPosition.randomDirection().setLength(3);
                    sat.velocity = sat.targetPosition.clone().sub(sat.startPosition).normalize().multiplyScalar(0.2);
                    sat.state = 'waiting';
                }
                break;
        }
    });

    burstPool.forEach(b => b.update(delta));

    earth.rotation.y = t / 10000;
    controls.update();
    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(animationLoop);

  // Cleanup
  onUnmounted(() => {
    window.removeEventListener("resize", onResize);
    renderer.setAnimationLoop(null);
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
    renderer.dispose();
    particleTexture.dispose();
  });
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
</style>