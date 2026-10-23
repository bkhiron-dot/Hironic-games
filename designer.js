// The Game Designer (#/design) and "Improve my game" (#/refine) wizards.
//
// Both ask one question per screen: starter questions from shared/questions.js,
// then live follow-up questions from Claude (shared/ai.js), then show a plan.
// The player sends the plan to the Creator, who approves it in the Studio and
// passes the build request to Claude Code.
import {
  getBrief, saveBrief, getGame, getFeedback, saveFeedback, listFeedback, listProfiles, listGames, testUrl,
} from "./shared/store.js";
import { aiFollowUps } from "./shared/ai.js";
import { GAME_KINDS, LOVES, starterQuestionsFor, REFINE_QUESTIONS } from "./shared/questions.js";
import { esc, go, header, choices, bindChoices, labelFor, isCreator } from "./ui.js";

const app = document.getElementById("app");

// ---------- Shared wizard ----------

/** Text for a player's loves, used in prompts. */
export function lovesText(player) {
  const about = player.about ?? {};
  return labelFor(LOVES, [...(about.loves ?? []), ...(about.lovesOther ? [about.lovesOther] : [])]);
}

/** Read a question aloud with the browser's built-in voice (for younger players). */
function speak(text) {
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, "")));
  } catch {}
}
const canSpeak = () => "speechSynthesis" in window;

/**
 * Run a wizard over `record` (a brief or a feedback round).
 *   steps(): the current list of steps – "idea" | "ai" | "plan" | a question object
 *   save():  store the record
 *   intro / planIntro: text shown on the first screen and on the plan
 *   onSend(): called when the player approves the plan
 */
function runWizard({ me, active, record, steps, save, planTitle, onSend, ideaScreen, aiContext }) {
  const draw = async () => {
    const list = steps();
    record.step = Math.min(record.step ?? 0, list.length - 1);
    const step = list[record.step];
    const dots = list.map((_, i) => `<span class="${i === record.step ? "on" : i < record.step ? "done" : ""}"></span>`).join("");
    const shell = (body, nav) => {
      app.innerHTML = `${header(me, active)}
      <main class="form-page wizard">
        <div class="progress" aria-label="Step ${record.step + 1} of ${list.length}">${dots}</div>
        ${record.creatorNote ? `<p class="creator-note">🔑 Note from the Creator: ${esc(record.creatorNote)}</p>` : ""}
        ${body}
        <div class="actions wizard-nav">${nav}</div>
      </main>`;
    };
    const backBtn = record.step > 0 ? `<button class="button" id="back">← Back</button>` : "";
    const next = async (by = 1) => { record.step += by; await save(); draw(); };
    const wireBack = () => document.getElementById("back")?.addEventListener("click", () => next(-1));

    if (step === "idea") {
      ideaScreen(shell, next);
      return;
    }

    if (step === "ai") {
      shell(`<section class="card thinking"><span class="emoji huge">🤖</span>
        <h2>Claude is thinking of some more questions for you…</h2><p class="hint">This can take a few seconds.</p></section>`, "");
      try {
        record.aiQuestions = await aiFollowUps(aiContext());
        await save();
        draw();
      } catch (e) {
        const message = {
          unavailable: "Claude's extra questions aren't switched on here yet. That's OK!",
          not_granted: "Claude wasn't allowed to help this time. That's OK!",
          rate_limited: "Claude is a bit busy right now.",
        }[e.code] ?? "Claude couldn't think of questions right now.";
        const canRetry = !["unavailable", "not_granted", "sampling_disabled"].includes(e.code);
        shell(`<section class="card thinking"><span class="emoji huge">🤖</span><h2>${message}</h2></section>`,
          `${backBtn}${canRetry ? `<button class="button" id="retry">🔁 Try again</button>` : ""}
           <button class="big-button" id="skip">Keep going →</button>`);
        wireBack();
        document.getElementById("retry")?.addEventListener("click", draw);
        document.getElementById("skip").addEventListener("click", async () => { record.aiSkipped = true; await save(); draw(); });
      }
      return;
    }

    if (step === "plan") {
      const lines = record.answers.filter((a) => a.text).map((a) =>
        `<li><span class="q">${a.fromClaude ? "🤖 " : ""}${esc(a.ask)}</span><b>${esc(a.text)}</b></li>`).join("");
      shell(`<section class="card"><h1>📋 ${esc(planTitle())}</h1>
        <p>Here's what you chose. Is this right?</p><ul class="plan">${lines || "<li>No answers yet</li>"}</ul></section>`,
        `${backBtn}<button class="button" id="restart">✏️ Change something</button>
         <button class="big-button" id="send">✅ Yes! Send it</button>`);
      wireBack();
      document.getElementById("restart").addEventListener("click", async () => { record.step = 0; await save(); draw(); });
      document.getElementById("send").addEventListener("click", onSend);
      return;
    }

    // A question screen.
    const q = step;
    const saved = record.answers.find((a) => a.id === q.id) ?? { picked: [], own: "" };
    const state = { picked: q.multi ? [...saved.pickedIds ?? []] : saved.pickedIds?.[0] ?? "" };
    const options = q.options.map(([value, label]) => [value, esc(label)]);
    shell(`<section class="card question">
        ${q.fromClaude ? `<p class="from-claude">🤖 Claude asks:</p>` : ""}
        <div class="ask"><h2>${esc(q.ask)}</h2>${canSpeak() ? `<button class="button speak" id="speak" title="Read it to me">🔊</button>` : ""}</div>
        ${q.multi ? `<p class="hint">You can pick more than one!</p>` : ""}
        ${choices("picked", options, state.picked, { multi: Boolean(q.multi), kind: "chip big" })}
        ${q.own === false ? "" : `<label class="other">✏️ My own idea
          <input id="own" maxlength="120" value="${esc(saved.own)}" placeholder="Type your idea (optional)" autocomplete="off"></label>`}
      </section>`,
      `${backBtn}<button class="big-button" id="next">Next →</button>`);
    wireBack();
    document.getElementById("speak")?.addEventListener("click", () =>
      speak(`${q.ask}. ${q.options.map(([, label]) => label).join(". ")}`));
    bindChoices(app.querySelector(".question"), state);
    document.getElementById("next").addEventListener("click", async () => {
      const ids = q.multi ? state.picked : state.picked ? [state.picked] : [];
      const picked = ids.map((id) => q.options.find(([v]) => v === id)?.[1]).filter(Boolean);
      const own = document.getElementById("own")?.value.trim() ?? "";
      const answer = { id: q.id, ask: q.ask, pickedIds: ids, picked, own, fromClaude: Boolean(q.fromClaude),
        text: [...picked, ...(own ? [`"${own}"`] : [])].join(", ") };
      record.answers = [...record.answers.filter((a) => a.id !== q.id), answer];
      next();
    });
  };
  draw();
}

