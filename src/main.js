// Hardline MTB: builds the world, wires the parts together and runs the frame loop.
import './style.css';
import { makeRandom } from './util.js';
import { FLOW_MONSTER } from './trails/index.js';
import { withTrailhead } from './trailhead.js';
import { createScene, buildMountains, followWithSun } from './scene.js';
import { buildTerrain } from './terrain.js';
import { planForest, buildForest } from './forest.js';
import { buildMarkers } from './markers.js';
import { createKit, createBike, updateCranks } from './bike.js';
import { createRider, updateLegs } from './rider.js';
import { createDirt } from './dirt.js';
import { createTracks } from './tracks.js';
import { createBikeState, stepSuspension } from './physics.js';
import { createChaseCamera } from './camera.js';
import { createInput } from './input.js';
import { createScoreStore } from './scores.js';
import { createHud } from './hud.js';
import { createRun } from './run.js';
import { createPhysicsClock, MAX_CATCH_UP } from './clock.js';

const SCORES_KEY = 'hardline-mtb-v2-scores'; // separate from v1's scores on the same site

const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia?.('(pointer: coarse)').matches; // touch screen: show the pads
if (coarse) {
  document.documentElement.classList.add('coarse');
  document.getElementById('touchHint').classList.remove('fine-only');
}

const { renderer, scene, camera, sun } = createScene(document.getElementById('game'));

// The world, built in v1's order. Terrain colours, forest and mountains share one
// random sequence, so the order decides where every tree grows.
// One trail at a time for now, with the trailhead clearing at its top.
const trail = withTrailhead(FLOW_MONSTER);
const random = makeRandom(trail.seed);
buildTerrain(scene, renderer, trail, random);
const forestPlan = planForest(trail, random);
const forest = buildForest(scene, forestPlan);
buildMountains(scene, trail, random);
buildMarkers(scene, trail);

const kit = createKit();
const { bike, chassis, cranks } = createBike(scene, kit);
const { rider, upper, legs } = createRider(chassis, kit);
const dirt = createDirt(scene, camera);
const tracks = createTracks(scene, trail);
const b = createBikeState();
const chaseCamera = createChaseCamera(camera, trail, reduceMotion);
const scores = createScoreStore(SCORES_KEY);
const hud = createHud({ scores, trail, coarse });

let run = null;
const keys = createInput({
  getState: () => run.state,
  onEndRun: () => run.endRun('restart'),
  onStart: () => run.startRun(run.state === 'done' ? 'gate' : 'trailhead'), // Enter: drop in, or ride again
});
run = createRun({ b, keys, trail, scene, chassis, rider, treeBuckets: forestPlan.treeBuckets, hud, scores, chaseCamera, effects: dirt });
document.getElementById('startBtn').addEventListener('click', () => run.startRun('trailhead'));
document.getElementById('againBtn').addEventListener('click', () => run.startRun('gate'));
document.getElementById('trailheadBtn').addEventListener('click', () => run.startRun('trailhead'));

/* ---------- Frame loop ---------- */
let last = performance.now(), menuTime = 0, crankAngle = 0;
const clock = createPhysicsClock();

function frame(now) {
  const frameTime = Math.min(MAX_CATCH_UP, (now - last) / 1000);
  last = now;
  // Physics and timing run in fixed steps, the same on every device (src/clock.js).
  clock.advance(frameTime, run.step);
  // Visuals (camera, suspension spring, dust, cranks) move once per frame; capped so a
  // slow frame can't make the spring jump.
  const dt = Math.min(0.033, frameTime);
  if (run.state === 'menu') menuTime += dt;

  bike.position.set(b.x, b.y, b.z);
  bike.rotation.set(b.pitch, -(b.h + b.drift), -b.lean);
  dirt.update(dt, b, run.state === 'ride');
  tracks.update(b, run.state === 'ride');

  // cranks turn while pedalling, otherwise settle level
  const pedalling = run.state === 'ride' && keys.pedal && !b.air;
  if (pedalling) crankAngle += dt * Math.max(5, b.v * 1.4);
  else { const level = Math.round(crankAngle / Math.PI) * Math.PI; crankAngle += (level - crankAngle) * Math.min(1, dt * 6); }

  stepSuspension(b, dt, run.state === 'ride' && !b.air);
  chassis.position.y = -b.susX;
  const comp = b.compress * 0.14 + Math.max(0, b.susX) * 1.1; // how far the hips drop
  upper.position.y = -comp;
  upper.rotation.z = pedalling ? Math.sin(crankAngle) * 0.035 : upper.rotation.z * 0.9; // body rocks with each stroke
  updateCranks(cranks, crankAngle);
  if (rider.parent === chassis) updateLegs(legs, crankAngle, comp);

  chaseCamera.update(dt, b, run.state, menuTime, rider.position);
  followWithSun(sun, b.x, b.y, b.z);
  forest.showNear(b.s);
  hud.update(run.runTime, b);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Adding ?debug to the address hands the game's state to testing tools (screenshots, tuning).
if (new URLSearchParams(location.search).has('debug')) window.hardline = { b, keys, run, trail, dirt, tracks, chaseCamera };

run.resetRun();
requestAnimationFrame(frame);
