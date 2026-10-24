// Checks the v2 forest grows exactly where v1's did. v1's own terrain, forest and
// mountain code is read out of public/v1.html and run here with stand-ins for the
// screen, so we can compare every tree you can crash into.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../src/three.js';
import { makeRandom } from '../src/util.js';
import { HARDLINE } from '../src/trails/index.js';
import { terrainData } from '../src/terrain.js';
import { planForest } from '../src/forest.js';
import { buildMountains } from '../src/scene.js';

const section = (html, from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to);
  assert.ok(a > 0 && b > a, `section ${from} not found in public/v1.html`);
  return html.slice(a, b);
};

function runV1World() {
  const html = readFileSync(new URL('../public/v1.html', import.meta.url), 'utf8');
  const code = section(html, '/* ---------- Track definition ---------- */', '/* ---------- Renderer & scene ---------- */')
    + section(html, '/* ---------- Terrain ribbon ---------- */', '/* ---------- Gates ---------- */');
  // Stand-ins: a 2D canvas that ignores drawing, a renderer that only answers the
  // anisotropy question, and a scene that counts what is added.
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const document = { createElement: () => ({ getContext: () => ctx }) };
  const renderer = { capabilities: { getMaxAnisotropy: () => 1 } };
  const scene = { added: 0, add() { this.added++; } };
  return new Function('THREE', 'document', 'renderer', 'scene', `${code}\nreturn { buckets, R, scene };`)(THREE, document, renderer, scene);
}

test('every crashable gum tree is where it was in v1', () => {
  const v1 = runV1World();
  const random = makeRandom(HARDLINE.seed);
  terrainData(random);
  const plan = planForest(random);
  assert.deepEqual(plan.treeBuckets, v1.buckets);
  const count = Object.values(plan.treeBuckets).reduce((n, list) => n + list.length, 0);
  assert.ok(count > 1500, `only ${count} trees`);
});

test('terrain, forest and mountains use the random sequence exactly as v1 did', () => {
  const v1 = runV1World();
  const random = makeRandom(HARDLINE.seed);
  terrainData(random);
  planForest(random);
  buildMountains({ add() {} }, random);
  // If any step drew one random number more or fewer, these would differ.
  for (let i = 0; i < 10; i++) assert.equal(random(), v1.R());
});
