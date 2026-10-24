// Straight-line jump simulator.
// Rides a bike along the centreline of a jump at a fixed speed, launches off the lip,
// and reports where it lands and how hard. Uses the same ground shape and landing
// rules as the game (see CLAUDE.md "Tuned physics"), so if the game physics change,
// change them here too and re-run `npm test`.
import { resolveJump, jumpProfile } from '../src/jumps.js';

export const G_GROUND = 9.8;
export const G_AIR = 15;
export const TRAVEL = 0.55;      // m of usable suspension + leg travel
export const LANDING_DECEL = 38; // m/s^2 the suspension can absorb
export const BASE_GRADE = -0.2;

// A jump of one kind on its own, lip at u = 0, for simulating.
export const jumpOfKind = kind => resolveJump({ kind, at: 0 });

export function classify(use) {
  if (use < 0.55) return 'smooth';
  if (use < 1.0) return 'heavy';
  if (use < 1.35) return 'small crash';
  return 'big crash';
}

// Simulate one jump (a resolved jump, see src/jumps.js). `pop` is the extra upward
// speed (m/s) added at the lip (full pop = 3.0). Returns { landAt, use, outcome }.
export function simulate(j, kmh, pop = 0) {
  // Approximation (agreed): a straight, constant -0.2 grade under the jump. The real trail
  // profile moves the smooth ranges by 1 km/h at most.
  const ground = u => BASE_GRADE * u + jumpProfile(j, u);
  const dt = 1 / 240;
  let v = kmh / 3.6, u = -j.kick - 3, y = ground(u), vy = BASE_GRADE * v, air = false, popped = false;
  while (u < j.gap + j.land + 60) {
    u += v * dt;
    const gn = ground(u), slope = (ground(u + 0.6) - gn) / 0.6;
    if (air) {
      if (pop && !popped) { vy += pop; popped = true; }
      vy -= G_AIR * dt; y += vy * dt;
      if (y <= gn) {
        const vi = Math.max(0, (slope * v - vy) / Math.sqrt(1 + slope * slope));
        const use = vi * vi / (2 * LANDING_DECEL) / TRAVEL;
        return { landAt: u, use, outcome: classify(use) };
      }
    } else {
      const follow = (gn - y) / dt;
      if (follow < vy - G_GROUND * dt && follow < -1.5) { air = true; vy -= G_AIR * dt; y += vy * dt; }
      else { vy = follow; y = gn; }
    }
  }
  return { landAt: null, use: 0, outcome: 'rolled' };
}

// Table of outcomes across a speed range, for reports.
export function sweep(j, pop = 0, from = 30, to = 76, step = 2) {
  const rows = [];
  for (let kmh = from; kmh <= to; kmh += step) rows.push({ kmh, ...simulate(j, kmh, pop) });
  return rows;
}

// `npm run jumps` prints a table for every jump on every trail.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { TRAILS } = await import('../src/trails/index.js');
  for (const trail of TRAILS) for (const j of trail.jumps) {
    for (const pop of [0, 3]) {
      console.log(`\n${trail.name}, jump at ${j.s} m (${j.kind})${pop ? ', full pop' : ', no pop'}`);
      for (const r of sweep(j, pop)) console.log(`  ${String(r.kmh).padStart(3)} km/h  lands ${r.landAt?.toFixed(1).padStart(5)} m  ${r.outcome}`);
    }
  }
}
