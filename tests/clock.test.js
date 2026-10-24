// The fixed-step physics clock (src/clock.js): physics moves in the same 1/240 s steps
// whatever the frame rate, so the same ride gives exactly the same result on every device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhysicsClock, PHYSICS_STEP, MAX_CATCH_UP } from '../src/clock.js';
import { T, treeBuckets, steerAlongTrail } from './helpers/ride.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';

test('runs one physics step per 1/240 s of frame time, carrying the leftover to the next frame', () => {
  for (const fps of [30, 60, 75, 144]) {
    const clock = createPhysicsClock();
    let steps = 0;
    for (let f = 0; f < fps * 10; f++) steps += clock.advance(1 / fps, () => {});
    // 10 seconds of frames is 2400 steps (give or take the last one, from rounding)
    assert.ok(Math.abs(steps - 2400) <= 1, `${fps} fps: ${steps} steps in 10 s`);
  }
});

test('after a long pause it catches up at most 0.1 s, so the bike never jumps ahead', () => {
  const clock = createPhysicsClock();
  const steps = clock.advance(2.5, () => {}); // e.g. the phone switched apps for 2.5 s
  assert.equal(steps, Math.floor(MAX_CATCH_UP / PHYSICS_STEP + 1e-9));
  assert.equal(clock.advance(-1, () => {}), 0, 'a clock going backwards does nothing');
});

// A scripted ride where every decision is made inside the physics step, as a rider's hands
// would be. Frames only decide how steps are grouped.
function rideAtFrameRate(frameTimes, totalSteps) {
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  placeBikeAt(b, T, T.start.spawn, 0);
  const clock = createPhysicsClock();
  let done = 0, f = 0;
  const step = dt => {
    if (done >= totalSteps) return;
    keys.pedal = b.v < 15;
    keys.brake = b.v > 16.5;
    const k = T.kickerAt(b.s);
    if (b.air || k) keys.left = keys.right = false; else steerAlongTrail(b, keys);
    keys.hop = !!(k && k.u < -b.v * dt);
    stepRide(b, keys, T, treeBuckets, true, dt);
    done++;
  };
  while (done < totalSteps) clock.advance(frameTimes[f++ % frameTimes.length], step);
  return b;
}

test('the same ride ends in exactly the same place at 30, 60 and 144 fps, and with uneven frames', () => {
  const steps = 240 * 40; // 40 seconds of riding, over the first two jumps
  const reference = rideAtFrameRate([1 / 60], steps);
  assert.ok(reference.s > 400, `got to ${reference.s.toFixed(0)} m`);
  for (const [name, frames] of [['30 fps', [1 / 30]], ['144 fps', [1 / 144]], ['uneven', [0.013, 0.021, 0.0167, 0.04, 0.009]]]) {
    const b = rideAtFrameRate(frames, steps);
    for (const key of ['x', 'y', 'z', 's', 'v', 'h', 'lean']) assert.equal(b[key], reference[key], `${name}: ${key}`);
  }
});
