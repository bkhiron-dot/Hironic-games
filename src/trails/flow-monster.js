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
    // Ben pops through the start gate from a rolling start and reaches this lip at about 66-68 km/h;
    // a pop sent him past the landing. Longer and gentler (kicker 12 m, gap 8.5 m, landing 38 m)
    // so a full pop at that speed lands smooth (48-68 km/h). Without a pop: smooth 64-88; slower
    // than 58 without a pop you case it.
    { type: 'jump', at: 177, kind: 'normal', kick: 12, gap: 8.5, land: 38, short: 7.8, sweet0: 8, sweet1: 25, long: 28,
      landings: [
        { pop: 0, from: 64, to: 88, outcome: 'smooth' },
        { pop: 3, from: 48, to: 68, outcome: 'smooth' },
        { pop: 0, from: 40, to: 56, outcome: 'big crash' }, // too slow without a pop: cased
        { pop: 3, from: 82, to: 90, outcome: 'big crash' }, // popped far too fast: past the landing
      ] },
    // Ben overshot this one with a pop (reaching the lip at about 56-61 km/h; a full pop was smooth only
    // to 54). Longer all round, still pop optional: kicker 14 m (was 10), gap 8 m (was 8.5), landing
    // 50 m (was 42). Full pop: smooth 46-62, heavy 64-66. No pop: smooth 56-68, heavy 54; slower cases.
    { type: 'jump', at: 438, kind: 'popOptional', kick: 14, gap: 8, land: 50, short: 7.4, sweet0: 8, sweet1: 23.5, long: 28.5,
      landings: [
        { pop: 0, from: 56, to: 68, outcome: 'smooth' },
        { pop: 3, from: 46, to: 62, outcome: 'smooth' },
        { pop: 0, from: 44, to: 50, outcome: 'big crash' }, // too slow without a pop: cased
      ] },
    // Ben kept overshooting this one (reaches the lip at about 72-78 km/h and pops it). Tried a
    // longer landing (no help: same slope), then a gentler kicker (better without a pop, not with
    // one). Now longer all round: kicker 14 m, gap 9.5 m, landing 44 m, so a full pop at his speed
    // lands smooth (54-78 km/h). Without a pop: smooth 74-90, heavy 68-72; slower than 66 you case it.
    { type: 'jump', at: 743, kind: 'normal', kick: 14, gap: 9.5, land: 44, short: 8.8, sweet0: 9.1, sweet1: 23.5, long: 30,
      landings: [
        { pop: 0, from: 74, to: 90, outcome: 'smooth' },
        { pop: 3, from: 54, to: 78, outcome: 'smooth' },
        { pop: 0, from: 40, to: 64, outcome: 'big crash' }, // too slow without a pop: cased
      ] },
    { type: 'jump', at: 1037, kind: 'bigPop' },
  ],
  scenery: { rocky: [[242, 314], [817, 892]] }, // extra rocks beside the trail here
};
