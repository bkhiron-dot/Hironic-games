# Hardline MTB

A browser-based, third-person downhill mountain bike game built with Three.js. Inspired by Red Bull Hardline, set in Maydena-style Tasmanian rainforest (tall pale eucalypts, tree ferns, dark loamy dirt).

Built by Ben with his three boys, partly as a way for them to learn coding. Keep code readable: plain names, short functions, comments that explain the *why* in plain English. The physics should feel lifelike but stay simple.

## Working with Ben

- Plain English, concise, evidence-based. Show numbers when tuning (speeds, ranges, thresholds).
- Flag any assumption or approximation clearly and agree it before building on it.
- Prefer small, reviewable commits. Run `npm test` before every commit.
- When changing physics or a jump, re-run the jump simulator and report the new landing ranges as a table (speed at lip -> smooth / heavy / small crash / big crash).

## Commands

- `npm install` then `npm run dev` - local dev server (Vite). v1 is at `/v1.html`, v2 at `/v2.html`.
- `npm test` - physics and jump-range tests (Node's built-in test runner, no extra deps).
- `npm run build` - production build into `dist/`.

## Repository layout

- `public/v1.html` - **reference build**: the complete v1 game in one file, exactly as it was when ported from claude.ai. Treat it as the behavioural spec. Do not edit it; copy logic out of it into `src/`.
- `v2.html` + `src/` - the modular v2 game. `src/main.js` wires it together; each module's header says what it does. `src/trail.js`, `src/jumps.js` and the pure parts of `terrain.js`, `forest.js` and `physics.js` have no DOM, so tests run them in Node.
- `src/trails/` - one data file per trail (`hardline.js` is the v1 track) and `index.js`, the list of trails. `defineTrail()` in `src/trail.js` checks the data and builds the trail's functions (`ground`, `groundAt`, `pointAt`, `locate`, `halfWidth`, `kickerAt`, ...). Every module is handed the trail it works on; only `main.js` picks one.
- `src/path.js` - the centreline as a measured path: distance along it, points square to it, and `locate(x, z)` to find any world point on it.
- `src/jumps.js` - jump kinds (shape, landing flags, declared landing ranges). Trails place jumps by kind and may override numbers.
- `index.html` - home page linking to v1 and v2.
- `tools/jump-sim.js` - straight-line jump simulator shared by tests and tuning; reads shapes from `src/jumps.js`. `npm run jumps` prints every jump on every trail.
- `tests/` - `node:test` tests. `ground.test.js` checks Hardline against v1's own code (read out of `public/v1.html`) away from jumps, and that the ground has no cliffs. `ride.test.js` rides the game's physics over every jump and the whole trail (`tests/helpers/ride.js`).
- `docs/v2-trailhead-spec.md` - the agreed design for the next version.

## v1 state (what already works)

- 1.2 km descent, Three.js r128 from CDN, single HTML file.
- Terrain: analytic `ground(s, off)` heightfield; trail ribbon mesh built from it, so physics and visuals always agree.
- Variable-width smooth dirt trail (half-width 2.3-5.4 m), dirt texture, dense forest (instanced gums, tree ferns, bushes, rocks off-trail), chunked by 100 m for performance, misty mountains.
- Rider and bike built from primitives; pedalling animation with two-bone leg IK; sprung chassis (suspension compresses visibly).
- Progressive steering, lean-based cornering with traction limit, drift, berms that catch a drift.
- Four jumps with flagged landing zones (green = sweet spot, amber = edge of landing), two big jumps, pop timing.
- Small crash (resume where you fell, clock running) vs big crash (run over).
- Four timed splits, arcade top-10 per split with name entry.
- Keyboard + on-screen touch controls; works on phones.

## Coordinate and track conventions

- `s` = distance ALONG the winding trail (m), so 100 m of `s` is 100 m of riding. `off` = sideways offset, square to the trail (m, positive to the rider's right). `d` = distance straight down the hill (world `z = -d`).
- The centreline is laid out as sideways sine waves of `d`; `src/path.js` measures it. World point for (s, off): `trail.pointAt(s, off)`; height: `trail.ground(s, off)` or `trail.groundAt(x, z)`; back again: `trail.locate(x, z)`. Rider travels toward -z.
- The hill is a function of world position (`d`) with each jump's drop built in as a terrace. Near the trail the ground is the riding line + dish + berms + banks; from 6 m past the edge it blends into the hill by 20 m, so tight bends can't make cliffs. Bends tighter than about 35 m radius are refused (the detailed ground would fold).
- Heading `h`: forward vector `(sin h, 0, -cos h)`; right vector `(cos h, 0, sin h)`. Bike `rotation.y = -h`, rotation order `YXZ`.
- Hardline (`src/trails/hardline.js`): centreline `x = 22 sin(d/45) + 8 sin(d/23 + 1)`, the same shape on the hill as v1; 1200 m straight down, 1297 m to ride. Hill grade -0.2 (11 degrees) with a 7 m sine undulation and a steeper chute 500-580 m down. Jumps at 177, 438, 743, 1037 m; splits at 326, 650, 974, finish 1297 m.

## Tuned physics (keep these unless Ben agrees a change)

| Item | Value | Notes |
|---|---|---|
| Ground gravity | 9.8 m/s^2 | |
| Air gravity | 15 m/s^2 | Deliberately 1.5 g for snappier, shorter jumps |
| Rolling + drag | 0.12 + 0.0045 v^2 | Terminal about 75 km/h on base grade |
| Air drag | 0.003 v^2 | In the air only (not in the jump simulator; see gotchas) |
| Off-trail drag | 1.8 m/s^2 | |
| Pedal | 3.0 m/s^2, fades out 8-13 m/s | Pedalling does not help at speed |
| Brake | 8 m/s^2 | |
| Steering | input ramps 3.6/s (12/s when reversing), returns 8/s | Full lean about 0.3 s |
| Max lean | 0.8 rad | lean follows input at 14/s on ground, 3/s in air |
| Yaw rate | g tan(lean) / v, clamped +/-2.6 rad/s | below 3 m/s: steerIn x 2.0 |
| Tyre grip | mu 0.75 on trail, 0.5 off trail | |
| Berm support | aMax = g (mu + tan b) / (1 - mu tan b) | tan b = ground rise toward outside of turn over 1 m |
| Drift | sideways slip += excess x 0.55 dt, scrub excess x 0.22 dt | |
| Berm catch | on berm (tan b > 0.25) after a slide: slip decays x exp(-9 dt), extra g x min(0.6, 0.8 tan b) turning, speed refund | |
| Suspension travel | 0.55 m (0.40 m if crouched) | |
| Landing decel | 38 m/s^2 | travel used = vi^2 / (2 x 38) / travel |
| Landing outcome | < 0.55 smooth, < 1.0 heavy, < 1.35 small crash, else big crash | lean over 0.4 rad adds penalty |
| Pop | +1.0 + 2.0 x compress (upward m/s) | release in last 4 m of kicker or within 0.15 s of leaving lip |
| Tree crash | small below 9 m/s (32 km/h), big at or above | below 2.5 m/s you just stop |
| Visual suspension spring | k 170, c 18, 0.18 m max | |

Jump shapes and their declared landing ranges live in `src/jumps.js` and are checked by `tests/jumps.test.js`. Current tuned ranges (speed at lip, km/h, from the simulator):

| Jump | Smooth | Notes |
|---|---|---|
| Normal (170 m, 690 m) | 46-68 no pop | lip 1.1 m, gap 6 m |
| Big, needs pop (960 m) | 52-64 with full pop | lip 1.5 m, gap 12 m; cases without pop below about 66 |
| Big, pop optional (410 m) | 52-66 no pop, 46-54 full pop | lip 1.5 m, gap 9 m, 42 m landing |

Fixed in 2b: in v1 `s` ran straight down the hill, so the first jump (on a diagonal) was ridden 15.5% long and landed smooth at about 53-79 km/h instead of 46-68. With `s` along the path it now lands smooth from 46 km/h in the game.

Game vs simulator, smooth range at the lip (km/h, measured with `tests/helpers/ride.js` at 60 fps):

| Jump | Pop | Game | Simulator |
|---|---|---|---|
| 177 m normal | none | 46-74 | 46-68 |
| 438 m popOptional | none | 54-68 | 52-66 |
| 438 m popOptional | full | 48-56 | 46-54 |
| 743 m normal | none | 48-72 | 46-68 |
| 1037 m bigPop | full | 58-68 | 52-64 |

## Known gotchas (learned the hard way)

- Terrain triangle winding must give upward normals (`a, b, d, b, e, d`), or the ground is back-face culled and invisible.
- `InstancedMesh` needs `frustumCulled = false` (r128 culls on the base geometry's bounds); visibility is managed by distance chunks instead.
- Hex colours are used as-is (no sRGB output encoding). On three 0.160 this needs `ColorManagement.enabled = false` (in `src/three.js`, which every module imports Three.js through) and `renderer.outputColorSpace = LinearSRGBColorSpace`.
- Light intensities are v1's values x pi. Since r155 Three.js lights scenes pi times dimmer for the same number; for hemisphere and directional lights x pi is exactly r128's look. Don't use the deprecated `useLegacyLights` instead (warns every load, removed in r165).
- Terrain colour noise, forest and mountains share one seeded random sequence in that order; changing it moves every tree.
- The forest floor colour is a smooth pattern of world position (`makeGroundNoise`), shared by the detailed strip and the hillside grid so their join doesn't show.
- **Game physics depends on frame rate.** The physics steps once per frame (dt = frame time, capped at 1/30 s), so jump landings are detected up to a frame late. Measured smooth-range edges move by up to 4 km/h between 120 and 30 fps. Fix in the tuning round: a fixed physics step (e.g. 1/120 s).
- **The jump simulator differs from the game** in three ways: time step (1/240 s vs the game's frame), no air drag, and pop timing (simulator: exactly at the lip; game: on the kicker just before it). Together these move range edges by up to 6 km/h (table above). `tests/ride.test.js` marks the two biggest gaps as TODO.
- The game must keep working at phone width with touch controls; no `alert`/`prompt`; text input must not trigger game keys.
- The v1 shared scoreboard used the claude.ai artifact database (`window.claude.use('db')`). That does not exist outside claude.ai. v2 uses localStorage behind a small storage interface so a shared backend can be added later.

## Roadmap for v2 (do these in order, one PR-sized step each)

1. **Scaffold** (done): Vite + `three` from npm. Split v1 into ES modules (`terrain`, `trail`, `forest`, `bike`, `rider`, `physics`, `camera`, `hud`, `input`, `scores`, `main`). Behaviour must match `public/v1.html`. Tests pass.
2. **Trail as data**:
   - **2a** (done): `defineTrail()` + `src/trails/hardline.js`; every module is handed its trail; still matches v1 exactly. Berms are automatic per trail, with `berms.adjust` for a stretch. Jump simulator keeps a constant -0.2 grade (agreed; real profile moves ranges by 1 km/h at most).
   - **2b** (done): `s` follows the winding path. Hardline keeps v1's shape on the hill (1297 m to ride). World-space hill with jump terraces; detailed ground strip plus hillside grid; forest regrown along the path. v1 step-for-step tests retired; replaced by ground tests (v1 riding line away from jumps, no cliffs, no trees on the trail) and game-physics ride tests (every jump, and a full run).
   - **Tuning round** (next): Ben's playtest notes, plus: fixed physics step so jumps don't depend on frame rate; make the jump simulator match the game (time step, air drag, pop timing) and re-baseline the declared landing ranges; update the in-game "How to ride" speeds to match.
3. **Trailhead**: see spec. Three start gates; riding through one selects that trail.
4. **Jolly Green Giant** (green): rollers + pump mechanic.
5. **Flow Monster** (blue): linked berms + tabletops.
6. **Back in Black** (black): freeride, A/B lines.
7. **Scores**: top 10 per trail per split, fresh start (no v1 scores carried over).
8. **Hosting**: GitHub Pages (or similar) so the boys can play on phones; then consider a shared score backend.

Every new jump or roller feature must declare its expected landing ranges (`landings` in `src/jumps.js`, or on the trail feature if it changes the shape); `tests/jumps.test.js` checks them all.
