# Hironic Games

A family game studio for the boys (ages 7, 10 and 12). Pick your profile, **create** games, **test** them, publish them, and **play** everyone's games. Everything runs in a web browser: no installs, no ads.

## Run it
```sh
python3 -m http.server 8000
```
Then open http://localhost:8000.

To try it on a phone or tablet, connect it to the same Wi-Fi and open `http://<your-computer's-IP>:8000`.

> **Phase 1 note:** data is saved in each browser only, so profiles and games made on one device don't appear on another yet. Phase 2 adds an online database and a password-protected private link.

## How it works
1. **Landing:** choose who's playing, or create a new player (name, icon, colour, and "about me" questions).
2. **Home:** choose a mode:
   - 🛠️ **Create:** make a game from a template (Catcher or Dodger). Pick the characters, speed, lives and background. It saves as a draft.
   - 🧪 **Test:** play your own drafts (scores aren't saved), then **Publish**.
   - ▶ **Play:** every published game, with author credits, play counts and leaderboards. You can **Remix** someone else's game to make your own version.

## Roadmap
- [x] Phase 1: dashboard, profiles, Game Maker (2 templates), test and publish, leaderboards (stored on each device)
- [ ] Phase 2: online backend (e.g. Supabase), family password, shared library across devices, hosting at a private link
- [ ] Phase 3: online multiplayer
- [ ] More templates (maze, quiz, platformer…) and a Code Lab for hand-written games
