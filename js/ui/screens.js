// The screens outside a running game: home, your games, sign-in, rooms and the lobby.
import { esc, clock } from './dom.js';
import { face, profileCard, person } from './avatar.js';
import { nameOf, isBot } from '../store.js';
import { tag, roundBtn, letters } from './parts.js';
import { icon } from './icons.js';

const STATUS = { open: ['ok', 'connected'], connecting: ['warn', 'connecting…'], waiting: ['warn', 'reconnecting…'], closed: ['bad', 'offline'] };

// Who is signed in and whether the socket is up. Lives outside #app, top right.
export function shell(s, ui) {
  const [cls, label] = STATUS[ui.status] || ['warn', ui.status];
  return `<span class="status ${cls}" role="status"><i></i><span>${label}</span></span>${ui.identity ? profileCard(ui.identity) : ''}`;
}

const head = (title, { back, right = '' } = {}) => `<div class="head">${back ? roundBtn('back', 'Back', `data-act="page" data-page="${back}"`) : ''}<h2 class="display">${esc(title)}</h2><span class="grow"></span>${right}</div>`;

// ---- before you are in -----------------------------------------------------------------------------------------

export function signIn(ui) {
  const room = ui.pendingRoom();
  return `<main class="center-page"><section class="glass card-center">
    <h2 class="display">${room ? "You've been invited" : 'Sign in to play'}</h2>
    ${room ? `<p>Room <b>${esc(room)}</b> is waiting for you.</p>` : ''}
    ${ui.guest ? '<p class="warn">Guests can look around start.ng but can\'t play Jackpot. Sign in with a start.ng account to continue.</p>' : '<p>Jackpot needs a start.ng account.</p>'}
    <a class="btn" href="${esc(ui.signInUrl)}">${room ? 'Sign in and join the room' : 'Sign in with start.ng'}</a>
    <p class="mute sm">Signing in happens on start.ng. You'll come straight back here${room ? ' and join the room' : ''}. If you come back some other way, open the invite link again.</p>
    ${ui.notice ? `<p class="warn">${esc(ui.notice)}</p>` : ''}
  </section></main>`;
}

export function connecting(ui) {
  const slow = ui.status === 'waiting';
  return `<main class="center-page"><section class="glass card-center">
    <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="big-text">${slow ? 'Reconnecting…' : 'Connecting…'}</p>
    ${slow ? '<p class="mute sm">Can\'t reach the game server yet. It may be waking up, so this can take a minute. Trying again in a few seconds…</p>' : ''}
  </section></main>`;
}

export function openedElsewhere(ui) {
  return `<main class="center-page"><section class="glass card-center">
    <h2 class="display">Opened elsewhere</h2>
    <p>${esc(ui.notice)}</p>
    <button data-act="reload">Reload</button>
  </section></main>`;
}

// ---- home --------------------------------------------------------------------------------------------------------

export function home() {
  return `<main class="home">
    <div class="hero">
      <h1 class="display">Jackpot!</h1>
      <p>Pair up, pass the cards, and sneak a secret signal past the whole table. Four of a kind and your partner shouts it: Jackpot!</p>
    </div>
    <nav class="actions" aria-label="Start">
      <button class="alt" data-act="page" data-page="games" aria-label="View previous games">${icon.clock(26)}<span>View previous games</span></button>
      <button data-act="create" aria-label="Create room">${icon.plus(26)}<span>Create room</span></button>
      <button class="cream" data-act="page" data-page="rooms" aria-label="Go to lobby">${icon.door(26)}<span>Go to lobby</span></button>
    </nav>
  </main>`;
}

// ---- your games --------------------------------------------------------------------------------------------------

