<template>
  <div class="canvas-container">
    <canvas ref="threeCanvas"></canvas>
    <div class="ui-overlay">
        <div class="loading" id="loading">Loading Epic Scene...</div>
        <button class="spirit-button" id="spiritBtn" style="display: none;">RELEASE SPIRIT</button>
        <div class="custom-cursor" id="cursor"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const threeCanvas = ref(null);

    let loadingElement, spiritBtnElement;



    onMounted(() => {

        loadingElement = document.getElementById('loading');

        spiritBtnElement = document.getElementById('spiritBtn');


    let scene, camera, renderer, controls, composer, clock;
    let soldier, mixer, animations = {};
    let spiritParticles = [], magicCircles = [], energyTrails = [];
    let ambientParticles, atmosphereSystem;
    let isLoaded = false;

    const cursor = document.getElementById('cursor');
    const handleMouseMove = (e) => {
        if (cursor) {
            cursor.style.left = e.clientX - 10 + 'px';
            cursor.style.top = e.clientY - 10 + 'px';
        }
    };
    document.addEventListener('mousemove', handleMouseMove);

    const VolumetricLightShader = {
        uniforms: {
            tDiffuse: { value: null },
            lightPosition: { value: new THREE.Vector2(0.5, 0.5) },
            exposure: { value: 0.4 },
            decay: { value: 0.95 },
            density: { value: 0.8 },
            weight: { value: 0.6 },
            samples: { value: 50 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D tDiffuse;
            uniform vec2 lightPosition;
            uniform float exposure;
            uniform float decay;
            uniform float density;
            uniform float weight;
            uniform int samples;
            
            void main() {
                vec2 coord = vUv;
                vec2 deltaCoord = coord - lightPosition;
                deltaCoord *= 1.0 / float(samples) * density;
                
                float illuminationDecay = 1.0;
                vec4 color = vec4(0.0);
                
                for(int i = 0; i < 100; i++) {
                    if(i >= samples) break;
                    coord -= deltaCoord;
                    vec4 texel = texture2D(tDiffuse, coord);
                    texel *= illuminationDecay * weight;
                    color += texel;
                    illuminationDecay *= decay;
                }
                
                color *= exposure;
                gl_FragColor = color + texture2D(tDiffuse, vUv);
            }
        `
    };

    const SpiritParticleShader = {
        uniforms: {
            time: { value: 0.0 },
            size: { value: 50.0 },
            opacity: { value: 1.0 }
        },
        vertexShader: `
            uniform float time;
            uniform float size;
            attribute float scale;
            attribute vec3 velocity;
            attribute float life;
            varying float vLife;
            varying vec3 vColor;
            
            void main() {
                vLife = life;
                vec3 pos = position + velocity * time;
                
                float angle = time * 2.0 + position.x;
                pos.x += sin(angle) * 0.5;
                pos.z += cos(angle) * 0.5;
                
                vColor = mix(vec3(0.0, 0.8, 1.0), vec3(0.8, 0.2, 1.0), sin(time + position.x) * 0.5 + 0.5);
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * scale * (1.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float opacity;
            varying float vLife;
            varying vec3 vColor;
            
            void main() {
                vec2 center = gl_PointCoord - 0.5;
                float dist = length(center);
                if(dist > 0.5) discard;
                
                float alpha = (1.0 - dist * 2.0) * vLife * opacity;
                gl_FragColor = vec4(vColor, alpha);
            }
        `
    };

    init();

    async function init() {
        scene = new THREE.Scene();
        clock = new THREE.Clock();

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 4, 12);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: threeCanvas.value });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // document.body.appendChild(renderer.domElement); // Managed by Vue template

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 2, 0);
        controls.maxPolarAngle = Math.PI * 0.8;
        controls.minDistance = 5;
        controls.maxDistance = 30;

        createEpicEnvironment();
        createCinematicLighting();
        createAtmosphere();
        await loadSoldier();
        setupPostProcessing();

        const spiritBtn = document.getElementById('spiritBtn');
        if (spiritBtn) {
            spiritBtn.addEventListener('click', releaseSpiritEffect);
        }
        window.addEventListener('resize', onWindowResize);

        renderer.setAnimationLoop(animate);
    }

    function createEpicEnvironment() {
        const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x001122) },
                bottomColor: { value: new THREE.Color(0x000000) },
                offset: { value: 400 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

        const groundGeometry = new THREE.PlaneGeometry(200, 200, 100, 100);
        const positions = groundGeometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            positions[i + 2] = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 2;
        }
        groundGeometry.attributes.position.needsUpdate = true;
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.3,
            transparent: true,
            opacity: 0.9
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        scene.fog = new THREE.FogExp2(0x000011, 0.01);
    }

    function createCinematicLighting() {
        const ambientLight = new THREE.AmbientLight(0x404080, 0.8);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
        keyLight.position.set(20, 30, 10);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 4096;
        keyLight.shadow.mapSize.height = 4096;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 100;
        keyLight.shadow.camera.left = -50;
        keyLight.shadow.camera.right = 50;
        keyLight.shadow.camera.top = 50;
        keyLight.shadow.camera.bottom = -50;
        keyLight.shadow.bias = -0.0001;
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x0088ff, 2.5);
        rimLight.position.set(-15, 10, -10);
        scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(0xffaa44, 1.5);
        fillLight.position.set(8, 5, 15);
        scene.add(fillLight);

        const accentLight1 = new THREE.PointLight(0x00ffff, 2, 30);
        accentLight1.position.set(10, 5, 10);
        scene.add(accentLight1);

        const accentLight2 = new THREE.PointLight(0xff00ff, 2, 30);
        accentLight2.position.set(-10, 5, -10);
        scene.add(accentLight2);
    }

    function createAtmosphere() {
        const particleCount = 1500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 1] = Math.random() * 0.2 + 0.1;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

            scales[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                size: { value: 2.0 }
            },
            vertexShader: `
                uniform float time;
                uniform float size;
                attribute float scale;
                attribute vec3 velocity;
                varying float vAlpha;
                
                void main() {
                    vAlpha = scale;
                    vec3 pos = position + velocity * time;
                    pos.y = mod(pos.y, 50.0);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * scale * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vAlpha;
                void main() {
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    if(dist > 0.5) discard;
                    
                    float alpha = (1.0 - dist * 2.0) * vAlpha * 0.3;
                    gl_FragColor = vec4(0.5, 0.8, 1.0, alpha);
                }
            `,
            transparent: true,
            depthWrite: false
        });

        ambientParticles = new THREE.Points(geometry, material);
        scene.add(ambientParticles);
    }

    async function loadSoldier() {


        const geometry = new THREE.SphereGeometry(1.5, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            color: 0x55aaff,
            roughness: 0.4,
            metalness: 0.3
        });

        soldier = new THREE.Mesh(geometry, material);
        soldier.castShadow = true;
        soldier.position.set(0, 1.5, 0);
        scene.add(soldier);
        
        isLoaded = true;
        loadingElement.style.display = "none";
        spiritBtnElement.style.display = "block";
        return; 
        const gltfLoader = new GLTFLoader(); // Use local GLTFLoader variable
        
        try {
            const gltf = await new Promise((resolve, reject) => {
                gltfLoader.load(
                    'https://threejs.org/examples/models/gltf/Soldier.glb',
                    resolve,
                    undefined,
                    reject
                );
            });

            soldier = gltf.scene;
            soldier.scale.set(4, 4, 4);
            soldier.position.set(0, 0, 0);
            soldier.rotation.y = Math.PI;

            soldier.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    if (child.material) {
                        child.material.roughness = 0.7;
                        child.material.metalness = 0.2;
                    }
                }
            });

            scene.add(soldier);

            mixer = new THREE.AnimationMixer(soldier);
            gltf.animations.forEach((clip) => {
                animations[clip.name] = mixer.clipAction(clip);
            });

            if (animations['Idle']) {
                animations['Idle'].play();
            }

            const loadingElement = document.getElementById('loading');
            const spiritBtnElement = document.getElementById('spiritBtn');
            if (loadingElement) loadingElement.style.display = 'none';
            if (spiritBtnElement) spiritBtnElement.style.display = 'block';
            isLoaded = true;

            console.log('Soldier loaded successfully!');

        } catch (error) {
            console.error('Error loading soldier:', error);
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = 'Error loading model. Click to try basic scene.';
                loadingElement.style.cursor = 'pointer';
                loadingElement.onclick = () => {
                    createFallbackSoldier();
                };
            }
        }
    }

    function createFallbackSoldier() {
        const geometry = new THREE.CapsuleGeometry(0.8, 3, 4, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x4a4a4a,
            roughness: 0.7,
            metalness: 0.2
        });
        
        soldier = new THREE.Mesh(geometry, material);
        soldier.position.set(0, 1.5, 0);
        soldier.castShadow = true;
        soldier.receiveShadow = true;
        scene.add(soldier);

        const loadingElement = document.getElementById('loading');
        const spiritBtnElement = document.getElementById('spiritBtn');
        if (loadingElement) loadingElement.style.display = 'none';
        if (spiritBtnElement) spiritBtnElement.style.display = 'block';
        isLoaded = true;
    }

    function releaseSpiritEffect() {
        if (!soldier) return;

        createSpiritParticles();
        createMagicCircle();
        createEnergyTrails();

        console.log('Epic spirit effect released!');
    }

    function createSpiritParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const lives = new Float32Array(particleCount);

        const soldierPos = soldier.position;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = soldierPos.x + (Math.random() - 0.5) * 4;
            positions[i * 3 + 1] = soldierPos.y + Math.random() * 4;
            positions[i * 3 + 2] = soldierPos.z + (Math.random() - 0.5) * 4;

            velocities[i * 3] = (Math.random() - 0.5) * 2;
            velocities[i * 3 + 1] = Math.random() * 8 + 5;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

            scales[i] = Math.random() * 0.5 + 0.5;
            lives[i] = Math.random() * 2 + 3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        geometry.setAttribute('life', new THREE.BufferAttribute(lives, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: SpiritParticleShader.uniforms,
            vertexShader: SpiritParticleShader.vertexShader,
            fragmentShader: SpiritParticleShader.fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const spiritSystem = new THREE.Points(geometry, material);
        spiritSystem.userData = { 
            life: 5, 
            maxLife: 5,
            startTime: clock.getElapsedTime()
        };
        
        spiritParticles.push(spiritSystem);
        scene.add(spiritSystem);
    }

    function createMagicCircle() {
        const circleGeometry = new THREE.RingGeometry(2, 2.1, 64);
        const circleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                opacity: { value: 1 }
            },
            vertexShader: `
                uniform float time;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    pos.y += sin(time * 4.0 + position.x * 10.0) * 0.1;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float opacity;
                varying vec2 vUv;
                void main() {
                    float pulse = sin(time * 3.0) * 0.5 + 0.5;
                    vec3 color = mix(vec3(0.0, 0.8, 1.0), vec3(0.8, 0.2, 1.0), pulse);
                    gl_FragColor = vec4(color, opacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const magicCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        if (soldier) { // Check if soldier exists before using its position
            magicCircle.position.copy(soldier.position);
            magicCircle.position.y += 0.1;
        }
        magicCircle.rotation.x = -Math.PI / 2;
        magicCircle.userData = { 
            life: 3, 
            maxLife: 3,
            startTime: clock.getElapsedTime()
        };

        magicCircles.push(magicCircle);
        scene.add(magicCircle);
    }

    function createEnergyTrails() {
        for (let i = 0; i < 8; i++) {
            const trailGeometry = new THREE.CylinderGeometry(0.05, 0.2, 10, 8);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 1, 0.5),
                transparent: true,
                opacity: 0.8
            });

            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            const angle = (i / 8) * Math.PI * 2;
            if (soldier) { // Check if soldier exists before using its position
                trail.position.copy(soldier.position);
                trail.position.x += Math.cos(angle) * 3;
                trail.position.z += Math.sin(angle) * 3;
                trail.position.y += 2;
            }
            
            trail.userData = {
                life: 2,
                maxLife: 2,
                angle: angle,
                startTime: clock.getElapsedTime()
            };

            energyTrails.push(trail);
            scene.add(trail);
        }
    }

    function setupPostProcessing() {
        composer = new EffectComposer(renderer);
        
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3, 0.8, 0.1
        );
        composer.addPass(bloomPass);

        const volumetricPass = new ShaderPass(VolumetricLightShader);
        volumetricPass.needsSwap = true;
        composer.addPass(volumetricPass);
    }

    function animate(currentTime) { // animationLoop from previous, now just animate
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        if (controls) controls.update();

        if (mixer && isLoaded) {
            mixer.update(delta);
        }

        if (ambientParticles) {
            ambientParticles.material.uniforms.time.value = elapsed * 0.5;
        }

        spiritParticles.forEach((system, index) => {
            const life = system.userData.life - delta;
            system.userData.life = life;
            
            if (life > 0) {
                const progress = life / system.userData.maxLife;
                system.material.uniforms.time.value = elapsed - system.userData.startTime;
                system.material.uniforms.opacity.value = progress;
            } else {
                scene.remove(system);
                system.geometry.dispose();
                system.material.dispose();
                spiritParticles.splice(index, 1);
            }
        });

        magicCircles.forEach((circle, index) => {
            const life = circle.userData.life - delta;
            circle.userData.life = life;
            
            if (life > 0) {
                const progress = life / circle.userData.maxLife;
                circle.material.uniforms.time.value = elapsed - circle.userData.startTime;
                circle.material.uniforms.opacity.value = progress;
                circle.scale.setScalar(2 - progress);
            } else {
                scene.remove(circle);
                circle.geometry.dispose();
                circle.material.dispose();
                magicCircles.splice(index, 1);
            }
        });

        energyTrails.forEach((trail, index) => {
            const life = trail.userData.life - delta;
            trail.userData.life = life;
            
            if (life > 0) {
                const progress = life / trail.userData.maxLife;
                trail.position.y += 8 * delta;
                trail.material.opacity = progress;
                trail.rotation.y += delta * 2;
            } else {
                scene.remove(trail);
                trail.geometry.dispose();
                trail.material.dispose();
                energyTrails.splice(index, 1);
            }
        });

        if (composer) {
            composer.render(delta); // Pass delta to composer.render()
        } else {
            renderer.render(scene, camera);
        }
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    onUnmounted(() => {
        document.removeEventListener('mousemove', handleMouseMove); // Remove mousemove listener
        window.removeEventListener("resize", onWindowResize); // Remove resize listener
        
        if(renderer) {
            renderer.setAnimationLoop(null);
            renderer.dispose();
        }
        if (scene) {
            scene.traverse(object => {
                // Dispose geometries and materials
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
        // Dispose any other resources like textures or render targets if present
        // textures.forEach(t => t.dispose()); // Not used in this new setup
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

/* CSS from error_logs.md */
body {
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
    font-family: 'Arial', sans-serif;
    overflow: hidden;
    cursor: none;
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

.title {
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    text-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
    opacity: 0.9;
    letter-spacing: 2px;
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