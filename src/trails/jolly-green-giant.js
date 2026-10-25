// Jolly Green Giant (green): wide, gentle and flowing. Sets of rollers you can roll at any speed,
// pump for speed, or pop and gap; tabletops that grow toward the bottom, where coming up short just
// lands on the deck. Agreed with Ben, 25 Oct (see docs/v2-trailhead-spec.md).
//
// Distances along the trail (length, start, splits, features) are metres ALONG the winding path.
export default {
  id: 'jolly-green-giant',
  name: 'Jolly Green Giant',
  difficulty: 'green',
  length: 1100,
  seed: 20261025,

  // Gentle, wide sweepers: bends no tighter than about 45 m radius.
  centreline: [
    { amp: 26, period: 55, phase: 0.4 },
    { amp: 9, period: 25, phase: 2 },
  ],
  // Wide: half width 4.5-5.5 m (Flow Monster is 2.3-5.4).
  width: { base: 5, waves: [{ amp: 0.5, period: 70, phase: 1 }], min: 4.5, max: 5.5 },
  // Gentle grade: -0.10 (about 6 degrees; Flow Monster is -0.2), with a slow 4 m wave. (Agreed
  // -0.12; eased so the speeds you reach stay within what a popped tabletop lands smooth.)
  hill: { grade: -0.10, waves: [{ amp: -4, period: 120 }] },
  // Big friendly berms on every real corner: from 170 m radius, full height (1.8 m) under 70 m.
  berms: { auto: true, startCurvature: 0.006, fullCurvature: 0.014, height: 1.8, adjust: [] },

  start: { spawn: 2, gate: 9 },
  splits: [275, 550, 825, 1100],

  // Rollers on the straights, tabletops between them, growing toward the bottom.
  // Two kinds of roller set: pump rollers (10 m apart: roll and pump them) and gap sets (6.5 m
  // apart, a long gentle face and a short steeper back: fast riders pop one and land on the back
  // of the next). Tabletops have a flat deck at lip height (coming up short lands on the deck)
  // and a long, steep landing, so a pop at the speed you reach them lands deep, not past it.
  // Speeds are at the start of a roller set or the lip of a tabletop, km/h. Each feature declares
  // what riders can expect; tests/green.test.js (rollers) and tests/jumps.test.js (tabletops)
  // check them with the simulator. Flat out from the trailhead you reach the tabletops at about
  // 44, 45, 45, 55 and 51 km/h (pumping too: 44, 50, 47, 58, 53).
  features: [
    { type: 'rollers', at: 40, count: 4, height: 0.6, spacing: 10, // pump rollers
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },
        { pop: 3, from: 15, to: 40, outcome: 'no crash' },
      ] },
    { type: 'rollers', at: 166, count: 5, height: 0.5, spacing: 6.5, face: 0.6, // gap set
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },
        { pop: 3, from: 55, to: 65, outcome: 'gapped' },   // pop a crest: land on the back of the next
        { pop: 3, from: 15, to: 50, outcome: 'no crash' }, // too slow: land on the next face (heavy)
      ] },
    { type: 'jump', at: 288, kind: 'table', kick: 8, lip: 0.9, gap: 4.5, hole: 0.9, knuck: 0.9, land: 24, pitch: 0.42,
      short: 4.5, sweet0: 5, sweet1: 14, long: 17,
      landings: [
        { pop: 0, from: 14, to: 62, outcome: 'clean' },     // no pop: rolled over or landed smooth
        { pop: 3, from: 14, to: 56, outcome: 'no crash' },
        { pop: 3, from: 46, to: 52, outcome: 'smooth' },    // a full pop at speed clears the deck
        { pop: 3, from: 58, to: 64, outcome: 'big crash' }, // popped far too fast: past the landing
      ] },
    { type: 'rollers', at: 361, count: 3, height: 0.6, spacing: 10, // pump rollers
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },   // roll them at any speed
        { pop: 3, from: 15, to: 40, outcome: 'no crash' }, // popping these thumps into the next face (small crash from 45)
      ] },
    { type: 'jump', at: 419, kind: 'table', kick: 8, lip: 0.9, gap: 4.5, hole: 0.9, knuck: 0.9, land: 24, pitch: 0.42,
      short: 4.5, sweet0: 5, sweet1: 14, long: 17,
      landings: [
        { pop: 0, from: 14, to: 62, outcome: 'clean' },     // no pop: rolled over or landed smooth
        { pop: 3, from: 14, to: 56, outcome: 'no crash' },
        { pop: 3, from: 46, to: 52, outcome: 'smooth' },    // a full pop at speed clears the deck
        { pop: 3, from: 58, to: 64, outcome: 'big crash' }, // popped far too fast: past the landing
      ] },
    { type: 'rollers', at: 514, count: 6, height: 0.5, spacing: 6.5, face: 0.6, // gap set
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },
        { pop: 3, from: 55, to: 65, outcome: 'gapped' },   // pop a crest: land on the back of the next
        { pop: 3, from: 15, to: 50, outcome: 'no crash' }, // too slow: land on the next face (heavy)
      ] },
    { type: 'jump', at: 635, kind: 'table', kick: 10, lip: 1.1, gap: 6, hole: 1.1, knuck: 1.1, land: 26, pitch: 0.44,
      short: 6, sweet0: 6.5, sweet1: 16, long: 19,
      landings: [
        { pop: 0, from: 14, to: 68, outcome: 'clean' },
        { pop: 3, from: 14, to: 54, outcome: 'no crash' },
        { pop: 3, from: 34, to: 52, outcome: 'smooth' },
      ] },
    { type: 'rollers', at: 683, count: 3, height: 0.6, spacing: 10, // pump rollers
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },   // roll them at any speed
        { pop: 3, from: 15, to: 40, outcome: 'no crash' }, // popping these thumps into the next face (small crash from 45)
      ] },
    // the last two tabletops are reached fastest: a bigger deck and a longer landing
    { type: 'jump', at: 764, kind: 'table', kick: 12, lip: 1.0, gap: 7.5, hole: 1.0, knuck: 1.0, land: 32, pitch: 0.45,
      short: 7.5, sweet0: 8, sweet1: 18, long: 22,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 14, to: 64, outcome: 'no crash' },
        { pop: 3, from: 40, to: 64, outcome: 'smooth' },
        { pop: 3, from: 66, to: 70, outcome: 'big crash' },
      ] },
    { type: 'rollers', at: 864, count: 6, height: 0.55, spacing: 6.5, face: 0.6, // gap set
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },
        { pop: 3, from: 55, to: 65, outcome: 'gapped' },   // pop a crest: land on the back of the next
        { pop: 3, from: 15, to: 50, outcome: 'no crash' }, // too slow: land on the next face (heavy)
      ] },
    { type: 'jump', at: 976, kind: 'table', kick: 12, lip: 1.0, gap: 7.5, hole: 1.0, knuck: 1.0, land: 32, pitch: 0.45,
      short: 7.5, sweet0: 8, sweet1: 18, long: 22,
      landings: [
        { pop: 0, from: 14, to: 70, outcome: 'clean' },
        { pop: 3, from: 14, to: 64, outcome: 'no crash' },
        { pop: 3, from: 40, to: 64, outcome: 'smooth' },
        { pop: 3, from: 66, to: 70, outcome: 'big crash' },
      ] },
    { type: 'rollers', at: 1020, count: 3, height: 0.6, spacing: 10, // pump rollers
      landings: [
        { pop: 0, from: 15, to: 65, outcome: 'smooth' },   // roll them at any speed
        { pop: 3, from: 15, to: 40, outcome: 'no crash' }, // popping these thumps into the next face (small crash from 45)
      ] },
  ],
  scenery: { rocky: [] },
};
