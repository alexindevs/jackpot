// "How to play" modal. Built once and kept outside #app, so room updates never reset its scroll position.
import { icon } from './icons.js';

const SECTIONS = [
  ['The goal', 'Play in a team of two. Collect <b>four cards of the same type</b>, then let your partner know. Your partner shouts <b>"Jackpot"</b> for you. Each round you win earns your team the next letter of <b>J-A-C-K-P-O-T</b> (<b>J-A-C-K</b> in a short game). The first team to spell it wins.'],
  ['The cards', 'There are four types: circle, triangle, cross and square. Everyone starts with one of each. One player also gets a fifth card, the <b>passing card</b>.'],
  ['Passing', 'Whoever holds five cards passes one to the next player round the table, clockwise. You have <b>60 seconds</b> to pass, then the server passes for you. Partners never sit next to each other.'],
  ['Winning a round', 'Get four of one type. You can\'t call it yourself: your <b>partner</b> has to press <b>Jackpot</b> for you. If you\'re still holding the passing card, the call is turned down and nothing happens. A <b>false call</b> costs the caller a suspicion point. A false call with no points left means they can\'t call again that round.'],
  ['Telling your partner', 'Before every round your team gets a <b>private 2-minute chat</b>. Agree a secret signal there, and use a new one each round. Everyone clicking <b>Ready</b> skips the wait. The public chat is open to the whole room, so opponents can read it. Once the round is running, tap the <b>menu</b> button, then <b>Signal</b>, and pick one of about 200 ordinary gestures. Your partner always sees it. About one in five are seen <b>only</b> by your partner. The rest are seen by the whole table, and you\'re never told which. Fake signals are allowed.'],
  ['Suspicion', 'Each player gets <b>3 suspicion points</b> every round. You can suspect anyone, any time, even your partner, and you <b>always lose the point</b>. The suspect must show different types of card: <b>2 types</b> if they hold four cards, <b>3 types</b> if they hold five. They have 30 seconds, and what they show is revealed to the room. If they can\'t show enough, they\'re <b>caught</b>: their hand is shown and they start again with one card of each type.'],
  ['Ending the game', 'The first team to <b>7 round wins</b> (4 in a short game) takes the game. Teams can also vote to end early: a team only counts as agreeing when <b>both</b> partners agree, and a majority of teams is needed. At an early end, the most wins takes it, and a tie is a draw.'],
  ['Leaving or dropping', 'If you lose connection you have <b>90 seconds</b> to come back, and you\'ll land right where you were. If you leave on purpose, your whole team is out straight away. When only one team is left, it wins by forfeit.'],
  ['Before it starts', 'You need <b>at least 4 players</b>, which is two teams of two. A 2-minute countdown starts at 4 players. Pick your partner with "Ask to team up". Anyone without a partner when the game starts is paired at random, and a leftover player becomes a spectator. The host can start early once there are at least two teams and everyone has a partner. Send the <b>invite link</b> to bring friends in. Once the game has started, they can watch and join the waiting line.'],
];

const BODY = `<div class="how">${SECTIONS.map(([t, b]) => `<section class="glass-row"><h3>${t}</h3><p>${b}</p></section>`).join('')}</div>`;

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
  overlay.innerHTML = `<div class="modal big" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <div class="modal-head"><h2 class="display" id="guide-title">How to play</h2><button class="round" data-close aria-label="Close">${icon.close()}</button></div>
    <div class="modal-body">${BODY}</div>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeGuide(); });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  overlay.querySelector('[data-close]').focus();
}
