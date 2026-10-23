// Data layer for profiles, games, designs and scores.
//
// Where data is saved:
//   • Test dashboard on claude.ai: the page's own database (it survives
//     closing the page, reloads and new versions). Claude Code can read it,
//     and writes build progress into it ("builds").
//   • Anywhere else (e.g. a local test server): this browser's localStorage.
// A copy is always kept in localStorage as a backup.
//
// Every function is async on purpose: in Phase 2 the cloud part is swapped for
// the family backend (e.g. Supabase) with the same function names.

import { GAMES as CODE_GAMES } from "../games.js";

const DB_KEY = "hironic:db";
const CURRENT_KEY = "hironic:current-profile";
// Each of these is saved as one cloud document: hironic/<key> = { value }.
const KEYS = ["profiles", "games", "scores", "plays", "briefs", "feedback", "codeStatus"];
const EMPTY = () => ({ profiles: [], games: [], scores: [], plays: {}, briefs: [], feedback: [], codeStatus: {} });
const MAX_SCORES = 2000; // keeps the scores document well under the cloud size limit

let cache = loadLocal();
let builds = {}; // build progress written by Claude Code: { "<request id>": {...} }
let cloud = null;

function loadLocal() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return { ...EMPTY(), ...JSON.parse(raw) };
  } catch {}
  return EMPTY();
}

function saveLocal() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch {}
}

// Store functions get a private copy, change it, then hand it to writeDb().
function readDb() {
  return structuredClone(cache);
}

function writeDb(db) {
  for (const key of KEYS) {
    if (JSON.stringify(db[key]) !== JSON.stringify(cache[key])) {
      cache[key] = structuredClone(db[key]);
      dirty.add(key);
    }
  }
  saveLocal();
  if (cloud) flush();
}

// ---------- Cloud saving ----------

const dirty = new Set();
let flushing = false;
let saveState = "saved";

/** "cloud" when saving to the page database, "device" when only in this browser. */
export const storageMode = () => (cloud ? "cloud" : "device");
export const getSaveState = () => saveState;

function setSaveState(state) {
  saveState = state;
  window.dispatchEvent(new CustomEvent("hironic:save", { detail: state }));
}

// Write changed documents one at a time (the cloud wants one write per document at once).
async function flush() {
  if (flushing) return;
  flushing = true;
  setSaveState("saving");
  let failed = false;
  while (dirty.size) {
    const key = dirty.values().next().value;
    dirty.delete(key);
    for (let attempt = 1; ; attempt++) {
      try {
        await cloud.doc(`hironic/${key}`).set({ value: cache[key] });
        break;
      } catch (e) {
        if (e?.code === "unavailable" && attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
          continue;
        }
        console.warn(`Couldn't save ${key} to the cloud:`, e?.code, e?.message);
        failed = true;
        break;
      }
    }
  }
  flushing = false;
  setSaveState(failed ? "error" : "saved");
}

// Connect to the page database if this page is running on claude.ai.
async function connect() {
  if (!window.claude?.use) return; // not on claude.ai: stay on this device
  const db = await window.claude.use("db").catch(() => null);
  if (!db) return;
  try {
    const snap = await db.collection("hironic").get();
    const found = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    const cloudHasData = KEYS.some((k) => found[k]);
    if (cloudHasData) {
      for (const key of KEYS) if (found[key]) cache[key] = structuredClone(found[key].value);
    } else {
      // First time on the cloud: upload anything already saved on this device.
      KEYS.forEach((k) => dirty.add(k));
    }
    builds = structuredClone(found.builds?.items ?? {});
    cloud = db;
    saveLocal();
    if (dirty.size) flush();
    // Live updates: other devices' changes and Claude Code's build progress.
    db.collection("hironic").onSnapshot((live) => {
      let changed = false;
      for (const d of live.docs) {
        if (d.metadata?.hasPendingWrites) continue;
        const body = d.data();
        if (d.id === "builds") {
          const next = body?.items ?? {};
          if (JSON.stringify(next) !== JSON.stringify(builds)) { builds = structuredClone(next); changed = true; }
        } else if (KEYS.includes(d.id) && !dirty.has(d.id)
            && JSON.stringify(body?.value) !== JSON.stringify(cache[d.id])) {
          cache[d.id] = structuredClone(body.value);
          changed = true;
        }
      }
      if (changed) {
        saveLocal();
        window.dispatchEvent(new CustomEvent("hironic:changed"));
      }
    }, (e) => console.warn("Live updates stopped:", e?.code));
  } catch (e) {
    console.warn("Cloud storage unavailable, saving on this device only:", e?.code ?? e);
  }
}

