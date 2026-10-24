// High scores: top 10 per board (each split and the finish), kept per trail.
// Stored in this browser (localStorage) behind a small interface, so a shared online
// store can replace it later without changing the rest of the game.
export const TRAIL_ID = 'hardline'; // v1's track; roadmap step 3 adds more trails
export const BOARD_NAMES = ['Split 1', 'Split 2', 'Split 3', 'Finish'];
const TOP = 10;

// localStorage can be missing or throw (private browsing, blocked storage); scores then
// last only until the page closes.
function browserStorage() {
  try { return globalThis.localStorage || null; } catch (_) { return null; }
}

export function createScoreStore(storageKey, storage = browserStorage()) {
  let trails = {};

  function load() {
    trails = {};
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') trails = saved;
    } catch (_) { /* unreadable: start fresh */ }
  }
  function save() {
    try { storage?.setItem(storageKey, JSON.stringify(trails)); } catch (_) { /* full or blocked */ }
  }
  // The boards for a trail, created empty (or replaced, if the saved data is damaged).
  function boardsOf(trail) {
    const boards = trails[trail];
    if (Array.isArray(boards) && boards.length === BOARD_NAMES.length && boards.every(Array.isArray)) return boards;
    return (trails[trail] = BOARD_NAMES.map(() => []));
  }

  // Fastest first, at most 10.
  const top = (trail, board) => boardsOf(trail)[board];
  const qualifies = (trail, board, time) => {
    const rows = top(trail, board);
    return rows.length < TOP || time < rows[TOP - 1].time;
  };
  const rankOf = (trail, board, time) => top(trail, board).filter(r => r.time <= time).length + 1;

  // Adds a time and returns its id (so the screen can highlight your new entries).
  function add(trail, board, name, time) {
    const id = 's' + Date.now() + Math.random().toString(36).slice(2, 6);
    const boards = boardsOf(trail);
    boards[board] = [...boards[board], { id, name, time }].sort((a, b) => a.time - b.time).slice(0, TOP);
    save();
    return id;
  }

  load();
  return { load, add, top, qualifies, rankOf };
}
