// The real client. Boots the session, opens the socket, and draws whichever screen the state calls for.
import { Net } from './net.js';
import { initial, reduce, applyMissed, nameOf } from './store.js';
import { serverUrl, devName } from './config.js';
import { readSession, clearSession, signInUrl, connectPage, sessionExpiresAt, refreshSession } from './startng.js';
import { clock, esc } from './ui/dom.js';
import * as screens from './ui/screens.js';
import { table, screenKind, isPlayer, teamNames, myTeam } from './ui/table.js';
import { openGuide } from './ui/guide.js';
import { openNewRoom } from './ui/newroom.js';
import { renderDock, renderSheet, popup, banner } from './ui/sheets.js';
import { cueFor, play } from './sound.js';
import { mountSoundBar } from './ui/soundbar.js';

const root = document.getElementById('app');
mountSoundBar(document.getElementById('sound'));
const toastEl = document.getElementById('toast');

const ERRORS = {
  room_full: 'That room is full.', not_joinable: 'That room has already started.', no_such_room: 'No such room.',
  already_in_room: 'You are already in a room.', not_creator: 'Only the host can do that.',
  too_few_players: 'You need at least two teams.', unpaired_players: 'Everyone needs a partner first.',
  already_paired: 'Already on a team.', already_invited: 'You already invited them.', no_invite: 'That invite is gone.',
  bad_target: "You can't do that with that player.", not_player: 'Only players can do that.', wrong_phase: 'Not possible right now.',
  not_holder: 'You do not hold the passing card.', no_such_card: "You don't have that card.", no_points: 'No suspicion points left.',
  self_suspect: "You can't suspect yourself.", busy: 'Someone is already answering a suspicion.', bad_reveal: 'That is not a valid answer.',
  proclaim_revoked: "You can't call Jackpot yet.", partner_holds_passing_card: 'Your partner is holding the passing card.',
  game_over: 'The game is over.', nothing_to_answer: 'Nothing to answer.', bad_text: 'That message cannot be sent.',
  slow_down: 'Slow down a little.', rate_limited: 'Slow down a little.', closed: 'Not connected.', timeout: 'The server did not answer.',
};

// An invite link looks like https://jackpot.start.ng/?room=abc123. Remember the room (it has to survive the
// sign-in round trip), then join it as soon as we are connected.
let guestArrival = false;
function takeInvite() {
  try {
    const q = new URLSearchParams(location.search);
    const room = q.get('room');
    guestArrival = q.has('guest'); // start.ng opens a game with ?guest when the player chose to play as a guest
    if (room) {
      rememberRoom(room);
      q.delete('room');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch { /* storage unavailable: the link just opens the room list */ }
}
takeInvite();
const HOUR = 60 * 60 * 1000;
function rememberRoom(room) {
  try { sessionStorage.setItem('pending_room', room); } catch { /* ignore */ }
  try { localStorage.setItem('pending_room', JSON.stringify({ room, at: Date.now() })); } catch { /* ignore */ }
}
function pendingRoom() {
  try { const r = sessionStorage.getItem('pending_room'); if (r) return r; } catch { /* ignore */ }
  try { const o = JSON.parse(localStorage.getItem('pending_room') || 'null'); if (o && Date.now() - o.at < HOUR) return o.room; } catch { /* ignore */ }
  return null;
}
function clearPendingRoom() {
  try { sessionStorage.removeItem('pending_room'); } catch { /* ignore */ }
  try { localStorage.removeItem('pending_room'); } catch { /* ignore */ }
}

function inviteLink(roomId) {
  const q = new URLSearchParams();
  const server = new URLSearchParams(location.search).get('server');
  if (server) q.set('server', server); // only set when testing against another server
  q.set('room', roomId);
  return location.origin + location.pathname + '?' + q;
}

let state = initial();
const ui = { sheet: null, dockOpen: false, unread: { chat: 0, team: 0 }, logTab: 'events', sigQuery: '', over: null, inviteLink, guest: guestArrival, pendingRoom, inviteNotice: null, retryIn: 0, sel: [], suspecting: null, status: 'closed', identity: null, notice: null, blocked: false, signInUrl: signInUrl() };
const dev = devName();
let session = dev ? null : readSession();
const token = () => (dev ? 'dev:' + dev : session);

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.hidden = true), 4000);
}

