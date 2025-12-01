<template>
  <div class="canvas-container">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const canvasRef = ref(null)

// Fixed screen dimensions
const SCREEN_WIDTH = 412
const SCREEN_HEIGHT = 915

onMounted(() => {
  // Scene setup
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x001122)
  
  // Camera setup
  const camera = new THREE.PerspectiveCamera(75, SCREEN_WIDTH / SCREEN_HEIGHT, 0.1, 1000)
  camera.position.set(0, 0, 50)
  
  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ 
    canvas: canvasRef.value,
    antialias: true 
  })
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  
  // LIGHTS - Proper lighting setup
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6) // Soft white light
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(20, 20, 20)
  directionalLight.castShadow = true
  scene.add(directionalLight)
  
  const pointLight = new THREE.PointLight(0x00aaff, 1, 100)
  pointLight.position.set(-20, 10, 20)
  scene.add(pointLight)
  
  const pointLight2 = new THREE.PointLight(0xffaa00, 1, 100)
  pointLight2.position.set(20, -10, 20)
  scene.add(pointLight2)
  
  // Create random balls with materials
  const balls = []
  const ballCount = 15
  
  for (let i = 0; i < ballCount; i++) {
    const size = Math.random() * 3 + 1
    const geometry = new THREE.SphereGeometry(size, 32, 32)
    
    // Create shiny material
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
      shininess: 100,
      specular: 0xffffff
    })
    
    const ball = new THREE.Mesh(geometry, material)
    
    // Random position within view
    ball.position.x = (Math.random() - 0.5) * 60
    ball.position.y = (Math.random() - 0.5) * 120
    ball.position.z = (Math.random() - 0.5) * 30
    
    // Store velocity for animation
    ball.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    )
    
    scene.add(ball)
    balls.push(ball)
  }
  
  // Lightning effect system
  class LightningEffect {
    constructor() {
      this.isActive = false
      this.duration = 0.5
      this.startTime = 0
      this.targetBall = null
      this.elements = []
    }
    
    strike(targetBall, currentTime) {
      this.isActive = true
      this.startTime = currentTime
      this.targetBall = targetBall
      this.elements = []
      
      // Create lightning bolt
      this.createLightningBolt()
      
      // Create flash effect
      this.createFlash()
      
      // Enhance ball material temporarily
      this.enhanceBallMaterial()
    }
    
    createLightningBolt() {
      const points = []
      const startPos = new THREE.Vector3(
        this.targetBall.position.x + (Math.random() - 0.5) * 30,
        this.targetBall.position.y + 40,
        this.targetBall.position.z
      )
      const endPos = this.targetBall.position.clone()
      
      points.push(startPos)
      
      // Create jagged path
      const segments = 8
      for (let i = 1; i < segments; i++) {
        const t = i / segments
        const point = new THREE.Vector3().lerpVectors(startPos, endPos, t)
        
        // Add randomness for jagged effect
        point.x += (Math.random() - 0.5) * 8
        point.y += (Math.random() - 0.5) * 8
        point.z += (Math.random() - 0.5) * 4
        
        points.push(point)
      }
      points.push(endPos)
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9
      })
      
      const lightning = new THREE.Line(geometry, material)
      scene.add(lightning)
      this.elements.push({ type: 'line', object: lightning })
    }
    
    createFlash() {
      // Add intense point light at ball position
      const flashLight = new THREE.PointLight(0x00aaff, 5, 50)
      flashLight.position.copy(this.targetBall.position)
      scene.add(flashLight)
      this.elements.push({ type: 'light', object: flashLight })
      
      // Add glow sphere
      const glowGeometry = new THREE.SphereGeometry(8, 16, 16)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.BackSide
      })
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial)
      glowSphere.position.copy(this.targetBall.position)
      scene.add(glowSphere)
      this.elements.push({ type: 'glow', object: glowSphere })
    }
    
    enhanceBallMaterial() {
      // Store original material properties
      const originalEmissive = this.targetBall.material.emissive
        ? this.targetBall.material.emissive.clone()
        : new THREE.Color(0x000000)
      const originalEmissiveIntensity = this.targetBall.material.emissiveIntensity || 0
      
      // Make ball glow
      this.targetBall.material.emissive = new THREE.Color(0x00aaff)
      this.targetBall.material.emissiveIntensity = 1
      
      // Store for restoration
      this.originalEmissive = originalEmissive
      this.originalEmissiveIntensity = originalEmissiveIntensity
    }
    
    restoreBallMaterial() {
      if (this.targetBall) {
        this.targetBall.material.emissive.copy(this.originalEmissive)
        this.targetBall.material.emissiveIntensity = this.originalEmissiveIntensity
      }
    }
    
    update(currentTime) {
      if (!this.isActive) return
      
      const elapsed = currentTime - this.startTime
      const progress = elapsed / this.duration
      
      if (progress >= 1) {
        this.deactivate()
        return
      }
      
      // Flicker effect
      const flicker = Math.sin(progress * Math.PI * 20) * 0.5 + 0.5
      
      // Update lightning opacity
      this.elements.forEach(element => {
        if (element.type === 'line') {
          element.object.material.opacity = 0.7 * (1 - progress) * flicker
        } else if (element.type === 'light') {
          element.object.intensity = 3 * (1 - progress) * flicker
        } else if (element.type === 'glow') {
          element.object.material.opacity = 0.3 * (1 - progress) * flicker
          element.object.scale.setScalar(1 + Math.sin(progress * Math.PI * 10) * 0.2)
        }
      })
      
      // Reduce ball glow over time
      if (this.targetBall) {
        this.targetBall.material.emissiveIntensity = (1 - progress) * flicker
      }
    }
    
    deactivate() {
      this.isActive = false
      this.restoreBallMaterial()
      
      // Remove all effect elements from scene
      this.elements.forEach(element => {
        scene.remove(element.object)
        if (element.object.geometry) element.object.geometry.dispose()
        if (element.object.material) element.object.material.dispose()
      })
      
      this.elements = []
      this.targetBall = null
    }
  }
  
  const lightningEffect = new LightningEffect()
  let lastLightningTime = 0
  const lightningInterval = 2 // seconds
  
  // Animation loop
  const clock = new THREE.Clock()
  
  function animate() {
    const currentTime = clock.getElapsedTime()
    
    // Update balls animation
    balls.forEach(ball => {
      ball.position.add(ball.userData.velocity)
      
      // Simple bounds checking
      if (Math.abs(ball.position.x) > 30) ball.userData.velocity.x *= -1
      if (Math.abs(ball.position.y) > 60) ball.userData.velocity.y *= -1
      if (Math.abs(ball.position.z) > 15) ball.userData.velocity.z *= -1
      
      // Slow rotation
      ball.rotation.x += 0.01
      ball.rotation.y += 0.02
    })
    
    // Random lightning strikes
    if (currentTime - lastLightningTime > lightningInterval && balls.length > 0) {
      const randomBall = balls[Math.floor(Math.random() * balls.length)]
      lightningEffect.strike(randomBall, currentTime)
      lastLightningTime = currentTime
    }
    
    // Update lightning effect
    lightningEffect.update(currentTime)
    
    // Render
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }
  
  // Start animation
  animate()
  
  // Cleanup
  onUnmounted(() => {
    renderer.dispose()
  })
})
</script>

<style scoped>
.canvas-container {
  width: 412px;
  height: 915px;
  max-width: 412px;
  max-height: 915px;
  margin: 0 auto;
  background: linear-gradient(135deg, #001122 0%, #003344 100%);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>