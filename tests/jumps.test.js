// Locks in the jump landing ranges tuned in v1. If a physics change moves them,
// these fail and we decide on purpose whether the new ranges are better.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMPS, simulate } from '../tools/jump-sim.js';

const outcomes = (j, speeds, pop = 0) => speeds.map(k => simulate(j, k, pop).outcome);
const range = (a, b) => { const r = []; for (let k = a; k <= b; k += 2) r.push(k); return r; };

test('normal jump lands smooth from 46 to 68 km/h without a pop', () => {
  for (const o of outcomes(JUMPS.normal, range(46, 68))) assert.equal(o, 'smooth');
});

test('normal jump is a big crash if far too slow or far too fast', () => {
  assert.equal(simulate(JUMPS.normal, 36).outcome, 'big crash');
  assert.equal(simulate(JUMPS.normal, 76).outcome, 'big crash');
});

test('big pop jump lands smooth from 52 to 64 km/h with a full pop', () => {
  for (const o of outcomes(JUMPS.bigPop, range(52, 64), 3)) assert.equal(o, 'smooth');
});

test('big pop jump cases without a pop at normal speeds', () => {
  for (const k of range(46, 64)) assert.notEqual(simulate(JUMPS.bigPop, k).outcome, 'smooth', `${k} km/h`);
});

test('optional-pop jump lands smooth from 52 to 66 km/h without a pop', () => {
  for (const o of outcomes(JUMPS.bigOptional, range(52, 66))) assert.equal(o, 'smooth');
});

test('optional-pop jump lands smooth from 46 to 54 km/h with a full pop', () => {
  for (const o of outcomes(JUMPS.bigOptional, range(46, 54), 3)) assert.equal(o, 'smooth');
});
