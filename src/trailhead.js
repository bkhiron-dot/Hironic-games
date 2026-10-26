// The clearings on the mountain: the trailhead at the top, where every run begins, and the
// finish clearing at the bottom, where all three trails end.
//
// createClearing() makes a level, fenced pad cut into the hill, with three gates side by side on
// its edge (green, blue, black), one for each trail. At the trailhead the pad is uphill of the
// gates and the trails start through them; at the finish it is downhill of them and the trails
// finish through them. Riding out of the trailhead through a gate puts you on that gate's trail.
//
// A clearing is laid out square to Flow Monster at its gate:
//   u = metres past the gate line, down the hill (the trailhead's pad is at negative u)
//   v = metres to the right of the centre (blue) gate
// Plain maths only (no Three.js), so tests can run it in Node.
import { smoothstep } from './util.js';

export const CLEARING_HALF_WIDTH = 25; // a clearing is 50 m across...
export const CLEARING_DEPTH = 36;      // ...and 36 m from its back fence to the gate line
const BANK_SLOPE = 0.7;  // outside the fence the ground is graded to banks no steeper than 0.7 (35 degrees)...
const BANK_FOOT = 6;     // ...easing in over the first 6 m
const PAD_EDGE = 2;      // the packed-dirt pad colour fades into the forest floor over 2 m
export const GATE_SPACING = 15; // gates stand 15 m apart
const CLEAR_MARGIN = 3;  // no plants within 3 m of the fence

// The three gates, left to right as you face downhill. `difficulty` matches a trail's.
export const GATES = [
  { difficulty: 'green', name: 'Jolly Green Giant', colour: '#3f9a4a' },
  { difficulty: 'blue', name: 'Flow Monster', colour: '#2f6fc0' },
  { difficulty: 'black', name: 'Back in Black', colour: '#1b1b1b' },
];

// origin, heading: Flow Monster's gate line here and its direction of travel. level: the pad's
// height. at: 'top' (the trailhead) or 'bottom' (the finish). gates: { difficulty, opening }
// for each built trail (opening = half the gate's width, post to post). Trails not built yet
// get a taped-off gate.
export function createClearing({ origin, heading, level, at, gates: built }) {
  const fx = Math.sin(heading), fz = -Math.cos(heading); // forward, down the hill
  const rx = Math.cos(heading), rz = Math.sin(heading);  // right
  const top = at === 'top';
  const padFrom = top ? -CLEARING_DEPTH : 0, padTo = top ? 0 : CLEARING_DEPTH; // u range of the pad
  const gates = GATES.map((g, i) => {
    const b = built.find(t => t.difficulty === g.difficulty);
    return { ...g, v: (i - 1) * GATE_SPACING, open: !!b, opening: b ? b.opening : 3 };
  });

  // World point (x, z) in clearing coordinates, and back again.
  function local(x, z) {
    const dx = x - origin.x, dz = z - origin.z;
    return { u: dx * fx + dz * fz, v: dx * rx + dz * rz };
  }
  const world = (u, v) => ({ x: origin.x + u * fx + v * rx, z: origin.z + u * fz + v * rz });

  // How far (m) a point is outside the clearing's fence, 0 inside.
  function outside(u, v) {
    const along = Math.max(0, padFrom - u, u - padTo), across = Math.max(0, Math.abs(v) - CLEARING_HALF_WIDTH);
    return Math.hypot(along, across);
  }
  const inClearing = (x, z) => { const { u, v } = local(x, z); return outside(u, v) === 0; };
  const distanceOutside = (x, z) => { const { u, v } = local(x, z); return outside(u, v); };

  // Height of the cut (or fill) bank d metres outside the fence: rising at up to BANK_SLOPE,
  // with a rounded foot so the pad doesn't end in a sharp corner.
  const bankUp = d => BANK_SLOPE * (d < BANK_FOOT ? d * d / (2 * BANK_FOOT) : d - BANK_FOOT / 2);

  // The clearing is dug into the hill: level inside the fence; outside, the hill can rise
  // above (or fall below) the clearing no faster than a graded bank, so the ground keeps the
  // hill's shape wherever the hill is gentler than that. On the trails' side of the gate line
  // the trails themselves are left alone, so only the ground beside them is graded.
  // pastEdge() says how far (m) the point is past the nearest trail's edge.
  function graded(raw, x, z, pastEdge) {
    const { u, v } = local(x, z), d = outside(u, v);
    const rise = bankUp(d);
    if (Math.abs(raw - level) <= rise) return raw; // the hill is gentle enough here already
    const h = Math.min(level + rise, Math.max(level - rise, raw));
    const trailSide = top ? u : -u; // metres from the gate line toward the trails
    if (trailSide <= 0) return h;
    const past = pastEdge() - 0.5;
    const keepTrail = (1 - smoothstep(past / 6)) * smoothstep(trailSide / 2);
    return h + (raw - h) * keepTrail;
  }

  // Share of packed-dirt pad colour at a point (1 on the pad, fading out past the fence).
  function padAmount(x, z) {
    const { u, v } = local(x, z);
    return 1 - smoothstep(outside(u, v) / PAD_EDGE);
  }

  // Plants keep off the pad and away from the fence.
  const keepClear = (x, z) => { const { u, v } = local(x, z); return outside(u, v) < CLEAR_MARGIN; };

  // Moving from (x0, z0) to (x1, z1): does the fence or a closed gate stop you?
  // Returns null (carry on, or came in through a gate), { gate } for a closed gate, { fence: true },
  // or { out: gate } when riding out through an open gate.
  function blocked(x0, z0, x1, z1) {
    const a = local(x0, z0), b = local(x1, z1);
    const wasIn = outside(a.u, a.v) === 0, isIn = outside(b.u, b.v) === 0;
    if (wasIn === isIn) return null;
    // crossing the fence line somewhere: only allowed through an open gate on the gate line
    const p = wasIn ? b : a;
    const gateSide = top ? p.u > 0 : p.u < 0;
    if (gateSide && Math.abs(p.v) <= CLEARING_HALF_WIDTH) {
      const gate = gates.find(g => Math.abs(p.v - g.v) <= g.opening);
      if (gate && gate.open) return wasIn ? { out: gate } : null;
      if (gate) return { gate };
    }
    return { fence: true };
  }

  // At the trailhead, where a run on each trail begins: 8 m in from the back fence, in line
  // with its gate, facing it (dropIn); and just above its gate ("ride again", atGate).
  for (const g of gates) {
    g.dropIn = { ...world(-CLEARING_DEPTH + 8, g.v), h: heading };
    g.atGate = { ...world(-1.5, g.v), h: heading };
  }

  return {
    at, gates, level, heading, halfWidth: CLEARING_HALF_WIDTH, depth: CLEARING_DEPTH,
    local, world, inClearing, distanceOutside, padAmount, keepClear, blocked, graded,
  };
}
