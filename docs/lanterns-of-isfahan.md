# The Lanterns of Isfahan (prototype)

A gentle first-person puzzle adventure for Ben's mum (80; likes word and puzzle games), separate from the MTB game.
Isfahan, 1150, at dusk: solve five puzzles to light five lanterns, then the palace's great lantern.

- **File:** `public/persian/index.html`, one self-contained page (Three.js r128 from cdnjs, no build step).
  Vite copies it as-is, so a deploy serves it at `/persian/`. Locally: `npm run dev`, then `/persian/index.html`.
- **Look:** original low-poly Persian city (pointed arches, turquoise tiled domes, bazaar awnings, a caravanserai, a char-bagh garden).
  It is not a copy of any existing game's characters or art.

## Agreed with Ben (14 Nov)

| Question | Choice |
|---|---|
| Movement | Tap to move: big buttons ("Talk to Hasan", "Walk to the Spice Bazaar"); the camera glides between five spots. Drag to look around (eases back after 5 s). Tapping a person also works. |
| Puzzle types | Word puzzles, riddles, pattern / tiles |
| Help | No timers or fail states. Three hints per puzzle, then "Solve it for me". Text 20 px (24 px with A+). Progress saved on the phone (localStorage). |
| Hosting | This repo (own folder) and a claude.ai artifact link for quick phone testing |

## The five puzzles

| # | Place | Person | Puzzle | Answer |
|---|---|---|---|---|
| 1 | The City Gate | Hasan, gatekeeper | Riddle, pick 1 of 4 | A map |
| 2 | The Spice Bazaar | Maryam, spice merchant | Spell the spice from 7 letter tiles | SAFFRON |
| 3 | The Tile Workshop | Reza, tile maker | Turn 8 mosaic tiles (tap = quarter turn) until the star pattern is whole; 15 taps if perfect | - |
| 4 | The Caravanserai | Farhad, old traveller | Riddle, spell the answer from 8 tiles (3 spare) | TOWEL |
| 5 | The Palace Garden | Shirin, gardener | Word search, 6 x 6: tap first then last letter | ROSE, FIG, MINT, POOL |

Hints: word puzzles reveal the first letter, then all but the last two; the riddle removes two wrong answers;
the mosaic shows the finished picture, then turns all but two tiles; the word search highlights a first letter, then finds a word.

## Checked

Played start to finish in headless Chromium at iPhone 13 size (390 x 664): every puzzle solved by tapping, wrong answers handled, the ending,
and the save (`{"at":4,"solved":[true x5],"finished":true}`). Not yet checked: frame rate on a real phone (about 400 simple meshes, 6 point lights).
