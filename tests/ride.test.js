// Rides the game's own physics (src/physics.js) on the Flow Monster trail:
// - every jump, at chosen speeds at the lip, lands the way its kind declares (the ranges
//   the jump simulator checks), so the game and the simulator agree;
// - a scripted rider gets from the start gate to the finish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T, rideJump, rideTrail } from './helpers/ride.js';

const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 2) r.push(k); return r; };

for (const j of T.jumps) {
  for (const landing of j.landings) {
    const { pop, from, to, outcome } = landing;
    // Declared ranges come from a straight test trail; on Flow Monster the bends and the hill under
    // each jump move range edges a little. So check the declared range 2 km/h in from each edge
    // (single-speed checks, like "small crash at 76 km/h", are checked as they are).
    const lo = to - from >= 4 ? from + 2 : from, hi = to - from >= 4 ? to - 2 : to;
    test(`in the game, ${T.name} jump at ${j.s} m (${j.kind}) lands ${outcome} from ${lo} to ${hi} km/h ${pop ? 'with a pop' : 'without a pop'}`, () => {
      const seen = [];
      for (const kmh of speeds(lo, hi)) {
        const r = rideJump(j, kmh, pop);
        seen.push(`${kmh}: ${r.outcome}`);
        assert.ok(Math.abs(r.lipKmh - kmh) < 0.5, `couldn't hit ${kmh} km/h at the lip (got ${r.lipKmh?.toFixed(1)})`);
        if (outcome === 'not smooth') assert.notEqual(r.outcome, 'smooth', `${kmh} km/h`);
        else assert.equal(r.outcome, outcome, `${kmh} km/h (${r.why || ''}); so far: ${seen.join(', ')}`);
      }
    });
  }
}

test('the first jump lands smooth at the speed you reach it from a rolling start (about 66 km/h), with or without a pop', () => {
  assert.equal(rideJump(T.jumps[0], 66, 0).outcome, 'smooth', 'no pop');
  assert.equal(rideJump(T.jumps[0], 66, 3).outcome, 'smooth', 'full pop');
});

test('a scripted rider gets from the start to the finish, through every split, without crashing', () => {
  const run = rideTrail();
  assert.equal(run.crash, null, `crashed: ${run.crash?.reason} at ${run.crash?.s.toFixed(0)} m`);
  assert.deepEqual(run.splitsPassed, T.splits, 'passed every split');
  const report = run.landings.map(l => `${l.at} m: ${l.zone}, ${l.outcome}`).join('; ');
  assert.deepEqual(run.landings.map(l => l.at), T.jumps.map(j => j.s), `landed every jump (${report})`);
  for (const l of run.landings) assert.equal(l.outcome, 'smooth', `jump at ${l.at} m (${report})`);
  console.log(`  finish in ${run.time.toFixed(1)} s; ${report}`);
});
