// The mountain: all three trails on one hillside, from the trailhead clearing at the top to the
// finish clearing at the bottom, so riding through a gate onto another trail is seamless.
//
// Flow Monster's hill (with its jumps' terraces) is the mountain near Flow Monster. Away from it
// the mountain is the same hill smoothed out (averaged over 200 m down the hill), so the drops
// Flow Monster's jumps make are spread over the hillside instead of being steep steps across the
// whole mountain. The other trails are built on it (hill: { mountain: true }, see src/trail.js).
// The ground at any point is:
//  - the open hillside: the mountain, with banks that rise away from the nearest trail;
//  - near each trail, that trail's own ground (dish, berms, banks), blended into the hillside
//    from 6 m past its edge to 20 m past it, as on a trail on its own. Where two trails are close
//    (near the clearings) the nearer one counts most, so each trail's surface is its own;
//  - the clearings, levelled and graded into all of that.
// Away from the other trails and the clearings, Flow Monster's ground is exactly what it is on
// its own, so its jumps and lines are unchanged.
//
// createWorld(trailData) returns the trails as the game rides them (`trails`: each trail with the
// world's ground), the trails on their own (`ownTrails`, for the jump simulator), the clearings,
// and the world's ground.
// Plain maths only (no Three.js), so tests can run it in Node.
import { defineTrail } from './trail.js';
import { createClearing } from './trailhead.js';
import { smoothstep, movingAverage, tableOf } from './util.js';

const OFFSET_FADE_FROM = 20, OFFSET_FADE_TO = 65; // a mountain trail's hillside offset fades out between these distances (m)...
const RIDGE_SHARE = 16; // ...and between two trails it gives way to the other's, across the ridge between them (over about 30 m)
const SMOOTH_OVER = 100; // away from Flow Monster the mountain is its hill averaged over +/-100 m down the hill...
const OWN_HILL_TO = 30, SMOOTH_FROM = 90; // ...blending from its own hill within 30 m of it to that from 90 m
const NEAR_MATTERS = 30; // a trail's own ground shapes nothing more than 30 m from its centreline
const BANKS_LEVEL = 110; // banks are level (to a few cm) this far from a trail, so it needn't be measured
// A coarse map (10 m squares, out to 150 m) of how close each trail comes, so the exact (slower)
// sums are only done for trails near enough to matter.
const CELL = 10, MAP_REACH = 150, CELL_SLACK = CELL * Math.SQRT1_2 + 1.5;

