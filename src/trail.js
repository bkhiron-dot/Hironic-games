// defineTrail() turns trail data (see src/trails/flow-monster.js) into the functions the game
// uses: where the trail goes, how wide it is, how high the ground is, and what's on it.
// It checks the data first and explains any mistake in plain words.
// Plain maths only (no Three.js), so tests can run it in Node.
//
// Conventions (see CLAUDE.md): s = distance ALONG the winding trail (m); off = sideways
// offset, square to the trail (m, positive to the rider's right); d = distance straight
// down the hill (world z = -d), which is what the hill and the centreline waves use.
//
// The ground has two parts that blend together:
//  - near the trail: the riding line (hill under the centreline + jumps), worn into a
//    shallow dish, with berm walls and banks rising either side, as in v1;
//  - further out: the hill itself, which depends only on world position, so the inside of
//    a tight bend can never become a cliff. Each jump's drop is built into the hill as a
//    gentle terrace, so trail and hill stay level with each other.
import { clamp, smoothstep } from './util.js';
import { resolveJump, jumpProfile, SHAPE_KEYS } from './jumps.js';
import { createPath } from './path.js';

export const SPLIT_COUNT = 4; // 3 splits + the finish: one high-score board each
export const DIFFICULTIES = ['green', 'blue', 'black']; // trail grades, easiest first

// Shape of the ground beside the trail (the same on every trail for now).
const DISH_DEPTH = 0.1;           // the trail is worn into a shallow dish this deep (m)
const BANK_RISE = 0.18;           // banks rise 0.18 * (metres past the edge)^1.25 either side...
const BANK_LEVEL_FROM = 50, BANK_LEVEL_SPAN = 16; // ...then level off from 50 m out (to about 34 m high, v1's highest)
const BLEND_START = 6, BLEND_END = 20; // past the trail edge, the ground blends into the hill (m)
export const NEAR_REACH = BLEND_END + 6; // how far past the edge the detailed ground mesh goes
const BERM_FADE_BEFORE_JUMP = 20; // berms fade out from this far before a kicker (m)...
const BERM_FADE_LENGTH = 8;       // ...over this distance, and back in after the landing
const BERM_ADJUST_FADE = 5;       // a berm adjustment blends in and out over this distance (m)
const BERM_MAX_PER_WIDTH = 0.85;  // a berm wall is at most 0.85 x the half width high, so on narrow
                                  // sections it is never steeper than about 0.85 m per 0.5 m at the edge
const PATH_MARGIN = 120;          // the path is measured this far beyond each end (m)

const waveList = list => (list || []).map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
const sumWaves = (ws, t) => { let v = 0; for (const w of ws) v += w.amp * Math.sin(t / w.period + w.phase); return v; };

