// defineTrail() turns trail data (see src/trails/hardline.js) into the functions the game
// uses: where the centreline is, how wide the trail is, how high the ground is, and what's
// on it. It checks the data first and explains any mistake in plain words.
// Plain maths only (no Three.js), so tests can run it in Node.
//
// Conventions: s = distance down the trail (m), off = sideways offset from the centreline
// (m, +x side positive). For now s is measured straight down the hill (world z = -s);
// roadmap step 2b changes it to follow the winding path. See CLAUDE.md.
import { clamp, smoothstep } from './util.js';
import { resolveJump, jumpProfile, SHAPE_KEYS } from './jumps.js';

export const SPLIT_COUNT = 4; // 3 splits + the finish: one high-score board each

// Shape of the ground beside the trail (the same on every trail for now).
const DISH_DEPTH = 0.1;          // the trail is worn into a shallow dish this deep (m)
const BERM_FADE_BEFORE_JUMP = 20; // berms fade out from this far before a kicker (m)...
const BERM_FADE_LENGTH = 8;       // ...over this distance, and back in after the landing
const BERM_ADJUST_FADE = 5;       // a berm adjustment blends in and out over this distance (m)

// A list of sine waves { amp, period, phase }: the sum of amp * sin(s / period + phase).
// Returns the sum and its first and second derivatives.
function sineWaves(list) {
  const ws = list.map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
  return {
    at(s) { let v = 0; for (const w of ws) v += w.amp * Math.sin(s / w.period + w.phase); return v; },
    slope(s) { let v = 0; for (const w of ws) v += w.amp / w.period * Math.cos(s / w.period + w.phase); return v; },
    bend(s) { let v = 0; for (const w of ws) v += -w.amp / (w.period * w.period) * Math.sin(s / w.period + w.phase); return v; },
  };
}

export function defineTrail(data) {
  checkTrail(data);
  const { length, splits, start } = data;
  const centre = sineWaves(data.centreline);
  const widthWaves = data.width.waves.map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
  const profileWaves = (data.profile.waves || []).map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
  const chutes = data.profile.chutes || [];
  const jumps = data.features.filter(f => f.type === 'jump').map(resolveJump).sort((a, b) => a.s - b.s);
  const berms = { auto: true, adjust: [], ...data.berms };
  const bermRamp = berms.fullCurvature - berms.startCurvature;

  // Centreline x position, and its first and second derivatives (for heading and curvature).
  const cx = centre.at, cxd = centre.slope, cxdd = centre.bend;

  // Half the trail width (m).
  function halfWidth(s) {
    let h = data.width.base;
    for (const w of widthWaves) h += w.amp * Math.sin(s / w.period + w.phase);
    return clamp(h, data.width.min, data.width.max);
  }

  // Signed curvature of the centreline (1/m), using the proper formula cx'' / (1 + cx'^2)^1.5.
  function curvature(s) {
    const d = cxd(s);
    return cxdd(s) / Math.pow(1 + d * d, 1.5);
  }

  // Height of the trail's centreline before jumps and berms: steady grade, gentle waves, chutes.
  function profileHeight(s) {
    let h = data.profile.grade * s;
    for (const w of profileWaves) h += w.amp * Math.sin(s / w.period + w.phase);
    for (const c of chutes) h += c.grade * clamp(s - c.from, 0, c.to - c.from);
    return h;
  }

  function jumpHeight(s) {
    let h = 0;
    for (const j of jumps) h += jumpProfile(j, s - j.s);
    return h;
  }

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
    return h;
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

  // Ground height at distance s down the trail and sideways offset off.
  function ground(s, off) {
    let h = profileHeight(s) + jumpHeight(s);
    const a = Math.abs(off), w = halfWidth(s);
    h += bermHeight(s, off, w);
    if (a > w) {
      // off the trail the hillside rises away, with gentle lumps
      const e = a - w;
      h += Math.pow(e, 1.25) * 0.18 + 0.25 * Math.sin(s * 0.31 + off * 0.7) * Math.min(1, e / 2);
    } else {
      h -= DISH_DEPTH * (1 - (a / w) * (a / w));
    }
    return h;
  }

  // Same as ground(), from world x and z.
  const groundAt = (x, z) => {
    const s = -z;
    return ground(s, x - cx(s));
  };

  return {
    id: data.id, name: data.name, length, seed: data.seed, splits, start,
    scenery: { rocky: [], ...data.scenery }, jumps, berms,
    cx, cxd, cxdd, curvature, halfWidth, profileHeight, jumpHeight, kickerAt, jumpZone,
    bermAmount, bermHeight, ground, groundAt,
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
  if (typeof data.id !== 'string' || !data.id) fail('needs an id, like "hardline"');
  if (typeof data.name !== 'string' || !data.name) fail('needs a name');
  if (!isNumber(data.length) || data.length <= 0) fail('length must be a positive number of metres');
  if (!Number.isInteger(data.seed)) fail('seed must be a whole number');
  checkWaves(data.centreline, 'centreline');

  const w = data.width || {};
  if (!isNumber(w.base) || !isNumber(w.min) || !isNumber(w.max)) fail('width needs base, min and max');
  if (!(w.min > 0 && w.min < w.max)) fail('width min must be above 0 and below max');
  checkWaves(w.waves || [], 'width');

  const p = data.profile || {};
  if (!isNumber(p.grade)) fail('profile needs a grade, like -0.2 (downhill)');
  checkWaves(p.waves || [], 'profile');
  (p.chutes || []).forEach(c => {
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
