import * as PIXI from "pixi.js";
import { gsap } from "gsap";
import { MotionBlurFilter } from "@pixi/filter-motion-blur";
import { AdvancedBloomFilter } from "@pixi/filter-advanced-bloom";

export function playCoinCelebration(containerElement) {
  const app = new PIXI.Application({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
  });
  containerElement.appendChild(app.view);

  // Bloom + motion blur
  const bloom = new AdvancedBloomFilter({
    threshold: 0.2,
    bloomScale: 1.4,
  });
  app.stage.filters = [bloom];

  const coinTexture = PIXI.Texture.from("/assets/coin.png");

  const coins = [];
  const totalCoins = 80; // high engagement

  // Spawn coins with 3D parallax
  for (let i = 0; i < totalCoins; i++) {
    const coin = new PIXI.Sprite(coinTexture);

    coin.anchor.set(0.5);

    // "3D depth" value (0 = far, 1 = near)
    coin.depth = Math.random();

    coin.scale.set(0.25 + coin.depth * 0.8);
    coin.x = window.innerWidth / 2;
    coin.y = window.innerHeight / 2;

    // Add slight rotation
    coin.rotationSpeed = (Math.random() - 0.5) * 0.3;

    // Motion-blur when moving fast
    coin.filters = [
      new MotionBlurFilter([5 * coin.depth, 10 * coin.depth], 10)
    ];

    app.stage.addChild(coin);
    coins.push(coin);

    animateCoin(coin);
  }

  function animateCoin(coin) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 400 + 600 * coin.depth;

    // Target positions (3D-style arc)
    const targetX = coin.x + Math.cos(angle) * radius;
    const targetY = coin.y + Math.sin(angle) * radius * (0.5 + coin.depth);

    // Exit to top for extra “burst” feel
    const exitY = coin.y - (600 + 300 * coin.depth);

    // Animation sequence: burst → arc → fade
    gsap.timeline()
      .to(coin, {
        duration: 0.8,
        pixi: { x: targetX, y: targetY },
        ease: "power3.out"
      })
      .to(coin, {
        duration: 1.6,
        pixi: { y: exitY },
        alpha: 0,
        scale: coin.scale.x * 1.3,
        ease: "power2.in",
        onComplete: () => {
          coin.destroy(true);
        }
      });
  }

  // Rotate coins (this helps create 3D feel)
  app.ticker.add(() => {
    coins.forEach(c => {
      c.rotation += c.rotationSpeed;
    });
  });

  // Auto destroy celebration after 5 seconds
  setTimeout(() => {
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    containerElement.innerHTML = "";
  }, 5000);
}
