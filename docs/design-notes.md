# Design notes

Things to cover when we start the design pass. Nothing here is built yet.

- **Google Analytics.** Add it to the game.
  - start.ng's docs say scripts loaded from other sites trigger warnings at publish time, and CDN scripts are flagged too. Run `POST /games/check` after adding it to see how it is treated; the docs suggest copying third-party scripts into the repo, which does not work for analytics.
  - Decide what to track (rooms created, games started and finished, drop-offs) and whether a consent notice is needed for players.
- **Back to start.ng button.** A visible link from the game to `https://start.ng/`, on every screen, including the table. Make sure it cannot be hit by accident mid-round (leaving the page drops a player from a running game after the reconnect window).
- **start.ng branding.** Show start.ng branding on the game. Open questions: which logo, colours and wording to use, and whether start.ng publishes brand guidelines or assets. Ask before inventing any.
