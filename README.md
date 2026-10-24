# Hardline MTB

A downhill mountain bike game for the browser, built with Three.js.

## Play locally

```
npm install
npm run dev
```

Then open the address Vite prints: `/v1.html` is the original game, `/v2.html` is the new version being built.

## Run the tests

```
npm test
```

The tests check every jump still lands smoothly at the speeds we tuned it for, and that v2's track, forest and physics give exactly the same results as v1.

## Make your own trail

Trails are plain data in `src/trails/`. Copy `hardline.js`, change the numbers (wiggle, width, slope, jumps, splits) and add it to `src/trails/index.js`; `npm test` checks it and says what to fix if something doesn't fit together. Riding a new trail comes with the trailhead (roadmap step 3); until then the game rides Hardline.

## Working on it with Claude Code

Open a terminal in this folder and run `claude`. Claude reads `CLAUDE.md` for the project background, tuned numbers and the roadmap. `KICKOFF.md` has the first message to send.

## Play online (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy-pages.yml`: it runs the tests, builds with Vite and publishes `dist/` to
https://bkhiron-dot.github.io/Hironic-games/ (v1 at `/Hironic-games/v1.html`, v2 at `/Hironic-games/v2.html`).

One-off setup in GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan; the published site is public either way.
