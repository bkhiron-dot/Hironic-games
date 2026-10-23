// Shared pieces for Game Maker templates: the hero, controls, falling things, HUD.
import { clamp, random, drawText } from "../shared/engine.js";

export const HERO_SIZE = 56;
export const THING_SIZE = 40;

export function makePlayer(view, lives) {
  return {
    x: view.width / 2 - HERO_SIZE / 2,
    y: view.height - HERO_SIZE - 20,
    w: HERO_SIZE,
    h: HERO_SIZE,
    lives,
    score: 0,
    hurtTimer: 0, // brief flash after being hit
  };
}

/** Move left/right with arrow keys or A/D, or follow a finger/mouse while pressed. */
export function movePlayer(p, dt, input, view, speed = 650) {
  if (input.keys.has("ArrowLeft") || input.keys.has("a")) p.x -= speed * dt;
  if (input.keys.has("ArrowRight") || input.keys.has("d")) p.x += speed * dt;
  if (input.pointer.down && input.pointer.x !== null) p.x = input.pointer.x - p.w / 2;
  p.x = clamp(p.x, 0, view.width - p.w);
  p.y = view.height - HERO_SIZE - 20;
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
}

/** A falling object at a random spot across the screen. */
export function spawnThing(view, kind, fallSpeed) {
  return {
    kind,
    x: random(0, view.width - THING_SIZE),
    y: -THING_SIZE,
    w: THING_SIZE,
    h: THING_SIZE,
    speed: fallSpeed * random(0.8, 1.2),
  };
}

export function drawScene(ctx, view, settings, player, things) {
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, view.width, view.height);

  const icons = { good: settings.good, bad: settings.bad };
  for (const t of things) drawText(ctx, icons[t.kind], t.x + t.w / 2, t.y + t.h / 2, THING_SIZE);

  ctx.globalAlpha = player.hurtTimer > 0 ? 0.5 : 1;
  drawText(ctx, settings.hero, player.x + player.w / 2, player.y + player.h / 2, HERO_SIZE);
  ctx.globalAlpha = 1;

  drawText(ctx, `Score: ${player.score}`, view.width / 2, 32, 28);
  drawText(ctx, "❤️".repeat(Math.max(0, player.lives)), view.width - 80, 32, 22);
}

// Speed setting 1–5 → how fast things fall (pixels per second).
export const fallSpeedFor = (level) => 120 + level * 60;
