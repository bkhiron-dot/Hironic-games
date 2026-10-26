// One run down the trail: start, timing and splits, crashes, and the end of the run.
// States: 'menu' (start screen), 'ride', 'crash' (tumbling), 'done' (end screen).
// On the mountain (src/world.js) the run is on whichever trail's gate you ride out of the
// trailhead through: the trail being ridden switches as you pass it, with no break.
import * as THREE from './three.js';
import { clamp } from './util.js';
import { G, placeBikeAt, placeBikeAtPoint, stepRide } from './physics.js';
import { releaseAll } from './input.js';
import { formatTime } from './hud.js';

// effects: the dirt thrown up on berm hits and landings (visual only).
// world: the mountain, if the trail is on one; trail: the trail to start on.
// onTrailChange(trail): the rider has gone through another trail's gate.
export function createRun({ b, keys, world, trail, scene, chassis, rider, treeBuckets, hud, scores, chaseCamera, effects, onTrailChange }) {
  let state = 'menu', runTime = 0, timing = false, nextSplit = 0, crashes = 0, splits = [];
  let crashT = 0, crashBig = false, crashS = 0, againstFence = false;
  const tumble = { vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), fallDir: 1 };

  // Put the rider back on the bike after a tumble.
  function remount() {
    if (rider.parent !== chassis) chassis.add(rider);
    rider.position.set(0, 0, 0);
    rider.rotation.set(0, 0, 0);
  }

  // The trail being ridden from now on (after a gate, or picking one to start on).
  function setTrail(t) {
    if (t === trail) return;
    trail = t;
    runTime = 0; timing = false; nextSplit = 0; splits = []; // a fresh run on this trail
    hud.resetSplit();
    b.s = trail.locate(b.x, b.z).s;
    if (onTrailChange) onTrailChange(trail);
  }

  // from: 'trailhead' (at rest at the back of the clearing) or 'gate' (just above the start gate).
  function resetRun(from = 'trailhead') {
    runTime = 0; timing = false; nextSplit = 0; crashes = 0; splits = [];
    remount();
    const th = trail.trailhead, spot = th && (from === 'trailhead' ? th.dropIn : th.atGate);
    if (spot) placeBikeAtPoint(b, trail, spot.x, spot.z, spot.h, 0);
    else placeBikeAt(b, trail, trail.start.spawn, 0);
    chaseCamera.snap(b);
    hud.resetSplit();
  }

  function startRun(from = 'trailhead') {
    resetRun(from);
    state = 'ride';
    hud.hideScreens();
  }

  // The clearings' fences and closed gates stop the bike where it touches them. Riding out of
  // the trailhead through another trail's gate puts you on that trail.
  function stopAtFence(x0, z0) {
    const fences = world || trail.trailhead;
    const hit = fences && fences.blocked(x0, z0, b.x, b.z);
    if (hit && hit.out && world) setTrail(world.trail(hit.out.difficulty));
    if (!hit || hit.out) { againstFence = false; return; }
    b.x = x0; b.z = z0; b.s = trail.locate(x0, z0).s; b.v = 0; b.slipV = 0;
    if (!againstFence) hud.toast(hit.gate ? hit.gate.name + ': coming soon' : 'Fence: head for the open gate');
    againstFence = true;
  }

  // Small crash: tumble, get back on where you fell, clock keeps running.
  // Big crash: bigger tumble, then the run is over.
  function crash(reason, big) {
    if (state !== 'ride') return;
    state = 'crash'; crashT = 0; crashBig = big; crashS = b.s;
    if (!big) crashes++;
    const f = [Math.sin(b.h), -Math.cos(b.h)], k = big ? 1 : 0.55;
    scene.attach(rider); // the rider leaves the bike and flies on alone
    tumble.vx = f[0] * b.v * 0.55 * k + (Math.random() - 0.5) * 2;
    tumble.vz = f[1] * b.v * 0.55 * k + (Math.random() - 0.5) * 2;
    tumble.vy = (big ? 3.5 : 1.8) + b.v * 0.1 * k;
    tumble.spin.set((Math.random() + 0.6) * (big ? 7 : 3.5), (Math.random() - 0.5) * 4, (Math.random() - 0.5) * (big ? 9 : 4));
    tumble.fallDir = Math.random() < 0.5 ? -1 : 1;
    b.v = 0;
    hud.toast(big ? 'Big crash: ' + reason : 'Small crash: ' + reason);
  }

  // Back on the bike just past where you fell, but never on a jump.
  function resumeHere() {
    remount();
    let s = clamp(crashS + 1, trail.start.spawn, trail.length - 2);
    for (const j of trail.jumps) if (s > j.s - j.kick && s < j.end + 2) s = j.end + 3;
    placeBikeAt(b, trail, s, 0);
    state = 'ride';
    hud.toast('Back on the bike, clock still running');
  }

  // End of a run (finish, big crash or R): show times, ask for a name if any split made the top 10.
  function endRun(kind) {
    state = 'done'; timing = false;
    releaseAll(keys);
    const pending = [];
    splits.forEach((t, i) => { if (t != null && scores.qualifies(trail.id, i, t)) pending.push({ board: i, time: t }); });
    hud.showRunEnd({ kind, runTime, splits, crashes, pending });
  }

  function stepRiding(dt) {
    const x0 = b.x, z0 = b.z;
    const events = stepRide(b, keys, trail, treeBuckets, timing, dt);
    for (const e of events) {
      if (e.type === 'toast') hud.toast(e.text);
      else if (e.type === 'shake') chaseCamera.setShake(e.amount);
      else if (e.type === 'bermHit') { effects.bermHit(b, e.strength, e.side); chaseCamera.setShake(0.15 * e.strength); }
      else if (e.type === 'landing') effects.landing(b, e.use);
      else if (e.type === 'crash') { crash(e.reason, e.big); return; }
    }
    stopAtFence(x0, z0);
    // timing starts through the start gate (out of the clearing); each split gate records a time
    const th = trail.trailhead, splitsAt = trail.splits;
    const s = b.s, leftClearing = !th || !th.inClearing(b.x, b.z);
    if (!timing && s > trail.start.gate && leftClearing && nextSplit === 0 && runTime === 0) timing = true;
    if (timing) runTime += dt;
    if (timing && nextSplit < splitsAt.length && s >= splitsAt[nextSplit]) {
      splits[nextSplit] = runTime;
      const n = nextSplit + 1;
      hud.showSplit(n, runTime, scores.top(trail.id, nextSplit)[0]);
      nextSplit++;
      if (nextSplit === splitsAt.length) { endRun('finish'); return; }
      hud.toast('Split ' + n + '  ' + formatTime(runTime));
    }
    if (!th && s < -15) placeBikeAt(b, trail, trail.start.spawn, 0); // rode back up past the top: start again
  }

  function stepCrashing(dt) {
    crashT += dt;
    if (timing) runTime += dt;
    tumble.vy -= G * dt;
    rider.position.x += tumble.vx * dt; rider.position.y += tumble.vy * dt; rider.position.z += tumble.vz * dt;
    rider.rotation.x += tumble.spin.x * dt; rider.rotation.y += tumble.spin.y * dt; rider.rotation.z += tumble.spin.z * dt;
    // bounce off the ground, losing energy each time
    const gy = trail.groundAt(rider.position.x, rider.position.z);
    if (rider.position.y < gy - 0.35) {
      rider.position.y = gy - 0.35;
      tumble.vy = Math.abs(tumble.vy) * 0.3; tumble.vx *= 0.6; tumble.vz *= 0.6;
      tumble.spin.multiplyScalar(0.6);
    }
    b.lean += (tumble.fallDir * 1.35 - b.lean) * Math.min(1, dt * 4); // the bike falls over
    if (crashT > (crashBig ? 2.2 : 1.1)) {
      if (crashBig) endRun('crash'); else resumeHere();
    }
  }

  function step(dt) {
    if (state === 'ride') stepRiding(dt);
    else if (state === 'crash') stepCrashing(dt);
  }

  return {
    get state() { return state; },
    get runTime() { return runTime; },
    get trail() { return trail; },
    resetRun, startRun, endRun, step,
    // pick the trail to start on (the start screen); only before a run
    chooseTrail(t) { setTrail(t); resetRun('trailhead'); },
  };
}
