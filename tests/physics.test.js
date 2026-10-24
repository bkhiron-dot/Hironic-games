// Checks the v2 bike physics (src/physics.js) behaves exactly like v1.
// v1's own physics code is read out of public/v1.html and run here beside v2. A scripted
// rider feeds both the same key presses, and every bike value is compared at every step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRandom } from '../src/util.js';
import { HARDLINE } from '../src/trails/index.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { createBikeState, placeBikeAt, stepRide } from '../src/physics.js';

const { cx, kickerAt } = HARDLINE;
const random = makeRandom(HARDLINE.seed);
terrainData(HARDLINE, random);
const { treeBuckets } = planForest(HARDLINE, random); // tests/forest.test.js shows these match v1's trees

const section = (html, from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, `section ${from} not found in public/v1.html`);
  return html.slice(a, b);
};

// v1's track and physics, with stand-ins for the screen, timing display and run ending.
function loadV1Physics() {
  const html = readFileSync(new URL('../public/v1.html', import.meta.url), 'utf8');
  const track = section(html, '/* ---------- Track definition ---------- */', '/* ---------- Renderer & scene ---------- */');
  const physics = section(html, '/* ---------- Physics step ---------- */', 'function stepCrash');
  const placeAt = section(html, 'function placeAt(s,speed){', 'function remount');
  const harness = `
    const b={x:0,y:0,z:0,h:0,v:0,vy:0,lean:0,pitch:0,air:false,compress:0};
    const keys={left:false,right:false,pedal:false,brake:false,hop:false};
    b.airT=0; b.susX=0; b.susV=0; b.steerIn=0; b.drift=0; b.slide=0; b.grip=0; b.slipV=0; b.slideMem=0; b.caught=false;
    let slideToastT=0, stuckT=0, shake=0, lastUse=0;
    let state='ride', runTime=0, timing=false, nextCp=0, splits=[];
    const boards=[[],[],[],[]];
    const events=[];
    const toast=text=>events.push({type:'toast',text});
    const crash=(reason,big)=>events.push({type:'crash',reason,big});
    const $=()=>({textContent:'',className:''});
    const fmt=()=>'', fmtD=()=>'', runEnd=()=>{};
    const bike={position:{set(){}},rotation:{set(){}}};
    const buckets=treeBuckets;
    ${placeAt}
    ${physics}
    return { b, keys, events, placeAt, stepRide,
      get timing(){ return timing; }, get shake(){ return shake; }, set shake(v){ shake=v; } };`;
  return new Function('treeBuckets', track + harness)(treeBuckets);
}

const FIELDS = ['x', 'y', 'z', 'h', 'v', 'vy', 'lean', 'pitch', 'air', 'compress', 'airT', 'susV',
  'steerIn', 'drift', 'slide', 'grip', 'slipV', 'slideMem', 'caught'];

// A simple scripted rider: aims at a point 8 m ahead on its chosen line, pedals below one
// speed, brakes above another, and optionally pops off every kicker.
function autopilot(b, keys, plan) {
  const s = -b.z, ahead = s + 8;
  const want = Math.atan2(cx(ahead) + plan.line - b.x, b.z + ahead);
  let err = want - b.h;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  keys.right = err > plan.deadband;
  keys.left = err < -plan.deadband;
  keys.pedal = b.v < plan.pedalBelow;
  keys.brake = b.v > plan.brakeAbove;
  const k = kickerAt(s);
  keys.hop = !!(plan.pop && k && k.u < -0.6);
}

