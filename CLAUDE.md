# Hardline MTB

A browser-based, third-person downhill mountain bike game built with Three.js. Inspired by Red Bull Hardline, set in Maydena-style Tasmanian rainforest (tall pale eucalypts, tree ferns, dark loamy dirt). The trails are built as if they were part of Maydena Bike Park: the current ones are a mid-mountain segment. Visual style cue: Red Bull Bike Unchained (clean, chunky low-poly shapes, bold kit colours, lots of flying dirt).

Built by Ben with his three boys, partly as a way for them to learn coding. Keep code readable: plain names, short functions, comments that explain the *why* in plain English. The physics should feel lifelike but stay simple.

## Working with Ben

- Plain English, concise, evidence-based. Show numbers when tuning (speeds, ranges, thresholds).
- Flag any assumption or approximation clearly and agree it before building on it.
- Prefer small, reviewable commits. Run `npm test` before every commit.
- When changing physics or a jump, re-run the jump simulator and report the new landing ranges as a table (speed at lip -> smooth / heavy / small crash / big crash).
- **Branches** (Ben, 25 Oct): `main` is the live game the boys play; don't change it without Ben saying so. Work PRs target **`next`**. When there's something to play-test, open a release PR `next` -> `main` with the `preview` label, so Ben can try it at `preview/pr-<number>/`. Merging that release PR is Ben's call; it publishes to the live game.
- **Versions** (Ben, 25 Oct): main and next have separate numbers (`src/version.js`, history in `CHANGELOG.md`). Every PR merged into next bumps next: minor (1.1 -> 1.2) for a refinement (a trail line, a jump, physics), major (2.0) for a new trail or major feature. A release PR bumps main the same way, by what the release brings. The start screen shows the number: "v1.1 main" on the live game, "v1.2 next (live game v1.1)" on a preview.
- **Previews** (Ben, 24 Oct): not on every PR. Add the `preview` label only when Ben asks, and suggest it when a change is significant or risky (physics or jump changes, new trails or features, big visual changes, anything that could hurt phone frame rate).

## Commands