// Sessions last about two hours. Near the end, get a new one before reconnecting.
async function beforeConnect() {
  if (dev || !session) return;
  const exp = sessionExpiresAt();
  if (exp && exp - Date.now() < 5 * 60 * 1000) await refreshSession();
}

const net = new Net({ url: serverUrl(), getToken: token, beforeConnect });

// Catching up after a reconnect: snapshot first, then ask for what we missed, then resend unanswered actions.
let lastS = 0, resumeFrom = 0, helloSeen = false, wasReconnect = false, awaitingSnap = false, catchTimer = null;
function track(m) {
  if (m.t === 'snapshot') lastS = m.d.seq || 0;
  else if (m.t === 'room_closed') lastS = 0;
  else if (typeof m.s === 'number' && m.s > lastS) lastS = m.s;
}
function catchUp(gotSnap) {
  awaitingSnap = false;
  clearTimeout(catchTimer);
  if (gotSnap) {
    const r = state.room;
    // After a server restart the message numbers start again from zero, and the room comes back paused. In
    // either case the old "last seen" number means nothing, so rely on the snapshot alone.
    const sameRun = wasReconnect && r && !r.paused && r.seq >= resumeFrom;
    if (sameRun) net.request('resume', { after: resumeFrom }).catch(() => {}).finally(() => net.resendPending());
    else net.resendPending();
    return;
  }
  // no snapshot: the server has no current room for us
  if (state.room) { state.room = null; state.invites = { partner: [], room: [] }; lastS = 0; render(); }
  net.resendPending();
  // a paused game is not a current room: offer to go back to it, and go straight back if there is just one
  net.request('my_games').then(() => {
    const games = state.myGames.filter((g) => g.kind !== 'lobby');
    if (!state.room && state.myGames.length === 1 && games.length === 1) net.request('resume_game', { room: games[0].room }).catch(() => {});
  }).catch(() => {});
}

function act(type, fields) {
  return net.request(type, fields).catch((e) => toast(ERRORS[e.code] || e.message));
}

// A muted or away player still sees the game start: the tab title changes until they are back.
const TITLE = document.title;
const alertTitle = (text) => { if (document.hidden) document.title = text; };

// back on the tab, or the network is back: make sure the connection is really alive
document.addEventListener('visibilitychange', () => { if (!document.hidden) { document.title = TITLE; net.checkNow(); } });
window.addEventListener('online', () => net.checkNow());
window.addEventListener('focus', () => net.checkNow());

