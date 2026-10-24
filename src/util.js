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
