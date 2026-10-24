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
const facing = (trail, s) => -Math.atan2(trail.cxd(s), 1);

function gate(scene, trail, s, text, background, foreground) {
  const { cx, halfWidth, ground } = trail;
  const group = new THREE.Group(), c0 = cx(s), w = halfWidth(s);
  const postMaterial = new THREE.MeshLambertMaterial({ color: ORANGE });
  for (const side of [-1, 1]) {
    const off = side * (w + 0.6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), postMaterial);
    post.position.set(c0 + off, ground(s, off) + 2.3, -s);
    post.castShadow = true;
    group.add(post);
  }
  const front = new THREE.MeshBasicMaterial({ map: bannerTexture(text, background, foreground) });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(2 * (w + 0.6), 0.8, 0.06),
    [postMaterial, postMaterial, postMaterial, postMaterial, front, postMaterial]);
  banner.position.set(c0, ground(s, 0) + 4.4, -s);
  banner.rotation.y = facing(trail, s);
  group.add(banner);
  scene.add(group);
}

// Green flags bracket the sweet spot; amber flags mark the outer edges of the landing.
function landingFlags(scene, trail) {
  const { cx, halfWidth, ground } = trail;
  const pole = new THREE.MeshLambertMaterial({ color: 0xf3f1ea });
  const green = new THREE.MeshLambertMaterial({ color: 0x3fbf5f, side: THREE.DoubleSide });
  const amber = new THREE.MeshLambertMaterial({ color: 0xf2a531, side: THREE.DoubleSide });
  const flag = new THREE.BufferGeometry();
  flag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, -0.32, 0, 0, -0.16, 0.45]), 3));
  flag.computeVertexNormals();
  for (const j of trail.jumps) {
    if (j.big) {
      // warning board 30 m before a big jump
      const s = j.s - 30, off = halfWidth(s) + 1.2, y = ground(s, off);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), pole);
      post.position.set(cx(s) + off, y + 1.1, -s);
      scene.add(post);
      const text = j.popOptional ? 'BIG JUMP' : 'BIG JUMP - POP';
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34),
        new THREE.MeshBasicMaterial({ map: bannerTexture(text, '#e0672f', '#1a0d06'), side: THREE.DoubleSide }));
      board.position.set(cx(s) + off, y + 2.1, -s);
      board.rotation.y = facing(trail, s) - 0.35;
      scene.add(board);
    }
    for (const [u, material] of [[j.short, amber], [j.sweet0, green], [j.sweet1, green], [j.long, amber]]) {
      const s = j.s + u, w = halfWidth(s);
      for (const side of [-1, 1]) {
        const off = side * (w + 0.35), y = ground(s, off);
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), pole);
        p.position.set(cx(s) + off, y + 0.7, -s);
        scene.add(p);
        const f = new THREE.Mesh(flag, material);
        f.position.set(cx(s) + off, y + 1.4, -s);
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
