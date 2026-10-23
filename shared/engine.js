// Small shared toolkit for every game: canvas, loop, input, sound, saving.
// Deliberately tiny so the kids can read it.

/**
 * Create a full-screen canvas that keeps itself sized to the window.
 * Drawing uses CSS pixels; devicePixelRatio is handled for sharp graphics.
 */
export function createCanvas() {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const view = { canvas, ctx, width: 0, height: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();
  return view;
}

/**
 * Run update(dt) then draw() every frame. dt is seconds since last frame,
 * capped so a paused tab doesn't make things teleport.
 */
export function startLoop(update, draw) {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/**
 * Keyboard + pointer (mouse/touch) state.
 * input.keys.has("ArrowLeft"), input.pointer.x / .y / .down,
 * input.consumeTap() returns true once per click/tap.
 */
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pointer: { x: null, y: null, down: false },
    tapped: false,
    consumeTap() {
      const t = this.tapped;
      this.tapped = false;
      return t;
    },
  };

  window.addEventListener("keydown", (e) => {
    input.keys.add(e.key);
    if (e.key === " " || e.key === "Enter") input.tapped = true;
  });
  window.addEventListener("keyup", (e) => input.keys.delete(e.key));
  window.addEventListener("blur", () => input.keys.clear());

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    input.pointer.x = e.clientX - rect.left;
    input.pointer.y = e.clientY - rect.top;
  }
  canvas.addEventListener("pointerdown", (e) => {
    setPointer(e);
    input.pointer.down = true;
    input.tapped = true;
  });
  canvas.addEventListener("pointermove", setPointer);
  window.addEventListener("pointerup", () => (input.pointer.down = false));
  window.addEventListener("pointercancel", () => (input.pointer.down = false));

  return input;
}

// ---------- Sound ----------
// Simple synthesised beeps, so no audio files are needed.
let audio = null;
export function beep(frequency = 440, duration = 0.1, type = "square", volume = 0.1) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    // Sound is a nice-to-have; never let it break the game.
  }
}

// ---------- Saving ----------
// Stored per game in this browser only. Wrapped in try/catch because
// storage can be blocked (private browsing, some school devices).
export function save(game, key, value) {
  try {
    localStorage.setItem(`hironic:${game}:${key}`, JSON.stringify(value));
  } catch {}
}

export function load(game, key, fallback) {
  try {
    const raw = localStorage.getItem(`hironic:${game}:${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ---------- Helpers ----------
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const random = (min, max) => min + Math.random() * (max - min);

/** Axis-aligned rectangle overlap test: objects need x, y, w, h. */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Draw centred text, e.g. titles and "Game Over". */
export function drawText(ctx, text, x, y, size = 32, color = "#f5f7ff") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}
