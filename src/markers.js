// Things standing beside the trail: start, split and finish gates, landing flags,
// and the warning signs before big jumps.
import * as THREE from './three.js';

const ORANGE = 0xe0672f;

// Text painted onto a canvas, used as a texture for banners and signs.
function bannerTexture(text, background, foreground) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = background; g.fillRect(0, 0, 512, 96);
  g.fillStyle = foreground;
  g.font = 'bold 54px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  return new THREE.CanvasTexture(canvas);
}

// Trail heading at s, as a y rotation, so gates and flags face up the trail.
const facing = (trail, s) => -trail.headingAt(s);

// Places a mesh at path position (s, off), `up` metres above the ground there.
function putAt(mesh, trail, s, off, up) {
  const p = trail.pointAt(s, off);
  mesh.position.set(p.x, trail.groundAt(p.x, p.z) + up, p.z);
  return mesh;
}

function gate(scene, trail, s, text, background, foreground) {
  const group = new THREE.Group(), w = trail.halfWidth(s);
  const postMaterial = new THREE.MeshLambertMaterial({ color: ORANGE });
  for (const side of [-1, 1]) {
    const post = putAt(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), postMaterial), trail, s, side * (w + 0.6), 2.3);
    post.castShadow = true;
    group.add(post);
  }
  const front = new THREE.MeshBasicMaterial({ map: bannerTexture(text, background, foreground) });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(2 * (w + 0.6), 0.8, 0.06),
    [postMaterial, postMaterial, postMaterial, postMaterial, front, postMaterial]);
  putAt(banner, trail, s, 0, 4.4);
  banner.rotation.y = facing(trail, s);
  group.add(banner);
  scene.add(group);
}

// Green flags bracket the sweet spot; amber flags mark the outer edges of the landing.
function landingFlags(scene, trail) {
  const { halfWidth } = trail;
  const pole = new THREE.MeshLambertMaterial({ color: 0xf3f1ea });
  const green = new THREE.MeshLambertMaterial({ color: 0x3fbf5f, side: THREE.DoubleSide });
  const amber = new THREE.MeshLambertMaterial({ color: 0xf2a531, side: THREE.DoubleSide });
  const flag = new THREE.BufferGeometry();
  flag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -0.32, 0, 0, -0.16, 0.45]), 3));
  flag.computeVertexNormals();
  for (const j of trail.jumps) {
    if (j.big) {
      // warning board 30 m before a big jump
      const s = j.s - 30, off = halfWidth(s) + 1.2;
      scene.add(putAt(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), pole), trail, s, off, 1.1));
      const text = j.popOptional ? 'BIG JUMP' : 'BIG JUMP - POP';
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34),
        new THREE.MeshBasicMaterial({ map: bannerTexture(text, '#e0672f', '#1a0d06'), side: THREE.DoubleSide }));
      putAt(board, trail, s, off, 2.1);
      board.rotation.y = facing(trail, s) - 0.35;
      scene.add(board);
    }
    for (const [u, material] of [[j.short, amber], [j.sweet0, green], [j.sweet1, green], [j.long, amber]]) {
      const s = j.s + u, w = halfWidth(s);
      for (const side of [-1, 1]) {
        const off = side * (w + 0.35);
        scene.add(putAt(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), pole), trail, s, off, 0.7));
        const f = putAt(new THREE.Mesh(flag, material), trail, s, off, 1.4);
        f.rotation.y = facing(trail, s) + (side > 0 ? Math.PI : 0);
        scene.add(f);
      }
    }
  }
}

export function buildMarkers(scene, trail) {
  gate(scene, trail, trail.start.gate, 'START', '#1d2e1f', '#f3f1ea');
  landingFlags(scene, trail);
  trail.splits.forEach((s, i) => {
    const finish = i === trail.splits.length - 1;
    gate(scene, trail, s, finish ? 'FINISH' : 'SPLIT ' + (i + 1), finish ? '#e0672f' : '#1d2e1f', finish ? '#1a0d06' : '#f3f1ea');
  });
}
