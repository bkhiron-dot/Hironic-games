// TEMPORARY bridge during roadmap step 2a: the old fixed-track names, now read from the
// Hardline trail. Deleted once every module is handed its trail.
import { HARDLINE as T } from './trails/index.js';

export const TRACK_LENGTH = T.length, SPLITS = T.splits, ROCKY_SECTIONS = T.scenery.rocky, TRACK_SEED = T.seed, JUMPS = T.jumps;
export const { cx, cxd, cxdd, halfWidth, curvature, jumpHeight, kickerAt, jumpZone, bermAmount, bermHeight, ground, groundAt } = T;
