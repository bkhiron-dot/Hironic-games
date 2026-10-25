// Berm hits: drift wide into a berm and it catches you hard ("Berm hit!"): the bike swings
// round to run along the berm and keeps its speed. Ridden on Flow Monster's berms with the
// game's own physics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_MONSTER as T } from '../src/trails/index.js';
import { createBikeState, placeBikeAt, placeBikeAtPoint, stepRide } from '../src/physics.js';
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
      const r = rideIntoBerm(at, kmh, 0.9, 8); // drifting high: past the catch line (60% of the berm's height)
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

/* ---------- Berm catch line and hold (Ben, 3b playtests) ----------
   Slide wide from the inside half of the trail onto a berm. Steering into the corner, you keep
   understeering and drifting up the berm until about 60% of its height, where it catches you
   (a berm hit) and holds you: the bike comes round to run along it. Not steering, or steering
   the wrong way, you drift out over the top. */
const corners = [];
for (let s = 150; s < 1280; s++) if (T.bermAmount(s) > 1.5 && !(corners.length && s - corners.at(-1) < 40)) corners.push(s);

// Start where the berm is 1 m high, on the inside half, pointing `outDeg` out of the corner and
// already sliding wide at `slip` m/s. Returns the highest point reached up the berm and where the
// berm hit happened, both as a share of the berm's height (1 = the top edge), and any crash.
function slideOntoBerm(at, kmh, outDeg, slip, steering) {
  const corner = Math.sign(T.curvature(at));
  let s0 = at;
  for (let s = at - 30; s < at; s++) if (T.bermAmount(s) > 1.0) { s0 = s; break; }
  const p = T.pointAt(s0, corner * T.halfWidth(s0) * 0.3);
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAtPoint(b, T, p.x, p.z, T.headingAt(s0) - corner * outDeg * Math.PI / 180, kmh / 3.6);
  const f = [Math.sin(b.h), -Math.cos(b.h)];
  b.vy = (T.groundAt(p.x + f[0] * 0.6, p.z + f[1] * 0.6) - b.y) / 0.6 * b.v; // already following the slope
  const dir = { into: corner, none: 0, wrong: -corner }[steering];
  Object.assign(b, { slipV: -corner * slip, slideMem: 1, slidePeak: 0.6, steerIn: dir, lean: dir * 0.8 });
  keys.right = dir > 0; keys.left = dir < 0;
  let highest = 0, hitAt = null, crash = null, slideAfterHit = 0, sinceHit = 0;
  const rail = { low: 1, high: 0, drift: 0, offLine: 0 }; // from 0.3 s after the hit, while on the full berm
  for (let step = 0; step < 3 / DT && b.s < s0 + 40; step++) {
    const events = stepRide(b, keys, T, {}, true, DT);
    crash = events.find(e => e.type === 'crash') || crash;
    if (crash) break;
    const L = T.locate(b.x, b.z), out = Math.max(0, L.off * -Math.sign(T.curvature(L.s)) / T.halfWidth(L.s));
    const level = out * out; // the berm wall rises as (distance out / half width)^2
    highest = Math.max(highest, level);
    if (hitAt === null && events.some(e => e.type === 'bermHit')) hitAt = level;
    else if (hitAt !== null && b.sliding && level > 0) slideAfterHit += DT; // sliding again while still on the berm
    if (hitAt !== null && (sinceHit += DT) > 0.3 && T.bermAmount(L.s) > 1.5) {
      let offLine = T.headingAt(L.s) - b.h; offLine = Math.abs(Math.atan2(Math.sin(offLine), Math.cos(offLine)));
      Object.assign(rail, { low: Math.min(rail.low, level), high: Math.max(rail.high, level),
        drift: Math.max(rail.drift, Math.abs(b.drift)), offLine: Math.max(rail.offLine, offLine) });
    }
  }
  return { highest, hitAt, crash, slideAfterHit, rail };
}

test('sliding wide onto a berm while steering into the corner: drift up to 60% of its height, hit, held below the top', () => {
  let runs = 0, hits = 0;
  for (const at of corners) for (const kmh of [50, 60, 70]) for (const outDeg of [10, 25]) {
    const where = `berm at ${at}, ${kmh} km/h, ${outDeg} deg out`;
    const r = slideOntoBerm(at, kmh, outDeg, 2, 'into');
    runs++;
    assert.equal(r.crash, null, `${where}: no crash`);
    assert.ok(r.highest < 1, `${where}: held below the top (got to ${r.highest.toFixed(2)} of the height)`);
    if (r.hitAt === null) continue; // a gentle slide can fade out before the catch line: no hit
    hits++;
    assert.ok(r.hitAt >= 0.55 && r.hitAt < 0.7, `${where}: berm hit at the catch line (got ${r.hitAt.toFixed(2)})`);
  }
  assert.ok(hits >= 0.8 * runs, `berm hits in ${hits} of ${runs}`);
});

