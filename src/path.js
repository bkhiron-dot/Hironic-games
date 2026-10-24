// The trail's centreline as a measured path.
//
// A trail's centreline is described by its sideways position x as sine waves of d, the
// distance straight down the hill (world z = -d). This file measures distance ALONG the
// winding path (s), so 100 m of s is 100 m of riding however twisty the trail is, and
// offsets are measured square to the path.
//
//   pointAt(s, off)  -> { x, z }        world position s along the path, off to its right
//   headingAt(s)     -> h               direction of travel (forward = (sin h, -cos h))
//   curvatureAt(s)   -> 1 / radius      signed: positive when the trail bends toward +x
//   locate(x, z)     -> { s, off, d }   where a world position is relative to the path
//   downhillAt(s) / pathAt(d)           convert between s and d
// Plain maths only (no Three.js), so tests can run it in Node.

const STEP = 0.5; // table spacing in d (m); positions between samples are worked out exactly

export function createPath(waves, dFrom, dTo) {
  const ws = waves.map(w => ({ amp: w.amp, period: w.period, phase: w.phase || 0 }));
  const cx = d => { let v = 0; for (const w of ws) v += w.amp * Math.sin(d / w.period + w.phase); return v; };
  const cxd = d => { let v = 0; for (const w of ws) v += w.amp / w.period * Math.cos(d / w.period + w.phase); return v; };
  const cxdd = d => { let v = 0; for (const w of ws) v -= w.amp / (w.period * w.period) * Math.sin(d / w.period + w.phase); return v; };
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
      const c = cx(d), c1 = cxd(d), c2 = cxdd(d);
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
