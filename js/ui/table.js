// Pre-round chat, the table, spectator view and game over.
import { esc, clock } from './dom.js';
import { avatar } from './avatar.js';
import { nameOf } from '../store.js';
import { CARDS, LETTERS } from '../config.js';

const total = (h) => h.reduce((a, b) => a + b, 0);
const countdown = (t) => (t ? `<b data-countdown="${t.endsAt}">${clock(t.endsAt - Date.now())}</b>` : '');
const timerOf = (r, kind, player) => r.timers.find((t) => t.kind === kind && (player === undefined || t.player === player));

function cardChip(type, count) {
  return `<span class="card" title="${CARDS[type].name}">${CARDS[type].glyph}${count > 1 ? `<small>${count}</small>` : ''}</span>`;
}
const handHtml = (hand) => hand.map((c, t) => (c ? cardChip(t, c) : '')).join('') || '<span class="mute">no cards</span>';

function scoreboard(s) {
  const r = s.room, g = r.game;
  const teams = {};
  for (const id of r.order) { const p = r.players[id]; if (p.partner) (teams[p.team] = teams[p.team] || []).push(id); }
  return '<div class="score">' + Object.keys(teams).map((t) => {
    const w = g.wins[t] || 0;
    const letters = [...LETTERS].map((l, i) => `<i class="${i < w ? 'on' : ''}">${l}</i>`).join('');
    const out = teams[t].every((id) => r.players[id].removed);
    return `<div class="team t${t % 5}${out ? ' out' : ''}"><span class="mute">${teams[t].map((id) => esc(nameOf(s, id))).join(' & ')}</span><span class="letters">${letters}</span></div>`;
  }).join('') + '</div>';
}

function seatRing(s, canSuspect) {
  const r = s.room, g = r.game, me = s.me;
  const ring = g.seats.length ? g.seats : r.order;
  const n = ring.length;
  const mi = Math.max(0, ring.indexOf(me));
  const seesAll = Object.keys(g.hands).length > 0 && !r.players[me];
  return `<div class="ring">` + ring.map((id, i) => {
    const p = r.players[id] || {};
    const a = (Math.PI / 2) + ((i - mi + n) % n) * 2 * Math.PI / n;
    const x = 50 + 40 * Math.cos(a), y = 50 + 38 * Math.sin(a);
    const rc = timerOf(r, 'reconnect', id);
    const pending = g.pendingReveals.includes(id);
    const pts = g.points[id];
    const hand = seesAll || id === me ? g.hands[id] || (id === me ? g.hand : null) : null;
    return `<div class="seat t${(p.team || 0) % 5}${id === g.holder ? ' holder' : ''}${p.removed ? ' out' : ''}${id === me ? ' me' : ''}" style="left:${x}%;top:${y}%">
      ${avatar((s.profiles[id] || {}).style, 34)}
      <div class="nm">${esc(nameOf(s, id))}${id === me ? ' (you)' : ''}</div>
      <div class="mute sm">${id === g.holder ? '<span class="warn">passing card</span> ' : ''}${pts !== undefined ? '❤'.repeat(Math.max(0, pts)) || '·' : ''}</div>
      ${p.connected === false ? `<div class="bad sm">offline ${countdown(rc)}</div>` : ''}
      ${pending ? '<div class="warn sm">answering…</div>' : ''}
      ${hand && id !== me ? `<div class="sm">${handHtml(hand)}</div>` : ''}
      ${canSuspect && id !== me && !p.removed ? `<button class="alt sm" data-act="suspect" data-target="${esc(id)}">Suspect</button>` : ''}
    </div>`;
  }).join('') + '</div>';
}

function eventLog(r, n = 6) {
  return `<pre class="log">${esc(r.log.slice(-n).map((l) => l.text).join('\n'))}</pre>`;
}

