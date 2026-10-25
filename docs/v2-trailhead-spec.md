# Hardline MTB v2 - Trailhead and three trails

Agreed with Ben on 24 Oct 2026. This is a separate game from v1; v1 scores are not carried over.

## Trailhead

- Level clearing at the top of the hill (50 x 36 m), fenced, cut into the hill with graded banks. The rider starts there at rest.
- A trail map board, and three colour-coded start gates side by side (15 m apart, green / blue / black left to right), each with the trail name on a banner.
- One trail at a time (layout B, agreed 24 Oct): the ridden trail's gate is open; the others are taped off with a "coming soon" board until their trails are built. The gate is the timing start.
- After a run ends (finish, big crash, or R), "Ride again" respawns you at the same trail's gate. A "Trailhead" button returns to the clearing.
- The game is the home page; v1 stays at /v1.html.

## Trails (all about 1.2 km to start with)

### Jolly Green Giant (green)

- Ben (24 Oct): chill, optional jump rollers, progressing to moderate size jumps by the bottom, similar to Flow Monster's first jumps. Keep the pump mechanic.
- Wide (half-width about 4.5-5.5 m), gentle grade, big friendly berms on every real corner.
- Long sets of rollers, no gaps, nothing that can case into a hole (tabletops: a flat deck instead of a gap).
- Ben (24 Oct): the whole trail can be rolled, but fast riders can pop and gap roller pairs. So each roller set declares two ranges: rolled (any speed) and gapped with a pop (from what speed). Both are tested like jump ranges.
- **Pump mechanic** (the point of this trail):
  - Holding compress (Space / Pump button) on the *downslope* (backside) of a roller adds forward speed; holding it on the *upslope* costs a little speed. Releasing on the upslope near the crest gives a small pop.
  - **Popping off a roller** and landing on the next downslope (linking transitions) converts the drop into forward speed instead of losing it: reward a landing where the ground slope matches the trajectory.
  - Expected result: a rider who pumps well can match or beat pedalling speed without touching pedal. Tune and report numbers.
- Suggested starting physics (to tune): pump gain = k x g x |downslope| while compressed, k about 0.35; upslope penalty about half that.
- **As built (next 2.0, 25-26 Oct, overnight; numbers to review with Ben):**
  - 1100 m, half width 4.5-5.5 m, berms 1.8 m from 170 m radius.
  - **Grade -0.10, not the agreed -0.12.** At -0.12 the speeds reached were above what a popped tabletop could land smooth.
  - **Pump rollers:** 4 sets, 0.6 m high, 10 m apart. Rolled smooth at 15-65 km/h. Too far apart to gap: a pop lands on the next face.
  - **Gap sets:** 3 sets, 0.5-0.55 m high, 6.5 m apart, with a longer face. Rolled smooth at 15-65 km/h; a full pop gaps smooth from 55 km/h; slower is heavy, no crash.
  - **Tabletops:** 5, flat deck at lip height, long steep landings (0.42-0.45). No pop is clean at every speed; a full pop lands smooth up to 52-64 km/h, above the flat-out lip speeds.
  - **Pump:** 2.5 x g x back slope; face cost 0.5 x g x slope. Matches pedalling at 20-30 km/h and beats it from 40.
  - **Pop on rollers:** only right at a crest. Elsewhere on a roller set, letting go of Space is just the pump extending.
- **Switching trails:** ride out of the clearing through another built trail's open gate. The game fades, loads that trail's world (`?trail=<id>`), and you carry on from just above its gate at the same speed.

### Flow Monster (blue)

- The v1 track, renamed (Hardline is the name of the game). Ben (24 Oct): keep the jumps as they are; make the berms higher and steeper (step 3b).
- Uses the existing berm, drift and berm-catch physics.

### Back in Black (black) - freeride

- Ben (24 Oct): all mandatory gaps, with a range of gap, step-down and step-up features. No B lines.
- Steeper, narrower trail. Main track surface stays smooth dirt (no rock gardens or roots on the line).
- Every feature needs a simulated sweet range (reachable on the trail) and a test.
- **As built (next 3.0, 26 Oct, overnight; numbers to review with Ben):**
  - **Trail:** 1150 m at grade -0.22, half width 2.2-3.6 m, 2 m berms.
  - **Long straights between open bends (76 m radius or more).** Twistier lines made steep banks beside the trail on this steeper hill and put landings into bends.
  - **Nine mandatory gaps:** 4 gaps, 2 step-downs, 1 drop, 2 step-ups.
  - **Shapes:** all built from Flow Monster's first-jump shape, with the landing moved down or up.
  - **Pop or ride:** each feature has a no-pop window and a pop window that join. Riding flat out you reach every lip at least 6 km/h inside its range: ride the fast ones, pop the slower ones (420, 1040 m and the step-up at 330 m).

## Scores

- Arcade top 10 per trail, with a board per split and the finish (3 splits + finish per trail to start).
- Name entry (up to 10 letters/numbers, uppercase, remembers the last name used).
- Shown on the start screen and whenever a run ends; tabs to switch trail and split.
- Storage: localStorage via a `ScoreStore` interface (`load`, `add`, `top(trail, board)`), so a shared backend can be swapped in later.

## The mountain (Ben, 24 Oct)

- The trails are built as if part of Maydena Bike Park. Today's trailhead and its three trails are the **mid mountain**.
- Later: **upper mountain** (fast and steep) and **lower mountain** (wide and flowing).
- Three stages down the mountain, each with a green, blue and black line. Lines **meet only at trailheads**: a top trailhead, intermediate trailheads between stages, and the finish. No forks or merges mid-stage.
- **One stage loaded at a time**: the next stage loads at an intermediate trailhead, with a short fade (about 0.5 s). This keeps phones fast: one trail is about 140k ground triangles and 11k plants.
- **Lines kept at least 40 m apart**, except where they meet at trailheads. Each trail reshapes the ground 20 m either side, so closer lines would fight over it.
- **Picking a line**: ride through its gate at a trailhead. Riding into another trail's gate switches to that trail (agreed).
- **Rolling through trailheads**: riders keep their speed through an intermediate trailhead into the next stage. Each stage's start uses corners and trail pitch to bring speed into a known band before its first jump, so any incoming line works. Tests ride every combination of incoming and outgoing line (3 x 3 per trailhead) and check the speed at each jump's lip stays inside its declared range.

### Modes

- **Freeride**: untimed, any line at any trailhead.
- **Race**: timed, one colour top to bottom (green-green-green, blue-blue-blue or black-black-black).
  - Splits at each trailhead.
  - Scores per race route and per stage.
- **Race barricades**: in race mode, barricades make a course through each trailhead from the incoming line to the same colour's outgoing gate, like a World Cup or Hardline race. They mix sponsor banners and tape on posts. Sponsors are made up for the game; no real brands.

### Build order

1. 3b: Flow Monster berms.
2. Jolly Green Giant.
3. Back in Black.
4. Scores, built per route and stage.
5. The mountain as data: stages, trailheads, modes and barricades.
6. Upper stage, then lower stage.

## Look and feel

- Style cue: Red Bull Bike Unchained. Our reading (to check with Ben): clean, chunky low-poly shapes, bold kit colours, a modern downhill bike and rider, and lots of dirt. Tyres leave tracks, throw crumbs when rolling and roost when drifting; drifting into a berm is a "berm hit" with an explosion of dirt.

## Open questions for later

- Trail lengths: start equal, maybe lengthen black later.
- Shared online scoreboard once hosted (needs a small backend).
- Ghost rider of the record run.
