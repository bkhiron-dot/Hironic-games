// The bike, built from simple shapes: a downhill bike with a dual-crown fork, a coil shock,
// knobbly tyres and wheels that turn as you roll. The frame, cranks and rider sit on a sprung
// "chassis" group that moves down when the suspension compresses; the wheels don't.
import * as THREE from './three.js';
import { paintedTexture } from './texture.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
export const WHEEL_RADIUS = 0.4; // to the top of the knobs (m)

// Colours for the bike and rider kit: bold and clean, a dark bike with orange details.
export function createKit() {
  const m = c => new THREE.MeshLambertMaterial({ color: c });
  return {
    frame: m(0x20262e), accent: m(0xe0672f), black: m(0x141414), rubber: m(0x1c1b19), grey: m(0x3a4048),
    silver: m(0xa8acb0), gold: m(0xd9a441), plate: m(0xf2f0ea),
    jersey: m(0xe0672f), panel: m(0x1f2a44), pants: m(0x262b33), pads: m(0x3a414c), skin: m(0xd9a07a),
    helmet: m(0xf4f4f2), stripe: m(0xe0672f), glove: m(0x141414), shoe: m(0x2b2f36), sole: m(0x8a8f96),
    lens: new THREE.MeshPhongMaterial({ color: 0x1a2a3a, specular: 0x9fd4ff, shininess: 90 }),
    strap: m(0xe0672f), pack: m(0x26313d),
  };
}

/* ---------- Shape helpers, shared with the rider ---------- */

// A cylinder from point a to point b (radius r, or rTop at b and r at a).
export function rod(a, b, radius, material, parent, rTop = radius) {
  const d = new THREE.Vector3().subVectors(b, a), length = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, radius, length, 10), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

// A box from point a to point b, `width` across (x) and `depth` thick, like a big frame tube.
export function beam(a, b, width, depth, material, parent) {
  const d = new THREE.Vector3().subVectors(b, a), length = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function ball(position, radius, material, parent) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), material);
  m.position.copy(position);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// A 1 m cylinder that aimRod() stretches between two points every frame (cranks, legs).
export function unitRod(radius, material, parent, rTop = radius) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, radius, 1, 10), material);
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

/* ---------- Wheels ---------- */

// One wheel, centred on its axle, turning about x: knobbly tyre, rim, spokes, hub and brake disc.
function wheel(kit) {
  const group = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.065, 10, 32), kit.rubber);
  tyre.rotation.y = Math.PI / 2; tyre.castShadow = true; group.add(tyre);
  // knobs round the tread, two staggered rows: one merged shape, so it's one draw
  const knobs = [];
  for (let n = 0; n < 40; n++) {
    const a = n / 40 * Math.PI * 2, x = (n % 2 ? 1 : -1) * 0.03;
    const k = new THREE.BoxGeometry(0.035, 0.022, 0.03);
    k.rotateX(a); k.translate(x, Math.cos(a) * 0.392, Math.sin(a) * 0.392);
    knobs.push(k);
  }
  const knobMesh = new THREE.Mesh(mergeGeometries(knobs), kit.rubber);
  knobMesh.castShadow = true; group.add(knobMesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.02, 6, 32), kit.black);
  rim.rotation.y = Math.PI / 2; group.add(rim);
  // spokes: thin rods from the hub flanges to the rim, laced from both sides
  const spokes = [];
  for (let n = 0; n < 24; n++) {
    const a = n / 24 * Math.PI * 2, side = n % 2 ? 0.035 : -0.035;
    const from = V(side, Math.cos(a + 0.3) * 0.03, Math.sin(a + 0.3) * 0.03), to = V(0, Math.cos(a) * 0.275, Math.sin(a) * 0.275);
    const d = to.clone().sub(from), s = new THREE.CylinderGeometry(0.0035, 0.0035, d.length(), 3);
    s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
    s.translate(...from.clone().addScaledVector(d, 0.5).toArray());
    spokes.push(s);
  }
  group.add(new THREE.Mesh(mergeGeometries(spokes), kit.silver));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), kit.grey);
  hub.rotation.z = Math.PI / 2; group.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.006, 20), kit.silver);
  disc.rotation.z = Math.PI / 2; disc.position.x = -0.06; group.add(disc);
  return group;
}

// Turn the wheels by the distance rolled (m).
export function spinWheels(wheels, distance) {
  for (const w of wheels) w.rotation.x -= distance / WHEEL_RADIUS; // forward is -z, so the top rolls forward
}

// A coil spring from a to b (the shock's spring), as a tube following a helix.
function coil(a, b, radius, turns, material, parent) {
  const d = new THREE.Vector3().subVectors(b, a), length = d.length();
  const points = [];
  for (let i = 0; i <= turns * 12; i++) {
    const t = i / (turns * 12), angle = t * turns * Math.PI * 2;
    points.push(V(Math.cos(angle) * radius, t * length - length / 2, Math.sin(angle) * radius));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), turns * 12, 0.012, 5), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  parent.add(m);
}

// The number plate on the bars.
function plateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e0672f'; g.fillRect(0, 0, 128, 22);
  g.fillStyle = '#141414'; g.font = 'bold 84px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3', 64, 76);
  return paintedTexture(canvas);
}