// Public chat: everyone in the room reads it; only players still in the game post.
function publicChat(s) {
  const r = s.room, mine = r.players[s.me];
  const canPost = mine && !mine.removed;
  const lines = r.pub.slice(-60).map((m) => `<div><b>${esc(nameOf(s, m.from))}</b> ${esc(m.text)}</div>`).join('') || '<div class="mute">Nothing yet.</div>';
  return `<div class="panel pub"><h3>Public chat <span class="tag">everyone in the room reads this</span></h3>
    <div class="chat" data-stick>${lines}</div>
    ${canPost ? `<div class="row"><input id="pub-input" placeholder="say it to the whole room" size="24" maxlength="500" autocomplete="off"><button class="alt" data-act="pubchat">Post</button></div>`
      : '<div class="mute sm">You can read the chat but not post.</div>'}</div>`;
}

function chatPhase(s, ui) {
  const r = s.room, g = r.game, me = s.me;
  const mine = r.players[me];
  const t = timerOf(r, 'chat');
  const msgs = r.chat.map((m) => `<div><b>${esc(nameOf(s, m.from))}</b> ${esc(m.text)}</div>`).join('') || '<div class="mute">Agree a signal with your partner. Only your team sees this chat.</div>';
  return `<section class="panel">
    <div class="row between"><h2>Round ${g.round + (g.round === 0 ? 1 : 0)} starts in ${countdown(t)}</h2><button class="alt" data-act="leave">Leave</button></div>
    ${scoreboard(s)}
    ${mine && !mine.removed ? `<h3>Team chat <span class="tag priv">only your partner sees this</span></h3><div class="chat team">${msgs}</div>
      <div class="row"><input id="chat-input" placeholder="message your partner" size="24" maxlength="500" autocomplete="off"><button data-act="chat">Send</button></div>
      <div class="row" style="margin-top:10px"><button data-act="ready" data-ready="${mine.ready ? 'false' : 'true'}">${mine.ready ? 'Not ready' : 'Ready'}</button>
        <span class="mute">${r.order.filter((id) => r.players[id].ready).length}/${r.order.filter((id) => !r.players[id].removed).length} ready. Everyone ready skips the wait.</span></div>`
      : '<p class="warn">You are watching.</p>'}
    ${eventLog(r, 4)}
  </section>${publicChat(s)}`;
}

function revealPrompt(g, ui, r) {
  if (!g.reveal) return '';
  const t = timerOf(r, 'reveal');
  const sel = ui.sel || [];
  return `<div class="prompt"><b>You are suspected.</b> Show ${g.reveal.required} different type${g.reveal.required > 1 ? 's' : ''} ${countdown(t)}
    <div class="row">${g.reveal.options.map((o) => `<button class="${sel.includes(o) ? '' : 'alt'}" data-act="reveal-toggle" data-card="${o}">${CARDS[o].glyph}</button>`).join('')}
    <button data-act="reveal-send" ${sel.length === g.reveal.required ? '' : 'disabled'}>Show</button></div></div>`;
}

// What people have signalled. Team-only ones are marked: you (the partner) saw them and opponents did not.
function signalFeed(s) {
  const r = s.room;
  const items = r.signals.slice(-8).map((x) => {
    const who = x.from === s.me ? 'You' : esc(nameOf(s, x.from));
    return `<div class="sig${x.scope === 'team' ? ' team' : ''}${x.history ? ' hist' : ''}">${x.scope === 'team' ? '<span title="Only you saw this. The other team did not.">🔒</span> ' : ''}<b>${who}</b> ${esc(x.text)}${x.history ? ' <span class="mute sm">(earlier)</span>' : ''}</div>`;
  }).join('');
  return `<div class="feed"><div class="mute sm">Signals${r.signals.some((x) => x.scope === 'team') ? ' (🔒 = only you saw it)' : ''}</div>${items || '<div class="mute sm">None yet.</div>'}</div>`;
}

