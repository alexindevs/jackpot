// The game screens: pre-round team chat, the table, the paused view and the result. Everything here fits one screen
// with no page scrolling. Chat, signals, the log and the menu live in the bottom sheets (see sheets.js).
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

// ---- what the sheets show -------------------------------------------------------------------------------------

export function publicChatLines(s) {
  return s.room.pub.slice(-100).map((m) => `<div><b>${esc(nameOf(s, m.from))}</b> ${esc(m.text)}</div>`).join('') || '<div class="mute">Nothing yet.</div>';
}

export function teamChatLines(s) {
  return s.room.chat.map((m) => `<div><b>${esc(nameOf(s, m.from))}</b> ${esc(m.text)}</div>`).join('') || '<div class="mute">Agree a signal with your partner. Only your team sees this chat.</div>';
}

export function eventLines(s) {
  return s.room.log.slice(-150).map((l) => `<div>${esc(l.text)}</div>`).join('') || '<div class="mute">Nothing yet.</div>';
}

// Team-only signals are marked: you (the partner) saw them and the opponents did not.
export function signalLines(s) {
  return s.room.signals.slice(-100).map((x) => {
    const who = x.from === s.me ? 'You' : esc(nameOf(s, x.from));
    return `<div class="sig${x.scope === 'team' ? ' private' : ''}${x.history ? ' hist' : ''}">${x.scope === 'team' ? '<span title="Only you saw this. The other team did not.">🔒</span> ' : ''}<b>${who}</b> ${esc(x.text)}${x.history ? ' <span class="mute sm">(earlier)</span>' : ''}</div>`;
  }).join('') || '<div class="mute">No signals yet.</div>';
}

// ---- which screen are we on -----------------------------------------------------------------------------------

export function isPlayer(s) {
  const m = s.room && s.room.players[s.me];
  return !!m && !m.removed;
}

export function screenKind(s) {
  const r = s.room;
  if (!r || r.phase === 'lobby') return 'none';
  const g = r.game;
  if (!g) return 'wait';
  if (r.paused && g.phase !== 'over') return 'paused';
  if (r.phase === 'over' || g.phase === 'over') return 'over';
  return g.phase === 'waiting' ? 'chat' : 'play';
}

// ---- pieces ---------------------------------------------------------------------------------------------------

// A team's name for popups and banners: "ka & kb"
export function teamNames(s, team) {
  const r = s.room;
  return r.order.filter((id) => r.players[id].team === team && r.players[id].partner).map((id) => nameOf(s, id)).join(' & ');
}

export function myTeam(s) {
  const m = s.room && s.room.players[s.me];
  return m && m.partner ? m.team : null;
}

function scoreboard(s) {
  const r = s.room, g = r.game;
  const teams = {};
  for (const id of r.order) { const p = r.players[id]; if (p.partner) (teams[p.team] = teams[p.team] || []).push(id); }
  return '<div class="score">' + Object.keys(teams).map((t) => {
    const w = g.wins[t] || 0;
    const letters = [...LETTERS.slice(0, g.winsToFinish)].map((l, i) => `<i class="${i < w ? 'on' : ''}">${l}</i>`).join('');
    const out = teams[t].every((id) => r.players[id].removed);
    return `<div class="score-team t${t % 5}${out ? ' out' : ''}"><span class="nm">${teams[t].map((id) => esc(nameOf(s, id))).join(' & ')}</span><span class="letters">${letters}</span></div>`;
  }).join('') + '</div>';
}

function topbar(s, ui, title) {
  const bad = ui.status !== 'open';
  return `<div class="topbar"><span class="rnd">${title}</span>${bad ? `<span class="conn warn">● ${ui.status === 'waiting' ? 'reconnecting…' : 'offline'}</span>` : ''}</div>`;
}

