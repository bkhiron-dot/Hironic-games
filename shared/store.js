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
  return { profiles: [], games: [], scores: [], plays: {} };
}

function writeDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    alert("Couldn't save – this browser may be blocking storage.");
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

function codeGames() {
  return CODE_GAMES.map((g) => ({
    id: `code:${g.slug}`,
    kind: "code",
    status: "published",
    title: g.title,
    icon: g.emoji,
    description: g.description,
    authorName: g.author,
    authorIcon: g.authorIcon,
    url: `games/${g.slug}/`,
  }));
}

export async function listGames() {
  const db = readDb();
  const maker = db.games.map((g) => ({ status: "draft", ...g, kind: "maker", url: `play.html?game=${g.id}` }));
  return [...maker.sort((a, b) => b.updatedAt - a.updatedAt), ...codeGames()];
}

export async function getGame(id) {
  return (await listGames()).find((g) => g.id === id) ?? null;
}

/** game: { title, icon, template, settings, authorId, status } */
export async function saveGame(game) {
  const db = readDb();
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

export async function recordPlay(gameId) {
  const db = readDb();
  db.plays[gameId] = (db.plays[gameId] ?? 0) + 1;
  writeDb(db);
}

export async function recordScore(gameId, profileId, score) {
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
