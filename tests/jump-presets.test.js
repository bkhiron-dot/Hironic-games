// The jump numbers live in two places for now: the game track (src/trail.js) and the
// jump simulator presets (tools/jump-sim.js) that the landing-range tests use.
// This keeps them in step until roadmap step 2 makes the simulator read the Trail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMPS as TRACK_JUMPS } from '../src/trail.js';
import { JUMPS as SIM_PRESETS } from '../tools/jump-sim.js';

const SHAPE = ['kick', 'lip', 'gap', 'hole', 'knuck', 'pitch', 'land'];
const shapeOf = j => Object.fromEntries(SHAPE.map(k => [k, j[k]]));
const at = s => TRACK_JUMPS.find(j => j.s === s);

test('normal jumps (170 m, 690 m) match the simulator preset', () => {
  assert.deepEqual(shapeOf(at(170)), shapeOf(SIM_PRESETS.normal));
  assert.deepEqual(shapeOf(at(690)), shapeOf(SIM_PRESETS.normal));
});

test('pop-optional jump (410 m) matches the simulator preset', () => {
  assert.deepEqual(shapeOf(at(410)), shapeOf(SIM_PRESETS.bigOptional));
});

test('big pop jump (960 m) matches the simulator preset', () => {
  assert.deepEqual(shapeOf(at(960)), shapeOf(SIM_PRESETS.bigPop));
});