function play(s, ui) {
  const r = s.room, g = r.game, me = s.me;
  const mine = r.players[me];
  const spectator = !mine || mine.removed;
  const iHold = !spectator && g.holder === me && total(g.hand) === 5;
  const forced = !spectator && g.forcedPass === me;
  const partner = mine && mine.partner;
  const hold = timerOf(r, 'hold');
  const canAct = !spectator && g.phase === 'playing';
  const revoked = g.proclaimRevoked[me];
  const partnerHolds = partner && g.holder === partner;
  return `<section class="panel">
    <div class="row between"><h2>Round ${g.round}${g.phase === 'playing' ? '' : ' (' + esc(g.phase) + ')'}</h2><button class="alt" data-act="leave">Leave</button></div>
    ${scoreboard(s)}
    ${spectator ? '<p class="warn">You are watching.</p>' : ''}
    ${seatRing(s, canAct)}
    ${hold && g.holder ? `<p class="center">${esc(nameOf(s, g.holder))} must pass within ${countdown(hold)}</p>` : ''}
    ${forced ? `<div class="prompt"><b>You were caught.</b> Pass a card first ${countdown(timerOf(r, 'forced', me))}</div>` : ''}
    ${revealPrompt(g, ui, r)}
    ${signalFeed(s)}
    ${spectator ? '' : `<div class="hand">${handHtml(g.hand)}</div>
      <div class="row">${(iHold || forced) ? g.hand.map((c, t) => (c ? `<button class="alt" data-act="pass" data-card="${t}">Pass ${CARDS[t].glyph}</button>` : '')).join('') : ''}</div>
      <div class="row" style="margin-top:8px">
        <button data-act="proclaim" ${canAct && !revoked && !partnerHolds ? '' : 'disabled'}>Jackpot for ${esc(nameOf(s, partner))}!</button>
        <button class="alt" data-act="signal-palette" ${canAct ? '' : 'disabled'}>Signal</button>
        ${(() => { const yes = Object.values(g.votes).filter(Boolean).length; return `<button class="${g.votes[me] ? '' : 'alt'}" data-act="vote-end" data-agree="${g.votes[me] ? 'false' : 'true'}">${g.votes[me] ? 'Withdraw vote to end' : 'Vote to end'}</button><span class="mute sm">${yes} voted to end</span>`; })()}
        ${revoked ? '<span class="bad sm">no proclaims left this round</span>' : partnerHolds ? '<span class="mute sm">your partner holds the passing card</span>' : ''}
      </div>`}
    ${eventLog(r)}
  </section>${publicChat(s)}`;
}

function over(s) {
  const r = s.room, g = r.game, res = g.result || {};
  const winners = r.order.filter((id) => r.players[id].team === res.winner && r.players[id].partner);
  return `<section class="panel center">
    <h2>${res.draw ? 'Draw' : 'Game over'}</h2>
    ${res.draw ? '' : `<p><b>${winners.map((id) => esc(nameOf(s, id))).join(' & ')}</b> win${res.reason === 'forfeit' ? ' by forfeit' : res.reason === 'agreement' ? ' on most rounds' : ''}.</p>`}
    ${scoreboard(s)}
    ${res.countsForStats === false ? '<p class="mute">This game does not count for the leaderboards.</p>' : ''}
    ${eventLog(r, 5)}
    <button data-act="leave">Back to rooms</button>
  </section>${publicChat(s)}`;
}

// The game is saved and waiting for everyone to come back (after a restart, or everyone dropping at once).
function pausedView(s) {
  const r = s.room, p = r.paused;
  const ids = p.players.filter((id) => r.players[id] && !r.players[id].removed);
  const back = ids.filter((id) => r.players[id].connected).length;
  return `<section class="panel">
    <div class="row between"><h2>Game paused</h2><button class="alt" data-act="leave">Leave</button></div>
    <div class="prompt"><b>Waiting for everyone (${back} of ${ids.length} back).</b>
      <div class="mute sm">The game picks up where it left off once all of you are here. It is given up in <b data-countdown="${p.until}">${clock(p.until - Date.now())}</b>.</div></div>
    <div>${ids.map((id) => `<span class="who">${avatar((s.profiles[id] || {}).style, 28)}<span class="${r.players[id].connected ? 'ok' : 'warn'}">${esc(nameOf(s, id))}${r.players[id].connected ? ' ✓' : ' …'}</span></span>`).join(' ')}</div>
    ${eventLog(r, 4)}
  </section>${publicChat(s)}`;
}

export function table(s, ui) {
  const g = s.room.game;
  if (!g) return '<section class="panel"><p class="mute">Waiting for the game…</p></section>';
  if (s.room.paused && g.phase !== 'over') return pausedView(s);
  if (s.room.phase === 'over' || g.phase === 'over') return over(s);
  if (g.phase === 'waiting') return chatPhase(s, ui);
  return play(s, ui);
}
