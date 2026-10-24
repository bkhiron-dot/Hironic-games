// Tyre tracks: each wheel leaves a dark line in the dirt. Drifting smears the back wheel's
// line wider and darker. Visual only. The newest 1500 pieces per wheel are kept (about
// 450 m); older ones are overwritten, so your last runs stay on the trail for a while.
import * as THREE from './three.js';

const PIECES = 1500;      // pieces of track per wheel
const PIECE_LENGTH = 0.3; // a new piece every 0.3 m
const TYRE_WIDTH = 0.07;  // half the width of a rolling tyre's mark (m)
const LIFT = 0.025;       // drawn this far above the ground so it doesn't flicker into it
const TRACK = [0.24, 0.16, 0.1]; // dark, damp loam

export function createTracks(scene, trail) {
  const count = PIECES * 2; // front and back wheel
  const position = new Float32Array(count * 4 * 3), colour = new Float32Array(count * 4 * 4);
  const index = [];
  // wound so the pieces face up (the other way round they're culled and invisible)
  for (let i = 0; i < count; i++) { const a = i * 4; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colour, 4));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  // Each wheel remembers where its line last got to (null = start a new line).
  const wheels = [{ offset: -0.6, slot: 0, last: null }, { offset: 0.55, slot: 0, last: null, back: true }];

  // A piece of track from the wheel's last point to (x, z): half width w, darkness k (0..1).
  function addPiece(wheel, wi, x, z, w, k) {
    const a = wheel.last, dx = x - a.x, dz = z - a.z, len = Math.hypot(dx, dz) || 1;
    const ux = -dz / len, uz = dx / len; // square to the piece
    const i = wi * PIECES + wheel.slot;
    wheel.slot = (wheel.slot + 1) % PIECES;
    const corners = [[a.x - ux * a.w, a.z - uz * a.w], [a.x + ux * a.w, a.z + uz * a.w], [x - ux * w, z - uz * w], [x + ux * w, z + uz * w]];
    corners.forEach(([cx, cz], c) => {
      const v = i * 4 + c;
      position.set([cx, trail.groundAt(cx, cz) + LIFT, cz], v * 3);
      colour.set([TRACK[0], TRACK[1], TRACK[2], (c < 2 ? a.k : k)], v * 4);
    });
    wheel.last = { x, z, w, k };
    // upload just this piece, not the whole buffer
    geometry.attributes.position.addUpdateRange(i * 12, 12);
    geometry.attributes.color.addUpdateRange(i * 16, 16);
    geometry.attributes.position.needsUpdate = geometry.attributes.color.needsUpdate = true;
  }

  // Every frame: extend each wheel's line while it's on the ground.
  function update(b, riding) {
    const yaw = b.h + b.drift, fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const drift = Math.min(1, Math.max(b.slide, Math.abs(b.drift) / 0.55));
    wheels.forEach((wheel, wi) => {
      const x = b.x - fx * wheel.offset, z = b.z - fz * wheel.offset;
      if (!riding || b.air) { wheel.last = null; return; } // lifted: the next line starts fresh
      const w = TYRE_WIDTH + (wheel.back ? drift * 0.2 : drift * 0.03);
      const k = 0.35 + 0.4 * drift;
      if (!wheel.last) { wheel.last = { x, z, w, k }; return; }
      const gap = Math.hypot(x - wheel.last.x, z - wheel.last.z);
      if (gap > 3) wheel.last = { x, z, w, k };       // moved by a respawn: don't join the lines
      else if (gap >= PIECE_LENGTH) addPiece(wheel, wi, x, z, w, k);
    });
  }
  return { update };
}
