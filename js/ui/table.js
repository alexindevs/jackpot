// The game screens: pre-round team chat, the table, the paused view and the result. Everything here fits one screen
// with no page scrolling. Chat, signals, the log and the menu live in the sheets (see sheets.js).
import { esc, clock } from './dom.js';
import { face } from './avatar.js';
import { nameOf, isBot } from '../store.js';
import { tag, letters, hearts, card, handCards, passChip, teamSlot } from './parts.js';
import { icon } from './icons.js';
import { shareButton } from './share.js';

const total = (h) => h.reduce((a, b) => a + b, 0);
const countdown = (t) => (t ? `<b data-countdown="${t.endsAt}">${clock(t.endsAt - Date.now())}</b>` : '');
const timerOf = (r, kind, player) => r.timers.find((t) => t.kind === kind && (player === undefined || t.player === player));
const styleOf = (s, id) => (s.profiles[id] || {}).style;
const teamOfId = (s, id) => { const p = s.room && s.room.players[id]; return p && p.partner ? teamSlot(s, p.team) : undefined; };

// ---- what the sheets show -------------------------------------------------------------------------------------

const botTag = (s, id) => (isBot(s, id) ? ' <span class="tag bot">bot</span>' : '');

// One chat line: your own on the right in orange, everyone else on the left with their face.
function bubble(s, m) {
  const mine = m.from === s.me;
  const pic = face(styleOf(s, m.from), 30, teamOfId(s, m.from));
  return `<div class="msg${mine ? ' me' : ''}">${mine ? '' : pic}<div class="bubble"><b>${esc(nameOf(s, m.from))}</b>${botTag(s, m.from)}<span>${esc(m.text)}</span></div>${mine ? pic : ''}</div>`;
}
export const publicChatLines = (s) => s.room.pub.slice(-100).map((m) => bubble(s, m)).join('') || '<div class="mute">Nothing yet.</div>';
export const teamChatLines = (s) => s.room.chat.map((m) => bubble(s, m)).join('') || '<div class="mute">Agree a signal with your partner. Only your team sees this chat.</div>';
export const eventLines = (s) => s.room.log.slice(-150).map((l) => `<div class="evt">${esc(l.text)}</div>`).join('') || '<div class="mute">Nothing yet.</div>';

