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

const threeCanvas = ref(null);
const { sin } = Math;

// Helper functions from the original script
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

// Ornament class from the original script, adapted for modern Three.js
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
      shininess: 120, // Changed from 20 to 120
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
    ball.userData.ornament = this; // Link back to the parent ornament object
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
    //this.base.rotation.z = angle;
  }

}

onMounted(() => {
  let camera, controls, scene, renderer, loader, font;
  let textures = [];
  let ornaments = [];
  
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const firstIntersect = intersects[0].object;
        if (firstIntersect.userData.ornament) {
            // Stop the CristmasReels animation loop
            if (renderer) {
                renderer.setAnimationLoop(null);
            }
            
            // Instantiate and start EpicScene
            const epicScene = new EpicScene(threeCanvas.value, { autoStart: true, showUI: true });
            
            // Trigger the celebration effect
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

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 110);
    controls = new OrbitControls(camera, renderer.domElement);
    
    loadTextures();
    
    [[4.5, 6], [1.5, 6], [-1.5, 6], [-4.5, 6]].forEach(([row, num]) => {
      addTube(row);
      addOrnaments(num, row * 10);
    });

    addLights();
    addPlane();
    
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener("resize", onWindowResize, false);
    
    renderer.setAnimationLoop(animationLoop);
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  const animationLoop = (time) => {
    ornaments.forEach((item) => {
      item.update(time * 0.001);
    });
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  onUnmounted(() => {
    window.removeEventListener("resize", onWindowResize);
    if(renderer) {
        renderer.domElement.removeEventListener('click', onClick);
        renderer.setAnimationLoop(null);
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