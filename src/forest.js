// The rainforest: tall gums, tree ferns, undergrowth, rocks, ground ferns and mossy logs.
// planForest() decides where everything goes (plain data, testable in Node);
// buildForest() turns that into meshes. Everything is grouped into 50 m squares of the world
// (chunks) so only the forest near the rider is drawn.
import * as THREE from './three.js';
import { paintedTexture } from './texture.js';
import { pickFrom, makeRandom } from './util.js';

export const CHUNK_SIZE = 50;
export const TREE_CELL = 5; // trees are also filed in 5 m squares of the world for crash checks
export const treeCell = (i, j) => i * 100003 + j; // the key of square (i, j)

const TRUNK_COLOURS = [0xe6e0d3, 0xd7cdb9, 0xc7baa1, 0xece7dc];
const CANOPY_COLOURS = [0x4e5f35, 0x5a6b3d, 0x46552f, 0x617043];
const FERN_COLOURS = [0x4f7a34, 0x5b8a3b, 0x46702e];
const BUSH_COLOURS = [0x23391e, 0x2b4424, 0x1f331b, 0x31502a];
const ROCK_COLOURS = [0x6f736b, 0x7d8178, 0x5f6359];
const GROUND_FERN_COLOURS = [0x5f9a3c, 0x6fa844, 0x4f8a34];
const LOG_COLOURS = [0x5a4a32, 0x4e5a30, 0x655238]; // dead wood, some of it mossy

