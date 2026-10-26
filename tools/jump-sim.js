// Jump simulator. Rides one jump (or one set of rollers) with the game's own physics
// (src/physics.js, in the game's fixed 1/240 s steps), so the simulator and the game can never
// disagree.
//
// simulate(jump, kmh, pop, grade) puts the jump alone on a straight test trail at the trail's
// grade (Flow Monster's -0.2 by default) and rides it so the bike reaches the lip at `kmh`. No pedalling, braking or
// steering; with a pop, the rider crouches up the kicker and lets go on the last step
// before the lip (the best pop a rider can do). rideJump() does the same on a real trail.
// A trail on the shared mountain (src/world.js) has no single grade, so its jumps are ridden
// where they are, on the trail itself (simulateOn), steering along it like a rider.
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

// A straight test trail at `grade` with just this jump on it (one per jump and grade, kept).
const testTrails = new WeakMap();
function testTrailFor(j, grade) {
  if (!testTrails.has(j)) testTrails.set(j, new Map());
  const byGrade = testTrails.get(j);
  if (!byGrade.has(grade)) {
    const at = LEAD_IN + j.kick, length = Math.ceil(at + j.gap + j.land + 60);
    const shape = Object.fromEntries(SHAPE_KEYS.map(k => [k, j[k]]));
    const trail = defineTrail({
      id: 'jump-test', name: 'Jump test', difficulty: 'blue', length, seed: 1,
      centreline: [], width: { base: 4, waves: [], min: 3, max: 5 }, hill: { grade },
      berms: { auto: false }, start: { spawn: 1, gate: 2 },
      splits: [length - 3, length - 2, length - 1, length],
      features: [{ type: 'jump', at, kind: j.kind, ...shape, landings: j.landings }],
      scenery: { rocky: [] },
    });
    byGrade.set(grade, trail);
  }
  return byGrade.get(grade);
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
// (0 = none, anything else = a full pop), on a straight trail at `grade`.
// Returns { landAt, use, outcome, ... }.
export function simulate(j, kmh, pop = 0, grade = BASE_GRADE) {
  const trail = testTrailFor(j, grade);
  return rideJump(trail, trail.jumps[0], kmh, pop);
}

// A rider's steering on a real trail: follow the trail (aiming 8 m ahead, leaning just enough
// for the arc there); on a kicker aim at the middle of the landing's sweet spot (the bike can't
// turn in the air, and the trail may bend under the jump); in the air, hands off.
export function followTrail(trail) {
  return (keys, b, kicker) => {
    if (b.air) { keys.left = keys.right = false; return; }
    const j = kicker && kicker.j, target = j ? trail.pointAt(j.s + (j.sweet0 + j.sweet1) / 2) : trail.pointAt(b.s + 8);
    const dx = target.x - b.x, dz = b.z - target.z, dist = Math.max(4, Math.hypot(dx, dz));
    let err = Math.atan2(dx, dz) - b.h;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const want = Math.atan(2 * b.v * b.v * Math.sin(err) / dist / 9.8);
    keys.right = b.lean < want - 0.03;
    keys.left = b.lean > want + 0.03;
  };
}

// Jump j of `trail` at `kmh` with `pop`: on the trail itself if it's on the mountain, otherwise
// alone on a straight test trail at the trail's grade.
export function simulateOn(trail, j, kmh, pop = 0) {
  return trail.onMountain ? rideJump(trail, j, kmh, pop, followTrail(trail)) : simulate(j, kmh, pop, trail.grade);
}

// Table of outcomes across a speed range, for reports.
export function sweep(j, pop = 0, from = 30, to = 76, step = 2, grade = BASE_GRADE) {
  const rows = [];
  for (let kmh = from; kmh <= to; kmh += step) rows.push({ kmh, ...simulate(j, kmh, pop, grade) });
  return rows;
}

// `npm run jumps` prints a table for every jump and roller set on every trail.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { TRAILS } = await import('../src/trails/index.js');
  for (const trail of TRAILS) {
    for (const j of trail.jumps) {
      for (const pop of [0, 3]) {
        console.log(`\n${trail.name}, jump at ${j.s} m (${j.kind})${pop ? ', full pop' : ', no pop'}`);
        for (let kmh = 20; kmh <= 90; kmh += 2) { const r = simulateOn(trail, j, kmh, pop); console.log(`  ${String(kmh).padStart(3)} km/h  lands ${r.landAt?.toFixed(1).padStart(5)} m  ${r.outcome}`); }
      }
    }
    for (const r of trail.rollers) {
      for (const pop of [0, 3]) {
        console.log(`\n${trail.name}, rollers at ${r.s} m (${r.count} x ${r.height} m, ${r.spacing} m apart)${pop ? ', full pop at the first crest' : ', rolled'}`);
        for (let kmh = 15; kmh <= 65; kmh += 5) {
          const x = rideRollers(trail, r, kmh, pop);
          console.log(`  ${String(kmh).padStart(3)} km/h  ${x.outcome}${pop ? `${x.gapped ? ', gapped' : ''}, first touchdown ${x.landAt?.toFixed(1)} m past the crest` : ''}`);
        }
      }
    }
  }
}

