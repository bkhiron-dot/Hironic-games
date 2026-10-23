# Hironic Games – project guide

A family game studio in the browser for three players aged 7, 10 and 12. Each player has a profile, makes games, tests them, publishes them to a shared library with author credit, and plays everyone's games.

## Roles
- **Player** (each boy): picks their profile with a tap. Designs games, tests and improves their own drafts, publishes, and plays everything published.
- **Creator** (the supervising parent, `role: "creator"`, passcode-locked): uses the 🔑 Studio to approve designs and improvement requests, copy the build request for Claude Code, and test any draft. Players' drafts are visible only to their author and the Creator.

## Principles
- **Zero install, zero build.** Plain HTML, CSS and JavaScript (ES modules). No npm dependencies unless agreed.
- **Runs everywhere.** Final targets: PC, iPhone, iPad, Android phone. Every control needs a touch equivalent.
- **One player per device** while playing. Multiplayer is a planned later add-on (online, across devices) – don't build same-screen multiplayer.
- **Child-safe by design.** No ads, analytics, open-ended chat, or external links. Live AI is limited to multiple-choice follow-up questions (`shared/ai.js`), checked and escaped before display; the Creator approves everything before it is built. Profiles hold only a nickname, age, emoji icon, colour and "about me" answers – no emails, photos or surnames. The only network service allowed (from Phase 2) is the family's own backend behind the family password.
- **Age-appropriate.** Cartoon-level conflict at most. Short on-screen text with large fonts and emoji so the 7-year-old can use it unaided.
- **Readable code.** The boys will read and modify this, so prefer clear names and short comments explaining *why* over clever tricks.
- **Built with the family.** The user wants to be involved in development: propose before building anything significant (new games, new templates, new screens).

## Layout
```
index.html, app.js      Dashboard: landing/profile selector → home hub → Create / Test / Play
ui.js                   Shared UI helpers (esc, choices, header…)
designer.js             🤖 Game Designer and 🔧 Improve wizards; builds Claude Code requests
studio.js               🔑 Studio for the Creator: approve, copy for Claude, test drafts
shared/questions.js     Starter question bank (plain data – edit freely) and interest lists
shared/ai.js            Live AI follow-up questions (claude.ai test page now; family backend in Phase 2)
play.html, play.js      Runs Game Maker games (?game=<id>, add &test=1 for test mode)
shared/store.js         ALL data access (profiles, games, scores). localStorage in Phase 1;
                        swapped for the online backend in Phase 2 with the same async API
shared/engine.js        Canvas, game loop, input, sound helpers
shared/style.css        Common look and feel
templates/              Game Maker templates (catcher.js, dodger.js) + common.js helpers
templates/index.js      Template registry
games.js                Registry of hand-coded games
games/<slug>/           One folder per hand-coded game
```

## Coded game lifecycle (with Claude Code)
1. **Design:** the player answers starter questions plus Claude's follow-ups, then approves the plan (brief `status: "ready"`).
2. **Approve:** the Creator checks it in the Studio and copies the request (`"approved"`), then pastes it into Claude Code, which runs `/build-game`.
3. **Build:** Claude adds `games/<slug>/` and registers it in `games.js` with the player's name, `briefId` and `status: "draft"`.
4. **Test & improve:** the author tests it, then uses 🔧 Improve to send a feedback round; the Creator approves it and Claude makes the changes. Repeat as needed.
5. **Publish:** the author publishes it from Test, and it appears in everyone's Play library.

## Game lifecycle (Game Maker)
- **Create:** made in the Game Maker (template + settings) and saved as `status: "draft"`. Only the author sees drafts.
- **Test:** the author plays it via `play.html?game=<id>&test=1`. Plays and scores are not recorded.
- **Publish:** `status: "published"` puts it in everyone's Play library. Only the author can edit; others can **Remix** (copy as their own draft, credited with `remixOf`).
- **Play:** plays and scores are recorded against the current profile and shown on leaderboards.

## Adding things
- **A Game Maker template:** write `templates/<name>.js` exporting an object like `CATCHER` (id, name, icon, description, `suits` matching "about me" game types, defaults, labels, `newRound(settings, view)` returning `{ player, update, draw, isOver }`), then list it in `templates/index.js`.
- **A hand-coded game:** copy `games/star-catcher/`, edit `game.js`, register it in `games.js`. Use `recordPlay`/`recordScore` from `shared/store.js` with id `code:<slug>`.

## Conventions
- Never touch `localStorage` directly outside `shared/store.js` (and the engine); go through the store so Phase 2 is a one-file swap.
- Escape anything a player typed (`esc()` in app.js) before inserting it into HTML.
- Test with `python3 -m http.server 8000` on desktop and a phone-sized viewport.
