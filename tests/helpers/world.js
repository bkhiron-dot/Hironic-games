// The mountain as the game builds it: every trail's terrain and forest planned in the game's
// order (each trail with its own random sequence), and all their trees in one set of buckets.
// Planned once and shared by the tests that need it (it takes a few seconds).
import { WORLD } from '../../src/trails/index.js';
import { makeRandom } from '../../src/util.js';
import { terrainData } from '../../src/terrain.js';
import { planForest } from '../../src/forest.js';

let built = null;
export function worldForest() {
  if (built) return built;
  const plans = WORLD.trails.map(t => { const random = makeRandom(t.seed); terrainData(t, random); return planForest(t, random); });
  const treeBuckets = {};
  for (const plan of plans) for (const [k, list] of Object.entries(plan.treeBuckets)) (treeBuckets[k] || (treeBuckets[k] = [])).push(...list);
  built = { plans, treeBuckets };
  return built;
}

// Largest height change between neighbouring world points 0.5 m apart, square to trail T from
// s0 to s1 and out to 60 m either side, as a share of what's allowed: 0.85 m on (or within 2.5 m
// of) any trail's surface (berm walls), on the bank between two trails running side by side
// (both within 10 m), and within 40 m of a clearing's fence, where trails come together and the
// ground is graded round the clearing; 0.55 m elsewhere (Flow Monster's own v1 banks reach
// 0.505 m per 0.5 m on its own hill, 101% of the old 0.5 m limit). Jumps and their banks are left
// out, and so are stretches where skip(s). Returns { worst, at } (worst < 1 passes).
export function steepestAcross(T, s0, s1, skip = () => false) {
  let worst = 0, at = null;
  for (let s = s0; s < s1; s += 3.7) {
    if (skip(s)) continue;
    let prev = null;
    for (let off = -60; off <= 60; off += 0.5) {
      const p = T.pointAt(s, off), here = WORLD.sample(p.x, p.z);
      const nearClearing = Math.min(WORLD.trailhead.distanceOutside(p.x, p.z), WORLD.finish.distanceOutside(p.x, p.z)) < 40;
      const onSome = here.near.some(n => n.past < 2.5) || here.near.filter(n => n.past < 10).length > 1 || nearClearing;
      // jump lips, holes and landings are steep on purpose, right across the trail and its banks
      // (as in tests/ground.test.js)
      const nearJump = here.near.some(n => n.past < 21 && n.trail.jumps.some(j => n.s > j.s - j.kick - 2 && n.s < j.end + 2));
      if (prev !== null && !nearJump && !prev.nearJump) {
        const step = Math.abs(here.height - prev.h) / (onSome || prev.onSome ? 0.85 : 0.55);
        if (step > worst) { worst = step; at = { s, off, step: Math.abs(here.height - prev.h) }; }
      }
      prev = { h: here.height, onSome, nearJump };
    }
  }
  return { worst, at };
}
