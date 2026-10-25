// The trail's centreline as a measured path.
//
// A trail's centreline is described by its sideways position x as a function of d, the
// distance straight down the hill (world z = -d): either a list of sine waves (Flow Monster),
// or { x0, heading, turns }: a starting x and heading (degrees from straight down the hill, +
// to the right, +x), then turns (at d = `at` the line turns to `heading`, smoothly over about
// 4 x `over` metres down the hill; a switchback is a turn across to the other side),
// or { x0, shifts, waves }: a starting x, smooth sideways shifts (each moves the line `by`
// metres, centred at d = `at`, over about 2 x `over` metres), and sine waves that can fade in
// (`from`) and out (`to`) over `fade` metres. Jolly Green Giant's switchbacks are turns;
// Back in Black uses shifts and a wave. This file measures distance ALONG the winding path (s), so 100 m of s is 100 m of riding however twisty the trail is, and
// offsets are measured square to the path.
//
//   pointAt(s, off)  -> { x, z }        world position s along the path, off to its right
//   headingAt(s)     -> h               direction of travel (forward = (sin h, -cos h))
//   curvatureAt(s)   -> 1 / radius      signed: positive when the trail bends toward +x
//   locate(x, z)     -> { s, off, d }   where a world position is relative to the path
//   downhillAt(s) / pathAt(d)           convert between s and d
// Plain maths only (no Three.js), so tests can run it in Node.

const STEP = 0.5; // table spacing in d (m); positions between samples are worked out exactly

// The centreline x(d) with its first and second derivatives, worked out exactly.
export function centrelineOf(line) {
  if (Array.isArray(line)) return waveLine(line);
  const spec = line;
  if (spec.turns) return turningLine(spec);
  const x0 = spec.x0 || 0;
  const shifts = (spec.shifts || []).map(s => ({ ...s }));
  const ws = (spec.waves || []).map(w => ({ ...w, phase: w.phase || 0 }));
  // A smooth step: 0 well before u = 0, 1 well after, with its derivatives in u.
  const step = u => { const t = Math.tanh(u); return [0.5 * (1 + t), 0.5 * (1 - t * t), -t * (1 - t * t)]; };
  // A wave's fade in and out: e(d) and its derivatives (1 where it doesn't fade).
  function envelope(w, d) {
    let e = 1, e1 = 0, e2 = 0;
    if (w.from !== undefined) { const [a, a1, a2] = step((d - w.from) / w.fade), k = 1 / w.fade; [e, e1, e2] = [a, a1 * k, a2 * k * k]; }
    if (w.to !== undefined) {
      const [b, b1, b2] = step((w.to - d) / w.fade), k = -1 / w.fade;
      [e, e1, e2] = [e * b, e1 * b + e * b1 * k, e2 * b + 2 * e1 * b1 * k + e * b2 * k * k];
    }
    return [e, e1, e2];
  }
  // [x, dx/dd, d2x/dd2] at d
  function at(d) {
    let x = x0, x1 = 0, x2 = 0;
    for (const s of shifts) {
      const [a, a1, a2] = step((d - s.at) / s.over), k = 1 / s.over;
      x += s.by * a; x1 += s.by * a1 * k; x2 += s.by * a2 * k * k;
    }
    for (const w of ws) {
      const t = d / w.period + w.phase, sn = Math.sin(t), cs = Math.cos(t);
      const g = w.amp * sn, g1 = w.amp / w.period * cs, g2 = -w.amp / (w.period * w.period) * sn;
      if (w.from === undefined && w.to === undefined) { x += g; x1 += g1; x2 += g2; continue; }
      const [e, e1, e2] = envelope(w, d);
      x += g * e; x1 += g1 * e + g * e1; x2 += g2 * e + 2 * g1 * e1 + g * e2;
    }
    return [x, x1, x2];
  }
  return { at, cx: d => at(d)[0], cxd: d => at(d)[1], cxdd: d => at(d)[2] };
}

// A line that is just a sum of sine waves (Flow Monster): each part worked out on its own, as
// cheaply as possible (the path asks for its slope most often).
function waveLine(list) {
  const ws = list.map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
  const cx = d => { let x = 0; for (const w of ws) x += w.amp * Math.sin(d / w.period + w.phase); return x; };
  const cxd = d => { let x = 0; for (const w of ws) x += w.amp / w.period * Math.cos(d / w.period + w.phase); return x; };
  const cxdd = d => { let x = 0; for (const w of ws) x -= w.amp / (w.period * w.period) * Math.sin(d / w.period + w.phase); return x; };
  return { at: d => [cx(d), cxd(d), cxdd(d)], cx, cxd, cxdd };
}

