// One run down the trail: start, timing and splits, crashes, and the end of the run.
// States: 'menu' (start screen), 'ride', 'crash' (tumbling), 'done' (end screen).
import * as THREE from './three.js';
import { clamp } from './util.js';
import { G, placeBikeAt, stepRide } from './physics.js';
import { releaseAll } from './input.js';
import { formatTime } from './hud.js';

export function createRun({ b, keys, trail, scene, chassis, rider, treeBuckets, hud, scores, chaseCamera }) {
  const { spawn, gate } = trail.start; // where the bike waits, and the timing gate
  const splitsAt = trail.splits;
  let state = 'menu', runTime = 0, timing = false, nextSplit = 0, crashes = 0, splits = [];
  let crashT = 0, crashBig = false, crashS = 0;
  const tumble = { vx: 0, vy: 0, vz: 0, spin: new THREE.Vector3(), fallDir: 1 };

  // Put the rider back on the bike after a tumble.
  function remount() {
    if (rider.parent !== chassis) chassis.add(rider);
    rider.position.set(0, 0, 0);
    rider.rotation.set(0, 0, 0);
  }

  function resetRun() {
    runTime = 0; timing = false; nextSplit = 0; crashes = 0; splits = [];
    remount();
    placeBikeAt(b, trail, spawn, 0);
    chaseCamera.snap(b);
    hud.resetSplit();
  }

  function startRun() {
    resetRun();
    state = 'ride';
    hud.hideScreens();
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
    let s = clamp(crashS + 1, spawn, trail.length - 2);
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
    const events = stepRide(b, keys, trail, treeBuckets, timing, dt);
    for (const e of events) {
      if (e.type === 'toast') hud.toast(e.text);
      else if (e.type === 'shake') chaseCamera.setShake(e.amount);
      else if (e.type === 'crash') { crash(e.reason, e.big); return; }
    }
    // timing starts at the start gate; each split gate records a time
    const s = b.s;
    if (!timing && s > gate && nextSplit === 0 && runTime === 0) timing = true;
    if (timing) runTime += dt;
    if (timing && nextSplit < splitsAt.length && s >= splitsAt[nextSplit]) {
      splits[nextSplit] = runTime;
      const n = nextSplit + 1;
      hud.showSplit(n, runTime, scores.top(trail.id, nextSplit)[0]);
      nextSplit++;
      if (nextSplit === splitsAt.length) { endRun('finish'); return; }
      hud.toast('Split ' + n + '  ' + formatTime(runTime));
    }
    if (s < -15) placeBikeAt(b, trail, spawn, 0); // rode back up past the top: start again
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
    resetRun, startRun, endRun, step,
  };
}