function rideBoth(plan) {
  const v1 = loadV1Physics();
  const b = createBikeState(), keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  v1.placeAt(plan.start, plan.speed);
  placeBikeAt(b, plan.start, plan.speed);
  if (plan.aimAtTree) {
    // point both bikes straight at the nearest gum ahead, off the left side of the trail
    const tree = Object.values(treeBuckets).flat()
      .filter(t => -t.z > plan.start + 6 && t.x < cx(-t.z))
      .sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0];
    v1.b.h = b.h = Math.atan2(tree.x - b.x, b.z - tree.z);
  }
  const dt = 1 / 60, seen = [];
  let stoppedSteps = 0; // steps that ended with the bike at a dead stop
  for (let step = 0; step < plan.seconds * 60; step++) {
    autopilot(b, keys, plan);
    Object.assign(v1.keys, keys);
    const timing = v1.timing;
    v1.events.length = 0; v1.shake = 0;
    v1.stepRide(dt);
    const events = stepRide(b, keys, treeBuckets, timing, dt);
    for (const f of FIELDS) assert.equal(b[f], v1.b[f], `${plan.name}: ${f} differs at step ${step} (s = ${(-b.z).toFixed(1)} m)`);
    // v1 also shows split times from inside the physics step; v2 does that in run.js
    const v1Events = v1.events.filter(e => !(e.type === 'toast' && e.text.startsWith('Split')));
    const ours = events.filter(e => e.type !== 'shake');
    assert.deepEqual(ours, v1Events, `${plan.name}: events differ at step ${step}`);
    const shake = events.find(e => e.type === 'shake');
    assert.equal(shake ? shake.amount : 0, v1.shake, `${plan.name}: camera shake differs at step ${step}`);
    for (const e of events) seen.push(e.type === 'toast' ? e.text : e.type === 'crash' ? `crash: ${e.reason}` : e.type);
    if (b.v === 0) stoppedSteps++;
    const crash = events.find(e => e.type === 'crash');
    if (crash || -b.z > 1195) return { distance: -b.z, steps: step + 1, seen, crash, stoppedSteps };
  }
  return { distance: -b.z, steps: plan.seconds * 60, seen, crash: null, stoppedSteps };
}

const base = { line: 0, deadband: 0.03, pedalBelow: 10, brakeAbove: 99, pop: false, start: 2, speed: 0, seconds: 120 };
const PLANS = [
  { ...base, name: 'steady ride from the start', brakeAbove: 15 },
  { ...base, name: 'flat out, popping every kicker', pedalBelow: 13, pop: true },
  { ...base, name: 'wide line on the right, twitchy steering', line: 2.5, deadband: 0.005, brakeAbove: 17 },
  { ...base, name: 'normal jump at 57 km/h', start: 150, speed: 15.8, seconds: 8 },
  { ...base, name: 'pop-optional jump at 40 km/h with a pop', start: 385, speed: 11, pop: true, seconds: 8 },
  { ...base, name: 'big pop jump at 58 km/h with a pop', start: 940, speed: 16, pop: true, seconds: 8 },
  // Trees: big crash from 9 m/s (32 km/h), small crash below that, and below 2.5 m/s you just stop.
  { ...base, name: 'straight into a gum at 43 km/h', start: 100, speed: 12, aimAtTree: true, seconds: 10, deadband: 9, pedalBelow: 0,
    expect: r => assert.deepEqual(r.crash, { type: 'crash', reason: 'hit a tree', big: true }) },
  { ...base, name: 'straight into a gum at 25 km/h', start: 100, speed: 7, aimAtTree: true, seconds: 10, deadband: 9, pedalBelow: 0,
    expect: r => assert.deepEqual(r.crash, { type: 'crash', reason: 'hit a tree', big: false }) },
  { ...base, name: 'rolling into a gum at walking pace', start: 100, speed: 2, aimAtTree: true, seconds: 10, deadband: 9, pedalBelow: 2, brakeAbove: 2.2,
    expect: r => { assert.equal(r.crash, null); assert.ok(r.stoppedSteps > 0, 'should be stopped dead by the tree'); } },
];

for (const plan of PLANS) {
  test(`v2 physics matches v1 step for step: ${plan.name}`, () => {
    const result = rideBoth(plan);
    assert.ok(result.steps > 30, `${plan.name}: only ${result.steps} steps compared`);
    if (plan.expect) plan.expect(result);
    // what happened, for the test log
    console.log(`  ${plan.name}: ${result.steps} steps, ${result.distance.toFixed(0)} m, events: ${result.seen.join(' | ') || 'none'}`);
  });
}
