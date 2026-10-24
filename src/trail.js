// The v1 track as plain maths: centreline, width, jumps, berms and timing splits.
// No Three.js here, so the tests can run it in Node.
//
// Conventions: s = distance down the track (m), off = sideways offset from the
// centreline (m, +x side positive). See CLAUDE.md "Coordinate and track conventions".
import { clamp, smoothstep } from './util.js';
import { resolveJump, jumpProfile } from './jumps.js';

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

/* ---------- Jumps (shapes in src/jumps.js) ---------- */
export const JUMPS = [
  resolveJump({ kind: 'normal', at: 170 }),
  resolveJump({ kind: 'popOptional', at: 410 }),
  resolveJump({ kind: 'normal', at: 690 }),
  resolveJump({ kind: 'bigPop', at: 960 }),
];

// Extra height the jumps add at distance s.
export function jumpHeight(s) {
  let h = 0;
  for (const j of JUMPS) h += jumpProfile(j, s - j.s);
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
