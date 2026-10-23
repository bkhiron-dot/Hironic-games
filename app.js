// The dashboard. Layers:
//   Landing (pick or create a profile) → Home hub → one of three modes:
//     🛠️ Create – your workshop: make games in the Game Maker, or write a
//                 brief to build a coded game together with Claude Code
//     🧪 Test   – try your own games privately, then publish them
//     ▶ Play    – the shared library of published games, with credits and scores
// Screens are chosen by the address after "#", e.g. index.html#/play.
import {
  listProfiles, getProfile, saveProfile, getCurrentProfileId, setCurrentProfileId,
  listGames, getGame, saveGame, deleteGame, getGameStats, getLeaderboard, testUrl,
  listBriefs, getBrief, saveBrief, deleteBrief,
} from "./shared/store.js";
import { TEMPLATES, getTemplate } from "./templates/index.js";

const app = document.getElementById("app");
document.body.classList.add("dashboard"); // also styles the page when hosted without our <body> tag

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
  ["bikes", "🚲 Bike riding"], ["surfing", "🏄 Surfing"], ["skateboarding", "🛹 Skateboarding"],
];
const GAME_TYPES = [
  ["catching", "🧺 Catching"], ["dodging", "☄️ Dodging"], ["racing", "🏁 Racing"], ["puzzles", "🧩 Puzzles"],
  ["quizzes", "❓ Quizzes"], ["platformers", "🍄 Jumping"], ["building", "🏗️ Building"], ["mazes", "🌀 Mazes"],
];
// Asked now so we know who wants multiplayer when it's added later.
const PLAY_STYLES = [["solo", "🙋 On my own"], ["together", "👬 With my brothers"], ["both", "🔀 Both!"]];
const SPEEDS = { 1: "🐢", 2: "🐇", 3: "🐎", 4: "🏎️", 5: "🚀" };

// Choices for Claude Code briefs.
const BRIEF_TYPES = [...GAME_TYPES, ["new", "✨ Something new"]];
const CONTROLS = [
  ["left-right", "⬅️➡️ Move left & right"], ["all-around", "🕹️ Move all around"], ["jump", "🦘 Jump"],
  ["throw", "🎯 Throw or shoot (cartoon)"], ["tap", "👆 Tap things"], ["drag", "✋ Drag things"], ["type", "⌨️ Type answers"],
];
const LOOKS = [
  ["space", "🌌 Space"], ["underwater", "🌊 Underwater"], ["jungle", "🌴 Jungle"], ["city", "🏙️ City"],
  ["castle", "🏰 Castle"], ["snow", "❄️ Snow"], ["desert", "🏜️ Desert"], ["pixel", "👾 Pixel art"], ["neon", "💡 Neon"],
];
const SOUNDS = [["bleeps", "🔊 Bleeps & bloops"], ["music", "🎵 Music"], ["quiet", "🤫 Quiet"]];
const CHANGES = [
  ["easier", "🐢 Make it easier"], ["harder", "🔥 Make it harder"], ["character", "🦸 New character"],
  ["level", "🗺️ New level"], ["powerup", "⚡ Power-up"], ["sound", "🔊 Sounds"], ["look", "🎨 New look"], ["bug", "🐞 Fix a bug"],
];
const labelFor = (options, values) =>
  values.map((v) => options.find(([id]) => id === v)?.[1] ?? v).join(", ") || "(not chosen)";

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

/**
 * Two-tap confirmation for risky buttons (pop-up confirm() dialogs are blocked
 * in some places the dashboard runs). First tap asks, second tap within 3s confirms.
 */
function confirmTap(button, question) {
  if (button.dataset.armed) return true;
  const original = button.textContent;
  button.dataset.armed = "1";
  button.textContent = question;
  setTimeout(() => { delete button.dataset.armed; button.textContent = original; }, 3000);
  return false;
}

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
    brief: () => briefScreen(me, id),
    prompt: () => promptScreen(me, id),
    change: () => changeScreen(me, id),
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
    : { name: "", age: 7, icon: PROFILE_ICONS[0], colour: COLOURS[5], about: { loves: [], gameTypes: [], playStyle: "both", dream: "", lovesOther: "" } };
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
        <label class="other">Anything else you love?
          <input name="lovesOther" maxlength="100" value="${esc(about.lovesOther)}" placeholder="e.g. fishing, Lego, drawing" autocomplete="off">
        </label>
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
    about.lovesOther = data.get("lovesOther").trim();
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

