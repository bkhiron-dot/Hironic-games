// Back in Black (black): the ground has no cliffs, nothing grows on the trail, and a rider who
// picks pop or no pop by speed gets from the trailhead to the finish, landing every gap smooth.
// (Each jump's declared landing ranges are checked with every other jump in tests/jumps.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACK_IN_BLACK as T, TRAILS } from '../src/trails/index.js';
import { withTrailhead } from '../src/trailhead.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { rideTrail } from './helpers/ride.js';

const onJump = s => T.jumps.some(j => s > j.s - j.kick - 2 && s < j.end + 2);

test('no cliffs across the trail and out to 60 m either side, all the way down', () => {
  let worstAll = 0;
  for (let s = -15; s < T.length + 60; s += 3.7) {
    if (onJump(s)) continue; // jump lips and gaps are steep on purpose
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

// Speed (km/h) to hold into each lip, and whether to pop: about what you reach flat out, popping
// where that speed is in the jump's pop window (see the trail file).
const LIP_PLAN = {
  120: { kmh: 68, pop: 0 }, 195: { kmh: 78, pop: 0 }, 330: { kmh: 68, pop: 3 }, 420: { kmh: 56, pop: 3 },
  565: { kmh: 62, pop: 0 }, 650: { kmh: 78, pop: 0 }, 800: { kmh: 78, pop: 0 }, 885: { kmh: 64, pop: 0 },
  1040: { kmh: 60, pop: 3 },
};

test('from the trailhead to the finish, landing every gap smooth', () => {
  const trail = withTrailhead(T, TRAILS.map(t => t.difficulty));
  const random = makeRandom(trail.seed);
  terrainData(trail, random);
  const { treeBuckets } = planForest(trail, random);
  const run = rideTrail({ trail, trees: treeBuckets, lipPlan: LIP_PLAN, cruise: 70 });
  assert.equal(run.fence, null, 'never touched the fence');
  assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
  assert.deepEqual(run.splitsPassed, T.splits);
  assert.deepEqual(run.landings.map(l => l.at), T.jumps.map(j => j.s), 'landed every gap');
  for (const l of run.landings) assert.equal(l.outcome, 'smooth', `gap at ${l.at} m`);
  console.log(`  finish in ${run.time.toFixed(1)} s from the gate`);
});
