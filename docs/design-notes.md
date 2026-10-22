# Design notes

Things to cover when we start the design pass. Nothing here is built yet.

- **Google Analytics.** Add it to the game.
  - start.ng's docs say scripts loaded from other sites trigger warnings at publish time, and CDN scripts are flagged too. Run `POST /games/check` after adding it to see how it is treated; the docs suggest copying third-party scripts into the repo, which does not work for analytics.
  - Decide what to track (rooms created, games started and finished, drop-offs) and whether a consent notice is needed for players.
- **Back to start.ng button.** A visible link from the game to `https://start.ng/`, on every screen, including the table. Make sure it cannot be hit by accident mid-round (leaving the page drops a player from a running game after the reconnect window).
- **start.ng branding.** Show start.ng branding on the game. Open questions: which logo, colours and wording to use, and whether start.ng publishes brand guidelines or assets. Ask before inventing any.

## Playtest feedback (frontend side)

From the first friends-and-family playtest. The full list, with wording, owners and the backend items, is in the backend repo: [`docs/feedback.md`](https://github.com/alexindevs/jackpot-backend/blob/main/docs/feedback.md). Only the items that land in this repo are listed here, with the same ids. Status: **Open** (raised, not decided), **Decided** (not built yet), **Idea** (no decision), **Check** (could be a bug or a misunderstanding). Nothing below is built yet.

- **B1 Suspect double-fire.** Check. Tapping suspect twice suspects twice: `js/app.js:375` has no lock, and `js/net.js:111` gives every request a fresh key, so two taps are two separate requests. Needs a lock until the server answers, or one key per click.
- **B2, B5 A started room only offers Watch; no play-again or "who's here".** Check / Open. A started room shows "You can watch it instead" (`js/app.js:222-225`). There is no rematch, and the lobby shows only the player list. Backend is involved if a rematch should keep the same room and teams.
- **B3 A link problem.** Check. The screenshot is not in the repo and the cause is unknown.
- **B4 No alert when a game starts.** Open. The server already sends `game_starting` and `chat_started`; the client shows nothing for them (sound, banner or tab title).
- **B6 A rejected jackpot call gives no reason.** Check. The client shows a generic "called Jackpot falsely" popup (`js/app.js:159`); toasts exist only for `proclaim_revoked` and `partner_holds_passing_card` (`js/app.js:23`). It should say why: the partner holds the passing card, no points left, or not four of a kind.
- **U1 Sound.** Open. Asked for by several players; 8-bit was suggested.
- **U2 Menus are hard to reach and close.** Open.
- **U3 Signals take too long to find in a menu.** Idea. A sidebar, or a few signals on standby chosen before the game, including one agreed with the partner. Backend is involved if standby signals are stored per team.
- **U4 Show signals in the team chat.** Open. A new player knows none of them.
- **U5 Public chat in the lobby.** Open. Needs a server rule change: today the server refuses it before the game starts.
- **U6 More immersion.** Idea. Cards visibly moving, seeing your own card; the iOS Uno game as the reference.
- **G1 The scoreboard is fixed at seven letters.** Open. `js/config.js:11` and `js/ui/table.js:75` ignore the server's `winsToFinish`. A shorter game also means choosing which letters (for example J-A-C-K).
- **G3 Show a suspect and jackpot cooldown, if one is adopted.** Open. Backend decides the rule first.
- **G4 Join between rounds.** Decided, not built. Today a started game only offers Watch (`js/app.js:222`).
- **G5 Tournaments.** Idea.