// Team-only signals are marked: you (the partner) saw them and the opponents did not.
export function signalLines(s) {
  return s.room.signals.slice(-100).map((x) => {
    const who = x.from === s.me ? 'You' : esc(nameOf(s, x.from));
    return `<div class="evt sig${x.scope === 'team' ? ' private' : ''}${x.history ? ' hist' : ''}">${x.scope === 'team' ? `<span title="Only you saw this. The other team did not.">${icon.lock(14)}</span> ` : ''}<b>${who}</b> ${esc(x.text)}${x.history ? ' <span class="mute sm">(earlier)</span>' : ''}</div>`;
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
  // the finished game lists every team's members, even people who left since; before that, everyone still on the team
  const roster = r.game && r.game.result && r.game.result.teams && r.game.result.teams[team];
  if (roster) return roster.map((id) => nameOf(s, id)).join(' & ');
  return r.order.filter((id) => r.players[id].team === team).map((id) => nameOf(s, id)).join(' & ');
}

export function myTeam(s) {
  const m = s.room && s.room.players[s.me];
  return m && m.partner ? m.team : null;
}

export function scoreboard(s) {
  const r = s.room, g = r.game;
  const teams = {};
  const roster = g.phase === 'over' && g.result && g.result.teams;
  if (roster) for (const [t, ids] of Object.entries(roster)) teams[t] = ids; // the whole game, as it ended
  else for (const id of r.order) { const p = r.players[id]; if (p.partner) (teams[p.team] = teams[p.team] || []).push(id); }
  // a removed player who came back on a new team leaves their old partner alone in the old row: drop it
  const many = Object.keys(teams).length > 3;
  return `<div class="score${many ? ' many' : ''}">` + Object.keys(teams).filter((t) => teams[t].length > 1).map((t) => {
    const out = teams[t].every((id) => !r.players[id] || r.players[id].removed);
    const mine = myTeam(s) === +t;
    const slot = teamSlot(s, +t);
    return `<div class="score-team t${slot}${out ? ' out' : ''}"><i class="dot"></i><span class="nm">${teams[t].map((id) => esc(nameOf(s, id)) + botTag(s, id)).join(' &amp; ')}${mine ? ' (you)' : ''}</span>${letters(g.wins[t] || 0, g.winsToFinish, slot)}</div>`;
  }).join('') + '</div>';
}

const teamCount = (r) => new Set(Object.values(r.players).filter((p) => p.partner && !p.removed).map((p) => p.team)).size;

// What someone watching a running game sees: a way to ask to play, or who they are waiting with.
function watcherBar(s) {
  const r = s.room, g = r.game, waiting = r.waiting || [];
  let h = '';
  if (waiting.includes(s.me)) {
    const others = waiting.filter((id) => id !== s.me).map((id) => esc(nameOf(s, id)));
    h = `<span class="mute sm">${others.length ? 'Waiting with ' + others.join(', ') : 'Waiting for a partner'}</span>`;
  } else if (!r.paused && g.phase !== 'over' && teamCount(r) < 5) h = `<button class="sm" data-act="join" data-room="${esc(r.id)}">Join the game</button>`;
  return `<div class="watching"><span>You are watching</span>${h}</div>`;
}

function topbar(s, ui, title) {
  const bad = ui.status !== 'open';
  return `<div class="topbar"><h2 class="display">${title}</h2>${bad ? `<span class="conn status ${ui.status === 'waiting' ? 'warn' : 'bad'}" role="status"><i></i><span>${ui.status === 'waiting' ? 'reconnecting…' : 'offline'}</span></span>` : ''}</div>`;
}

// Everyone else around the table. You are not drawn here: your own hand and points are at the bottom.
function seatRing(s, canSuspect, suspecting) {
  const r = s.room, g = r.game, me = s.me;
  const ring = g.seats.length ? g.seats : r.order;
  const n = ring.length;
  const mi = Math.max(0, ring.indexOf(me));
  // on a phone the seats sit closer in, so the ones at the sides are not cut off by the screen edge
  const [rx, ry, cy] = window.innerWidth <= 640 ? [32, 30, 56] : n > 5 ? [42, 36, 52] : [41, 40, 50];
  const seesAll = Object.keys(g.hands).length > 0 && !r.players[me];
  const hold = timerOf(r, 'hold');
  const holder = g.holder ? (g.holder === me ? 'You hold' : `${esc(nameOf(s, g.holder))} holds`) : '';
  const centre = g.holder ? `<div class="centre"><div class="mute">${holder} the passing card</div>${hold ? `<div class="display timer">${countdown(hold)}</div>` : ''}</div>` : '';
  return `<div class="ring${n > 5 ? ' dense' : ''}${n > 7 ? ' ten' : ''}"><div class="oval"></div>${centre}` + ring.map((id, i) => {
    if (id === me && r.players[me]) return '';
    const p = r.players[id] || {};
    const a = (Math.PI / 2) + ((i - mi + n) % n) * 2 * Math.PI / n;
    const x = 50 + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    const rc = timerOf(r, 'reconnect', id);
    const pending = g.pendingReveals.includes(id);
    const pts = g.points[id];
    const hand = seesAll ? g.hands[id] : null;
    const team = p.partner ? teamSlot(s, p.team) : undefined;
    return `<div class="seat t${team || 0}${id === g.holder ? ' holder' : ''}${p.removed ? ' out' : ''}" style="left:${x}%;top:${y}%">
      ${face(styleOf(s, id), 44, team)}
      ${isBot(s, id) ? '<span class="botmark">bot</span>' : ''}
      <div class="nm">${esc(nameOf(s, id))}</div>
      ${p.partner === me ? tag('partner') : ''}
      ${pts !== undefined ? hearts(Math.max(0, pts), g.suspicionPoints) : ''}
      ${p.connected === false ? `<div class="bad sm">offline ${countdown(rc)}</div>` : ''}
      ${pending ? '<div class="warn sm">answering…</div>' : ''}
      ${hand ? `<div class="mini">${handCards(hand, 'mini')}</div>` : ''}
      ${canSuspect && id !== me && !p.removed ? `<button class="sm alt suspect" data-act="suspect" data-target="${esc(id)}"${suspecting ? ' disabled' : ''}>${suspecting === id ? '…' : 'Suspect'}</button>` : ''}
    </div>`;
  }).join('') + '</div>';
}

// The suspect has to show some number of different card types. Cards here are the buttons.
function revealPrompt(g, ui, r) {
  if (!g.reveal) return '';
  const sel = ui.sel || [];
  const need = g.reveal.required;
  return `<div class="modal-backdrop soft"><div class="prompt reveal glass" role="dialog" aria-modal="true" aria-label="You are suspected">
    <h3 class="display">You are suspected</h3>
    <p>Show <b>${need}</b> different type${need > 1 ? 's' : ''} ${countdown(timerOf(r, 'reveal'))}</p>
    <div class="opts">${g.reveal.options.map((o) => card(o, { tag: 'button', cls: sel.includes(o) ? 'sel' : '', data: `data-act="reveal-toggle" data-card="${o}" aria-pressed="${sel.includes(o)}"` })).join('')}</div>
    <button data-act="reveal-send" ${sel.length === need ? '' : 'disabled'}>Show</button></div></div>`;
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
  const hint = partnerHolds ? 'Your partner holds the passing card, so they cannot win yet.' : '';
  const passTypes = g.hand.map((c, t) => (c ? t : -1)).filter((t) => t >= 0);
  const mineTeam = myTeam(s) === null ? undefined : teamSlot(s, myTeam(s));
  return `<div class="stage">
    ${topbar(s, ui, `Round ${g.round}`)}
    ${scoreboard(s)}
    <div class="mid">${seatRing(s, canAct, ui.suspecting)}</div>
    <div class="controls">
      ${spectator ? watcherBar(s) : `
        ${forced ? `<div class="prompt forced"><b>You were caught.</b> <span>Pass a card first</span> <span class="display timer">${countdown(timerOf(r, 'forced', me))}</span></div>` : ''}
        <div class="you t${mineTeam || 0}">${face(styleOf(s, me), 34, mineTeam)}<b>${esc(nameOf(s, me))} (you)</b>${hearts(Math.max(0, g.points[me] || 0), g.suspicionPoints)}${iHold && !forced ? tag('pass one card', 'gold') : ''}</div>
        <div class="hand">${handCards(g.hand) || '<span class="mute">no cards</span>'}</div>
        ${(iHold || forced) ? `<div class="pass${forced ? ' urgent' : ''}">${passTypes.map((t) => passChip(t)).join('')}</div>` : `<div class="hint">${esc(hint) || '&nbsp;'}</div>`}
        <button class="wide jackpot" data-act="proclaim" ${canAct && !revoked && !partnerHolds ? '' : 'disabled'}>${revoked ? `Jackpot locked ${countdown(timerOf(r, 'proclaim', me))}` : `Jackpot for ${esc(nameOf(s, partner))}!`}</button>`}
    </div>
    ${spectator ? '' : revealPrompt(g, ui, r)}
  </div>`;
}

function chatPhase(s, ui) {
  const r = s.room, g = r.game;
  const mine = r.players[s.me];
  const t = timerOf(r, 'chat');
  const ready = r.order.filter((id) => r.players[id].ready).length, here = r.order.filter((id) => !r.players[id].removed).length;
  const start = `Round ${g.round + (g.round === 0 ? 1 : 0)} <small>starts in</small> ${countdown(t)}`;
  return `<div class="stage">
    ${topbar(s, ui, start)}
    ${scoreboard(s)}
    ${isPlayer(s) ? `<section class="teampane glass">
      <div class="row"><h3>Team chat</h3>${tag('only your partner sees this')}</div>
      <div class="chat" id="team-list" data-stick>${teamChatLines(s)}</div>
      <div class="row nowrap"><input id="chat-input" class="grow" placeholder="Message your partner" maxlength="500" autocomplete="off" aria-label="Message your partner"><button class="cream" data-act="chat">Send</button></div>
      <div class="row between"><span class="mute sm">${ready}/${here} ready</span>
        <span class="row nowrap"><button class="alt sm" data-act="ideas">Signal ideas</button><button class="sm" data-act="ready" data-ready="${mine.ready ? 'false' : 'true'}">${mine.ready ? 'Not ready' : 'Ready'}</button></span></div>
    </section>` : `<section class="teampane glass center"><p class="mute">The teams are agreeing their signals.</p>${watcherBar(s)}</section>`}
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
      <h2 class="display">${res.draw ? 'It is a draw' : won ? 'Well done, you won!' : isPlayer(s) ? 'You lost this one' : 'Game over'}</h2>
      ${res.draw ? '' : `<p class="big-text">${esc(winners)} win${how}.</p>`}
      <div class="glass pad">${scoreboard(s)}</div>
      ${res.countsForStats === false ? '<p class="mute sm">This game does not count for the leaderboards.</p>' : ''}
      <div class="row center">${shareButton('game')}<button data-act="leave">Back to rooms</button></div>
    </div>
  </div>`;
}

// The game is saved and waiting for everyone to come back (after a restart, or everyone dropping at once).
function pausedView(s, ui) {
  const r = s.room, p = r.paused;
  const ids = p.players.filter((id) => r.players[id] && !r.players[id].removed);
  const back = ids.filter((id) => r.players[id].connected).length;
  return `<main class="center-page"><section class="glass card-center">
    <h2 class="display">Game paused</h2>
    <p class="big-text">Waiting for everyone · ${back} of ${ids.length} back</p>
    <div class="row center">${ids.map((id) => { const ok = r.players[id].connected; return `<span class="back-who${ok ? '' : ' away'}">${face(styleOf(s, id), 52, teamOfId(s, id))}<span class="${ok ? 'ok' : 'warn'}">${esc(nameOf(s, id))}${ok ? ' ✓' : ' …'}</span></span>`; }).join('')}</div>
    <p>Given up in <span class="display timer"><b data-countdown="${p.until}">${clock(p.until - Date.now())}</b></span></p>
  </section></main>`;
}

function waitingView() {
  return `<main class="center-page"><div class="fan" aria-hidden="true">${card(0)}${card(1)}${card(3)}</div><p class="big-text">Waiting for the game…</p></main>`;
}

export function table(s, ui) {
  const kind = screenKind(s);
  if (kind === 'wait') return waitingView();
  if (kind === 'paused') return pausedView(s, ui);
  if (kind === 'over') return over(s, ui);
  if (kind === 'chat') return chatPhase(s, ui);
  return play(s, ui);
}
