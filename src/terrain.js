// The ground: one height function used by both physics and the terrain mesh,
// so what you see is always what you ride on.
import * as THREE from './three.js';
import { clamp, makeRandom } from './util.js';
import { TRACK_LENGTH, cx, halfWidth, jumpHeight, bermHeight, bermAmount, curvature, jumpZone, kickerAt } from './trail.js';

// Ground height at distance s down the track and sideways offset off.
export function ground(s, off) {
  // base grade (-0.2), a slow 7 m undulation, a steeper chute at 500-580 m, and the jumps
  let h = -0.2 * s - 7 * Math.sin(s / 110) - 0.12 * clamp(s - 500, 0, 80) + jumpHeight(s);
  const a = Math.abs(off), w = halfWidth(s);
  h += bermHeight(s, off, w);
  if (a > w) {
    // off the trail the hillside rises away, with gentle lumps
    const e = a - w;
    h += Math.pow(e, 1.25) * 0.18 + 0.25 * Math.sin(s * 0.31 + off * 0.7) * Math.min(1, e / 2);
  } else {
    h -= 0.1 * (1 - (a / w) * (a / w)); // the trail is slightly worn into a shallow dish
  }
  return h;
}

// Same as ground(), from world x and z.
export const groundAt = (x, z) => {
  const s = -z;
  return ground(s, x - cx(s));
};

/* ---------- Terrain ribbon mesh ----------
   A strip of triangles following the trail: fine columns across the trail, then
   wider and wider columns out into the forest. */
const ACROSS_TRAIL = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]; // fractions of the half width
const BEYOND_EDGE = [0.6, 1.4, 2.6, 4.2, 6.5, 10, 15, 22, 32, 46, 66];       // metres past the trail edge

const COLOURS = {
  trail: 0xc0905e, trail2: 0xa87a4c, edge: 0x96693f, litter: 0x9a7647,
  humus: 0x7a5434, loam: 0x8c6038, moss: 0x5f7a3a, clay: 0xa8653a,
};

// Positions, colours, uvs and triangle indices. Uses `random` once per vertex for colour
// noise, in row order; the forest is grown with the same random sequence afterwards,
// so this order must not change or every tree moves.
export function terrainData(random) {
  const S0 = -20, S1 = TRACK_LENGTH + 80;
  const cols = ACROSS_TRAIL.length + BEYOND_EDGE.length * 2, rows = S1 - S0 + 1;
  const positions = new Float32Array(rows * cols * 3), colours = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const c = {};
  for (const [name, hex] of Object.entries(COLOURS)) c[name] = new THREE.Color(hex);
  const tmp = new THREE.Color();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const s = S0 + r, c0 = cx(s), w = halfWidth(s);
    const offsets = [...BEYOND_EDGE.slice().reverse().map(d => -(w + d)), ...ACROSS_TRAIL.map(t => t * w), ...BEYOND_EDGE.map(d => w + d)];
    for (let col = 0; col < cols; col++, i++) {
      const off = offsets[col], e = Math.abs(off) - w;
      positions[i * 3] = c0 + off; positions[i * 3 + 1] = ground(s, off); positions[i * 3 + 2] = -s;
      uvs[i * 2] = off / 2.5; uvs[i * 2 + 1] = s / 2.5;
      const n = random();
      const zone = jumpZone(s), onKicker = !!kickerAt(s);
      if (e < -0.01) {
        // on the trail: packed dirt, redder clay on kickers, landings and berm walls
        tmp.copy(c.trail).lerp(c.trail2, n * 0.35 + 0.3 * (Math.abs(off) / w));
        if (onKicker || zone === 'knuckle' || zone === 'sweet' || zone === 'bottom') tmp.lerp(c.clay, 0.55);
        if (zone === 'sweet') tmp.lerp(c.trail, 0.25);
        const berm = bermAmount(s);
        if (berm > 0.3 && off * -Math.sign(curvature(s)) > 0.35 * w) tmp.lerp(c.clay, 0.35 * Math.min(1, berm / 1.2));
      } else if (e < 1) {
        tmp.copy(c.edge).lerp(c.litter, n * 0.5);
      } else {
        // forest floor, with patches of moss
        tmp.copy(c.humus).lerp(n < 0.5 ? c.loam : c.litter, n);
        if (Math.sin(s * 0.05 + off * 0.21) + Math.sin(s * 0.13 - off * 0.07) > 1.6) tmp.lerp(c.moss, 0.35);
      }
      colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
    }
  }
  // Winding a, b, d / b, e, d gives upward normals; the other way round the ground is
  // back-face culled and invisible (CLAUDE.md "Known gotchas").
  const indices = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = r * cols + col, b = a + 1, d = a + cols, e = d + 1;
      indices.push(a, b, d, b, e, d);
    }
  }
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
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function buildTerrain(scene, renderer, random) {
  const data = terrainData(random);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colours, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, map: dirtTexture(renderer) }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
}
