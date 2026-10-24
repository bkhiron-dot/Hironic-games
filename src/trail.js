// The v1 track as plain maths: centreline, width, jumps, berms and timing splits.
// No Three.js here, so the tests can run it in Node.
//
// Conventions: s = distance down the track (m), off = sideways offset from the
// centreline (m, +x side positive). See CLAUDE.md "Coordinate and track conventions".
import { clamp, smoothstep } from './util.js';

export const TRACK_LENGTH = 1200;
export const SPLITS = [300, 600, 900, 1200];             // timing gates; the last one is the finish
export const ROCKY_SECTIONS = [[230, 290], [760, 830]];  // extra rocks beside the trail here
export const TRACK_SEED = 20261024;                      // seed for terrain colour noise, forest and mountains

// Centreline x position, and its first and second derivatives (for heading and curvature).
export const cx = s => 22 * Math.sin(s / 45) + 8 * Math.sin(s / 23 + 1);
export const cxd = s => 22 / 45 * Math.cos(s / 45) + 8 / 23 * Math.cos(s / 23 + 1);
export const cxdd = s => -22 / 2025 * Math.sin(s / 45) - 8 / 529 * Math.sin(s / 23 + 1);

// Half the trail width (m). Wanders between 2.3 and 5.4 m.
export const halfWidth = s => clamp(3.4 + 1.4 * Math.sin(s / 63 + 0.5) + 0.7 * Math.sin(s / 19), 2.3, 5.4);

// Signed curvature of the centreline (1/m), using the proper formula cx'' / (1 + cx'^2)^1.5.
export function curvature(s) {
  const d = cxd(s);
  return cxdd(s) / Math.pow(1 + d * d, 1.5);
}

/* ---------- Jumps ----------
   Profile measured from the lip (u = 0): kicker -> gap with a hole -> face up to the
   knuckle at u = gap -> landing that rolls over (first 20%), holds a steep pitch (to 50%),
   then eases back to trail grade. The run-out continues at the new, lower level.
   short / sweet0 / sweet1 / long are where the amber and green landing flags stand.
   Landing ranges are pinned by tests (see tools/jump-sim.js). */
const HOLE_LENGTH = 1.5, LANDING_LENGTH = 30, ROLLOVER_END = 0.2, PITCH_END = 0.5;

// Normal jump: lands smooth at about 46-68 km/h at the lip without a pop.
const normalJump = s => ({ s, big: false, kick: 9, lip: 1.1, gap: 6, hole: -1.0, knuck: 1.0, pitch: 0.3,
  short: 5.3, sweet0: 5.6, sweet1: 20, long: 23 });

// Big jump after split 1: clears without a pop (smooth at about 52-66 km/h);
// a full pop helps if you're slow (smooth at about 46-54 km/h).
const popOptionalJump = s => ({ s, big: true, popOptional: true, kick: 10, lip: 1.5, gap: 9, hole: -1.2, knuck: 1.2,
  pitch: 0.55, land: 42, short: 8.6, sweet0: 9.2, sweet1: 26, long: 30 });

// Big jump that needs a pop: full pop lands smooth at about 52-64 km/h; without one you case it.
const bigPopJump = s => ({ s, big: true, kick: 10, lip: 1.5, gap: 12, hole: -1.2, knuck: 2.4, pitch: 0.4,
  short: 10.6, sweet0: 11.8, sweet1: 24.5, long: 28 });

// Landing height relative to the knuckle, for t = 0..1 along the landing, defined by its slope.
export function landingShape(t, pitch) {
  if (t < ROLLOVER_END) return -pitch * t * t / (2 * ROLLOVER_END);
  if (t < PITCH_END) return -pitch * ROLLOVER_END / 2 - pitch * (t - ROLLOVER_END);
  const q = t - PITCH_END;
  return -pitch * ROLLOVER_END / 2 - pitch * (PITCH_END - ROLLOVER_END) - pitch * (q - q * q / (2 * (1 - PITCH_END)));
}

export const JUMPS = [normalJump(170), popOptionalJump(410), normalJump(690), bigPopJump(960)];
for (const j of JUMPS) {
  j.land = j.land || LANDING_LENGTH;
  j.drop = -landingShape(1, j.pitch) * j.land; // how much lower the trail is after the jump
  j.end = j.s + j.gap + j.land;
}

// Extra height the jumps add at distance s.
export function jumpHeight(s) {
  let h = 0;
  for (const j of JUMPS) {
    const u = s - j.s;
    if (u <= -j.kick) continue;
    if (u < 0) { const t = (u + j.kick) / j.kick; h += j.lip * t * t; }
    else if (u < HOLE_LENGTH) h += j.hole;
    else if (u < j.gap) h += j.hole + (j.knuck - j.hole) * smoothstep((u - HOLE_LENGTH) / (j.gap - HOLE_LENGTH));
    else if (u < j.gap + j.land) h += j.knuck + j.land * landingShape((u - j.gap) / j.land, j.pitch);
    else h += j.knuck - j.drop;
  }
  return h;
}

// If s is on a kicker, returns the jump and u (metres before the lip, negative). Otherwise null.
export function kickerAt(s) {
  for (const j of JUMPS) {
    const u = s - j.s;
    if (u > -j.kick && u < 0) return { j, u };
  }
  return null;
}

// Which part of a jump the point s is on: gap, knuckle, sweet, bottom, flat, or null.
export function jumpZone(s) {
  for (const j of JUMPS) {
    const u = s - j.s;
    if (u >= 0 && u < j.short) return 'gap';
    if (u >= j.short && u < j.sweet0) return 'knuckle';
    if (u >= j.sweet0 && u <= j.sweet1) return 'sweet';
    if (u > j.sweet1 && u <= j.long) return 'bottom';
    if (u > j.long && u < j.gap + j.land + 25) return 'flat';
  }
  return null;
}

/* ---------- Berms ----------
   On tight corners the outside of the trail curves up like a wall (up to 1.7 m at the edge).
   The higher you ride on it, the more it holds you in. Faded out around jumps. */
export function bermAmount(s) {
  let b = smoothstep((Math.abs(curvature(s)) - 0.010) / 0.010) * 1.7;
  for (const j of JUMPS) {
    const d = Math.max((j.s - j.kick - 20) - s, s - j.end);
    if (d < 8) b *= smoothstep(d / 8);
  }
  return b;
}

// Berm height at (s, off), given the half width w there.
export function bermHeight(s, off, w) {
  const b = bermAmount(s);
  if (b <= 0.01) return 0;
  const outside = off * -Math.sign(curvature(s)); // how far toward the outside of the turn
  if (outside <= 0) return 0;
  if (outside <= w) { const t = outside / w; return b * t * t; }
  return b * (1 - 0.6 * smoothstep((outside - w) / 2.5));
}
