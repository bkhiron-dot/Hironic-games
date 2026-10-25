// Flow Monster (blue): the v1 track, as data. defineTrail() (src/trail.js) checks it and turns it
// into the functions the game uses.
//
// Distances along the trail (length, start, splits, jumps, rocky sections, berm
// adjustments) are metres ALONG the winding path. The centreline and the hill are laid out
// by distance straight down the hill, so the trail keeps v1's shape on the hill: it is
// 1200 m straight down and 1297 m to ride.
export default {
  id: 'flow-monster',
  name: 'Flow Monster',
  difficulty: 'blue', // green, blue or black: shown on the gates and the map
  length: 1297,
  seed: 20261024, // grows the forest; the same seed always gives the same trees

  // Sideways position of the centreline: the sum of amp * sin(d / period + phase),
  // where d is the distance straight down the hill.
  centreline: [
    { amp: 22, period: 45, phase: 0 },
    { amp: 8, period: 23, phase: 1 },
  ],
  // Half the trail width along the trail: base plus waves, kept between min and max (2.3-5.4 m).
  width: { base: 3.4, waves: [{ amp: 1.4, period: 63, phase: 0.5 }, { amp: 0.7, period: 19 }], min: 2.3, max: 5.4 },
  // The hill, by distance straight down it: grade -0.2 (about 11 degrees), a slow 7 m wave,
  // and a steeper chute 500-580 m down.
  hill: { grade: -0.2, waves: [{ amp: -7, period: 110 }], chutes: [{ from: 500, to: 580, grade: -0.12 }] },
  // Berms build themselves on corners, from gentle (startCurvature) to full height (fullCurvature).
  // To change one stretch, add e.g. adjust: [{ from: 650, to: 710, height: 2.2 }] (height 0 removes it).
  // Step 3b (Ben, option B): higher berms (2.2 m, was 1.7) on more corners: they start on bends
  // tighter than 125 m radius and are full height under 63 m (was 100 m and 50 m).
  berms: { auto: true, startCurvature: 0.008, fullCurvature: 0.016, height: 2.2, adjust: [] },

  start: { spawn: 2, gate: 9 },    // where the bike waits, and the timing gate
  splits: [326, 650, 974, 1297],   // the last one is the finish

  features: [
    { type: 'jump', at: 177, kind: 'normal' },
    { type: 'jump', at: 438, kind: 'popOptional' },
    // Landing 10% longer (33 m, was 30) after Ben overshot it twice: smooth up to 70 km/h
    // without a pop (was 68). Flags moved out to match where the game's landings touch down.
    { type: 'jump', at: 743, kind: 'normal', land: 33, sweet1: 21, long: 25,
      landings: [
        { pop: 0, from: 46, to: 70, outcome: 'smooth' },
        { pop: 3, from: 34, to: 52, outcome: 'smooth' },
        { pop: 0, from: 36, to: 36, outcome: 'big crash' },   // far too slow: cased
        { pop: 0, from: 78, to: 78, outcome: 'small crash' }, // too fast: flat landing...
        { pop: 0, from: 80, to: 84, outcome: 'big crash' },   // ...and faster still
      ] },
    { type: 'jump', at: 1037, kind: 'bigPop' },
  ],
  scenery: { rocky: [[242, 314], [817, 892]] }, // extra rocks beside the trail here
};
