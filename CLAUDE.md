# Hironic Games – project guide

Home-made browser games for three players aged 7, 10 and 12.

## Principles
- **Zero install, zero build.** Plain HTML, CSS and JavaScript (ES modules). Every game must run by opening its `index.html` via a local web server or GitHub Pages. No npm dependencies unless agreed.
- **Runs everywhere.** Laptop (keyboard/mouse) and tablet/phone (touch). Every control needs a touch equivalent.
- **Child-safe by design.** No network requests, ads, analytics, accounts, chat, or external links inside games. No personal data collected. Progress/high scores stay in `localStorage` only.
- **Age-appropriate.** Cartoon-level conflict at most. Short on-screen text with large fonts so the 7-year-old can play unaided; icons over words where possible.
- **Readable code.** The older players may read and modify games, so prefer clear names and short comments explaining *why* over clever tricks.

## Layout
```
index.html          Arcade launcher – lists every game
games.js            Game registry (add an entry per game)
shared/engine.js    Canvas, game loop, input, sound, save helpers
shared/style.css    Common look and feel
games/<slug>/       One folder per game, entry point index.html
```

## Adding a game
1. Copy `games/star-catcher/` to `games/<new-slug>/`.
2. Edit the new game's `game.js`.
3. Register it in `games.js` (title, slug, emoji, ages, description).
4. Test with `python3 -m http.server` and open http://localhost:8000 on both desktop and a touch device (or browser device emulation).

## Conventions
- Use `shared/engine.js` helpers rather than re-implementing loops/input.
- Wrap every `localStorage` access in try/catch (the engine's `save`/`load` already do).
- Keep each game self-contained in its folder; shared code only in `shared/`.
