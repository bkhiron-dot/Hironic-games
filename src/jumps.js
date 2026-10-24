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
      { pop: 0, from: 76, to: 76, outcome: 'big crash' }, // far too fast: flat landing
    ],
  },
  // Big jump that clears without a pop (smooth at about 52-66 km/h);
  // a full pop helps if you're slow (smooth at about 46-54 km/h).
  popOptional: {
    big: true, popOptional: true, kick: 10, lip: 1.5, gap: 9, hole: -1.2, knuck: 1.2, pitch: 0.55, land: 42,
    short: 8.6, sweet0: 9.2, sweet1: 26, long: 30,
    landings: [
      { pop: 0, from: 52, to: 66, outcome: 'smooth' },
      { pop: 3, from: 46, to: 54, outcome: 'smooth' },
    ],
  },
  // Big jump that needs a pop: a full pop lands smooth at about 50-58 km/h; without one you
  // case it below about 60 (flat out, 61+ km/h, it clears without a pop).
  // Reshaped with Ben (tuning round 2): longer, higher take-off (12 m kicker, 1.8 m lip),
  // lower knuckle (1.8 m, was 2.4), and a steeper landing (0.6, was 0.4) so it still lands
  // at speeds riders can reach. Flags are where the game's landings touch down.
  bigPop: {
    big: true, kick: 12, lip: 1.8, gap: 11, hole: -1.2, knuck: 1.8, pitch: 0.6,
    short: 10.8, sweet0: 12.0, sweet1: 23.5, long: 26,
    landings: [
      { pop: 3, from: 50, to: 58, outcome: 'smooth' },
      { pop: 0, from: 46, to: 60, outcome: 'not smooth' },
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
