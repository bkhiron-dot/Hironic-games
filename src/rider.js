// The rider, built from simple shapes, in downhill kit: full-face helmet and goggles,
// long-sleeve jersey, pads, baggy pants and flat-pedal shoes. Attack position: elbows
// out, chest low. The upper body moves down when crouching or when the suspension
// compresses; the legs reach the pedals with two-bone IK (hip and foot are known, the
// knee is solved so thigh and shin keep their length).
import * as THREE from './three.js';
import { rod, ball, unitRod, aimRod, pedalPosition } from './bike.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const THIGH = 0.47, SHIN = 0.47;
const HIP = V(0, 1.06, 0.24), SHOULDER = V(0, 1.42, -0.12), HEAD = V(0, 1.58, -0.24);

// Full-face helmet with a peak, chin bar, goggles and strap, centred on the head.
function helmet(kit, parent) {
  const head = new THREE.Group();
  head.position.copy(HEAD);
  head.rotation.x = 0.25; // looking down the trail from a low chest
  parent.add(head);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14), kit.helmet);
  shell.scale.set(1, 0.98, 1.12); shell.castShadow = true; head.add(shell);
  // orange stripe over the top, front to back
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.157, 18, 14, Math.PI / 2 - 0.18, 0.36), kit.stripe);
  stripe.scale.copy(shell.scale); head.add(stripe);
  // chin bar: a rounded jaw in front of the face, with a dark vent
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), kit.helmet);
  chin.scale.set(0.95, 0.6, 0.85); chin.position.set(0, -0.085, -0.07); chin.castShadow = true; head.add(chin);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), kit.black);
  vent.position.set(0, -0.09, -0.17); head.add(vent);
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.13), kit.helmet);
  peak.position.set(0, 0.1, -0.17); peak.rotation.x = -0.2; head.add(peak);
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.05), kit.lens);
  goggles.position.set(0, 0.01, -0.165); head.add(goggles);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.014, 6, 24), kit.strap);
  strap.rotation.x = Math.PI / 2; strap.scale.set(1, 1.1, 1); strap.position.y = 0.01; head.add(strap);
  return head;
}

export function createRider(chassis, kit) {
  const rider = new THREE.Group();
  chassis.add(rider);
  const upper = new THREE.Group();
  rider.add(upper);

  const legs = [-1, 1].map(side => {
    const thigh = unitRod(0.09, kit.pants, rider, 0.075), shin = unitRod(0.068, kit.pants, rider, 0.058);
    const knee = ball(V(0, 0, 0), 0.085, kit.pads, rider);
    knee.scale.set(0.95, 1.25, 1.05); // knee pads are longer than they are wide
    const shoe = new THREE.Group();
    const upperShoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), kit.shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.02, 0.25), kit.sole);
    sole.position.y = -0.04; upperShoe.castShadow = true;
    shoe.add(upperShoe, sole);
    rider.add(shoe);
    return { side, thigh, shin, knee, shoe };
  });
  // hips and shorts, so the legs join the body
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), kit.pants);
  hips.scale.set(1.05, 0.7, 0.9); hips.position.copy(HIP).add(V(0, 0.01, -0.02)); hips.castShadow = true; upper.add(hips);

  // torso: broader at the shoulders, with dark side panels and a number on the back
  rod(HIP.clone().add(V(0, 0.04, -0.02)), SHOULDER, 0.135, kit.jersey, upper, 0.17);
  for (const x of [-1, 1]) rod(HIP.clone().add(V(x * 0.1, 0.06, -0.04)), SHOULDER.clone().add(V(x * 0.12, -0.05, 0)), 0.045, kit.panel, upper, 0.05);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.06), kit.pack);
  pack.position.set(0, 1.3, 0.1); pack.rotation.x = -0.95; pack.castShadow = true; upper.add(pack);
  ball(V(0, 1.47, -0.16), 0.07, kit.panel, upper); // neck brace collar

  // arms: elbows out in attack position, hands on the grips
  for (const sx of [-1, 1]) {
    const shoulder = V(sx * 0.19, 1.42, -0.1), elbow = V(sx * 0.42, 1.22, -0.22), hand = V(sx * 0.36, 1.06, -0.47);
    ball(shoulder, 0.075, kit.jersey, upper);
    rod(shoulder, elbow, 0.06, kit.jersey, upper, 0.052);
    rod(elbow, hand, 0.05, kit.jersey, upper, 0.042);
    rod(elbow.clone().lerp(hand, 0.55), elbow.clone().lerp(hand, 0.62), 0.055, kit.panel, upper); // cuff stripe
    ball(elbow, 0.065, kit.pads, upper);
    const glove = ball(hand, 0.05, kit.glove, upper);
    glove.scale.set(1, 0.9, 1.3);
  }
  helmet(kit, upper);

  return { rider, upper, legs };
}

const _foot = new THREE.Vector3(), _hip = new THREE.Vector3(), _knee = new THREE.Vector3();
const _axis = new THREE.Vector3(), _pole = new THREE.Vector3();

// Puts each foot on its pedal and bends the knee to fit. comp = how far the hips have
// dropped (crouching or suspension).
export function updateLegs(legs, crankAngle, comp) {
  for (const L of legs) {
    pedalPosition(L.side, crankAngle, _foot);
    _foot.y += 0.05;
    L.shoe.position.copy(_foot);
    L.shoe.position.z += 0.01;
    _hip.set(L.side * 0.12, HIP.y - comp, HIP.z);
    _axis.subVectors(_foot, _hip);
    const d = Math.min(_axis.length(), THIGH + SHIN - 0.002); // can't reach further than a straight leg
    _axis.normalize();
    // distance along hip->foot to the point under the knee, and how far the knee sticks out
    const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
    const out = Math.sqrt(Math.max(0, THIGH * THIGH - along * along));
    // knees point forward and slightly outward
    _pole.set(L.side * 0.35, 0.1, -1).normalize();
    _pole.addScaledVector(_axis, -_pole.dot(_axis)).normalize();
    _knee.copy(_hip).addScaledVector(_axis, along).addScaledVector(_pole, out);
    aimRod(L.thigh, _hip, _knee);
    aimRod(L.shin, _knee, _foot);
    L.knee.position.copy(_knee).addScaledVector(_pole, 0.03);
    L.knee.quaternion.copy(L.shin.quaternion);
  }
}
