// The measured path (src/path.js): s is true distance along the winding centreline,
// offsets are square to it, and any world point can be found on it again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPath } from '../src/path.js';

const FLOW_MONSTER_WAVES = [{ amp: 22, period: 45, phase: 0 }, { amp: 8, period: 23, phase: 1 }];
const path = createPath(FLOW_MONSTER_WAVES, -80, 1500);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('s is distance along the path: 1 m of s is 1 m of riding, even on bends', () => {
  for (let s = -20; s < 1300; s += 7.3) {
    const a = path.pointAt(s), b = path.pointAt(s + 0.1);
    near(Math.hypot(b.x - a.x, b.z - a.z), 0.1, 1e-6, `0.1 m step at s = ${s}`);
  }
  // Flow Monster straight down the hill is 1200 m; along its winding path it is 1297.45 m
  near(path.pathAt(1200), 1297.45, 0.01, 'Flow Monster path length');
});

test('converting between s and downhill distance is exact both ways', () => {
  for (let s = -30; s < 1350; s += 11.1) near(path.pathAt(path.downhillAt(s)), s, 1e-9, `s = ${s}`);
});

test('offsets are square to the path, and locate() finds every point again', () => {
  for (let s = -10; s < 1300; s += 3.7) {
    const c = path.pointAt(s), h = path.headingAt(s);
    for (const off of [-30, -12, -3, 0, 2.5, 9, 30]) {
      const q = path.pointAt(s, off);
      // the offset runs along the right-hand direction (cos h, sin h)
      near((q.x - c.x) * Math.cos(h) + (q.z - c.z) * Math.sin(h), off, 1e-9, `offset at s = ${s}`);
      near((q.x - c.x) * Math.sin(h) - (q.z - c.z) * Math.cos(h), 0, 1e-9, `square to the path at s = ${s}`);
      const found = path.locate(q.x, q.z);
      near(found.s, s, 1e-6, `locate s at s = ${s}, off = ${off}`);
      near(found.off, off, 1e-6, `locate off at s = ${s}, off = ${off}`);
    }
  }
});

test('locate() finds the nearest point of the path even far out on the inside of a bend', () => {
  for (let i = 0; i < 2000; i++) {
    const x = Math.sin(i * 1.7) * 90, z = -((i * 0.71) % 1300);
    const found = path.locate(x, z), p = path.pointAt(found.s);
    const dist = Math.hypot(x - p.x, z - p.z);
    near(Math.abs(found.off), dist, 1e-6, `offset is the distance at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    // no point of the path is closer (checked every 0.25 m within reach)
    for (let s = found.s - 100; s <= found.s + 100; s += 0.25) {
      const o = path.pointAt(s);
      assert.ok(Math.hypot(x - o.x, z - o.z) >= dist - 1e-3, `closer point at s = ${s} for (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
});

test('curvature matches the bend of the path', () => {
  // turning rate of the heading per metre of path is the curvature
  for (let s = 5; s < 1290; s += 13) {
    const turn = (path.headingAt(s + 0.01) - path.headingAt(s - 0.01)) / 0.02;
    near(turn, path.curvatureAt(s), 1e-6, `curvature at s = ${s}`);
  }
});
