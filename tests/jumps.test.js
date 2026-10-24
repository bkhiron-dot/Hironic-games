// Every jump kind declares the landing ranges it was tuned for (src/jumps.js).
// This checks each one with the jump simulator. If a physics or shape change moves
// them, these fail and we decide on purpose whether the new ranges are better.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_KINDS } from '../src/jumps.js';
import { jumpOfKind, simulate } from '../tools/jump-sim.js';

const speeds = (from, to) => { const r = []; for (let k = from; k <= to; k += 2) r.push(k); return r; };

// Checks one declared landing range; returns a readable description for the test name.
export function checkLanding(j, { pop, from, to, outcome }, label) {
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
    test(`${kind} jump: ${outcome} from ${from} to ${to} km/h ${pop ? 'with a full pop' : 'without a pop'}`, () => {
      checkLanding(jumpOfKind(kind), landing, kind);
    });
  }
}
