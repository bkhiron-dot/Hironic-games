// Back in Black (black): steeper and narrower, and every feature is a mandatory gap: gap jumps,
// step-downs (the landing is lower than the lip) and step-ups (the landing is higher). No B lines,
// smooth dirt on the line. Agreed with Ben, 24-25 Oct (see docs/v2-trailhead-spec.md).
//
// Distances along the trail (length, start, splits, features) are metres ALONG the winding path.
// Every feature is a mandatory gap: come in too slow and you case it. Each one has a smooth
// window without a pop and a lower one with a full pop that join up, so at any speed in its
// range there's a way to land it: fast, ride it; slower, pop it. Speeds are at the lip, km/h, on
// this trail's -0.22 grade (the simulator rides it). The shapes are Flow Monster's first jump
// (kicker 12 m, gap 8.5 m, landing 38 m, which lands smooth over a wide range of speed) with the
// landing moved: lower for a step-down, higher for a step-up.
const GAP = { kind: 'normal', kick: 12, lip: 1.1, gap: 8.5, hole: -1, knuck: 1, pitch: 0.3, land: 38,
  short: 7.8, sweet0: 8, sweet1: 25, long: 28,
  landings: [
    { pop: 0, from: 64, to: 88, outcome: 'smooth' },
    { pop: 3, from: 48, to: 70, outcome: 'smooth' },
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
    { pop: 0, from: 62, to: 78, outcome: 'smooth' },
    { pop: 3, from: 54, to: 62, outcome: 'smooth' },
    { pop: 0, from: 40, to: 44, outcome: 'big crash' },
  ] };
// A smaller, slower step-down: knuckle 1.7 m below a 0.7 m lip, steeper landing.
const DROP = { kind: 'normal', kick: 10, lip: 0.7, gap: 7, hole: -2.5, knuck: -1, pitch: 0.55, land: 44,
  short: 6.8, sweet0: 8, sweet1: 23, long: 27,
  landings: [
    { pop: 0, from: 54, to: 70, outcome: 'smooth' },
    { pop: 3, from: 48, to: 56, outcome: 'smooth' },
    { pop: 0, from: 78, to: 90, outcome: 'big crash' }, // far too fast: past the landing
  ] };

export default {
  id: 'back-in-black',
  name: 'Back in Black',
  difficulty: 'black',
  length: 1150,
  seed: 20261026,

  // Long straights between fast, open bends (no tighter than about 76 m radius), so every big
  // landing is on a straight. (Twistier lines made steep banks beside the trail on this steeper
  // hill, and put landings into bends.)
  centreline: [
    { amp: 22, period: 70, phase: 1.0 },
    { amp: 5, period: 24, phase: 0.3 },
  ],
  // Narrow: half width 2.2-3.6 m (Flow Monster 2.3-5.4).
  width: { base: 2.8, waves: [{ amp: 0.6, period: 50, phase: 0.8 }], min: 2.2, max: 3.6 },
  // Steeper: grade -0.22 (about 12 degrees; Flow Monster -0.2), with a 6 m wave.
  hill: { grade: -0.22, waves: [{ amp: -6, period: 100 }] },
  // Berms on the corners like Flow Monster's (capped at 0.85 x half width on the narrowest bends).
  berms: { auto: true, startCurvature: 0.008, fullCurvature: 0.016, height: 2.0, adjust: [] },

  start: { spawn: 2, gate: 9 },
  splits: [290, 620, 870, 1150], // each clear of the jumps (the drop at 565 lands until 616)

  // Riding flat out and choosing pop or no pop like a rider, you reach the lips at the speeds
  // below (km/h). Each is inside its jump's range with room either side (at least 6 km/h).
  features: [
    { type: 'jump', at: 120, ...STEP_DOWN },  // 68: ride it
    { type: 'jump', at: 195, ...GAP },        // 80: ride it
    { type: 'jump', at: 330, ...STEP_UP },    // 70: pop it (ride it from 72)
    { type: 'jump', at: 420, ...GAP },        // 55: pop it (after the bend)
    { type: 'jump', at: 565, ...DROP },       // 63: ride it
    { type: 'jump', at: 650, ...STEP_UP },    // 80: ride it
    { type: 'jump', at: 800, ...GAP },        // 79: ride it
    { type: 'jump', at: 885, ...STEP_DOWN },  // 64: ride it
    { type: 'jump', at: 1040, ...GAP },       // 61: pop it
  ],
  scenery: { rocky: [[60, 140], [600, 700]] },
};
