// Everything on screen that isn't 3D: timer, speed and grip, split times, messages,
// the start and end screens, name entry and the high-score boards.
import { BOARD_NAMES } from './scores.js';
import { clamp } from './util.js';

const NAME_KEY = 'hardline-mtb-name'; // last name typed, shared with v1 so it's remembered

export const formatTime = t => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
};
const formatDelta = d => (d < 0 ? '-' : '+') + Math.abs(d).toFixed(2);

export function createHud({ scores, trail, coarse }) {
  const splitCount = trail.splits.length, finishBoard = splitCount - 1;
  const $ = id => document.getElementById(id);
  const el = {
    time: $('time'), speed: $('speed'), gripFill: $('gripFill'), gripLabel: $('gripLabel'),
    splitLabel: $('splitLabel'), splitDelta: $('splitDelta'), toast: $('toast'),
    startScreen: $('startScreen'), finishScreen: $('finishScreen'),
    endLabel: $('endLabel'), finalTime: $('finalTime'), endNote: $('endNote'),
    nameForm: $('nameForm'), nameInput: $('nameInput'), nameErr: $('nameErr'), hsList: $('hsList'),
    againBtn: $('againBtn'), pbLine: $('pbLine'), game: $('game'),
  };
  let toastTimer = 0, mineIds = new Set(), pending = [];

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1700);
  }

  function courseRecordLine() {
    const r = scores.top(trail.id, finishBoard)[0];
    el.pbLine.textContent = r ? 'Course record: ' + r.name + '  ' + formatTime(r.time) : 'No finish times yet. Set the first course record.';
  }

  // Draws every scoreboard on the page (start and end screens), each on its own tab.
  function renderBoards() {
    document.querySelectorAll('.scoreboard').forEach(board => {
      const tab = +board.dataset.tab || 0, rows = scores.top(trail.id, tab);
      let h = '<div class="hs-title">HIGH SCORES</div><div class="hs-tabs" role="tablist">';
      BOARD_NAMES.forEach((n, i) => { h += `<button class="hs-tab" role="tab" type="button" data-i="${i}" aria-selected="${i === tab}">${i === finishBoard ? 'FIN' : 'S' + (i + 1)}</button>`; });
      h += '</div><div class="hs-table" role="table" aria-label="' + BOARD_NAMES[tab] + ' top 10">';
      for (let k = 0; k < 10; k++) {
        const r = rows[k];
        if (r) h += `<div class="hs-row${k === 0 ? ' first' : ''}${mineIds.has(r.id) ? ' mine' : ''}" role="row"><span>${k + 1}.</span><span></span><span>${formatTime(r.time)}</span></div>`;
        else h += `<div class="hs-row empty" role="row"><span>${k + 1}.</span><span>----------</span><span>-:--.--</span></div>`;
      }
      h += '</div><div class="hs-note">' + BOARD_NAMES[tab] + ' · this device</div>';
      board.innerHTML = h;
      // names go in as text, never as HTML
      const nameCells = board.querySelectorAll('.hs-row:not(.empty) span:nth-child(2)');
      rows.slice(0, 10).forEach((r, k) => { if (nameCells[k]) nameCells[k].textContent = r.name; });
      board.querySelectorAll('.hs-tab').forEach(t => t.addEventListener('click', () => { board.dataset.tab = t.dataset.i; renderBoards(); }));
    });
    courseRecordLine();
  }

  function resetSplit() {
    el.splitLabel.textContent = `Split 0 of ${splitCount}`;
    el.splitDelta.textContent = '--';
    el.splitDelta.className = 'mid';
  }

  // n = split number (the last is the finish); record = the current best for this split, if any.
  function showSplit(n, time, record) {
    el.splitLabel.textContent = n === splitCount ? 'Finish' : `Split ${n} of ${splitCount}`;
    if (record) {
      const d = time - record.time;
      el.splitDelta.textContent = formatDelta(d) + ' vs record';
      el.splitDelta.className = 'mid ' + (d <= 0 ? 'ahead' : 'behind');
    } else {
      el.splitDelta.textContent = formatTime(time);
      el.splitDelta.className = 'mid';
    }
  }

  function hideScreens() {
    el.startScreen.hidden = true;
    el.finishScreen.hidden = true;
    el.game.focus?.();
  }

  // Every frame: clock, speed and the grip bar.
  function update(runTime, b) {
    el.time.textContent = formatTime(runTime);
    el.speed.textContent = Math.round(b.v * 3.6) + ' km/h';
    const used = clamp(b.grip, 0, 1);
    el.gripFill.style.width = (used * 100).toFixed(0) + '%';
    el.gripFill.className = 'grip-fill' + (b.slide > 0 ? ' slide' : used > 0.8 ? ' warn' : '');
    el.gripLabel.textContent = b.slide > 0 ? 'Sliding' : 'Grip used';
  }

  // kind: 'finish', 'crash' (big crash) or 'restart' (R). pending: times that made a top 10.
  function showRunEnd({ kind, runTime, splits, crashes, pending: qualified }) {
    const reached = splits.length;
    el.endLabel.textContent = kind === 'finish' ? 'Finish' : kind === 'crash' ? 'Big crash: run over' : 'Run ended';
    el.finalTime.textContent = kind === 'finish' ? formatTime(runTime)
      : reached ? BOARD_NAMES[reached - 1] + '  ' + formatTime(splits[reached - 1]) : 'No splits';
    el.endNote.textContent = kind === 'finish'
      ? (crashes ? crashes + ' small crash' + (crashes > 1 ? 'es' : '') + ' on the way down.' : 'Clean run, no crashes.')
      : (reached ? 'Split times you set before the crash still count for the high scores.' : 'Reach split 1 to get on the board.');
    mineIds = new Set();
    pending = qualified;
    el.nameForm.hidden = !pending.length;
    el.nameErr.hidden = true;
    if (pending.length) {
      el.hsList.textContent = pending.map(p => BOARD_NAMES[p.board] + ' ' + formatTime(p.time) + ' (#' + scores.rankOf(trail.id, p.board, p.time) + ')').join('  ·  ');
      let last = '';
      try { last = localStorage.getItem(NAME_KEY) || ''; } catch (_) { /* storage blocked */ }
      el.nameInput.value = last;
    }
    // open the board for the furthest split reached
    el.finishScreen.querySelector('.scoreboard').dataset.tab = reached ? String(reached - 1) : String(finishBoard);
    renderBoards();
    el.finishScreen.hidden = false;
    if (pending.length && !coarse) setTimeout(() => el.nameInput.focus(), 50); // no keyboard pop-up on phones
  }

  el.nameInput.addEventListener('input', () => { el.nameErr.hidden = true; });
  el.nameForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = el.nameInput.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 10);
    if (!name) { el.nameErr.hidden = false; el.nameInput.focus(); return; }
    try { localStorage.setItem(NAME_KEY, name); } catch (_) { /* storage blocked */ }
    el.nameForm.hidden = true;
    for (const p of pending) mineIds.add(scores.add(trail.id, p.board, name, p.time));
    pending = [];
    renderBoards();
    el.againBtn.focus();
  });

  renderBoards();
  return { toast, resetSplit, showSplit, hideScreens, update, showRunEnd, renderBoards };
}