// Plants are placed at a distance s along the trail and an offset square to it. On the inside
// of a bend a long offset can reach back toward the trail, so every spot is checked against
// the whole trail. On the mountain each trail plants only where it is the nearest trail, so where
// trails come close the forest isn't doubled, and nothing grows on any trail.
// Returns { chunks: { [chunkKey]: lists }, treeBuckets }.
export function planForest(trail, random) {
  const { halfWidth, length } = trail, world = trail.world;
  const chunks = {}, treeBuckets = {};
  // World spot for (s, off), or null if it is within `gap` of the trail edge anywhere.
  // A spot on a clearing, or nearer another trail, is marked `cleared`: the plant is still worked
  // out (using the same random numbers, so every other plant stays where it was) but then thrown away.
  const place = (s, off, gap) => {
    const p = trail.pointAt(s, off), at = trail.locate(p.x, p.z);
    if (Math.abs(at.off) < halfWidth(at.s) + gap) return null;
    if (!world) return { x: p.x, z: p.z, s: at.s, y: trail.groundAt(p.x, p.z), cleared: !!trail.trailhead && trail.trailhead.keepClear(p.x, p.z) };
    const here = world.sample(p.x, p.z), nearest = here.near[0];
    const cleared = world.keepClear(p.x, p.z) || (nearest && nearest.trail.id !== trail.id) || here.near.some(n => n.past < gap);
    return { x: p.x, z: p.z, s: at.s, y: here.height, cleared };
  };
  // On the mountain, every trail gets as much forest per metre as Flow Monster (1297 m).
  const per = n => (world ? Math.round(n * length / 1297) : n);
  const emptyLists = () => ({ trunks: [], canopy: [], fernTrunks: [], fernCrowns: [], bushes: [], rocks: [], groundFerns: [], logs: [] });
  const chunk = spot => {
    if (spot.cleared) return emptyLists(); // thrown away
    const k = Math.floor(spot.x / CHUNK_SIZE) + ',' + Math.floor(spot.z / CHUNK_SIZE);
    return chunks[k] || (chunks[k] = emptyLists());
  };

  // A tall gum at a spot. Only these can be crashed into.
  const gum = (spot, random) => {
    const { x, z } = spot, y = spot.y - 0.4;
    const H = 22 + random() * 18, r = 0.22 + random() * 0.36;
    const c = chunk(spot);
    c.trunks.push({ x, y: y + H / 2, z, sx: r, sy: H, sz: r, ry: random() * 6, c: pickFrom(random, TRUNK_COLOURS) });
    const crowns = 1 + Math.floor(random() * 2);
    for (let n = 0; n < crowns; n++) {
      c.canopy.push({ x: x + (random() - 0.5) * 3, y: y + H * (0.8 + random() * 0.25), z: z + (random() - 0.5) * 3,
        sx: 2.6 + random() * 3.4, sy: 1.2 + random() * 1.3, sz: 2.6 + random() * 3.4, ry: random() * 6, c: pickFrom(random, CANOPY_COLOURS) });
    }
    if (spot.cleared) return;
    const bucket = treeCell(Math.floor(x / TREE_CELL), Math.floor(z / TREE_CELL));
    (treeBuckets[bucket] || (treeBuckets[bucket] = [])).push({ x, z, r });
  };

  // Tall gums both sides of the trail.
  for (let s = -10; s < length + 70; s += 0.55 + random() * 1.0) {
    for (const side of [-1, 1]) {
      if (random() < 0.22) continue;
      const spot = place(s, side * (halfWidth(s) + 1.3 + Math.pow(random(), 1.5) * 58), 1.2);
      if (spot) gum(spot, random);
    }
  }
  // Tree ferns
  for (let n = 0, count = per(2100); n < count; n++) {
    const s = -10 + random() * (length + 80), side = random() < 0.5 ? -1 : 1;
    const spot = place(s, side * (halfWidth(s) + 0.5 + Math.pow(random(), 1.4) * 30), 0.4);
    if (!spot) continue;
    const { x, y, z } = spot;
    const H = 0.8 + random() * 2.4, w = 1.1 + random() * 0.9, c = chunk(spot);
    c.fernTrunks.push({ x, y: y + H / 2, z, sx: 1, sy: H, sz: 1, c: 0x4a3424 });
    c.fernCrowns.push({ x, y: y + H + 0.05, z, sx: w, sy: 0.8 + random() * 0.4, sz: w, ry: random() * 6, rx: (random() - 0.5) * 0.2, c: pickFrom(random, FERN_COLOURS) });
  }
  // Undergrowth
  for (let n = 0, count = per(1500); n < count; n++) {
    const s = -10 + random() * (length + 80), side = random() < 0.5 ? -1 : 1;
    const spot = place(s, side * (halfWidth(s) + 3 + Math.pow(random(), 1.1) * 45), 2.5);
    if (!spot) continue;
    const c = chunk(spot), w = 0.9 + random() * 1.8;
    c.bushes.push({ x: spot.x, y: spot.y + 0.1, z: spot.z, sx: w, sy: 0.45 + random() * 0.7, sz: w * (0.8 + random() * 0.4), ry: random() * 6, c: pickFrom(random, BUSH_COLOURS) });
  }
  // Rocks off the trail only, thicker beside the rocky sections
  for (let n = 0, count = per(800); n < count; n++) {
    const s = -5 + random() * (length + 40);
    const rocky = trail.scenery.rocky.some(r => s > r[0] && s < r[1]);
    if (!rocky && random() < 0.35) continue;
    const spot = place(s, (random() < 0.5 ? -1 : 1) * (halfWidth(s) + 0.7 + random() * (rocky ? 5 : 2.5)), 0.6);
    if (!spot) continue;
    const size = 0.2 + random() * (rocky ? 0.7 : 0.45);
    chunk(spot).rocks.push({ x: spot.x, y: spot.y, z: spot.z, sx: size * (1 + random() * 0.6), sy: size * 0.6, sz: size,
      rx: random() * 3, ry: random() * 6, c: pickFrom(random, ROCK_COLOURS) });
  }
  // Gums round the trailhead clearing, above the top of the trail. They have their
  // own random sequence, so the rest of the forest (and the mountains after it) don't move.
  if (trail.trailhead) {
    const around = makeRandom(trail.seed + 1);
    for (let s = -100; s < -10; s += 0.55 + around() * 1.0) {
      for (const side of [-1, 1]) {
        // the trail's line carries on uphill of the clearing only on the map, so plant on it too
        const off = side * Math.pow(around(), 1.2) * 70, p = trail.pointAt(s, off);
        if (world) gum(place(s, off, -Infinity), around); // (on the mountain, place() decides what's cleared)
        else gum({ x: p.x, z: p.z, s: trail.locate(p.x, p.z).s, y: trail.groundAt(p.x, p.z), cleared: trail.trailhead.keepClear(p.x, p.z) }, around);
      }
    }
  }
  // Ground ferns and fallen mossy logs. Scenery only (you ride through ferns; logs lie
  // clear of the trail). Their own random sequence, so nothing else moves.
  const extra = makeRandom(trail.seed + 3);
  for (let n = 0, count = per(2600); n < count; n++) {
    const s = -10 + extra() * (length + 80), side = extra() < 0.5 ? -1 : 1;
    const spot = place(s, side * (halfWidth(s) + 0.6 + Math.pow(extra(), 1.3) * 28), 0.5);
    const w = 0.35 + extra() * 0.5, ry = extra() * 6, c = pickFrom(extra, GROUND_FERN_COLOURS);
    if (spot) chunk(spot).groundFerns.push({ x: spot.x, y: spot.y - 0.05, z: spot.z, sx: w, sy: w * 0.8, sz: w, ry, c });
  }
  for (let n = 0, count = per(260); n < count; n++) {
    const s = -10 + extra() * (length + 80), side = extra() < 0.5 ? -1 : 1;
    const off = side * (halfWidth(s) + 3 + extra() * 35), r = 0.18 + extra() * 0.25, len = 3 + extra() * 7, yaw = extra() * Math.PI;
    const c = pickFrom(extra, LOG_COLOURS);
    const mid = place(s, off, 2);
    if (!mid) continue;
    // both ends must be clear of the trail too, and the log lies along the ground
    const ex = Math.sin(yaw) * len / 2, ez = Math.cos(yaw) * len / 2;
    const ends = [[mid.x - ex, mid.z - ez], [mid.x + ex, mid.z + ez]];
    if (ends.some(([x, z]) => { const at = trail.locate(x, z); return Math.abs(at.off) < halfWidth(at.s) + 2 || (world ? world.keepClear(x, z) || world.near(x, z).some(n => n.past < 2) : trail.trailhead && trail.trailhead.keepClear(x, z)); })) continue;
    if (mid.cleared) continue;
    const [a, b] = ends.map(([x, z]) => new THREE.Vector3(x, trail.groundAt(x, z) + r * 0.6, z));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const centre = a.clone().add(b).multiplyScalar(0.5);
    chunk(mid).logs.push({ x: centre.x, y: centre.y, z: centre.z, sx: r, sy: a.distanceTo(b), sz: r, q, c });
  }
  return { chunks, treeBuckets };
}