export function defineTrail(data) {
  checkTrail(data);
  const { length, splits, start } = data;
  const path = createPath(data.centreline, -PATH_MARGIN, length + PATH_MARGIN * 2);
  checkBends(data, path);
  const widthWaves = waveList(data.width.waves);
  const hillWaves = waveList(data.hill.waves);
  const chutes = data.hill.chutes || [];
  const jumps = data.features.filter(f => f.type === 'jump').map(resolveJump).sort((a, b) => a.s - b.s);
  const berms = { auto: true, adjust: [], ...data.berms };
  const bermRamp = berms.fullCurvature - berms.startCurvature;
  const bankWidth = (data.width.min + data.width.max) / 2; // typical half width, for the far banks

  // Half the trail width (m), along the trail.
  const halfWidth = s => clamp(data.width.base + sumWaves(widthWaves, s), data.width.min, data.width.max);
  const curvature = s => path.curvatureAt(s);

  // How much lower the trail is after jump j, ramping in across the jump (0 before it).
  const terrace = (j, s) => (j.knuck - j.drop) * smoothstep((s - (j.s - j.kick)) / (j.end - (j.s - j.kick)));

  // The hill, at downhill distance d: grade, gentle waves, steeper chutes, and jump terraces.
  function hillBase(d) {
    let h = data.hill.grade * d + sumWaves(hillWaves, d);
    for (const c of chutes) h += c.grade * clamp(d - c.from, 0, c.to - c.from);
    return h;
  }
  function hillHeight(d) {
    let h = hillBase(d);
    if (jumps.length) { const s = path.pathAt(d); for (const j of jumps) h += terrace(j, s); }
    return h;
  }

  // Height the jumps add along the trail (kickers, gaps, landings and their drops).
  function jumpHeight(s) {
    let h = 0;
    for (const j of jumps) h += jumpProfile(j, s - j.s);
    return h;
  }

  // Height of the riding line on the centreline, before the dish and berms.
  const lineHeight = s => hillBase(path.downhillAt(s)) + jumpHeight(s);

  // If s is on a kicker, returns the jump and u (metres before the lip, negative). Otherwise null.
  function kickerAt(s) {
    for (const j of jumps) {
      const u = s - j.s;
      if (u > -j.kick && u < 0) return { j, u };
    }
    return null;
  }

  // Which part of a jump the point s is on: gap, knuckle, sweet, bottom, flat, or null.
  function jumpZone(s) {
    for (const j of jumps) {
      const u = s - j.s;
      if (u >= 0 && u < j.short) return 'gap';
      if (u >= j.short && u < j.sweet0) return 'knuckle';
      if (u >= j.sweet0 && u <= j.sweet1) return 'sweet';
      if (u > j.sweet1 && u <= j.long) return 'bottom';
      if (u > j.long && u < j.gap + j.land + 25) return 'flat';
    }
    return null;
  }

  // Berm wall height at the trail edge here, after any adjustments for this stretch.
  function bermWallHeight(s) {
    let h = berms.height;
    for (const a of berms.adjust) {
      if (s <= a.from - BERM_ADJUST_FADE || s >= a.to + BERM_ADJUST_FADE) continue;
      const t = smoothstep((s - a.from + BERM_ADJUST_FADE) / BERM_ADJUST_FADE) * smoothstep((a.to + BERM_ADJUST_FADE - s) / BERM_ADJUST_FADE);
      h += (a.height - h) * t;
    }
    return Math.min(h, BERM_MAX_PER_WIDTH * halfWidth(s));
  }

  /* Berms: on tight corners the outside of the trail curves up like a wall. They are built
     automatically from how sharply the trail bends; the higher you ride on one, the more it
     holds you in. Faded out around jumps. */
  function bermAmount(s) {
    if (!berms.auto) return 0;
    let b = smoothstep((Math.abs(curvature(s)) - berms.startCurvature) / bermRamp) * bermWallHeight(s);
    for (const j of jumps) {
      const d = Math.max((j.s - j.kick - BERM_FADE_BEFORE_JUMP) - s, s - j.end);
      if (d < BERM_FADE_LENGTH) b *= smoothstep(d / BERM_FADE_LENGTH);
    }
    return b;
  }

  // Berm height at (s, off), given the half width w there.
  function bermHeight(s, off, w) {
    const b = bermAmount(s);
    if (b <= 0.01) return 0;
    const outside = off * -Math.sign(curvature(s)); // how far toward the outside of the turn
    if (outside <= 0) return 0;
    if (outside <= w) { const t = outside / w; return b * t * t; }
    return b * (1 - 0.6 * smoothstep((outside - w) / 2.5));
  }

  // Height of the banks e metres past the trail edge: v1's rise, levelling off further out.
  function bankRise(e) {
    const eased = e < BANK_LEVEL_FROM ? e : BANK_LEVEL_FROM + BANK_LEVEL_SPAN * Math.tanh((e - BANK_LEVEL_FROM) / BANK_LEVEL_SPAN);
    return Math.pow(eased, 1.25) * BANK_RISE;
  }

  // Ground height at path position (s, off), which is world point (x, z).
  function surface(s, off, x, z) {
    const a = Math.abs(off), w = halfWidth(s);
    const toHill = smoothstep((a - w - BLEND_START) / (BLEND_END - BLEND_START));
    let near = 0, far = 0;
    if (toHill < 1) {
      near = lineHeight(s) + bermHeight(s, off, w);
      if (a > w) {
        // off the trail the banks rise away, with gentle lumps
        const e = a - w;
        near += bankRise(e) + 0.25 * Math.sin(s * 0.31 + off * 0.7) * Math.min(1, e / 2);
      } else {
        near -= DISH_DEPTH * (1 - (a / w) * (a / w));
      }
    }
    if (toHill > 0) {
      const d = -z, e = Math.max(0, a - bankWidth);
      far = hillHeight(d) + bankRise(e) + 0.25 * Math.sin(d * 0.31 + x * 0.7);
    }
    return near + (far - near) * toHill;
  }

  // Ground at path position (s, off). Near the trail this is the same as groundAt() there.
  function ground(s, off) {
    const p = path.pointAt(s, off);
    return surface(s, off, p.x, p.z);
  }

  // Ground at world position (x, z).
  function groundAt(x, z) {
    const at = path.locate(x, z);
    return surface(at.s, at.off, x, z);
  }

  return {
    id: data.id, name: data.name, difficulty: data.difficulty, length, seed: data.seed, splits, start,
    scenery: { rocky: [], ...data.scenery }, jumps, berms,
    halfWidth, curvature, hillHeight, jumpHeight, lineHeight, kickerAt, jumpZone,
    bermAmount, bermHeight, ground, groundAt,
    // on the riding surface (full grip, low drag)? (x, z) is the same point in the world
    onTrail: (s, off) => Math.abs(off) <= halfWidth(s) + 0.3,
    pointAt: path.pointAt, headingAt: path.headingAt, locate: path.locate,
    downhillAt: path.downhillAt, pathAt: path.pathAt,
  };
}

