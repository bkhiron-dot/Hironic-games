// The bike, built from simple shapes. The frame, cranks and rider sit on a sprung
// "chassis" group that moves down when the suspension compresses; the wheels don't.
import * as THREE from './three.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// Colours for the bike and rider kit.
export function createKit() {
  const m = c => new THREE.MeshLambertMaterial({ color: c });
  return {
    frame: m(0xc44d2a), black: m(0x151515), grey: m(0x2b2f36), silver: m(0x9a9a9a),
    jersey: m(0xe0672f), pants: m(0x2a2f38), pads: m(0x3e4652), helmet: m(0xf4f4f2),
    visor: m(0x1b2530), pack: m(0x26313d), glove: m(0x111111),
  };
}

/* ---------- Shape helpers, shared with the rider ---------- */

// A cylinder from point a to point b.
export function rod(a, b, radius, material, parent) {
  const d = new THREE.Vector3().subVectors(b, a), length = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function ball(position, radius, material, parent) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
  m.position.copy(position);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// A 1 m cylinder that aimRod() stretches between two points every frame (cranks, legs).
export function unitRod(radius, material, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), material);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const _d = new THREE.Vector3();
export function aimRod(m, a, b) {
  _d.subVectors(b, a);
  const length = _d.length() || 1e-4;
  m.position.copy(a).addScaledVector(_d, 0.5);
  m.scale.set(1, length, 1);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / length));
}

/* ---------- Cranks ---------- */
export const CRANK_LENGTH = 0.17;
export const BOTTOM_BRACKET = V(0, 0.36, 0.05);

// Where the pedal on one side is (side -1 left, +1 right) for a crank angle.
export function pedalPosition(side, crankAngle, out) {
  const angle = crankAngle + (side > 0 ? 0 : Math.PI);
  return out.set(side * 0.19, BOTTOM_BRACKET.y + CRANK_LENGTH * Math.sin(angle), BOTTOM_BRACKET.z - CRANK_LENGTH * Math.cos(angle));
}

const _pedal = new THREE.Vector3(), _crankRoot = new THREE.Vector3();
export function updateCranks(cranks, crankAngle) {
  for (const c of cranks) {
    pedalPosition(c.side, crankAngle, _pedal);
    aimRod(c.arm, _crankRoot.set(c.side * 0.09, BOTTOM_BRACKET.y, BOTTOM_BRACKET.z), _pedal);
    c.pedal.position.copy(_pedal);
  }
}

/* ---------- Bike ---------- */
export function createBike(scene, kit) {
  const bike = new THREE.Group();
  bike.rotation.order = 'YXZ'; // heading first, then pitch, then lean
  scene.add(bike);
  const chassis = new THREE.Group();
  bike.add(chassis);

  for (const z of [-0.6, 0.55]) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.065, 8, 24), kit.black);
    tyre.rotation.y = Math.PI / 2; tyre.position.set(0, 0.38, z); tyre.castShadow = true; bike.add(tyre);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.015, 6, 24), kit.silver);
    rim.rotation.y = Math.PI / 2; rim.position.set(0, 0.38, z); bike.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), kit.silver);
    hub.rotation.z = Math.PI / 2; hub.position.set(0, 0.38, z); bike.add(hub);
  }
  // key frame points: bottom bracket, head tube top, head tube bottom, seat tube top, rear and front axles
  const BB = BOTTOM_BRACKET, HT = V(0, 0.98, -0.42), HB = V(0, 0.8, -0.48), ST = V(0, 0.92, 0.17), RA = V(0, 0.38, 0.55), FA = V(0, 0.38, -0.6);
  rod(BB, HB, 0.04, kit.frame, chassis); rod(ST, HT, 0.032, kit.frame, chassis); rod(BB, ST, 0.035, kit.frame, chassis);
  for (const x of [-0.06, 0.06]) {
    rod(V(x, BB.y, BB.z), V(x, RA.y, RA.z), 0.022, kit.frame, chassis);  // chainstays
    rod(V(x, 0.7, 0.28), V(x, RA.y, RA.z), 0.018, kit.frame, chassis);   // seatstays
    rod(V(x, HB.y, HB.z), V(x, FA.y, FA.z), 0.03, kit.grey, chassis);    // fork legs
  }
  rod(V(0, 0.62, 0.05), V(0, 0.72, 0.26), 0.045, kit.grey, chassis);     // shock
  rod(HT, V(0, 1.04, -0.46), 0.03, kit.black, chassis);                  // stem
  rod(V(-0.4, 1.04, -0.47), V(0.4, 1.04, -0.47), 0.016, kit.black, chassis); // bars
  rod(V(0, 0.92, 0.17), V(0, 0.98, 0.2), 0.02, kit.black, chassis);      // seat post
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.26), kit.black);
  seat.position.set(0, 1.0, 0.18); chassis.add(seat);
  rod(V(-0.08, 0.36, 0.05), V(0.08, 0.36, 0.05), 0.02, kit.grey, chassis); // crank axle
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16), kit.silver);
  ring.rotation.z = Math.PI / 2; ring.position.set(0.07, 0.36, 0.05); chassis.add(ring);

  const cranks = [-1, 1].map(side => {
    const arm = unitRod(0.018, kit.grey, chassis);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.1), kit.black);
    chassis.add(pedal);
    return { side, arm, pedal };
  });
  return { bike, chassis, cranks };
}