function seatRing(s, canSuspect, suspecting) {
  const r = s.room, g = r.game, me = s.me;
  const ring = g.seats.length ? g.seats : r.order;
  const n = ring.length;
  const mi = Math.max(0, ring.indexOf(me));
  const seesAll = Object.keys(g.hands).length > 0 && !r.players[me];
  const hold = timerOf(r, 'hold');
  const centre = g.holder
    ? `<div class="centre"><div class="mute sm">${esc(nameOf(s, g.holder))} holds the passing card</div>${hold ? `<div class="big">${countdown(hold)}</div>` : ''}</div>`
    : '';
  return `<div class="ring">${centre}` + ring.map((id, i) => {
    const p = r.players[id] || {};
    const a = (Math.PI / 2) + ((i - mi + n) % n) * 2 * Math.PI / n;
    const x = 50 + 38 * Math.cos(a), y = 50 + 40 * Math.sin(a);
    const rc = timerOf(r, 'reconnect', id);
    const pending = g.pendingReveals.includes(id);
    const pts = g.points[id];
    const hand = seesAll || id === me ? g.hands[id] || (id === me ? g.hand : null) : null;
    return `<div class="seat t${(p.team || 0) % 5}${id === g.holder ? ' holder' : ''}${p.removed ? ' out' : ''}${id === me ? ' me' : ''}" style="left:${x}%;top:${y}%">
      ${avatar((s.profiles[id] || {}).style, 32)}
      <div class="nm">${esc(nameOf(s, id))}${id === me ? ' (you)' : ''}</div>
      <div class="mute sm">${pts !== undefined ? '❤'.repeat(Math.max(0, pts)) || '·' : ''}</div>
      ${p.connected === false ? `<div class="bad sm">offline ${countdown(rc)}</div>` : ''}
      ${pending ? '<div class="warn sm">answering…</div>' : ''}
      ${hand && id !== me ? `<div class="sm">${handHtml(hand)}</div>` : ''}
      ${canSuspect && id !== me && !p.removed ? `<button class="alt sm" data-act="suspect" data-target="${esc(id)}"${suspecting ? ' disabled' : ''}>${suspecting === id ? '…' : 'Suspect'}</button>` : ''}
    </div>`;
  }).join('') + '</div>';
}

function revealPrompt(g, ui, r) {
  if (!g.reveal) return '';
  const t = timerOf(r, 'reveal');
  const sel = ui.sel || [];
  return `<div class="prompt"><b>You are suspected.</b> Show ${g.reveal.required} different type${g.reveal.required > 1 ? 's' : ''} ${countdown(t)}
    <div class="row">${g.reveal.options.map((o) => `<button class="${sel.includes(o) ? '' : 'alt'}" data-act="reveal-toggle" data-card="${o}">${CARDS[o].glyph}</button>`).join('')}
    <button data-act="reveal-send" ${sel.length === g.reveal.required ? '' : 'disabled'}>Show</button></div></div>`;
}

// ---- the screens ----------------------------------------------------------------------------------------------

function play(s, ui) {
  const r = s.room, g = r.game, me = s.me;
  const mine = r.players[me];
  const spectator = !isPlayer(s);
  const iHold = !spectator && g.holder === me && total(g.hand) === 5;
  const forced = !spectator && g.forcedPass === me;
  const partner = mine && mine.partner;
  const canAct = !spectator && g.phase === 'playing';
  const revoked = g.proclaimRevoked[me];
  const partnerHolds = partner && g.holder === partner;
  const hint = partnerHolds ? 'Your partner holds the passing card, so they cannot win yet.'
    : iHold ? 'You hold the passing card: pass one card.'
    : '';
  return `<div class="stage">
    ${topbar(s, ui, `Round ${g.round}`)}
    ${scoreboard(s)}
    <div class="mid">${seatRing(s, canAct, ui.suspecting)}</div>
    <div class="controls">
      ${spectator ? '<div class="mute center sm">You are watching</div>' : `
        ${forced ? `<div class="prompt"><b>You were caught.</b> Pass a card first ${countdown(timerOf(r, 'forced', me))}</div>` : ''}
        ${revealPrompt(g, ui, r)}
        <div class="hand">${handHtml(g.hand)}</div>
        <div class="row center">${(iHold || forced) ? g.hand.map((c, t) => (c ? `<button class="alt" data-act="pass" data-card="${t}">Pass ${CARDS[t].glyph}</button>` : '')).join('') : `<span class="mute sm">${esc(hint) || '&nbsp;'}</span>`}</div>
        <button class="wide" data-act="proclaim" ${canAct && !revoked && !partnerHolds ? '' : 'disabled'}>${revoked ? `Jackpot locked ${countdown(timerOf(r, 'proclaim', me))}` : `Jackpot for ${esc(nameOf(s, partner))}!`}</button>`}
    </div>
  </div>`;
}