test('not steering, or steering the wrong way, you can still drift out over the berm', () => {
  for (const steering of ['none', 'wrong']) {
    let over = 0, runs = 0;
    for (const at of corners) for (const kmh of [55, 70]) { runs++; if (slideOntoBerm(at, kmh, 25, 2, steering).highest > 1.5) over++; }
    assert.ok(over >= 0.8 * runs, `${steering}: out over the top in ${over} of ${runs}`);
  }
});

test('after a berm hit the tyres grip again: the berm guides you round without sliding', () => {
  const after = [];
  for (const at of corners) for (const kmh of [50, 60, 70]) for (const outDeg of [10, 25]) {
    const r = slideOntoBerm(at, kmh, outDeg, 2, 'into');
    if (r.hitAt !== null) after.push(r.slideAfterHit);
  }
  after.sort((a, b) => a - b);
  // Before the tyres hooked up at the hit, the bike slid on along the berm for 1.5 s (median; worst
  // 2.2 s). This rider holds full lock all the way, so at the berm's foot it can still slip a little.
  const median = after[after.length >> 1], worst = after.at(-1);
  assert.ok(median < 0.25, `median slide on the berm after the hit ${median.toFixed(2)} s`);
  assert.ok(worst < 0.5, `worst slide on the berm after the hit ${worst.toFixed(2)} s`);
});

// Same bike, same place, one step apart from how it's turning: a slide sideways washes off speed,
// leaning within grip doesn't.
function oneSecond(slipV, lean) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, T, 100, 55 / 3.6);
  const ahead = T.pointAt(b.s + 0.6);
  b.vy = (T.groundAt(ahead.x, ahead.z) - b.y) / 0.6 * b.v;
  b.slipV = slipV;
  for (let step = 0; step < 1 / DT; step++) { b.lean = lean; b.steerIn = 0; stepRide(b, keys, T, {}, true, DT); }
  return b.v * 3.6;
}

test('drifting washes off speed; cornering with grip does not', () => {
  const straight = oneSecond(0, 0), drift = oneSecond(3, 0), grip = oneSecond(0, 0.15);
  // 3 m/s of slip at 55 km/h, fading as the tyres hook up, costs 0.44 km/h in a second (was 0):
  // a light cost (Ben: rolling with grip should just feel a bit faster)
  assert.ok(straight - drift > 0.3, `drift costs ${(straight - drift).toFixed(2)} km/h`);
  // leaning within grip (0.15 rad asks for 1.5 m/s^2; tyres give 7.4) turns the bike onto a
  // slightly different slope (0.002 km/h), but nothing is scrubbed
  assert.ok(Math.abs(straight - grip) < 0.05, `grip cornering costs ${(straight - grip).toFixed(2)} km/h`);
});

test('after a berm hit, steering in, the bike rails the berm: straight, on the corner\'s line, holding its height', () => {
  let railed = 0;
  for (const at of corners) for (const kmh of [50, 60, 70]) for (const outDeg of [10, 25]) {
    const r = slideOntoBerm(at, kmh, outDeg, 2, 'into'), where = `berm at ${at}, ${kmh} km/h, ${outDeg} deg out`;
    if (r.hitAt === null || r.rail.high === 0) continue;
    railed++;
    // drawn drift angle gone (it was 10-20 degrees on after a hit), pointing along the corner
    assert.ok(r.rail.drift < 0.05, `${where}: drawn drift ${(r.rail.drift * 57.3).toFixed(1)} deg`);
    assert.ok(r.rail.offLine < 0.1, `${where}: ${(r.rail.offLine * 57.3).toFixed(1)} deg off the corner's line`);
    // stays up on the berm: doesn't dive off it to the inside, or ride up over the top
    assert.ok(r.rail.low > 0.35 && r.rail.high < 0.95, `${where}: held between ${r.rail.low.toFixed(2)} and ${r.rail.high.toFixed(2)} of the height`);
  }
  assert.ok(railed >= 40, `railed ${railed} corners`);
});
