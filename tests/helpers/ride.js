// Rides the game's own physics (src/physics.js) on the Hardline trail with a scripted rider.
// Shared by tests/ride.test.js and tuning reports.
import { HARDLINE as T } from '../../src/trails/index.js';
import { makeRandom } from '../../src/util.js';
import { terrainData } from '../../src/terrain.js';
import { planForest } from '../../src/forest.js';
import { createBikeState, placeBikeAt, stepRide } from '../../src/physics.js';
import { classify } from '../../tools/jump-sim.js';
import { PHYSICS_STEP } from '../../src/clock.js';

export { T };
const random = makeRandom(T.seed);
terrainData(T, random);
export const { treeBuckets } = planForest(T, random);
export const DT = PHYSICS_STEP; // the game's fixed physics step

// Steer at a point 8 m ahead on the centreline (or `line` metres to its right).
export function steerAlongTrail(b, keys, line = 0) {
  steerAt(b, keys, T.pointAt(b.s + 8, line));
}

// Steer toward a world point.
function steerAt(b, keys, target) {
  let err = Math.atan2(target.x - b.x, b.z - target.z) - b.h;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  keys.right = err > 0.03;
  keys.left = err < -0.03;
}

// What a rider does with the bars: follow the trail; on a kicker, aim at the middle of the
// landing's sweet spot (the bike can't turn in the air, and the trail may bend under the
// jump); in the air, hands off.
function rideLine(b, keys, kicker) {
  if (b.air) { keys.left = keys.right = false; return; }
  if (kicker) { const j = kicker.j; steerAt(b, keys, T.pointAt(j.s + (j.sweet0 + j.sweet1) / 2)); return; }
  steerAlongTrail(b, keys);
}

// Ride one jump: start before the kicker so the bike reaches the lip at `lipKmh`, no pedalling
// or braking on the kicker, and (if `pop`) crouch up the kicker and release on the last step
// before the lip, which is the best pop a rider can do (the simulator pops right at the lip).
// Returns { lipKmh, outcome } where outcome is classify(use) at landing, or the crash.
export function rideJump(j, lipKmh, pop) {
  let startV = lipKmh / 3.6, result = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    result = rideOnce(j, startV, pop);
    if (result.lipKmh === null) { startV *= 0.95; continue; } // came off before the lip: ease off
    const miss = lipKmh - result.lipKmh;
    if (Math.abs(miss) < 0.15) break;
    startV += miss / 3.6;
  }
  return result;
}
function rideOnce(j, startV, pop) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, T, j.s - j.kick - 12, startV);
  // already moving: start following the slope, rather than dropped onto it
  const ahead = T.pointAt(b.s + 0.6);
  b.vy = (T.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * startV;
  let lipKmh = null;
  for (let step = 0; step < 10 / DT; step++) {
    // like a rider: aim the kicker at the landing, hands off in the air
    const k = T.kickerAt(b.s);
    rideLine(b, keys, k);
    keys.hop = !!(pop && k && k.u < -b.v * DT); // let go on the step that reaches the lip
    const before = b.s, speed = b.v;
    const events = stepRide(b, keys, T, treeBuckets, true, DT);
    if (lipKmh === null && before < j.s && b.s >= j.s) lipKmh = speed * 3.6;
    const crash = events.find(e => e.type === 'crash');
    if (crash) return { lipKmh, outcome: crash.big ? 'big crash' : 'small crash', why: crash.reason };
    const landing = events.find(e => e.type === 'landing');
    if (landing && b.s > j.s) return { lipKmh, outcome: classify(landing.use) };
  }
  return { lipKmh, outcome: 'rolled' };
}


// A whole run from the start: hold a sensible speed for each section (below 58 km/h between
// jumps, mid-range at each lip, popping where the jump needs it) and steer along the trail.
// Returns { crash, splitsPassed, landings, time }.
const LIP_PLAN = { normal: { kmh: 56, pop: 0 }, popOptional: { kmh: 60, pop: 0 }, bigPop: { kmh: 62, pop: 3 } };
export function rideTrail() {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, T, T.start.spawn, 0);
  const splitsPassed = [], landings = [];
  let time = 0;
  for (let step = 0; step < 300 / DT && b.s < T.length; step++) {
    // the next jump within 60 m sets the target speed; otherwise cruise
    const next = T.jumps.find(j => b.s > j.s - j.kick - 60 && b.s < j.s);
    const plan = next && LIP_PLAN[next.kind];
    const target = (plan ? plan.kmh : 58) / 3.6;
    keys.pedal = b.v < target - 0.3;
    keys.brake = b.v > target + 0.3 && !(next && b.s > next.s - next.kick); // no braking on a kicker
    const k = T.kickerAt(b.s);
    rideLine(b, keys, k);
    keys.hop = !!(plan && plan.pop && k && k.u < -b.v * DT);
    const before = b.s;
    const events = stepRide(b, keys, T, treeBuckets, true, DT);
    time += DT;
    for (const e of events) {
      if (e.type === 'crash') return { crash: { ...e, s: b.s }, splitsPassed, landings, time };
      // the first touchdown past each lip is that jump's landing (later ones are small bounces)
      const jump = T.jumps.find(j => b.s > j.s && b.s < j.end);
      if (e.type === 'landing' && jump && !landings.some(l => l.at === jump.s)) landings.push({ at: jump.s, zone: e.zone, outcome: classify(e.use) });
    }
    for (const s of T.splits) if (before < s && b.s >= s) splitsPassed.push(s);
  }
  return { crash: null, splitsPassed, landings, time };
}