// A line given by its heading: theta(d) starts at `heading` and each turn changes it along a
// smooth logistic curve. Its sideways slope is tan(theta); x is that added up (Simpson's rule,
// every 0.25 m, from 300 m above the top to 3000 m down; read back with cubic interpolation).
// Its tightest radius is about 4 x over / (turn in radians), at the middle of the turn.
const TURN_FROM = -300, TURN_TO = 3000, TURN_STEP = 0.25;
function turningLine(spec) {
  const rad = Math.PI / 180, theta0 = spec.heading * rad;
  let previous = theta0;
  const turns = spec.turns.map(tn => { const change = tn.heading * rad - previous; previous = tn.heading * rad; return { at: tn.at, over: tn.over, change }; });
  const logistic = u => 1 / (1 + Math.exp(-u));
  // [slope, d slope / dd] at d
  function slopeAt(d) {
    let th = theta0, th1 = 0;
    for (const tn of turns) { const l = logistic((d - tn.at) / tn.over); th += tn.change * l; th1 += tn.change * l * (1 - l) / tn.over; }
    const s = Math.tan(th);
    return [s, (1 + s * s) * th1];
  }
  const n = Math.round((TURN_TO - TURN_FROM) / TURN_STEP) + 1;
  const xs = new Float64Array(n), s1 = new Float64Array(n), s2 = new Float64Array(n);
  for (let i = 0; i < n; i++) [s1[i], s2[i]] = slopeAt(TURN_FROM + i * TURN_STEP);
  for (let i = 1; i < n; i++) xs[i] = xs[i - 1] + TURN_STEP / 6 * (s1[i - 1] + 4 * slopeAt(TURN_FROM + (i - 0.5) * TURN_STEP)[0] + s1[i]);
  const shift = (spec.x0 || 0) - xs[Math.round(-TURN_FROM / TURN_STEP)]; // x = x0 at d = 0
  const h = TURN_STEP;
  function at(d) {
    const u = Math.min(n - 1.000001, Math.max(0, (d - TURN_FROM) / h)), i = Math.floor(u), t = u - i;
    const t2 = t * t, t3 = t2 * t;
    const x = (2 * t3 - 3 * t2 + 1) * xs[i] + (t3 - 2 * t2 + t) * h * s1[i] + (-2 * t3 + 3 * t2) * xs[i + 1] + (t3 - t2) * h * s1[i + 1];
    const [x1, x2] = slopeAt(d);
    return [x + shift, x1, x2];
  }
  return { at, cx: d => at(d)[0], cxd: d => at(d)[1], cxdd: d => at(d)[2] };
}

