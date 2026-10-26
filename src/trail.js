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
//
// A trail on the shared mountain (hill: { mountain: true }, see src/world.js) follows the
// mountain's hill (Flow Monster's) instead of a grade of its own. It can't lower the whole hill
// the way a trail on its own does, so the height each jump drops is paid back on the stretches
// between jumps (they are a little flatter than the hill), bringing the trail back up to the
// hillside. Its ends are eased to the levels of the clearings it starts and finishes in.
import { clamp, smoothstep, movingAverage, tableOf } from './util.js';
import { resolveJump, jumpProfile, SHAPE_KEYS } from './jumps.js';
import { resolveRollers, rollerProfile, atCrest } from './rollers.js';
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
const PAYBACK_BEFORE = 15;        // on the mountain, jumps' drops are paid back between jumps: not on a jump, nor in the 15 m before its kicker,
const PAYBACK_AFTER = 0.5;        // nor before halfway down its landing (the steep part)
const GRADING_EASE = 120;           // a graded mountain trail follows the plain mountain this near its clearings (m)
const LEVEL_EASE = 50;            // a mountain trail eases to its clearings' levels over this (m)

const waveList = list => (list || []).map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
const sumWaves = (ws, t) => { let v = 0; for (const w of ws) v += w.amp * Math.sin(t / w.period + w.phase); return v; };

