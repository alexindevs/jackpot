// The real client. Boots the session, opens the socket, and draws whichever screen the state calls for.
import { Net } from './net.js';
import { initial, reduce } from './store.js';
import { serverUrl, devName } from './config.js';
import { readSession, clearSession, signInUrl, connectPage } from './startng.js';
import { clock } from './ui/dom.js';
import * as screens from './ui/screens.js';

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');

const ERRORS = {
  room_full: 'That room is full.', not_joinable: 'That room has already started.', no_such_room: 'No such room.',
  already_in_room: 'You are already in a room.', not_creator: 'Only the host can do that.',
  too_few_players: 'You need at least two teams.', unpaired_players: 'Everyone needs a partner first.',
  already_paired: 'Already on a team.', already_invited: 'You already invited them.', no_invite: 'That invite is gone.',
  bad_target: "You can't do that with that player.", not_player: 'Only players can do that.', wrong_phase: 'Not possible right now.',
  rate_limited: 'Slow down a little.', closed: 'Not connected.', timeout: 'The server did not answer.',
};

let state = initial();
const ui = { status: 'closed', identity: null, notice: null, blocked: false, signInUrl: signInUrl() };
const dev = devName();
let session = dev ? null : readSession();
const token = () => (dev ? 'dev:' + dev : session);

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.hidden = true), 4000);
}

const net = new Net({ url: serverUrl(), getToken: token });

function act(type, fields) {
  return net.request(type, fields).catch((e) => toast(ERRORS[e.code] || e.message));
}

net.addEventListener('status', (e) => {
  ui.status = e.detail.status;
  if (e.detail.status === 'closed') {
    if (e.detail.code === 4409) { ui.blocked = true; ui.notice = 'This account is open in another tab or window. Close the other one, then reload.'; }
    if (e.detail.code === 4401) { clearSession(); session = null; ui.notice = 'Your sign-in expired or was refused. Please sign in again.'; }
  }
  render();
});
net.addEventListener('message', (e) => {
  state = reduce(state, e.detail);
  if (e.detail.t === 'error' && e.detail.id === undefined) toast((e.detail.d || {}).message || 'Error');
  if (e.detail.t === 'hello') pollRooms();
  render();
});

function pollRooms() {
  if (net.status === 'open' && state.me && !state.room) net.request('list_rooms').catch(() => {});
}
setInterval(pollRooms, 4000);

function view() {
  if (ui.blocked) return `<section class="panel center"><h2>Opened elsewhere</h2><p class="warn">${ui.notice}</p><button data-act="reload">Reload</button></section>`;
  if (!token()) return screens.signIn(ui);
  if (!state.me) return '<section class="panel center"><p class="mute">Connecting…</p></section>';
  if (!state.room) return screens.rooms(state, ui);
  if (state.room.phase === 'lobby') return screens.lobby(state, ui);
  return screens.game(state);
}

function render() {
  // keep what the player is typing across redraws
  const a = document.activeElement;
  const keep = a && a.id && root.contains(a) ? { id: a.id, value: a.value, start: a.selectionStart, end: a.selectionEnd } : null;
  root.innerHTML = screens.header(state, ui) + view();
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
    case 'accept': act('accept_partner', { from: d.from }); break;
    case 'decline': act('decline_partner', { from: d.from }).then(() => { state.invites.partner = state.invites.partner.filter((i) => i.from !== d.from); render(); }); break;
  }
});

setInterval(() => {
  root.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = clock(+el.dataset.countdown - Date.now()); });
}, 500);

async function boot() {
  render();
  if (dev) ui.identity = { name: dev, account: 'dev' };
  else {
    try {
      const w = await connectPage().whoami();
      ui.identity = w.user || w.guest || null;
    } catch { /* the page still works without the connect iframe */ }
  }
  if (token()) net.connect();
  render();
}
boot();
