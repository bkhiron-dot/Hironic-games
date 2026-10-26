// Rollers: a set of smooth humps across the trail, like waves (Jolly Green Giant).
//
// A set is `count` humps, each `height` m high and `spacing` m from crest to crest, starting
// at distance `at` along the trail. `face` is the share of each hump that is its way up
// (default 0.5, symmetric); a longer, gentler face and a shorter, steeper back soften a short
// pop that comes down on the next face, and give a gap a steeper back to land on.
// Each half is a smooth curve (half a cosine), so the set starts and ends level with the trail,
// adds no drop, and has no kinks.
// Roll them at any speed, pump them for speed (hold compress down the backs), or pop just
// before a crest and gap to the back of the next one. A set with `pop: false` is for pumping
// only: letting go at a crest doesn't pop (big rollers, where a pop lands in the next face). Like jumps, each set declares its
// expected outcomes (`landings`), checked against the simulator by tests/green.test.js.
// Plain maths only (no imports), so tests and the simulator run it in Node.

// On rollers a pop works only right at a crest: from 1 m before it to 0.5 m after (the game
// checks after each step's move, so a release on the last step before the crest lands just past it).
export const CREST_POP_BEFORE = 1, CREST_POP_AFTER = 0.5;

export function resolveRollers(feature) {
  const { type, at, ...rest } = feature;
  const r = { face: 0.5, s: at, ...rest };
  r.end = r.s + r.count * r.spacing;
  r.crests = Array.from({ length: r.count }, (_, i) => r.s + (i + r.face) * r.spacing);
  return r;
}

// Height the set adds, u metres past its start.
export function rollerProfile(r, u) {
  if (u <= 0 || u >= r.count * r.spacing) return 0;
  const p = u % r.spacing, up = r.face * r.spacing;
  if (p < up) return r.height * (1 - Math.cos(Math.PI * p / up)) / 2;            // the face, up to the crest
  return r.height * (1 + Math.cos(Math.PI * (p - up) / (r.spacing - up))) / 2;  // the back, down to the trough
}

// If s is on the way up to a crest, how far before it (negative metres); otherwise null.
export function beforeCrest(r, s) {
  const u = s - r.s;
  if (u <= 0 || u >= r.count * r.spacing) return null;
  const p = u % r.spacing, up = r.face * r.spacing;
  return p < up ? p - up : null;
}

// Distance from s to the nearest crest (negative before it), if within the pop window; else null.
export function atCrest(r, s) {
  if (r.pop === false) return null;
  for (const c of r.crests) { const d = s - c; if (d > -CREST_POP_BEFORE && d < CREST_POP_AFTER) return d; }
  return null;
}