// Wait for the cloud before anything reads data (at most 12 s, then carry on locally).
await Promise.race([connect(), new Promise((r) => setTimeout(r, 12000))]);

// ---------- Build progress (written by Claude Code) ----------
// builds["brief:<id>"] or builds["feedback:<id>"] =
//   { stage: "building" | "testing" | "ready" | "live" | "blocked", note, steps: [{ label, done }], game, updatedAt }

export async function getBuild(requestId) {
  return structuredClone(builds[requestId] ?? null);
}

const newId = () => Math.random().toString(36).slice(2, 10);

// ---------- Profiles ----------

export async function listProfiles() {
  return readDb().profiles;
}

export async function getProfile(id) {
  return readDb().profiles.find((p) => p.id === id) ?? null;
}

/**
 * profile: { name, age, icon, colour, role, about: { loves[], lovesOther, gameTypes[], playStyle, dream } }
 * role is "player" (default) or "creator" (the supervising grown-up, who has a passcodeHash).
 */
export async function saveProfile(profile) {
  const db = readDb();
  if (profile.id) {
    db.profiles = db.profiles.map((p) => (p.id === profile.id ? { ...p, ...profile } : p));
  } else {
    profile = { ...profile, id: newId(), createdAt: Date.now() };
    db.profiles.push(profile);
  }
  writeDb(db);
  return profile;
}

