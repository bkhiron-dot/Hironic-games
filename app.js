// The dashboard. Layers:
//   Landing (pick or create a profile) → Home hub → one of three modes:
//     🛠️ Create – your workshop: make and edit games (saved as drafts)
//     🧪 Test   – try your own games privately, then publish them
//     ▶ Play    – the shared library of published games, with credits and scores
// Screens are chosen by the address after "#", e.g. index.html#/play.
import {
  listProfiles, getProfile, saveProfile, getCurrentProfileId, setCurrentProfileId,
  listGames, getGame, saveGame, deleteGame, getGameStats, getLeaderboard,
} from "./shared/store.js";
import { TEMPLATES, getTemplate } from "./templates/index.js";

const app = document.getElementById("app");

// ---------- Choices offered in forms ----------

const PROFILE_ICONS = ["🦖", "🦈", "🐉", "🦊", "🐯", "🐼", "🦅", "🐙", "🤖", "👾", "🧙", "🥷",
  "🦸", "👽", "🐲", "🦁", "🐺", "🦄", "⚽", "🏀", "🚀", "⚡", "🔥", "💎"];
const COLOURS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#ec407a"];
const BACKGROUNDS = ["#1b1f3b", "#0b1026", "#14532d", "#1e3a8a", "#7c2d12", "#4a044e", "#87ceeb", "#fef3c7"];
const GAME_EMOJI = ["🧺", "🚀", "🛸", "🚗", "🏎️", "🐱", "🐶", "🦖", "🦈", "🤖", "🧙", "🥷", "🐸", "🐧",
  "🍎", "🍕", "🍩", "⭐", "💎", "🪙", "⚽", "🏀", "🐟", "🥕", "💣", "☄️", "🌵", "🔥", "👻", "🦇",
  "🕷️", "🌧️", "🧊", "🪨", "⚡", "🦠"];

const LOVES = [
  ["space", "🚀 Space"], ["animals", "🐾 Animals"], ["dinosaurs", "🦖 Dinosaurs"], ["football", "⚽ Football"],
  ["cars", "🏎️ Cars"], ["building", "🧱 Building"], ["ocean", "🌊 Ocean"], ["robots", "🤖 Robots"],
  ["magic", "🧙 Magic"], ["ninjas", "🥷 Ninjas"], ["food", "🍕 Food"], ["music", "🎵 Music"],
];
const GAME_TYPES = [
  ["catching", "🧺 Catching"], ["dodging", "☄️ Dodging"], ["racing", "🏁 Racing"], ["puzzles", "🧩 Puzzles"],
  ["quizzes", "❓ Quizzes"], ["platformers", "🍄 Jumping"], ["building", "🏗️ Building"], ["mazes", "🌀 Mazes"],
];
// Asked now so we know who wants multiplayer when it's added later.
const PLAY_STYLES = [["solo", "🙋 On my own"], ["together", "👬 With my brothers"], ["both", "🔀 Both!"]];
const SPEEDS = { 1: "🐢", 2: "🐇", 3: "🐎", 4: "🏎️", 5: "🚀" };

// ---------- Helpers ----------

// Escape anything typed by a player before putting it into the page.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const go = (path) => { location.hash = `#/${path}`; };

function avatar(profile, size = "") {
  if (!profile) return `<span class="avatar ${size}" style="background:#555">❔</span>`;
  return `<span class="avatar ${size}" style="background:${esc(profile.colour)}">${esc(profile.icon)}</span>`;
}

/** A row of tappable choice buttons. Clicking updates `state[field]` (an array if multi). */
function choices(field, options, selected, { multi = false, kind = "chip" } = {}) {
  const isOn = (v) => (multi ? selected.includes(v) : selected === v);
  return `<div class="choices ${kind}s" data-field="${field}" data-multi="${multi}">
    ${options.map(([value, label]) => `
      <button type="button" class="${kind} ${isOn(value) ? "on" : ""}" data-value="${esc(value)}"
        ${kind === "swatch" ? `style="background:${esc(value)}" aria-label="${esc(value)}"` : ""}>${label}</button>`).join("")}
  </div>`;
}

