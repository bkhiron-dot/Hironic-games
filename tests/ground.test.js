// The ground with s measured along the winding path (roadmap step 2b):
// Hardline keeps v1's shape on the hill, the ground has no cliffs (even on the inside of the
// tightest bends), and the forest never grows on the trail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HARDLINE as T } from '../src/trails/index.js';
import { makeRandom } from '../src/util.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';

// v1's track code, read straight out of public/v1.html (the reference build).
function loadV1Track() {
  const html = readFileSync(new URL('../public/v1.html', import.meta.url), 'utf8');
  const start = html.indexOf('/* ---------- Track definition ---------- */');
  const end = html.indexOf('/* ---------- Renderer & scene ---------- */');
  assert.ok(start > 0 && end > start, 'track section markers not found in public/v1.html');
  return new Function(`${html.slice(start, end)}\nreturn { cx, ground, JUMPS };`)();
}

// Is s on (or within `margin` of) a jump, from the start of its kicker to the end of its landing?
const onJump = (s, margin) => T.jumps.some(j => s > j.s - j.kick - margin && s < j.end + margin);

test('Hardline keeps v1 shape on the hill: same centreline, and the riding line at v1 height away from jumps', () => {
  const v1 = loadV1Track();
  // The last jump was reshaped in tuning round 2 (lower knuckle, steeper landing), so after it
  // the trail sits lower than v1 by a fixed amount, but keeps v1's shape.
  const last = T.jumps[T.jumps.length - 1];
  let checked = 0, offsetAfterLast = null;
  for (let s = 0; s < T.length; s += 0.83) {
    const p = T.pointAt(s), d = -p.z;
    assert.ok(Math.abs(p.x - v1.cx(d)) < 1e-9, `centreline at s = ${s}`);
    // v1 measured jumps straight down the hill, so its jumps sit slightly differently: skip them
    const v1Jump = v1.JUMPS.some(j => d > j.s - j.kick - 3 && d < j.s + j.gap + j.land + 3);
    if (onJump(s, 3) || v1Jump) continue;
    let diff = T.ground(s, 0) - v1.ground(d, 0);
    if (s > last.end) {
      if (offsetAfterLast === null) offsetAfterLast = diff;
      diff -= offsetAfterLast;
    }
    assert.ok(Math.abs(diff) < 1e-6, `riding line at s = ${s.toFixed(1)}: ${diff} m from v1`);
    checked++;
  }
  assert.ok(checked > 1000, `only ${checked} points checked`);
  console.log(`  after the reshaped last jump the trail is ${(-offsetAfterLast).toFixed(2)} m lower than v1`);
});

test('the trail is its full width square to the path, on bends too', () => {
  for (let s = 0; s < T.length; s += 9.1) {
    const w = T.halfWidth(s), left = T.pointAt(s, -w), right = T.pointAt(s, w);
    assert.ok(Math.abs(Math.hypot(right.x - left.x, right.z - left.z) - 2 * w) < 1e-9, `width at ${s}`);
  }
});

// Largest height change between neighbouring points 0.5 m apart, over a world square, as a
// share of what is allowed there: berm walls rise up to 1.7 m across a 2.3 m half width
// (v1's steepest, about 0.74 m per 0.5 m), so on the trail and berms 0.8 m is allowed,
// and 0.5 m everywhere else. A result above 1 is a cliff.
function steepestStep(cx0, cz0, half) {
  let worst = { step: 0 };
  const STEP = 0.5, n = Math.round(2 * half / STEP);
  let prevRow = null;
  for (let r = 0; r <= n; r++) {
    const z = cz0 - half + r * STEP, row = new Float64Array(n + 1), skip = new Uint8Array(n + 1);
    for (let c = 0; c <= n; c++) {
      const x = cx0 - half + c * STEP, at = T.locate(x, z);
      row[c] = T.groundAt(x, z);
      // jump lips and holes are steep on purpose, right across the trail and its banks
      skip[c] = onJump(at.s, 2) && Math.abs(at.off) < T.halfWidth(at.s) + 21 ? 1 : 0;
      const allowed = Math.abs(at.off) < T.halfWidth(at.s) + 2.5 ? 0.8 : 0.5;
      const check = (h, where) => { const step = Math.abs(row[c] - h) / allowed; if (step > worst.step) worst = { step, x, z, where }; };
      if (c > 0 && !skip[c] && !skip[c - 1]) check(row[c - 1], 'across');
      if (prevRow && !skip[c] && !prevRow.skip[c]) check(prevRow.h[c], 'down');
    }
    prevRow = { h: row, skip };
  }
  return worst;
}

test('no cliffs anywhere near the 4 tightest bends, including far inside them', () => {
  // find the tightest bends (local peaks of curvature) and look around each centre of curvature
  const bends = [];
  for (let s = 5; s < T.length - 5; s += 1) {
    const k = Math.abs(T.curvature(s));
    if (k > Math.abs(T.curvature(s - 1)) && k >= Math.abs(T.curvature(s + 1))) bends.push({ s, k });
  }
  bends.sort((a, b) => b.k - a.k);
  for (const { s, k } of bends.slice(0, 4)) {
    const r = 1 / k, centre = T.pointAt(s, Math.sign(T.curvature(s)) * r); // centre of curvature
    const worst = steepestStep(centre.x, centre.z, 60);
    assert.ok(worst.step < 1, `bend at ${s} m (radius ${r.toFixed(0)} m): step ${worst.step.toFixed(2)}x the allowed size, ${worst.where} at (${worst.x}, ${worst.z})`);
    console.log(`  bend at ${s} m, radius ${r.toFixed(0)} m: steepest step ${(worst.step * 100).toFixed(0)}% of allowed`);
  }
});

test('no cliffs across the trail and out to 60 m either side, all the way down', () => {
  for (let s = -15; s < T.length + 60; s += 6.1) {
    if (onJump(s, 2)) continue;
    let prev = null, worst = 0, at = 0;
    for (let off = -60; off <= 60; off += 0.25) {
      const p = T.pointAt(s, off), h = T.groundAt(p.x, p.z);
      if (prev !== null && Math.abs(h - prev) > worst) { worst = Math.abs(h - prev); at = off; }
      prev = h;
    }
    assert.ok(worst < 0.5, `across the trail at ${s.toFixed(1)} m: ${worst.toFixed(2)} m step at offset ${at}`);
  }
});

test('no tree, fern, bush or rock grows on the trail; gum count matches v1 for the longer path', () => {
  const random = makeRandom(T.seed);
  terrainData(T, random);
  const plan = planForest(T, random);
  for (const [kind, gap] of [['trunks', 1.2], ['fernTrunks', 0.4], ['bushes', 2.5], ['rocks', 0.6]]) {
    for (const chunk of Object.values(plan.chunks)) for (const it of chunk[kind]) {
      const at = T.locate(it.x, it.z);
      assert.ok(Math.abs(at.off) >= T.halfWidth(at.s) + gap - 1e-9, `${kind} at s = ${at.s.toFixed(1)} is ${Math.abs(at.off).toFixed(2)} m from the centreline`);
    }
  }
  const gums = Object.values(plan.treeBuckets).flat().length;
  // v1 grew 1901 gums along 1270 m; the path is 8% longer, so expect about 2050
  assert.ok(gums > 1900 && gums < 2200, `${gums} gums`);
});
