// Small UI helpers shared by every dashboard screen.
import { storageMode, getSaveState } from "./shared/store.js";

/** Turn chosen option ids back into their labels, e.g. ["ocean"] → "🌊 Ocean". */
export const labelFor = (options, values) =>
  values.map((v) => options.find(([id]) => id === v)?.[1] ?? v).join(", ") || "(not chosen)";


// Escape anything typed by a player before putting it into the page.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const go = (path) => { location.hash = `#/${path}`; };

export function avatar(profile, size = "") {
  if (!profile) return `<span class="avatar ${size}" style="background:#555">❔</span>`;
  return `<span class="avatar ${size}" style="background:${esc(profile.colour)}">${esc(profile.icon)}</span>`;
}

/** A row of tappable choice buttons. Clicking updates `state[field]` (an array if multi). */
export function choices(field, options, selected, { multi = false, kind = "chip" } = {}) {
  const isOn = (v) => (multi ? selected.includes(v) : selected === v);
  const rowClass = kind.split(" ").map((k) => `${k}s`).join(" "); // "chip big" → "chips bigs"
  return `<div class="choices ${rowClass}" data-field="${field}" data-multi="${multi}">
    ${options.map(([value, label]) => `
      <button type="button" class="${kind} ${isOn(value) ? "on" : ""}" data-value="${esc(value)}"
        ${kind === "swatch" ? `style="background:${esc(value)}" aria-label="${esc(value)}"` : ""}>${label}</button>`).join("")}
  </div>`;
}

/** Wire up every choices() row inside `root` so taps change `state`. */
export function bindChoices(root, state, onChange = () => {}) {
  root.querySelectorAll(".choices").forEach((row) => {
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn) return;
      const { field, multi } = row.dataset;
      const value = btn.dataset.value;
      if (multi === "true") {
        const list = state[field];
        const i = list.indexOf(value);
        i >= 0 ? list.splice(i, 1) : list.push(value);
        btn.classList.toggle("on");
      } else {
        state[field] = isNaN(value) || value === "" ? value : Number(value);
        row.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
      }
      onChange(field);
    });
  });
}

export const emojiOptions = (list) => list.map((e) => [e, e]);

/**
 * Two-tap confirmation for risky buttons (pop-up confirm() dialogs are blocked
 * in some places the dashboard runs). First tap asks, second tap within 3s confirms.
 */
export function confirmTap(button, question) {
  if (button.dataset.armed) return true;
  const original = button.textContent;
  button.dataset.armed = "1";
  button.textContent = question;
  setTimeout(() => { delete button.dataset.armed; button.textContent = original; }, 3000);
  return false;
}

/** Copy text to the clipboard, falling back to selecting it for older browsers. */
export async function copyText(text, textarea, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    textarea.select();
    document.execCommand("copy");
  }
  const original = button.textContent;
  button.textContent = "✅ Copied!";
  setTimeout(() => (button.textContent = original), 2000);
}

export const isCreator = (profile) => profile?.role === "creator";

/** Top bar on every screen after the landing page. The Creator also gets a 🔑 Studio tab. */
export function header(me, active) {
  const tab = (path, label) => `<a href="#/${path}" class="${active === path ? "active" : ""}">${label}</a>`;
  return `<header class="topbar">
    <a class="logo" href="#/home">🎮 <span class="label">Hironic Games</span></a>
    <nav>${tab("home", "🏠 Home")}${tab("create", "🛠️ Create")}${tab("test", "🧪 Test")}${tab("play", "▶ Play")}${isCreator(me) ? tab("studio", "🔑 Studio") : ""}</nav>
    ${saveBadge()}
    <a class="me ${active === "me" ? "active" : ""}" href="#/me">${avatar(me, "small")}<span class="label">${esc(me.name)}</span></a>
    <a class="switch" href="#/" title="Switch player">🔄</a>
  </header>`;
}

// ---------- Save indicator ----------

const SAVE_LABELS = {
  saved: ["☁️", "Saved"],
  saving: ["⏳", "Saving…"],
  error: ["⚠️", "Not saved – check your connection"],
};

function saveBadge() {
  if (storageMode() === "device") {
    return `<span class="save-status device" id="save-status" title="Saved in this browser only">📱 <span class="label">This device</span></span>`;
  }
  const [icon, text] = SAVE_LABELS[getSaveState()];
  return `<span class="save-status ${getSaveState()}" id="save-status" title="${text}">${icon} <span class="label">${text}</span></span>`;
}

window.addEventListener("hironic:save", () => {
  const el = document.getElementById("save-status");
  if (el) el.outerHTML = saveBadge();
});

// ---------- Build progress tracker ----------

const STAGES = [
  ["sent", "📨 Sent"], ["approved", "🔑 Approved"], ["building", "🔨 Building"],
  ["testing", "🧪 Testing"], ["ready", "✅ Ready"],
];

/**
 * Where a request is up to, from the player's send to a playable game.
 *   record: a brief or feedback round (status "ready" | "approved" | ...)
 *   build:  progress Claude Code wrote (or null); built: the finished game, if any
 */
export function buildTracker(record, build, built) {
  const stage = built || build?.stage === "live" ? "ready"
    : build?.stage === "ready" ? "testing"
    : build?.stage ?? (record.status === "approved" || record.status === "done" ? "approved" : "sent");
  const reached = STAGES.findIndex(([id]) => id === (stage === "blocked" ? "building" : stage));
  const steps = build?.steps?.length
    ? `<ul class="build-steps">${build.steps.map((s) => `<li class="${s.done ? "done" : ""}">${s.done ? "✅" : "⬜"} ${esc(s.label)}</li>`).join("")}</ul>` : "";
  const when = build?.updatedAt ? new Date(build.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  return `<div class="tracker">
    <ol class="stages">${STAGES.map(([, label], i) =>
      `<li class="${i < reached ? "done" : i === reached ? "now" : ""}">${label}</li>`).join("")}</ol>
    ${stage === "blocked" ? `<p class="error">⚠️ Claude needs help from the Creator.</p>` : ""}
    ${build?.note ? `<p class="build-note">🤖 ${esc(build.note)}</p>` : ""}
    ${steps}
    ${when ? `<p class="hint">Last update from Claude: ${esc(when)}</p>` : ""}
    ${build?.stage === "ready" && !built ? `<p class="hint">Built and saved. It appears in 🧪 Test as soon as the dashboard is updated.</p>` : ""}
  </div>`;
}
