// Dust kicked up sideways from the rear wheel when the bike slides.
import * as THREE from './three.js';

const COUNT = 90; // particles are reused in a ring

export function createDust(scene) {
  const positions = new Float32Array(COUNT * 3), velocities = new Float32Array(COUNT * 3), life = new Float32Array(COUNT);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xb48c60, size: 0.35, transparent: true, opacity: 0.55, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  let next = 0, owed = 0;

  function update(dt, b, riding) {
    if (b.slide > 0.05 && !b.air && riding) {
      owed += dt * (25 + b.slide * 60); // more dust the harder you slide
      const rx = Math.cos(b.h), rz = Math.sin(b.h), fx = Math.sin(b.h), fz = -Math.cos(b.h);
      const side = -Math.sign(b.drift) || 1;
      while (owed >= 1) {
        owed -= 1;
        const i = next;
        next = (next + 1) % COUNT;
        positions[i * 3] = b.x - fx * 0.55; positions[i * 3 + 1] = b.y + 0.1; positions[i * 3 + 2] = b.z - fz * 0.55;
        velocities[i * 3] = rx * side * (1 + Math.random() * 2) + (Math.random() - 0.5);
        velocities[i * 3 + 1] = 0.6 + Math.random() * 1.2;
        velocities[i * 3 + 2] = rz * side * (1 + Math.random() * 2) + (Math.random() - 0.5);
        life[i] = 0.9;
      }
    }
    for (let i = 0; i < COUNT; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        for (let k = 0; k < 3; k++) positions[i * 3 + k] += velocities[i * 3 + k] * dt;
        velocities[i * 3 + 1] -= 1.5 * dt;
      } else positions[i * 3 + 1] = -9999; // parked out of sight
    }
    geometry.attributes.position.needsUpdate = true;
  }
  return { update };
}
