// Jolly Green Giant (green): wide, gentle and flowing. Sets of rollers you can roll at any speed,
// pump for speed, or pop and gap; tabletops where coming up short just lands on the deck. Agreed
// with Ben, 25 Oct (see docs/v2-trailhead-spec.md); re-laid on the shared mountain, 25 Oct.
//
// Distances along the trail (length, start, splits, features) are metres ALONG the winding path.
// The features, by kind (shapes and declared outcomes; see tests/green.test.js and tests/jumps.test.js).
// Big rollers (Ben, 26 Oct: at least double the size): pump rollers 1.2 m high and 20 m apart,
// and whoops 1.1 m high and 13 m apart (a long gentle face and a shorter, steeper back). Roll
// them at any speed and pump them for speed. They're for pumping only (pop: false): a pop at a
// crest of a roller this big lands in the next one's face (a big crash from about 35-60 km/h).
const PUMP_SET = count => ({ count, height: 1.2, spacing: 20, pop: false,
  landings: [
    { pop: 0, from: 20, to: 75, outcome: 'smooth' },   // roll them (slower than about 18 km/h you can't get over one: pedal or pump)
    { pop: 3, from: 20, to: 75, outcome: 'smooth' },   // letting go at a crest doesn't launch you
  ] });
const WHOOPS = count => ({ count, height: 1.1, spacing: 13, face: 0.6, pop: false,
  landings: [
    { pop: 0, from: 20, to: 75, outcome: 'smooth' },
    { pop: 3, from: 20, to: 75, outcome: 'smooth' },
  ] });
// Tabletops: a flat deck at lip height (coming up short lands on the deck) and a long, steep landing.
// Each declares its outcomes where it is (speed at the lip, km/h; measured on the trail itself):
// no pop, it is always rolled over or landed smooth ('clean'); a full pop clears the deck.
const BIG_TABLE = { kind: 'table', kick: 12, lip: 1.0, gap: 7.5, hole: 1.0, knuck: 1.0, land: 32, pitch: 0.45,
  short: 7.5, sweet0: 8, sweet1: 18, long: 22 };

export default {
  id: 'jolly-green-giant',
  name: 'Jolly Green Giant',
  difficulty: 'green',
  length: 2070.4,
  seed: 20261025,

  // From the trailhead's left-hand gate it swings out to the left (west) and zigzags down the
  // mountain in long traverses (about 68 degrees across the fall line, so about -0.1) joined by
  // switchback corners (no tighter than 55 m radius). Along each traverse it sweeps gently left
  // and right (7 degrees either way, about 85 m radius) through gentle berms. It traverses back
  // to the finish clearing's left-hand gate. At least 42 m from Flow Monster except near the
  // clearings. Laid out by distance d straight down the hill: it starts at x0 heading `heading`
  // degrees from straight down (+ is to the right, east); at each turn it turns to the new
  // heading, smoothly over about 4 x `over` metres down the hill.
  centreline: {
    x0: -5.04,
    heading: 29.4,
    turns: [
      { at: 45, heading: -68, over: 23.37 },
      { at: 145, heading: -61, over: 2.6 },
      { at: 195, heading: -75, over: 5.19 },
      { at: 245, heading: -61, over: 5.19 },
      { at: 295, heading: -75, over: 5.19 },
      { at: 347.47, heading: -68, over: 2.6 },
      { at: 397.47, heading: 68, over: 32.64 },
      { at: 497.47, heading: 75, over: 2.6 },
      { at: 547.47, heading: 61, over: 5.19 },
      { at: 597.47, heading: 75, over: 5.19 },
      { at: 685.72, heading: 68, over: 2.6 },
      { at: 735.72, heading: -68, over: 32.64 },
      { at: 919.08, heading: 51.99, over: 28.8 },
      { at: 1019.08, heading: 58.99, over: 2.6 },
      { at: 1069.08, heading: 44.99, over: 5.19 },
      { at: 1120, heading: 51.99, over: 2.6 },
      { at: 1170, heading: -17.4, over: 16.65 },
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

  start: { spawn: 9, gate: 15.3 }, // its gate in the trailhead clearing
  splits: [480, 1050, 1450, 2070.4], // each clear of the features

  // Big rollers and tabletops on the straight stretches of the traverses (none in the bends).
  // Tabletops have a flat deck at lip height (coming up short lands on the deck) and a long,
  // steep landing. Speeds are at the start of a roller set or the lip of a tabletop, km/h. Each
  // feature declares what riders can expect; tests/green.test.js (rollers) and tests/jumps.test.js
  // (tabletops) ride them on the trail. Flat out from the trailhead (popping every tabletop) you
  // reach the tabletops at about 49, 44, 57 and 48 km/h, and land them all smooth.
  features: [
    { type: 'rollers', at: 130, ...PUMP_SET(3) },
    { type: 'jump', at: 262, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 42, to: 60, outcome: 'smooth' },
        { pop: 3, from: 14, to: 64, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 360, ...WHOOPS(4) },
    { type: 'jump', at: 538, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 34, to: 60, outcome: 'smooth' },
        { pop: 3, from: 14, to: 62, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 615, ...PUMP_SET(3) },
    { type: 'jump', at: 952, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 38, to: 68, outcome: 'smooth' },
        { pop: 3, from: 14, to: 68, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 1085, ...WHOOPS(4) },
    { type: 'jump', at: 1212, ...BIG_TABLE,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 40, to: 64, outcome: 'smooth' },
        { pop: 3, from: 14, to: 64, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 1290, ...PUMP_SET(3) },
    { type: 'rollers', at: 1540, ...WHOOPS(4) },
    { type: 'rollers', at: 1835, ...PUMP_SET(3) },
  ],
  scenery: { rocky: [] },
};