/* ---------- Shapes ---------- */

// A tree fern's crown: a rosette of long fronds that arch up and droop at the tips, about
// 1 m across and 0.4 m high (instances scale it). One shape, many fronds; kept to a few
// triangles each (14 fronds x 4 segments = 112), as there are thousands of ferns.
function frondCrown(count = 14, SEGMENTS = 4) {
  const positions = [], index = [];
  for (let n = 0; n < count; n++) {
    const angle = n / count * Math.PI * 2 + (n % 2) * 0.2, lift = n % 2 ? 0.75 : 1; // two rings of fronds
    const ca = Math.cos(angle), sa = Math.sin(angle), base = positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS, r = t, y = lift * (0.9 * t - 0.95 * t * t) + 0.1; // arch up, then droop
      const w = 0.13 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.01;    // widest in the middle
      positions.push(ca * r - sa * w, y, sa * r + ca * w, ca * r + sa * w, y, sa * r - ca * w);
      if (i) { const k = base + (i - 1) * 2; index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Pale gum bark: long vertical streaks of cream, grey and tan, with darker strips of
// peeling bark low down. Tinted per tree by the instance colour.
function barkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const g = canvas.getContext('2d'), random = makeRandom(11);
  g.fillStyle = '#efebe2'; g.fillRect(0, 0, 64, 256);
  for (let n = 0; n < 70; n++) {
    const x = random() * 64, w = 1 + random() * 4, y = random() * 256, h = 40 + random() * 200;
    g.fillStyle = pickFrom(random, ['#d8d0c0', '#c9c2b4', '#e6dccb', '#b9b2a6', '#f7f4ee']);
    g.fillRect(x, y, w, h);
  }
  for (let n = 0; n < 10; n++) { // ribbons of shed bark near the base
    g.fillStyle = pickFrom(random, ['#8a7358', '#9b8466', '#76634c']);
    g.fillRect(random() * 64, 180 + random() * 60, 2 + random() * 5, 20 + random() * 50);
  }
  const texture = paintedTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

// One InstancedMesh per kind of plant per chunk: thousands of plants in a few draw calls.
function instanced(scene, geometry, material, list, castShadow) {
  if (!list.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const dummy = new THREE.Object3D(), colour = new THREE.Color();
  list.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    if (it.q) dummy.quaternion.copy(it.q); else dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
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

// plans: one forest plan, or a list of them (one per trail on the mountain).
export function buildForest(scene, plans) {
  // every plan's plants, square by square
  const plan = { chunks: {} };
  for (const p of [].concat(plans)) {
    for (const [k, lists] of Object.entries(p.chunks)) {
      const into = plan.chunks[k] || (plan.chunks[k] = {});
      for (const [kind, list] of Object.entries(lists)) (into[kind] || (into[kind] = [])).push(...list);
    }
  }
  const white = () => new THREE.MeshLambertMaterial({ color: 0xffffff }); // instance colours tint it
  const shapes = {
    trunks: [new THREE.CylinderGeometry(0.6, 1, 1, 9), new THREE.MeshLambertMaterial({ color: 0xffffff, map: barkTexture() }), true],
    canopy: [new THREE.IcosahedronGeometry(1, 0), white(), true],
    fernTrunks: [new THREE.CylinderGeometry(0.12, 0.17, 1, 6), white(), false],
    fernCrowns: [frondCrown(), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), true],
    groundFerns: [frondCrown(7, 3), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), false],
    logs: [new THREE.CylinderGeometry(1, 1, 1, 8), white(), true],
    bushes: [new THREE.IcosahedronGeometry(1, 0), white(), false],
    rocks: [new THREE.DodecahedronGeometry(1, 0), white(), false],
  };
  const chunks = Object.keys(plan.chunks).map(k => ({
    box: boxAround(plan.chunks[k].trunks.concat(plan.chunks[k].fernTrunks, plan.chunks[k].bushes)),
    meshes: Object.entries(shapes)
      .map(([kind, [geometry, material, cast]]) => instanced(scene, geometry, material, plan.chunks[k][kind], cast))
      .filter(Boolean),
  }));

  // Draw only the forest near the rider at (x, z), heading h: squares in a band from 60 m behind
  // to 170 m ahead and 60 m either side (the mist hides most of what's further), as the forest
  // was drawn along a single trail.
  const halfSquare = CHUNK_SIZE * Math.SQRT1_2;
  function showNear(x, z, h) {
    const fx = Math.sin(h), fz = -Math.cos(h);
    for (const c of chunks) {
      const cx = (c.box.minX + c.box.maxX) / 2 - x, cz = (c.box.minZ + c.box.maxZ) / 2 - z;
      const ahead = cx * fx + cz * fz, side = Math.abs(cx * -fz + cz * fx);
      const visible = ahead > -60 - halfSquare && ahead < 170 + halfSquare && side < 60 + halfSquare;
      for (const m of c.meshes) m.visible = visible;
    }
  }
  return { showNear };
}

// The smallest box (in x and z) round a list of plants.
function boxAround(list) {
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const it of list) {
    box.minX = Math.min(box.minX, it.x); box.maxX = Math.max(box.maxX, it.x);
    box.minZ = Math.min(box.minZ, it.z); box.maxZ = Math.max(box.maxZ, it.z);
  }
  return box;
}
