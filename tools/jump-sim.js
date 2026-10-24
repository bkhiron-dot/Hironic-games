// Jump simulator. Rides one jump with the game's own physics (src/physics.js, in the game's
// fixed 1/240 s steps), so the simulator and the game can never disagree.
//
// simulate(jump, kmh, pop) puts the jump alone on a straight test trail at the base grade
// (-0.2) and rides it so the bike reaches the lip at `kmh`. No pedalling, braking or
// steering; with a pop, the rider crouches up the kicker and lets go on the last step
// before the lip (the best pop a rider can do). rideJump() does the same on a real trail.
import { defineTrail } from '../src/trail.js';
import { SHAPE_KEYS, resolveJump } from '../src/jumps.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';
import { PHYSICS_STEP } from '../src/clock.js';

export const BASE_GRADE = -0.2;

// A jump of one kind on its own, for simulating.
export const jumpOfKind = kind => resolveJump({ kind, at: 0 });
const LEAD_IN = 30; // metres of straight trail before the kicker on the test trail

export function classify(use) {
  if (use < 0.55) return 'smooth';
  if (use < 1.0) return 'heavy';
  if (use < 1.35) return 'small crash';
  return 'big crash';
}

// A straight test trail at the base grade with just this jump on it (one per jump, kept).
const testTrails = new WeakMap();
function testTrailFor(j) {
  if (!testTrails.has(j)) {
    const at = LEAD_IN + j.kick, length = Math.ceil(at + j.gap + j.land + 60);
    const shape = Object.fromEntries(SHAPE_KEYS.map(k => [k, j[k]]));
    const trail = defineTrail({
      id: 'jump-test', name: 'Jump test', length, seed: 1,
      centreline: [], width: { base: 4, waves: [], min: 3, max: 5 }, hill: { grade: BASE_GRADE },
      berms: { auto: false }, start: { spawn: 1, gate: 2 },
      splits: [length - 3, length - 2, length - 1, length],
      features: [{ type: 'jump', at, kind: j.kind, ...shape, landings: j.landings }],
      scenery: { rocky: [] },
    });
    testTrails.set(j, trail);
  }
  return testTrails.get(j);
}

const noSteering = keys => { keys.left = keys.right = false; };

// Rides jump j on `trail` so the bike reaches the lip at lipKmh. Starts 12 m before the
// kicker and adjusts the starting speed until the speed at the lip is right.
// steer(keys, b, kicker) sets left/right each step. Returns
// { lipKmh, outcome, use, landAt (metres past the lip), off (sideways offset at landing), why }.
export function rideJump(trail, j, lipKmh, pop = 0, steer = noSteering) {
  let startV = lipKmh / 3.6, result = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    result = rideOnce(trail, j, startV, pop, steer);
    if (result.lipKmh === null) { startV *= 0.95; continue; } // came off before the lip: ease off
    const miss = lipKmh - result.lipKmh;
    if (Math.abs(miss) < 0.15) break;
    startV += miss / 3.6;
  }
  return result;
}

function rideOnce(trail, j, startV, pop, steer) {
  const dt = PHYSICS_STEP;
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, trail, j.s - j.kick - 12, startV);
  // already moving: start following the slope, rather than dropped onto it
  const ahead = trail.pointAt(b.s + 0.6);
  b.vy = (trail.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * startV;
  let lipKmh = null;
  for (let step = 0; step < 10 / dt; step++) {
    const k = trail.kickerAt(b.s);
    steer(keys, b, k);
    keys.hop = !!(pop && k && k.u < -b.v * dt); // let go on the step that reaches the lip
    const before = b.s, speed = b.v;
    const events = stepRide(b, keys, trail, {}, true, dt);
    if (lipKmh === null && before < j.s && b.s >= j.s) lipKmh = speed * 3.6;
    const crash = events.find(e => e.type === 'crash');
    if (crash) return { lipKmh, outcome: crash.big ? 'big crash' : 'small crash', why: crash.reason, landAt: b.s - j.s, off: trail.locate(b.x, b.z).off };
    const landing = events.find(e => e.type === 'landing');
    if (landing && b.s > j.s) return { lipKmh, outcome: classify(landing.use), use: landing.use, landAt: b.s - j.s, off: trail.locate(b.x, b.z).off };
  }
  return { lipKmh, outcome: 'rolled', landAt: null, off: null };
}

// Simulate one jump (a resolved jump, see src/jumps.js) at `kmh` at the lip, with `pop`
// (0 = none, anything else = a full pop). Returns { landAt, use, outcome, ... }.
export function simulate(j, kmh, pop = 0) {
  const trail = testTrailFor(j);
  return rideJump(trail, trail.jumps[0], kmh, pop);
}

// Table of outcomes across a speed range, for reports.
export function sweep(j, pop = 0, from = 30, to = 76, step = 2) {
  const rows = [];
  for (let kmh = from; kmh <= to; kmh += step) rows.push({ kmh, ...simulate(j, kmh, pop) });
  return rows;
}

// `npm run jumps` prints a table for every jump on every trail.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { TRAILS } = await import('../src/trails/index.js');
  for (const trail of TRAILS) for (const j of trail.jumps) {
    for (const pop of [0, 3]) {
      console.log(`\n${trail.name}, jump at ${j.s} m (${j.kind})${pop ? ', full pop' : ', no pop'}`);
      for (const r of sweep(j, pop)) console.log(`  ${String(r.kmh).padStart(3)} km/h  lands ${r.landAt?.toFixed(1).padStart(5)} m  ${r.outcome}`);
    }
  }
}