// options (trails on the shared mountain, from src/world.js): mountain = { height(d, x) }, the
// shared hill; startLevel / finishLevel: ground height of the clearings at each end.
export function defineTrail(data, { mountain, startLevel, finishLevel } = {}) {
  checkTrail(data);
  const onMountain = !!(data.hill && data.hill.mountain);
  if (onMountain && !mountain) throw new Error(`Trail "${data.id}" is on the shared mountain: build it with createWorld() (src/world.js)`);
  const { length, splits, start } = data;
  const path = createPath(data.centreline, -PATH_MARGIN, length + PATH_MARGIN * 2);
  checkBends(data, path);
  const widthWaves = waveList(data.width.waves);
  const hillWaves = waveList(data.hill.waves);
  const chutes = data.hill.chutes || [];
  const jumps = data.features.filter(f => f.type === 'jump').map(resolveJump).sort((a, b) => a.s - b.s);
  const rollers = data.features.filter(f => f.type === 'rollers').map(resolveRollers).sort((a, b) => a.s - b.s);
  const berms = { auto: true, adjust: [], ...data.berms };
  const bermRamp = berms.fullCurvature - berms.startCurvature;
  const bankWidth = (data.width.min + data.width.max) / 2; // typical half width, for the far banks

  // Half the trail width (m), along the trail.
  const halfWidth = s => clamp(data.width.base + sumWaves(widthWaves, s), data.width.min, data.width.max);
  const curvature = s => path.curvatureAt(s);

  // How much lower the trail is after jump j, ramping in across the jump (0 before it).
  const terrace = (j, s) => (j.knuck - j.drop) * smoothstep((s - (j.s - j.kick)) / (j.end - (j.s - j.kick)));

  // The hill, at downhill distance d: grade, gentle waves, steeper chutes (or the shared
  // mountain), and how far this trail sits below it (jump terraces, run-outs, clearing levels).
  function hillBase(d) {
    if (onMountain) return mountain.height(d, path.cx(d));
    let h = data.hill.grade * d + sumWaves(hillWaves, d);
    for (const c of chutes) h += c.grade * clamp(d - c.from, 0, c.to - c.from);
    return h;
  }
  function hillHeight(d) {
    if (onMountain) return hillBase(d) + offsetAt(path.pathAt(d));
    let h = hillBase(d);
    if (jumps.length) { const s = path.pathAt(d); for (const j of jumps) h += terrace(j, s); }
    return h;
  }

  // On the mountain a trail can be graded (hill.smooth = W): cut into the hill where it is
  // steeper and built up where it is flatter, so the line follows the mountain averaged over W m
  // either way along the trail. That evens out the steep bits, like switchback corners.
  const mountainAlong = onMountain ? tableOf(s => hillBase(path.downhillAt(s)), -PATH_MARGIN, length + PATH_MARGIN, 0.25) : () => 0;
  const smoothed = onMountain && data.hill.smooth ? movingAverage(mountainAlong, -PATH_MARGIN, length + PATH_MARGIN, data.hill.smooth) : null;
  // (eased out over the GRADING_EASE m nearest each clearing, where the trails run side by side
  // into their gates: there each follows the mountain itself, so they meet it at the same level)
  const gradingShare = s => smoothstep((s - data.start.gate) / GRADING_EASE) * smoothstep((length - s) / GRADING_EASE);
  const grading = s => (smoothed ? (smoothed(s) - mountainAlong(s)) * gradingShare(s) : 0);

  // On the mountain: how far the riding line sits above (+) or below (-) the mountain at s,
  // leaving out the features' own shapes: its grading; each jump's drop, ramping in across it
  // (as a terrace) and paid back between jumps; and near each end, the ease to its clearing's level.
  const paybacks = onMountain ? planPayback(jumps, data.start.gate + LEVEL_EASE, length - LEVEL_EASE) : [];
  const payback = s => { let h = 0; for (const p of paybacks) h += p.by * smoothstep((s - p.from) / (p.to - p.from)); return h; };
  function offsetAt(s) {
    let h = 0;
    for (const j of jumps) h += terrace(j, s);
    return h + grading(s) + payback(s) + levelEase(s);
  }
  // The riding line's height at a clearing (ground = line minus the dish), eased in and out.
  const rawLine = s => mountainAlong(s) + grading(s) + jumpHeight(s) + payback(s);
  const startShift = onMountain && startLevel !== undefined ? startLevel + DISH_DEPTH - rawLine(data.start.gate) : 0;
  const finishShift = onMountain && finishLevel !== undefined ? finishLevel + DISH_DEPTH - rawLine(data.length) : 0;
  function levelEase(s) {
    return startShift * (1 - smoothstep((s - data.start.gate) / LEVEL_EASE))
      + finishShift * smoothstep((s - (data.length - LEVEL_EASE)) / LEVEL_EASE);
  }

  // Height the jumps and rollers add along the trail (kickers, gaps, landings and their drops).
  function jumpHeight(s) {
    let h = 0;
    for (const j of jumps) h += jumpProfile(j, s - j.s);
    for (const r of rollers) h += rollerProfile(r, s - r.s);
    return h;
  }

  // Slope of the rollers here (rise per metre along the trail): what pumping works against.
  function rollerSlope(s) {
    let h = 0;
    for (const r of rollers) h += rollerProfile(r, s + 0.25 - r.s) - rollerProfile(r, s - 0.25 - r.s);
    return h / 0.5;
  }

  // Height of the riding line on the centreline, before the dish and berms. On the mountain the
  // jumps' drops are paid back and the ends meet the clearings.
  const lineHeight = onMountain
    ? s => rawLine(s) + levelEase(s)
    : s => hillBase(path.downhillAt(s)) + jumpHeight(s);

  // If s is on a kicker, returns the jump and u (metres before the lip, negative). Otherwise null.
  function kickerAt(s) {
    for (const j of jumps) {
      const u = s - j.s;
      if (u > -j.kick && u < 0) return { j, u };
    }
    return null;
  }

  // Where a pop works: on a kicker, or right at a roller's crest. Returns { u } (metres from
  // the lip or crest, negative before it), or null.
  function popAt(s) {
    const k = kickerAt(s);
    if (k) return { u: k.u };
    for (const r of rollers) { const u = atCrest(r, s); if (u !== null) return { u }; }
    return null;
  }
  // On a roller set? There, letting go of compress away from a crest is just the pump
  // extending (no hop), so pumping doesn't throw you into the next roller.
  const onRollers = s => rollers.some(r => s > r.s && s < r.end);

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

  // On the mountain a trail traversing across the hill is benched into it: beside the trail the
  // ground keeps the hill's tilt across the trail (rising on the uphill side, falling on the
  // downhill side) under its banks. tilt(s): the hill's rise per metre to the trail's right.
  const tilt = onMountain ? movingAverage(s => {
    const a = path.pointAt(s, -1), b = path.pointAt(s, 1);
    return (mountain.height(-b.z, b.x) - mountain.height(-a.z, a.x)) / 2;
  }, -PATH_MARGIN, length + PATH_MARGIN, 1) : () => 0;

  // The ground beside the trail at path position (s, off): the trail's own shape (dish, berms,
  // banks) and how far it has blended into the hill (toHill, 0 near the trail, 1 from 20 m past
  // its edge). `near` is only worked out while toHill < 1.
  function corridor(s, off) {
    const a = Math.abs(off), w = halfWidth(s);
    const toHill = smoothstep((a - w - BLEND_START) / (BLEND_END - BLEND_START));
    let near = 0;
    if (toHill < 1) {
      near = lineHeight(s) + bermHeight(s, off, w);
      if (a > w) {
        // off the trail the banks rise away, with gentle lumps
        const e = a - w;
        near += bankRise(e) + 0.25 * Math.sin(s * 0.31 + off * 0.7) * Math.min(1, e / 2) + tilt(s) * Math.sign(off) * e;
      } else {
        near -= DISH_DEPTH * (1 - (a / w) * (a / w));
      }
    }
    return { near, toHill };
  }
  // The open hillside at world point (x, z), `e` metres past the trail's typical edge.
  const hillside = (x, z, e, hill) => hill + bankRise(Math.max(0, e)) + 0.25 * Math.sin(-z * 0.31 + x * 0.7);

  // Ground height at path position (s, off), which is world point (x, z).
  function surface(s, off, x, z) {
    const { near, toHill } = corridor(s, off);
    const far = toHill > 0 ? hillside(x, z, Math.abs(off) - bankWidth, hillHeight(-z)) : 0;
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
    grade: data.hill.grade, // the hill's overall grade (the jump simulator rides jumps on it; not on the mountain)
    onMountain, bankWidth, corridor, hillside, bankRise,
    // on the mountain: how far the hillside around the trail sits above the mountain at s
    mountainOffset: s => (onMountain ? offsetAt(s) : 0),
    scenery: { rocky: [], ...data.scenery }, jumps, rollers, berms,
    halfWidth, curvature, hillHeight, jumpHeight, lineHeight, kickerAt, popAt, onRollers, rollerSlope, jumpZone,
    bermAmount, bermHeight, ground, groundAt,
    // on the riding surface (full grip, low drag)? (x, z) is the same point in the world
    onTrail: (s, off) => Math.abs(off) <= halfWidth(s) + 0.3,
    pointAt: path.pointAt, headingAt: path.headingAt, locate: path.locate,
    downhillAt: path.downhillAt, pathAt: path.pathAt, cx: path.cx,
  };
}

