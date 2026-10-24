import { esc, clock } from './dom.js';
import { avatar, profileCard } from './avatar.js';
import { nameOf } from '../store.js';

const who = (s, id) => `<span class="who">${avatar((s.profiles[id] || {}).style, 28)}<span>${esc(nameOf(s, id))}</span></span>`;

export function signIn(ui) {
  const room = ui.pendingRoom();
  return `<section class="panel center">
    <h2>${room ? "You've been invited to a game" : 'Sign in to play'}</h2>
    ${room ? `<p>Room <b>${esc(room)}</b> is waiting for you.</p>` : ''}
    ${ui.guest ? '<p class="warn">Guests can look around start.ng but can\'t play Jackpot. Sign in with a start.ng account to continue.</p>'
      : '<p class="mute">Jackpot needs a start.ng account.</p>'}
    <a class="btn" href="${esc(ui.signInUrl)}">${room ? 'Sign in and join the room' : 'Sign in with start.ng'}</a>
    <p class="mute sm">Signing in happens on start.ng. You'll come straight back here${room ? ' and join the room' : ''}. If you come back some other way, open the invite link again.</p>
    ${ui.notice ? `<p class="warn">${esc(ui.notice)}</p>` : ''}
  </section>`;
}

export function connecting(ui) {
  const slow = ui.status === 'waiting';
  return `<section class="panel center">
    <p class="mute">${slow ? "Can't reach the game server yet. It may be waking up, so this can take a minute. Trying again in a few seconds…" : 'Connecting…'}</p>
  </section>`;
}

