# Design notes

What was planned, and where each item stands. Status: **Done**, **Open** (raised, not decided), **Decided** (not built yet), **Idea** (no decision), **Check** (could be a bug or a misunderstanding). Last updated 2 November 2026.

## start.ng

- **Google Analytics.** Open. Not added.
  - start.ng's docs say scripts loaded from other sites trigger warnings at publish time, and CDN scripts are flagged too. Run `POST /games/check` after adding it to see how it is treated; the docs suggest copying third-party scripts into the repo, which does not work for analytics.
  - Decide what to track (rooms created, games started and finished, drop-offs) and whether a consent notice is needed for players.
- **Back to start.ng link.** Done. A "← start.ng" link sits at the bottom right of every screen, the table included. In a running game it asks before leaving, because a player who stays away drops out with their team.
- **start.ng branding.** Done in a small way: the name "start.ng" is on that link and on the sign-in screen. No logo or colours were invented. Open: whether start.ng publishes brand guidelines or assets.
- **Game standards and the check.** Done. A Share-on-X button on the round-end banner and the game-over screens, plus `startng.json` (description, story, categories, controls, how to play). `POST /games/check` passes with no errors or warnings. start.ng republishes after every push to `main` once the check passes, so a push is a deploy.

## Playtest feedback (frontend side)

From the first friends-and-family playtest. The full list, with wording, owners and the backend items, is in the backend repo: [`docs/feedback.md`](https://github.com/alexindevs/jackpot-backend/blob/main/docs/feedback.md). Only the items that land in this repo are listed here, with the same ids.

- **B1 Suspect double-fire.** Done. The Suspect buttons lock from the first tap until the server answers, and the tapped one shows a pending mark.
- **B2 A started room only offers Watch.** Done. A running game now offers Join when the server says it can be joined. Watchers and removed players wait in a line, the first two become a new team between rounds, and the scoreboard gets their row.
- **B5 No play-again or "who's here".** Open. There is no rematch, and a finished room only shows the result. Backend is involved if a rematch should keep the same room and teams.
- **B3 A link problem.** Check. The screenshot is not in the repo and the cause is unknown. One related gap is fixed: an invite link to a paused game now says the game is paused instead of failing silently.
- **B4 No alert when a game starts.** Done. A "Game starting" banner, a sound, and the tab title changes while the tab is hidden.
- **B6 A rejected jackpot call gives no reason.** Done. The caller sees one line: the partner no longer holds four of a kind, plus the points left, or the lockout. The two error toasts say why too.
- **U1 Sound.** Done. Synthesised cues with a mute button and a volume slider. Still open: a sound when a new team joins.
- **U2 Menus are hard to reach and close.** Check. Chat, team, signals, log and menu now open from one bottom button, but it has not been checked with the players.
- **U3 Signals take too long to find in a menu.** Idea. A sidebar, or a few signals on standby chosen before the game, including one agreed with the partner. Backend is involved if standby signals are stored per team.
- **U4 Show signals in the team chat.** Open. A new player knows none of them.
- **U5 Public chat in the lobby.** Open. Needs a server rule change: today the server refuses it before the game starts.
- **U6 More immersion.** Idea. Cards visibly moving, seeing your own card; the iOS Uno game as the reference.
- **G1 The scoreboard is fixed at seven letters.** Done. The creator picks a long game (7 wins, J-A-C-K-P-O-T) or a short one (4 wins, J-A-C-K) when opening the room, and the scoreboard follows `winsToFinish`.
- **G3 Show a jackpot lockout.** Done. A false call at 0 points locks the caller out for 3 minutes. The button shows the countdown, and the lock survives a reload and a pause.
- **G4 Join between rounds.** Done, see B2.
- **G5 Tournaments.** Idea.

## Also done along the way

- A finished game opened from a snapshot shows its winner, now that the snapshot carries the result.
- After a server restart the client finds its paused game and goes back into it. The harness has a Restart test for this.
- The `?server=` override is only honoured on a local page, so a link cannot send a player's session to another server.
