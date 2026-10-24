// Chase camera: follows behind and above the rider, looking ahead down the trail.
// Slowly circles the bike on the start screen, and watches the rider during a crash.
import * as THREE from './three.js';
import { groundAt } from './terrain.js';

export function createChaseCamera(camera, reduceMotion) {
  const position = new THREE.Vector3(), lookAt = new THREE.Vector3();
  let shake = 0;

  // Where the camera wants to be (5.2 m behind, 2.4 m up) and what it looks at (6 m ahead).
  function targets(b) {
    const forward = new THREE.Vector3(Math.sin(b.h), 0, -Math.cos(b.h));
    const p = new THREE.Vector3(b.x, b.y, b.z).addScaledVector(forward, -5.2);
    p.y = Math.max(p.y, groundAt(p.x, p.z)) + 2.4; // never below the ground behind
    const l = new THREE.Vector3(b.x, b.y + 0.9, b.z).addScaledVector(forward, 6);
    return [p, l];
  }

  function snap(b) {
    const [p, l] = targets(b);
    position.copy(p); lookAt.copy(l);
    camera.position.copy(position);
    camera.lookAt(lookAt);
  }

  // mode is the run state: 'menu', 'ride', 'crash' or 'done'. riderPosition is used in a crash.
  function update(dt, b, mode, menuTime, riderPosition) {
    const [p, l] = targets(b);
    if (mode === 'menu') {
      const angle = Math.sin(menuTime * 0.25) * 0.6;
      const f = new THREE.Vector3(Math.sin(b.h + angle), 0, -Math.cos(b.h + angle));
      p.set(b.x, b.y, b.z).addScaledVector(f, -4.5);
      p.y = b.y + 1.8;
      l.set(b.x, b.y + 0.9, b.z);
    }
    // ease toward the targets; slower during a crash so you can watch the tumble
    const k = mode === 'crash' ? 1 - Math.exp(-dt * 1.5) : 1 - Math.exp(-dt * 6);
    position.lerp(p, k);
    lookAt.lerp(mode === 'crash' ? riderPosition : l, 1 - Math.exp(-dt * 8));
    camera.position.copy(position);
    if (shake > 0.001 && !reduceMotion) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    shake *= Math.exp(-dt * 7);
    camera.lookAt(lookAt);
  }

  return { snap, update, setShake: amount => { shake = amount; } };
}