export function createWorld(trailData) {
  const isMountain = d => !!(d.hill && d.hill.mountain);
  const base = defineTrail(trailData.find(d => !isMountain(d))); // Flow Monster: its hill is the mountain
  // Height of the mountain d metres down the hill, x across (without x: Flow Monster's own hill).
  // (Flow Monster's hill is worked out every 0.25 m: it's asked for very often)
  const ownHill = tableOf(d => base.hillHeight(d), -500, base.length + 700, 0.25);
  const smoothHill = movingAverage(ownHill, -400, base.length + 600, SMOOTH_OVER);
  const mountain = {
    height(d, x) {
      const own = ownHill(d);
      if (x === undefined) return own;
      const away = smoothstep((Math.abs(x - base.cx(d)) - OWN_HILL_TO) / (SMOOTH_FROM - OWN_HILL_TO));
      return away > 0 ? own + (smoothHill(d) - own) * away : own;
    },
  };
  const startLevel = base.ground(base.start.gate, 0), finishLevel = base.ground(base.length, 0);
  const trails = trailData.map(d => (isMountain(d) ? defineTrail(d, { mountain, startLevel, finishLevel }) : base));

  const map = distanceMap(trails);
  const offsetMaps = new Map(trails.filter(t => t.onMountain).map(t => [t, offsetMap(t)]));

  // Each trail, relative to world point (x, z): where it is on the trail (s, off), metres past
  // its edge, and its own ground there (near, with toHill). A trail that is too far away to
  // matter is marked far, with at least how far it is. `hint` = { trail, s, off }: where the point
  // is on one trail already (saves finding it again).
  function measure(x, z, hint) {
    const range = map.range(x, z); // [at least, at most] metres to each trail's centreline
    const nearest = Math.min(...range.map(r => r[1]));
    return trails.map((t, i) => {
      const least = range[i][0];
      // might shape the ground here, or have a share of the hillside (see blend)
      const matters = least < (t.onMountain ? OFFSET_FADE_TO : NEAR_MATTERS) || (least < BANKS_LEVEL && least - t.bankWidth < nearest + 5 * RIDGE_SHARE);
      if (!matters && !(hint && hint.trail === t.id)) return { t, far: true, past: least, bank: least - t.bankWidth };
      const at = hint && hint.trail === t.id ? hint : t.locate(x, z), a = Math.abs(at.off);
      return { t, at, past: a - t.halfWidth(at.s), bank: a - t.bankWidth, ...t.corridor(at.s, at.off) };
    });
  }

  // The ground before the clearings are cut in.
  function blend(x, z, m) {
    let weights = 0, nearSum = 0, reach = 0, bank = Infinity, offset = 0, shares = 0;
    for (const k of m) bank = Math.min(bank, k.bank);
    for (const k of m) {
      if (k.far) continue;
      // each trail's share of the hillside here: the nearest trail's, changing over across the
      // ridge between two trails (a trail too far away to measure has a share under 1%)
      const share = Math.exp(-(k.bank - bank) / RIDGE_SHARE);
      shares += share;
      // near this trail: its own ground, weighted so the nearest trail counts most
      const c = 1 - k.toHill;
      if (c > 0) {
        const w = c / (1 + Math.pow(Math.max(0, k.past), 4));
        weights += w; nearSum += w * k.near; reach = Math.max(reach, c);
      }
      // a mountain trail's run-outs and level changes shape the hillside round it, fading out
      if (k.t.onMountain) offset += share * offsetMaps.get(k.t)(x, z);
    }
    offset = shares > 0 ? offset / shares : 0; // (no trail near enough to measure: plain mountain)
    const far = reach < 1 ? base.hillside(x, z, bank, mountain.height(-z, x) + offset) : 0;
    const near = weights > 0 ? nearSum / weights : 0;
    return far + (near - far) * reach;
  }

  const gateOf = s => t => ({ difficulty: t.difficulty, opening: t.halfWidth(s(t)) + 0.6 });
  const trailhead = createClearing({
    origin: base.pointAt(base.start.gate), heading: base.headingAt(base.start.gate), level: startLevel, at: 'top',
    gates: trails.map(gateOf(t => t.start.gate)),
  });
  const finish = createClearing({
    origin: base.pointAt(base.length), heading: base.headingAt(base.length), level: finishLevel, at: 'bottom',
    gates: trails.map(gateOf(t => t.length)),
  });
  const clearings = [trailhead, finish];

  // Ground height at world point (x, z) (`height`), and the trails near it, nearest first
  // (`near`: { trail, s, off, past (metres past its edge) }). hint: see measure().
  function sample(x, z, hint) {
    const m = measure(x, z, hint);
    const pastEdge = () => Math.min(...m.map(k => k.past));
    let height = blend(x, z, m);
    for (const c of clearings) height = c.graded(height, x, z, pastEdge);
    const near = m.filter(k => !k.far).map(k => ({ trail: k.t, s: k.at.s, off: k.at.off, past: k.past })).sort((a, b) => a.past - b.past);
    return { height, near };
  }
  const groundAt = (x, z, hint) => sample(x, z, hint).height;
  const near = (x, z) => sample(x, z).near;

  const inClearing = (x, z) => clearings.some(c => c.inClearing(x, z));
  const world = {
    trails: null, ownTrails: trails, seed: base.seed, trailhead, finish, mountain, groundAt, sample, near, inClearing,
    // further than `dist` from every trail's centreline? (dist up to 130 m)
    farFromTrails: (x, z, dist) => map.range(x, z).every(r => r[0] >= dist),
    padAmount: (x, z) => Math.max(...clearings.map(c => c.padAmount(x, z))),
    keepClear: (x, z) => clearings.some(c => c.keepClear(x, z)),
    blocked: (x0, z0, x1, z1) => trailhead.blocked(x0, z0, x1, z1) || finish.blocked(x0, z0, x1, z1),
  };

  // Each trail as the game rides it: its own shape and features, the world's ground, and the
  // clearings (both ride like the trail: full grip, low rolling drag).
  world.trails = trails.map(t => {
    const gate = trailhead.gates.find(g => g.difficulty === t.difficulty);
    return {
      ...t, world,
      ground: (s, off) => { const p = t.pointAt(s, off); return groundAt(p.x, p.z, { trail: t.id, s, off }); },
      groundAt,
      onTrail: (s, off, x, z) => t.onTrail(s, off) || inClearing(x, z),
      trailhead: { ...trailhead, gate, dropIn: gate.dropIn, atGate: gate.atGate },
    };
  });
  world.trail = id => world.trails.find(t => t.id === id || t.difficulty === id);
  return world;
}