net.addEventListener('status', (e) => {
  ui.status = e.detail.status;
  if (e.detail.status === 'waiting') ui.retryIn = e.detail.retryIn;
  if (e.detail.status === 'open') ui.inviteNotice = ui.inviteNotice; // unchanged
  syncChatPoll();
  if (e.detail.status === 'closed') {
    if (e.detail.code === 4409) { ui.blocked = true; ui.notice = 'This account is open in another tab or window. Close the other one, then reload.'; }
    if (e.detail.code === 4401) { clearSession(); session = null; ui.notice = 'Your sign-in expired or was refused. Please sign in again.'; }
  }
  render();
});
// Unread badges, short popups for what just happened, and the round and game banners.
function announce(m, before) {
  const r = state.room;
  if (!r) return;
  const cue = cueFor(m, { me: state.me, player: isPlayer(state), myTeam: myTeam(state), lobby: r.phase === 'lobby' });
  if (cue) play(cue);
  if (m.t === 'game_starting') { banner('<div class="big">Game starting</div>'); alertTitle('▶ Game starting'); }
  const n = (id) => (id === state.me ? 'You' : nameOf(state, id));
  if (m.t === 'chat_message' && m.d.from !== state.me && ui.sheet !== 'chat') ui.unread.chat++;
  if (m.t === 'team_chat_message' && m.d.from !== state.me && ui.sheet !== 'team') ui.unread.team++;
  if (m.t === 'signal') {
    const g = state.gestures.find((x) => x.id === m.d.gesture);
    popup(`${m.d.scope === 'team' ? '🔒 ' : ''}<b>${esc(n(m.d.from))}</b> ${esc(g ? g.seen : m.d.gesture)}`, m.d.scope === 'team' ? 'private' : '');
  }
  if (m.t === 'connection_changed' && m.d.player !== state.me && r.game) popup(`<b>${esc(n(m.d.player))}</b> ${m.d.connected ? 'is back online' : 'went offline'}`, m.d.connected ? '' : 'warn');
  if (m.t === 'paused') popup('Game paused: waiting for everyone', 'warn');
  if (m.t === 'resumed') popup('Everyone is back. Game on!');
  if (m.t !== 'game_event') return;
  const d = m.d;
  if (m.kind === 'round_started') popup(`Round ${d.round}: <b>${esc(n(d.holder))}</b> ${d.holder === state.me ? 'hold' : 'holds'} the passing card`);
  else if (m.kind === 'passed' && d.to === state.me) popup(`<b>${esc(n(d.from))}</b> passed you the card`);
  else if (m.kind === 'suspicion_raised') popup(`<b>${esc(n(d.by))}</b> ${d.by === state.me ? 'suspect' : 'suspects'} <b>${esc(n(d.target))}</b>`, 'warn');
  else if (m.kind === 'suspicion_freed') popup(`<b>${esc(n(d.target))}</b> ${d.target === state.me ? 'were' : 'was'} cleared`);
  else if (m.kind === 'suspicion_failed') popup(`<b>${esc(n(d.target))}</b> ${d.target === state.me ? 'were' : 'was'} caught!`, 'bad');
  else if (m.kind === 'false_proclaim') {
    // "no longer": a suspicion can reset the partner just before the call lands, so the caller did see four a moment ago
    if (d.by === state.me) popup(`Your partner no longer holds four of a kind. ${d.revoked ? "You can't call Jackpot for 3 minutes." : `${d.pointsLeft} point${d.pointsLeft === 1 ? '' : 's'} left.`}`, 'bad');
    else popup(`<b>${esc(n(d.by))}</b> called Jackpot falsely`, 'bad');
  }
  else if (m.kind === 'team_removed') popup('A team left the game', 'warn');
  else if (m.kind === 'round_won') {
    const mine = myTeam(state) === d.team;
    banner(`<div class="big">${isPlayer(state) ? (mine ? 'Your team won the round!' : 'The other team won the round') : esc(teamNames(state, d.team)) + ' won the round'}</div>
      <div>${esc(teamNames(state, d.team))} <span class="letter">${esc(d.letter || '')}</span></div>`);
  } else if (m.kind === 'game_over') ui.over = { at: Date.now(), stay: false };
}

net.addEventListener('message', (e) => {
  const m = e.detail;
  if (m.t === 'hello') {
    wasReconnect = helloSeen;
    if (helloSeen) resumeFrom = lastS;
    awaitingSnap = true;
    clearTimeout(catchTimer);
    catchTimer = setTimeout(() => catchUp(false), 3000);
    helloSeen = true;
  }
  track(m);
  const before = state;
  state = m.t === 'missed' ? applyMissed(state, m.d) : reduce(state, m);
  announce(m, before);
  if (m.t === 'snapshot' && awaitingSnap) queueMicrotask(() => catchUp(true));
  if (e.detail.t === 'error' && e.detail.id === undefined) toast((e.detail.d || {}).message || 'Error');
  if (e.detail.t === 'hello') { pollRooms(); setTimeout(tryPendingJoin, 400); } // after a possible snapshot
  if (e.detail.t === 'partner_invite' && e.detail.d.to === state.me) toast(nameOf(state, e.detail.d.from) + ' wants you as a partner');
  if (e.detail.t === 'room_invite') toast(nameOf(state, e.detail.d.from) + ' invited you to a room');
  if (e.detail.t === 'game_event' && (e.detail.kind === 'suspicion_failed' || e.detail.kind === 'suspicion_freed')) ui.sel = [];
  render();
});