// Maker games open in the Game Maker; coded games are changed by asking Claude.
const editUrl = (g) => (g.kind === "code" ? `#/change/${encodeURIComponent(g.id)}` : `#/make/${g.id}`);

async function createScreen(me) {
  const games = await myGames(me);
  const builtBriefs = new Set(games.map((g) => g.briefId).filter(Boolean));
  const briefs = (await listBriefs(me.id)).filter((b) => !builtBriefs.has(b.id));
  const cards = games.map((g) => gameCard(g, me, `
    <p class="badges"><span>${templateBadge(g)}</span><span>${statusBadge(g)}</span></p>
    <p class="hint">${g.kind === "code" ? "Tap to ask Claude for changes 🤖" : "Tap to edit ✏️"}</p>`, editUrl(g)));
  const ideaCards = briefs.map((b) => `
    <a class="game-card idea" href="#/prompt/${b.id}">
      <span class="emoji">${esc(b.heroIcon || "💡")}</span>
      <h2>${esc(b.title || "Untitled idea")}</h2>
      <p class="badges"><span>${b.copiedAt ? "📋 Sent to Claude" : "💡 Idea"}</span></p>
      <p class="hint">Waiting to be built with Claude</p>
    </a>`);

  app.innerHTML = `${header(me, "create")}
  <main>
    <h1 class="page-title">🛠️ Create</h1>
    <p class="intro">Your workshop. New games start as drafts – only you can see them until you publish.</p>
    <div class="game-grid">
      <a class="game-card new-game" href="#/make"><span class="emoji">🧩</span><h2>Game Maker</h2><p>Quick: pick a template and your characters</p></a>
      <a class="game-card new-game claude" href="#/brief"><span class="emoji">🤖</span><h2>Code it with Claude</h2><p>Big ideas: describe your dream game and build real code together</p></a>
    </div>
    ${ideaCards.length ? `<h2 class="section-title">💡 Ideas for Claude</h2><div class="game-grid">${ideaCards.join("")}</div>` : ""}
    ${cards.length ? `<h2 class="section-title">🎮 My games</h2><div class="game-grid">${cards.join("")}</div>` : ""}
  </main>`;
}

// ---------- 🧪 Test mode: try your games, then publish ----------

