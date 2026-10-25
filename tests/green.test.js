// Jolly Green Giant (green): every roller set does what it declares (rolled at any speed;
// gapped with a pop on the close sets), pumping is as good as pedalling, the ground has no cliffs,
// nothing grows on the trail, and a scripted rider gets from the trailhead to the finish.
// (Its tabletops are checked with every other jump in tests/jumps.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOLLY_GREEN_GIANT as T, TRAILS } from '../src/trails/index.js';
import { withTrailhead } from '../src/trailhead.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';
import { rideRollers } from '../tools/jump-sim.js';
import { rideTrail, DT } from './helpers/ride.js';

const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 5) r.push(k); return r; };

// Declared roller outcomes: 'smooth' (never worse than a smooth landing), 'gapped' (popped,
// cleared the dip and landed smooth), 'no crash'.
for (const r of T.rollers) {
  for (const { pop, from, to, outcome } of r.landings) {
    test(`rollers at ${r.s} m (${r.count} x ${r.height} m, ${r.spacing} m apart): ${outcome} ${from}-${to} km/h ${pop ? 'with a full pop' : 'rolled'}`, () => {
      for (const kmh of speeds(from, to)) {
        const got = rideRollers(T, r, kmh, pop), where = `${kmh} km/h: ${got.outcome}${got.gapped ? ', gapped' : ''}, landed ${got.landAt?.toFixed(1)} m past the crest`;
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
  placeBikeAt(b, T, r.s - 2, kmh / 3.6);
  const ahead = T.pointAt(b.s + 0.6);
  b.vy = (T.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * b.v;
  for (let step = 0; step < 20 / DT && b.s < r.end; step++) {
    const aim = T.pointAt(b.s + 8);
    let e = Math.atan2(aim.x - b.x, b.z - aim.z) - b.h;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    keys.right = e > 0.03; keys.left = e < -0.03;
    keys.pedal = how === 'pedal';
    keys.hop = how === 'pump' && !b.air && T.rollerSlope(b.s) < 0;
    stepRide(b, keys, T, {}, true, DT);
  }
  return b.v * 3.6 - kmh;
}

test('pumping the rollers is as good as pedalling (and better once pedalling fades out)', () => {
  for (const r of T.rollers) {
    const at30 = { coast: across(r, 30, 'coast'), pump: across(r, 30, 'pump'), pedal: across(r, 30, 'pedal') };
    const at40 = { pump: across(r, 40, 'pump'), pedal: across(r, 40, 'pedal') };
    const where = `rollers at ${r.s} m: from 30 km/h coast +${at30.coast.toFixed(1)}, pump +${at30.pump.toFixed(1)}, pedal +${at30.pedal.toFixed(1)}; from 40 pump +${at40.pump.toFixed(1)}, pedal +${at40.pedal.toFixed(1)} km/h`;
    assert.ok(at30.pump > at30.coast + 1.5, where);
    assert.ok(at30.pump >= 0.85 * at30.pedal, where);
    assert.ok(at40.pump > at40.pedal, where);
  }
});

// Largest height change between neighbouring points 0.5 m apart across the trail, as a share of
// what's allowed (0.85 m on the trail and berms, 0.5 m beyond). Tabletop lips are steep on
// purpose, so they're skipped.
const onTable = s => T.jumps.some(j => s > j.s - j.kick - 2 && s < j.end + 2);
test('no cliffs across the trail and out to 60 m either side, all the way down', () => {
  let worstAll = 0;
  for (let s = -15; s < T.length + 60; s += 3.7) {
    if (onTable(s)) continue;
    let prev = null;
    for (let off = -60; off <= 60; off += 0.5) {
      const p = T.pointAt(s, off), h = T.groundAt(p.x, p.z);
      const allowed = Math.abs(off) < T.halfWidth(s) + 2.5 ? 0.85 : 0.5;
      if (prev !== null) {
        const step = Math.abs(h - prev) / allowed;
        worstAll = Math.max(worstAll, step);
        assert.ok(step < 1, `across the trail at ${s.toFixed(1)} m, offset ${off}: ${Math.abs(h - prev).toFixed(2)} m step`);
      }
      prev = h;
    }
  }
  console.log(`  steepest step ${(worstAll * 100).toFixed(0)}% of allowed`);
});

// Berms fade out from 20 m before a kicker to 8 m after its landing (src/trail.js), so the
// bike is level and straight on a jump.
const nearTable = s => T.jumps.some(j => s > j.s - j.kick - 28 && s < j.end + 8);
test('bends are gentle (no tighter than 40 m radius) and berms are on every real corner', () => {
  let tightest = Infinity, unbermed = 0;
  for (let s = 0; s <= T.length; s += 1) {
    const k = Math.abs(T.curvature(s));
    tightest = Math.min(tightest, 1 / k);
    if (k > 1 / 70 && T.bermAmount(s) < 1 && !nearTable(s)) unbermed++;
  }
  assert.ok(tightest >= 40, `tightest bend ${tightest.toFixed(0)} m`);
  assert.equal(unbermed, 0, `metres of corner tighter than 70 m radius without a full berm: ${unbermed}`);
});

test('nothing grows on the trail', () => {
  const random = makeRandom(T.seed);
  terrainData(T, random);
  const plan = planForest(T, random);
  for (const [kind, gap] of [['trunks', 1.2], ['fernTrunks', 0.4], ['bushes', 2.5], ['rocks', 0.6], ['groundFerns', 0.5], ['logs', 2]]) {
    for (const chunk of Object.values(plan.chunks)) for (const it of chunk[kind]) {
      const at = T.locate(it.x, it.z);
      assert.ok(Math.abs(at.off) >= T.halfWidth(at.s) + gap - 1e-9, `${kind} at s = ${at.s.toFixed(1)} is ${Math.abs(at.off).toFixed(2)} m from the centreline`);
    }
  }
});

// A whole run from the trailhead: cruise at `cruise`, popping each tabletop where a full pop
// lands smooth at that speed. Returns the run.
function greenRun({ cruise, pop, pump = false }) {
  const trail = withTrailhead(T, TRAILS.map(t => t.difficulty));
  const random = makeRandom(trail.seed);
  terrainData(trail, random);
  const { treeBuckets } = planForest(trail, random);
  const lipPlan = Object.fromEntries(trail.jumps.map(j => [j.s, { kmh: cruise, pop }]));
  return rideTrail({ trail, trees: treeBuckets, lipPlan, cruise, pump });
}

for (const [label, ride] of [
  ['a slow rider (30 km/h), rolling everything', { cruise: 30, pop: 0 }],
  ['a fast rider (48 km/h), popping every tabletop and pumping the rollers', { cruise: 48, pop: 3, pump: true }],
]) {
  test(`${label} gets from the trailhead to the finish without crashing`, () => {
    const run = greenRun(ride);
    assert.equal(run.fence, null, 'never touched the fence');
    assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
    assert.deepEqual(run.splitsPassed, T.splits);
    for (const l of run.landings) assert.notEqual(l.outcome, 'small crash', `tabletop at ${l.at} m`);
    console.log(`  finish in ${run.time.toFixed(1)} s; tabletop landings ${run.landings.map(l => `${l.at}: ${l.outcome}`).join(', ') || 'none (rolled them)'}`);
  });
}
