# Hardline MTB

A browser-based, third-person downhill mountain bike game built with Three.js. Inspired by Red Bull Hardline, set in Maydena-style Tasmanian rainforest (tall pale eucalypts, tree ferns, dark loamy dirt).

Built by Ben with his three boys, partly as a way for them to learn coding. Keep code readable: plain names, short functions, comments that explain the *why* in plain English. The physics should feel lifelike but stay simple.

## Working with Ben

- Plain English, concise, evidence-based. Show numbers when tuning (speeds, ranges, thresholds).
- Flag any assumption or approximation clearly and agree it before building on it.
- Prefer small, reviewable commits. Run `npm test` before every commit.
- When changing physics or a jump, re-run the jump simulator and report the new landing ranges as a table (speed at lip -> smooth / heavy / small crash / big crash).

## Commands

- `npm install` then `npm run dev` - local dev server (Vite). The v1 game is playable at `/v1.html`.
- `npm test` - physics and jump-range tests (Node's built-in test runner, no extra deps).
- `npm run build` - production build into `dist/`.

## Repository layout

- `public/v1.html` - **reference build**: the complete v1 game in one file, exactly as it was when ported from claude.ai. Treat it as the behavioural spec. Do not edit it; copy logic out of it into `src/`.
- `src/` - the modular v2 game (to be created, see Roadmap).
- `tools/jump-sim.js` - straight-line jump simulator shared by tests and tuning.
- `tests/` - `node:test` tests.
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

- `s` = distance down the track (m), `off` = lateral offset from the centreline (m, +x side positive).
- World: `x = cx(s) + off`, `z = -s`, `y = ground(s, off)`. Rider travels toward -z.
- Heading `h`: forward vector `(sin h, 0, -cos h)`; right vector `(cos h, 0, sin h)`. Bike `rotation.y = -h`, rotation order `YXZ`.
- Centreline `cx(s) = 22 sin(s/45) + 8 sin(s/23 + 1)`; curvature uses the proper formula `cx'' / (1 + cx'^2)^1.5`.
- Base grade about -0.2 (11 degrees) with a 7 m sine undulation and a steeper chute at 500-580 m.

## Tuned physics (keep these unless Ben agrees a change)

| Item | Value | Notes |
|---|---|---|
| Ground gravity | 9.8 m/s^2 | |
| Air gravity | 15 m/s^2 | Deliberately 1.5 g for snappier, shorter jumps |
| Rolling + drag | 0.12 + 0.0045 v^2 | Terminal about 75 km/h on base grade |
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

Jump profiles live in `tools/jump-sim.js` and are pinned by tests. Current tuned ranges (speed at lip, km/h):

| Jump | Smooth | Notes |
|---|---|---|
| Normal (170 m, 690 m) | 46-68 no pop | lip 1.1 m, gap 6 m |
| Big, needs pop (960 m) | 52-64 with full pop | lip 1.5 m, gap 12 m; cases without pop below about 66 |
| Big, pop optional (410 m) | 52-66 no pop, 46-54 full pop | lip 1.5 m, gap 9 m, 42 m landing |

## Known gotchas (learned the hard way)

- Terrain triangle winding must give upward normals (`a, b, d, b, e, d`), or the ground is back-face culled and invisible.
- `InstancedMesh` needs `frustumCulled = false` (r128 culls on the base geometry's bounds); visibility is managed by distance chunks instead.
- Hex colours are used as-is (no sRGB output encoding).
- The game must keep working at phone width with touch controls; no `alert`/`prompt`; text input must not trigger game keys.
- The v1 shared scoreboard used the claude.ai artifact database (`window.claude.use('db')`). That does not exist outside claude.ai. v2 uses localStorage behind a small storage interface so a shared backend can be added later.

## Roadmap for v2 (do these in order, one PR-sized step each)

1. **Scaffold**: Vite + `three` from npm. Split v1 into ES modules (`terrain`, `trail`, `forest`, `bike`, `rider`, `physics`, `camera`, `hud`, `input`, `scores`, `main`). Behaviour must match `public/v1.html`. Tests pass.
2. **Trail as data**: replace hard-coded globals with a `Trail` definition (centreline, width function, features list: jumps, berms, rollers, splits). v1's track becomes the first `Trail`. Physics and mesh read only from the `Trail`.
3. **Trailhead**: see spec. Three start gates; riding through one selects that trail.
4. **Jolly Green Giant** (green): rollers + pump mechanic.
5. **Flow Monster** (blue): linked berms + tabletops.
6. **Back in Black** (black): freeride, A/B lines.
7. **Scores**: top 10 per trail per split, fresh start (no v1 scores carried over).
8. **Hosting**: GitHub Pages (or similar) so the boys can play on phones; then consider a shared score backend.

Every new jump or roller feature must declare its expected landing ranges and get a test in `tests/`.
