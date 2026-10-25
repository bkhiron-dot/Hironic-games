# Changelog

Two numbers, counted separately (Ben, 25 Oct; see `src/version.js`):

- **main** is the live game the boys play. It goes up by one release at a time.
- **next** is the test version. It goes up with every change merged into it.

A refinement (a trail line, a jump, the physics) is a minor version: 1.1, 1.2 and so on. A new trail or a big new feature is a major version: 2.0.

## next

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
