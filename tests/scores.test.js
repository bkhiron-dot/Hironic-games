// The score store: top 10 per board, fastest first, saved and loaded again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScoreStore } from '../src/scores.js';

// A stand-in for the browser's localStorage.
function memoryStorage() {
  const data = new Map();
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), data };
}

test('keeps the 10 fastest per board, fastest first', () => {
  const store = createScoreStore('test', memoryStorage());
  for (let i = 0; i < 15; i++) store.add('hardline', 3, 'R' + i, 100 - i);
  const rows = store.top('hardline', 3);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map(r => r.time), [86, 87, 88, 89, 90, 91, 92, 93, 94, 95]);
  assert.deepEqual(store.top('hardline', 0), [], 'other boards untouched');
});

test('a time qualifies until the board is full, then only if it beats 10th', () => {
  const store = createScoreStore('test', memoryStorage());
  for (let i = 0; i < 9; i++) store.add('hardline', 0, 'A', 50 + i);
  assert.ok(store.qualifies('hardline', 0, 999), 'board not full yet');
  store.add('hardline', 0, 'A', 59);
  assert.ok(!store.qualifies('hardline', 0, 59), 'ties with 10th do not get on');
  assert.ok(store.qualifies('hardline', 0, 58.9));
  assert.equal(store.rankOf('hardline', 0, 50.5), 2);
});

test('scores survive a reload, and damaged saved data starts fresh', () => {
  const storage = memoryStorage();
  createScoreStore('test', storage).add('hardline', 1, 'BEN', 42.5);
  assert.equal(createScoreStore('test', storage).top('hardline', 1)[0].name, 'BEN');
  storage.setItem('test', '{not json');
  assert.deepEqual(createScoreStore('test', storage).top('hardline', 1), []);
  storage.setItem('test', JSON.stringify({ hardline: 'nonsense' }));
  assert.deepEqual(createScoreStore('test', storage).top('hardline', 1), []);
});

test('works with no storage at all (private browsing)', () => {
  const store = createScoreStore('test', null);
  store.add('hardline', 2, 'X', 10);
  assert.equal(store.top('hardline', 2).length, 1);
});
