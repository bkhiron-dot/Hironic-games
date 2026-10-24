# Hardline MTB

A downhill mountain bike game for the browser, built with Three.js.

## Play locally

```
npm install
npm run dev
```

Then open the address Vite prints: the home page is the game, and `/v1.html` is the original version.

## Run the tests

```
npm test
```

The tests check every jump still lands smoothly at the speeds we tuned it for, that the trail keeps v1's shape, that the ground has no cliffs, and that a scripted rider can drop in at the trailhead and ride to the finish.

## Make your own trail

Trails are plain data in `src/trails/`. Copy `flow-monster.js`, change the numbers (wiggle, width, slope, jumps, splits, difficulty) and add it to `src/trails/index.js`; `npm test` checks it and says what to fix if something doesn't fit together. For now the game rides one trail at a time (Flow Monster), picked in `src/main.js`.

## Working on it with Claude Code

Open a terminal in this folder and run `claude`. Claude reads `CLAUDE.md` for the project background, tuned numbers and the roadmap. `KICKOFF.md` has the first message to send.

## Play online (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy-pages.yml`: it runs the tests, builds with Vite and publishes `dist/` to
https://bkhiron-dot.github.io/Hironic-games/ (the game; v1 at `/Hironic-games/v1.html`).

**Previews**: add the label `preview` to a pull request and the workflow also publishes that pull request at `https://bkhiron-dot.github.io/Hironic-games/preview/pr-<number>/` (it comments the link on the pull request). It's rebuilt on every push while the label is on; remove the label or close the pull request and it's taken down. Use it for bigger or riskier changes you want to play on a phone before merging. (Previews only work once this workflow is on main, and only for pull requests from this repository.)

One-off setup in GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan; the published site is public either way.
