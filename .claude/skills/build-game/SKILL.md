---
name: build-game
description: Build a new hand-coded game, or change an existing one, from a request pasted from the Hironic Games dashboard ("NEW GAME request" or "CHANGE REQUEST"). Use whenever a message starts with /build-game or contains a dashboard game brief.
---

# Build a game with a Hironic player

The message comes from the dashboard. A player (aged 7, 10 or 12) designed the game in the **🤖 Game Designer**, or gave feedback in **🔧 Improve**. The **Creator** (the supervising parent) approved it in the **🔑 Studio** and pasted it here. Read `CLAUDE.md` first; its principles (child-safe, touch-friendly, zero build, readable code) apply to everything here.

## 1. Approved plan or open brief?
- **"Plan agreed … approved by Creator"** (the normal case): the design conversation already happened in the dashboard. **Don't re-ask the questions.** Build straight from the answers:
  - Picked options are choices; quoted text is the player's own idea, so honour it.
  - "(Claude's question)" lines came from live AI follow-ups.
  - Where answers conflict or are missing, choose the simplest version that fits and say what you chose.
  - Stop to ask the Creator only if something can't be built as described, or breaks the content rules.
- **Anything else** (an older-style brief, or a request without approval): talk first, as below.

## 1b. Talk before coding (only when the plan isn't approved yet)
- Greet the player by name. Write for their age: short sentences, emoji welcome. For a 7-year-old, assume an adult is reading aloud.
- Ask **2–4 quick questions** about whatever the brief leaves unclear (e.g. "Should the shark get bigger when it eats?"). Offer choices (A/B/C) rather than open questions.
- Play back the plan in **3–5 bullets** and wait for a "yes" before writing code. Keep version 1 small; save extra ideas for "next time" and list them at the end.

## 1c. Report progress to the dashboard
The request ends with `Build status id: brief:<id>` or `feedback:<id>`. Post progress so the player and the Creator can follow along in the dashboard: the design page and the 🔑 Studio show it live.
- Write it to the test dashboard's database: artifact `https://claude.ai/artifact/7BRz27uRjUaCKPX8Hvsb7a`, document `hironic/builds`, with the `ArtifactData` tool (load it with ToolSearch). `get` it first (collection `hironic`, doc_id `builds`). If it doesn't exist, `set` it to `{ "items": { "<status id>": {...} } }`; otherwise `update` with `{ "items": { "<status id>": {...} } }` and `if_version` set to the version you read (or got back from your last write). Update merges, so other builds are kept.
- Each entry: `{ "stage": "...", "note": "<one short kid-friendly sentence>", "steps": [{ "label": "...", "done": true|false }], "game": "<slug>", "updatedAt": "<ISO time>" }`.
- Stages, in order: `building` (when you start; list 3–5 steps from the plan), `testing` (when running the smoke test), `ready` (committed and pushed), `live` (playable in the test dashboard, see step 4). Use `blocked` with a note if you need the Creator.
- Update at each stage change, not after every edit. If the status id is missing, or ArtifactData isn't available in this session, skip this and say so.

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

## 2b. Change request (feedback round)
- Open `games/<slug>/game.js`. Turn the feedback into concrete changes: "too hard" or "too easy" means retuning the "Things to try changing" constants, while "power-up", "new level" and so on are new features. Honour quoted own ideas.
- If the request is approved by the Creator, make the changes; otherwise explain how the relevant part works in one or two kid-friendly sentences and agree the change first.
- Keep the game's `status` as it is. Don't rename the slug (scores are stored against it).

## 3. Check it works
- Serve with `python3 -m http.server` and smoke-test in Chromium (Playwright; use `executablePath: '/opt/pw-browsers/chromium'` in cloud sessions). Load `games/<slug>/?test=1` at desktop (1200×800) and phone (iPhone 13) sizes, tap to start, play a few seconds, and confirm there are no console errors.
- Show the player a screenshot and ask if it looks right.
- Keep test scripts in the scratchpad, not the repo.

## 4. Finish
- Commit with a message like `Add Shark Splash by Sam` (or `Shark Splash: round 2 – golden fish (Sam)`), then push. Set the build stage to `ready`.
- Make it playable in the test dashboard: read the artifact (`Artifact` action `read` with its URL), then republish it with `url` set and `files` containing the updated `games.js` and every file in `games/<slug>/`, plus any shared files you changed. Then set the build stage to `live`.
- Tell the player and the Creator, in the player's language:
  - once it's merged to the main branch and the site updates, it appears in **🧪 Test**, where they can try it and press **🚀 Publish**;
  - the "Things to try changing" values they could experiment with;
  - the "next time" ideas list.

## Content rules
Cartoon-level conflict only (bonk, splat, pop – no blood or realistic weapons). No text input sent anywhere, no external links, images or fonts, no network requests. Use emoji or shapes drawn with canvas for graphics.
