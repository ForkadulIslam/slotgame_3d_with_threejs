import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';


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

export default class EnergyBurst {
    constructor(canvas = null, loadingEl = null, spiritBtnEl = null, cursorEl = null) {
        this.canvas = canvas || document.querySelector('canvas');
        this.loadingElement = loadingEl || document.getElementById('loading');
        this.spiritBtnElement = spiritBtnEl || document.getElementById('spiritBtn');
        this.cursor = cursorEl || document.getElementById('cursor');

        // Scene Components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.composer = null;
        this.clock = new THREE.Clock();

        // Models & Animations
        this.soldier = null;
        this.mixer = null;
        this.animations = {};
        this.isLoaded = false;

        // Effects
        this.spiritParticles = [];
        this.magicCircles = [];
        this.energyTrails = [];
        this.ambientParticles = null;

        // Bind methods
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.releaseSpiritEffect = this.releaseSpiritEffect.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);

        this.init();
    }

    async init() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4, 12);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: this.canvas });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 2, 0);
        this.controls.maxPolarAngle = Math.PI * 0.8;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 30;

        this.createEpicEnvironment();
        this.createCinematicLighting();
        this.createAtmosphere();
        await this.loadSoldier();
        this.setupPostProcessing();

        // Event Listeners
        if (this.spiritBtnElement) {
            this.spiritBtnElement.addEventListener('click', this.releaseSpiritEffect);
        }
        if (this.cursor) {
            document.addEventListener('mousemove', this.handleMouseMove);
        }
        window.addEventListener('resize', this.onWindowResize);

        this.renderer.setAnimationLoop(this.animate);
    }

    createEpicEnvironment() {
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
        this.scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

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
        this.scene.add(ground);

        this.scene.fog = new THREE.FogExp2(0x000011, 0.01);
    }

    createCinematicLighting() {
        const ambientLight = new THREE.AmbientLight(0x404080, 0.8);
        this.scene.add(ambientLight);

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
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x0088ff, 2.5);
        rimLight.position.set(-15, 10, -10);
        this.scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(0xffaa44, 1.5);
        fillLight.position.set(8, 5, 15);
        this.scene.add(fillLight);

        const accentLight1 = new THREE.PointLight(0x00ffff, 2, 30);
        accentLight1.position.set(10, 5, 10);
        this.scene.add(accentLight1);

        const accentLight2 = new THREE.PointLight(0xff00ff, 2, 30);
        accentLight2.position.set(-10, 5, -10);
        this.scene.add(accentLight2);
    }

    createAtmosphere() {
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

        this.ambientParticles = new THREE.Points(geometry, material);
        this.scene.add(this.ambientParticles);
    }

    async loadSoldier() {
        const geometry = new THREE.SphereGeometry(1.5, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            color: 0x55aaff,
            roughness: 0.4,
            metalness: 0.3
        });

        this.soldier = new THREE.Mesh(geometry, material);
        this.soldier.castShadow = true;
        this.soldier.position.set(0, 1.5, 0);
        this.scene.add(this.soldier);
        
        this.isLoaded = true;
        if (this.loadingElement) this.loadingElement.style.display = "none";
        if (this.spiritBtnElement) this.spiritBtnElement.style.display = "block";
    }

    createFallbackSoldier() {
        const geometry = new THREE.CapsuleGeometry(0.8, 3, 4, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x4a4a4a,
            roughness: 0.7,
            metalness: 0.2
        });
        
        this.soldier = new THREE.Mesh(geometry, material);
        this.soldier.position.set(0, 1.5, 0);
        this.soldier.castShadow = true;
        this.soldier.receiveShadow = true;
        this.scene.add(this.soldier);

        if (this.loadingElement) this.loadingElement.style.display = 'none';
        if (this.spiritBtnElement) this.spiritBtnElement.style.display = 'block';
        this.isLoaded = true;
    }

    releaseSpiritEffect() {
        if (!this.soldier) return;

        this.createSpiritParticles();
        this.createMagicCircle();
        this.createEnergyTrails();

        console.log('Epic spirit effect released!');
    }

    createSpiritParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        const lives = new Float32Array(particleCount);

        const soldierPos = this.soldier.position;

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
            startTime: this.clock.getElapsedTime()
        };
        
        this.spiritParticles.push(spiritSystem);
        this.scene.add(spiritSystem);
    }

    createMagicCircle() {
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
        if (this.soldier) { 
            magicCircle.position.copy(this.soldier.position);
            magicCircle.position.y += 0.1;
        }
        magicCircle.rotation.x = -Math.PI / 2;
        magicCircle.userData = { 
            life: 3, 
            maxLife: 3,
            startTime: this.clock.getElapsedTime()
        };

        this.magicCircles.push(magicCircle);
        this.scene.add(magicCircle);
    }

    createEnergyTrails() {
        for (let i = 0; i < 8; i++) {
            const trailGeometry = new THREE.CylinderGeometry(0.05, 0.2, 10, 8);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 1, 0.5),
                transparent: true,
                opacity: 0.8
            });

            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            const angle = (i / 8) * Math.PI * 2;
            if (this.soldier) {
                trail.position.copy(this.soldier.position);
                trail.position.x += Math.cos(angle) * 3;
                trail.position.z += Math.sin(angle) * 3;
                trail.position.y += 2;
            }
            
            trail.userData = {
                life: 2,
                maxLife: 2,
                angle: angle,
                startTime: this.clock.getElapsedTime()
            };

            this.energyTrails.push(trail);
            this.scene.add(trail);
        }
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3, 0.8, 0.1
        );
        this.composer.addPass(bloomPass);

        const volumetricPass = new ShaderPass(VolumetricLightShader);
        volumetricPass.needsSwap = true;
        this.composer.addPass(volumetricPass);
    }

    animate(currentTime) {
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this.controls) this.controls.update();

        if (this.mixer && this.isLoaded) {
            this.mixer.update(delta);
        }

        if (this.ambientParticles) {
            this.ambientParticles.material.uniforms.time.value = elapsed * 0.5;
        }

        this.spiritParticles.forEach((system, index) => {
            const life = system.userData.life - delta;
            system.userData.life = life;
            
            if (life > 0) {
                const progress = life / system.userData.maxLife;
                system.material.uniforms.time.value = elapsed - system.userData.startTime;
                system.material.uniforms.opacity.value = progress;
            } else {
                this.scene.remove(system);
                system.geometry.dispose();
                system.material.dispose();
                this.spiritParticles.splice(index, 1);
            }
        });

        this.magicCircles.forEach((circle, index) => {
            const life = circle.userData.life - delta;
            circle.userData.life = life;
            
            if (life > 0) {
                const progress = life / circle.userData.maxLife;
                circle.material.uniforms.time.value = elapsed - circle.userData.startTime;
                circle.material.uniforms.opacity.value = progress;
                circle.scale.setScalar(2 - progress);
            } else {
                this.scene.remove(circle);
                circle.geometry.dispose();
                circle.material.dispose();
                this.magicCircles.splice(index, 1);
            }
        });

        this.energyTrails.forEach((trail, index) => {
            const life = trail.userData.life - delta;
            trail.userData.life = life;
            
            if (life > 0) {
                const progress = life / trail.userData.maxLife;
                trail.position.y += 8 * delta;
                trail.material.opacity = progress;
                trail.rotation.y += delta * 2;
            } else {
                this.scene.remove(trail);
                trail.geometry.dispose();
                trail.material.dispose();
                this.energyTrails.splice(index, 1);
            }
        });

        if (this.composer) {
            this.composer.render(delta);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    handleMouseMove(e) {
        if (this.cursor) {
            this.cursor.style.left = e.clientX - 10 + 'px';
            this.cursor.style.top = e.clientY - 10 + 'px';
        }
    }

    destroy() {
        if (this.renderer) {
            this.renderer.setAnimationLoop(null);
            this.renderer.dispose();
        }
    
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        if (this.spiritBtnElement) {
            this.spiritBtnElement.removeEventListener('click', this.releaseSpiritEffect);
        }
        if (this.cursor) {
            document.removeEventListener('mousemove', this.handleMouseMove);
        }
    
        // Dispose of Three.js objects
        if (this.scene) {
            this.scene.traverse(object => {
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

        console.log("EnergyBurst scene destroyed.");
    }
}