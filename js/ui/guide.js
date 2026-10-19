// "How to play" modal. Built once and kept outside #app, so room updates never reset its scroll position.
import { CARDS } from '../config.js';

const glyphs = CARDS.map((c) => `<span class="g">${c.glyph}</span>`).join(' ');

const BODY = `
  <h3>The goal</h3>
  <p>You play in a team of two. Collect <b>four cards of the same type</b>, then let your partner know. Your partner shouts <b>"Jackpot"</b> for you. Each round you win earns your team the next letter of <b>J-A-C-K-P-O-T</b>. The first team to spell it wins.</p>

  <h3>The cards</h3>
  <p>There are four types: ${glyphs}. Everyone starts with one of each. One player also gets a fifth card, the <b>passing card</b>.</p>

  <h3>Passing</h3>
  <p>Whoever holds five cards passes one to the next player round the table, clockwise. That player now holds five and passes one on, and so on. You have <b>60 seconds</b> to pass, then the server passes for you. Partners never sit next to each other.</p>

  <h3>Winning a round</h3>
  <ul>
    <li>Get four of one type. You can't call it yourself: your <b>partner</b> has to press <b>Jackpot</b> for you.</li>
    <li>If you're still holding the passing card, the call is turned down and nothing happens. Pass first.</li>
    <li>A <b>false call</b> costs the caller a suspicion point. A false call with no points left means they can't call again that round.</li>
  </ul>

  <h3>Telling your partner</h3>
  <p>Before every round your team gets a <b>private 2-minute chat</b>. Agree a secret signal there. Use a new one each round, because the other teams are watching. Once the round starts, the only private line is whatever signal you can slip past everyone. Everyone clicking <b>Ready</b> skips the wait. The public chat is open to the whole room, so anything you post there can be read by your opponents too.</p>
  <p>Once the round is running, tap the <b>＋</b> button at the bottom, then <b>Signal</b>, and pick one of about 200 ordinary gestures, like a blink, a sneeze or a phrase. Your partner always sees it. About one in five are seen <b>only</b> by your partner. The rest are seen by the whole table, and you're never told which was which. Fake signals are allowed, so bluff.</p>

  <h3>Suspicion</h3>
  <ul>
    <li>Each player gets <b>3 suspicion points</b> every round. You can suspect anyone, any time, even your partner.</li>
    <li>You <b>always lose the point</b>, right or wrong.</li>
    <li>The suspected player must show different types of card: <b>2 types</b> if they hold four cards, <b>3 types</b> if they hold five. They have 30 seconds to choose, and what they show is revealed to the room.</li>
    <li>If they can't show enough types, they're <b>caught</b>. Their hand is shown to everyone and they start again with one card of each type. A caught player holding the passing card passes it on first.</li>
  </ul>

  <h3>Ending the game</h3>
  <p>The first team to <b>7 round wins</b> takes the game. Teams can also vote to end early: a team only counts as agreeing when <b>both</b> partners agree, and a majority of teams is needed. At an early end, the most wins takes it, and a tie is a draw.</p>

  <h3>Leaving or losing connection</h3>
  <p>If you lose connection you have <b>90 seconds</b> to come back, and you'll land right where you were. If you leave on purpose, your whole team is out straight away. When only one team is left, it wins by forfeit.</p>

  <h3>Before the game starts</h3>
  <ul>
    <li>You need <b>at least 4 players</b>, which is two teams of two. A 2-minute countdown starts at 4 players.</li>
    <li>Pick your partner with "Ask to team up". Anyone without a partner when the game starts is paired at random, and a leftover player becomes a spectator.</li>
    <li>The host can start early once there are at least two teams and everyone has a partner.</li>
    <li>Send the <b>invite link</b> to bring friends in. Once the game has started, they can only watch.</li>
  </ul>
`;

let overlay = null, lastFocus = null;

export function closeGuide() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', onKey, true);
  // the screen behind may have been redrawn meanwhile, so look the button up again instead of reusing the old node
  const back = document.contains(lastFocus) ? lastFocus : document.querySelector('[data-act="guide"]');
  if (back) back.focus();
}

function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeGuide(); }
  if (e.key === 'Tab' && overlay) { // keep keyboard focus inside the dialog
    const f = [...overlay.querySelectorAll('button, a[href]')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

export function openGuide() {
  if (overlay) return;
  lastFocus = document.activeElement;
  overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <div class="modal-head"><h2 id="guide-title">How to play Jackpot</h2><button class="alt" data-close aria-label="Close">✕</button></div>
    <div class="modal-body">${BODY}</div>
    <div class="modal-foot"><button data-close>Got it</button></div>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeGuide(); });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  overlay.querySelector('[data-close]').focus();
}
