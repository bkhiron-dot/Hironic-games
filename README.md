# Hironic Games

Home-made games for the boys (ages 7, 10 and 12). Everything runs in a web browser – no installs, no ads, no accounts.

## Play
Locally:
```sh
python3 -m http.server 8000
```
then open http://localhost:8000.

Online (optional): enable GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root) and the arcade is served at `https://<username>.github.io/Hironic-games/`.

## Games
| Game | Ages | Notes |
|---|---|---|
| ⭐ Star Catcher | 7+ | Sample game – move the basket to catch stars. Template for new games. |

## Make a new game
See [CLAUDE.md](CLAUDE.md#adding-a-game). In short: copy `games/star-catcher`, change `game.js`, add an entry to `games.js`.
