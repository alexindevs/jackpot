// The real client. Boots the session, opens the socket, and draws whichever screen the state calls for.
import { Net } from './net.js';
import { initial, reduce, applyMissed, nameOf } from './store.js';
import { serverUrl, devName } from './config.js';
import { readSession, clearSession, signInUrl, connectPage, sessionExpiresAt, refreshSession } from './startng.js';
import { clock } from './ui/dom.js';
import * as screens from './ui/screens.js';
import { table } from './ui/table.js';
import { openGuide } from './ui/guide.js';
import { openPalette } from './ui/signals.js';

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');

const ERRORS = {
  room_full: 'That room is full.', not_joinable: 'That room has already started.', no_such_room: 'No such room.',
  already_in_room: 'You are already in a room.', not_creator: 'Only the host can do that.',
  too_few_players: 'You need at least two teams.', unpaired_players: 'Everyone needs a partner first.',
  already_paired: 'Already on a team.', already_invited: 'You already invited them.', no_invite: 'That invite is gone.',
  bad_target: "You can't do that with that player.", not_player: 'Only players can do that.', wrong_phase: 'Not possible right now.',
  not_holder: 'You do not hold the passing card.', no_such_card: "You don't have that card.", no_points: 'No suspicion points left.',
  self_suspect: "You can't suspect yourself.", busy: 'Someone is already answering a suspicion.', bad_reveal: 'That is not a valid answer.',
  proclaim_revoked: 'You lost the right to proclaim this round.', partner_holds_passing_card: 'Your partner holds the passing card.',
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
const ui = { inviteLink, guest: guestArrival, pendingRoom, inviteNotice: null, retryIn: 0, sel: [], status: 'closed', identity: null, notice: null, blocked: false, signInUrl: signInUrl() };
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
let lastS = 0, resumeFrom = 0, helloSeen = false, awaitingSnap = false, catchTimer = null;
function track(m) {
  if (m.t === 'snapshot') lastS = m.d.seq || 0;
  else if (m.t === 'room_closed') lastS = 0;
  else if (typeof m.s === 'number' && m.s > lastS) lastS = m.s;
}
function catchUp(gotSnap) {
  awaitingSnap = false;
  clearTimeout(catchTimer);
  if (!gotSnap) { // no snapshot means the server no longer has us in a room
    if (state.room) { state.room = null; state.invites = { partner: [], room: [] }; lastS = 0; render(); }
    net.resendPending();
    return;
  }
  net.request('resume', { after: resumeFrom }).catch(() => {}).finally(() => net.resendPending());
}

function act(type, fields) {
  return net.request(type, fields).catch((e) => toast(ERRORS[e.code] || e.message));
}

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
net.addEventListener('message', (e) => {
  const m = e.detail;
  if (m.t === 'hello') {
    if (helloSeen) { resumeFrom = lastS; awaitingSnap = true; clearTimeout(catchTimer); catchTimer = setTimeout(() => catchUp(false), 600); }
    helloSeen = true;
  }
  track(m);
  state = m.t === 'missed' ? applyMissed(state, m.d) : reduce(state, m);
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
  if (net.status === 'open' && state.me && !state.room) net.request('list_rooms').catch(() => {});
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

function render() {
  // keep what the player is typing across redraws
  const a = document.activeElement;
  const keep = a && a.id && root.contains(a) ? { id: a.id, value: a.value, start: a.selectionStart, end: a.selectionEnd } : null;
  root.innerHTML = screens.header(state, ui) + view();
  root.querySelectorAll('[data-stick]').forEach((el) => { el.scrollTop = el.scrollHeight; });
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.value; el.focus(); try { el.setSelectionRange(keep.start, keep.end); } catch { /* not a text field */ } }
  }
}

const val = (id) => (document.getElementById(id).value || '').trim();

root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const d = b.dataset;
  switch (d.act) {
    case 'reload': location.reload(); break;
    case 'guide': openGuide(); break;
    case 'signal-palette': openPalette(state.gestures, (id) => act('signal', { gesture: id })); break;
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
    case 'create': act('create_room'); break;
    case 'refresh': pollRooms(); break;
    case 'join': act('join', { room: d.room }); break;
    case 'spectate': act('spectate', { room: d.room }); break;
    case 'join-code': if (val('join-code')) act('join', { room: val('join-code') }); break;
    case 'dismiss-room-invite': state.invites.room.splice(+d.n, 1); render(); break;
    case 'leave': act('leave').then(() => { state.room = null; pollRooms(); render(); }); break;
    case 'start': act('start_now'); break;
    case 'invite-partner': act('invite_partner', { to: d.to }); break;
    case 'invite-partner-id': if (val('invite-id')) act('invite_partner', { to: val('invite-id') }); break;
    case 'invite-room': if (val('invite-id')) act('invite_room', { to: val('invite-id') }); break;
    case 'pass': act('pass', { card: +d.card }); break;
    case 'suspect': act('suspect', { target: d.target }); break;
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
