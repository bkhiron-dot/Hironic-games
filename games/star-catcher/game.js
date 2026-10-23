// Star Catcher – the sample game and starting template.
// Move the basket with arrow keys, mouse or finger. Miss 3 stars and it's over.
import {
  createCanvas, startLoop, createInput, beep,
  clamp, random, overlaps, drawText,
} from "../../shared/engine.js";
import { getCurrentProfileId, getLeaderboard, recordPlay, recordScore } from "../../shared/store.js";

// Code games use "code:<folder name>" as their id in the library.
const GAME_ID = "code:star-catcher";
const playerId = getCurrentProfileId();
const view = createCanvas();
const input = createInput(view.canvas);
const { ctx } = view;

// "title" -> "playing" -> "over" -> "playing" ...
let state = "title";
let basket, stars, score, lives, spawnTimer;
// This player's best score so far.
let best = (await getLeaderboard(GAME_ID)).find((r) => r.profile?.id === playerId)?.score ?? 0;

function reset() {
  basket = { x: view.width / 2 - 50, y: view.height - 70, w: 100, h: 30, speed: 600 };
  stars = [];
  score = 0;
  lives = 3;
  spawnTimer = 0;
}

function update(dt) {
  const tapped = input.consumeTap();

  if (state !== "playing") {
    if (tapped) {
      reset();
      state = "playing";
      recordPlay(GAME_ID);
    }
    return;
  }

  // Move basket: keyboard, or follow the pointer while it's pressed/moving.
  if (input.keys.has("ArrowLeft")) basket.x -= basket.speed * dt;
  if (input.keys.has("ArrowRight")) basket.x += basket.speed * dt;
  if (input.pointer.x !== null && input.pointer.down) basket.x = input.pointer.x - basket.w / 2;
  basket.x = clamp(basket.x, 0, view.width - basket.w);
  basket.y = view.height - 70;

  // Spawn stars faster as the score climbs.
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    stars.push({ x: random(0, view.width - 30), y: -30, w: 30, h: 30, speed: random(150, 250) + score * 5 });
    spawnTimer = Math.max(0.35, 1.2 - score * 0.02);
  }

  for (const star of stars) {
    star.y += star.speed * dt;
    if (overlaps(star, basket)) {
      star.caught = true;
      score++;
      beep(880, 0.08);
    } else if (star.y > view.height) {
      star.missed = true;
      lives--;
      beep(160, 0.25, "sawtooth");
    }
  }
  stars = stars.filter((s) => !s.caught && !s.missed);

  if (lives <= 0) {
    state = "over";
    best = Math.max(best, score);
    recordScore(GAME_ID, playerId, score);
  }
}

function draw() {
  const { width, height } = view;
  ctx.fillStyle = "#1b1f3b";
  ctx.fillRect(0, 0, width, height);

  if (state === "title") {
    drawText(ctx, "⭐ Star Catcher ⭐", width / 2, height / 2 - 40, 48);
    drawText(ctx, "Tap or press Space to start", width / 2, height / 2 + 30, 24, "#ffcc33");
    return;
  }

  for (const star of stars) drawText(ctx, "⭐", star.x + star.w / 2, star.y + star.h / 2, 30);

  ctx.fillStyle = "#ff7a59";
  ctx.fillRect(basket.x, basket.y, basket.w, basket.h);

  drawText(ctx, `Score: ${score}`, width / 2, 30, 28);
  drawText(ctx, "❤️".repeat(lives), width - 70, 30, 24);

  if (state === "over") {
    drawText(ctx, "Game Over!", width / 2, height / 2 - 40, 56);
    drawText(ctx, `Score ${score} · Best ${best}`, width / 2, height / 2 + 20, 28);
    drawText(ctx, "Tap to play again", width / 2, height / 2 + 70, 24, "#ffcc33");
  }
}

reset();
startLoop(update, draw);
