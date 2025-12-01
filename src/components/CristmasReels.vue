<template>
  <div class="canvas-container">
    <canvas ref="threeCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import EpicScene from '../composables/epicScene.js';
import SnowfallBackground from '../composables/SnowfallBackground.js';

let snowfallBackground;

const threeCanvas = ref(null);
const { sin, cos, random, PI } = Math;

// Helper functions
const map = (value, sMin, sMax, dMin, dMax) => {
  return dMin + ((value - sMin) / (sMax - sMin)) * (dMax - dMin);
};
const range = (n, m = 0) => Array(n).fill(m).map((i, j) => i + j);
const bez = (p0, p1, p2, t) => {
  const x = Math.pow(1 - t, 2) * p0.x + (1 - t) * 2 * t * p1.x + t * t * p2.x;
  const y = Math.pow(1 - t, 2) * p0.y + (1 - t) * 2 * t * p1.y + t * t * p2.y;
  return [x, y];
};
const rad = (deg) => (deg / 180) * Math.PI;
const rand = (max, min = 0) => min + Math.random() * (max - min);
const randInt = (max, min = 0) => Math.floor(min + Math.random() * (max - min));
const randChoise = (arr) => arr[randInt(arr.length)];

// Lightning Effect Class
class LightningEffect {
  constructor(scene, targetOrnament) {
    this.scene = scene;
    this.target = targetOrnament;
    this.isActive = false;
    this.duration = 2; // seconds
    this.startTime = 0;
    
    this.lightningBolt = null;
    this.pointLight = null;
    this.glowSphere = null;
    
    this.createLightningEffect();
  }
  
  createLightningEffect() {
    // Create lightning bolt using multiple line segments
    const boltPoints = this.generateBoltPoints();
    const geometry = new THREE.BufferGeometry().setFromPoints(boltPoints);
    const material = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.8
    });
    
    this.lightningBolt = new THREE.Line(geometry, material);
    this.lightningBolt.visible = false;
    this.scene.add(this.lightningBolt);
    
    // Create intense point light
    this.pointLight = new THREE.PointLight(0x88EEFF, 7, 50);
    this.pointLight.position.copy(this.target.item.position);
    this.pointLight.visible = false;
    this.scene.add(this.pointLight);
    
    // Create glow sphere
    const glowGeometry = new THREE.SphereGeometry(8, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88EEFF,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide
    });
    this.glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glowSphere.position.copy(this.target.item.position);
    this.glowSphere.visible = false;
    this.scene.add(this.glowSphere);
  }
  
  generateBoltPoints() {
    const points = [];
    const startPos = new THREE.Vector3(
      this.target.base.position.x + rand(-20, 20),
      this.target.base.position.y + 30,
      rand(-10, 10)
    );
    const endPos = this.target.item.position.clone();
    
    points.push(startPos);
    
    // Create jagged lightning path
    const segments = 15;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      // Add randomness to create jagged effect
      if (i < segments - 1) {
        point.x += rand(-3, 3);
        point.y += rand(-2, 2);
        point.z += rand(-2, 2);
      }
      
      points.push(point);
    }
    
    points.push(endPos);
    return points;
  }
  
  activate(currentTime) {
    this.isActive = true;
    this.startTime = currentTime;
    this.lightningBolt.visible = true;
    this.pointLight.visible = true;
    this.glowSphere.visible = true;
    
    // Update positions
    const worldPos = new THREE.Vector3();
    this.target.item.getWorldPosition(worldPos);
    this.pointLight.position.copy(worldPos);
    this.glowSphere.position.copy(worldPos);
    
    // Regenerate lightning path
    const newPoints = this.generateBoltPoints();
    this.lightningBolt.geometry.setFromPoints(newPoints);
    this.lightningBolt.geometry.attributes.position.needsUpdate = true;
  }
  
  update(currentTime) {
    if (!this.isActive) return;
    
    const elapsed = currentTime - this.startTime;
    const progress = elapsed / this.duration;
    
    if (progress >= 1) {
      this.deactivate();
      return;
    }
    
    // Animate lightning flicker
    const flicker = Math.sin(progress * PI * 20) * 0.5 + 0.5;
    this.lightningBolt.material.opacity = 0.6 + flicker * 0.4;
    this.pointLight.intensity = 7 + flicker * 7;
    this.glowSphere.material.opacity = 0.2 + flicker * 0.2;
    
    // Update glow sphere size
    this.glowSphere.scale.setScalar(1 + Math.sin(progress * PI * 8) * 0.5);
    
    // Occasionally regenerate lightning path for dynamic effect
    if (Math.random() < 0.1) {
      const newPoints = this.generateBoltPoints();
      this.lightningBolt.geometry.setFromPoints(newPoints);
      this.lightningBolt.geometry.attributes.position.needsUpdate = true;
    }
  }
  
  deactivate() {
    this.isActive = false;
    this.lightningBolt.visible = false;
    this.pointLight.visible = false;
    this.glowSphere.visible = false;
  }
  
  dispose() {
    this.scene.remove(this.lightningBolt);
    this.scene.remove(this.pointLight);
    this.scene.remove(this.glowSphere);
    
    this.lightningBolt.geometry.dispose();
    this.lightningBolt.material.dispose();
    this.glowSphere.geometry.dispose();
    this.glowSphere.material.dispose();
  }
}

