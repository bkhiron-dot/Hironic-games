---
name: build-game
description: Build a new hand-coded game, or change an existing one, from a request pasted from the Hironic Games dashboard ("NEW GAME request" or "CHANGE REQUEST"). Use whenever a message starts with /build-game or contains a dashboard game brief.
---

# Build a game with a Hironic player

The message comes from the dashboard's **🤖 Code it with Claude** screen. A child (7, 10 or 12) is usually at the keyboard with a parent. They want to be **involved**, not handed a finished game. Read `CLAUDE.md` first; its principles (child-safe, touch-friendly, zero build, readable code) apply to everything here.

## 1. Talk before coding
- Greet the player by name. Write for their age: short sentences, emoji welcome. For a 7-year-old, assume an adult is reading aloud.
- Ask **2–4 quick questions** about whatever the brief leaves unclear (e.g. "Should the shark get bigger when it eats?"). Offer choices (A/B/C) rather than open questions.
- Play back the plan in **3–5 bullets** and wait for a "yes" before writing code. Keep version 1 small; save extra ideas for "next time" and list them at the end.

## 2. Build (new game)
- Pick a short kebab-case slug from the name; check `games.js` and `games/` so it doesn't clash.
- Copy `games/star-catcher/` to `games/<slug>/` and rewrite `game.js`. Keep both `<script>` tags in `index.html` (`shared/game-page.js` handles test mode and the back button).
- Use `shared/engine.js` for the canvas, loop, input, sound and collisions. Every control needs a touch equivalent (drag, tap, or on-screen buttons).
- Always include: a title screen ("Tap or press Space to start"), a score, a game-over screen, and "tap to play again".
- Record results with `recordPlay("code:<slug>")` when a round starts and `recordScore("code:<slug>", getCurrentProfileId(), score)` when it ends (from `shared/store.js`). Test mode is handled automatically.
- Put a **"🔧 Things to try changing"** block of named constants at the top of `game.js` (speeds, sizes, lives, emoji), with comments, so the player can tweak values themselves.
- Register the game in `games.js` with the details from the request's `Credit:` line:
  ```js
  { slug, title, emoji, author: "<name>", authorIcon: "<icon>", briefId: "<id>", status: "draft", description }
  ```
  `author` must exactly match the player's profile name; that's how credit and editing are linked. Always start as `status: "draft"`. The player publishes it from Test mode.

## 2b. Change request
- Open `games/<slug>/game.js`, explain in one or two kid-friendly sentences how the relevant part works now, then agree the change as in step 1.
- Keep the game's `status` as it is. Don't rename the slug (scores are stored against it).

## 3. Check it works
- Serve with `python3 -m http.server` and smoke-test in Chromium (Playwright; use `executablePath: '/opt/pw-browsers/chromium'` in cloud sessions). Load `games/<slug>/?test=1` at desktop (1200×800) and phone (iPhone 13) sizes, tap to start, play a few seconds, and confirm there are no console errors.
- Show the player a screenshot and ask if it looks right.
- Keep test scripts in the scratchpad, not the repo.

## 4. Finish
- Commit with a message like `Add Shark Splash by Sam` (or `Shark Splash: add golden fish (Sam)`), then push.
- Tell the player, in their language:
  - once it's merged to the main branch and the site updates, it appears in **🧪 Test**, where they can try it and press **🚀 Publish**;
  - the "Things to try changing" values they could experiment with;
  - the "next time" ideas list.

## Content rules
Cartoon-level conflict only (bonk, splat, pop – no blood or realistic weapons). No text input sent anywhere, no external links, images or fonts, no network requests. Use emoji or shapes drawn with canvas for graphics.