// Where a mountain trail pays back its jumps' drops: on the stretches between jumps (from halfway
// down a landing to 15 m before the next kicker). Each jump's drop is shared by the two stretches
// before it (1/6, 1/3: so the trail rises a little above the hillside before a big drop) and the
// two after it (1/3, 1/6), so the trail is never far above or below the hillside: about a third of
// a jump's drop at most. Returns a list of { from, to, by }: the line rises `by` metres from
// `from` to `to`.
const PAYBACK_SHARES = [[-1, 1 / 6], [0, 1 / 3], [1, 1 / 3], [2, 1 / 6]]; // stretch (0 = just before the jump), share
function planPayback(jumps, first, last) {
  const stretches = [];
  let from = first;
  for (const j of jumps) {
    stretches.push({ from, to: j.s - j.kick - PAYBACK_BEFORE, by: 0 });
    from = j.s + j.gap + PAYBACK_AFTER * j.land;
  }
  stretches.push({ from, to: last, by: 0 });
  const usable = i => i >= 0 && i < stretches.length && stretches[i].to > stretches[i].from;
  jumps.forEach((j, i) => {
    const drop = j.drop - j.knuck, shares = PAYBACK_SHARES.filter(([k]) => usable(i + k));
    const total = shares.reduce((sum, [, w]) => sum + w, 0);
    for (const [k, w] of shares) stretches[i + k].by += drop * w / total;
  });
  return stretches.filter(p => p.to > p.from);
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
  const line = data.centreline;
  if (Array.isArray(line)) checkWaves(line, 'centreline');
  else {
    if (!line || typeof line !== 'object') fail('centreline must be a list of waves, { x0, heading, turns } or { x0, shifts, waves }');
    if (line.x0 !== undefined && !isNumber(line.x0)) fail('centreline x0 must be a number');
    checkWaves(line.waves || [], 'centreline');
    (line.waves || []).forEach((wv, i) => {
      if ((wv.from !== undefined || wv.to !== undefined) && !(isNumber(wv.fade) && wv.fade > 0)) fail(`centreline wave ${i + 1} fades in or out, so it needs a fade length`);
    });
    if (line.turns) {
      if (!isNumber(line.heading)) fail('a centreline with turns needs a starting heading (degrees)');
      line.turns.forEach((tn, i) => {
        if (!isNumber(tn.at) || !isNumber(tn.heading) || Math.abs(tn.heading) >= 85 || !(isNumber(tn.over) && tn.over > 0)) fail(`centreline turn ${i + 1} needs at, a heading under 85 degrees and a positive over`);
      });
    }
    (line.shifts || []).forEach((sh, i) => {
      if (!isNumber(sh.at) || !isNumber(sh.by) || !(isNumber(sh.over) && sh.over > 0)) fail(`centreline shift ${i + 1} needs at, by and a positive over`);
    });
  }

  const w = data.width || {};
  if (!isNumber(w.base) || !isNumber(w.min) || !isNumber(w.max)) fail('width needs base, min and max');
  if (!(w.min > 0 && w.min < w.max)) fail('width min must be above 0 and below max');
  checkWaves(w.waves || [], 'width');

  const h = data.hill || {};
  if (h.mountain) {
    if (h.grade !== undefined || h.chutes) fail('a trail on the mountain follows its hill: no grade or chutes of its own');
    if (h.smooth !== undefined && !(Number.isInteger(h.smooth) && h.smooth > 0)) fail('hill smooth must be a whole number of metres');
  }
  else if (!isNumber(h.grade)) fail('hill needs a grade, like -0.2 (downhill)');
  checkWaves(h.waves || [], 'hill');
  (h.chutes || []).forEach(c => {
    if (!isNumber(c.from) || !isNumber(c.to) || !isNumber(c.grade) || c.to <= c.from) fail(`chute needs from < to and a grade (got ${JSON.stringify(c)})`);
  });

  const st = data.start || {};
  if (!isNumber(st.spawn) || !isNumber(st.gate) || !(st.spawn >= -30 && st.spawn < st.gate)) fail('start needs spawn and gate, with spawn before the gate');

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
  const jumps = [], spans = [];
  for (const f of data.features) {
    if (f.type === 'rollers') { spans.push(checkRollers(f, st, data.length, fail)); continue; }
    if (f.type !== 'jump') fail(`unknown feature type "${f.type}" (known: jump, rollers)`);
    if (!isNumber(f.at)) fail('every jump needs an "at" distance');
    let j;
    try { j = resolveJump(f); } catch (e) { fail(`jump at ${f.at}: ${e.message}`); }
    const reshaped = SHAPE_KEYS.some(k => k in f);
    if (reshaped && !f.landings) fail(`jump at ${f.at} changes the jump's shape, so it must declare its own landings (landing ranges)`);
    if (j.s - j.kick <= st.gate) fail(`jump at ${f.at}: its kicker starts before the start gate`);
    if (j.end > data.length) fail(`jump at ${f.at}: its landing runs past the end of the trail`);
    jumps.push(j);
    spans.push({ from: j.s - j.kick, to: j.end, what: `jump at ${j.s}` });
  }
  jumps.sort((a, c) => a.s - c.s);
  for (let i = 1; i < jumps.length; i++) {
    if (jumps[i].s - jumps[i].kick <= jumps[i - 1].end) fail(`jump at ${jumps[i].s} starts before the landing of the jump at ${jumps[i - 1].s} ends`);
  }
  spans.sort((a, c) => a.from - c.from);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].from <= spans[i - 1].to) fail(`${spans[i].what} overlaps the ${spans[i - 1].what}`);
  }
}

// A roller set needs a whole number of humps (2 or more), a height and spacing in a sensible
// range, room on the trail, and its expected outcomes. Returns the stretch it covers.
function checkRollers(f, st, length, fail) {
  const what = `rollers at ${f.at}`;
  const isNumber = v => typeof v === 'number' && Number.isFinite(v);
  if (!isNumber(f.at)) fail('every roller set needs an "at" distance');
  if (!Number.isInteger(f.count) || f.count < 2) fail(`${what}: count must be a whole number of humps, 2 or more`);
  if (!isNumber(f.height) || f.height < 0.2 || f.height > 1.5) fail(`${what}: height must be 0.2-1.5 m`);
  if (!isNumber(f.spacing) || f.spacing < 6 || f.spacing > 20) fail(`${what}: spacing (crest to crest) must be 6-20 m`);
  if (!Array.isArray(f.landings) || !f.landings.length) fail(`${what} must declare its expected outcomes (landings)`);
  const to = f.at + f.count * f.spacing;
  if (f.at <= st.gate) fail(`${what}: starts before the start gate`);
  if (to > length) fail(`${what}: runs past the end of the trail`);
  return { from: f.at, to, what };
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
