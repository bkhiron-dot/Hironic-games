// Data layer for profiles, games and scores.
//
// Phase 1 keeps everything in this browser's localStorage. Every function is
// async on purpose: in Phase 2 this file is swapped for an online database
// (e.g. Supabase) with the same function names, and nothing else changes.

import { GAMES as CODE_GAMES } from "../games.js";

const DB_KEY = "hironic:db";
const CURRENT_KEY = "hironic:current-profile";

function readDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { profiles: [], games: [], scores: [], plays: {}, briefs: [], codeStatus: {} };
}

function writeDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    console.warn("Couldn't save – this browser may be blocking storage.");
  }
}

const newId = () => Math.random().toString(36).slice(2, 10);

// ---------- Profiles ----------

export async function listProfiles() {
  return readDb().profiles;
}

export async function getProfile(id) {
  return readDb().profiles.find((p) => p.id === id) ?? null;
}

/** profile: { name, age, icon, colour, about: { loves[], gameTypes[], playStyle, dream } } */
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

// ---------- Claude Code briefs ----------
// A brief is a player's description of a game they want to build with Claude Code.
// brief: { authorId, title, type, hero, heroIcon, goal, challenge, controls[], look[], sounds[], extra }

export async function listBriefs(authorId) {
  return (readDb().briefs ?? []).filter((b) => b.authorId === authorId).sort((a, b) => b.updatedAt - a.updatedAt);
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
