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