async function testScreen(me) {
  const games = await myGames(me);
  const cards = games.map((g) => gameCard(g, me, `
    <p class="badges"><span>${templateBadge(g)}</span><span>${statusBadge(g)}</span></p>
    <div class="actions">
      <a class="button" href="${testUrl(g)}">🧪 Test</a>
      <a class="button" href="${editUrl(g)}">${g.kind === "code" ? "🤖 Change" : "✏️ Edit"}</a>
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
        ${isMine ? `<a class="button" href="${editUrl(game)}">${game.kind === "code" ? "🤖 Change" : "✏️ Edit"}</a>` : ""}
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

  document.getElementById("delete")?.addEventListener("click", async (e) => {
    if (!confirmTap(e.currentTarget, "Tap again to delete")) return;
    await deleteGame(game.id);
    go("create");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveGame(collect());
    go("create");
  });
}

// ---------- 🤖 Code it with Claude ----------
// The player writes a brief; the dashboard turns it into a request to paste
// into Claude Code, which uses the /build-game skill (.claude/skills/build-game).

async function briefScreen(me, id) {
  const existing = id ? await getBrief(id) : null;
  const b = existing ?? {
    title: "", type: me.about?.gameTypes?.[0] ?? "new", heroIcon: "🦸", hero: "", goal: "", challenge: "",
    controls: [], look: [], sounds: ["bleeps"], extra: "", helper: "",
  };

  app.innerHTML = `${header(me, "create")}
  <main class="form-page">
    <h1>🤖 Code it with Claude</h1>
    <p class="intro">Tell Claude about your game. Don't worry about getting it perfect – Claude will ask you questions too!</p>
    <form id="brief">
      <section class="card">
        <h2>🏷️ What's your game called?</h2>
        <input name="title" maxlength="40" required value="${esc(b.title)}" placeholder="e.g. Shark Attack Splash" autocomplete="off">
        <h2>🎲 What kind of game is it?</h2>
        ${choices("type", BRIEF_TYPES, b.type)}
      </section>
      <section class="card">
        <h2>🦸 Who are you in the game?</h2>
        ${choices("heroIcon", emojiOptions(GAME_EMOJI), b.heroIcon, { kind: "emoji" })}
        <textarea name="hero" rows="2" maxlength="200" placeholder="e.g. a hungry shark with a jetpack">${esc(b.hero)}</textarea>
        <h2>🏆 How do you win or get points?</h2>
        <textarea name="goal" rows="2" maxlength="300" placeholder="e.g. eat fish to grow bigger">${esc(b.goal)}</textarea>
        <h2>😬 What makes it tricky?</h2>
        <textarea name="challenge" rows="2" maxlength="300" placeholder="e.g. submarines chase you and it gets faster">${esc(b.challenge)}</textarea>
      </section>
      <section class="card">
        <h2>🕹️ How do you play? <small>(pick any)</small></h2>
        ${choices("controls", CONTROLS, b.controls, { multi: true })}
        <h2>🎨 What does it look like?</h2>
        ${choices("look", LOOKS, b.look, { multi: true })}
        <h2>🔊 Sounds</h2>
        ${choices("sounds", SOUNDS, b.sounds, { multi: true })}
      </section>
      <section class="card">
        <h2>✨ Anything else?</h2>
        <textarea name="extra" rows="3" maxlength="500" placeholder="Levels, power-ups, a boss, secret bonus…">${esc(b.extra)}</textarea>
        <h2>🤝 Who's helping you build it? <small>(optional)</small></h2>
        <input name="helper" maxlength="40" value="${esc(b.helper)}" placeholder="e.g. Dad" autocomplete="off">
      </section>
      <div class="actions sticky">
        <button type="submit" class="big-button">💾 Save idea</button>
        <a class="button" href="${existing ? `#/prompt/${existing.id}` : "#/create"}">Cancel</a>
      </div>
    </form>
  </main>`;

  const form = document.getElementById("brief");
  form.querySelectorAll("section").forEach((section) => bindChoices(section, b));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    for (const field of ["title", "hero", "goal", "challenge", "extra", "helper"]) b[field] = data.get(field).trim();
    const saved = await saveBrief({ ...b, authorId: me.id });
    go(`prompt/${saved.id}`);
  });
}

/** The text pasted into Claude Code for a brand-new game. */
function newGamePrompt(b, me) {
  const about = me.about ?? {};
  return `/build-game

NEW GAME request from the Hironic Games dashboard.

Player: ${me.name} ${me.icon} (age ${me.age ?? "?"})${b.helper ? `, building with ${b.helper}` : ""}. They are here with you – build it together.
Loves: ${labelFor(LOVES, [...(about.loves ?? []), ...(about.lovesOther ? [about.lovesOther] : [])])}
Likes playing: ${labelFor(GAME_TYPES, about.gameTypes ?? [])}

GAME BRIEF
- Name: ${b.title}
- Kind of game: ${labelFor(BRIEF_TYPES, [b.type])}
- Hero: ${b.heroIcon} ${b.hero || "(not described)"}
- How to win / score: ${b.goal || "(not described)"}
- What makes it tricky: ${b.challenge || "(not described)"}
- Controls: ${labelFor(CONTROLS, b.controls)}
- Look: ${labelFor(LOOKS, b.look)}
- Sounds: ${labelFor(SOUNDS, b.sounds)}
- Extra ideas: ${b.extra || "(none)"}

Credit: author "${me.name}", authorIcon "${me.icon}", briefId "${b.id}"`;
}

/** The text pasted into Claude Code to change an existing coded game. */
function changePrompt(game, me, wanted, details) {
  return `/build-game

CHANGE REQUEST from the Hironic Games dashboard.

Player: ${me.name} ${me.icon} (age ${me.age ?? "?"}). They are here with you – make the changes together.
Game: "${game.title}" in games/${game.slug}/

What to change: ${labelFor(CHANGES, wanted)}
Details: ${details || "(none – ask the player)"}`;
}

/** Copy text to the clipboard, falling back to selecting it for older browsers. */
async function copyText(text, textarea, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    textarea.select();
    document.execCommand("copy");
  }
  button.textContent = "✅ Copied!";
  setTimeout(() => (button.textContent = "📋 Copy for Claude"), 2000);
}

const CLAUDE_STEPS = `
  <ol class="steps">
    <li><b>Copy</b> the message below.</li>
    <li>Open <b>Claude Code</b> (claude.ai/code, the desktop app, or the Claude app on a phone or tablet) on the <b>Hironic-games</b> project.</li>
    <li><b>Paste</b> it and send. Claude will ask you some questions – answer them together.</li>
    <li>When Claude has finished and the change is on the main branch, your game appears in <a href="#/test">🧪 Test</a>.</li>
  </ol>`;

async function promptScreen(me, id) {
  const b = await getBrief(id);
  if (!b || b.authorId !== me.id) return go("create");
  const text = newGamePrompt(b, me);

  app.innerHTML = `${header(me, "create")}
  <main class="form-page">
    <section class="card game-detail">
      <span class="emoji huge">${esc(b.heroIcon)}</span>
      <h1>${esc(b.title)}</h1>
      <p>Your idea is saved! Now build it with Claude:</p>
    </section>
    <section class="card">
      ${CLAUDE_STEPS}
      <textarea id="prompt" class="prompt" rows="14" readonly>${esc(text)}</textarea>
      <div class="actions">
        <button class="big-button" id="copy">📋 Copy for Claude</button>
        <a class="button" href="#/brief/${b.id}">✏️ Change idea</a>
        <button class="button danger" id="delete">🗑️ Delete</button>
      </div>
    </section>
  </main>`;

  const textarea = document.getElementById("prompt");
  document.getElementById("copy").addEventListener("click", async (e) => {
    await copyText(text, textarea, e.currentTarget);
    await saveBrief({ id: b.id, copiedAt: Date.now() });
  });
  document.getElementById("delete").addEventListener("click", async (e) => {
    if (!confirmTap(e.currentTarget, "Tap again to delete")) return;
    await deleteBrief(b.id);
    go("create");
  });
}

async function changeScreen(me, rawId) {
  const game = await getGame(decodeURIComponent(rawId ?? ""));
  if (!game || game.kind !== "code" || game.authorId !== me.id) return go("create");
  const state = { wanted: [] };

  app.innerHTML = `${header(me, "create")}
  <main class="form-page">
    <section class="card game-detail">
      <span class="emoji huge">${esc(game.icon)}</span>
      <h1>${esc(game.title)}</h1>
      <p>Ask Claude to change your game.</p>
      <div class="actions"><a class="button" href="${testUrl(game)}">🧪 Test it first</a></div>
    </section>
    <section class="card" id="wanted">
      <h2>What do you want to change?</h2>
      ${choices("wanted", CHANGES, state.wanted, { multi: true })}
      <h2>Tell Claude more</h2>
      <textarea id="details" rows="3" maxlength="500" placeholder="e.g. add a golden fish worth 10 points"></textarea>
    </section>
    <section class="card">
      ${CLAUDE_STEPS}
      <textarea id="prompt" class="prompt" rows="10" readonly></textarea>
      <div class="actions"><button class="big-button" id="copy">📋 Copy for Claude</button></div>
    </section>
  </main>`;

  const details = document.getElementById("details");
  const textarea = document.getElementById("prompt");
  const refresh = () => (textarea.value = changePrompt(game, me, state.wanted, details.value.trim()));
  bindChoices(document.getElementById("wanted"), state, refresh);
  details.addEventListener("input", refresh);
  refresh();
  document.getElementById("copy").addEventListener("click", (e) => copyText(textarea.value, textarea, e.currentTarget));
}

window.addEventListener("hashchange", route);
route();