// Players of a saved game or lobby, grouped by team (or pair, in a lobby), with who is back.
function groupedPlayers(g) {
  const label = g.kind === 'lobby' ? 'Pair' : 'Team';
  const by = new Map();
  for (const p of g.players) { const k = p.team < 0 ? -1 : p.team; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
  const mark = (p) => `<span class="${p.here ? 'ok' : 'warn'}">${esc(p.name)}${p.here ? ' ✓' : ' …'}</span>`;
  return [...by].sort((a, b) => a[0] - b[0]).map(([k, ps]) => `<div class="mute sm">${k < 0 ? 'No partner yet' : label + ' ' + (k + 1)}: ${ps.map(mark).join(', ')}</div>`).join('');
}

function resumeList(s) {
  if (!s.myGames.length) return '';
  return `<div class="prompt"><b>Resume your game</b>${s.myGames.map((g) => {
    const back = g.players.filter((p) => p.here).length;
    const what = g.kind === 'lobby' ? `Lobby <b>${esc(g.room)}</b> (not started yet)` : `Game in room <b>${esc(g.room)}</b>, round ${g.round}`;
    return `<div class="room"><div>${what}
      ${groupedPlayers(g)}
      <div class="mute sm">${back} of ${g.players.length} back. Given up in <b data-countdown="${g.until}">${clock(g.until - Date.now())}</b></div></div>
      <button data-act="resume-game" data-room="${esc(g.room)}">Resume</button></div>`;
  }).join('')}</div>`;
}

export function rooms(s, ui) {
  const list = s.rooms.length
    ? s.rooms.map((r) => `<div class="room">
        <div><b>${esc(r.id)}</b> <span class="tag">${esc(r.phase)}</span><span class="tag">${r.short ? 'short' : 'long'}</span><div class="mute">${r.players} players, ${r.teams} teams, ${r.spectators} watching</div></div>
        <div class="row">
          ${r.joinable ? `<button data-act="join" data-room="${esc(r.id)}">Join</button>` : ''}
          <button class="alt" data-act="spectate" data-room="${esc(r.id)}">Watch</button>
        </div></div>`).join('')
    : '<p class="mute">No rooms yet. Create one.</p>';
  const invites = s.invites.room.map((i, n) => `<div class="room"><div>${who(s, i.from)} invited you to <b>${esc(i.room)}</b></div>
      <div class="row"><button data-act="join" data-room="${esc(i.room)}">Join</button><button class="alt" data-act="dismiss-room-invite" data-n="${n}">Dismiss</button></div></div>`).join('');
  return `<section class="panel">
    <div class="row between"><h2>Rooms</h2><div class="row"><button data-act="create">Create room</button><button class="alt" data-act="guide">How to play</button><button class="alt" data-act="refresh">Refresh</button></div></div>
    ${resumeList(s)}
    ${s.closed ? `<p class="warn">Your last room closed (${esc(s.closed)}).</p>` : ''}
    ${ui.inviteNotice && ui.inviteNotice.text ? `<div class="prompt"><div>${esc(ui.inviteNotice.text)}</div><div class="row" style="margin-top:6px">
      ${ui.inviteNotice.canWatch ? '<button data-act="watch-invited">Watch</button>' : ''}<button class="alt" data-act="dismiss-notice">Dismiss</button></div></div>` : ''}
    ${invites}
    ${list}
    <div class="row" style="margin-top:12px"><input id="join-code" placeholder="room code" size="10" autocomplete="off"><button class="alt" data-act="join-code">Join by code</button></div>
  </section>`;
}

export function lobby(s, ui) {
  const r = s.room, me = s.me;
  const mine = r.players[me];
  const spectating = !mine;
  const unpaired = r.order.filter((id) => !r.players[id].partner);
  const teams = r.order.filter((id) => r.players[id].partner).length / 2;
  const invitedMe = s.invites.partner.filter((i) => i.to === me && i.room === r.id);
  const players = r.order.map((id) => {
    const p = r.players[id];
    const canInvite = mine && !mine.partner && !p.partner && id !== me;
    return `<div class="room">
      <div class="row">${who(s, id)}
        ${id === r.creator ? '<span class="tag">host</span>' : ''}${id === me ? '<span class="tag">you</span>' : ''}
        ${p.partner ? `<span class="mute">with ${esc(nameOf(s, p.partner))}</span>` : '<span class="warn">no partner</span>'}
        ${p.connected ? '' : '<span class="bad">offline</span>'}</div>
      ${canInvite ? `<button class="alt" data-act="invite-partner" data-to="${esc(id)}">Ask to team up</button>` : ''}
    </div>`;
  }).join('');
  const count = r.countdownEndsAt
    ? `<p>Game starts in <b data-countdown="${r.countdownEndsAt}">${clock(r.countdownEndsAt - Date.now())}</b></p>`
    : `<p class="mute">${r.order.length < 4 ? 'The countdown starts at 4 players.' : 'Waiting for the countdown.'}</p>`;
  const canStart = r.creator === me && teams >= 2 && unpaired.length === 0 && !r.paused;
  return `<section class="panel">
    <div class="row between"><h2>Room ${esc(r.id)}<span class="tag">${r.short ? 'short' : 'long'}</span></h2><div class="row"><button class="alt" data-act="guide">How to play</button><button class="alt" data-act="leave">Leave</button></div></div>
    ${spectating ? '<p class="warn">You are watching this room.</p>' : ''}
    ${r.paused ? (() => { const ids = r.paused.players.filter((id) => r.players[id] && !r.players[id].removed); const back = ids.filter((id) => r.players[id].connected).length;
      return `<div class="prompt"><b>Lobby paused: waiting for everyone (${back} of ${ids.length} back).</b>
      <div class="mute sm">You can still pick partners. Starting and new joiners wait until everyone is here. It is given up in <b data-countdown="${r.paused.until}">${clock(r.paused.until - Date.now())}</b>.</div></div>`; })() : ''}
    <div class="row"><input id="invite-link" readonly size="30" value="${esc(ui.inviteLink(r.id))}"><button class="alt" data-act="copy-link">Copy invite link</button></div>
    <p class="mute sm">Anyone with this link can join the room. They'll be asked to sign in with start.ng first.</p>
    ${count}
    ${invitedMe.map((i) => `<div class="room"><div>${who(s, i.from)} wants you as a partner</div>
      <div class="row"><button data-act="accept" data-from="${esc(i.from)}">Accept</button><button class="alt" data-act="decline" data-from="${esc(i.from)}">Decline</button></div></div>`).join('')}
    ${players}
    <p class="mute">${r.spectators} watching. Everyone needs a partner when the countdown ends, or they become spectators.</p>
    ${r.creator === me ? `<button data-act="start" ${canStart ? '' : 'disabled'}>Start now</button>
      <span class="mute">${canStart ? '' : 'needs 2+ teams and everyone paired'}</span>` : ''}
    <div class="row" style="margin-top:12px"><input id="invite-id" placeholder="player id to invite" size="16" autocomplete="off">
      <button class="alt" data-act="invite-room">Invite to room</button>${mine && !mine.partner ? '<button class="alt" data-act="invite-partner-id">Ask as partner</button>' : ''}</div>
  </section>`;
}

export function header(s, ui) {
  const st = { open: 'connected', connecting: 'connecting…', waiting: 'reconnecting…', closed: 'offline' }[ui.status] || ui.status;
  return `<header class="top"><b>jackpot</b>${ui.identity ? profileCard(ui.identity) : ''}<span class="mute">${st}</span></header>`;
}