// While the socket is down, catch up on the public chat over REST once a minute (players only, needs the database).
let chatPoll = null, chatPollOff = false;
function restBase() {
  try { const u = new URL(net.url); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; return u.origin; } catch { return null; }
}
async function pollChat() {
  const room = state.room;
  if (!room || !session || chatPollOff || !restBase()) return;
  try {
    const r = await fetch(`${restBase()}/api/rooms/${encodeURIComponent(room.id)}/chat?after=${room.lastPubId}&limit=200`, { headers: { Authorization: 'Bearer ' + session } });
    if (r.status === 503 || r.status === 403 || r.status === 401) { chatPollOff = true; return; } // no database, not a player, or signed out: nothing to poll
    if (!r.ok) return;
    const lines = await r.json();
    if (lines.length) { state = reduce(state, { t: '_chat_poll', d: { lines } }); render(); }
  } catch { /* still offline; try again next minute */ }
}
function syncChatPoll() {
  if (net.status !== 'open' && state.room && !chatPoll) chatPoll = setInterval(pollChat, 60000);
  if ((net.status === 'open' || !state.room) && chatPoll) { clearInterval(chatPoll); chatPoll = null; }
}

function tryPendingJoin() {
  const room = pendingRoom();
  if (!room || net.status !== 'open' || !state.me || state.room) return;
  // Only a real answer from the server uses the link up. If the connection dropped meanwhile, keep it for the retry.
  net.request('join', { room }).then(clearPendingRoom, (e) => {
    const definitive = ['room_full', 'not_joinable', 'no_such_room', 'already_in_room', 'not_player', 'room_closed'].includes(e.code);
    if (!definitive) return;
    clearPendingRoom();
    ui.inviteNotice = {
      room,
      text: e.code === 'not_joinable' ? 'That game has already started. You can watch it instead.'
        : e.code === 'room_full' ? 'That room is full.'
        : e.code === 'already_in_room' ? '' : 'That room no longer exists.',
      canWatch: e.code === 'not_joinable' || e.code === 'room_full',
    };
    render();
  });
}

function pollRooms() {
  if (net.status === 'open' && state.me && !state.room) {
    net.request('list_rooms').catch(() => {});
    net.request('my_games').catch(() => {});
  }
}
setInterval(pollRooms, 4000);

function view() {
  if (ui.blocked) return `<section class="panel center"><h2>Opened elsewhere</h2><p class="warn">${ui.notice}</p><button data-act="reload">Reload</button></section>`;
  if (!token()) return screens.signIn(ui);
  if (!state.me) return screens.connecting(ui);
  if (!state.room) return screens.rooms(state, ui);
  if (state.room.phase === 'lobby') return screens.lobby(state, ui);
  return table(state, ui);
}

let lastScreen = '';
const isGameScreen = () => !ui.blocked && !!token() && !!state.me && !!state.room && state.room.phase !== 'lobby';

function render() {
  const game = isGameScreen();
  // keep what the player is typing across redraws
  const a = document.activeElement;
  const keep = a && a.id && root.contains(a) ? { id: a.id, value: a.value, start: a.selectionStart, end: a.selectionEnd } : null;
  root.innerHTML = (game ? '' : screens.header(state, ui)) + view();
  document.body.classList.toggle('stage-on', game);
  // a different screen starts at the top (the old layout kept its scroll position into the next screen)
  const key = game ? screenKind(state) : (state.room ? 'lobby' : 'other');
  if (key !== lastScreen) { lastScreen = key; window.scrollTo(0, 0); }
  if (!game) { ui.sheet = null; ui.dockOpen = false; }
  renderDock(state, ui, game);
  renderSheet(state, ui);
  renderOverlay();
  root.querySelectorAll('[data-stick]').forEach((el) => { el.scrollTop = el.scrollHeight; });
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.value; el.focus(); try { el.setSelectionRange(keep.start, keep.end); } catch { /* not a text field */ } }
  }
}

