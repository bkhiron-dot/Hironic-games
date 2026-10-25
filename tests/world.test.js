// The mountain (src/world.js): the trailhead and finish clearings (level, graded into the hill,
// gates and fences), every trail starting and finishing through its gates, the trails kept
// apart, the forest off every trail and clearing (Flow Monster's where it was), Flow Monster
// unchanged on the mountain, and a run on it from the trailhead to the finish clearing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, FLOW_MONSTER as FM_OWN, TRAILS } from '../src/trails/index.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { rideTrail } from './helpers/ride.js';
import { worldForest } from './helpers/world.js';

const { trailhead: top, finish: bottom } = WORLD;
const FM = WORLD.trail('blue');

test('both clearings are level all over, and ride like the trail', () => {
  assert.ok(Math.abs(top.level - FM_OWN.ground(FM_OWN.start.gate, 0)) < 1e-9, 'trailhead: level with Flow Monster at its gate');
  assert.ok(Math.abs(bottom.level - FM_OWN.ground(FM_OWN.length, 0)) < 1e-9, 'finish: level with Flow Monster at its finish');
  for (const c of [top, bottom]) {
    const [u0, u1] = c.at === 'top' ? [-c.depth, 0] : [0, c.depth];
    for (let u = u0 + 0.01; u < u1; u += 1.5) {
      for (let v = -c.halfWidth + 0.01; v < c.halfWidth; v += 1.5) {
        const p = c.world(u, v);
        assert.ok(Math.abs(WORLD.groundAt(p.x, p.z) - c.level) < 1e-9, `${c.at}: level at u ${u}, v ${v}`);
        assert.ok(FM.onTrail(0, 99, p.x, p.z), `${c.at}: rides like the trail at u ${u}, v ${v}`);
      }
    }
  }
});

// Off the trails, 0.5 m per 0.5 m; on the bank between two trails running side by side into a
// clearing (both within 10 m), 0.85 m, as on a berm wall.
test('no cliffs where the clearings are cut into the hill', () => {
  for (const c of [top, bottom]) {
    let worst = { step: 0 };
    for (let u = -90; u <= 90; u += 1) {
      for (let v = -80; v <= 80; v += 1) {
        const p = c.world(u, v), here = WORLD.sample(p.x, p.z);
        if (here.near.some(n => n.past < 2.5)) continue; // trails and berms: their own tests
        const allowed = here.near.filter(n => n.past < 10).length > 1 ? 0.85 : 0.5;
        for (const [du, dv] of [[0.5, 0], [0, 0.5]]) {
          const q = c.world(u + du, v + dv), step = Math.abs(WORLD.groundAt(q.x, q.z) - here.height) / allowed * 0.5;
          if (step > worst.step) worst = { step, u, v };
        }
      }
    }
    assert.ok(worst.step < 0.5, `${c.at}: step ${worst.step.toFixed(2)} m at u ${worst.u}, v ${worst.v}`);
    console.log(`  steepest step round the ${c.at === 'top' ? 'trailhead' : 'finish'} clearing: ${worst.step.toFixed(2)} m per 0.5 m`);
  }
});

test('three gates in each clearing, green, blue and black, left to right, all open', () => {
  for (const c of [top, bottom]) assert.deepEqual(c.gates.map(g => [g.difficulty, g.name, g.open]),
    [['green', 'Jolly Green Giant', true], ['blue', 'Flow Monster', true], ['black', 'Back in Black', true]]);
  // out of the trailhead through a gate: that gate's trail; anywhere else: the fence
  const out = (v, u = 0) => { const a = top.world(u - 0.2, v), b = top.world(u + 0.2, v); return WORLD.blocked(a.x, a.z, b.x, b.z); };
  assert.equal(out(-15).out.name, 'Jolly Green Giant');
  assert.equal(out(0).out.name, 'Flow Monster');
  assert.equal(out(15).out.name, 'Back in Black');
  assert.deepEqual(out(22), { fence: true }, 'between gates');
  assert.deepEqual(out(0, -top.depth), { fence: true }, 'back fence');
  // into the finish clearing through a gate: carry on; over its fence: stopped
  const into = (v, u = 0) => { const a = bottom.world(u - 0.2, v), b = bottom.world(u + 0.2, v); return WORLD.blocked(a.x, a.z, b.x, b.z); };
  for (const v of [-15, 0, 15]) assert.equal(into(v), null, `finish gate at ${v}`);
  assert.deepEqual(into(-22), { fence: true }, 'finish fence between gates');
});

