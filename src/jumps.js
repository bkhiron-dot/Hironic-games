// Jump shapes. A trail places jumps by kind, and can override any number.
// Each kind declares its expected landing ranges; tests/jumps.test.js checks every
// jump on every trail against the jump simulator (tools/jump-sim.js).
//
// Profile measured from the lip (u = 0): kicker -> gap with a hole -> face up to the
// knuckle at u = gap -> landing that rolls over (first 20%), holds a steep pitch (to 50%),
// then eases back to trail grade. The run-out continues at the new, lower level.
// short / sweet0 / sweet1 / long are where the amber and green landing flags stand
// (metres past the lip): green brackets the sweet spot, amber the edges of the landing.

export const HOLE_LENGTH = 1.5;
const LANDING_LENGTH = 30, ROLLOVER_END = 0.2, PITCH_END = 0.5;

// Landing ranges are speed at the lip in km/h, checked every 2 km/h. pop is extra upward
// speed at the lip in m/s (3 = full pop). outcome is 'smooth', 'big crash', or 'not smooth'.
export const JUMP_KINDS = {
  // Normal jump: lands smooth at about 46-68 km/h without a pop.
  normal: {
    big: false, kick: 9, lip: 1.1, gap: 6, hole: -1.0, knuck: 1.0, pitch: 0.3,
    short: 5.3, sweet0: 5.6, sweet1: 20, long: 23,
    landings: [
      { pop: 0, from: 46, to: 68, outcome: 'smooth' },
      { pop: 0, from: 36, to: 36, outcome: 'big crash' }, // far too slow: cased
      { pop: 0, from: 76, to: 76, outcome: 'small crash' }, // too fast: flat landing...
      { pop: 0, from: 78, to: 80, outcome: 'big crash' },   // ...and faster still
    ],
  },
  // Big jump that clears without a pop (smooth at about 52-66 km/h);
  // a full pop helps if you're slow (smooth at about 46-54 km/h).
  // Gap 8.5 m (was 9; tuning round 2) so the pop really is optional at the speeds riders reach
  // (on Hardline, at most about 56 km/h at the lip). Flags are where the game's landings touch down.
  popOptional: {
    big: true, popOptional: true, kick: 10, lip: 1.5, gap: 8.5, hole: -1.2, knuck: 1.2, pitch: 0.55, land: 42,
    short: 7.8, sweet0: 8.6, sweet1: 23.5, long: 28.5,
    landings: [
      { pop: 0, from: 52, to: 66, outcome: 'smooth' },
      { pop: 3, from: 46, to: 54, outcome: 'smooth' },
    ],
  },
  // Big step-down jump: high kicker, low knuckle, long steep landing. Clears without a pop
  // from about 52 km/h (smooth to 62); slower than that, a full pop lands it (46-52).
  // Shaped with Ben (tuning rounds 2 and 3): 12 m kicker, 2.2 m lip, 1.6 m knuckle, 10 m gap,
  // and a long steep landing (48 m at 0.8, about 39 degrees) for a long sweet spot: smooth
  // landings touch down anywhere from 11.5 to 28 m past the lip. The landing drops about 23 m
  // more than the hill's grade, so riders come off it fast (about 76 km/h on Hardline).
  // Flags are where the game's landings touch down.
  bigPop: {
    big: true, popOptional: true, kick: 12, lip: 2.2, gap: 10, hole: -1.2, knuck: 1.6, pitch: 0.8, land: 48,
    short: 9.8, sweet0: 11.5, sweet1: 28, long: 32.5,
    landings: [
      { pop: 3, from: 46, to: 52, outcome: 'smooth' },
      { pop: 0, from: 52, to: 62, outcome: 'smooth' },
      { pop: 0, from: 40, to: 44, outcome: 'big crash' }, // too slow, no pop: cased
      { pop: 3, from: 60, to: 64, outcome: 'big crash' }, // too fast with a pop: overshot
    ],
  },
};

// Numbers that change the jump's shape. Overriding any of these means the kind's landing
// ranges no longer apply, so the trail must declare its own.
export const SHAPE_KEYS = ['kick', 'lip', 'gap', 'hole', 'knuck', 'pitch', 'land'];

// Landing height relative to the knuckle, for t = 0..1 along the landing, defined by its slope.
export function landingShape(t, pitch) {
  if (t < ROLLOVER_END) return -pitch * t * t / (2 * ROLLOVER_END);
  if (t < PITCH_END) return -pitch * ROLLOVER_END / 2 - pitch * (t - ROLLOVER_END);
  const q = t - PITCH_END;
  return -pitch * ROLLOVER_END / 2 - pitch * (PITCH_END - ROLLOVER_END) - pitch * (q - q * q / (2 * (1 - PITCH_END)));
}

// A complete jump from a trail feature { kind, at, ...overrides }.
// at = distance down the trail of the lip.
export function resolveJump(feature) {
  const kind = JUMP_KINDS[feature.kind];
  if (!kind) throw new Error(`unknown jump kind "${feature.kind}" (known: ${Object.keys(JUMP_KINDS).join(', ')})`);
  const { kind: kindName, at, type, ...overrides } = feature;
  const j = { s: at, ...kind, ...overrides, kind: kindName };
  j.land = j.land || LANDING_LENGTH;
  j.drop = -landingShape(1, j.pitch) * j.land; // how much lower the trail is after the jump
  j.end = j.s + j.gap + j.land;
  return j;
}

// Height the jump adds to the trail, u metres past the lip (negative = before it).
export function jumpProfile(j, u) {
  if (u <= -j.kick) return 0;
  if (u < 0) { const t = (u + j.kick) / j.kick; return j.lip * t * t; }
  if (u < HOLE_LENGTH) return j.hole;
  if (u < j.gap) return j.hole + (j.knuck - j.hole) * smooth((u - HOLE_LENGTH) / (j.gap - HOLE_LENGTH));
  if (u < j.gap + j.land) return j.knuck + j.land * landingShape((u - j.gap) / j.land, j.pitch);
  return j.knuck - j.drop;
}

// Smoothstep, written out here so this file has no imports (the simulator uses it too).
function smooth(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
