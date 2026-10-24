// Straight-line jump simulator.
// Rides a bike along the centreline of a jump at a fixed speed, launches off the lip,
// and reports where it lands and how hard. Uses the same ground shape and landing
// rules as the game (see CLAUDE.md "Tuned physics"), so if the game physics change,
// change them here too and re-run `npm test`.

export const G_GROUND = 9.8;
export const G_AIR = 15;
export const TRAVEL = 0.55;      // m of usable suspension + leg travel
export const LANDING_DECEL = 38; // m/s^2 the suspension can absorb
export const BASE_GRADE = -0.2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// Landing shape defined by its slope: rolls over (first 20%), holds `pitch` (to 50%),
// then eases back to the trail grade.
function landRel(t, pitch, p1 = 0.2, p2 = 0.5) {
  if (t < p1) return -pitch * t * t / (2 * p1);
  if (t < p2) return -pitch * p1 / 2 - pitch * (t - p1);
  const q = t - p2;
  return -pitch * p1 / 2 - pitch * (p2 - p1) - pitch * (q - q * q / (2 * (1 - p2)));
}

// Jump presets exactly as tuned in v1.
export const JUMPS = {
  normal:      { kick: 9,  lip: 1.1, gap: 6,  hole: -1.0, knuck: 1.0, pitch: 0.3,  land: 30 },
  bigPop:      { kick: 10, lip: 1.5, gap: 12, hole: -1.2, knuck: 2.4, pitch: 0.4,  land: 30 },
  bigOptional: { kick: 10, lip: 1.5, gap: 9,  hole: -1.2, knuck: 1.2, pitch: 0.55, land: 42 },
};

// Height of the jump relative to the base grade, u metres past the lip (negative = on the kicker).
export function jumpRel(j, u, holeLen = 1.5) {
  if (u <= -j.kick) return 0;
  if (u < 0) { const t = (u + j.kick) / j.kick; return j.lip * t * t; }
  if (u < holeLen) return j.hole;
  if (u < j.gap) return j.hole + (j.knuck - j.hole) * smooth((u - holeLen) / (j.gap - holeLen));
  if (u < j.gap + j.land) return j.knuck + j.land * landRel((u - j.gap) / j.land, j.pitch);
  return j.knuck + j.land * landRel(1, j.pitch);
}

export function classify(use) {
  if (use < 0.55) return 'smooth';
  if (use < 1.0) return 'heavy';
  if (use < 1.35) return 'small crash';
  return 'big crash';
}

// Simulate one jump. `pop` is the extra upward speed (m/s) added at the lip
// (full pop = 3.0). Returns { landAt, use, outcome }.
export function simulate(j, kmh, pop = 0) {
  const ground = u => BASE_GRADE * u + jumpRel(j, u);
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

// `node tools/jump-sim.js` prints a table for every preset.
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [name, j] of Object.entries(JUMPS)) {
    for (const pop of [0, 3]) {
      console.log(`\n${name}${pop ? ' (full pop)' : ' (no pop)'}`);
      for (const r of sweep(j, pop)) console.log(`  ${String(r.kmh).padStart(3)} km/h  lands ${r.landAt?.toFixed(1).padStart(5)} m  ${r.outcome}`);
    }
  }
}
