// The trailhead clearing (src/trailhead.js): level, no cliffs where it is cut into the hill,
// the trail past the gate untouched, gates and fence where they should be, the forest kept
// off it without moving the rest, and a rider can drop in and ride to the finish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_MONSTER as RAW } from '../src/trails/index.js';
import { withTrailhead } from '../src/trailhead.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { rideTrail } from './helpers/ride.js';

const T = withTrailhead(RAW), th = T.trailhead;

test('the clearing is level with the trail at the start gate, all over', () => {
  assert.ok(Math.abs(th.level - RAW.ground(RAW.start.gate, 0)) < 1e-9);
  // (just inside the fence: on the line itself rounding decides)
  for (let u = -th.depth + 0.01; u < 0; u += 1.5) {
    for (let v = -th.halfWidth + 0.01; v < th.halfWidth; v += 1.5) {
      const p = th.world(u, v);
      assert.ok(Math.abs(T.groundAt(p.x, p.z) - th.level) < 1e-9, `level at u ${u}, v ${v}`);
      assert.ok(T.onTrail(0, 99, p.x, p.z), `rides like the trail at u ${u}, v ${v}`);
    }
  }
});

test('no cliffs where the clearing is cut into the hill (steepest 0.5 m step under 0.5 m)', () => {
  // the same limit as tests/ground.test.js away from the trail; the trail itself is checked
  // there. Where the clearing leaves the ground as it was (like the old line of the trail
  // above the start, behind the back fence), the ground tests already cover it.
  let worst = { step: 0 };
  for (let u = -90; u <= 40; u += 1) {
    for (let v = -80; v <= 80; v += 1) {
      const p = th.world(u, v), at = RAW.locate(p.x, p.z);
      if (Math.abs(at.off) < RAW.halfWidth(at.s) + 2.5 && at.s > RAW.start.gate) continue;
      const h = T.groundAt(p.x, p.z), raw = RAW.groundAt(p.x, p.z);
      for (const [du, dv] of [[0.5, 0], [0, 0.5]]) {
        const q = th.world(u + du, v + dv), step = Math.abs(T.groundAt(q.x, q.z) - h);
        const unchanged = h === raw && T.groundAt(q.x, q.z) === RAW.groundAt(q.x, q.z);
        if (step > worst.step && !unchanged) worst = { step, u, v };
      }
    }
  }
  assert.ok(worst.step < 0.5, `step ${worst.step.toFixed(2)} m at u ${worst.u}, v ${worst.v}`);
  console.log(`  steepest step round the clearing: ${worst.step.toFixed(2)} m per 0.5 m`);
});

test('past the gate the trail is untouched (from 3 m on); the clearing only reshapes the ground beside it', () => {
  for (let s = RAW.start.gate + 3; s < 200; s += 0.7) {
    const w = RAW.halfWidth(s);
    for (const off of [-w, -w / 2, 0, w / 2, w]) assert.equal(T.ground(s, off), RAW.ground(s, off), `s ${s}, off ${off}`);
  }
});

test('three gates, green, blue and black, left to right; only Flow Monster is open', () => {
  assert.deepEqual(th.gates.map(g => [g.difficulty, g.name, g.open]),
    [['green', 'Jolly Green Giant', false], ['blue', 'Flow Monster', true], ['black', 'Back in Black', false]]);
  const cross = v => { const a = th.world(-0.2, v), b = th.world(0.2, v); return th.blocked(a.x, a.z, b.x, b.z); };
  assert.equal(cross(0), null, 'through the blue gate');
  assert.equal(cross(-15).gate.name, 'Jolly Green Giant');
  assert.equal(cross(15).gate.name, 'Back in Black');
  assert.deepEqual(cross(22), { fence: true }, 'between gates');
  const back = [th.world(-th.depth + 0.2, 0), th.world(-th.depth - 0.2, 0)];
  assert.deepEqual(th.blocked(back[0].x, back[0].z, back[1].x, back[1].z), { fence: true }, 'back fence');
  const side = [th.world(-10, th.halfWidth - 0.2), th.world(-10, th.halfWidth + 0.2)];
  assert.deepEqual(th.blocked(side[0].x, side[0].z, side[1].x, side[1].z), { fence: true }, 'side fence');
});

test('no plants on the clearing; the rest of the forest is where it was', () => {
  const plan = (trail) => { const random = makeRandom(trail.seed); terrainData(trail, random); return planForest(trail, random); };
  const before = Object.values(plan(RAW).treeBuckets).flat(), after = Object.values(plan(T).treeBuckets).flat();
  const key = t => `${t.x.toFixed(6)},${t.z.toFixed(6)}`, now = new Set(after.map(key));
  for (const t of after) assert.ok(!th.keepClear(t.x, t.z), `tree at ${key(t)} is on the clearing`);
  const kept = before.filter(t => !th.keepClear(t.x, t.z));
  for (const t of kept) assert.ok(now.has(key(t)), `tree at ${key(t)} moved`);
  console.log(`  ${before.length - kept.length} gums cleared, ${after.length - kept.length} planted round the clearing`);
});

test('drop in at the trailhead, pedal through the blue gate and ride to the finish', () => {
  const random = makeRandom(T.seed);
  terrainData(T, random);
  const { treeBuckets } = planForest(T, random);
  const run = rideTrail({ trail: T, trees: treeBuckets });
  assert.equal(run.fence, null, 'never touched the fence');
  assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
  assert.deepEqual(run.splitsPassed, T.splits);
  for (const l of run.landings) assert.equal(l.outcome, 'smooth', `jump at ${l.at} m`);
  console.log(`  from the trailhead: finish in ${run.time.toFixed(1)} s from the gate`);
});