- `npm install` then `npm run dev` - local dev server (Vite). The game (v2) is the home page `/`; v1 is at `/v1.html` (`/v2.html` redirects home).
- `npm test` - physics and jump-range tests (Node's built-in test runner, no extra deps).
- `npm run build` - production build into `dist/`.

## Repository layout

- `public/v1.html` - **reference build**: the complete v1 game in one file, exactly as it was when ported from claude.ai. Treat it as the behavioural spec. Do not edit it; copy logic out of it into `src/`.
- `index.html` + `src/` - the game (v2, modular). `src/main.js` wires it together; each module's header says what it does. `src/trail.js`, `src/jumps.js` and the pure parts of `terrain.js`, `forest.js` and `physics.js` have no DOM, so tests run them in Node.
- `src/trails/` - one data file per trail (`flow-monster.js` is the v1 track; Hardline is the name of the game, not a trail) and `index.js`, the list of trails. `defineTrail()` in `src/trail.js` checks the data and builds the trail's functions (`ground`, `groundAt`, `pointAt`, `locate`, `halfWidth`, `kickerAt`, ...). Every module is handed the trail it works on; only `main.js` picks one.
- `src/parks.js` - the bike parks and their trails. One so far: Maydena Bike Park, Tasmania (the current trails are its mid-mountain stage). The game can grow to more parks.
- `src/version.js` + `CHANGELOG.md` - version numbers (see Working with Ben) and what each changed.
- `src/texture.js` - `paintedTexture(canvas)`: every texture painted on a canvas goes through it (see gotchas).
- `src/path.js` - the centreline as a measured path: distance along it, points square to it, and `locate(x, z)` to find any world point on it.
- `src/clock.js` - fixed-step physics clock (1/240 s steps, at most 0.1 s of catch-up per frame).
- `src/jumps.js` - jump kinds (shape, landing flags, declared landing ranges). Trails place jumps by kind and may override numbers. Kinds: `normal`, `popOptional`, `bigPop`, `table` (tabletop: flat deck at lip height, long steep landing).
- `src/rollers.js` - roller sets (`type: 'rollers'` features): `count` humps, `height`, `spacing` crest to crest, `face` (share of each hump that is its way up). Each set declares its outcomes (rolled / gapped / no crash).
- `src/world.js` - `createWorld(trailData)`: the mountain with all three trails (next 4.0). Flow Monster's hill is the mountain near it; more than 30-90 m away it blends into that hill averaged over 200 m down it, so FM's jump terraces don't make steep steps across the whole mountain. Green and black are built on it (`hill: { mountain: true }`). Ground = the hillside (mountain + banks rising from the nearest trail + each mountain trail's offset, shared across the ridge between trails and fading 20-50 m out), blended with each trail's own near ground (nearest trail counts most), then both clearings graded in. A coarse 10 m distance map skips trails too far away to matter. `WORLD.trails` are the trails as ridden (world ground; `trailhead` with their own gate, drop-in, atGate); `WORLD.ownTrails` each trail on its own (the jump simulator rides these; on the trail itself they are identical away from the clearings).
- `src/trailhead.js` - `createClearing({ origin, heading, level, at, gates })`: a level, fenced pad with three gates (green, blue, black, 15 m apart), graded into the hill round it (banks no steeper than 0.7). The trailhead (`at: 'top'`, pad above the gate line at FM's s 9) and the finish clearing (`at: 'bottom'`, pad below FM's finish). `blocked()` stops the bike at the fence; riding out of the trailhead through a gate returns `{ out: gate }` and `run.js` switches to that trail in place (no reload; the run restarts on that trail).
- `public/v2.html` - redirect from the old v2 address to the home page.
- `src/dirt.js` - dirt thrown up by the tyres (crumbs when rolling, roost and dust growing with drift, an explosion on a berm hit, puffs on landings). `src/tracks.js` - tyre tracks in the dirt. Both visual only.
- Adding `?debug` to the address exposes the game state as `window.hardline` for test tools (screenshots, tuning).
- `.github/workflows/deploy-pages.yml` + `tools/build-site.sh` - publish to GitHub Pages: main at the root on every push; an open pull request labelled `preview` also at `preview/pr-<number>/`, rebuilt on each push while labelled, link posted on the PR. Label removed or PR closed: the preview goes at the next publish. Previews never block main (a broken one is skipped).
- `tools/jump-sim.js` - jump simulator: rides a jump with the game's own physics (`stepRide`, 1/240 s steps) on a straight test trail at the trail's own grade (-0.2 for jump kinds and Flow Monster), or on a real trail (`rideJump`); `rideRollers` rides a roller set (rolled, or a full pop at the first crest). `npm run jumps` prints every jump and roller set on every trail.
- `tests/` - `node:test` tests. `ground.test.js` checks Flow Monster against v1's own code (read out of `public/v1.html`) away from jumps, and that the ground has no cliffs. `ride.test.js` rides the game's physics over every jump and the whole trail (`tests/helpers/ride.js`). `berm.test.js` checks berm hits. `world.test.js` checks the mountain: both clearings level and graded, gates and fences, every trail through its gates, trails 40 m apart outside the 150 m approaches, nothing growing on any trail or clearing, FM's forest and riding surface unchanged, and an FM run to the finish clearing. `green.test.js` checks Jolly Green Giant: every roller set's outcomes, pumping vs pedalling, no cliffs, berms on corners, and slow and fast runs from the trailhead. `black.test.js` checks Back in Black: no cliffs and a planned run landing every gap smooth. `tests/helpers/ride.js` rides any trail (`rideTrail({ trail, lipPlan, cruise, pump })`); `tests/helpers/world.js` plans the whole forest once (`worldForest()`) and measures the steepest step beside a trail (`steepestAcross`).
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
- Jolly Green Giant (`src/trails/jolly-green-giant.js`, green; re-laid in next 4.0, bends and big rollers 26 Oct): 2070 m to ride, 1180 m straight down, out to the west (as far as x = -600). Centreline `{ x0, heading, turns }`: traverses at 68 degrees across the fall line joined by switchback corners (55 m radius at the tightest), with gentle 7-degree bends along each traverse (about 85 m radius, gentle berms; berms on 477 m of trail, was 453). Graded (`hill.smooth: 60`, eased out within 120 m of each clearing). -0.14 overall. Half width 4.5-5.5 m; 1.8 m berms from 170 m radius. 7 big roller sets (4 pump sets 1.2 m high, 20 m apart; 3 whoops 1.1 m, 13 m apart), pump-only (`pop: false`), and 4 big tabletops, all on straights; splits at 480, 1050, 1450, finish 2070.4 m. At least 42 m from FM outside the approaches.
- Back in Black (`src/trails/back-in-black.js`, black; re-laid in next 4.0, twisty 26 Oct): 1339 m to ride, 1204 m straight down, out to the east. Centreline `{ x0, heading, turns }`: fast straights (one gap each) joined by S-bends (45 degrees across and back, 46 m radius at the tightest) with 2 m berms (berms on 336 m, was 12). -0.217 overall (FM -0.226). Half width 2.2-3.6 m. Six mandatory gaps (gap 171, gap 364, step-down 560, step-up 755, drop 950, step-up 1150); splits at 300, 680, 880, finish 1339.3 m. At least 78 m from FM outside the approaches.
- A mountain trail's hillside offset (how far the hillside round it sits above or below the mountain) is a smooth 5 m map averaged over the nearby trail, so inside tight bends the two sides blend (taking the nearest point's offset made a step where the nearest point jumps across the bend).
- On the mountain, each jump's drop is paid back on the stretches between jumps (1/6, 1/3 on the two before it, 1/3, 1/6 on the two after), so the trail stays within about 8 m of the hillside; the ground beside a mountain trail keeps the hill's tilt across it (benched in).
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
| Drift | sideways slip += excess x 2.0 dt (was 0.55), up to 5 m/s (was 4). Once sliding, the tyres grip 0.9 x as well until they hook up again (demand back within grip) | Ben: corner hard at speed and drift wide to the berm. Full lean from mid-trail into a bermed corner reaches the catch line in 34 of 52 runs (was 5): at 45 / 55 / 65 / 75 km/h, 3 / 7 / 13 / 11 of 13. Over the top 0. Jump ranges unchanged |
| Drift with speed, and berm support while gripping | slip builds x clamp((v - 20 km/h) / (50 - 20 km/h), 0, 1): no drift below 20 km/h (asking too much just runs wide at grip), full from 50. The lower berm (below the catch line) withholds its support only while you are actually sliding (was: for about 1.2 s of slide memory after any slide), so a gripping rider on a berm gets its full support | Ben, 25 Oct: drift proportional to speed and steering; ride a wide berm's mid-line fast without drifting. Full lock for 1 s on flat: slip 0 / 0.9 / 2.0 / 3.1 / 4.9 m/s at 15 / 20 / 25 / 30 / 40 km/h (was 5.0 at every speed). Final berm (1255-1295 m), smooth rider on a 50-70% line at 55-75 km/h: no slide (was 0.3-0.9 s); keyboard rider at most 0.24 s (was 0.45-0.8 s). Hard drift from mid-trail still reaches the catch line in 35 of 48 runs. Jump ranges unchanged |
| Drift scrub | sliding sideways slows the bike by 0.3 x g x mu x 0.9 x sin(slip angle), slip angle capped at sin 0.3 (17 degrees: at most 0.6 m/s^2 on the trail); sliding up a berm's side costs the height it gains (v^2 -= 2 g dh), sliding down gives it back. Grip cornering costs nothing; once a berm catches you the slide stops, so you hold your speed | Ben's #17 playtests: a light cost, rolling with grip should just feel a bit faster. Replaces excess x 0.22 dt, which drifting more than paid back. Hard line into the 12 big-berm corners, easing off once round, exit speed vs a smooth grip line: 45 km/h 2.4 slower (was 2.6), 55: 1.6 (was 0.4), 65: 0.5 (was 0.2 faster). Full scrub (x 1) cost 3.4-6.6: too much. Hard from mid-trail reaches the catch line in 35 of 48 runs (was 33). After a hit, sliding on along the berm: median 0.11 s (was 1.5 s). Jump ranges unchanged |
| Berm catch | on berm (tan b > 0.25) after a slide: slip decays x exp(-9 dt), extra g x min(0.6, 0.8 tan b) turning, speed refund |
| Berm hit | first contact with a berm after a slide harder than 0.3 (slide peak x fading memory, or slip / 1.5 m/s): bike swings 60% of the way to the trail's heading (only round the corner), sideways speed added to forward speed (v = sqrt(v^2 + slip^2)), slip to 0 and the tyres hook up (hooked: full berm support, no sliding grip, until off the berm) | step 3, Ben's request. Speed kept (-0.03 to +0.27 km/h at the hit); drifting wide into berms ran off the trail in 2 of 48 test runs, was 9 | |
| Berm rail | after a berm hit (hooked), steering at least 30% into the corner, anywhere on the berm: the berm sets the line. The bike aims 2 v / 8 m ahead at the same share of the trail's width (its height up the berm, kept below 0.9 of the way out), turning toward it at 8/s; the rider's lean doesn't add turn; pressed into the wall. Drawn drift angle straightens at 12/s | Ben's #19 playtest: after the hit it kept looking like a drift (drawn 10-24 degrees sideways, roost on) and turned tighter than the corner, dropping off the berm (60% to 12% of the height in 0.45 s). Now (72 runs, 50-70 km/h): from 0.3 s after the hit, drawn drift at most 0.6 degrees, at most 2.9 degrees off the corner's line, held at 0.50-0.86 of the height. Steering in, over the top 0 of 144 |
| Berm catch line and hold | Below a catch line 60% of the way up a berm's height (the wall rises as (out / half width)^2, so about 77% of the way out), a rider still sliding (slide memory) grips as if on flat dirt: understeer carries on and they drift wide up the berm. At the catch line, steering at least 30% into the corner: berm hit (if the slide was hard) and hold: the slide stops (slip x exp(-12 dt)), the bike turns toward the berm's line at 4/s, and it's pressed into the wall (can't take off while held). A rider not sliding locks in as usual. Not steering, or steering the wrong way: no catch, drift out over the top | Ben's 3b playtests. Sliding wide onto a berm steering in (156 runs, 50-70 km/h): caught at 0.61 of the height (0.60-0.63), settles at 0.64 (worst 0.91), over the top 0, crashes 0. Not steering / wrong way: over the top 100% |
| Take-off | only where the ground drops more than 5 mm below where gravity alone would carry the bike in one step | was 0 mm: turning down a berm's banked face made the bike chatter air/ground (56% airborne into one corner) so it couldn't steer. Jump ranges unchanged |
| Suspension travel | 0.55 m (0.40 m if crouched) | |
| Landing decel | 38 m/s^2 | travel used = vi^2 / (2 x 38) / travel |
| Landing outcome | < 0.55 smooth, < 1.0 heavy, < 1.35 small crash, else big crash | lean over 0.4 rad adds penalty |
| Pop | +1.0 + 2.0 x compress (upward m/s) | release in last 4 m of kicker or within 0.15 s of leaving lip. On rollers only right at a crest: 1 m before it to 0.5 m after (checked after the step's move, so a release on the last step before the crest lands just past it) |
| Pump (rollers only) | holding compress down the back of a roller: + 2.5 x g x back slope; up the face: - 0.5 x g x face slope. On a roller set, letting go away from a crest is the pump extending (no hop) | Agreed start was 0.35 g x slope, half on the face: added 1.5-2.5 km/h per set, far short of the target. Now pumping a set matches pedalling at 20-30 km/h and beats it from 40 (pedalling fades): from 30 km/h coast +3 to +10, pump +14 to +21, pedal +14 to +18 km/h over a set. Face cost 1.25 stalled a slow rider holding Space (15 km/h); 0.5 doesn't. Only rollers count, so Flow Monster is unchanged |
| Tree crash | small below 9 m/s (32 km/h), big at or above | below 2.5 m/s you just stop |
| Visual suspension spring | k 170, c 18, 0.18 m max | |

Jump shapes and their declared landing ranges live in `src/jumps.js` and are checked by `tests/jumps.test.js`. The simulator rides the game's own physics, so these are what players get (speed at lip, km/h; "pop" = best pop, released on the last step before the lip):

| Jump | Smooth | Notes |
|---|---|---|
| Normal, stretched (177 m) | 64-88 no pop, 48-68 pop | Ben pops through the start gate from a rolling start: lip at 66-68 km/h, and a pop overshot. Kicker 12 m, gap 8.5 m, landing 38 m. No pop: heavy 60-62, small crash 58, cased below 58. Pop: heavy 44-46 and 70-76, big crash from 82 |
| Normal, stretched (743 m) | 74-90 no pop, 54-78 pop | Ben reaches it at 72-78 km/h and pops it; it overshot at landing 30, 33 and (kicker 12 m) 37 m. Kicker 14 m, gap 9.5 m, landing 44 m. No pop: heavy 68-72, small crash 66, cased below 66. Pop: heavy 50-52 and 80-86 |
| Big, pop optional, stretched (438 m) | 56-74 no pop, 46-62 pop | Ben overshot it with a pop (lip about 56-61 km/h). Kicker 14 m (was 10), lip 1.5 m, gap 8 m (was 8.5), landing 50 m (was 42). No pop touches down at the top of the landing (8-12 m past the lip), a pop at Ben's speeds deep in it (15-22 m; sweet spot ends 23.5 m). No pop: heavy 54 and 76, small crash 52, cased below 52. Pop: heavy 40-44 and 64-66, small crash 68-70, big crash from 72 |
| Big, needs pop, kind `bigPop` (1037 m) | 54-66 pop; no pop cases | Shaped with Ben (tuning rounds 2-4): kicker 12 m, lip 1.8 m, gap 12 m, knuckle 2.4 m, landing 48 m at pitch 0.7. Sweet spot 12.3-30.1 m past the lip. Round 3's 2.2 m lip overshot with a pop at speed; this one is built for a fast pop (lip reachable at about 62 on Flow Monster) |

Jolly Green Giant on the mountain (next 4.0; ridden on the trail itself). No pop, every tabletop is rolled or landed smooth from 14 to 70 km/h; coming up short lands on the deck. All four are the big shape (kicker 12, lip 1.0, deck 7.5, landing 32 at 0.45):

| Tabletop | No pop | Full pop | Flat out, popping |
|---|---|---|---|
| 262 m | clean 14-76 | smooth 42-60, no crash to 64 | 49 |
| 538 m | clean 14-76 | smooth 34-60, no crash to 62 | 44 |
| 952 m | clean 14-76 | smooth 38-68, no crash to 68 | 57 |
| 1212 m | clean 14-76 | smooth 40-64, no crash to 64 | 48 |

| Roller set (pump only: no pop at the crests) | Rolled | Pumping a set from 30 km/h (coast / pump / pedal) |
|---|---|---|
| Pump sets (130, 615, 1290, 1835 m): 3 x 1.2 m, 20 m apart | smooth 20-75 (below about 18 km/h you can't get over one) | +4 to +15 / +24 to +31 / +17 to +21 km/h |
| Whoops (360, 1085, 1540 m): 4 x 1.1 m, 13 m apart, face 0.6 | smooth 20-75 | -5 to +12 / +20 to +29 / +14 to +19 km/h |

Ben (26 Oct): rollers at least double the size (were 0.55-0.6 m, 6.5-10 m apart). At that size a pop at a crest lands in the next roller's face (big crash from about 35-60 km/h) and no reachable speed gaps them, so they're pump-only.

Findings: with 1.5 g in the air and a 3 m/s pop, a crest-to-crest flight lasts about 0.4 s, so rollers 10 m apart can't be gapped at reachable speeds (6.5 m can). A pop at 50 km/h comes down at about -0.45, so a tabletop landing must be that steep and long enough. The mountain drops 290 m, so a 2 km green is -0.14 overall (it coasts to 60-73 km/h on the long traverses); about 2.6-2.9 km would give the old green's -0.10. Corners of an x(d) centreline head straight down the fall line, so they're the steepest bits; grading over 60 m eases them.

Back in Black on the mountain (next 4.0; ranges measured on the trail itself). Every feature is a mandatory gap built from Flow Monster's first-jump shape (kicker 12 m, gap 8.5 m, landing 38 m), with its landing moved down (step-down, drop) or up (step-up):

| Feature | Shape | No pop smooth | Full pop smooth | Covered | Used at (flat-out lip speed) |
|---|---|---|---|---|---|
| Gap | lip 1.1, knuckle 1.0, landing 38 at 0.3 | 64-88 | 50-68 | 50-88 | 171 (60), 364 (61) |
| Step-up | lip 1.4, knuckle 2.0, gap 9, landing 40 at 0.35 | 72-86 | 50-70 | 50-86 | 755 (66), 1150 (68) |
| Step-down | lip 0.9, knuckle -0.6, gap 8, landing 48 at 0.45 | 62-76 | 56-62 | 56-76 | 560 (70) |
| Drop | kicker 10, lip 0.7, knuckle -1, gap 7, landing 44 at 0.55 | 56-70 | 48-56 | 48-70 | 950 (62) |

Too slow: cased (big crash). Findings: on a shared mountain a trail's jump drops come out of its straights (the trail must end at the shared finish level), so black has 6 gaps not 9. Twisty with berms (26 Oct) made it 1339 m, so overall it's now slightly gentler than blue (-0.217 vs -0.226); it's the hardest for its narrow line, tight bermed S-bends and mandatory gaps. The test rider holds 65 km/h between gaps (at 75 it ran wide out of an S-bend into a tree).

Fastest reachable lip speed on Flow Monster (flat out from the trailhead drop-in, pedalling all the way, scripted rider): 177 m about 68, 438 m about 55-59 (kicker 14 m), 743 m about 74-78, 1037 m about 64-66 km/h. So the "pop optional" jump lands without a pop at 52-56 km/h on Flow Monster. These are conservative: Ben has reached the last lip at 66 km/h (scripted rider about 61-63), so leave headroom above them when shaping a jump.

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
- **Deploy concurrency is per job, not per workflow.** With one workflow-level group, the "pull request closed" run (skipped, no preview label) cancelled the publish of PR #11's merge, so main didn't go live. A skipped job never joins a job-level group. Merging a labelled release PR still raced: its "closed" run (a real build) cancelled the push-to-main publish in the same second (#14, #22; the closed run happened to publish main anyway). So a release merged into main skips the closed run; the push publishes.
- **Painted textures must not be `THREE.CanvasTexture`** (25 Oct): on Ben's phone the live game drew the dirt, trunks and fence tape black. A phone drops the WebGL context on a tab or app switch and can wipe hidden canvases; on restore Three.js re-uploads from the canvas, so a wiped one is black. `paintedTexture()` keeps a copy of the pixels.
- **`main.js` ends with `run.resetRun()`** (the start screen's view, at the drop-in). Anything that starts a run on load (arriving through a gate from another trail) must come after it, or it's reset straight back to the drop-in.
- Anything drawn on the ground (tyre tracks) must also wind its triangles to face up, or it is culled and invisible.
- **Scripted riders must ease into turns.** Since drift grows with speed (next 1.3), a test rider that answers every small heading error with full lock drifts at 70-80 km/h (4 m/s of slip up a kicker on Back in Black, landing off the trail into a tree). `tests/helpers/ride.js` leans just enough for the arc to its aim point (lean = atan(2 v^2 sin(error) / distance / g)).
- **Start a test bike already following the slope.** `placeBikeAt` sets no vertical speed; dropped in at speed on a -0.28 slope it flies about 12 m and bottoms out. Set `b.vy` from the slope ahead, as `tools/jump-sim.js` does. (Early berm-hit numbers in PR #10 were measured without this; re-measured in 3b.)
- **On the mountain, everything is per world, not per trail** (next 4.0): tree crash buckets are 5 m squares of the world (`treeCell`), forest and ground are drawn in pieces by distance (`showNear`), the forest floor colour uses the world's seed. A plant is thrown away (still using its random numbers) where another trail is nearer or a clearing is. A new trail on the mountain must start and finish at its clearing gates (`world.test.js` checks it).
- **Mountain ground speed matters.** `WORLD.groundAt` is about 10 us (3 trails); centrelines with shifts or turns are tabulated every 0.25 m, the mountain's hill and each trail's line too. Loading builds about 380k ground triangles and 44k plants (about 2 s on a desktop); per frame it draws about as much as next 3.0 (worst spot 322k plant and ground triangles vs 317k).
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
4. **Jolly Green Giant** (green, done in next 2.0): wide and gentle; pump rollers and gap sets; five tabletops growing toward the bottom; pump mechanic; ride through a gate to switch trails.
5. **Back in Black** (black, done in next 3.0): nine mandatory gaps (gaps, step-downs, a drop, step-ups), no B lines; each declares landing ranges checked against reachable lip speeds.
   - **5b, one mountain** (next 4.0, Ben 25 Oct option B): all three trails in one world from the trailhead to a shared finish clearing; ride through any gate with no reload. Green re-laid as a 2 km switchback traverse, black direct with 7 gaps; FM unchanged.
6. **Scores**: top 10 per trail per split, with trail tabs, fresh start (no v1 scores carried over). (Trail ids changed in step 3: `hardline` became `flow-monster`, so any v2 scores already saved on a device no longer show.)
7. **Hosting** (done for the game: GitHub Pages on every push to main); then consider a shared score backend.
8. **The rest of the mountain** (later): upper mountain (fast and steep) above the mid-mountain trailhead, lower mountain (wide and flowing) below it, Maydena-style. Agreed design (see spec, "The mountain"):
   - three stages, each with a green, blue and black line;
   - lines meet only at trailheads, and are kept at least 40 m apart elsewhere;
   - one stage loaded at a time;
   - rolling starts: each stage's start brings speed into a known band, tested for every incoming x outgoing line;
   - freeride (untimed, any line) and race mode (timed, one colour top to bottom, barricaded course through trailheads).
9. **More bike parks** (Ben, 25 Oct; later): the game can grow to other parks over time. Maydena, Tasmania is the first. Parks are data (`src/parks.js`), each with its trails (later its stages and trailheads); scores will need to be kept per park.

Every new jump or roller feature must declare its expected landing ranges (`landings` in `src/jumps.js`, or on the trail feature if it changes the shape); `tests/jumps.test.js` checks them all.
