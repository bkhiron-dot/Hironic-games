# Hardline MTB

A browser-based, third-person downhill mountain bike game built with Three.js. Inspired by Red Bull Hardline, set in Maydena-style Tasmanian rainforest (tall pale eucalypts, tree ferns, dark loamy dirt). The trails are built as if they were part of Maydena Bike Park: the current ones are a mid-mountain segment. Visual style cue: Red Bull Bike Unchained (clean, chunky low-poly shapes, bold kit colours, lots of flying dirt).

Built by Ben with his three boys, partly as a way for them to learn coding. Keep code readable: plain names, short functions, comments that explain the *why* in plain English. The physics should feel lifelike but stay simple.

## Working with Ben

- Plain English, concise, evidence-based. Show numbers when tuning (speeds, ranges, thresholds).
- Flag any assumption or approximation clearly and agree it before building on it.
- Prefer small, reviewable commits. Run `npm test` before every commit.
- When changing physics or a jump, re-run the jump simulator and report the new landing ranges as a table (speed at lip -> smooth / heavy / small crash / big crash).
- **Branches** (Ben, 25 Oct): `main` is the live game the boys play; don't change it without Ben saying so. Work PRs target **`next`**. When there's something to play-test, open a release PR `next` -> `main` with the `preview` label, so Ben can try it at `preview/pr-<number>/`. Merging that release PR is Ben's call; it publishes to the live game.
- **Previews** (Ben, 24 Oct): not on every PR. Add the `preview` label only when Ben asks, and suggest it when a change is significant or risky (physics or jump changes, new trails or features, big visual changes, anything that could hurt phone frame rate).

## Commands

- `npm install` then `npm run dev` - local dev server (Vite). The game (v2) is the home page `/`; v1 is at `/v1.html` (`/v2.html` redirects home).
- `npm test` - physics and jump-range tests (Node's built-in test runner, no extra deps).
- `npm run build` - production build into `dist/`.

## Repository layout

- `public/v1.html` - **reference build**: the complete v1 game in one file, exactly as it was when ported from claude.ai. Treat it as the behavioural spec. Do not edit it; copy logic out of it into `src/`.
- `index.html` + `src/` - the game (v2, modular). `src/main.js` wires it together; each module's header says what it does. `src/trail.js`, `src/jumps.js` and the pure parts of `terrain.js`, `forest.js` and `physics.js` have no DOM, so tests run them in Node.
- `src/trails/` - one data file per trail (`flow-monster.js` is the v1 track; Hardline is the name of the game, not a trail) and `index.js`, the list of trails. `defineTrail()` in `src/trail.js` checks the data and builds the trail's functions (`ground`, `groundAt`, `pointAt`, `locate`, `halfWidth`, `kickerAt`, ...). Every module is handed the trail it works on; only `main.js` picks one.
- `src/path.js` - the centreline as a measured path: distance along it, points square to it, and `locate(x, z)` to find any world point on it.
- `src/clock.js` - fixed-step physics clock (1/240 s steps, at most 0.1 s of catch-up per frame).
- `src/jumps.js` - jump kinds (shape, landing flags, declared landing ranges). Trails place jumps by kind and may override numbers.
- `src/trailhead.js` - `withTrailhead(trail)`: the level, fenced clearing above the trail's start gate, three start gates (green, blue, black; only the ridden trail's is open), the drop-in point, and the ground graded into the hill round it. `main.js` wraps the trail with it.
- `public/v2.html` - redirect from the old v2 address to the home page.
- `src/dirt.js` - dirt thrown up by the tyres (crumbs when rolling, roost and dust growing with drift, an explosion on a berm hit, puffs on landings). `src/tracks.js` - tyre tracks in the dirt. Both visual only.
- Adding `?debug` to the address exposes the game state as `window.hardline` for test tools (screenshots, tuning).
- `.github/workflows/deploy-pages.yml` + `tools/build-site.sh` - publish to GitHub Pages: main at the root on every push; an open pull request labelled `preview` also at `preview/pr-<number>/`, rebuilt on each push while labelled, link posted on the PR. Label removed or PR closed: the preview goes at the next publish. Previews never block main (a broken one is skipped).
- `tools/jump-sim.js` - jump simulator: rides a jump with the game's own physics (`stepRide`, 1/240 s steps) on a straight test trail at -0.2 grade, or on a real trail (`rideJump`). `npm run jumps` prints every jump on every trail.
- `tests/` - `node:test` tests. `ground.test.js` checks Flow Monster against v1's own code (read out of `public/v1.html`) away from jumps, and that the ground has no cliffs. `ride.test.js` rides the game's physics over every jump and the whole trail (`tests/helpers/ride.js`). `berm.test.js` checks berm hits. `trailhead.test.js` checks the clearing (level, no cliffs, gates and fence, forest unmoved) and a run from the drop-in to the finish.
- `docs/v2-trailhead-spec.md` - the agreed design for the trailhead and the three trails.

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
- Flow Monster (`src/trails/flow-monster.js`, blue; was "Hardline" until step 3): centreline `x = 22 sin(d/45) + 8 sin(d/23 + 1)`, the same shape on the hill as v1; 1200 m straight down, 1297 m to ride. Hill grade -0.2 (11 degrees) with a 7 m sine undulation and a steeper chute 500-580 m down. Jumps at 177, 438, 743, 1037 m; splits at 326, 650, 974, finish 1297 m.

