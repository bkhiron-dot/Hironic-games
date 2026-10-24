// Checks that the Hardline trail (src/trails/hardline.js, built by src/trail.js) matches v1 exactly.
// The v1 track code is read straight out of public/v1.html and run here, so if
// anyone changes the v2 track by accident, this fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRandom } from '../src/util.js';
import { HARDLINE } from '../src/trails/index.js';

const { cx, cxd, halfWidth, curvature, kickerAt, jumpZone, bermAmount, ground, jumps: JUMPS, seed: TRACK_SEED } = HARDLINE;

function loadV1Track() {
  const html = readFileSync(new URL('../public/v1.html', import.meta.url), 'utf8');
  const start = html.indexOf('/* ---------- Track definition ---------- */');
  const end = html.indexOf('/* ---------- Renderer & scene ---------- */');
  assert.ok(start > 0 && end > start, 'track section markers not found in public/v1.html');
  const code = html.slice(start, end);
  return new Function(`${code}\nreturn { cx, cxd, hw, curv, ground, jumpZone, kickerOf, bermAmt, JUMPS, rng };`)();
}

const v1 = loadV1Track();

// Sample points: every 0.37 m down the track (an odd step, so samples land all over
// jumps and berms), at offsets from the centreline out into the forest on both sides.
const DISTANCES = [];
for (let s = -20; s <= 1280; s += 0.37) DISTANCES.push(s);
const OFFSETS = [-60, -20, -6, -4, -2.5, -1, 0, 0.7, 2, 3.3, 5, 8, 25, 60];

test('centreline, width and curvature match v1', () => {
  for (const s of DISTANCES) {
    assert.equal(cx(s), v1.cx(s), `cx at ${s}`);
    assert.equal(cxd(s), v1.cxd(s), `cxd at ${s}`);
    assert.equal(halfWidth(s), v1.hw(s), `half width at ${s}`);
    assert.equal(curvature(s), v1.curv(s), `curvature at ${s}`);
  }
});

test('ground height matches v1 everywhere', () => {
  let checked = 0;
  for (const s of DISTANCES) for (const off of OFFSETS) {
    assert.equal(ground(s, off), v1.ground(s, off), `ground at s=${s}, off=${off}`);
    checked++;
  }
  assert.ok(checked > 40000);
});

test('jump zones, kickers and berms match v1', () => {
  for (const s of DISTANCES) {
    assert.equal(jumpZone(s), v1.jumpZone(s), `jump zone at ${s}`);
    const k = kickerAt(s), k1 = v1.kickerOf(s);
    assert.equal(k?.u, k1?.u, `kicker at ${s}`);
    assert.equal(bermAmount(s), v1.bermAmt(s), `berm at ${s}`);
  }
});

test('jump definitions match v1', () => {
  assert.equal(JUMPS.length, v1.JUMPS.length);
  // every number v1 had (shape, flags, position); v2 jumps also carry their kind and landing ranges
  JUMPS.forEach((j, i) => {
    for (const [key, value] of Object.entries(v1.JUMPS[i])) assert.equal(j[key], value, `jump ${i} ${key}`);
  });
});

test('seeded random numbers match v1, so the forest grows in the same places', () => {
  const ours = makeRandom(TRACK_SEED), theirs = v1.rng(TRACK_SEED);
  for (let i = 0; i < 100000; i++) assert.equal(ours(), theirs());
});
