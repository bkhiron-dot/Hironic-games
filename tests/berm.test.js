// Berm hits: drift wide into a berm and it catches you hard ("Berm hit!"): the bike swings
// round to run along the berm and keeps its speed. Ridden on Flow Monster's berms with the
// game's own physics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_MONSTER as T } from '../src/trails/index.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';
import { DT } from './helpers/ride.js';

// Ride from 30 m before berm `at`, starting at `kmh`, steering at a point `look` m ahead on
// a line `wide` (share of the half width) toward the outside of the bend. Returns what happened.
function rideIntoBerm(at, kmh, wide, look = 5) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, T, at - 30, kmh / 3.6);
  // already moving: start following the slope, rather than dropped onto it (as the jump simulator does)
  const ahead = T.pointAt(b.s + 0.6);
  b.vy = (T.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * b.v;
  let hit = null, crash = null;
  for (let step = 0; step < 3 / DT && b.s < at + 40; step++) {
    const ahead = b.s + look, target = T.pointAt(ahead, -Math.sign(T.curvature(ahead)) * T.halfWidth(ahead) * wide);
    let err = Math.atan2(target.x - b.x, b.z - target.z) - b.h;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    keys.right = err > 0.03; keys.left = err < -0.03;
    const v = b.v, h = b.h;
    const events = stepRide(b, keys, T, {}, true, DT);
    const e = events.find(ev => ev.type === 'bermHit');
    const off = hd => Math.abs(Math.atan2(Math.sin(T.headingAt(b.s) - hd), Math.cos(T.headingAt(b.s) - hd)));
    if (e && !hit) hit = { ...e, vBefore: v, vAfter: b.v, offBefore: off(h), offAfter: off(b.h) };
    crash = events.find(ev => ev.type === 'crash') || crash;
    if (crash) break;
  }
  const end = T.locate(b.x, b.z);
  return { hit, crash, onTrail: Math.abs(end.off) <= T.halfWidth(end.s) + 0.3 };
}

test('drifting wide into a berm is a berm hit: the bike swings round the corner and keeps its speed', () => {
  let hits = 0;
  for (const at of [338, 534, 646, 845, 955, 1157]) {
    for (const kmh of [45, 55]) {
      const r = rideIntoBerm(at, kmh, 0.6, 8);
      if (!r.hit) continue;
      hits++;
      // no speed lost to the hit (the same step also has slope and drag: under 0.02 m/s)
      assert.ok(r.hit.vAfter >= r.hit.vBefore - 0.02, `berm at ${at}, ${kmh} km/h: no speed lost (${r.hit.vBefore.toFixed(3)} -> ${r.hit.vAfter.toFixed(3)} m/s)`);
      assert.ok(r.hit.strength > 0.3 && r.hit.strength <= 1, 'strength 0.3 to 1');
      // the bike ends up pointing closer to the berm's direction (allowing one step of
      // ordinary turning, at most 2.6 rad/s x 1/240 s = 0.011 rad)
      assert.ok(r.hit.offAfter <= r.hit.offBefore + 0.011, `berm at ${at}: swings round the corner (${r.hit.offBefore.toFixed(3)} -> ${r.hit.offAfter.toFixed(3)} rad)`);
      assert.equal(r.crash, null, `berm at ${at}, ${kmh} km/h: no crash`);
      assert.ok(r.onTrail, `berm at ${at}, ${kmh} km/h: still on the trail`);
    }
  }
  assert.ok(hits >= 6, `expected berm hits on most of these (got ${hits} of 12)`);
});

test('riding a berm without drifting is not a hit', () => {
  for (const at of [338, 534, 646, 845]) assert.equal(rideIntoBerm(at, 35, 0.3, 8).hit, null, `berm at ${at}`);
});