## Tuned physics (keep these unless Ben agrees a change)

| Item | Value | Notes |
|---|---|---|
| Physics step | 1/240 s, fixed | Same on every device; visuals still move once per frame |
| Ground gravity | 9.8 m/s^2 | |
| Air gravity | 15 m/s^2 | Deliberately 1.5 g for snappier, shorter jumps |
| Rolling + drag | 0.12 + 0.0045 v^2 | Terminal about 75 km/h on base grade |
| Air drag | 0.003 v^2 | In the air only |
| Off-trail drag | 1.8 m/s^2 | |
| Pedal | 3.0 m/s^2, fades out 8-13 m/s | Pedalling does not help at speed |
| Brake | 8 m/s^2 | |
| Steering | input ramps 3.6/s (12/s when reversing), returns 8/s | Full lean about 0.3 s |
| Max lean | 0.8 rad | lean follows input at 14/s on ground, 3/s in air |
| Yaw rate | g tan(lean) / v, clamped +/-2.6 rad/s | below 3 m/s: steerIn x 2.0 |
| Tyre grip | mu 0.75 on trail, 0.5 off trail | |
| Berm support | aMax = g (mu + tan b) / (1 - mu tan b) | tan b = ground rise toward outside of turn over 1 m |
| Berm shape (Flow Monster, step 3b) | 2.2 m high (was 1.7); start on bends tighter than 125 m radius, full height under 63 m (was 100 / 50 m) | capped at 0.85 x half width, so the narrowest bends (half width 2.3 m) get about 2.0 m. Berms on 438 m of trail (was 363). Steepest step 0.80 m per 0.5 m; cliff limit on berms 0.85 (was 0.8). Drifting wide into berms (96 test runs): 68 berm hits (was 59), off the trail 3 (was 14) |
| Drift | sideways slip += excess x 0.55 dt, scrub excess x 0.22 dt | |
| Berm catch | on berm (tan b > 0.25) after a slide: slip decays x exp(-9 dt), extra g x min(0.6, 0.8 tan b) turning, speed refund |
| Berm hit | first contact with a berm after a slide harder than 0.3 (slide peak x fading memory, or slip / 1.5 m/s): bike swings 60% of the way to the trail's heading (only round the corner), sideways speed added to forward speed (v = sqrt(v^2 + slip^2)), slip x 0.2 | step 3, Ben's request. Speed kept (-0.03 to +0.27 km/h at the hit); drifting wide into berms ran off the trail in 2 of 48 test runs, was 9 | |
| Suspension travel | 0.55 m (0.40 m if crouched) | |
| Landing decel | 38 m/s^2 | travel used = vi^2 / (2 x 38) / travel |
| Landing outcome | < 0.55 smooth, < 1.0 heavy, < 1.35 small crash, else big crash | lean over 0.4 rad adds penalty |
| Pop | +1.0 + 2.0 x compress (upward m/s) | release in last 4 m of kicker or within 0.15 s of leaving lip |
| Tree crash | small below 9 m/s (32 km/h), big at or above | below 2.5 m/s you just stop |
| Visual suspension spring | k 170, c 18, 0.18 m max | |

Jump shapes and their declared landing ranges live in `src/jumps.js` and are checked by `tests/jumps.test.js`. The simulator rides the game's own physics, so these are what players get (speed at lip, km/h; "pop" = best pop, released on the last step before the lip):

