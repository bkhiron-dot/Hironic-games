// The rainforest: tall gums, tree ferns, undergrowth and rocks.
// planForest() decides where everything goes (plain data, testable in Node);
// buildForest() turns that into meshes. Everything is grouped into 100 m chunks
// so only the forest near the rider is drawn.
import * as THREE from './three.js';
import { pickFrom } from './util.js';

export const CHUNK_LENGTH = 100;
export const TREE_BUCKET_LENGTH = 5; // trees are also filed in 5 m buckets for crash checks

const TRUNK_COLOURS = [0xe6e0d3, 0xd7cdb9, 0xc7baa1, 0xece7dc];
const CANOPY_COLOURS = [0x4e5f35, 0x5a6b3d, 0x46552f, 0x617043];
const FERN_COLOURS = [0x4f7a34, 0x5b8a3b, 0x46702e];
const BUSH_COLOURS = [0x23391e, 0x2b4424, 0x1f331b, 0x31502a];
const ROCK_COLOURS = [0x6f736b, 0x7d8178, 0x5f6359];

// Plants are placed at a distance s along the trail and an offset square to it. On the inside
// of a bend a long offset can reach back toward the trail, so every spot is checked against
// the whole trail. Returns { chunks: { [chunkIndex]: lists }, treeBuckets }.
export function planForest(trail, random) {
  const { halfWidth, length } = trail;
  const chunks = {}, treeBuckets = {};
  // World spot for (s, off), or null if it is within `gap` of the trail edge anywhere.
  const place = (s, off, gap) => {
    const p = trail.pointAt(s, off), at = trail.locate(p.x, p.z);
    if (Math.abs(at.off) < halfWidth(at.s) + gap) return null;
    return { x: p.x, z: p.z, s: at.s, y: trail.groundAt(p.x, p.z) };
  };
  const chunk = s => {
    const k = Math.floor(s / CHUNK_LENGTH);
    return chunks[k] || (chunks[k] = { trunks: [], canopy: [], fernTrunks: [], fernCrowns: [], bushes: [], rocks: [] });
  };

  // Tall gums both sides of the trail. Only these can be crashed into.
  for (let s = -10; s < length + 70; s += 0.55 + random() * 1.0) {
    for (const side of [-1, 1]) {
      if (random() < 0.22) continue;
      const spot = place(s, side * (halfWidth(s) + 1.3 + Math.pow(random(), 1.5) * 58), 1.2);
      if (!spot) continue;
      const { x, z } = spot, y = spot.y - 0.4;
      const H = 22 + random() * 18, r = 0.22 + random() * 0.36;
      const c = chunk(spot.s);
      c.trunks.push({ x, y: y + H / 2, z, sx: r, sy: H, sz: r, ry: random() * 6, c: pickFrom(random, TRUNK_COLOURS) });
      const crowns = 1 + Math.floor(random() * 2);
      for (let n = 0; n < crowns; n++) {
        c.canopy.push({ x: x + (random() - 0.5) * 3, y: y + H * (0.8 + random() * 0.25), z: z + (random() - 0.5) * 3,
          sx: 2.6 + random() * 3.4, sy: 1.2 + random() * 1.3, sz: 2.6 + random() * 3.4, ry: random() * 6, c: pickFrom(random, CANOPY_COLOURS) });
      }
      const bucket = Math.floor(spot.s / TREE_BUCKET_LENGTH);
      (treeBuckets[bucket] || (treeBuckets[bucket] = [])).push({ x, z, r });
    }
  }
  // Tree ferns
  for (let n = 0; n < 2100; n++) {
    const s = -10 + random() * (length + 80), side = random() < 0.5 ? -1 : 1;
    const spot = place(s, side * (halfWidth(s) + 0.5 + Math.pow(random(), 1.4) * 30), 0.4);
    if (!spot) continue;
    const { x, y, z } = spot;
    const H = 0.8 + random() * 2.4, w = 1.1 + random() * 0.9, c = chunk(spot.s);
    c.fernTrunks.push({ x, y: y + H / 2, z, sx: 1, sy: H, sz: 1, c: 0x4a3424 });
    c.fernCrowns.push({ x, y: y + H + 0.05, z, sx: w, sy: 0.8 + random() * 0.4, sz: w, ry: random() * 6, rx: (random() - 0.5) * 0.2, c: pickFrom(random, FERN_COLOURS) });
  }
  // Undergrowth
  for (let n = 0; n < 1500; n++) {
    const s = -10 + random() * (length + 80), side = random() < 0.5 ? -1 : 1;
    const spot = place(s, side * (halfWidth(s) + 3 + Math.pow(random(), 1.1) * 45), 2.5);
    if (!spot) continue;
    const c = chunk(spot.s), w = 0.9 + random() * 1.8;
    c.bushes.push({ x: spot.x, y: spot.y + 0.1, z: spot.z, sx: w, sy: 0.45 + random() * 0.7, sz: w * (0.8 + random() * 0.4), ry: random() * 6, c: pickFrom(random, BUSH_COLOURS) });
  }
  // Rocks off the trail only, thicker beside the rocky sections
  for (let n = 0; n < 800; n++) {
    const s = -5 + random() * (length + 40);
    const rocky = trail.scenery.rocky.some(r => s > r[0] && s < r[1]);
    if (!rocky && random() < 0.35) continue;
    const spot = place(s, (random() < 0.5 ? -1 : 1) * (halfWidth(s) + 0.7 + random() * (rocky ? 5 : 2.5)), 0.6);
    if (!spot) continue;
    const size = 0.2 + random() * (rocky ? 0.7 : 0.45);
    chunk(spot.s).rocks.push({ x: spot.x, y: spot.y, z: spot.z, sx: size * (1 + random() * 0.6), sy: size * 0.6, sz: size,
      rx: random() * 3, ry: random() * 6, c: pickFrom(random, ROCK_COLOURS) });
  }
  return { chunks, treeBuckets };
}

