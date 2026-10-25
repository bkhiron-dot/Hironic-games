// Rides the game's own physics (src/physics.js) with a scripted rider: Flow Monster by default,
// or any trail.
// Shared by tests/ride.test.js and tuning reports.
import { FLOW_MONSTER as T } from '../../src/trails/index.js';
import { makeRandom } from '../../src/util.js';
import { terrainData } from '../../src/terrain.js';
import { planForest } from '../../src/forest.js';
import { createBikeState, placeBikeAt, placeBikeAtPoint, stepRide } from '../../src/physics.js';
import { classify, rideJump as rideJumpOn } from '../../tools/jump-sim.js';
import { PHYSICS_STEP } from '../../src/clock.js';

export { T };
const random = makeRandom(T.seed);
terrainData(T, random);
export const { treeBuckets } = planForest(T, random);
export const DT = PHYSICS_STEP; // the game's fixed physics step

// Steer at a point 8 m ahead on the centreline (or `line` metres to its right).
export function steerAlongTrail(b, keys, line = 0, trail = T) {
  steerAt(b, keys, trail.pointAt(b.s + 8, line));
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
function rideLine(b, keys, kicker, trail = T) {
  if (b.air) { keys.left = keys.right = false; return; }
  if (kicker) { const j = kicker.j; steerAt(b, keys, trail.pointAt(j.s + (j.sweet0 + j.sweet1) / 2)); return; }
  steerAlongTrail(b, keys, 0, trail);
}

// Ride one jump on Flow Monster so the bike reaches the lip at lipKmh, aiming the kicker at the
// landing like a rider (the simulator's rider, tools/jump-sim.js). Returns { lipKmh, outcome, ... }.
export function rideJump(j, lipKmh, pop) {
  return rideJumpOn(T, j, lipKmh, pop, (keys, b, kicker) => rideLine(b, keys, kicker));
}

// A whole run from the start: hold a sensible speed for each section (below 58 km/h between
// jumps, mid-range at each lip, popping where the jump needs it) and steer along the trail.
// By default it starts at the start gate on Flow Monster; give it a trail with a trailhead
// (and that trail's trees) to drop in from the clearing instead.
// Returns { crash, splitsPassed, landings, time (from the start gate), fence (any fence hit) }.
// Speed and pop at each lip, by the jump's distance down the trail (the first and the one before
// split 3 were stretched for Ben's fast popped run-ins, so they're popped here too).
// Any other trail gives its own plan (lipPlan) and cruising speed; pump: hold compress down the
// backs of rollers.
const LIP_PLAN = { 177: { kmh: 58, pop: 3 }, 438: { kmh: 60, pop: 0 }, 743: { kmh: 66, pop: 3 }, 1037: { kmh: 60, pop: 3 } };
export function rideTrail({ trail = T, trees = treeBuckets, lipPlan = LIP_PLAN, cruise = 58, pump = false } = {}) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  const th = trail.trailhead;
  if (th) placeBikeAtPoint(b, trail, th.dropIn.x, th.dropIn.z, th.dropIn.h, 0);
  else placeBikeAt(b, trail, trail.start.spawn, 0);
  const splitsPassed = [], landings = [];
  let time = 0, timing = !th, fence = null;
  for (let step = 0; step < 300 / DT && b.s < trail.length; step++) {
    // the next jump within 60 m sets the target speed; otherwise cruise
    const next = trail.jumps.find(j => b.s > j.s - j.kick - 60 && b.s < j.s);
    const plan = next && lipPlan[next.s];
    const target = (plan ? plan.kmh : cruise) / 3.6;
    keys.pedal = b.v < target - 0.3;
    keys.brake = b.v > target + 0.3 && !(next && b.s > next.s - next.kick); // no braking on a kicker
    const k = trail.kickerAt(b.s);
    rideLine(b, keys, k, trail);
    keys.hop = !!(plan && plan.pop && k && k.u < -b.v * DT) || (pump && !b.air && trail.rollerSlope(b.s) < 0);
    const before = b.s, x0 = b.x, z0 = b.z;
    const events = stepRide(b, keys, trail, trees, timing, DT);
    if (th && !fence) fence = th.blocked(x0, z0, b.x, b.z);
    if (!timing && b.s > trail.start.gate && !th.inClearing(b.x, b.z)) timing = true; // through the gate
    if (timing) time += DT;
    for (const e of events) {
      if (e.type === 'crash') return { crash: { ...e, s: b.s }, splitsPassed, landings, time, fence };
      // the first touchdown past each lip is that jump's landing (later ones are small bounces)
      const jump = trail.jumps.find(j => b.s > j.s && b.s < j.end);
      if (e.type === 'landing' && jump && !landings.some(l => l.at === jump.s)) landings.push({ at: jump.s, zone: e.zone, outcome: classify(e.use) });
    }
    for (const s of trail.splits) if (before < s && b.s >= s) splitsPassed.push(s);
  }
  return { crash: null, splitsPassed, landings, time, fence };
}
