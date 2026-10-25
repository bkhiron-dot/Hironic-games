// The terrain: the trail and the forest floor around it.
import * as THREE from './three.js';
import { paintedTexture } from './texture.js';
import { makeRandom, makeGroundNoise } from './util.js';
import { NEAR_REACH } from './trail.js';

/* ---------- Terrain ----------
   Two meshes, both with heights from the trail's own ground functions (the same ones the
   physics uses), so what you see is always what you ride on:
   - a detailed strip that follows the trail: fine columns across the trail, then wider
     columns out to NEAR_REACH past the edge, where the ground has become plain hillside;
   - a coarse hillside grid beyond it, tucked just under the strip where they overlap. */

const ACROSS_TRAIL = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]; // fractions of the half width
const BEYOND_EDGE = [0.6, 1.4, 2.6, 4.2, 6.5, 10, 14, 19, NEAR_REACH];      // metres past the trail edge
const STRIP_FROM = -20, STRIP_PAST_END = 80; // the strip runs from 20 m above the start to 80 m past the finish...
const STRIP_FROM_TRAILHEAD = -70;             // ...or from behind the trailhead clearing, if there is one
const stripFrom = trail => trail.trailhead ? STRIP_FROM_TRAILHEAD : STRIP_FROM;
const GRID_CELL = 4;      // hillside grid spacing (m)
const GRID_MARGIN = 160;  // hillside reaches this far sideways beyond the trail's widest swing (m)
const TUCK = 0.4;         // hillside sits this far under the strip where they overlap (m)

const COLOURS = {
  trail: 0xc0905e, trail2: 0xa87a4c, edge: 0x96693f, litter: 0x9a7647,
  humus: 0x7a5434, loam: 0x8c6038, moss: 0x5f7a3a, clay: 0xa8653a,
};
const palette = () => Object.fromEntries(Object.entries(COLOURS).map(([k, hex]) => [k, new THREE.Color(hex)]));

// Forest floor colour at world (x, z), with patches of moss. Both meshes use this, so their
// colours match exactly where they meet.
function floorColour(out, c, noise, x, z) {
  const n = noise(x, z), d = -z;
  out.copy(c.humus).lerp(n < 0.5 ? c.loam : c.litter, n);
  if (Math.sin(d * 0.05 + x * 0.21) + Math.sin(d * 0.13 - x * 0.07) > 1.6) out.lerp(c.moss, 0.35);
  return out;
}

// The trailhead clearing (if this trail has one) is packed dirt: blend toward it by how
// much of the pad is at (x, z). n is a 0..1 speckle.
function padColour(out, c, trail, n, x, z) {
  const pad = trail.trailhead ? trail.trailhead.padAmount(x, z) : 0;
  if (pad > 0) out.lerp(PAD_TMP.copy(c.edge).lerp(c.trail2, 0.3 + n * 0.4), pad);
  return out;
}
const PAD_TMP = new THREE.Color();

// The detailed strip: positions, colours, uvs and triangle indices.
// Uses `random` once per vertex for colour noise.
export function terrainData(trail, random) {
  const { halfWidth, ground, jumpZone, kickerAt, bermAmount, curvature } = trail;
  const S0 = stripFrom(trail), S1 = trail.length + STRIP_PAST_END;
  // rows above the usual start (round the trailhead) take their colour noise from their own
  // random sequence, so the forest after the terrain doesn't move
  const above = makeRandom(trail.seed + 2);
  const cols = ACROSS_TRAIL.length + BEYOND_EDGE.length * 2, rows = S1 - S0 + 1;
  const positions = new Float32Array(rows * cols * 3), colours = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const c = palette(), tmp = new THREE.Color(), noise = makeGroundNoise(trail.seed);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const s = S0 + r, w = halfWidth(s);
    const offsets = [...BEYOND_EDGE.slice().reverse().map(d => -(w + d)), ...ACROSS_TRAIL.map(t => t * w), ...BEYOND_EDGE.map(d => w + d)];
    const zone = jumpZone(s), onKicker = !!kickerAt(s);
    const ridden = !trail.trailhead || s >= 0; // above a trailhead the trail's line is just forest
    for (let col = 0; col < cols; col++, i++) {
      const off = offsets[col], e = Math.abs(off) - w, p = trail.pointAt(s, off);
      positions[i * 3] = p.x; positions[i * 3 + 1] = ground(s, off); positions[i * 3 + 2] = p.z;
      uvs[i * 2] = p.x / 2.5; uvs[i * 2 + 1] = -p.z / 2.5;
      const n = s < STRIP_FROM ? above() : random();
      if (!ridden) {
        floorColour(tmp, c, noise, p.x, p.z);
      } else if (e < -0.01) {
        // on the trail: packed dirt, redder clay on kickers, landings and berm walls
        tmp.copy(c.trail).lerp(c.trail2, n * 0.35 + 0.3 * (Math.abs(off) / w));
        // the worn riding line down the middle: darker, damper, packed loam
        tmp.lerp(c.loam, 0.3 * Math.max(0, 1 - Math.abs(off) / (0.45 * w)));
        if (onKicker || zone === 'knuckle' || zone === 'sweet' || zone === 'bottom') tmp.lerp(c.clay, 0.55);
        if (zone === 'sweet') tmp.lerp(c.trail, 0.25);
        const berm = bermAmount(s);
        if (berm > 0.3 && off * -Math.sign(curvature(s)) > 0.35 * w) tmp.lerp(c.clay, 0.35 * Math.min(1, berm / 1.2));
      } else if (e < 1) {
        tmp.copy(c.edge).lerp(c.litter, n * 0.5);
      } else {
        floorColour(tmp, c, noise, p.x, p.z);
      }
      padColour(tmp, c, trail, n, p.x, p.z);
      colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
    }
  }
  return { positions, colours, uvs, indices: gridIndices(rows, cols) };
}

