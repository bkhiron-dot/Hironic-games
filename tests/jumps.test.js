// Every jump kind declares the landing ranges it was tuned for (src/jumps.js), and a
// trail jump with a changed shape must declare its own. This checks every kind and every
// jump on every trail with the jump simulator. If a physics or shape change moves
// them, these fail and we decide on purpose whether the new ranges are better.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_KINDS } from '../src/jumps.js';
import { TRAILS } from '../src/trails/index.js';
import { jumpOfKind, simulate } from '../tools/jump-sim.js';

// Declared ranges that the game's own physics no longer gives, waiting on Ben's decision in
// tuning round PR 2 (accept the measured range, or reshape the jump). Shown as TODO.
const AWAITING_DECISION = {
  'normal big crash 0 76': 'measured: small crash at 76 km/h',
  'popOptional smooth 0 52': 'measured: smooth 54-68 km/h',
  'bigPop smooth 3 52': 'measured: smooth 56-68 km/h; last jump being reshaped',
};
const pending = (kind, { outcome, pop, from }) => AWAITING_DECISION[`${kind} ${outcome} ${pop} ${from}`];

const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 2) r.push(k); return r; };

// Checks one declared landing range.
function checkLanding(j, { pop, from, to, outcome }, label) {
  for (const kmh of speeds(from, to)) {
    const got = simulate(j, kmh, pop).outcome;
    const where = `${label}: ${kmh} km/h ${pop ? 'with pop ' + pop : 'no pop'}`;
    if (outcome === 'not smooth') assert.notEqual(got, 'smooth', where);
    else assert.equal(got, outcome, where);
  }
}

for (const [kind, shape] of Object.entries(JUMP_KINDS)) {
  for (const landing of shape.landings) {
    const { pop, from, to, outcome } = landing;
    test(`${kind} jump: ${outcome} from ${from} to ${to} km/h ${pop ? 'with a full pop' : 'without a pop'}`, { todo: pending(kind, landing) }, () => {
      checkLanding(jumpOfKind(kind), landing, kind);
    });
  }
}

for (const trail of TRAILS) {
  for (const j of trail.jumps) {
    for (const landing of j.landings) {
      const { pop, from, to, outcome } = landing;
      test(`${trail.name} jump at ${j.s} m (${j.kind}): ${outcome} from ${from} to ${to} km/h ${pop ? 'with a full pop' : 'without a pop'}`, { todo: pending(j.kind, landing) }, () => {
        checkLanding(j, landing, `${trail.name} ${j.s} m`);
      });
    }
  }
}
