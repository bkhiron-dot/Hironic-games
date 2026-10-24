// The rider, built from simple shapes. The upper body moves down when crouching or
// when the suspension compresses; the legs reach the pedals with two-bone IK
// (hip and foot are known, the knee is solved so thigh and shin keep their length).
import * as THREE from './three.js';
import { rod, ball, unitRod, aimRod, pedalPosition } from './bike.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const THIGH = 0.47, SHIN = 0.47;

export function createRider(chassis, kit) {
  const rider = new THREE.Group();
  chassis.add(rider);
  const upper = new THREE.Group();
  rider.add(upper);

  const legs = [-1, 1].map(side => {
    const thigh = unitRod(0.08, kit.pants, rider), shin = unitRod(0.065, kit.pants, rider);
    const knee = ball(V(0, 0, 0), 0.085, kit.pads, rider);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.24), kit.black);
    shoe.castShadow = true;
    rider.add(shoe);
    return { side, thigh, shin, knee, shoe };
  });
  for (const sx of [-1, 1]) {
    const shoulder = V(sx * 0.2, 1.44, -0.1), elbow = V(sx * 0.4, 1.24, -0.22), hand = V(sx * 0.36, 1.05, -0.47);
    rod(shoulder, elbow, 0.055, kit.jersey, upper); rod(elbow, hand, 0.048, kit.jersey, upper);
    ball(hand, 0.055, kit.glove, upper); ball(elbow, 0.06, kit.jersey, upper);
  }
  rod(V(0, 1.08, 0.24), V(0, 1.44, -0.1), 0.17, kit.jersey, upper); // torso
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.1), kit.pack);
  pack.position.set(0, 1.3, 0.16); pack.rotation.x = -0.75; pack.castShadow = true; upper.add(pack);
  ball(V(0, 1.56, -0.22), 0.15, kit.helmet, upper);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.12), kit.visor);
  visor.position.set(0, 1.66, -0.36); visor.rotation.x = 0.25; upper.add(visor);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), kit.helmet);
  chin.position.set(0, 1.46, -0.34); upper.add(chin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.3), kit.jersey);
  stripe.position.set(0, 1.71, -0.2); upper.add(stripe);

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
    _hip.set(L.side * 0.12, 1.06 - comp, 0.24);
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
    L.knee.position.copy(_knee);
  }
}
