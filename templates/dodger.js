// Dodger: survive as long as you can. One point per second; bonus things add 5.
import { overlaps, beep } from "../shared/engine.js";
import { makePlayer, movePlayer, spawnThing, fallSpeedFor, drawScene } from "./common.js";

export const DODGER = {
  id: "dodger",
  name: "Dodger",
  icon: "☄️",
  description: "Things fall from the sky – dodge them! Grab bonuses for extra points.",
  suits: ["dodging"],
  defaults: { hero: "🚀", good: "💎", bad: "☄️", background: "#0b1026", speed: 2, lives: 3 },
  labels: { good: "Bonus thing", bad: "Thing to dodge" },

  newRound(settings, view) {
    const player = makePlayer(view, settings.lives);
    const fall = fallSpeedFor(settings.speed);
    let things = [];
    let elapsed = 0;
    let spawnTimer = 0;
    let bonus = 0;

    return {
      player,
      update(dt, input) {
        elapsed += dt;
        movePlayer(player, dt, input, view);
        player.score = Math.floor(elapsed) + bonus;

        // More hazards on a wide screen, and more as time goes on.
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          const kind = Math.random() < 0.15 ? "good" : "bad";
          things.push(spawnThing(view, kind, fall + elapsed * 4));
          const perSecond = view.width / 400 + elapsed * 0.05;
          spawnTimer = 1 / Math.max(1, perSecond);
        }

        for (const t of things) {
          t.y += t.speed * dt;
          if (overlaps(t, player)) {
            t.done = true;
            if (t.kind === "good") { bonus += 5; beep(1040, 0.1); }
            else if (player.hurtTimer <= 0) { player.lives--; player.hurtTimer = 1; beep(140, 0.3, "sawtooth"); }
          } else if (t.y > view.height) {
            t.done = true;
          }
        }
        things = things.filter((t) => !t.done);
      },
      draw(ctx) { drawScene(ctx, view, settings, player, things); },
      isOver: () => player.lives <= 0,
    };
  },
};