function chatPhase(s, ui) {
  const r = s.room, g = r.game;
  const mine = r.players[s.me];
  const t = timerOf(r, 'chat');
  const ready = r.order.filter((id) => r.players[id].ready).length, here = r.order.filter((id) => !r.players[id].removed).length;
  return `<div class="stage">
    ${topbar(s, ui, `Round ${g.round + (g.round === 0 ? 1 : 0)} starts in ${countdown(t)}`)}
    ${scoreboard(s)}
    ${isPlayer(s) ? `<div class="teampane">
      <h3>Team chat <span class="tag priv">only your partner sees this</span></h3>
      <div class="chat private" id="team-list" data-stick>${teamChatLines(s)}</div>
      <div class="row nowrap"><input id="chat-input" placeholder="message your partner" maxlength="500" autocomplete="off"><button data-act="chat">Send</button></div>
      <div class="row between"><span class="mute sm">${ready}/${here} ready. Everyone ready skips the wait.</span>
        <button data-act="ready" data-ready="${mine.ready ? 'false' : 'true'}">${mine.ready ? 'Not ready' : 'Ready'}</button></div>
    </div>` : '<div class="teampane"><p class="mute center">The teams are agreeing their signals. You are watching.</p></div>'}
  </div>`;
}

function over(s, ui) {
  const r = s.room, g = r.game, res = g.result || {};
  const winners = res.draw ? '' : teamNames(s, res.winner);
  const mt = myTeam(s);
  const won = !res.draw && mt !== null && mt === res.winner;
  const how = res.reason === 'forfeit' ? ' by forfeit' : res.reason === 'agreement' ? ' on most rounds' : '';
  return `<div class="stage">
    ${topbar(s, ui, 'Game over')}
    <div class="resultbox">
      <h2>${res.draw ? 'It is a draw' : won ? 'Well done, you won!' : isPlayer(s) ? 'You lost this one' : 'Game over'}</h2>
      ${res.draw ? '' : `<p><b>${esc(winners)}</b> win${how}.</p>`}
      ${scoreboard(s)}
      ${res.countsForStats === false ? '<p class="mute sm">This game does not count for the leaderboards.</p>' : ''}
      <button data-act="leave">Back to rooms</button>
    </div>
  </div>`;
}

// The game is saved and waiting for everyone to come back (after a restart, or everyone dropping at once).
function pausedView(s, ui) {
  const r = s.room, p = r.paused;
  const ids = p.players.filter((id) => r.players[id] && !r.players[id].removed);
  const back = ids.filter((id) => r.players[id].connected).length;
  return `<div class="stage">
    ${topbar(s, ui, 'Game paused')}
    <div class="resultbox">
      <div class="prompt"><b>Waiting for everyone (${back} of ${ids.length} back).</b>
        <div class="mute sm">The game picks up where it left off once all of you are here. It is given up in <b data-countdown="${p.until}">${clock(p.until - Date.now())}</b>.</div></div>
      <div>${ids.map((id) => `<span class="who">${avatar((s.profiles[id] || {}).style, 28)}<span class="${r.players[id].connected ? 'ok' : 'warn'}">${esc(nameOf(s, id))}${r.players[id].connected ? ' ✓' : ' …'}</span></span>`).join(' ')}</div>
    </div>
  </div>`;
}

export function table(s, ui) {
  const kind = screenKind(s);
  if (kind === 'wait') return '<div class="stage"><p class="mute center">Waiting for the game…</p></div>';
  if (kind === 'paused') return pausedView(s, ui);
  if (kind === 'over') return over(s, ui);
  if (kind === 'chat') return chatPhase(s, ui);
  return play(s, ui);
}