/** Wire up every choices() row inside `root` so taps change `state`. */
function bindChoices(root, state, onChange = () => {}) {
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

const emojiOptions = (list) => list.map((e) => [e, e]);

// ---------- Router ----------

async function route() {
  const [screen = "", id] = location.hash.replace(/^#\/?/, "").split("/");
  const me = await getProfile(getCurrentProfileId());

  if (!me && !["", "new"].includes(screen)) return go("");

  const screens = {
    "": () => landingScreen(me),
    new: () => profileScreen(null),
    me: () => profileScreen(me),
    home: () => homeScreen(me),
    create: () => createScreen(me),
    make: () => makeScreen(me, id),
    test: () => testScreen(me),
    play: () => playScreen(me),
    game: () => gameScreen(me, id),
  };
  await (screens[screen] ?? screens.home)();
  window.scrollTo(0, 0);
}

function header(me, active) {
  const tab = (path, label) => `<a href="#/${path}" class="${active === path ? "active" : ""}">${label}</a>`;
  return `<header class="topbar">
    <a class="logo" href="#/home">🎮 <span class="label">Hironic Games</span></a>
    <nav>${tab("home", "🏠 Home")}${tab("create", "🛠️ Create")}${tab("test", "🧪 Test")}${tab("play", "▶ Play")}</nav>
    <a class="me ${active === "me" ? "active" : ""}" href="#/me">${avatar(me, "small")}<span class="label">${esc(me.name)}</span></a>
    <a class="switch" href="#/" title="Switch player">🔄</a>
  </header>`;
}

// ---------- Landing: who's playing? ----------

async function landingScreen(me) {
  const profiles = await listProfiles();
  app.innerHTML = `<main class="center landing">
    <div class="hero-title">🎮</div>
    <h1>Hironic Games</h1>
    <p class="tagline">Make games. Test them. Play everyone's!</p>
    <h2>Who's playing?</h2>
    <div class="profile-grid">
      ${profiles.map((p) => `<button class="profile-tile ${p.id === me?.id ? "current" : ""}" data-id="${p.id}">${avatar(p, "big")}<span>${esc(p.name)}</span></button>`).join("")}
      <a class="profile-tile new" href="#/new"><span class="avatar big" style="background:#3a4180">➕</span><span>New player</span></a>
    </div>
  </main>`;
  app.querySelectorAll(".profile-tile[data-id]").forEach((tile) =>
    tile.addEventListener("click", () => { setCurrentProfileId(tile.dataset.id); go("home"); }));
}

// ---------- Home hub: choose a mode ----------

async function homeScreen(me) {
  const mine = (await listGames()).filter((g) => g.authorId === me.id);
  const drafts = mine.filter((g) => g.status === "draft").length;
  const published = mine.length - drafts;
  app.innerHTML = `${header(me, "home")}
  <main>
    <h1 class="page-title">Hi ${esc(me.name)}! ${esc(me.icon)} What do you want to do?</h1>
    ${me.about?.dream ? `<p class="dream">💭 Your dream game: “${esc(me.about.dream)}”</p>` : ""}
    <div class="mode-grid">
      <a class="mode-card create" href="#/create">
        <span class="emoji">🛠️</span><h2>Create</h2><p>Make a new game or change one of yours.</p>
        <small>${mine.length} game${mine.length === 1 ? "" : "s"} made</small>
      </a>
      <a class="mode-card test" href="#/test">
        <span class="emoji">🧪</span><h2>Test</h2><p>Try your games out, then publish them for everyone.</p>
        <small>${drafts} draft${drafts === 1 ? "" : "s"} waiting</small>
      </a>
      <a class="mode-card play" href="#/play">
        <span class="emoji">▶️</span><h2>Play</h2><p>Play games made by everyone and beat the high scores.</p>
        <small>${published} of yours published</small>
      </a>
    </div>
  </main>`;
}

// ---------- Create / edit profile ----------

async function profileScreen(existing) {
  const state = existing
    ? structuredClone(existing)
    : { name: "", age: 7, icon: PROFILE_ICONS[0], colour: COLOURS[5], about: { loves: [], gameTypes: [], playStyle: "both", dream: "" } };
  const about = state.about;

  app.innerHTML = `${existing ? header(existing, "me") : ""}
  <main class="form-page">
    <h1>${existing ? "✏️ My profile" : "👋 New player"}</h1>
    <form id="profile-form">
      <section class="card preview-card">
        <span id="preview">${avatar(state, "big")}</span>
        <label>What's your name?
          <input name="name" maxlength="20" required value="${esc(state.name)}" placeholder="Nickname" autocomplete="off">
        </label>
        <label>How old are you?
          <input name="age" type="number" min="4" max="99" value="${esc(state.age)}">
        </label>
      </section>

      <section class="card" id="look">
        <h2>Pick your icon</h2>
        ${choices("icon", emojiOptions(PROFILE_ICONS), state.icon, { kind: "emoji" })}
        <h2>Pick your colour</h2>
        ${choices("colour", COLOURS.map((c) => [c, ""]), state.colour, { kind: "swatch" })}
      </section>

      <section class="card" id="about">
        <h2>What do you love? <small>(pick lots!)</small></h2>
        ${choices("loves", LOVES, about.loves, { multi: true })}
        <h2>What games do you like?</h2>
        ${choices("gameTypes", GAME_TYPES, about.gameTypes, { multi: true })}
        <h2>How do you like to play?</h2>
        ${choices("playStyle", PLAY_STYLES, about.playStyle)}
        <h2>Describe a game you'd love to make 💭</h2>
        <textarea name="dream" rows="3" maxlength="300" placeholder="e.g. a shark that eats fish but dodges submarines">${esc(about.dream)}</textarea>
      </section>

      <button class="big-button" type="submit">${existing ? "💾 Save" : "✅ Let's go!"}</button>
    </form>
  </main>`;

  const form = document.getElementById("profile-form");
  bindChoices(form.querySelector("#look"), state, () => {
    document.getElementById("preview").innerHTML = avatar(state, "big");
  });
  bindChoices(form.querySelector("#about"), about); // these answers live in state.about

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    state.name = data.get("name").trim();
    state.age = Number(data.get("age")) || null;
    about.dream = data.get("dream").trim();
    if (!state.name) return;
    const saved = await saveProfile(state);
    setCurrentProfileId(saved.id);
    go("home");
  });
}

