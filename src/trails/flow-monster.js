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
    // Ben kept overshooting this one even without a pop. A longer landing alone didn't help (the
    // landing's slope stays the same), so the kicker is longer and gentler (12 m, was 9; same 1.1 m
    // lip): you fly flatter and come down in line with the landing. Landing 37 m (was 33, at first 30).
    // Smooth from 52 to 80 km/h without a pop (was 46-70); you reach this lip at up to about 77.
    // Flags moved to where the game's landings touch down.
    { type: 'jump', at: 743, kind: 'normal', kick: 12, land: 37, sweet1: 22, long: 26.5,
      landings: [
        { pop: 0, from: 52, to: 80, outcome: 'smooth' },
        { pop: 3, from: 36, to: 60, outcome: 'smooth' },
        { pop: 0, from: 40, to: 44, outcome: 'big crash' },   // far too slow: cased
        { pop: 0, from: 88, to: 88, outcome: 'small crash' }, // too fast: flat landing
      ] },
    { type: 'jump', at: 1037, kind: 'bigPop' },
  ],
  scenery: { rocky: [[242, 314], [817, 892]] }, // extra rocks beside the trail here
};
