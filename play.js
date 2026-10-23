// Runs any Game Maker game: title screen → play → results.
//   play.html?game=<id>          play mode: plays and scores are recorded
//   play.html?game=<id>&test=1   test mode: the author trying a game; nothing recorded
import { createCanvas, startLoop, createInput, drawText } from "./shared/engine.js";
import { getGame, getProfile, getCurrentProfileId, recordPlay, recordScore } from "./shared/store.js";
import { getTemplate } from "./templates/index.js";

const params = new URLSearchParams(location.search);
const testing = params.has("test");

const game = await getGame(params.get("game"));
const back = document.getElementById("back");
back.href = testing ? "./#/test" : `./#/game/${encodeURIComponent(params.get("game"))}`;
if (testing) back.textContent = "← Back to Test";

const view = createCanvas();
const input = createInput(view.canvas);
const { ctx } = view;
const template = game && getTemplate(game.template);
const settings = template && { ...template.defaults, ...game.settings };
const author = game && !testing ? await getProfile(game.authorId) : null;
const playerId = getCurrentProfileId();

let state = "title"; // "title" | "playing" | "over"
let round = null;

function update(dt) {
  if (!template) return;
  const tapped = input.consumeTap();
  if (state === "playing") {
    round.update(dt, input);
    if (round.isOver()) finish();
  } else if (tapped) {
    round = template.newRound(settings, view);
    state = "playing";
    if (!testing) recordPlay(game.id);
  }
}

function finish() {
  state = "over";
  if (!testing) recordScore(game.id, playerId, round.player.score);
}

function draw() {
  const { width: w, height: h } = view;
  if (!template) {
    ctx.fillStyle = "#1b1f3b";
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, "Game not found 😕", w / 2, h / 2, 32);
    return;
  }
  if (state === "title") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, `${game.icon} ${game.title}`, w / 2, h / 2 - 80, Math.min(48, w / 12));
    if (author) drawText(ctx, `by ${author.icon} ${author.name}`, w / 2, h / 2 - 30, 22);
    drawText(ctx, controlsHint(), w / 2, h / 2 + 20, 18);
    drawText(ctx, "Tap or press Space to start", w / 2, h / 2 + 70, 24, "#ffcc33");
    if (testing) drawText(ctx, "🧪 TEST MODE – scores aren't saved", w / 2, h / 2 + 120, 18, "#7dd3fc");
    return;
  }
  round.draw(ctx);
  if (state === "over") drawResults(w, h);
}

function controlsHint() {
  const touch = matchMedia("(pointer: coarse)").matches;
  return touch ? "Drag your finger to move" : "Move with ← → or drag with the mouse";
}

function drawResults(w, h) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, "Game Over!", w / 2, h / 2 - 40, 52);
  drawText(ctx, `Score: ${round.player.score}`, w / 2, h / 2 + 20, 32);
  drawText(ctx, "Tap to play again", w / 2, h / 2 + 80, 24, "#ffcc33");
}

startLoop(update, draw);