// ---------- Game cards (shared by Create, Test and Play) ----------

const templateBadge = (g) =>
  g.kind === "code" ? "💻 Code" : `${getTemplate(g.template)?.icon ?? ""} ${getTemplate(g.template)?.name ?? ""}`;
const statusBadge = (g) => (g.status === "published" ? "✅ Published" : "📝 Draft");

/** One game card. `body` is extra HTML (stats or buttons); `href` makes the card a link. */
function gameCard(g, author, body, href) {
  const by = g.kind === "code"
    ? `${esc(g.authorIcon)} ${esc(g.authorName)}`
    : `${avatar(author, "tiny")} ${esc(author?.name ?? "Unknown")}`;
  const tag = href ? "a" : "div";
  return `<${tag} class="game-card" ${href ? `href="${href}"` : ""}>
    <span class="emoji">${esc(g.icon)}</span>
    <h2>${esc(g.title)}</h2>
    <p class="by">by ${by}</p>
    ${body}
  </${tag}>`;
}

async function myGames(me) {
  return (await listGames()).filter((g) => g.authorId === me.id);
}

// ---------- 🛠️ Create mode: your workshop ----------

async function createScreen(me) {
  const games = await myGames(me);
  const cards = games.map((g) => gameCard(g, me, `
    <p class="badges"><span>${templateBadge(g)}</span><span>${statusBadge(g)}</span></p>
    <p class="hint">Tap to edit ✏️</p>`, `#/make/${g.id}`));

  app.innerHTML = `${header(me, "create")}
  <main>
    <h1 class="page-title">🛠️ Create</h1>
    <p class="intro">Your workshop. New games start as drafts – only you can see them until you publish.</p>
    <div class="game-grid">
      <a class="game-card new-game" href="#/make"><span class="emoji">➕</span><h2>New game</h2><p>Start from a template</p></a>
      ${cards.join("")}
    </div>
  </main>`;
}

// ---------- 🧪 Test mode: try your games, then publish ----------

