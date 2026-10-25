// Version numbers and which build is which (start screen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSIONS, channelOf, versionLabel } from '../src/version.js';
import { PARKS } from '../src/parks.js';
import { TRAILS } from '../src/trails/index.js';

test('versions are major.minor numbers', () => {
  for (const v of Object.values(VERSIONS)) assert.match(v, /^\d+\.\d+$/);
});

test('the live game, previews and local builds are told apart by their address', () => {
  const at = (hostname, pathname) => channelOf({ hostname, pathname });
  assert.equal(at('bkhiron-dot.github.io', '/Hironic-games/'), 'main');
  assert.equal(at('bkhiron-dot.github.io', '/Hironic-games/preview/pr-14/'), 'next');
  assert.equal(at('localhost', '/'), 'dev');
  assert.equal(versionLabel('main'), `v${VERSIONS.main} main`);
  assert.ok(versionLabel('next').startsWith(`v${VERSIONS.next} next`));
});

test('every trail belongs to a bike park', () => {
  const inParks = PARKS.flatMap(p => p.trails);
  for (const t of TRAILS) assert.ok(inParks.includes(t), `${t.name} is in a park`);
});
