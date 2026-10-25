# Changelog

Two numbers, counted separately (Ben, 25 Oct; see `src/version.js`):

- **main** is the live game the boys play. It goes up by one release at a time.
- **next** is the test version. It goes up with every change merged into it.

A refinement (a trail line, a jump, the physics) is a minor version: 1.1, 1.2 and so on. A new trail or a big new feature is a major version: 2.0.

## next

- **4.0**: one mountain with all three trails.
  - Riding through a gate is seamless, on every trail: no reload, no fade. The trail you ride out through is your run.
  - All three trails finish in a shared finish clearing at the bottom.
  - Jolly Green Giant re-laid: 2.0 km of long traverses and switchbacks out to the west, about -0.14 overall. Rollers and four tabletops placed on the traverses.
  - Back in Black re-laid: 1.23 km, nearly straight down to the east. Seven mandatory gaps (a drop, a step-down, three gaps, two step-ups).
  - Flow Monster is unchanged.
  - High scores have a section for each trail (green, blue, black), each with its splits and finish. The board opens on the trail you're riding.
  - The forest and the ground are drawn in pieces near the rider, so the phone draws about as much as before.
- **3.0**: Back in Black, the black trail.
  - 1.15 km, steeper (-0.22) and narrower.
  - Nine mandatory gaps: gaps, step-downs, a drop and step-ups. Ride them fast, or pop them if you're slower; too slow and you case.
  - Its gate at the trailhead is open.
- **2.0**: Jolly Green Giant, the green trail.
  - 1.1 km, wide and gentle.
  - Pump rollers, gap sets you can pop, and five tabletops growing toward the bottom.
  - Pump on rollers: hold Space down the backs.
  - Ride out through another open gate at the trailhead to switch trail.
  - The jump simulator rides each trail's jumps on that trail's grade.
- **1.3**
  - Drift grows with speed and steering: none below 20 km/h, full from 50 km/h. It used to be strongest at low speed.
  - A rider gripping on a berm gets its full support, so a fast mid-line through a wide berm (like the final one) doesn't drift.
- **1.2**
  - Start screen shows the game's name, the producer (Hironic Games), the park (Maydena Bike Park, Tasmania) and the version.
  - Bike parks added as data, so more parks can be added later.
  - How-to-ride text updated for the new jumps and berms.
- **1.1**: fix for black dirt, trunks and fence tape on phones. Painted textures are kept as pixels, so they survive the phone dropping the 3D graphics when you switch tabs or apps.
- **1.0**: the same game as main 1.0 (released 25 Oct).

## main

- **2.0**: next 2.0 and 3.0.
  - Two new trails: Jolly Green Giant (green: rollers, pumping, tabletops) and Back in Black (black: nine mandatory gaps).
  - Ride through a gate at the trailhead to switch trail.
- **1.2** (release PR #24): next 1.2-1.3.
  - Start screen with the name, the producer, the park and the version.
  - Drift grows with speed (none below 20 km/h).
  - A fast mid-line through a wide berm grips.
  - A merged release no longer cancels its own publish.
- **1.1**: fix for black dirt, trunks and fence tape on phones (next 1.1).
- **1.0** (25 Oct, release PR #14): the first numbered release. Everything before it was unnumbered: the original v1, the modular rebuild, and the trailhead.
  - Flow Monster's berms are higher (2.2 m) and on more corners.
  - Berms:
    - A drift is caught 60% of the way up the berm.
    - Steering into the corner holds you there. Not steering, or steering the wrong way, takes you over the top.
    - After a berm hit the tyres grip again and the bike rails the berm.
  - Drifting costs a little speed (1-2.5 km/h a corner).
  - Hard cornering drifts more.
  - The first jump, the jump before split 2 and the jump before split 3 are longer, so a pop at speed lands deep on the landing instead of overshooting.