// Lightning Manager Class
class LightningManager {
  constructor(scene) {
    this.scene = scene;
    this.lightningEffects = [];
    this.lastLightningTime = 0;
    this.lightningInterval = 3; // seconds between lightning strikes
  }
  
  update(currentTime, ornaments) {
    // Remove finished effects
    this.lightningEffects = this.lightningEffects.filter(effect => effect.isActive);
    
    // Update active effects
    this.lightningEffects.forEach(effect => effect.update(currentTime));
    
    // Check if it's time for new lightning
    if (currentTime - this.lastLightningTime > this.lightningInterval && ornaments.length > 0) {
      this.strikeRandomOrnament(currentTime, ornaments);
      this.lastLightningTime = currentTime;
      
      // Randomize next interval
      this.lightningInterval = rand(5, 2);
    }
  }
  
  strikeRandomOrnament(currentTime, ornaments) {
    const randomOrnament = randChoise(ornaments);
    
    // Create new lightning effect
    const lightning = new LightningEffect(this.scene, randomOrnament);
    lightning.activate(currentTime);
    this.lightningEffects.push(lightning);
    
    // Optional: Strike multiple ornaments at once occasionally
    if (Math.random() < 0.3) { // 30% chance for multiple strikes
      setTimeout(() => {
        const secondOrnament = randChoise(ornaments.filter(o => o !== randomOrnament));
        if (secondOrnament) {
          const secondLightning = new LightningEffect(this.scene, secondOrnament);
          secondLightning.activate(currentTime + 0.2);
          this.lightningEffects.push(secondLightning);
        }
      }, 200);
    }
  }
  
  dispose() {
    this.lightningEffects.forEach(effect => effect.dispose());
    this.lightningEffects = [];
  }
}

// Modified Ornament class with lightning support
class Ornament {
  constructor({ scene, x, y, texture, font, index }) {
    this.scene = scene;
    this.phase = Math.random() * 2;
    const base = new THREE.Group();
    base.position.x = x;
    base.position.y = y;
    this.base = base;
    scene.add(base);
    this.length = -12 - rand(6);
    const item = new THREE.Group();
    item.position.y = this.length;
    base.add(item);
    this.item = item;
    this.texture = texture;
    this.text = `${index + 1}`;
    this.font = font;
    this.material = new THREE.MeshPhongMaterial({
      map: this.texture,
      shininess: 120,
      emissive: 0x111100, // Added emissive color for better visibility
    });
    this.addItems();
  }
  
  addItems() {
    this.addBall();
    this.addLine();
    this.addCylynder();
    this.addRing();
  }
  
  addBall() {
    const geometry = new THREE.SphereGeometry(4, 20, 20);
    const ball = new THREE.Mesh(geometry, this.material);
    ball.userData.ornament = this;
    this.item.add(ball);
  }
  