| Jump | Smooth | Notes |
|---|---|---|
| Normal (177 m) | 46-68 no pop, 34-52 pop | lip 1.1 m, gap 6 m, landing 30 m. Too fast: small crash at 76, big crash from 78 km/h |
| Normal, longer landing (743 m) | 46-70 no pop, 34-52 pop | Landing 33 m (+10%, Ben overshot it twice): heavy 72-76, small crash 78, big crash from 80 km/h; with a pop heavy 54-60, small crash 62-64, big crash from 66. Trail below sits 0.58 m lower |
| Big, pop optional (438 m) | 52-66 no pop, 46-54 pop | lip 1.5 m, gap 8.5 m (was 9; tuning round 2), 42 m landing |
| Big, needs pop, kind `bigPop` (1037 m) | 54-66 pop; no pop cases | Shaped with Ben (tuning rounds 2-4): kicker 12 m, lip 1.8 m, gap 12 m, knuckle 2.4 m, landing 48 m at pitch 0.7. Sweet spot 12.3-30.1 m past the lip. Round 3's 2.2 m lip overshot with a pop at speed; this one is built for a fast pop (lip reachable at about 62 on Flow Monster) |

Fastest reachable lip speed on Flow Monster (flat out, 300 m run-up, steering only, scripted rider): 177 m about 70, 438 m about 56, 743 m about 77, 1037 m about 63 km/h. So the "pop optional" jump lands without a pop at 52-56 km/h on Flow Monster. These are conservative: Ben has reached the last lip at 66 km/h (scripted rider about 61-63), so leave headroom above them when shaping a jump.

Fixed in 2b: in v1 `s` ran straight down the hill, so the first jump (on a diagonal) was ridden 15.5% long and landed smooth at about 53-79 km/h instead of 46-68. With `s` along the path it now lands smooth from 46 km/h in the game.

## Known gotchas (learned the hard way)

