// The trailhead: a flat clearing at the top of the hill where every run begins.
//
// withTrailhead(trail) returns the same trail with a level clearing cut into the hill just
// above its start gate, fenced all round. Three start gates stand side by side on the
// clearing's downhill edge (green, blue, black). Only the gate of the trail being ridden
// is open; the others are taped off ("coming soon") until their trails are built.
//
// The clearing is laid out square to the trail at its start gate:
//   u = metres past the gate line (negative = uphill, inside the clearing)
//   v = metres to the right of the centre gate
// Plain maths only (no Three.js), so tests can run it in Node.
import { smoothstep } from './util.js';

export const CLEARING_HALF_WIDTH = 25; // the clearing is 50 m across...
export const CLEARING_DEPTH = 36;      // ...and 36 m from the back fence to the gate line
const BANK_SLOPE = 0.7;  // outside the fence the ground is graded to banks no steeper than 0.7 (35 degrees)...
const BANK_FOOT = 6;     // ...easing in over the first 6 m
const PAD_EDGE = 2;      // the packed-dirt pad colour fades into the forest floor over 2 m
const GATE_SPACING = 15; // start gates stand 15 m apart
const CLEAR_MARGIN = 3;  // no plants within 3 m of the fence

// The three gates, left to right as you face downhill. `difficulty` matches a trail's.
export const GATES = [
  { difficulty: 'green', name: 'Jolly Green Giant', colour: '#3f9a4a' },
  { difficulty: 'blue', name: 'Flow Monster', colour: '#2f6fc0' },
  { difficulty: 'black', name: 'Back in Black', colour: '#1b1b1b' },
];

export function withTrailhead(trail) {
  const gateS = trail.start.gate;
  const origin = trail.pointAt(gateS), h = trail.headingAt(gateS);
  const fx = Math.sin(h), fz = -Math.cos(h); // forward, down the trail
  const rx = Math.cos(h), rz = Math.sin(h);  // right
  const level = trail.ground(gateS, 0);      // the clearing is level with the trail at the gate
  const opening = trail.halfWidth(gateS) + 0.6; // half the width of each gate, post to post

  // This trail's gate is in its slot; the clearing is centred on the middle gate.
  const slot = GATES.findIndex(g => g.difficulty === trail.difficulty);
  const centreV = -(slot - 1) * GATE_SPACING; // sideways from this trail's gate to the middle one
  const gates = GATES.map((g, i) => ({ ...g, v: (i - 1) * GATE_SPACING, open: i === slot }));

  // World point (x, z) in clearing coordinates. v is measured from the centre gate.
  function local(x, z) {
    const dx = x - origin.x, dz = z - origin.z;
    return { u: dx * fx + dz * fz, v: dx * rx + dz * rz - centreV };
  }
  // ...and back again.
  function world(u, v) {
    const w = v + centreV;
    return { x: origin.x + u * fx + w * rx, z: origin.z + u * fz + w * rz };
  }

  // How far (m) a point is outside the clearing's fence, 0 inside.
  function outside(u, v) {
    const along = Math.max(0, -CLEARING_DEPTH - u, u), across = Math.max(0, Math.abs(v) - CLEARING_HALF_WIDTH);
    return Math.hypot(along, across);
  }
  const inClearing = (x, z) => { const { u, v } = local(x, z); return outside(u, v) === 0; };

  // Height of the cut (or fill) bank d metres outside the fence: rising at up to BANK_SLOPE,
  // with a rounded foot so the pad doesn't end in a sharp corner.
  const bankUp = d => BANK_SLOPE * (d < BANK_FOOT ? d * d / (2 * BANK_FOOT) : d - BANK_FOOT / 2);

  // The clearing is dug into the hill: level inside the fence; outside, the hill can rise
  // above (or fall below) the clearing no faster than a graded bank, so the ground keeps the
  // hill's shape wherever the hill is gentler than that. Past the gate line the trail itself
  // is left alone, so only the ground beside it is graded (its dish and banks start at the gate).
  function graded(raw, x, z, at) {
    const { u, v } = local(x, z), d = outside(u, v);
    const rise = bankUp(d);
    if (Math.abs(raw - level) <= rise) return raw; // the hill is gentle enough here already
    const h = Math.min(level + rise, Math.max(level - rise, raw));
    if (u <= 0) return h;
    const { s, off } = at();
    const past = Math.abs(off) - trail.halfWidth(s) - 0.5; // metres past the trail edge
    const keepTrail = (1 - smoothstep(past / 6)) * smoothstep(u / 2);
    return h + (raw - h) * keepTrail;
  }

  const groundAt = (x, z) => graded(trail.groundAt(x, z), x, z, () => trail.locate(x, z));
  function ground(s, off) {
    const p = trail.pointAt(s, off);
    return graded(trail.ground(s, off), p.x, p.z, () => ({ s, off }));
  }

  // The whole clearing rides like the trail (packed dirt): full grip, low rolling drag.
  const onTrail = (s, off, x, z) => trail.onTrail(s, off, x, z) || inClearing(x, z);

  // Share of packed-dirt pad colour at a point (1 on the pad, fading out past the fence).
  function padAmount(x, z) {
    const { u, v } = local(x, z);
    return 1 - smoothstep(outside(u, v) / PAD_EDGE);
  }

  // Plants keep off the pad and away from the fence.
  const keepClear = (x, z) => { const { u, v } = local(x, z); return outside(u, v) < CLEAR_MARGIN; };

  // Moving from (x0, z0) to (x1, z1): does the fence or a closed gate stop you?
  // Returns null (carry on), { gate } for a closed gate, or { fence: true }.
  function blocked(x0, z0, x1, z1) {
    const a = local(x0, z0), b = local(x1, z1);
    const wasIn = outside(a.u, a.v) === 0, isIn = outside(b.u, b.v) === 0;
    if (wasIn === isIn) return null;
    // crossing the fence line somewhere: only allowed through an open gate on the gate line
    const p = wasIn ? b : a;
    if (p.u > 0 && Math.abs(p.v) <= CLEARING_HALF_WIDTH) {
      const gate = gates.find(g => Math.abs(p.v - g.v) <= opening);
      if (gate && gate.open) return null;
      if (gate) return { gate };
    }
    return { fence: true };
  }

  // Where a run from the trailhead begins: 8 m in from the back fence, in line with this
  // trail's gate, facing it.
  const dropIn = { ...world(-CLEARING_DEPTH + 8, gates[slot].v), h };

  return {
    ...trail,
    ground, groundAt, onTrail,
    trailhead: {
      gates, opening, level, dropIn, heading: h,
      halfWidth: CLEARING_HALF_WIDTH, depth: CLEARING_DEPTH,
      local, world, inClearing, padAmount, keepClear, blocked,
    },
  };
}