test('every trail starts through its trailhead gate and finishes through its finish gate', () => {
  for (const t of WORLD.trails) {
    const g = top.gates.find(gt => gt.difficulty === t.difficulty), f = bottom.gates.find(gt => gt.difficulty === t.difficulty);
    const start = t.pointAt(t.start.gate), end = t.pointAt(t.length);
    const a = top.local(start.x, start.z), b = bottom.local(end.x, end.z);
    assert.ok(Math.abs(a.u) < 0.5 && Math.abs(a.v - g.v) < 0.5, `${t.name} start gate at u ${a.u.toFixed(2)}, v ${a.v.toFixed(2)}`);
    assert.ok(Math.abs(b.u) < 0.5 && Math.abs(b.v - f.v) < 1, `${t.name} finish at u ${b.u.toFixed(2)}, v ${b.v.toFixed(2)}`);
    // and the rider drops in facing the gate, inside the clearing
    assert.ok(top.inClearing(t.trailhead.dropIn.x, t.trailhead.dropIn.z));
  }
});

// Agreed design (docs/v2-trailhead-spec.md, "The mountain"): lines meet only at the clearings
// and are kept at least 40 m apart elsewhere.
test('the trails are at least 40 m apart, except within 150 m of the clearings', () => {
  for (const a of WORLD.trails) {
    for (const b of WORLD.trails) {
      if (a === b) continue;
      let closest = Infinity, at = 0;
      for (let s = a.start.gate + 150; s < a.length - 150; s += 2) {
        const p = a.pointAt(s), q = b.locate(p.x, p.z);
        if (Math.abs(q.off) < closest) { closest = Math.abs(q.off); at = s; }
      }
      assert.ok(closest >= 40, `${a.name} comes within ${closest.toFixed(0)} m of ${b.name} at ${at} m`);
      if (a.difficulty !== 'blue' && b.difficulty === 'blue') console.log(`  ${a.name}: at least ${closest.toFixed(0)} m from Flow Monster`);
    }
  }
});

test('nothing grows on any trail or clearing', () => {
  const kinds = [['trunks', 1.2], ['fernTrunks', 0.4], ['bushes', 2.5], ['rocks', 0.6], ['groundFerns', 0.5], ['logs', 2]];
  for (const plan of worldForest().plans) {
    for (const chunk of Object.values(plan.chunks)) {
      for (const [kind, gap] of kinds) {
        for (const it of chunk[kind]) {
          assert.ok(!WORLD.keepClear(it.x, it.z), `${kind} on a clearing at (${it.x.toFixed(1)}, ${it.z.toFixed(1)})`);
          // (a trail's line carries on above the trailhead and below the finish only on the map)
          for (const n of WORLD.near(it.x, it.z)) if (n.s > 0 && n.s < n.trail.length) assert.ok(n.past >= gap - 1e-9, `${kind} ${n.past.toFixed(2)} m past the edge of ${n.trail.name} at ${n.s.toFixed(0)} m`);
        }
      }
    }
  }
});

test("Flow Monster's forest is where it was, except near the other trails and the clearings", () => {
  const random = makeRandom(FM_OWN.seed);
  terrainData(FM_OWN, random);
  const before = new Set(Object.values(planForest(FM_OWN, random).treeBuckets).flat().map(t => `${t.x.toFixed(6)},${t.z.toFixed(6)}`));
  const fmPlan = worldForest().plans[WORLD.trails.indexOf(FM)];
  const after = Object.values(fmPlan.treeBuckets).flat();
  const moved = after.filter(t => !before.has(`${t.x.toFixed(6)},${t.z.toFixed(6)}`));
  // only the gums round the trailhead (their own sequence) can be new
  for (const t of moved) assert.ok(top.distanceOutside(t.x, t.z) < 80, `gum at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) moved`);
  console.log(`  ${before.size - (after.length - moved.length)} of Flow Monster's ${before.size} gums cleared for the other trails and the clearings`);
});

test("on the trail, Flow Monster's ground is its own away from the clearings", () => {
  let checked = 0;
  for (let s = 150; s < FM.length - 150; s += 3.1) {
    const w = FM.halfWidth(s);
    for (const off of [-w, 0, w]) { assert.ok(Math.abs(FM.ground(s, off) - FM_OWN.ground(s, off)) < 1e-6, `s ${s}, off ${off}`); checked++; }
  }
  assert.ok(checked > 900, `only ${checked} points checked`);
});

test('drop in at the trailhead, ride through the blue gate and down Flow Monster to the finish clearing', () => {
  const run = rideTrail({ trail: FM, trees: worldForest().treeBuckets });
  assert.equal(run.fence, null, 'never touched the fence');
  assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
  assert.deepEqual(run.splitsPassed, FM.splits);
  for (const l of run.landings) assert.equal(l.outcome, 'smooth', `jump at ${l.at} m`);
  console.log(`  finish in ${run.time.toFixed(1)} s from the gate`);
});

test('every trail is on the mountain list (and the gates know their names)', () => {
  assert.deepEqual(WORLD.trails.map(t => t.id), TRAILS.map(t => t.id));
});

test('the ground is a number everywhere on the mountain, even far from every trail', () => {
  for (let x = -900; x <= 500; x += 37) for (let d = -300; d <= 1500; d += 41) assert.ok(Number.isFinite(WORLD.groundAt(x, -d)), `ground at x ${x}, d ${d}`);
});