// ---------- 🤖 Game Designer: a new coded game ----------

export async function designScreen(me, id) {
  let brief = id ? await getBrief(id) : null;
  if (brief && brief.authorId !== me.id && !isCreator(me)) return go("create");
  if (brief && brief.status !== "designing") return briefStatusScreen(me, brief);

  brief ??= {
    authorId: me.id, title: "", status: "designing", step: 0, answers: [],
    kind: GAME_KINDS.find(([k]) => me.about?.gameTypes?.includes(k))?.[0] ?? "new",
  };
  const save = async () => {
    const isNew = !brief.id;
    brief = Object.assign(brief, await saveBrief(brief));
    if (isNew) history.replaceState(null, "", `#/design/${brief.id}`);
  };
  // Answers in the order the questions are asked (so the plan reads in order).
  const ordered = () => {
    const ids = questions().map((q) => q.id);
    brief.answers.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  };
  const questions = () => [...starterQuestionsFor(brief.kind), ...(brief.aiQuestions ?? [])];
  const steps = () => [
    "idea",
    ...starterQuestionsFor(brief.kind),
    ...(brief.aiQuestions ?? (brief.aiSkipped ? [] : ["ai"])),
    "plan",
  ];

  runWizard({
    me, active: "create", record: brief, steps, save,
    planTitle: () => { ordered(); return `${brief.title}: your game plan`; },
    aiContext: () => ({
      mode: "design", title: brief.title, kind: labelFor(GAME_KINDS, [brief.kind]), answers: brief.answers,
      player: { name: me.name, age: me.age, loves: lovesText(me) },
    }),
    ideaScreen: (shell, next) => {
      shell(`<section class="card">
          <h1>🤖 Game Designer</h1>
          <p>Hi ${esc(me.name)}! Let's design a brand new game. Claude will help you build it.</p>
          <h2>🏷️ What's your game called?</h2>
          <input id="title" maxlength="40" value="${esc(brief.title)}" placeholder="e.g. Lockie's F1 Racing" autocomplete="off">
          <h2>🎲 What kind of game is it?</h2>
          ${choices("kind", GAME_KINDS, brief.kind, { kind: "chip big" })}
        </section>`,
        `<a class="button" href="#/create">Cancel</a><button class="big-button" id="next">Next →</button>`);
      const pick = { kind: brief.kind };
      bindChoices(app.querySelector(".card"), pick);
      document.getElementById("next").addEventListener("click", async () => {
        const title = document.getElementById("title").value.trim();
        if (!title) return document.getElementById("title").focus();
        if (pick.kind !== brief.kind) { brief.aiQuestions = null; brief.aiSkipped = false; }
        Object.assign(brief, { title, kind: pick.kind });
        next();
      });
    },
    onSend: async () => {
      ordered();
      Object.assign(brief, { status: "ready", sentAt: Date.now(), creatorNote: "" });
      await save();
      briefStatusScreen(me, brief);
    },
  });
}

async function creatorName() {
  return (await listProfiles()).find(isCreator)?.name ?? "the Creator";
}

