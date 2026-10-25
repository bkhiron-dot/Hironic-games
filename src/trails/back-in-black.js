// Back in Black (black): steeper and narrower, and every feature is a mandatory gap: gap jumps,
// step-downs (the landing is lower than the lip) and step-ups (the landing is higher). No B lines,
// smooth dirt on the line. Agreed with Ben, 24-25 Oct (see docs/v2-trailhead-spec.md).
//
// Distances along the trail (length, start, splits, features) are metres ALONG the winding path.
// Every feature is a mandatory gap: come in too slow and you case it. Each one has a smooth
// window without a pop and a lower one with a full pop that join up, so at any speed in its
// range there's a way to land it: fast, ride it; slower, pop it. Speeds are at the lip, km/h,
// measured where each one is on the trail (the simulator rides the trail itself). The shapes are Flow Monster's first jump
// (kicker 12 m, gap 8.5 m, landing 38 m, which lands smooth over a wide range of speed) with the
// landing moved: lower for a step-down, higher for a step-up.
const GAP = { kind: 'normal', kick: 12, lip: 1.1, gap: 8.5, hole: -1, knuck: 1, pitch: 0.3, land: 38,
  short: 7.8, sweet0: 8, sweet1: 25, long: 28,
  landings: [
    { pop: 0, from: 64, to: 88, outcome: 'smooth' },
    { pop: 3, from: 50, to: 68, outcome: 'smooth' },
    { pop: 0, from: 40, to: 56, outcome: 'big crash' }, // too slow without a pop: cased
  ] };
// Step-up: the landing's knuckle is 0.6 m above the lip.
const STEP_UP = { kind: 'normal', kick: 12, lip: 1.4, gap: 9, hole: -1, knuck: 2, pitch: 0.35, land: 40,
  short: 8.8, sweet0: 9.2, sweet1: 25, long: 29,
  landings: [
    { pop: 0, from: 72, to: 86, outcome: 'smooth' },
    { pop: 3, from: 50, to: 70, outcome: 'smooth' },
    { pop: 0, from: 40, to: 62, outcome: 'big crash' }, // short of the higher landing
  ] };
// Step-down: the landing's knuckle is 1.5 m below the lip, and the landing is long and steep.
const STEP_DOWN = { kind: 'normal', kick: 12, lip: 0.9, gap: 8, hole: -2, knuck: -0.6, pitch: 0.45, land: 48,
  short: 7.8, sweet0: 9, sweet1: 24, long: 28,
  landings: [
    { pop: 0, from: 62, to: 76, outcome: 'smooth' },
    { pop: 3, from: 56, to: 62, outcome: 'smooth' },
    { pop: 0, from: 40, to: 44, outcome: 'big crash' },
  ] };
// A smaller, slower step-down: knuckle 1.7 m below a 0.7 m lip, steeper landing.
const DROP = { kind: 'normal', kick: 10, lip: 0.7, gap: 7, hole: -2.5, knuck: -1, pitch: 0.55, land: 44,
  short: 6.8, sweet0: 8, sweet1: 23, long: 27,
  landings: [
    { pop: 0, from: 56, to: 70, outcome: 'smooth' },
    { pop: 3, from: 48, to: 56, outcome: 'smooth' },
    { pop: 0, from: 80, to: 90, outcome: 'big crash' }, // far too fast: past the landing
  ] };

export default {
  id: 'back-in-black',
  name: 'Back in Black',
  difficulty: 'black',
  length: 1234.5,
  seed: 20261026,

  // From the trailhead's right-hand gate it heads out to the right (east), then runs nearly
  // straight down the mountain with gentle wiggles (bends no tighter than 97 m radius), and back
  // in to the finish clearing's right-hand gate: 1234.5 m to ride, 1204 m straight down, at
  // least 61 m from Flow Monster except near the clearings. (Laid out like Jolly Green Giant's.)
  centreline: {
    x0: 5.967,
    shifts: [
      { at: 0.1, by: 23.427, over: 30.465 },
      { at: 41.844, by: 59.418, over: 40.869 },
      { at: 1069.378, by: -47.696, over: 45.566 },
      { at: 1204, by: -6.546, over: 18.857 },
    ],
    waves: [{ amp: 5.197, period: 40.693, phase: -3.1425, from: 127.877, to: 1050, fade: 115.75 }],
  },
  // Narrow: half width 2.2-3.6 m (Flow Monster 2.3-5.4).
  width: { base: 2.8, waves: [{ amp: 0.6, period: 50, phase: 0.8 }], min: 2.2, max: 3.6 },
  // On the shared mountain (src/world.js): the same hill as Flow Monster, nearly straight down it.
  hill: { mountain: true },
  // Berms on the corners like Flow Monster's (capped at 0.85 x half width on the narrowest bends).
  berms: { auto: true, startCurvature: 0.008, fullCurvature: 0.016, height: 2.0, adjust: [] },

  start: { spawn: -6, gate: 0.3 }, // its gate in the trailhead clearing
  splits: [380, 660, 950, 1234.5], // each clear of the jumps

  // Seven mandatory gaps (on the shared mountain the jumps' drops are paid back on the stretches
  // between them, so there is room for fewer than the nine it had on a hill of its own). Riding
  // flat out and choosing pop or no pop like a rider, you reach the lips at the speeds below
  // (km/h), each inside its jump's range (the drop's by 5 km/h; the rest by 6 or more).
  features: [
    { type: 'jump', at: 160, ...DROP },       // 60: ride it
    { type: 'jump', at: 290, ...GAP },        // 64: pop it (ride it from 64)
    { type: 'jump', at: 430, ...STEP_DOWN },  // 63: ride it
    { type: 'jump', at: 570, ...STEP_UP },    // 73: ride it
    { type: 'jump', at: 720, ...GAP },        // 76: ride it
    { type: 'jump', at: 860, ...STEP_UP },    // 76: ride it
    { type: 'jump', at: 1010, ...GAP },       // 77: ride it
  ],
  scenery: { rocky: [[60, 140], [625, 700]] },
};
