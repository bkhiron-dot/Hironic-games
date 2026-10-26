// Every jump kind declares the landing ranges it was tuned for (src/jumps.js), and a
// trail jump with a changed shape must declare its own. This checks every kind and every
// jump on every trail with the jump simulator. If a physics or shape change moves
// them, these fail and we decide on purpose whether the new ranges are better.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_KINDS } from '../src/jumps.js';
import { TRAILS } from '../src/trails/index.js';
import { jumpOfKind, simulate, simulateOn } from '../tools/jump-sim.js';

const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 2) r.push(k); return r; };

// Checks one declared landing range. ride(kmh, pop) rides the jump.
function checkLanding(ride, { pop, from, to, outcome }, label) {
  for (const kmh of speeds(from, to)) {
    const got = ride(kmh, pop).outcome;
    const where = `${label}: ${kmh} km/h ${pop ? 'with pop ' + pop : 'no pop'}`;
    if (outcome === 'not smooth') assert.notEqual(got, 'smooth', where);
    else if (outcome === 'clean') assert.ok(got === 'smooth' || got === 'rolled', `${where}: ${got}`); // rolled over it or landed smooth
    else if (outcome === 'no crash') assert.ok(!got.includes('crash'), `${where}: ${got}`);
    else assert.equal(got, outcome, where);
  }
}

for (const [kind, shape] of Object.entries(JUMP_KINDS)) {
  for (const landing of shape.landings) {
    const { pop, from, to, outcome } = landing;
    test(`${kind} jump: ${outcome} from ${from} to ${to} km/h ${pop ? 'with a full pop' : 'without a pop'}`, () => {
      checkLanding((kmh, pop) => simulate(jumpOfKind(kind), kmh, pop), landing, kind);
    });
  }
}

for (const trail of TRAILS) {
  for (const j of trail.jumps) {
    for (const landing of j.landings) {
      const { pop, from, to, outcome } = landing;
      test(`${trail.name} jump at ${j.s} m (${j.kind}): ${outcome} from ${from} to ${to} km/h ${pop ? 'with a full pop' : 'without a pop'}`, () => {
        // on the trail's own grade, or (on the mountain) where it is on the trail
        checkLanding((kmh, p) => simulateOn(trail, j, kmh, p), landing, `${trail.name} ${j.s} m`);
      });
    }
  }
}
