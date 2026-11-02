# Developing Jackpot

Notes for whoever works on the code. They live here, and not in the README, because start.ng shows the README on the game's About page. Keep the README about the game only, with nothing about code.

The game client is plain HTML, CSS and ES modules, with no build step. A card game for 2 to 5 teams of two.

## Files

- `index.html`, `js/`, `css/`: the game client (sign-in, rooms, lobby, team chat, table, public chat, game over)
- `dev/index.html`: multi-seat harness. One tab drives 2 to 10 dev players against one server. Local only: not tracked, so it is not published.
- `sound/index.html`: sound test page, one button per cue (`js/sound.js` synthesises them; no audio files). Local only: not tracked, so it is not published.
- `probe/index.html`: start.ng connectivity check (identity, session, WebSocket, page policy). Local only, like `dev/`.
- `startng.json`: what start.ng shows on the game's own page (description, categories, controls, how to play). Field names and limits are in https://start.ng/docs.md.
- `js/config.js`: the server address. Override per page load with `?server=wss://host/ws`, on a local page only (`?dev=` too).

## Run it locally

Start the server in dev mode, then serve this folder with any static server:

    JACKPOT_DEV=1 JACKPOT_ADDR=127.0.0.1:8080 go run ./cmd/server    # in the backend repo
    python3 -m http.server 3000                                      # in this repo

- Client as a dev player: `http://localhost:3000/?dev=alice`
- Harness: `http://localhost:3000/dev/` (press "Connect all", then "Scenario" to start a game with four seats)
- Restart test: start the server with `DATABASE_URL` set (Postgres), open the harness and press "Restart test". It sets up a game (with a locked-out player) and a lobby, then asks you to stop and start the server. Every fake player reconnects, lists `my_games` and resumes; the log says whether the game and the lobby come back paused and then resumed.

`?dev=<name>` signs in as `dev:<name>`, which only a dev-mode server accepts. On start.ng the client uses the player's real session.

## Publishing

Publishing is static: push to the public repo, then `POST https://api.start.ng/games/check` and `/games/publish`. Once a game is live, start.ng republishes after every push to `main` that passes the check, and a republish does not delete files that were removed from the repo.