// The end of a game: a banner for a few seconds, then a short countdown back to the lobby (with a way to stay).
function renderOverlay() {
  const el = document.getElementById('overlay');
  const o = ui.over;
  if (!o || o.stay || !state.room || screenKind(state) !== 'over') {
    if (!el.hidden) { el.hidden = true; el.innerHTML = ''; el.dataset.phase = ''; }
    if (o && !state.room) ui.over = null;
    return;
  }
  const t = Date.now() - o.at;
  const res = state.room.game.result || {};
  const mt = myTeam(state);
  const won = !res.draw && mt !== null && mt === res.winner;
  const winners = res.draw ? '' : teamNames(state, res.winner);
  const how = res.reason === 'forfeit' ? ' by forfeit' : res.reason === 'agreement' ? ' on most rounds' : '';
  const phase = t < 4000 ? 'result' : 'count';
  el.className = 'overlay ' + (res.draw ? 'draw' : won ? 'win' : 'lose');
  el.hidden = false;
  if (el.dataset.phase !== phase) { // rebuild only when the phase changes, so a tap on Stay is never swallowed
    el.dataset.phase = phase;
    el.innerHTML = phase === 'result'
      ? `<div class="icon">${res.draw ? '🤝' : won ? '🎉' : '🏁'}</div>
         <div class="big">${res.draw ? 'It is a draw' : won ? 'Well done, you won!' : isPlayer(state) ? 'Game over. You lost this one' : 'Game over'}</div>
         ${res.draw ? '' : `<div>${esc(winners)} win${how}</div>`}`
      : `<div class="big">Going back to the lobby in <span id="over-count">3</span>…</div><button class="alt" data-act="over-stay">Stay here</button>`;
  }
  if (phase === 'count') {
    const left = Math.max(0, 3 - Math.floor((t - 4000) / 1000));
    const c = document.getElementById('over-count');
    if (c) c.textContent = left;
    if (t >= 7000) { ui.over = null; leaveRoom(); }
  }
}
setInterval(renderOverlay, 250);

function leaveRoom() {
  ui.sheet = null; ui.dockOpen = false;
  return act('leave').then(() => { state.room = null; pollRooms(); render(); });
}

const val = (id) => (document.getElementById(id).value || '').trim();

// A tap is a press and a release on the same button. If the game redraws the screen in between (a message arrived), the
// button under the finger is replaced, and the browser then sends no click at all. So remember the press, and if the
// button has been replaced by the time of the release, but the finger is still on that spot, treat it as the tap it was.
let pressed = null;
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('[data-act]');
  if (!b || b.disabled) { pressed = null; return; }
  pressed = { el: b, data: { ...b.dataset }, rect: b.getBoundingClientRect(), at: Date.now() };
}, true);
document.addEventListener('pointerup', (e) => {
  const p = pressed;
  pressed = null;
  if (!p || p.el.isConnected || Date.now() - p.at > 3000) return; // the button is still there: the normal click handles it
  const r = p.rect, slack = 6;
  if (e.clientX >= r.left - slack && e.clientX <= r.right + slack && e.clientY >= r.top - slack && e.clientY <= r.bottom + slack) runAction(p.data);
}, true);

function onAction(e) {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) runAction(b.dataset);
}

