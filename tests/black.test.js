// Back in Black (black) on the mountain: the ground has no cliffs, and a rider who picks pop or
// no pop by speed gets from the trailhead to the finish clearing, landing every gap smooth.
// (Each jump's declared landing ranges are checked with every other jump in tests/jumps.test.js;
// nothing growing on any trail is checked in tests/world.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, BACK_IN_BLACK as OWN } from '../src/trails/index.js';
import { rideTrail } from './helpers/ride.js';
import { worldForest, steepestAcross } from './helpers/world.js';

const T = WORLD.trail('black');

test('no cliffs across the trail and out to 60 m either side, all the way down', () => {
  const { worst, at } = steepestAcross(T, -15, T.length + 60);
  assert.ok(worst < 1, `across the trail at ${at?.s.toFixed(1)} m, offset ${at?.off}: ${at?.step.toFixed(2)} m step`);
  console.log(`  steepest step ${(worst * 100).toFixed(0)}% of allowed`);
});

test('on the trail, the ground is its own: the mountain changes nothing past the clearings', () => {
  for (let s = 150; s < T.length - 150; s += 7.3) {
    const w = T.halfWidth(s);
    for (const off of [-w, 0, w]) assert.ok(Math.abs(T.ground(s, off) - OWN.ground(s, off)) < 1e-6, `s ${s}, off ${off}`);
  }
});

// Speed (km/h) to hold into each lip, and whether to pop: about what you reach flat out (see the
// trail file).
const LIP_PLAN = {
  171: { kmh: 60, pop: 3 }, 364: { kmh: 60, pop: 3 }, 560: { kmh: 70, pop: 0 },
  755: { kmh: 62, pop: 3 }, 950: { kmh: 62, pop: 0 }, 1150: { kmh: 62, pop: 3 },
};

test('from the trailhead to the finish clearing, landing every gap smooth', () => {
  const run = rideTrail({ trail: T, trees: worldForest().treeBuckets, lipPlan: LIP_PLAN, cruise: 65 });
  assert.equal(run.fence, null, 'never touched the fence');
  assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
  assert.deepEqual(run.splitsPassed, T.splits);
  assert.deepEqual(run.landings.map(l => l.at), T.jumps.map(j => j.s), 'landed every gap');
  for (const l of run.landings) assert.equal(l.outcome, 'smooth', `gap at ${l.at} m`);
  console.log(`  finish in ${run.time.toFixed(1)} s from the gate`);
});
