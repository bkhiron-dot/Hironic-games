// Renderer, scene, sky, lights and the distant mountains.
import * as THREE from './three.js';
import { TRACK_LENGTH } from './trail.js';

const SKY = 0xc3d3dc;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // v1 (r128) wrote colours straight to the screen; newer versions convert to sRGB by default.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 22, 165); // mist: trees fade out with distance

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2000);

  // Light intensities are v1's values x pi. Since r155, Three.js lights a scene pi times
  // dimmer for the same number; multiplying back gives exactly r128's brightness.
  scene.add(new THREE.HemisphereLight(0xdfe9ee, 0x6a5236, 0.9 * Math.PI));
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.85 * Math.PI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // Wider field of view when the phone is upright, so you can still see the trail ahead.
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 80 : 68;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sun };
}

// The shadow-casting sun follows the rider so shadows stay sharp near the bike.
export function followWithSun(sun, x, y, z) {
  sun.position.set(x + 30, y + 60, z + 15);
  sun.target.position.set(x, y, z);
}

// Two rows of cone mountains beyond the bottom of the track; the far row has snow caps.
export function buildMountains(scene, random) {
  const far = new THREE.MeshBasicMaterial({ color: 0xa6b6c0, fog: false });
  const near = new THREE.MeshBasicMaterial({ color: 0x7f9199, fog: false });
  const snow = new THREE.MeshBasicMaterial({ color: 0xeef2f4, fog: false });
  const add = (x, z, baseY, h, r, mat, snowy) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat);
    m.position.set(x, baseY + h / 2, z);
    m.rotation.y = random() * 6;
    scene.add(m);
    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, h * 0.2, 7), snow);
      cap.position.set(x, baseY + h * 0.9 + 0.5, z);
      cap.rotation.y = m.rotation.y;
      scene.add(cap);
    }
  };
  for (let i = 0; i < 14; i++) add(-900 + i * 140 + random() * 60, -(TRACK_LENGTH + 650 + random() * 250), -420, 320 + random() * 260, 180 + random() * 90, far, random() < 0.6);
  for (let i = 0; i < 10; i++) add(-700 + i * 150 + random() * 50, -(TRACK_LENGTH + 380 + random() * 120), -400, 200 + random() * 150, 150 + random() * 70, near, false);
}
