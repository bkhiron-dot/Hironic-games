# Hardline MTB v2 - Trailhead and three trails

Agreed with Ben on 24 Oct 2026. This is a separate game from v1; v1 scores are not carried over.

## Trailhead

- Flat clearing at the top of the hill, rider spawns there at walking pace.
- A trail map board, and three colour-coded start gates side by side, each with the trail name on a banner.
- Riding through a gate selects that trail and starts its clock. The gate is the timing start.
- After a run ends (finish, big crash, or R), "Ride again" respawns you at the same trail's gate. A "Trailhead" button returns to the clearing.

## Trails (all about 1.2 km to start with)

### Jolly Green Giant (green)

- Wide (half-width about 4.5-5.5 m), gentle grade, big friendly berms on every real corner.
- Long sets of rollers, no gaps, nothing that can case into a hole.
- **Pump mechanic** (the point of this trail):
  - Holding compress (Space / Pump button) on the *downslope* (backside) of a roller adds forward speed; holding it on the *upslope* costs a little speed. Releasing on the upslope near the crest gives a small pop.
  - **Popping off a roller** and landing on the next downslope (linking transitions) converts the drop into forward speed instead of losing it: reward a landing where the ground slope matches the trajectory.
  - Expected result: a rider who pumps well can match or beat pedalling speed without touching pedal. Tune and report numbers.
- Suggested starting physics (to tune): pump gain = k x g x |downslope| while compressed, k about 0.35; upslope penalty about half that.

### Flow Monster (blue)

- Mid width and grade, linked berms in rhythm sections, tabletop jumps.
- Tabletops: short of the landing you land on the flat deck (heavy at worst, never a big crash). Sweet spot on the downslope.
- Uses the existing berm, drift and berm-catch physics.

### Back in Black (black) - freeride

- Steeper, narrower main trail. Main track surface stays smooth dirt (no rock gardens or roots on the line).
- **A/B forks** at each big feature:
  - Signs at the fork: "A" (black diamond, gaps, pop jumps, drops) and "B" (rollable line around or over the feature).
  - The A line is faster when landed; the B line is safe but slower. Lines merge back after the feature.
  - Freeride features on A lines: step-down gaps, big pop jumps (reuse the pop mechanic), a drop to a steep landing.
- Every A-line feature needs a simulated sweet range and a test.

## Scores

- Arcade top 10 per trail, with a board per split and the finish (3 splits + finish per trail to start).
- Name entry (up to 10 letters/numbers, uppercase, remembers the last name used).
- Shown on the start screen and whenever a run ends; tabs to switch trail and split.
- A and B line runs on Back in Black share the same boards.
- Storage: localStorage via a `ScoreStore` interface (`load`, `add`, `top(trail, board)`), so a shared backend can be swapped in later.

## Open questions for later

- Trail lengths: start equal, maybe lengthen black later.
- Shared online scoreboard once hosted (needs a small backend).
- Ghost rider of the record run.
