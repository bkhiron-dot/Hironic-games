// Fixed-step clock for the physics. Screens refresh at different rates (30, 60, 120,
// 144 frames a second...), but the physics always moves forward in the same small steps,
// so a jump lands the same way on every phone and laptop, and run times are fair.
// Each frame runs as many steps as the time that passed needs; part of a step left over
// waits for the next frame.

export const PHYSICS_STEP = 1 / 240; // seconds per physics step (agreed with Ben)
export const MAX_CATCH_UP = 0.1;     // after a hiccup, catch up at most this much (s): the
                                     // game pauses for a moment rather than jumping ahead

export function createPhysicsClock(step = PHYSICS_STEP, maxCatchUp = MAX_CATCH_UP) {
  let owed = 0; // time not yet simulated (s)
  // Runs stepFn(step) as many times as frameSeconds needs. Returns how many steps ran.
  function advance(frameSeconds, stepFn) {
    owed += Math.min(Math.max(frameSeconds, 0), maxCatchUp);
    let steps = 0;
    while (owed >= step) {
      stepFn(step);
      owed -= step;
      steps++;
    }
    return steps;
  }
  return { advance };
}
