// All the trails, checked and ready to ride, on one mountain (src/world.js).
import { createWorld } from '../world.js';
import flowMonster from './flow-monster.js';
import jollyGreenGiant from './jolly-green-giant.js';
import backInBlack from './back-in-black.js';

// The mountain with all three trails. WORLD.trails are the trails as the game rides them.
export const WORLD = createWorld([jollyGreenGiant, flowMonster, backInBlack]);
// Each trail on its own (its own ground only; the jump simulator and many tests ride these).
export const [JOLLY_GREEN_GIANT, FLOW_MONSTER, BACK_IN_BLACK] = WORLD.ownTrails;
export const TRAILS = WORLD.ownTrails;
