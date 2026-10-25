// Jolly Green Giant (green): wide, gentle and flowing. Sets of rollers you can roll at any speed,
// pump for speed, or pop and gap; tabletops where coming up short just lands on the deck. Agreed
// with Ben, 25 Oct (see docs/v2-trailhead-spec.md); re-laid on the shared mountain, 25 Oct.
//
// Distances along the trail (length, start, splits, features) are metres ALONG the winding path.
// The features, by kind (shapes and declared outcomes; see tests/green.test.js and tests/jumps.test.js).
// Pump rollers: 0.6 m high, 10 m apart: roll and pump them.
const PUMP_SET = count => ({ count, height: 0.6, spacing: 10,
  landings: [
    { pop: 0, from: 15, to: 65, outcome: 'smooth' },   // roll them at any speed
    { pop: 3, from: 15, to: 40, outcome: 'no crash' }, // popping these thumps into the next face
  ] });
// Gap sets: 0.55 m high, 6.5 m apart, a long gentle face and a short steeper back: fast riders pop
// one and land on the back of the next.
const GAP_SET = count => ({ count, height: 0.55, spacing: 6.5, face: 0.6,
  landings: [
    { pop: 0, from: 15, to: 65, outcome: 'smooth' },
    { pop: 3, from: 55, to: 65, outcome: 'gapped' },   // pop a crest: land on the back of the next
    { pop: 3, from: 15, to: 50, outcome: 'no crash' }, // too slow: land on the next face (heavy)
  ] });
// Tabletops: a flat deck at lip height (coming up short lands on the deck) and a long, steep landing.
// Each declares its outcomes where it is (speed at the lip, km/h; measured on the trail itself):
// no pop, it is always rolled over or landed smooth ('clean'); a full pop clears the deck.
const SMALL_TABLE = { kind: 'table', kick: 8, lip: 0.9, gap: 4.5, hole: 0.9, knuck: 0.9, land: 24, pitch: 0.42,
  short: 4.5, sweet0: 5, sweet1: 14, long: 17 };
const BIG_TABLE = { kind: 'table', kick: 12, lip: 1.0, gap: 7.5, hole: 1.0, knuck: 1.0, land: 32, pitch: 0.45,
  short: 7.5, sweet0: 8, sweet1: 18, long: 22 };

export default {
  id: 'jolly-green-giant',
  name: 'Jolly Green Giant',
  difficulty: 'green',
  length: 2028,
  seed: 20261025,

  // From the trailhead's left-hand gate it swings out to the left (west) and zigzags down the
  // mountain in long, even traverses (68 degrees across the fall line, so about -0.1) joined by
  // switchback corners (no tighter than 55 m radius), then traverses back to the finish
  // clearing's left-hand gate. At least 80 m from Flow Monster except near the clearings.
  // Laid out by distance d straight down the hill: it starts at x0 heading `heading` degrees
  // from straight down (+ is to the right, east); at each turn it turns to the new heading,
  // smoothly over about 4 x `over` metres down the hill.
  centreline: {
    x0: -5.040,
    heading: 29.4,
    turns: [
      { at: 45.0, heading: -68.0, over: 23.4 },
      { at: 397.5, heading: 68.0, over: 32.6 },
      { at: 735.7, heading: -68.0, over: 32.6 },
      { at: 919.1, heading: 58.2, over: 30.3 },
      { at: 1170.0, heading: -17.4, over: 18.2 },
    ],
  },
  // Wide: half width 4.5-5.5 m (Flow Monster is 2.3-5.4).
  width: { base: 5, waves: [{ amp: 0.5, period: 70, phase: 1 }], min: 4.5, max: 5.5 },
  // On the shared mountain (src/world.js): the same hill as Flow Monster, but a longer way down,
  // so gentler: -0.14 overall (290 m down over 2 km), mostly -0.08 to -0.16 on the traverses.
  // Graded: the line follows the mountain averaged over 60 m either way, easing the corners.
  hill: { mountain: true, smooth: 60 },
  // Big friendly berms on every real corner: from 170 m radius, full height (1.8 m) under 70 m.
  berms: { auto: true, startCurvature: 0.006, fullCurvature: 0.014, height: 1.8, adjust: [] },

  start: { spawn: 9, gate: 15.4 }, // its gate in the trailhead clearing
  splits: [480, 1040, 1530, 2028], // each clear of the features

  // Rollers and tabletops on the traverses (none in the switchback corners). Pump rollers on the
  // flattest stretches, where pumping keeps you going; gap sets where you're fast enough to pop
  // one and land on the back of the next (55-65 km/h). Tabletops have a flat deck at lip height
  // (coming up short lands on the deck) and a long, steep landing. Speeds are at the start of a
  // roller set or the lip of a tabletop, km/h. Each feature declares what riders can expect;
  // tests/green.test.js (rollers) and tests/jumps.test.js (tabletops) ride them on the trail.
  // Flat out from the trailhead (popping every tabletop) you reach the tabletops at about 46,
  // 44, 62 and 51 km/h; holding 45 km/h, at 43-47.
  features: [
    { type: 'rollers', at: 190, ...PUMP_SET(4) },
    { type: 'jump', at: 300, ...SMALL_TABLE,
      landings: [
        { pop: 0, from: 14, to: 62, outcome: 'clean' },
        { pop: 3, from: 42, to: 48, outcome: 'smooth' },
        { pop: 3, from: 14, to: 48, outcome: 'no crash' },
        { pop: 3, from: 58, to: 70, outcome: 'big crash' }, // popped far too fast: past the landing
      ] },
    { type: 'rollers', at: 410, ...PUMP_SET(3) },
    { type: 'jump', at: 520, ...SMALL_TABLE,
      landings: [
        { pop: 0, from: 14, to: 62, outcome: 'clean' },
        { pop: 3, from: 14, to: 42, outcome: 'smooth' },
        { pop: 3, from: 14, to: 52, outcome: 'no crash' },
        { pop: 3, from: 54, to: 70, outcome: 'big crash' },
      ] },
    { type: 'rollers', at: 590, ...GAP_SET(5) },
    { type: 'jump', at: 890, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 14, to: 60, outcome: 'smooth' },
      ] },
    { type: 'rollers', at: 975, ...GAP_SET(6) },
    { type: 'jump', at: 1090, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 42, to: 60, outcome: 'smooth' },
        { pop: 3, from: 14, to: 64, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 1180, ...PUMP_SET(3) },
    { type: 'rollers', at: 1470, ...GAP_SET(6) },
    { type: 'rollers', at: 1770, ...GAP_SET(6) },
    { type: 'rollers', at: 1850, ...PUMP_SET(3) },
  ],
  scenery: { rocky: [] },
};