// Triangles for a rows x cols grid of vertices (rows going downhill, columns toward +x).
// Winding a, b, d / b, e, d gives upward normals; the other way round the ground is
// back-face culled and invisible (CLAUDE.md "Known gotchas"). keep(a, b, d, e) can drop cells.
function gridIndices(rows, cols, keep = () => true) {
  const indices = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = r * cols + col, b = a + 1, d = a + cols, e = d + 1;
      if (keep(a, b, d, e)) indices.push(a, b, d, b, e, d);
    }
  }
  return indices;
}

// The hillside grid beyond the strip. Vertices under the strip are tucked down by TUCK, and
// cells entirely under it are left out.
export function hillsideData(trail) {
  const { halfWidth } = trail;
  let minX = Infinity, maxX = -Infinity;
  for (let s = stripFrom(trail); s <= trail.length + STRIP_PAST_END; s += 5) {
    const p = trail.pointAt(s);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
  }
  const x0 = minX - GRID_MARGIN, z0 = trail.pointAt(stripFrom(trail)).z + 120;
  const zEnd = trail.pointAt(trail.length + STRIP_PAST_END).z - 60;
  const cols = Math.ceil((maxX + GRID_MARGIN - x0) / GRID_CELL) + 1, rows = Math.ceil((z0 - zEnd) / GRID_CELL) + 1;
  const positions = new Float32Array(rows * cols * 3), colours = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2), deepUnder = new Uint8Array(rows * cols);
  const c = palette(), tmp = new THREE.Color(), noise = makeGroundNoise(trail.seed);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++, i++) {
      const x = x0 + col * GRID_CELL, z = z0 - r * GRID_CELL;
      const at = trail.locate(x, z);
      const insideStrip = at.s > stripFrom(trail) && at.s < trail.length + STRIP_PAST_END;
      const past = Math.abs(at.off) - halfWidth(at.s); // metres past the trail edge
      const under = insideStrip && past < NEAR_REACH - 0.5;
      deepUnder[i] = insideStrip && past < NEAR_REACH - GRID_CELL * 1.5 ? 1 : 0;
      positions[i * 3] = x; positions[i * 3 + 1] = trail.groundAt(x, z) - (under ? TUCK : 0); positions[i * 3 + 2] = z;
      uvs[i * 2] = x / 2.5; uvs[i * 2 + 1] = -z / 2.5;
      floorColour(tmp, c, noise, x, z);
      padColour(tmp, c, trail, noise(x * 3.1, z * 3.1), x, z);
      colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
    }
  }
  const indices = gridIndices(rows, cols, (a, b, d, e) => !(deepUnder[a] && deepUnder[b] && deepUnder[d] && deepUnder[e]));
  return { positions, colours, uvs, indices };
}

// Grainy dirt texture: soil speckle, small stones and leaf flecks, multiplied over the colours.
function dirtTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, 256, 256);
  const random = makeRandom(7);
  for (let n = 0; n < 9000; n++) {
    const v = 150 + Math.floor(random() * 105);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
  }
  for (let n = 0; n < 160; n++) {
    const x = random() * 256, y = random() * 256, r = 1 + random() * 3.5, v = 170 + Math.floor(random() * 80);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, random() * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(60,60,60,.35)';
    g.beginPath(); g.ellipse(x + 0.8, y + r * 0.6, r, r * 0.35, 0, 0, Math.PI * 2); g.fill();
  }
  for (let n = 0; n < 70; n++) {
    g.fillStyle = 'rgba(90,90,90,.45)';
    g.save(); g.translate(random() * 256, random() * 256); g.rotate(random() * 6); g.fillRect(-4, -1, 8, 2); g.restore();
  }
  const texture = paintedTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function addMesh(scene, data, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colours, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
}

export function buildTerrain(scene, renderer, trail, random) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: dirtTexture(renderer) });
  addMesh(scene, terrainData(trail, random), material);
  addMesh(scene, hillsideData(trail), material);
}
