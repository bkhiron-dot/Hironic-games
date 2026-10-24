// Hardline: the v1 track, as data. defineTrail() (src/trail.js) checks it and turns it
// into the functions the game uses. Distances are metres down the trail.
export default {
  id: 'hardline',
  name: 'Hardline',
  length: 1200,
  seed: 20261024, // grows the forest; the same seed always gives the same trees

  // Sideways wiggle of the centreline: the sum of amp * sin(s / period + phase).
  centreline: [
    { amp: 22, period: 45, phase: 0 },
    { amp: 8, period: 23, phase: 1 },
  ],
  // Half the trail width: base plus waves, kept between min and max (2.3-5.4 m).
  width: { base: 3.4, waves: [{ amp: 1.4, period: 63, phase: 0.5 }, { amp: 0.7, period: 19 }], min: 2.3, max: 5.4 },
  // Height down the trail: grade -0.2 (about 11 degrees), a slow 7 m wave, and a steeper chute.
  profile: { grade: -0.2, waves: [{ amp: -7, period: 110 }], chutes: [{ from: 500, to: 580, grade: -0.12 }] },
  // Berms build themselves on corners, from gentle (startCurvature) to full height (fullCurvature).
  // To change one stretch, add e.g. adjust: [{ from: 600, to: 660, height: 2.2 }] (height 0 removes it).
  berms: { auto: true, startCurvature: 0.010, fullCurvature: 0.020, height: 1.7, adjust: [] },

  start: { spawn: 2, gate: 8 },    // where the bike waits, and the timing gate
  splits: [300, 600, 900, 1200],   // the last one is the finish

  features: [
    { type: 'jump', at: 170, kind: 'normal' },
    { type: 'jump', at: 410, kind: 'popOptional' },
    { type: 'jump', at: 690, kind: 'normal' },
    { type: 'jump', at: 960, kind: 'bigPop' },
  ],
  scenery: { rocky: [[230, 290], [760, 830]] }, // extra rocks beside the trail here
};