// The Creator passcode is stored only as a SHA-256 hash.
// Phase 1 note: this keeps the boys out of the Creator screens, but it is not
// real security – anyone with browser dev tools could get round it. In Phase 2
// the Creator role is checked by the server.
export async function hashPasscode(code) {
  const bytes = new TextEncoder().encode(`hironic:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPasscode(profile, code) {
  return Boolean(profile?.passcodeHash) && profile.passcodeHash === (await hashPasscode(code));
}

// Who is playing on this device. Always local, even after Phase 2.
export function getCurrentProfileId() {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}
export function setCurrentProfileId(id) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {}
}

// ---------- Games ----------
// Two kinds share one library:
//   kind "maker": built in the Game Maker, stored as settings in the database
//   kind "code":  hand-written in games/<slug>/, listed in games.js
// status "draft" games are only seen by their author (Create/Test);
// status "published" games appear in everyone's Play library.

// Code games name their author in games.js (e.g. author: "Sam"); we link
// that to the profile with the same name so credits and editing work.
function codeGames(db) {
  const byName = new Map(db.profiles.map((p) => [p.name.trim().toLowerCase(), p]));
  return CODE_GAMES.map((g) => {
    const id = `code:${g.slug}`;
    const author = byName.get(String(g.author).trim().toLowerCase());
    return {
      id,
      kind: "code",
      slug: g.slug,
      status: db.codeStatus?.[id] ?? g.status ?? "published",
      title: g.title,
      icon: g.emoji,
      description: g.description,
      authorId: author?.id ?? null,
      authorName: g.author,
      authorIcon: g.authorIcon ?? "🛠️",
      briefId: g.briefId ?? null,
      url: `games/${g.slug}/`,
    };
  });
}

export async function listGames() {
  const db = readDb();
  const maker = db.games.map((g) => ({ status: "draft", ...g, kind: "maker", url: `play.html?game=${g.id}` }));
  return [...maker.sort((a, b) => b.updatedAt - a.updatedAt), ...codeGames(db)];
}

/** Link to try a game without recording plays or scores. */
export const testUrl = (game) => `${game.url}${game.url.includes("?") ? "&" : "?"}test=1`;
export const isTestMode = () => new URLSearchParams(location.search).has("test");

export async function getGame(id) {
  return (await listGames()).find((g) => g.id === id) ?? null;
}

/** game: { title, icon, template, settings, authorId, status } */
export async function saveGame(game) {
  const db = readDb();
  // Code games live in the repo; only their draft/published status is stored here.
  if (game.id?.startsWith("code:")) {
    db.codeStatus = { ...db.codeStatus, [game.id]: game.status };
    writeDb(db);
    return game;
  }
  const now = Date.now();
  if (game.id) {
    db.games = db.games.map((g) => (g.id === game.id ? { ...g, ...game, updatedAt: now } : g));
  } else {
    game = { ...game, id: newId(), createdAt: now, updatedAt: now };
    db.games.push(game);
  }
  writeDb(db);
  return game;
}

export async function deleteGame(id) {
  const db = readDb();
  db.games = db.games.filter((g) => g.id !== id);
  db.scores = db.scores.filter((s) => s.gameId !== id);
  delete db.plays[id];
  writeDb(db);
}

// ---------- Plays & scores ----------

// Test mode (?test=1) never records anything, for every kind of game.
export async function recordPlay(gameId) {
  if (isTestMode()) return;
  const db = readDb();
  db.plays[gameId] = (db.plays[gameId] ?? 0) + 1;
  writeDb(db);
}

export async function recordScore(gameId, profileId, score) {
  if (isTestMode()) return;
  const db = readDb();
  db.scores.push({ gameId, profileId: profileId ?? null, score, at: Date.now() });
  db.scores = db.scores.slice(-MAX_SCORES);
  writeDb(db);
}

/** Summary for library cards: play count and the top score with who set it. */
export async function getGameStats(gameId) {
  const db = readDb();
  const scores = db.scores.filter((s) => s.gameId === gameId);
  const top = scores.reduce((best, s) => (!best || s.score > best.score ? s : best), null);
  return {
    plays: db.plays[gameId] ?? 0,
    top: top && { score: top.score, profile: db.profiles.find((p) => p.id === top.profileId) ?? null },
  };
}

/** Best score per player for one game, highest first. */
export async function getLeaderboard(gameId) {
  const db = readDb();
  const best = new Map();
  for (const s of db.scores.filter((s) => s.gameId === gameId)) {
    if (!best.has(s.profileId) || s.score > best.get(s.profileId)) best.set(s.profileId, s.score);
  }
  return [...best]
    .map(([profileId, score]) => ({ score, profile: db.profiles.find((p) => p.id === profileId) ?? null }))
    .sort((a, b) => b.score - a.score);
}

// ---------- Game Designer briefs ----------
// A brief is a player's design for a game to be built with Claude Code.
// brief: { authorId, title, kind, answers: [{ id, ask, picked[], own, text, fromClaude }],
//          step, status, creatorNote }
// status: "designing" (player still answering) → "ready" (sent to the Creator)
//         → "approved" (Creator sent it to Claude Code). A game in games.js with
//         the same briefId means it has been built.

/** All briefs, or just one player's. Newest first. */
export async function listBriefs(authorId = null) {
  return (readDb().briefs ?? [])
    .filter((b) => !authorId || b.authorId === authorId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBrief(id) {
  return (readDb().briefs ?? []).find((b) => b.id === id) ?? null;
}

export async function saveBrief(brief) {
  const db = readDb();
  db.briefs ??= [];
  const now = Date.now();
  if (brief.id) {
    db.briefs = db.briefs.map((b) => (b.id === brief.id ? { ...b, ...brief, updatedAt: now } : b));
  } else {
    brief = { ...brief, id: newId(), createdAt: now, updatedAt: now };
    db.briefs.push(brief);
  }
  writeDb(db);
  return brief;
}

export async function deleteBrief(id) {
  const db = readDb();
  db.briefs = (db.briefs ?? []).filter((b) => b.id !== id);
  writeDb(db);
}

// ---------- Feedback rounds ("Improve my game") ----------
// After testing their own coded game, a player answers a few questions; the
// Creator turns approved feedback into a change request for Claude Code.
// feedback: { gameId, authorId, round, answers: [...as in briefs], step, status }
// status: "designing" → "ready" (sent to the Creator) → "approved" → "done"

export async function listFeedback({ gameId = null, authorId = null } = {}) {
  return (readDb().feedback ?? [])
    .filter((f) => (!gameId || f.gameId === gameId) && (!authorId || f.authorId === authorId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getFeedback(id) {
  return (readDb().feedback ?? []).find((f) => f.id === id) ?? null;
}

export async function saveFeedback(feedback) {
  const db = readDb();
  db.feedback ??= [];
  const now = Date.now();
  if (feedback.id) {
    db.feedback = db.feedback.map((f) => (f.id === feedback.id ? { ...f, ...feedback, updatedAt: now } : f));
  } else {
    const round = db.feedback.filter((f) => f.gameId === feedback.gameId).length + 1;
    feedback = { round, ...feedback, id: newId(), createdAt: now, updatedAt: now };
    db.feedback.push(feedback);
  }
  writeDb(db);
  return feedback;
}
