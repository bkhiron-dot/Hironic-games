// Jolly Green Giant (green) on the mountain: every roller set does what it declares (rolled at
// any speed; gapped with a pop on the close sets), pumping is as good as pedalling, the ground has
// no cliffs, bends are gentle and bermed, and scripted riders get from the trailhead to the finish
// clearing. (Its tabletops are checked with every other jump in tests/jumps.test.js; nothing
// growing on any trail in tests/world.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, JOLLY_GREEN_GIANT as OWN } from '../src/trails/index.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';
import { rideRollers } from '../tools/jump-sim.js';
import { rideTrail, DT } from './helpers/ride.js';
import { worldForest, steepestAcross } from './helpers/world.js';

const T = WORLD.trail('green');
const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 5) r.push(k); return r; };

// Declared roller outcomes: 'smooth' (never worse than a smooth landing), 'gapped' (popped,
// cleared the dip and landed smooth), 'no crash'. Ridden on the trail itself.
for (const r of OWN.rollers) {
  for (const { pop, from, to, outcome } of r.landings) {
    test(`rollers at ${r.s} m (${r.count} x ${r.height} m, ${r.spacing} m apart): ${outcome} ${from}-${to} km/h ${pop ? 'with a full pop' : 'rolled'}`, () => {
      for (const kmh of speeds(from, to)) {
        const got = rideRollers(OWN, r, kmh, pop), where = `${kmh} km/h: ${got.outcome}${got.gapped ? ', gapped' : ''}, landed ${got.landAt?.toFixed(1)} m past the crest`;
        if (outcome === 'gapped') assert.ok(got.gapped && got.outcome === 'smooth', where);
        else if (outcome === 'no crash') assert.ok(!got.outcome.includes('crash'), where);
        else assert.equal(got.outcome, outcome, where);
      }
    });
  }
}

// Speed gained over roller set r from `kmh`: coasting, pumping (compress down the backs) or pedalling.
function across(r, kmh, how) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, OWN, r.s - 2, kmh / 3.6);
  const ahead = OWN.pointAt(b.s + 0.6);
  b.vy = (OWN.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * b.v;
  for (let step = 0; step < 20 / DT && b.s < r.end; step++) {
    const aim = OWN.pointAt(b.s + 8);
    let e = Math.atan2(aim.x - b.x, b.z - aim.z) - b.h;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    keys.right = e > 0.03; keys.left = e < -0.03;
    keys.pedal = how === 'pedal';
    keys.hop = how === 'pump' && !b.air && OWN.rollerSlope(b.s) < 0;
    stepRide(b, keys, OWN, {}, true, DT);
  }
  return b.v * 3.6 - kmh;
}

test('pumping the rollers is as good as pedalling (and better once pedalling fades out)', () => {
  for (const r of OWN.rollers) {
    const at30 = { coast: across(r, 30, 'coast'), pump: across(r, 30, 'pump'), pedal: across(r, 30, 'pedal') };
    const at40 = { pump: across(r, 40, 'pump'), pedal: across(r, 40, 'pedal') };
    const where = `rollers at ${r.s} m: from 30 km/h coast +${at30.coast.toFixed(1)}, pump +${at30.pump.toFixed(1)}, pedal +${at30.pedal.toFixed(1)}; from 40 pump +${at40.pump.toFixed(1)}, pedal +${at40.pedal.toFixed(1)} km/h`;
    assert.ok(at30.pump > at30.coast + 1.5, where);
    assert.ok(at30.pump >= 0.85 * at30.pedal, where);
    assert.ok(at40.pump > at40.pedal, where);
  }
});

test('no cliffs across the trail and out to 60 m either side, all the way down', () => {
  const { worst, at } = steepestAcross(T, -15, T.length + 60);
  assert.ok(worst < 1, `across the trail at ${at?.s.toFixed(1)} m, offset ${at?.off}: ${at?.step.toFixed(2)} m step`);
  console.log(`  steepest step ${(worst * 100).toFixed(0)}% of allowed`);
});

// Berms fade out from 20 m before a kicker to 8 m after its landing (src/trail.js), so the
// bike is level and straight on a jump.
const nearTable = s => T.jumps.some(j => s > j.s - j.kick - 28 && s < j.end + 8);
test('bends are gentle (no tighter than 50 m radius) and berms are on every real corner', () => {
  let tightest = Infinity, unbermed = 0;
  for (let s = 0; s <= T.length; s += 1) {
    const k = Math.abs(T.curvature(s));
    tightest = Math.min(tightest, 1 / k);
    if (k > 1 / 70 && T.bermAmount(s) < 1 && !nearTable(s)) unbermed++;
  }
  assert.ok(tightest >= 50, `tightest bend ${tightest.toFixed(0)} m`);
  assert.equal(unbermed, 0, `metres of corner tighter than 70 m radius without a full berm: ${unbermed}`);
});

test('on the trail, the ground is its own: the mountain changes nothing past the clearings', () => {
  for (let s = 150; s < T.length - 150; s += 7.3) {
    const w = T.halfWidth(s);
    for (const off of [-w, 0, w]) assert.ok(Math.abs(T.ground(s, off) - OWN.ground(s, off)) < 1e-6, `s ${s}, off ${off}`);
  }
});

// A whole run from the trailhead: cruise at `cruise`, popping each tabletop (or not). Returns the run.
function greenRun({ cruise, pop, pump = false }) {
  const lipPlan = Object.fromEntries(T.jumps.map(j => [j.s, { kmh: cruise, pop }]));
  return rideTrail({ trail: T, trees: worldForest().treeBuckets, lipPlan, cruise, pump });
}

for (const [label, ride] of [
  ['a slow rider (30 km/h), rolling everything', { cruise: 30, pop: 0 }],
  ['a fast rider (45 km/h), popping every tabletop and pumping the rollers', { cruise: 45, pop: 3, pump: true }],
]) {
  test(`${label} gets from the trailhead to the finish clearing without crashing`, () => {
    const run = greenRun(ride);
    assert.equal(run.fence, null, 'never touched the fence');
    assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
    assert.deepEqual(run.splitsPassed, T.splits);
    for (const l of run.landings) assert.notEqual(l.outcome, 'small crash', `tabletop at ${l.at} m`);
    console.log(`  finish in ${run.time.toFixed(1)} s; tabletop landings ${run.landings.map(l => `${l.at}: ${l.outcome}`).join(', ') || 'none (rolled them)'}`);
  });
}
