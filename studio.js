// 🔑 Studio – the Creator's (supervising grown-up's) screen.
// Approve game designs and improvement requests, send them to Claude Code,
// and test any draft.
import {
  listBriefs, saveBrief, listFeedback, saveFeedback, listProfiles, listGames, getGame, testUrl, getBuild,
} from "./shared/store.js";
import { newGameRequest, changeRequest } from "./designer.js";
import { esc, go, header, avatar, copyText, isCreator, buildTracker } from "./ui.js";

const app = document.getElementById("app");

const STEPS = `
  <ol class="steps">
    <li>Check the plan with your player, then tap <b>📋 Approve &amp; copy</b>.</li>
    <li>Open <b>Claude Code</b> on the <b>Hironic-games</b> project (claude.ai/code, the desktop app, or the Claude app).</li>
    <li>Paste and send. Claude builds it, tests it and commits it as a draft for the player.</li>
    <li>Once the change is on the main branch, the game appears in the player's 🧪 Test.</li>
  </ol>`;

export async function studioScreen(me) {
  if (!isCreator(me)) return go("home");
  const profiles = new Map((await listProfiles()).map((p) => [p.id, p]));
  const games = await listGames();
  const builtBriefs = new Set(games.map((g) => g.briefId).filter(Boolean));
  const briefs = (await listBriefs()).filter((b) => !builtBriefs.has(b.id));
  const feedback = await listFeedback();

  // One request card: who, what, their answers, the text for Claude, and actions.
  const card = ({ kind, id, player, title, icon, answers, request, status, record, build }) => `
    <article class="card request" data-kind="${kind}" data-id="${id}">
      <header class="request-head">
        <span class="emoji">${esc(icon)}</span>
        <div><h3>${esc(title)}</h3><p class="by">${avatar(player, "tiny")} ${esc(player?.name ?? "Unknown")}</p></div>
        <span class="pill ${status}">${{ ready: "📥 Needs you", approved: "🔨 Sent to Claude", designing: "✏️ Player is working on it" }[status] ?? status}</span>
      </header>
      ${status === "approved" ? buildTracker(record, build, null) : ""}
      <ul class="plan">${answers.filter((a) => a.text).map((a) =>
        `<li><span class="q">${a.fromClaude ? "🤖 " : ""}${esc(a.ask)}</span><b>${esc(a.text)}</b></li>`).join("")}</ul>
      <details><summary>Request for Claude Code</summary><textarea class="prompt" rows="12" readonly>${esc(request)}</textarea></details>
      <div class="actions">
        ${status === "designing" ? "" : `<button class="big-button" data-act="approve">📋 ${status === "approved" ? "Copy again" : "Approve &amp; copy"}</button>`}
        ${status === "ready" ? `<input class="note" maxlength="200" placeholder="Note for the player (optional)">
          <button class="button" data-act="back">↩️ Send back</button>` : ""}
        ${kind === "feedback" && status === "approved" ? `<button class="button" data-act="done">✅ Mark done</button>` : ""}
      </div>
    </article>`;

  const briefCards = await Promise.all(briefs.filter((b) => b.status !== "designing" || b.creatorNote).map(async (b) => card({
    kind: "brief", id: b.id, player: profiles.get(b.authorId), title: b.title, icon: "🤖",
    answers: b.answers, status: b.status, request: newGameRequest(b, profiles.get(b.authorId) ?? {}, me),
    record: b, build: await getBuild(`brief:${b.id}`),
  })));
  const feedbackCards = await Promise.all(feedback.filter((f) => ["ready", "approved"].includes(f.status)).map(async (f) => {
    const game = await getGame(f.gameId);
    return card({
      kind: "feedback", id: f.id, player: profiles.get(f.authorId), title: `${game?.title ?? "Game"} – round ${f.round}`,
      icon: game?.icon ?? "🔧", answers: f.answers, status: f.status, record: f, build: await getBuild(`feedback:${f.id}`),
      request: game ? changeRequest(f, game, profiles.get(f.authorId) ?? {}, me) : "",
    });
  }));
  const drafts = games.filter((g) => g.status === "draft");

  app.innerHTML = `${header(me, "studio")}
  <main>
    <h1 class="page-title">🔑 Studio</h1>
    <p class="intro">You're the Creator. Approve the boys' designs and improvement ideas, then send them to Claude Code.</p>
    <section class="card">${STEPS}</section>
    <h2 class="section-title">🤖 New game designs</h2>
    ${briefCards.length ? `<div class="request-list">${briefCards.join("")}</div>` : `<p class="empty">No designs waiting.</p>`}
    <h2 class="section-title">🔧 Improvement requests</h2>
    ${feedbackCards.length ? `<div class="request-list">${feedbackCards.join("")}</div>` : `<p class="empty">No improvement requests.</p>`}
    <h2 class="section-title">🧪 All drafts</h2>
    ${drafts.length ? `<div class="game-grid">${drafts.map((g) => `
      <div class="game-card"><span class="emoji">${esc(g.icon)}</span><h2>${esc(g.title)}</h2>
        <p class="by">${avatar(profiles.get(g.authorId), "tiny")} ${esc(profiles.get(g.authorId)?.name ?? g.authorName ?? "")}</p>
        <div class="actions"><a class="button" href="${testUrl(g)}">🧪 Test</a></div></div>`).join("")}</div>`
      : `<p class="empty">No drafts.</p>`}
  </main>`;

  app.querySelectorAll(".request").forEach((el) => {
    const { kind, id } = el.dataset;
    const saveRecord = kind === "brief" ? saveBrief : saveFeedback;
    el.querySelector('[data-act="approve"]')?.addEventListener("click", async (e) => {
      const textarea = el.querySelector("textarea");
      el.querySelector("details").open = true;
      await copyText(textarea.value, textarea, e.currentTarget);
      await saveRecord({ id, status: "approved", approvedAt: Date.now() });
      setTimeout(() => studioScreen(me), 1500);
    });
    el.querySelector('[data-act="back"]')?.addEventListener("click", async () => {
      const note = el.querySelector(".note").value.trim();
      await saveRecord({ id, status: "designing", creatorNote: note || "Let's change a few things together.", step: 0 });
      studioScreen(me);
    });
    el.querySelector('[data-act="done"]')?.addEventListener("click", async () => {
      await saveRecord({ id, status: "done", doneAt: Date.now() });
      studioScreen(me);
    });
  });
}
