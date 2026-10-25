// Small maths helpers shared across the game.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Smooth 0..1 ease (smoothstep): flat at both ends, so shapes blend without kinks.
export function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

// Seeded random numbers (mulberry32). The same seed always gives the same sequence,
// so the forest grows in exactly the same places every time the game loads.
export function makeRandom(seed) {
  return function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const pickFrom = (random, list) => list[Math.floor(random() * list.length)];

// Smooth random pattern over the ground: a value from 0 to 1 that changes gently across
// `cell` metres. The same (x, z) always gives the same value, so separate meshes that
// meet can be coloured to match exactly.
export function makeGroundNoise(seed, cell = 4) {
  const lattice = (i, j) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  return (x, z) => {
    const u = x / cell, v = z / cell, i = Math.floor(u), j = Math.floor(v);
    const fu = smoothstep(u - i), fv = smoothstep(v - j);
    const top = lattice(i, j) + (lattice(i + 1, j) - lattice(i, j)) * fu;
    const bottom = lattice(i, j + 1) + (lattice(i + 1, j + 1) - lattice(i, j + 1)) * fu;
    return top + (bottom - top) * fv;
  };
}

// f averaged over +/-half metres, as a function worked out every metre from `from` to `to` and
// read back in a straight line between (outside that, f itself).
export function movingAverage(f, from, to, half) {
  const n = Math.ceil(to - from) + 1, values = new Float64Array(n + 2 * half), sums = new Float64Array(n + 2 * half + 1);
  for (let i = 0; i < values.length; i++) values[i] = f(from - half + i);
  for (let i = 0; i < values.length; i++) sums[i + 1] = sums[i] + values[i];
  const average = new Float64Array(n);
  for (let i = 0; i < n; i++) average[i] = (sums[i + 2 * half + 1] - sums[i]) / (2 * half + 1);
  return d => {
    const u = d - from, i = Math.floor(u);
    if (i < 0 || i >= n - 1) return f(d);
    return average[i] + (average[i + 1] - average[i]) * (u - i);
  };
}

// f worked out every `step` metres from `from` to `to`, and read back in a straight line between
// (outside that, f itself): for smooth things that are slow to work out and asked for often.
export function tableOf(f, from, to, step) {
  const n = Math.ceil((to - from) / step) + 1, values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = f(from + i * step);
  return v => {
    const u = (v - from) / step, i = Math.floor(u);
    if (i < 0 || i >= n - 1) return f(v);
    return values[i] + (values[i + 1] - values[i]) * (u - i);
  };
}