// One InstancedMesh per kind of plant per chunk: thousands of plants in a few draw calls.
function instanced(scene, geometry, material, list, castShadow) {
  if (!list.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const dummy = new THREE.Object3D(), colour = new THREE.Color();
  list.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.sx, it.sy, it.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, colour.set(it.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = !!castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // visibility is handled by chunks instead (CLAUDE.md "Known gotchas")
  scene.add(mesh);
  return mesh;
}

export function buildForest(scene, plan) {
  const white = () => new THREE.MeshLambertMaterial({ color: 0xffffff }); // instance colours tint it
  const shapes = {
    trunks: [new THREE.CylinderGeometry(0.6, 1, 1, 7), white(), true],
    canopy: [new THREE.IcosahedronGeometry(1, 0), white(), true],
    fernTrunks: [new THREE.CylinderGeometry(0.11, 0.15, 1, 5), white(), false],
    fernCrowns: [new THREE.ConeGeometry(1, 0.7, 9, 1, true), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), true],
    bushes: [new THREE.IcosahedronGeometry(1, 0), white(), false],
    rocks: [new THREE.DodecahedronGeometry(1, 0), white(), false],
  };
  const chunks = Object.keys(plan.chunks).map(k => ({
    start: +k * CHUNK_LENGTH,
    meshes: Object.entries(shapes)
      .map(([kind, [geometry, material, cast]]) => instanced(scene, geometry, material, plan.chunks[k][kind], cast))
      .filter(Boolean),
  }));

  // Draw only the forest from 60 m behind to 210 m ahead of distance s.
  function showNear(s) {
    for (const c of chunks) {
      const visible = c.start + CHUNK_LENGTH > s - 60 && c.start < s + 210;
      for (const m of c.meshes) m.visible = visible;
    }
  }
  return { showNear };
}