  addCylynder() {
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 15, 5);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.x = 0;
    mesh.position.y = 4;
    this.item.add(mesh);
  }
  
  addRing() {
    const geometry = new THREE.TorusGeometry(0.8, 0.2, 10, 24);
    const material = new THREE.MeshPhongMaterial({
      color: 0x393e46,
      shininess: 80,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = 0;
    mesh.position.y = 5.2;
    this.item.add(mesh);
  }
  
  addLine() {
    const material = new THREE.LineBasicMaterial({
      color: 0x666666,
    });
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, this.length + 6, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    this.base.add(line);
  }
  
  update(time) {
    const angle = map(sin(time + this.phase), -1, 1, -rad(5), rad(5));
    this.item.rotation.y = angle * 3;
  }
}

onMounted(() => {
  let camera, controls, scene, renderer, loader, font;
  let textures = [];
  let ornaments = [];
  let lightningManager;
  
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const firstIntersect = intersects[0].object;
        if (firstIntersect.userData.ornament) {
            if (renderer) {
                renderer.setAnimationLoop(null);
            }
            
            const epicScene = new EpicScene(threeCanvas.value, { autoStart: true, showUI: true });
            epicScene.releaseSpiritEffect();
        }
    }
  }
  
  const fontLoader = new FontLoader();
  fontLoader.load("https://assets.codepen.io/3685267/droid_sans_bold.typeface.json", function (fontx) {
    font = fontx;
    init();
  });

  function getY(x) {
    const xActual = x + 50;
    const t = map(xActual % 20, 0, 20, 0, 1);
    const [_, y] = bez({ x: 0, y: 0 }, { x: 10, y: -8 }, { x: 20, y: 0 }, t);
    return y;
  }

  function loadTextures() {
    textures = range(9).map((i) => {
      const texture = loader.load(`https://assets.codepen.io/3685267/christmas_texture_${i}.jpg`);
      return texture;
    });
  }

  function addOrnaments(num, posY) {
    range(num).forEach((i) => {
      if (i) {
        const x = (100 / num) * i - 50;
        const y = getY(x) + posY;
        ornaments.push(
          new Ornament({
            scene,
            x,
            y,
            texture: randChoise(textures),
            font,
            index: ornaments.length,
          })
        );
      }
    });
  }

  function addTube(yRoot = 0) {
    class CustomSinCurve extends THREE.Curve {
      constructor(scale = 1) {
        super();
        this.scale = scale;
      }
      getPoint(t, optionalTarget = new THREE.Vector3()) {
        const x = map(t, 0, 1, 0, 10);
        const a = map(x % 2, 0, 2, 0, 1);
        const [_, y] = bez({ x: 0, y: 0 }, { x: 1, y: -0.8 }, { x: 2, y: 0 }, a);
        const z = 0;
        return optionalTarget.set(x - 5, y + yRoot, z).multiplyScalar(this.scale);
      }
    }
    const texture = loader.load("https://assets.codepen.io/3685267/christmas_texture_9.jpg");
    const path = new CustomSinCurve(10);
    const geometry = new THREE.TubeGeometry(path, 100, 1, 16, false);
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = 10;
    texture.repeat.y = 1;
    texture.offset.set(0.5, 0.5);
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      shininess: 120,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  }

  function addLights() {
    const color = 0xffffff;
    const intensity = 0.9;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 0, 80);
    scene.add(light);
    
    // Add ambient light for better lightning visibility
    const ambientLight = new THREE.AmbientLight(0x222233, 0.7);
    scene.add(ambientLight);
  }

  function addPlane() {
    const geometry = new THREE.PlaneGeometry(500, 500, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0x570b22,
      shininess: 10,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.z = -5;
    scene.add(plane);
  }

  function init() {
    scene = new THREE.Scene();
    scene.position.y += 13;
    loader = new THREE.TextureLoader();
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: threeCanvas.value });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 110);
    controls = new OrbitControls(camera, renderer.domElement);
    
    // Initialize lightning manager
    lightningManager = new LightningManager(scene);
    
    // Initialize Snowfall Background
    snowfallBackground = new SnowfallBackground();
    snowfallBackground.init().then(() => {
        snowfallBackground.onWindowResize(window.innerWidth, window.innerHeight);
    });
    
    loadTextures();
    
    [[4.5, 6], [1.5, 6], [-1.5, 6], [-4.5, 6]].forEach(([row, num]) => {
      addTube(row);
      addOrnaments(num, row * 10);
    });

    addLights();
    
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener("resize", onWindowResize, false);
    
    renderer.setAnimationLoop(animationLoop);
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (snowfallBackground) {
        snowfallBackground.onWindowResize(window.innerWidth, window.innerHeight);
    }
  }

  const animationLoop = (time) => {
    const currentTime = time * 0.001;
    
    renderer.clear();

    // 1. Render background
    if (snowfallBackground && snowfallBackground.uniforms) {
      snowfallBackground.render(time, renderer);
    }

    // 2. Clear depth to render foreground on top
    renderer.clearDepth();
    
    ornaments.forEach((item) => {
      item.update(currentTime);
    });
    
    // Update lightning effects
    if (lightningManager) {
      lightningManager.update(currentTime, ornaments);
    }
    
    if (controls) controls.update();
    
    // 3. Render main scene
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  onUnmounted(() => {
    window.removeEventListener("resize", onWindowResize);
    if(renderer) {
        renderer.domElement.removeEventListener('click', onClick);
        renderer.setAnimationLoop(null);
        renderer.dispose();
    }
    if (lightningManager) {
        lightningManager.dispose();
    }
    if (snowfallBackground) {
        snowfallBackground.stop();
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
    textures.forEach(t => t.dispose());
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