// For every 10 m square of the mountain, how close each trail's centreline comes to its centre
// (up to MAP_REACH). range(x, z) gives, for each trail, [at least, at most] metres from (x, z) to it.
function distanceMap(trails) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const samples = trails.map(t => {
    const list = [];
    for (let s = -120; s <= t.length + 240; s += 2) {
      const p = t.pointAt(s); list.push(p);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    return list;
  });
  const x0 = minX - MAP_REACH, z0 = minZ - MAP_REACH;
  const cols = Math.ceil((maxX + MAP_REACH - x0) / CELL), rows = Math.ceil((maxZ + MAP_REACH - z0) / CELL);
  const reach = Math.ceil(MAP_REACH / CELL);
  const closest = samples.map(list => {
    const cells = new Float32Array(cols * rows).fill(MAP_REACH);
    for (const p of list) {
      const ci = Math.floor((p.x - x0) / CELL), cj = Math.floor((p.z - z0) / CELL);
      for (let j = Math.max(0, cj - reach); j <= Math.min(rows - 1, cj + reach); j++) {
        for (let i = Math.max(0, ci - reach); i <= Math.min(cols - 1, ci + reach); i++) {
          const k = j * cols + i, dist = Math.hypot(x0 + (i + 0.5) * CELL - p.x, z0 + (j + 0.5) * CELL - p.z);
          if (dist < cells[k]) cells[k] = dist;
        }
      }
    }
    return cells;
  });
  return {
    range(x, z) {
      const i = Math.floor((x - x0) / CELL), j = Math.floor((z - z0) / CELL);
      const inside = i >= 0 && j >= 0 && i < cols && j < rows;
      return closest.map(cells => {
        const c = inside ? cells[j * cols + i] : MAP_REACH;
        return c >= MAP_REACH ? [MAP_REACH - CELL_SLACK, Infinity] : [Math.max(0, c - CELL_SLACK), c + CELL_SLACK];
      });
    },
  };
}


// How far the hillside round a mountain trail sits above (+) or below (-) the mountain, as a smooth
// map of the world (5 m squares, read back in straight lines between). Each point takes the
// trail's offset (trail.mountainOffset) averaged over the nearby trail, weighted by closeness
// (a bell curve 15 m wide), so inside a tight bend the two sides of the bend blend smoothly
// (taking the nearest point's offset made a step where the nearest point jumps across the bend).
// It fades out from 20 m to 65 m from the trail.
const OFFSET_CELL = 5, OFFSET_SPREAD = 15;
function offsetMap(t) {
  const samples = [];
  for (let s = -120; s <= t.length + 240; s += 4) samples.push({ ...t.pointAt(s), offset: t.mountainOffset(s) });
  const xs = samples.map(p => p.x), zs = samples.map(p => p.z);
  const x0 = Math.min(...xs) - OFFSET_FADE_TO, z0 = Math.min(...zs) - OFFSET_FADE_TO;
  const cols = Math.ceil((Math.max(...xs) + OFFSET_FADE_TO - x0) / OFFSET_CELL) + 1;
  const rows = Math.ceil((Math.max(...zs) + OFFSET_FADE_TO - z0) / OFFSET_CELL) + 1;
  const sum = new Float64Array(cols * rows), weight = new Float64Array(cols * rows), closest = new Float64Array(cols * rows).fill(Infinity);
  const reach = Math.ceil(OFFSET_FADE_TO / OFFSET_CELL);
  for (const p of samples) {
    const ci = Math.round((p.x - x0) / OFFSET_CELL), cj = Math.round((p.z - z0) / OFFSET_CELL);
    for (let j = Math.max(0, cj - reach); j <= Math.min(rows - 1, cj + reach); j++) {
      for (let i = Math.max(0, ci - reach); i <= Math.min(cols - 1, ci + reach); i++) {
        const k = j * cols + i, dist = Math.hypot(x0 + i * OFFSET_CELL - p.x, z0 + j * OFFSET_CELL - p.z);
        if (dist > OFFSET_FADE_TO + 5) continue;
        const w = Math.exp(-0.5 * (dist / OFFSET_SPREAD) ** 2);
        sum[k] += w * p.offset; weight[k] += w; closest[k] = Math.min(closest[k], dist);
      }
    }
  }
  const field = new Float64Array(cols * rows);
  for (let k = 0; k < field.length; k++) {
    if (weight[k] > 0) field[k] = sum[k] / weight[k] * (1 - smoothstep((closest[k] - OFFSET_FADE_FROM) / (OFFSET_FADE_TO - OFFSET_FADE_FROM)));
  }
  return (x, z) => {
    const u = (x - x0) / OFFSET_CELL, v = (z - z0) / OFFSET_CELL, i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= cols - 1 || j >= rows - 1) return 0;
    const fu = u - i, fv = v - j, k = j * cols + i;
    const top = field[k] + (field[k + 1] - field[k]) * fu, bottom = field[k + cols] + (field[k + cols + 1] - field[k + cols]) * fu;
    return top + (bottom - top) * fv;
  };
}