function runAction(d) {

  switch (d.act) {
    case 'reload': location.reload(); break;
    case 'guide': openGuide(); break;
    case 'resume-game': act('resume_game', { room: d.room }); break;
    case 'watch-invited': { const room = ui.inviteNotice && ui.inviteNotice.room; ui.inviteNotice = null; if (room) act('spectate', { room }); render(); break; }
    case 'dismiss-notice': ui.inviteNotice = null; render(); break;
    case 'copy-link': {
      const link = inviteLink(state.room.id);
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
        () => toast('Invite link copied'),
        () => { const i = document.getElementById('invite-link'); if (i) { i.select(); toast('Press Ctrl+C to copy the link'); } },
      );
      break;
    }
    case 'create': openNewRoom((short) => act('create_room', short ? { short: true } : undefined)); break;
    case 'refresh': pollRooms(); break;
    case 'join': act('join', { room: d.room }); break;
    case 'spectate': act('spectate', { room: d.room }); break;
    case 'join-code': if (val('join-code')) act('join', { room: val('join-code') }); break;
    case 'dismiss-room-invite': state.invites.room.splice(+d.n, 1); render(); break;
    case 'leave': leaveRoom(); break;
    case 'leave-confirm': {
      const inGame = state.room && state.room.game && state.room.game.phase !== 'over' && isPlayer(state);
      if (!inGame || confirm('Leave the game? Your whole team drops out straight away.')) leaveRoom();
      break;
    }
    case 'dock': ui.dockOpen = !ui.dockOpen; render(); break;
    case 'sheet': ui.sheet = d.kind; ui.dockOpen = false; ui.sigQuery = ''; if (d.kind in ui.unread) ui.unread[d.kind] = 0; render(); break;
    case 'sheet-close': ui.sheet = null; render(); break;
    case 'log-tab': ui.logTab = d.tab; render(); break;
    case 'over-stay': if (ui.over) ui.over.stay = true; render(); break;
    case 'send-signal': ui.sheet = null; render(); act('signal', { gesture: d.gesture }); break;
    case 'start': act('start_now'); break;
    case 'invite-partner': act('invite_partner', { to: d.to }); break;
    case 'invite-partner-id': if (val('invite-id')) act('invite_partner', { to: val('invite-id') }); break;
    case 'invite-room': if (val('invite-id')) act('invite_room', { to: val('invite-id') }); break;
    case 'pass': act('pass', { card: +d.card }); break;
    case 'suspect': {
      if (ui.suspecting) break; // every tap is a new request, so lock until the server answers
      ui.suspecting = d.target;
      render();
      act('suspect', { target: d.target }).finally(() => { ui.suspecting = null; render(); });
      break;
    }
    case 'proclaim': act('proclaim'); break;
    case 'vote-end': act('vote_end', { agree: d.agree === 'true' }); break;
    case 'ready': act('ready', { ready: d.ready === 'true' }); break;
    case 'pubchat': { const v = val('pub-input'); if (v) { act('chat', { text: v }).then((m) => { if (m) document.getElementById('pub-input').value = ''; }); } break; }
    case 'chat': { const v = val('chat-input'); if (v) { act('team_chat', { text: v }); document.getElementById('chat-input').value = ''; } break; }
    case 'reveal-toggle': {
      const c = +d.card;
      ui.sel = ui.sel.includes(c) ? ui.sel.filter((x) => x !== c) : [...ui.sel, c];
      render();
      break;
    }
    case 'reveal-send': act('reveal', { types: ui.sel }).then(() => { ui.sel = []; render(); }); break;
    case 'accept': act('accept_partner', { from: d.from }); break;
    case 'decline': act('decline_partner', { from: d.from }).then(() => { state.invites.partner = state.invites.partner.filter((i) => i.from !== d.from); render(); }); break;
  }
}
for (const id of ['app', 'dock', 'sheet', 'overlay']) document.getElementById(id).addEventListener('click', onAction);

// Enter sends a chat line
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.id) return;
  const btn = { 'pub-input': 'pubchat', 'chat-input': 'chat' }[e.target.id];
  if (btn) { e.preventDefault(); const b = document.querySelector(`[data-act=${btn}]`); if (b) b.click(); }
});

setInterval(() => {
  root.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = clock(+el.dataset.countdown - Date.now()); });
}, 500);

function boot() {
  render();
  if (token()) net.connect(); // do not wait for start.ng's identity iframe: it only fills in the profile card
  if (dev) ui.identity = { name: dev, account: 'dev' };
  else {
    connectPage().whoami().then((w) => { ui.identity = w.user || w.guest || null; render(); }, () => { /* works without the iframe */ });
  }
  render();
}
if (dev) window.__jackpot = { get state() { return state; }, get net() { return net; }, get lastS() { return lastS; } }; // read-only view for tests, dev sign-in only
boot();
