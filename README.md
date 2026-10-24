# Hardline MTB

A downhill mountain bike game for the browser, built with Three.js.

## Play the v1 game

```
npm install
npm run dev
```

Then open the address Vite prints and go to `/v1.html`.

## Run the tests

```
npm test
```

The tests run the jump simulator and check every jump still lands smoothly at the speeds we tuned it for.

## Working on it with Claude Code

Open a terminal in this folder and run `claude`. Claude reads `CLAUDE.md` for the project background, tuned numbers and the roadmap. `KICKOFF.md` has the first message to send.

## Play online (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy-pages.yml`: it runs the tests, builds with Vite and publishes `dist/` to
https://bkhiron-dot.github.io/Hironic-games/ (v1 is at `/Hironic-games/v1.html`).

One-off setup in GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan; the published site is public either way.
