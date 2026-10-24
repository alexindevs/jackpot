# jackpot

A card game for 2 to 5 teams of two. This is the browser client: plain HTML, CSS and ES modules, no build step.

## Files

- `index.html`, `js/`, `css/`: the game client (sign-in, rooms, lobby, team chat, table, public chat, game over)
- `dev/index.html`: multi-seat harness. One tab drives 2 to 10 dev players against one server.
- `sound/index.html`: sound test page, one button per cue (`js/sound.js` synthesises them; no audio files)
- `probe/index.html`: start.ng connectivity check (identity, session, WebSocket, page policy)
- `js/config.js`: the server address. Override per page load with `?server=wss://host/ws`.

## Run it locally

Start the server in dev mode, then serve this folder with any static server:

    JACKPOT_DEV=1 JACKPOT_ADDR=127.0.0.1:8080 go run ./cmd/server    # in the backend repo
    python3 -m http.server 3000                                      # in this repo

- Client as a dev player: `http://localhost:3000/?dev=alice`
- Harness: `http://localhost:3000/dev/` (press "Connect all", then "Scenario" to start a game with four seats)

`?dev=<name>` signs in as `dev:<name>`, which only a dev-mode server accepts. On start.ng the client uses the player's real session.

## Publishing

Publishing is static: push to the public repo, then `POST https://api.start.ng/games/check` and `/games/publish`.