async function testScreen(me) {
  const games = await myGames(me);
  const cards = games.map((g) => gameCard(g, me, `
    <p class="badges"><span>${templateBadge(g)}</span><span>${statusBadge(g)}</span></p>
    <div class="actions">
      <a class="button" href="play.html?game=${g.id}&test=1">🧪 Test</a>
      <a class="button" href="#/make/${g.id}">✏️ Edit</a>
      ${g.status === "published"
        ? `<button class="button" data-unpublish="${g.id}">🙈 Unpublish</button>`
        : `<button class="big-button" data-publish="${g.id}">🚀 Publish</button>`}
    </div>`));

  app.innerHTML = `${header(me, "test")}
  <main>
    <h1 class="page-title">🧪 Test</h1>
    <p class="intro">Play your own games to check they're fun. Test scores aren't saved. Happy with it? Publish it to the library!</p>
    ${cards.length
      ? `<div class="game-grid">${cards.join("")}</div>`
      : `<p class="empty">Nothing to test yet. <a href="#/make">Make a game first! 🛠️</a></p>`}
  </main>`;

  app.querySelectorAll("[data-publish], [data-unpublish]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const publish = "publish" in btn.dataset;
      const game = games.find((g) => g.id === (btn.dataset.publish ?? btn.dataset.unpublish));
      await saveGame({ id: game.id, status: publish ? "published" : "draft" });
      publish ? go(`game/${game.id}`) : route();
    }));
}

// ---------- ▶ Play mode: everyone's published games ----------

async function playScreen(me) {
  const games = (await listGames()).filter((g) => g.status === "published");
  const profiles = new Map((await listProfiles()).map((p) => [p.id, p]));
  const cards = await Promise.all(games.map(async (g) => {
    const stats = await getGameStats(g.id);
    return gameCard(g, profiles.get(g.authorId), `
      <p class="badges"><span>${templateBadge(g)}</span><span>▶ ${stats.plays} play${stats.plays === 1 ? "" : "s"}</span></p>
      ${stats.top ? `<p class="top">🏆 ${stats.top.score} ${avatar(stats.top.profile, "tiny")} ${esc(stats.top.profile?.name ?? "")}</p>` : ""}`,
      `#/game/${encodeURIComponent(g.id)}`);
  }));

  app.innerHTML = `${header(me, "play")}
  <main>
    <h1 class="page-title">▶ Play</h1>
    <p class="intro">Every published game, by everyone. Can you get the top score?</p>
    <div class="game-grid">${cards.join("")}</div>
  </main>`;
}

// ---------- One game: details + leaderboard ----------

async function gameScreen(me, rawId) {
  const game = await getGame(decodeURIComponent(rawId ?? ""));
  if (!game || (game.status !== "published" && game.authorId !== me.id)) return go("play");
  const author = game.kind === "maker" ? await getProfile(game.authorId) : null;
  const board = await getLeaderboard(game.id);
  const remixOf = game.remixOf ? await getGame(game.remixOf) : null;
  const template = getTemplate(game.template);
  const isMine = game.authorId === me.id;

  app.innerHTML = `${header(me, "play")}
  <main class="form-page">
    <section class="card game-detail">
      <span class="emoji huge">${esc(game.icon)}</span>
      <h1>${esc(game.title)}</h1>
      <p class="by">by ${author ? `${avatar(author, "tiny")} ${esc(author.name)}` : `${esc(game.authorIcon)} ${esc(game.authorName)}`}
        ${remixOf ? ` · remix of <a href="#/game/${remixOf.id}">${esc(remixOf.title)}</a>` : ""}</p>
      <p>${esc(game.description ?? template?.description ?? "")}</p>
      <div class="actions">
        <a class="big-button" href="${game.url}">▶ Play</a>
        ${isMine ? `<a class="button" href="#/make/${game.id}">✏️ Edit</a>` : ""}
        ${game.kind === "maker" && !isMine ? `<button class="button" id="remix">🔀 Remix</button>` : ""}
      </div>
    </section>
    <section class="card">
      <h2>🏆 Top scores</h2>
      ${board.length
        ? `<ol class="leaderboard">${board.map((r) => `<li>${avatar(r.profile, "small")} <span>${esc(r.profile?.name ?? "Guest")}</span> <b>${r.score}</b></li>`).join("")}</ol>`
        : `<p class="empty">No scores yet – be the first!</p>`}
    </section>
  </main>`;

  document.getElementById("remix")?.addEventListener("click", async () => {
    const copy = await saveGame({
      title: `${game.title} (remix)`, icon: game.icon, template: game.template,
      settings: { ...game.settings }, authorId: me.id, remixOf: game.id, status: "draft",
    });
    go(`make/${copy.id}`);
  });
}

// ---------- Game Maker ----------