/* ---------- Rollers ----------
   rideRollers(trail, r, kmh, pop) rides roller set r reaching its start at `kmh` (no pedalling,
   steering along the trail). With a pop, the rider holds compress up the first hump and lets go
   on the last step before its crest (or `early` metres before it), aiming to land on the back
   of the second.
   Returns { startKmh, outcome, worst (hardest landing's travel used), gapped (first touchdown
   after the pop cleared the dip: within 1 m of the second crest or beyond), landAt (m past the
   first crest) }. outcome is the
   hardest landing's class ('smooth' if it never left the ground), or the crash. */
export function rideRollers(trail, r, kmh, pop = 0, early = 0) {
  let startV = kmh / 3.6, result = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    result = rollOnce(trail, r, startV, pop, early);
    const miss = kmh - result.startKmh;
    if (Math.abs(miss) < 0.15) break;
    startV += miss / 3.6;
  }
  return result;
}

function rollOnce(trail, r, startV, pop, early) {
  const dt = PHYSICS_STEP;
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, trail, r.s - 15, startV);
  const ahead = trail.pointAt(b.s + 0.6);
  b.vy = (trail.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * startV;
  const crest = r.crests[0];
  let startKmh = null, worst = 0, popped = false, firstTouch = null;
  for (let step = 0; step < 10 / dt && b.s < r.end + 10; step++) {
    const aim = trail.pointAt(b.s + 8);
    let e = Math.atan2(aim.x - b.x, b.z - aim.z) - b.h; e = Math.atan2(Math.sin(e), Math.cos(e));
    if (b.air) keys.left = keys.right = false; else { keys.right = e > 0.03; keys.left = e < -0.03; }
    // a pop: compress up the first hump, let go on the step that reaches its crest
    keys.hop = !!(pop && !popped && b.s > r.s && b.s + b.v * dt < crest - early);
    if (pop && !popped && b.s > r.s && !keys.hop) popped = true;
    const before = b.s, speed = b.v;
    const events = stepRide(b, keys, trail, {}, true, dt);
    if (startKmh === null && before < r.s && b.s >= r.s) startKmh = speed * 3.6;
    const crash = events.find(ev => ev.type === 'crash');
    if (crash) return { startKmh, outcome: crash.big ? 'big crash' : 'small crash', why: crash.reason, worst, gapped: false, landAt: b.s - crest };
    for (const ev of events) if (ev.type === 'landing' && b.s > r.s) {
      worst = Math.max(worst, ev.use);
      if (popped && firstTouch === null) firstTouch = b.s - crest;
    }
  }
  // gapped: cleared the dip, touching down within 1 m of the next crest or beyond
  return { startKmh, outcome: classify(worst), worst, gapped: firstTouch !== null && firstTouch > r.spacing - 1, landAt: firstTouch };
}