/** Where a sent design is up to. */
async function briefStatusScreen(me, brief) {
  const built = (await listGames()).find((g) => g.briefId === brief.id);
  const who = await creatorName();
  const status = built
    ? `✅ Built! <a href="${testUrl(built)}">Test it now</a>`
    : brief.status === "approved" ? `🔨 ${esc(who)} has sent it to Claude to build.`
    : `⏳ Waiting for ${esc(who)} to check it.`;
  app.innerHTML = `${header(me, "create")}
  <main class="form-page">
    <section class="card game-detail">
      <span class="emoji huge">${built ? "🎉" : "📨"}</span>
      <h1>${esc(brief.title)}</h1>
      <p class="status-line">${status}</p>
      <p class="hint">When it's built, it shows up in 🧪 Test. Only you (and ${esc(who)}) can see it until you publish it.</p>
    </section>
    <section class="card"><h2>📋 Your plan</h2>
      <ul class="plan">${brief.answers.filter((a) => a.text).map((a) =>
        `<li><span class="q">${a.fromClaude ? "🤖 " : ""}${esc(a.ask)}</span><b>${esc(a.text)}</b></li>`).join("")}</ul>
    </section>
    <div class="actions"><a class="button" href="#/create">← Back to Create</a></div>
  </main>`;
}

// ---------- 🔧 Improve my game: feedback after testing ----------

export async function refineScreen(me, rawId) {
  const game = await getGame(decodeURIComponent(rawId ?? ""));
  // Only the game's own author (and the Creator) can shape the next version.
  if (!game || game.kind !== "code" || (game.authorId !== me.id && !isCreator(me))) return go("test");

  const open = (await listFeedback({ gameId: game.id })).find((f) => f.status === "designing" && f.authorId === me.id);
  let fb = open ?? { gameId: game.id, authorId: me.id, status: "designing", step: 0, answers: [] };
  const save = async () => { fb = Object.assign(fb, await saveFeedback(fb)); };
  const steps = () => [
    "idea", ...REFINE_QUESTIONS, ...(fb.aiQuestions ?? (fb.aiSkipped ? [] : ["ai"])), "plan",
  ];

  runWizard({
    me, active: "test", record: fb, steps, save,
    planTitle: () => `${game.title}: ideas for the next version`,
    aiContext: () => ({
      mode: "refine", title: game.title, answers: fb.answers,
      player: { name: me.name, age: me.age, loves: lovesText(me) },
    }),
    ideaScreen: (shell, next) => {
      shell(`<section class="card game-detail">
          <span class="emoji huge">${esc(game.icon)}</span>
          <h1>🔧 Improve ${esc(game.title)}</h1>
          <p>Tested your game? Tell us how it went and what to change next!</p>
          <div class="actions"><a class="button" href="${testUrl(game)}">🧪 Test it first</a></div>
        </section>`,
        `<a class="button" href="#/test">Cancel</a><button class="big-button" id="next">Let's go →</button>`);
      document.getElementById("next").addEventListener("click", () => next());
    },
    onSend: async () => {
      Object.assign(fb, { status: "ready", sentAt: Date.now() });
      await save();
      const who = await creatorName();
      app.innerHTML = `${header(me, "test")}
      <main class="form-page"><section class="card game-detail">
        <span class="emoji huge">📨</span><h1>Sent to ${esc(who)}!</h1>
        <p>${esc(who)} will check your ideas and ask Claude to build the next version of ${esc(game.title)}.</p>
        <div class="actions"><a class="big-button" href="#/test">← Back to Test</a></div>
      </section></main>`;
    },
  });
}

// ---------- Requests pasted into Claude Code (made in the Studio) ----------

const answerList = (answers) => answers.filter((a) => a.text)
  .map((a) => `- ${a.fromClaude ? "(Claude's question) " : ""}${a.ask} → ${a.text}`).join("\n");

export function newGameRequest(brief, player, creator) {
  return `/build-game

NEW GAME request from the Hironic Games dashboard.
Plan agreed by ${player.name} in the Game Designer and approved by Creator ${creator.name}.
Build version 1 from these answers. Only stop to ask if something can't be done.

Player: ${player.name} ${player.icon} (age ${player.age ?? "?"})
Loves: ${lovesText(player)}
Game: "${brief.title}" – ${labelFor(GAME_KINDS, [brief.kind])}

DESIGN ANSWERS
${answerList(brief.answers)}

Credit: author "${player.name}", authorIcon "${player.icon}", briefId "${brief.id}"`;
}

export function changeRequest(fb, game, player, creator) {
  return `/build-game

CHANGE REQUEST from the Hironic Games dashboard (feedback round ${fb.round}).
${player.name} tested the game and answered these questions; approved by Creator ${creator.name}.
Make these changes. Only stop to ask if something can't be done.

Player: ${player.name} ${player.icon} (age ${player.age ?? "?"})
Game: "${game.title}" in games/${game.slug}/

FEEDBACK
${answerList(fb.answers)}`;
}
