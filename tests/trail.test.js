// Trails as data: defineTrail() catches mistakes in trail files with a clear message,
// berm adjustments work, and a second, made-up trail drives every part of the game
// (terrain, forest, physics) with no trace of the Flow Monster track.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { defineTrail } from '../src/trail.js';
import flowMonster from '../src/trails/flow-monster.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';

// A copy of the Flow Monster data with some changes, for testing mistakes.
const variant = changes => ({ ...structuredClone(flowMonster), ...changes });
const rejects = (changes, message) => assert.throws(() => defineTrail(variant(changes)), message);

test('the Flow Monster trail data is accepted', () => {
  const trail = defineTrail(flowMonster);
  assert.equal(trail.length, 1297);
  assert.equal(trail.jumps.length, 4);
});

test('mistakes in trail data are explained', () => {
  rejects({ id: '' }, /needs an id/);
  rejects({ difficulty: 'red' }, /difficulty must be one of green, blue, black/);
  rejects({ splits: [300, 600, 1200] }, /exactly 4 splits/);
  rejects({ splits: [300, 900, 600, 1200] }, /splits must go down the trail/);
  rejects({ splits: [300, 600, 900, 1100] }, /must be at the trail length \(1297\)/);
  rejects({ start: { spawn: 9, gate: 8 } }, /spawn before the gate/);
  rejects({ width: { base: 3, waves: [], min: 5, max: 4 } }, /width min must be above 0 and below max/);
  rejects({ centreline: [{ amp: 22, period: 0 }] }, /centreline wave 1 needs/);
  rejects({ features: [{ type: 'rail', at: 300 }] }, /unknown feature type "rail"/);
  rejects({ features: [{ type: 'jump', at: 300, kind: 'mega' }] }, /jump at 300: unknown jump kind "mega"/);
  rejects({ features: [{ type: 'jump', at: 300, kind: 'normal', gap: 8 }] }, /must declare its own landings/);
  rejects({ features: [{ type: 'jump', at: 5, kind: 'normal' }] }, /kicker starts before the start gate/);
  rejects({ features: [{ type: 'jump', at: 1280, kind: 'normal' }] }, /runs past the end of the trail/);
  rejects({ features: [{ type: 'jump', at: 300, kind: 'normal' }, { type: 'jump', at: 320, kind: 'normal' }] },
    /jump at 320 starts before the landing of the jump at 300 ends/);
  rejects({ berms: { auto: true, startCurvature: 0.02, fullCurvature: 0.01, height: 1.7 } }, /startCurvature below fullCurvature/);
  rejects({ berms: { ...flowMonster.berms, adjust: [{ from: 660, to: 600, height: 1 }] } }, /berm adjustment needs from < to/);
  rejects({ hill: { waves: [] } }, /hill needs a grade/);
});

test('bends too tight for the ground beside the trail are refused, saying where', () => {
  // a 15 m wiggle every 47 m makes corners of about 7.5 m radius
  rejects({ centreline: [{ amp: 30, period: 15 }] }, /the bend at \d+ m is too tight \(radius \d+ m; at least 35 m for now\)/);
});

test('a reshaped jump is accepted once it declares its own landing ranges', () => {
  const trail = defineTrail(variant({ features: [{ type: 'jump', at: 300, kind: 'normal', gap: 8,
    landings: [{ pop: 0, from: 52, to: 70, outcome: 'smooth' }] }] }));
  assert.equal(trail.jumps[0].gap, 8);
  assert.deepEqual(trail.jumps[0].landings, [{ pop: 0, from: 52, to: 70, outcome: 'smooth' }]);
});

test('berm adjustments change only their stretch, blending in and out over 5 m', () => {
  const plain = defineTrail(flowMonster);
  // find a stretch with a full berm, away from jumps
  let at = 0;
  for (let s = 20; s < 1180; s += 1) if (plain.bermAmount(s) > 1.6) { at = s; break; }
  assert.ok(at > 0, 'expected a full berm somewhere');
  const from = at + 3, to = at + 13; // starts just inside the full berm, so the blend-in is measurable
  const removed = defineTrail(variant({ berms: { ...flowMonster.berms, adjust: [{ from, to, height: 0 }] } }));
  const raised = defineTrail(variant({ berms: { ...flowMonster.berms, adjust: [{ from, to, height: 2.2 }] } }));
  for (let s = from; s <= to; s += 0.5) {
    assert.equal(removed.bermAmount(s), 0, `no berm at ${s}`);
    assert.ok(Math.abs(raised.bermAmount(s) - plain.bermAmount(s) * 2.2 / 1.7) < 1e-9, `taller berm at ${s}`);
  }
  for (const s of [from - 5, from - 20, to + 5, to + 20]) assert.equal(removed.bermAmount(s), plain.bermAmount(s), `untouched at ${s}`);
  // halfway through the 5 m blend, half the berm is left
  const mid = from - 2.5;
  assert.ok(plain.bermAmount(mid) > 1.5, 'blend point is on a full berm');
  assert.ok(Math.abs(removed.bermAmount(mid) - plain.bermAmount(mid) / 2) < 1e-9, 'blends in');
});

