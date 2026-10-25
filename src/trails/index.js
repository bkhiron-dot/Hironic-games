// All the trails, checked and ready to ride.
import { defineTrail } from '../trail.js';
import flowMonster from './flow-monster.js';
import jollyGreenGiant from './jolly-green-giant.js';

export const FLOW_MONSTER = defineTrail(flowMonster);
export const JOLLY_GREEN_GIANT = defineTrail(jollyGreenGiant);
export const TRAILS = [JOLLY_GREEN_GIANT, FLOW_MONSTER];