/* ---------- Checking trail data ----------
   Mistakes in a trail file stop the game with a message saying what to fix,
   rather than giving a strange track. */
function checkTrail(data) {
  const name = data && data.id ? `Trail "${data.id}"` : 'Trail';
  const fail = message => { throw new Error(`${name}: ${message}`); };
  const isNumber = v => typeof v === 'number' && Number.isFinite(v);
  const checkWaves = (list, what) => {
    if (!Array.isArray(list)) fail(`${what} must be a list of waves like { amp: 8, period: 23 }`);
    list.forEach((w, i) => {
      if (!isNumber(w.amp) || !isNumber(w.period) || w.period === 0) fail(`${what} wave ${i + 1} needs a number amp and a non-zero period`);
      if (w.phase !== undefined && !isNumber(w.phase)) fail(`${what} wave ${i + 1}: phase must be a number`);
    });
  };

  if (!data || typeof data !== 'object') fail('trail data is missing');
  if (typeof data.id !== 'string' || !data.id) fail('needs an id, like "flow-monster"');
  if (typeof data.name !== 'string' || !data.name) fail('needs a name');
  if (!DIFFICULTIES.includes(data.difficulty)) fail(`difficulty must be one of ${DIFFICULTIES.join(', ')}`);
  if (!isNumber(data.length) || data.length <= 0) fail('length must be a positive number of metres');
  if (!Number.isInteger(data.seed)) fail('seed must be a whole number');
  checkWaves(data.centreline, 'centreline');

  const w = data.width || {};
  if (!isNumber(w.base) || !isNumber(w.min) || !isNumber(w.max)) fail('width needs base, min and max');
  if (!(w.min > 0 && w.min < w.max)) fail('width min must be above 0 and below max');
  checkWaves(w.waves || [], 'width');

  const h = data.hill || {};
  if (!isNumber(h.grade)) fail('hill needs a grade, like -0.2 (downhill)');
  checkWaves(h.waves || [], 'hill');
  (h.chutes || []).forEach(c => {
    if (!isNumber(c.from) || !isNumber(c.to) || !isNumber(c.grade) || c.to <= c.from) fail(`chute needs from < to and a grade (got ${JSON.stringify(c)})`);
  });

  const st = data.start || {};
  if (!isNumber(st.spawn) || !isNumber(st.gate) || !(st.spawn >= 0 && st.spawn < st.gate)) fail('start needs spawn and gate, with spawn before the gate');

  const sp = data.splits;
  if (!Array.isArray(sp) || sp.length !== SPLIT_COUNT) fail(`needs exactly ${SPLIT_COUNT} splits (3 splits and the finish)`);
  sp.forEach((s, i) => {
    if (!isNumber(s)) fail(`split ${i + 1} must be a number`);
    if (s <= (i ? sp[i - 1] : st.gate)) fail(`splits must go down the trail, each after the one before and after the start gate (split ${i + 1} is at ${s})`);
  });
  if (sp[sp.length - 1] !== data.length) fail(`the last split is the finish and must be at the trail length (${data.length}), not ${sp[sp.length - 1]}`);

  const b = data.berms || {};
  if (b.auto !== false) {
    if (!isNumber(b.startCurvature) || !isNumber(b.fullCurvature) || !(b.startCurvature < b.fullCurvature)) fail('berms need startCurvature below fullCurvature');
    if (!isNumber(b.height) || b.height < 0) fail('berms need a height of 0 or more');
  }
  (b.adjust || []).forEach(a => {
    if (!isNumber(a.from) || !isNumber(a.to) || a.to <= a.from) fail(`berm adjustment needs from < to (got ${JSON.stringify(a)})`);
    if (!isNumber(a.height) || a.height < 0) fail(`berm adjustment at ${a.from}-${a.to} needs a height of 0 or more`);
  });

  ((data.scenery && data.scenery.rocky) || []).forEach(r => {
    if (!Array.isArray(r) || r.length !== 2 || !(r[0] < r[1])) fail(`rocky sections are [from, to] pairs (got ${JSON.stringify(r)})`);
  });

  if (!Array.isArray(data.features)) fail('features must be a list (it can be empty)');
  const jumps = [];
  for (const f of data.features) {
    if (f.type !== 'jump') fail(`unknown feature type "${f.type}" (known: jump)`);
    if (!isNumber(f.at)) fail('every jump needs an "at" distance');
    let j;
    try { j = resolveJump(f); } catch (e) { fail(`jump at ${f.at}: ${e.message}`); }
    const reshaped = SHAPE_KEYS.some(k => k in f);
    if (reshaped && !f.landings) fail(`jump at ${f.at} changes the jump's shape, so it must declare its own landings (landing ranges)`);
    if (j.s - j.kick <= st.gate) fail(`jump at ${f.at}: its kicker starts before the start gate`);
    if (j.end > data.length) fail(`jump at ${f.at}: its landing runs past the end of the trail`);
    jumps.push(j);
  }
  jumps.sort((a, c) => a.s - c.s);
  for (let i = 1; i < jumps.length; i++) {
    if (jumps[i].s - jumps[i].kick <= jumps[i - 1].end) fail(`jump at ${jumps[i].s} starts before the landing of the jump at ${jumps[i - 1].s} ends`);
  }
}

// The detailed ground beside the trail reaches NEAR_REACH past the edge. On the inside of a
// bend tighter than that, it would fold over itself, so such bends are refused.
function checkBends(data, path) {
  const need = data.width.max + NEAR_REACH + 4;
  for (let s = 0; s <= data.length; s += 0.5) {
    const k = Math.abs(path.curvatureAt(s));
    if (k > 0 && 1 / k < need) {
      throw new Error(`Trail "${data.id}": the bend at ${s.toFixed(0)} m is too tight (radius ${(1 / k).toFixed(0)} m; at least ${need.toFixed(0)} m for now). Make the centreline waves gentler there.`);
    }
  }
}
