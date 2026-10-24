// Hardline MTB v2: builds the world, wires the parts together and runs the frame loop.
import './style.css';
import { makeRandom } from './util.js';
import { TRACK_SEED } from './legacy-track.js';
import { createScene, buildMountains, followWithSun } from './scene.js';
import { buildTerrain } from './terrain.js';
import { planForest, buildForest } from './forest.js';
import { buildMarkers } from './markers.js';
import { createKit, createBike, updateCranks } from './bike.js';
import { createRider, updateLegs } from './rider.js';
import { createDust } from './dust.js';
import { createBikeState, stepSuspension } from './physics.js';
import { createChaseCamera } from './camera.js';
import { createInput } from './input.js';
import { createScoreStore } from './scores.js';
import { createHud } from './hud.js';
import { createRun } from './run.js';

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
const random = makeRandom(TRACK_SEED);
buildTerrain(scene, renderer, random);
const forestPlan = planForest(random);
const forest = buildForest(scene, forestPlan);
buildMountains(scene, random);
buildMarkers(scene);

const kit = createKit();
const { bike, chassis, cranks } = createBike(scene, kit);
const { rider, upper, legs } = createRider(chassis, kit);
const dust = createDust(scene);
const b = createBikeState();
const chaseCamera = createChaseCamera(camera, reduceMotion);
const scores = createScoreStore(SCORES_KEY);
const hud = createHud({ scores, coarse });

let run = null;
const keys = createInput({
  getState: () => run.state,
  onEndRun: () => run.endRun('restart'),
  onStart: () => run.startRun(),
});
run = createRun({ b, keys, scene, chassis, rider, treeBuckets: forestPlan.treeBuckets, hud, scores, chaseCamera });
document.getElementById('startBtn').addEventListener('click', () => run.startRun());
document.getElementById('againBtn').addEventListener('click', () => run.startRun());

/* ---------- Frame loop ---------- */
let last = performance.now(), menuTime = 0, crankAngle = 0;

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); // cap the step so a slow frame can't tunnel through things
  last = now;
  if (run.state === 'menu') menuTime += dt;
  run.step(dt);

  bike.position.set(b.x, b.y, b.z);
  bike.rotation.set(b.pitch, -(b.h + b.drift), -b.lean);
  dust.update(dt, b, run.state === 'ride');

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
  forest.showNear(-b.z);
  hud.update(run.runTime, b);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

run.resetRun();
requestAnimationFrame(frame);
