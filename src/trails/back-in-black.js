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
    { pop: 0, from: 40, to: 54, outcome: 'big crash' }, // too slow without a pop: cased
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
  length: 1339.3,
  seed: 20261026,

  // From the trailhead's right-hand gate it heads out to the right (east), then down the mountain
  // in fast straights (one gap on each) joined by S-bends: a hard turn across (45 degrees, as tight
  // as 46 m radius) and back, each with a 2 m berm. Back in to the finish clearing's right-hand
  // gate: 1339 m to ride, 1204 m straight down, at least 78 m from Flow Monster except near the
  // clearings. Laid out by distance d straight down the hill: it starts at x0 heading `heading`
  // degrees from straight down (+ is to the right, east); at each turn it turns to the new heading,
  // smoothly over about 4 x `over` metres down the hill.
  centreline: {
    x0: 24.432,
    heading: 34,
    turns: [
      { at: 20, heading: 50, over: 4 },
      { at: 90, heading: 20, over: 5.89 },
      { at: 225, heading: -45, over: 12.763 },
      { at: 270, heading: -20, over: 4.909 },
      { at: 405, heading: 45, over: 12.763 },
      { at: 450, heading: 20, over: 4.909 },
      { at: 585, heading: -45, over: 12.763 },
      { at: 630, heading: -20, over: 4.909 },
      { at: 765, heading: 45, over: 12.763 },
      { at: 810, heading: 20, over: 4.909 },
      { at: 945, heading: -45, over: 12.763 },
      { at: 990, heading: -23.6, over: 4.202 },
      { at: 1192, heading: -10, over: 4 },
    ],
  },
  // Narrow: half width 2.2-3.6 m (Flow Monster 2.3-5.4).
  width: { base: 2.8, waves: [{ amp: 0.6, period: 50, phase: 0.8 }], min: 2.2, max: 3.6 },
  // On the shared mountain (src/world.js): the same hill as Flow Monster, nearly straight down it.
  hill: { mountain: true },
  // Berms on the corners like Flow Monster's (capped at 0.85 x half width on the narrowest bends).
  berms: { auto: true, startCurvature: 0.008, fullCurvature: 0.016, height: 2.0, adjust: [] },

  start: { spawn: -6, gate: 0.12 }, // its gate in the trailhead clearing
  splits: [300, 680, 880, 1339.3], // each clear of the jumps

  // Six mandatory gaps, one on each straight (on the shared mountain the jumps' drops are paid
  // back on the stretches between them). Riding flat out and choosing pop or no pop like a rider,
  // you reach the lips at the speeds below (km/h).
  features: [
    { type: 'jump', at: 171, ...GAP },        // 60: pop it (ride it from 64)
    { type: 'jump', at: 364, ...GAP },        // 61: pop it
    { type: 'jump', at: 560, ...STEP_DOWN },  // 70: ride it
    { type: 'jump', at: 755, ...STEP_UP },    // 66: pop it (ride it from 72)
    { type: 'jump', at: 950, ...DROP },       // 62: ride it
    { type: 'jump', at: 1150, ...STEP_UP },   // 68: pop it
  ],
  scenery: { rocky: [[60, 140], [640, 720]] },
};
