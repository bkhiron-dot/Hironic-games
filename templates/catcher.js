// Catcher: catch the good things, avoid the bad ones. Missing a good thing costs a life.
import { overlaps, beep } from "../shared/engine.js";
import { makePlayer, movePlayer, spawnThing, fallSpeedFor, drawScene } from "./common.js";

export const CATCHER = {
  id: "catcher",
  name: "Catcher",
  icon: "🧺",
  description: "Catch the good things. Dodge the bad ones!",
  suits: ["catching"],
  defaults: { hero: "🧺", good: "🍎", bad: "💣", background: "#1b1f3b", speed: 2, lives: 3 },
  labels: { good: "Thing to catch", bad: "Thing to avoid" },

  newRound(settings, view) {
    const player = makePlayer(view, settings.lives);
    const fall = fallSpeedFor(settings.speed);
    let things = [];
    let elapsed = 0;
    let spawnTimer = 0;

    return {
      player,
      update(dt, input) {
        elapsed += dt;
        movePlayer(player, dt, input, view);

        // Things arrive faster the longer you survive.
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          const kind = Math.random() < 0.25 ? "bad" : "good";
          things.push(spawnThing(view, kind, fall + elapsed * 3));
          spawnTimer = Math.max(0.35, 1.1 - elapsed * 0.01);
        }

        for (const t of things) {
          t.y += t.speed * dt;
          if (overlaps(t, player)) {
            t.done = true;
            if (t.kind === "good") { player.score++; beep(880, 0.08); }
            else { player.lives--; player.hurtTimer = 0.5; beep(140, 0.3, "sawtooth"); }
          } else if (t.y > view.height) {
            t.done = true;
            if (t.kind === "good") { player.lives--; player.hurtTimer = 0.5; beep(200, 0.2, "triangle"); }
          }
        }
        things = things.filter((t) => !t.done);
      },
      draw(ctx) { drawScene(ctx, view, settings, player, things); },
      isOver: () => player.lives <= 0,
    };
  },
};