async function makeScreen(me, id) {
  let game = id ? await getGame(id) : null;
  if (game && game.authorId !== me.id) return go(`game/${id}`); // only the author edits

  // Suggest a template that matches the kinds of game this player said they like.
  const liked = me.about?.gameTypes ?? [];
  const suggested = TEMPLATES.find((t) => t.suits.some((s) => liked.includes(s)));

  if (!game) {
    const t = suggested ?? TEMPLATES[0];
    game = { title: "", icon: t.defaults.hero, template: t.id, settings: { ...t.defaults }, authorId: me.id };
  }
  const state = { title: game.title, icon: game.icon, template: game.template, ...game.settings };

  app.innerHTML = `${header(me, "create")}
  <main class="form-page">
    <h1>🛠️ ${game.id ? "Edit your game" : "Make a game"}</h1>
    <form id="maker">
      <section class="card">
        <h2>1. Pick a type of game</h2>
        <div class="choices template-choices" data-field="template" data-multi="false">
          ${TEMPLATES.map((t) => `
            <button type="button" class="template ${t.id === state.template ? "on" : ""}" data-value="${t.id}">
              <span class="emoji">${t.icon}</span><b>${t.name}</b><small>${t.description}</small>
              ${t === suggested ? `<em>⭐ Suggested for you</em>` : ""}
            </button>`).join("")}
        </div>
      </section>

      <section class="card">
        <h2>2. Name it</h2>
        <input name="title" maxlength="30" required value="${esc(state.title)}" placeholder="My awesome game" autocomplete="off">
        <h2>Game icon</h2>
        ${choices("icon", emojiOptions(GAME_EMOJI), state.icon, { kind: "emoji" })}
      </section>

      <section class="card" id="characters"></section>

      <section class="card">
        <h2>4. Rules</h2>
        <h3>Speed</h3>
        ${choices("speed", Object.entries(SPEEDS).map(([n, e]) => [n, `${e} ${n}`]), state.speed)}
        <h3>Lives</h3>
        ${choices("lives", [1, 2, 3, 4, 5].map((n) => [n, "❤️".repeat(n)]), state.lives)}
        <h3>Background</h3>
        ${choices("background", BACKGROUNDS.map((c) => [c, ""]), state.background, { kind: "swatch" })}
      </section>

      <div class="actions sticky">
        <button type="submit" class="button">💾 Save</button>
        <button type="button" class="big-button" id="test">🧪 Save &amp; test</button>
        ${game.id ? `<button type="button" class="button danger" id="delete">🗑️ Delete</button>` : ""}
      </div>
    </form>
  </main>`;

  const form = document.getElementById("maker");

  // The characters section depends on the template (e.g. "catch" vs "dodge" wording).
  function renderCharacters() {
    const t = getTemplate(state.template);
    const box = document.getElementById("characters");
    box.innerHTML = `
      <h2>3. Characters</h2>
      <h3>Your hero</h3>${choices("hero", emojiOptions(GAME_EMOJI), state.hero, { kind: "emoji" })}
      <h3>${t.labels.good}</h3>${choices("good", emojiOptions(GAME_EMOJI), state.good, { kind: "emoji" })}
      <h3>${t.labels.bad}</h3>${choices("bad", emojiOptions(GAME_EMOJI), state.bad, { kind: "emoji" })}`;
    bindChoices(box, state);
  }
  renderCharacters();

  form.querySelectorAll(":scope > section:not(#characters)").forEach((section) =>
    bindChoices(section, state, (field) => {
      if (field !== "template") return;
      // Switching template: load its starting characters and colours, keep the rules.
      const { lives, speed, background } = state;
      Object.assign(state, getTemplate(state.template).defaults, { lives, speed, background });
      renderCharacters();
    }));

  function collect() {
    state.title = new FormData(form).get("title").trim();
    const { title, icon, template, ...settings } = state;
    return {
      id: game.id, title: title || "Untitled game", icon, template, settings,
      authorId: me.id, remixOf: game.remixOf, status: game.status ?? "draft",
    };
  }

  document.getElementById("test").addEventListener("click", async () => {
    const saved = await saveGame(collect());
    location.href = `play.html?game=${saved.id}&test=1`;
  });

  document.getElementById("delete")?.addEventListener("click", async () => {
    if (!confirm(`Delete "${game.title}"? This can't be undone.`)) return;
    await deleteGame(game.id);
    go("create");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveGame(collect());
    go("create");
  });
}

window.addEventListener("hashchange", route);
route();
