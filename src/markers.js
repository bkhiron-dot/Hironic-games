// Things standing beside the trail: start, split and finish gates, landing flags,
// the warning signs before big jumps, and the trailhead's fence, closed gates and map.
import * as THREE from './three.js';

const ORANGE = 0xe0672f;

// Text painted onto a canvas, used as a texture for banners and signs.
function bannerTexture(text, background, foreground) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = background; g.fillRect(0, 0, 512, 96);
  g.fillStyle = foreground;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // shrink long names until they fit
  let size = 54;
  do g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`; while (g.measureText(text).width > 480 && (size -= 2) > 20);
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
  if (trail.trailhead) {
    // the trail's own gate in the clearing carries its name in its colour
    const own = trail.trailhead.gates.find(g => g.open);
    gate(scene, trail, trail.start.gate, own.name.toUpperCase(), own.colour, '#f3f1ea');
    buildTrailhead(scene, trail);
  } else gate(scene, trail, trail.start.gate, 'START', '#1d2e1f', '#f3f1ea');
  landingFlags(scene, trail);
  trail.splits.forEach((s, i) => {
    const finish = i === trail.splits.length - 1;
    gate(scene, trail, s, finish ? 'FINISH' : 'SPLIT ' + (i + 1), finish ? '#e0672f' : '#1d2e1f', finish ? '#1a0d06' : '#f3f1ea');
  });
}

/* ---------- The trailhead ---------- */
const FENCE_POST_GAP = 2.5; // metres between fence posts

// Red and white tape, for the closed gates.
function tapeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 16;
  const g = canvas.getContext('2d');
  for (let x = -16; x < 256; x += 32) {
    g.fillStyle = '#d9302b'; g.beginPath();
    g.moveTo(x, 16); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 16); g.fill();
  }
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, 256, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// The map board: every trail's line drawn from its data (only the open one so far).
function mapTexture(trail) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#1d2e1f'; g.textAlign = 'center';
  g.font = 'bold 40px Arial, sans-serif'; g.fillText('TRAILHEAD', 256, 50);
  // the trail's line, top of the hill at the top of the board
  const points = [];
  for (let s = 0; s <= trail.length; s += 5) points.push(trail.pointAt(s));
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxZ = Math.max(...zs), minZ = Math.min(...zs);
  const scale = Math.min(150 / (maxX - minX || 1), 360 / (maxZ - minZ));
  const toBoard = p => [256 + (p.x - (minX + maxX) / 2) * scale, 80 + (maxZ - p.z) * scale];
  const own = trail.trailhead.gates.find(gt => gt.open);
  g.strokeStyle = own.colour; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath();
  points.forEach((p, i) => { const [x, y] = toBoard(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.stroke();
  // jumps as orange marks, splits as dark dots
  g.fillStyle = ORANGE;
  for (const j of trail.jumps) { const [x, y] = toBoard(trail.pointAt(j.s)); g.fillRect(x - 9, y - 4, 18, 8); }
  g.fillStyle = '#1d2e1f';
  for (const s of trail.splits) { const [x, y] = toBoard(trail.pointAt(s)); g.beginPath(); g.arc(x, y, 7, 0, 2 * Math.PI); g.fill(); }
  // the key: each gate, left to right as you face them
  g.textAlign = 'left';
  trail.trailhead.gates.forEach((gt, i) => {
    const x = 12 + i * 168;
    g.fillStyle = gt.colour; g.fillRect(x, 452, 16, 16);
    g.fillStyle = '#1d2e1f'; g.font = 'bold 19px Arial, sans-serif';
    g.fillText(gt.name, x + 21, 467);
    g.font = '17px Arial, sans-serif';
    g.fillText(gt.open ? `${(trail.length / 1000).toFixed(1)} km, ${trail.jumps.length} jumps` : 'coming soon', x + 21, 492);
  });
  return new THREE.CanvasTexture(canvas);
}

function buildTrailhead(scene, trail) {
  const th = trail.trailhead, facingUp = -th.heading; // faces uphill, toward riders in the clearing
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const at = (u, v, up) => { const p = th.world(u, v); return new THREE.Vector3(p.x, trail.groundAt(p.x, p.z) + up, p.z); };

  // Fence posts and two rails round the edge, leaving a gap at every gate.
  const inGate = v => th.gates.some(g => Math.abs(v - g.v) < th.opening);
  const corners = [[0, -th.halfWidth], [-th.depth, -th.halfWidth], [-th.depth, th.halfWidth], [0, th.halfWidth], [0, -th.halfWidth]];
  const posts = [], rails = [];
  for (let k = 0; k < 4; k++) {
    const [u0, v0] = corners[k], [u1, v1] = corners[k + 1];
    const n = Math.round(Math.hypot(u1 - u0, v1 - v0) / FENCE_POST_GAP);
    for (let i = 0; i < n; i++) {
      const a = [u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * i / n], b = [u0 + (u1 - u0) * (i + 1) / n, v0 + (v1 - v0) * (i + 1) / n];
      const gateLine = u0 === 0 && u1 === 0;
      if (gateLine && (inGate(a[1]) || inGate(b[1]))) continue;
      posts.push(at(a[0], a[1], 0.6), at(b[0], b[1], 0.6));
      for (const up of [0.55, 1.05]) rails.push([at(a[0], a[1], up), at(b[0], b[1], up)]);
    }
  }
  const dummy = new THREE.Object3D();
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), wood, posts.length);
  posts.forEach((p, i) => { dummy.position.copy(p); dummy.rotation.set(0, facingUp, 0); dummy.updateMatrix(); postMesh.setMatrixAt(i, dummy.matrix); });
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.05), wood, rails.length);
  rails.forEach(([a, b], i) => {
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x), 0);
    dummy.scale.set(a.distanceTo(b), 1, 1);
    dummy.updateMatrix(); railMesh.setMatrixAt(i, dummy.matrix);
  });
  dummy.scale.set(1, 1, 1);
  for (const m of [postMesh, railMesh]) { m.frustumCulled = false; m.castShadow = true; scene.add(m); }

  // Closed gates: posts, a banner with the trail's name, tape across and a "coming soon" board.
  const tape = new THREE.MeshBasicMaterial({ map: tapeTexture(), side: THREE.DoubleSide });
  tape.map.repeat.set(th.opening * 2 / 2, 1);
  for (const g of th.gates.filter(gt => !gt.open)) {
    const postMaterial = new THREE.MeshLambertMaterial({ color: g.colour });
    for (const side of [-1, 1]) {
      scene.add(placed(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), postMaterial), at(0, g.v + side * th.opening, 2.3), facingUp));
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(2 * th.opening, 0.8, 0.06),
      [postMaterial, postMaterial, postMaterial, postMaterial, new THREE.MeshBasicMaterial({ map: bannerTexture(g.name.toUpperCase(), g.colour, '#f3f1ea') }), postMaterial]);
    scene.add(placed(banner, at(0, g.v, 4.4), facingUp));
    for (const up of [0.7, 1.15]) scene.add(placed(new THREE.Mesh(new THREE.PlaneGeometry(2 * th.opening, 0.1), tape), at(0, g.v, up), facingUp));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6),
      new THREE.MeshBasicMaterial({ map: bannerTexture('COMING SOON', '#f2a531', '#1a0d06'), side: THREE.DoubleSide }));
    scene.add(placed(board, at(-0.1, g.v, 1.7), facingUp));
  }

  // The map board, on two posts, to the left of the drop-in.
  const mapAt = { u: -th.depth + 16, v: th.local(th.dropIn.x, th.dropIn.z).v - 6 };
  for (const side of [-1, 1]) {
    const p = th.world(mapAt.u, mapAt.v + side * 1.1);
    scene.add(placed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), wood), new THREE.Vector3(p.x, trail.groundAt(p.x, p.z) + 1.3, p.z), facingUp));
  }
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: mapTexture(trail), side: THREE.DoubleSide }));
  scene.add(placed(map, at(mapAt.u, mapAt.v, 1.9), facingUp));
}

const placed = (mesh, position, rotationY) => { mesh.position.copy(position); mesh.rotation.y = rotationY; return mesh; };
