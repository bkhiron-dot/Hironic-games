// Keyboard and on-screen touch pads. Both set the same `keys` flags the physics reads.
const KEY_MAP = {
  ArrowUp: 'pedal', KeyW: 'pedal', ArrowDown: 'brake', KeyS: 'brake',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'hop',
};

export function releaseAll(keys) {
  for (const k in keys) keys[k] = false;
}

// getState() returns the run state; onEndRun is R during a run; onStart is Enter on a menu.
export function createInput({ getState, onEndRun, onStart }) {
  const keys = { left: false, right: false, pedal: false, brake: false, hop: false };
  // typing a name for the high scores must not steer the bike
  const typing = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

  window.addEventListener('keydown', e => {
    if (typing(e)) return;
    const state = getState();
    if (KEY_MAP[e.code] && state !== 'done' && state !== 'menu') { keys[KEY_MAP[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyR' && (state === 'ride' || state === 'crash')) onEndRun();
    if (e.code === 'Enter' && (state === 'menu' || state === 'done')) { e.preventDefault(); onStart(); }
  });
  window.addEventListener('keyup', e => {
    if (typing(e)) return;
    if (KEY_MAP[e.code]) { keys[KEY_MAP[e.code]] = false; e.preventDefault(); }
  });
  window.addEventListener('blur', () => releaseAll(keys)); // don't keep pedalling after switching apps

  // Touch pads: pointer capture keeps a pad held even if the finger slides off it.
  document.querySelectorAll('.pad').forEach(pad => {
    const k = pad.dataset.key;
    const press = e => { e.preventDefault(); keys[k] = true; pad.classList.add('on'); try { pad.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ } };
    const release = () => { keys[k] = false; pad.classList.remove('on'); };
    pad.addEventListener('pointerdown', press);
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('lostpointercapture', release);
    pad.addEventListener('contextmenu', e => e.preventDefault());
  });
  return keys;
}