- Terrain triangle winding must give upward normals (`a, b, d, b, e, d`), or the ground is back-face culled and invisible.
- `InstancedMesh` needs `frustumCulled = false` (r128 culls on the base geometry's bounds); visibility is managed by distance chunks instead.
- Hex colours are used as-is (no sRGB output encoding). On three 0.160 this needs `ColorManagement.enabled = false` (in `src/three.js`, which every module imports Three.js through) and `renderer.outputColorSpace = LinearSRGBColorSpace`.
- Light intensities are v1's values x pi. Since r155 Three.js lights scenes pi times dimmer for the same number; for hemisphere and directional lights x pi is exactly r128's look. Don't use the deprecated `useLegacyLights` instead (warns every load, removed in r165).
- Terrain colour noise, forest and mountains share one seeded random sequence in that order; changing it moves every tree. So the trailhead adds things with their own sequences (strip rows above s = -20 use seed + 2, gums round the clearing seed + 1), and a plant whose spot is on the clearing is still worked out, using its random numbers, then thrown away.
- The forest floor colour is a smooth pattern of world position (`makeGroundNoise`), shared by the detailed strip and the hillside grid so their join doesn't show.
- **Physics runs in fixed 1/240 s steps** (`src/clock.js`, tuning round PR 1). Before that it stepped once per frame and jump ranges moved by up to 6 km/h between 30 and 120 fps. 240/s is settled: 480/s moves one range edge by 2 km/h. A step costs about 11 µs. Below 10 fps the game runs slower than real time (catch-up is capped at 0.1 s per frame).
- **The jump simulator rides the game's own physics** (tuning round 2). The old separate simulator had no air drag and popped exactly at the lip, so its ranges were up to 6 km/h off. Declared ranges must come from it, and must be reachable on the trail: check the fastest lip speed (table above) before shaping a jump. A higher lip or lower knuckle needs a steeper landing, or riders land too hard.
- **The bike can't steer in the air**, so on a jump on a bend it flies straight while the trail curves away. Flow Monster's last jump (1037 m) is on a 145 m bend on the narrowest part of the trail (half width 2.3 m): ridden straight up the kicker it lands about 1.8 m off-centre. Riders (and `tests/helpers/ride.js`) aim the take-off at the landing.
- **The trailhead clearing is cut into a valley**: the trail runs between banks that rise up to 20 m within 25 m of it, so a level 50 x 36 m pad with a smooth blend made cliffs (1.5 m per 0.5 m). The ground round it is graded instead: it may rise above or fall below the pad no faster than 0.7 (35 degrees, easing in over 6 m), and is the plain hill wherever that's gentler. Steepest step round it: 0.35 m per 0.5 m (limit 0.5). Past the gate the trail itself is untouched from 2 m on.
- **Deploy concurrency is per job, not per workflow.** With one workflow-level group, the "pull request closed" run (skipped, no preview label) cancelled the publish of PR #11's merge, so main didn't go live. A skipped job never joins a job-level group.
- Anything drawn on the ground (tyre tracks) must also wind its triangles to face up, or it is culled and invisible.
- **Start a test bike already following the slope.** `placeBikeAt` sets no vertical speed; dropped in at speed on a -0.28 slope it flies about 12 m and bottoms out. Set `b.vy` from the slope ahead, as `tools/jump-sim.js` does. (Early berm-hit numbers in PR #10 were measured without this; re-measured in 3b.)
- Every plant kind added to the forest must be listed in the ground test's "nothing grows on the trail" check, with its gap.
- Plant triangle budget: about 525k across 16 chunks, about 100k drawn at once (tree-fern crowns 112 each, ground ferns 42). Check phones before adding more.
- The game must keep working at phone width with touch controls; no `alert`/`prompt`; text input must not trigger game keys.
- The v1 shared scoreboard used the claude.ai artifact database (`window.claude.use('db')`). That does not exist outside claude.ai. v2 uses localStorage behind a small storage interface so a shared backend can be added later.

## Roadmap for v2 (do these in order, one PR-sized step each)

1. **Scaffold** (done): Vite + `three` from npm. Split v1 into ES modules (`terrain`, `trail`, `forest`, `bike`, `rider`, `physics`, `camera`, `hud`, `input`, `scores`, `main`). Behaviour must match `public/v1.html`. Tests pass.
2. **Trail as data**:
   - **2a** (done): `defineTrail()` + `src/trails/hardline.js` (now `flow-monster.js`); every module is handed its trail; still matches v1 exactly. Berms are automatic per trail, with `berms.adjust` for a stretch. Jump simulator keeps a constant -0.2 grade (agreed; real profile moves ranges by 1 km/h at most).
   - **2b** (done): `s` follows the winding path. The trail keeps v1's shape on the hill (1297 m to ride). World-space hill with jump terraces; detailed ground strip plus hillside grid; forest regrown along the path. v1 step-for-step tests retired; replaced by ground tests (v1 riding line away from jumps, no cliffs, no trees on the trail) and game-physics ride tests (every jump, and a full run).
   - **Tuning round** (done): PR 1 fixed 1/240 s physics step. PR 2: the simulator uses the game's own physics; normal jumps re-baselined as measured; pop-optional gap 9 -> 8.5 m to restore its ranges. Rounds 3-4 (done): last jump rebuilt for a fast pop after Ben's playtests (lip 66 km/h with a pop: smooth).
3. **Trailhead** (this step): the trail is renamed Flow Monster (blue). Level fenced clearing at the top; three gates, only blue open (green and black taped off, "coming soon"); map board drawn from the trail data. Drop in at rest in the clearing; the clock starts at the blue gate. End screen: **Ride again** (from the gate) or **Trailhead**. The game is the home page. One trail at a time (layout B, agreed).
   - **3b** (this step): Flow Monster's berms higher (2.2 m) and on more corners (option B), capped by trail width; jumps unchanged.
4. **Jolly Green Giant** (green): chill, optional jump rollers, progressing to moderate jumps by the bottom (like Flow Monster's first jumps); pump mechanic (kept, see spec).
5. **Back in Black** (black): all mandatory gaps: a range of gaps, step-downs and step-ups. No B lines. New jump kinds declare landing ranges checked against reachable lip speeds.
6. **Scores**: top 10 per trail per split, with trail tabs, fresh start (no v1 scores carried over). (Trail ids changed in step 3: `hardline` became `flow-monster`, so any v2 scores already saved on a device no longer show.)
7. **Hosting** (done for the game: GitHub Pages on every push to main); then consider a shared score backend.
8. **The rest of the mountain** (later): upper mountain (fast and steep) above the mid-mountain trailhead, lower mountain (wide and flowing) below it, Maydena-style. Agreed design (see spec, "The mountain"):
   - three stages, each with a green, blue and black line;
   - lines meet only at trailheads, and are kept at least 40 m apart elsewhere;
   - one stage loaded at a time;
   - rolling starts: each stage's start brings speed into a known band, tested for every incoming x outgoing line;
   - freeride (untimed, any line) and race mode (timed, one colour top to bottom, barricaded course through trailheads).

Every new jump or roller feature must declare its expected landing ranges (`landings` in `src/jumps.js`, or on the trail feature if it changes the shape); `tests/jumps.test.js` checks them all.