/* ---------- Bike ---------- */
export function createBike(scene, kit) {
  const bike = new THREE.Group();
  bike.rotation.order = 'YXZ'; // heading first, then pitch, then lean
  scene.add(bike);
  const chassis = new THREE.Group();
  bike.add(chassis);

  const wheels = [-0.6, 0.55].map(z => { const w = wheel(kit); w.position.set(0, 0.38, z); bike.add(w); return w; });

  // Key frame points: bottom bracket, head tube top and bottom, seat cluster, shock mounts,
  // rear and front axles.
  const BB = BOTTOM_BRACKET, HT = V(0, 1.0, -0.43), HB = V(0, 0.8, -0.49), SC = V(0, 0.86, 0.1);
  const RA = V(0, 0.38, 0.55), FA = V(0, 0.38, -0.6);
  beam(BB, HB, 0.07, 0.085, kit.frame, chassis);                         // down tube
  beam(V(0, 0.95, -0.42), SC, 0.055, 0.06, kit.frame, chassis);          // top tube
  beam(BB, SC, 0.055, 0.06, kit.frame, chassis);                         // seat tube
  beam(HB, HT, 0.075, 0.075, kit.frame, chassis);                        // head tube
  beam(V(0, 0.58, -0.25), V(0, 0.47, -0.12), 0.075, 0.03, kit.accent, chassis); // stripe on the down tube
  for (const x of [-0.06, 0.06]) {
    beam(V(x, BB.y + 0.02, BB.z + 0.05), V(x, RA.y, RA.z), 0.025, 0.045, kit.frame, chassis); // chainstays
    beam(V(x, 0.74, 0.2), V(x, RA.y + 0.02, RA.z), 0.022, 0.035, kit.frame, chassis);       // seatstays
    beam(V(x, 0.83, 0.02), V(x, 0.74, 0.2), 0.02, 0.07, kit.accent, chassis);               // rocker link
  }
  // coil shock: body, orange spring, and the reservoir
  const shockA = V(0, 0.52, -0.12), shockB = V(0, 0.82, 0.04);
  rod(shockA, shockB, 0.022, kit.silver, chassis);
  coil(shockA.clone().lerp(shockB, 0.2), shockA.clone().lerp(shockB, 0.85), 0.04, 7, kit.accent, chassis);
  rod(V(0.05, 0.62, -0.06), V(0.05, 0.76, 0.0), 0.02, kit.black, chassis);

  // dual-crown fork: black lowers from the axle, gold stanchions up to the top crown
  const forkDir = new THREE.Vector3().subVectors(HT, FA).normalize();
  const lowerTop = FA.clone().addScaledVector(forkDir, 0.36), topCrown = HT.clone().addScaledVector(forkDir, 0.02);
  const bottomCrown = HB.clone().addScaledVector(forkDir, -0.04);
  for (const x of [-0.075, 0.075]) {
    rod(V(x, FA.y, FA.z), V(x, lowerTop.y, lowerTop.z), 0.03, kit.black, chassis);
    rod(V(x, lowerTop.y, lowerTop.z), V(x, topCrown.y, topCrown.z), 0.02, kit.gold, chassis);
  }
  for (const c of [bottomCrown, topCrown]) {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.06), kit.black);
    crown.position.copy(c); chassis.add(crown);
  }
  // cockpit: short stem, wide rise bars, grips, brake levers and the number plate
  rod(topCrown, V(0, 1.04, -0.46), 0.025, kit.black, chassis);
  rod(V(-0.4, 1.06, -0.47), V(-0.2, 1.04, -0.46), 0.014, kit.black, chassis);
  rod(V(-0.2, 1.04, -0.46), V(0.2, 1.04, -0.46), 0.016, kit.black, chassis);
  rod(V(0.2, 1.04, -0.46), V(0.4, 1.06, -0.47), 0.014, kit.black, chassis);
  for (const x of [-1, 1]) {
    rod(V(x * 0.32, 1.055, -0.47), V(x * 0.4, 1.06, -0.47), 0.02, kit.rubber, chassis);
    rod(V(x * 0.27, 1.06, -0.47), V(x * 0.33, 1.05, -0.56), 0.006, kit.silver, chassis);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.18), new THREE.MeshLambertMaterial({ map: plateTexture(), side: THREE.DoubleSide }));
  plate.position.set(0, 0.96, -0.56); plate.rotation.y = Math.PI; plate.rotation.x = 0.25; chassis.add(plate);

  // saddle slammed low for downhill
  rod(SC, V(0, 0.93, 0.15), 0.017, kit.black, chassis);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.27), kit.black);
  seat.position.set(0, 0.95, 0.16); seat.rotation.x = 0.08; chassis.add(seat);

  // drivetrain: chainring with a guide, chain to the rear cog
  rod(V(-0.08, BB.y, BB.z), V(0.08, BB.y, BB.z), 0.02, kit.grey, chassis);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 18), kit.grey);
  ring.rotation.z = Math.PI / 2; ring.position.set(0.07, BB.y, BB.z); chassis.add(ring);
  const guide = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 18, 1, false, Math.PI * 0.6, Math.PI * 0.8), kit.black);
  guide.rotation.z = Math.PI / 2; guide.position.set(0.085, BB.y, BB.z); chassis.add(guide);
  rod(V(0.07, BB.y + 0.085, BB.z), V(0.07, RA.y + 0.05, RA.z), 0.006, kit.grey, chassis);
  rod(V(0.07, BB.y - 0.085, BB.z), V(0.07, RA.y - 0.05, RA.z), 0.006, kit.grey, chassis);

  const cranks = [-1, 1].map(side => {
    const arm = unitRod(0.02, kit.black, chassis);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.11), kit.grey);
    pedal.castShadow = true;
    chassis.add(pedal);
    return { side, arm, pedal };
  });
  return { bike, chassis, cranks, wheels };
}