// Shifts, fading waves and turns are slow to work out, and the path asks for them often, so for
// those the centreline is worked out once every TABLE_STEP metres and read back with smooth (cubic)
// interpolation: well under a millimetre off.
const TABLE_STEP = 0.25, TABLE_MARGIN = 400; // (the table reaches 400 m past each end: the hillside is asked about too)
function tabulated(exact, dFrom, dTo) {
  const n = Math.ceil((dTo - dFrom) / TABLE_STEP) + 1;
  const x = new Float64Array(n), x1 = new Float64Array(n), x2 = new Float64Array(n);
  for (let i = 0; i < n; i++) [x[i], x1[i], x2[i]] = exact(dFrom + i * TABLE_STEP);
  const h = TABLE_STEP;
  // Cubic Hermite between samples i and i + 1, from values and slopes at both ends: value and slope.
  const hermite = (a, b, sa, sb, t) => {
    const t2 = t * t, t3 = t2 * t;
    return [
      (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * h * sa + (-2 * t3 + 3 * t2) * b + (t3 - t2) * h * sb,
      ((6 * t2 - 6 * t) * a + (3 * t2 - 4 * t + 1) * h * sa + (-6 * t2 + 6 * t) * b + (3 * t2 - 2 * t) * h * sb) / h,
    ];
  };
  return d => {
    if (d <= dFrom || d >= dTo) return exact(d);
    const u = (d - dFrom) / h, i = Math.min(n - 2, Math.floor(u)), t = u - i;
    const [v] = hermite(x[i], x[i + 1], x1[i], x1[i + 1], t);
    const [v1, v2] = hermite(x1[i], x1[i + 1], x2[i], x2[i + 1], t);
    return [v, v1, v2];
  };
}

export function createPath(line, dFrom, dTo) {
  const exact = centrelineOf(line);
  const at = Array.isArray(line) ? exact.at : tabulated(exact.at, dFrom - TABLE_MARGIN, dTo + TABLE_MARGIN);
  const cx = Array.isArray(line) ? exact.cx : d => at(d)[0];
  const cxd = Array.isArray(line) ? exact.cxd : d => at(d)[1];
  const cxdd = Array.isArray(line) ? exact.cxdd : d => at(d)[2];
  const stretch = d => Math.sqrt(1 + cxd(d) * cxd(d)); // metres of path per metre downhill

  // Table of path distance s at every STEP of d, with s = 0 at d = 0 (Simpson's rule per step).
  const count = Math.ceil((dTo - dFrom) / STEP) + 1;
  const sTable = new Float64Array(count);
  const zeroAt = Math.round(-dFrom / STEP);
  for (let i = zeroAt + 1; i < count; i++) sTable[i] = sTable[i - 1] + segment(dFrom + (i - 1) * STEP);
  for (let i = zeroAt - 1; i >= 0; i--) sTable[i] = sTable[i + 1] - segment(dFrom + i * STEP);
  function segment(d0) {
    return STEP / 6 * (stretch(d0) + 4 * stretch(d0 + STEP / 2) + stretch(d0 + STEP));
  }

  // s for a given d: table value plus the exact-enough length of the last bit (Simpson again).
  function pathAt(d) {
    const i = Math.max(0, Math.min(count - 2, Math.floor((d - dFrom) / STEP)));
    const d0 = dFrom + i * STEP, h = d - d0;
    return sTable[i] + h / 6 * (stretch(d0) + 4 * stretch(d0 + h / 2) + stretch(d));
  }

  // d for a given s: find the table step, then a few Newton steps (ds/dd = stretch).
  // Remembers the last answer, because the same s is often asked for several times in a row.
  let lastS = NaN, lastD = 0;
  function downhillAt(s) {
    if (s === lastS) return lastD;
    lastD = findDownhill(s); lastS = s;
    return lastD;
  }
  function findDownhill(s) {
    let lo = 0, hi = count - 1;
    if (s <= sTable[0]) lo = hi = 0;
    else if (s >= sTable[count - 1]) lo = hi = count - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sTable[mid] <= s) lo = mid; else hi = mid; }
    let d = dFrom + lo * STEP;
    for (let k = 0; k < 4; k++) d += (s - pathAt(d)) / stretch(d);
    return d;
  }

  const headingOfD = d => Math.atan2(cxd(d), 1);
  const curvatureOfD = d => cxdd(d) / Math.pow(1 + cxd(d) * cxd(d), 1.5);

  // Right-hand side of the path at d, as a unit vector (x, z). Straight down the hill it is +x.
  function rightOfD(d) {
    const L = stretch(d);
    return { x: 1 / L, z: cxd(d) / L };
  }

  function pointAt(s, off = 0) {
    const d = downhillAt(s), r = rightOfD(d);
    return { x: cx(d) + off * r.x, z: -d + off * r.z };
  }

  // Nearest point of the path to (x, z). Newton's method on "the line from the path to the
  // point is square to the path", starting from straight across (d = -z). If that fails
  // (far from the trail, inside a bend), scan nearby d for the closest point and refine.
  function locate(x, z) {
    let d = newton(x, z, -z);
    if (d === null) {
      let best = -z, bestDist = Infinity;
      for (let t = -z - 90; t <= -z + 90; t += 1.5) {
        const dx = x - cx(t), dz = z + t, dist = dx * dx + dz * dz;
        if (dist < bestDist) { bestDist = dist; best = t; }
      }
      d = newton(x, z, best) ?? best;
    }
    const r = rightOfD(d);
    return { s: pathAt(d), off: (x - cx(d)) * r.x + (z + d) * r.z, d };
  }
  // g(d) = (P(d) - Q) . tangent(d), scaled; zero at the nearest point. Returns d or null.
  function newton(x, z, d) {
    for (let k = 0; k < 12; k++) {
      const [c, c1, c2] = at(d);
      const g = (c - x) * c1 + (d + z);
      const g1 = c1 * c1 + (c - x) * c2 + 1;
      if (g1 <= 0.05) return null; // past the centre of a bend: no unique nearest point here
      const step = Math.max(-20, Math.min(20, g / g1));
      d -= step;
      if (Math.abs(step) < 1e-9) return d;
    }
    return Math.abs((cx(d) - x) * cxd(d) + (d + z)) < 1e-6 ? d : null;
  }

  return {
    pointAt, locate, pathAt, downhillAt,
    headingAt: s => headingOfD(downhillAt(s)),
    curvatureAt: s => curvatureOfD(downhillAt(s)),
    // the centreline's own description, for drawing
    cx, cxd, cxdd,
  };
}