// Players of a saved game or lobby, grouped by team (or pair, in a lobby), with who is back.
function teamRows(g) {
  const lobby = g.kind === 'lobby';
  const by = new Map();
  for (const p of g.players) { const k = p.team < 0 ? -1 : p.team; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
  const mark = (p) => `<span class="${p.here ? 'ok' : 'warn'}">${esc(p.name)}${p.here ? ' ✓' : ' …'}</span>`;
  return [...by].sort((a, b) => a[0] - b[0]).map(([k, ps]) =>
    `<div class="team-row t${(k < 0 ? 0 : k) % 5}">${k < 0 ? '<span class="mute sm">No partner yet</span>' : `<i class="dot"></i><span class="names">${ps.map(mark).join(' &amp; ')}</span>`}${!lobby && g.wins ? letters(g.wins[k] || 0, g.winsToFinish, k) : ''}</div>`).join('');
}

function gameCard(g) {
  const lobby = g.kind === 'lobby';
  const back = g.players.filter((p) => p.here).length;
  return `<article class="game glass">
    <div class="game-info">
      <div class="row"><b class="code">${esc(g.room)}</b>${tag(lobby ? 'Lobby' : 'Paused', lobby ? '' : 'orange')}</div>
      <div class="mute">${lobby ? 'Not started' : 'Round ' + g.round} · ${back} of ${g.players.length} back · gives up in <b data-countdown="${g.until}">${clock(g.until - Date.now())}</b></div>
    </div>
    <div class="game-teams">${teamRows(g)}</div>
    <button data-act="resume-game" data-room="${esc(g.room)}">Resume</button>
  </article>`;
}

// "Today", "Yesterday", "3 days ago", then the date
function ago(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// A finished game from the server's `finished_games`: {room, outcome: 'won'|'lost'|'draw', reason, round, finishedAt, winsToFinish, countsForStats, teams: [{names, wins, mine}]}
function finishedCard(f) {
  const kind = { won: ['Won', 'gold'], lost: ['Lost', ''], draw: ['Draw', ''] }[f.outcome] || ['', ''];
  const how = f.reason === 'forfeit' ? ' · by forfeit' : f.reason === 'agreement' ? ' · on most rounds' : '';
  return `<article class="game glass">
    <div class="game-info"><div class="row"><b class="code">${esc(f.room)}</b>${tag(...kind)}</div><div class="mute">Round ${f.round} · ${esc(ago(f.finishedAt))}${how}${f.countsForStats === false ? ' · not counted' : ''}</div></div>
    <div class="game-teams">${f.teams.map((t, i) => `<div class="team-row t${i % 5}"><i class="dot"></i><span class="names">${esc(t.names.join(' & '))}${t.mine ? ' (you)' : ''}</span>${letters(t.wins, f.winsToFinish, i)}</div>`).join('')}</div>
  </article>`;
}

export function games(s) {
  const fin = s.finished || [];
  const any = s.myGames.length || fin.length;
  return `<main class="page"><div class="col">
    ${head('Your games', { back: 'home' })}
    ${s.myGames.map(gameCard).join('')}
    ${fin.map(finishedCard).join('')}
    ${any ? '' : '<section class="glass pad center"><p class="big-text">No games yet</p><button data-act="create">Create room</button></section>'}
  </div></main>`;
}

// ---- rooms -----------------------------------------------------------------------------------------------------

function resumeBanner(g) {
  const back = g.players.filter((p) => p.here).length;
  const what = g.kind === 'lobby' ? `Lobby ${esc(g.room)} (not started yet)` : `Resume your game ${esc(g.room)}`;
  return `<div class="notice orange"><div class="grow"><b>${what}</b><div class="mute">${g.kind === 'lobby' ? '' : 'Round ' + g.round + ' · '}${back} of ${g.players.length} back · gives up in <b data-countdown="${g.until}">${clock(g.until - Date.now())}</b></div></div>
    <button class="sm" data-act="resume-game" data-room="${esc(g.room)}">Resume</button></div>`;
}

export function rooms(s, ui) {
  const list = s.rooms.length ? s.rooms.map((r) => `<article class="room-card glass">
      <div class="game-info"><div class="row"><b class="code">${esc(r.id)}</b>${tag(r.phase, r.phase === 'lobby' ? 'orange' : '')}${tag(r.short ? 'short' : 'long')}</div>
        <div class="mute">${r.players} players${r.bots ? ` (${r.bots} bots)` : ''} · ${r.teams} teams · ${r.spectators} watching${r.waiting ? ' · ' + r.waiting + ' waiting' : ''}</div></div>
      <div class="row nowrap">${r.joinable ? `<button data-act="join" data-room="${esc(r.id)}">Join</button>` : ''}<button class="alt" data-act="spectate" data-room="${esc(r.id)}">Watch</button></div>
    </article>`).join('') : '<section class="glass pad center"><p class="mute">No rooms yet. Create one.</p></section>';
  const invites = s.invites.room.map((i, n) => `<div class="notice">${person(s, i.from)}<span>invited you to <b>${esc(i.room)}</b></span><span class="grow"></span>
      <div class="row nowrap"><button class="sm" data-act="join" data-room="${esc(i.room)}">Join</button><button class="sm alt" data-act="dismiss-room-invite" data-n="${n}">Dismiss</button></div></div>`).join('');
  const note = ui.inviteNotice && ui.inviteNotice.text ? `<div class="notice gold"><b class="grow">${esc(ui.inviteNotice.text)}</b>
      <div class="row nowrap">${ui.inviteNotice.canWatch ? '<button class="sm" data-act="watch-invited">Watch</button>' : ''}<button class="sm alt" data-act="dismiss-notice">Dismiss</button></div></div>` : '';
  return `<main class="page has-bar"><div class="col">
    ${head('Rooms', { back: 'home', right: `${roundBtn('help', 'How to play', 'data-act="guide"')}${roundBtn('refresh', 'Refresh', 'data-act="refresh"')}<button class="only-wide" data-act="create">Create room</button>` })}
    ${note}
    ${s.myGames.map(resumeBanner).join('')}
    ${s.closed ? `<div class="notice gold"><b>Your last room closed (${esc(s.closed)}).</b></div>` : ''}
    ${invites}
    <div class="row nowrap code-row"><input id="join-code" class="grow" placeholder="Room code" autocomplete="off" aria-label="Room code"><button class="cream" data-act="join-code">Join by code</button></div>
    ${list}
  </div><div class="bar only-narrow"><button class="wide" data-act="create">Create room</button></div></main>`;
}

// ---- lobby -----------------------------------------------------------------------------------------------------

// Asked before something that costs the team its place. A page dialog, not the browser's own, so it always shows.
export function confirmDialog(kind) {
  const leave = kind === 'leave';
  return `<div class="modal-backdrop" data-act="dialog-close"><div class="modal small" role="alertdialog" aria-modal="true" aria-labelledby="ask-title" data-keep>
    <div class="modal-head"><h2 class="display" id="ask-title">${leave ? 'Leave the game?' : 'Go back to start.ng?'}</h2></div>
    <div class="modal-body"><p>${leave ? 'Your whole team drops out straight away.' : "Your team drops out of the game if you don't come back soon."}</p>
      <div class="row">${leave ? '<button data-act="leave-yes">Leave the game</button>' : '<a class="btn" href="https://start.ng/">Go to start.ng</a>'}<button class="alt" data-act="dialog-close">Stay</button></div></div>
  </div></div>`;
}

function inviteDialog(s, ui) {
  const mine = s.room.players[s.me];
  return `<div class="modal-backdrop" data-act="dialog-close"><div class="modal small" role="dialog" aria-modal="true" aria-labelledby="inv-title" data-keep>
    <div class="modal-head"><h2 class="display" id="inv-title">Invite a player</h2>${roundBtn('close', 'Close', 'data-act="dialog-close"')}</div>
    <div class="modal-body"><input id="invite-id" placeholder="Player ID" autocomplete="off" aria-label="Player ID">
      <div class="row"><button data-act="invite-room">Invite to room</button>${mine && !mine.partner ? '<button class="cream" data-act="invite-partner-id">Ask as partner</button>' : ''}</div></div>
  </div></div>`;
}

export function lobby(s, ui) {
  const r = s.room, me = s.me;
  const mine = r.players[me];
  const spectating = !mine;
  const unpaired = r.order.filter((id) => !r.players[id].partner);
  const seen = new Set(), pairs = [];
  for (const id of r.order) { const p = r.players[id]; if (p.partner && !seen.has(id)) { seen.add(id); seen.add(p.partner); pairs.push([id, p.partner]); } }
  const invitedMe = s.invites.partner.filter((i) => i.to === me && i.room === r.id);
  const canStart = r.creator === me && pairs.length >= 2 && unpaired.length === 0 && !r.paused;

  const notices = [];
  if (r.paused) {
    const ids = r.paused.players.filter((id) => r.players[id] && !r.players[id].removed);
    const back = ids.filter((id) => r.players[id].connected).length;
    notices.push(`<div class="notice gold"><div><b>Lobby paused: waiting for everyone (${back} of ${ids.length} back)</b><div class="mute sm">You can still pick partners. Starting and new joiners wait until everyone is here. Given up in <b data-countdown="${r.paused.until}">${clock(r.paused.until - Date.now())}</b></div></div></div>`);
  }
  if (spectating) notices.push('<div class="notice gold"><b>You are watching this room.</b></div>');
  for (const i of invitedMe) notices.push(`<div class="notice orange">${person(s, i.from, { size: 36 })}<span>wants you as a partner</span><span class="grow"></span>
      <div class="row nowrap"><button class="sm" data-act="accept" data-from="${esc(i.from)}">Accept</button><button class="sm alt" data-act="decline" data-from="${esc(i.from)}">Decline</button></div></div>`);

  const teamCards = pairs.map(([a, b], i) => `<div class="teamcard t${i % 5}"><div class="mute sm">Team ${i + 1}</div>${person(s, a, { team: i })}${person(s, b, { team: i })}</div>`).join('');
  const rows = unpaired.map((id) => {
    const p = r.players[id];
    const canInvite = mine && !mine.partner && id !== me && !isBot(s, id);
    const canRemove = r.creator === me && isBot(s, id) && !r.paused;
    const tags = (id === me ? tag('you') : '') + (id === r.creator ? tag('host', 'orange') : '') + (p.connected ? '' : '<span class="tag bad">offline</span>');
    return `<div class="player-row">${person(s, id, { tags })}<span class="grow"></span>
      ${canInvite ? `<button class="sm alt" data-act="invite-partner" data-to="${esc(id)}"${r.paused ? ' disabled' : ''}>Ask to team up</button>` : ''}
      ${canRemove ? `<button class="sm alt" data-act="remove-bot" data-player="${esc(id)}" aria-label="Remove ${esc(nameOf(s, id))}">Remove</button>` : ''}</div>`;
  }).join('');

  const timer = r.countdownEndsAt
    ? `<div class="label">Game starts in</div><div class="display big"><span data-countdown="${r.countdownEndsAt}">${clock(r.countdownEndsAt - Date.now())}</span></div>`
    : `<div class="label">${r.order.length < 4 ? 'The countdown starts at 4 players.' : 'Waiting for the countdown.'}</div>`;
  const hostBtns = r.creator === me ? `<button class="wide" data-act="start" ${canStart ? '' : 'disabled'}>Start now</button><button class="wide cream" data-act="add-bots" ${r.paused ? 'disabled' : ''}>Add bots</button>${canStart ? '' : '<div class="mute sm center">Needs 2+ teams and everyone paired</div>'}` : '';

  return `<main class="page has-bar"><div class="col wide-col">
    <div class="head">${roundBtn('door', 'Leave room', 'data-act="leave"')}<h2 class="display">Room ${esc(r.id)}</h2>${tag(r.short ? 'short' : 'long')}<span class="grow"></span>
      <button class="alt only-wide" data-act="guide">How to play</button>${roundBtn('help', 'How to play', 'data-act="guide"', 'only-narrow')}</div>
    <div class="lobby-grid">
      <div class="stack">
        ${notices.join('')}
        <section class="glass pad"><h3>Teams</h3><div class="teams">${teamCards}<div class="teamcard open">Waiting for a pair</div></div></section>
        ${unpaired.length ? `<section class="glass pad"><div class="row between"><h3>Looking for a partner</h3>${roundBtn('userPlus', 'Invite by ID', 'data-act="dialog" data-kind="invite"', 'sm only-narrow')}</div><div class="stack tight">${rows}</div></section>` : ''}
      </div>
      <aside class="stack">
        <section class="glass pad center timer-card">${timer}<div class="mute sm">${r.spectators} watching</div></section>
        <section class="glass pad"><h3>Invite link</h3><input id="invite-link" readonly value="${esc(ui.inviteLink(r.id))}" aria-label="Invite link">
          <button class="cream wide" data-act="copy-link">Copy link</button><button class="alt wide only-wide" data-act="dialog" data-kind="invite">Invite by ID</button></section>
        ${r.creator === me ? `<section class="glass pad only-wide stack tight">${hostBtns}</section>` : ''}
      </aside>
    </div>
  </div>${r.creator === me ? `<div class="bar only-narrow">${hostBtns}</div>` : ''}${ui.dialog === 'invite' ? inviteDialog(s, ui) : ''}</main>`;
}