test('berms can be switched off for a whole trail', () => {
  const flat = defineTrail(variant({ berms: { auto: false } }));
  for (let s = 0; s < 1297; s += 3) assert.equal(flat.bermAmount(s), 0);
});

/* ---------- A second, made-up trail ---------- */
const MINI = defineTrail({
  id: 'mini', name: 'Mini test trail', difficulty: 'green', length: 600, seed: 7,
  centreline: [{ amp: 10, period: 60 }],
  width: { base: 4.5, waves: [{ amp: 0.5, period: 40 }], min: 4, max: 5 },
  hill: { grade: -0.15 },
  berms: { auto: true, startCurvature: 0.004, fullCurvature: 0.008, height: 1.2 },
  start: { spawn: 2, gate: 8 },
  splits: [140, 300, 450, 600],
  features: [{ type: 'jump', at: 220, kind: 'normal' }],
  scenery: { rocky: [] },
});

test('a second trail builds its own terrain and forest', () => {
  const random = makeRandom(MINI.seed);
  const terrain = terrainData(MINI, random);
  // the detailed strip follows this trail from 20 m above its start to 80 m past its finish
  const first = MINI.locate(terrain.positions[0], terrain.positions[2]);
  const n = terrain.positions.length / 3 - 1, last = MINI.locate(terrain.positions[n * 3], terrain.positions[n * 3 + 2]);
  // (positions are stored as 32-bit floats, so allow 1 cm)
  assert.ok(Math.abs(first.s + 20) < 0.01 && Math.abs(last.s - 680) < 0.01, `strip runs ${first.s} to ${last.s}`);
  const forest = planForest(MINI, random);
  // every crashable tree stands beside this trail, off the riding line
  for (const t of Object.values(forest.treeBuckets).flat()) {
    const at = MINI.locate(t.x, t.z);
    assert.ok(at.s > -15 && at.s < 680, `tree at ${at.s} is along this trail`);
    assert.ok(Math.abs(at.off) > MINI.halfWidth(at.s) + 1.2, `tree at ${at.s} is off the trail`);
  }
});

test('the physics rides a second trail: follows its line, clears its jump, reaches its finish', () => {
  const random = makeRandom(MINI.seed);
  terrainData(MINI, random);
  const { treeBuckets } = planForest(MINI, random);
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, MINI, MINI.start.spawn, 0);
  const seen = [];
  for (let step = 0; step < 120 * 60 && b.s < MINI.length; step++) {
    // scripted rider: aim 8 m ahead on the centreline; hold about 55 km/h for the jump
    const s = b.s, target = MINI.pointAt(s + 8);
    let err = Math.atan2(target.x - b.x, b.z - target.z) - b.h;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    keys.right = err > 0.03; keys.left = err < -0.03;
    keys.pedal = b.v < 10; keys.brake = b.v > 15.5;
    const events = stepRide(b, keys, MINI, treeBuckets, true, 1 / 60);
    for (const e of events) seen.push(e.type === 'toast' ? e.text : e.type === 'crash' ? 'crash: ' + e.reason : e.type);
    assert.ok(!events.some(e => e.type === 'crash'), `crashed at ${s.toFixed(0)} m: ${seen.join(' | ')}`);
    assert.ok(Number.isFinite(b.x + b.y + b.z + b.v), 'bike state stays finite');
    const at = MINI.locate(b.x, b.z);
    assert.ok(Math.abs(at.off) < MINI.halfWidth(at.s), `stays on the trail at ${at.s.toFixed(0)} m`);
  }
  assert.ok(b.s >= MINI.length, `reached the finish (got to ${b.s.toFixed(0)} m)`);
  assert.ok(seen.includes('Sweet landing') || seen.includes('Clean landing'), `landed the jump: ${seen.join(' | ')}`);
});

test('no game module reads a particular trail: only the trail list and main.js do', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const code = readFileSync(new URL(file, dir), 'utf8');
    if (file === 'main.js') continue;
    assert.ok(!/from\s+['"][^'"]*trails\//.test(code), `${file} imports a trail directly`);
  }
});
