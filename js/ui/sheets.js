// The bottom button and the panels it opens (chat, team chat, signals, log, menu), plus popups and banners.
// Everything here lives outside #app, so a redraw of the game never resets a panel's scroll position or a half-typed message.
import { esc } from './dom.js';
import { publicChatLines, teamChatLines, eventLines, signalLines, isPlayer } from './table.js';
import { gestureListHtml } from './signals.js';

const $ = (id) => document.getElementById(id);

const KINDS = {
  chat: { icon: '💬', label: 'Chat', title: 'Public chat' },
  team: { icon: '🔒', label: 'Team', title: 'Team chat' },
  signals: { icon: '📣', label: 'Signal', title: 'Send a signal' },
  log: { icon: '📜', label: 'Log', title: 'What happened' },
  menu: { icon: '⋯', label: 'Menu', title: 'Menu' },
};

// which icons make sense right now
function available(s) {
  const g = s.room && s.room.game;
  const player = isPlayer(s);
  const out = ['chat'];
  if (player) out.push('team');
  if (player && g && g.phase === 'playing' && !s.room.paused) out.push('signals');
  out.push('log', 'menu');
  return out;
}

// ---- the bottom button ----------------------------------------------------------------------------------------

export function renderDock(s, ui, visible) {
  const el = $('dock');
  if (!visible || ui.sheet) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const unread = (ui.unread.chat || 0) + (ui.unread.team || 0);
  const items = ui.dockOpen ? `<div class="dock-menu">${available(s).map((k) => {
    const n = ui.unread[k] || 0;
    return `<button class="dock-item" data-act="sheet" data-kind="${k}"><span class="ic">${KINDS[k].icon}${n ? `<i class="badge">${n > 9 ? '9+' : n}</i>` : ''}</span><span>${KINDS[k].label}</span></button>`;
  }).join('')}</div>` : '';
  el.innerHTML = `${items}<button class="fab" data-act="dock" aria-label="Open the menu">${ui.dockOpen ? '✕' : '＋'}${!ui.dockOpen && unread ? `<i class="badge">${unread > 9 ? '9+' : unread}</i>` : ''}</button>`;
}

// ---- the half-height panel ------------------------------------------------------------------------------------

let builtFor = null; // which panel the DOM currently holds

function fill(list, html, stick) {
  if (!list) return;
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const keep = list.scrollTop;
  list.innerHTML = html;
  list.scrollTop = stick && (atBottom || builtFor === 'fresh') ? list.scrollHeight : keep;
}

function build(kind, s, ui) {
  const sh = $('sheet');
  const player = isPlayer(s);
  const g = s.room.game;
  let body = '', foot = '';
  if (kind === 'chat') {
    body = '<div class="chat" id="sheet-list"></div>';
    foot = player ? '<div class="row nowrap"><input id="pub-input" placeholder="say it to the whole room" maxlength="500" autocomplete="off"><button data-act="pubchat">Post</button></div>'
      : '<div class="mute sm">You can read the chat but not post.</div>';
  } else if (kind === 'team') {
    body = '<div class="chat private" id="sheet-list"></div>';
    foot = '<div class="row nowrap"><input id="chat-input" placeholder="message your partner" maxlength="500" autocomplete="off"><button data-act="chat">Send</button></div><div class="mute sm" id="team-hint"></div>';
  } else if (kind === 'signals') {
    body = `<input id="sig-search" type="search" placeholder="Search ${s.gestures.length} signals" autocomplete="off" style="width:100%"><div id="sheet-list"></div>`;
    foot = '<div class="mute sm">Your partner always sees it. Most are seen by the whole table too, and you are not told which.</div>';
  } else if (kind === 'log') {
    body = `<div class="tabs"><button data-act="log-tab" data-tab="events">Events</button><button data-act="log-tab" data-tab="signals">Signals</button></div><div class="chat" id="sheet-list"></div>`;
  } else {
    body = '<div id="sheet-list"></div>';
  }
  sh.innerHTML = `<div class="sheet-head"><h3>${KINDS[kind].title}</h3><button class="alt" data-act="sheet-close" aria-label="Close">✕</button></div>
    <div class="sheet-body">${body}</div><div class="sheet-foot">${foot}</div>`;
  const search = $('sig-search');
  if (search) search.addEventListener('input', () => { ui.sigQuery = search.value; $('sheet-list').innerHTML = gestureListHtml(s.gestures, search.value); });
}

function menuHtml(s) {
  const r = s.room, g = r.game, me = s.me;
  const player = isPlayer(s);
  const yes = g ? Object.values(g.votes).filter(Boolean).length : 0;
  const voting = player && g && g.phase !== 'over';
  return `<div class="menu">
    <button class="alt wide" data-act="guide">How to play</button>
    ${voting ? `<button class="${g.votes[me] ? '' : 'alt'} wide" data-act="vote-end" data-agree="${g.votes[me] ? 'false' : 'true'}">${g.votes[me] ? 'Withdraw my vote to end' : 'Vote to end the game'}</button>
      <div class="mute sm">${yes} voted to end. A team agrees only when both partners do, and a majority of teams is needed.</div>` : ''}
    <button class="alt wide" data-act="leave-confirm">${player && g && g.phase !== 'over' ? 'Leave the game' : 'Leave the room'}</button>
    ${player && g && g.phase !== 'over' ? '<div class="mute sm">Leaving takes your whole team out of the game straight away.</div>' : ''}
  </div>`;
}

export function renderSheet(s, ui) {
  const sh = $('sheet');
  if (!ui.sheet || !s.room) {
    if (!sh.hidden) { sh.hidden = true; sh.innerHTML = ''; builtFor = null; document.body.classList.remove('sheet-open'); }
    return;
  }
  const kind = ui.sheet;
  if (sh.hidden || builtFor !== kind) { build(kind, s, ui); builtFor = 'fresh'; sh.hidden = false; document.body.classList.add('sheet-open'); }
  const list = $('sheet-list');
  if (kind === 'chat') fill(list, publicChatLines(s), true);
  else if (kind === 'team') {
    fill(list, teamChatLines(s), true);
    const open = s.room.game && s.room.game.phase === 'waiting';
    const input = $('chat-input'), hint = $('team-hint');
    if (input) input.disabled = !open;
    if (hint) hint.textContent = open ? '' : 'The team chat opens between rounds. You can read it here during the round.';
  } else if (kind === 'signals') { if (builtFor === 'fresh') list.innerHTML = gestureListHtml(s.gestures, ui.sigQuery || ''); }
  else if (kind === 'log') {
    const tab = ui.logTab || 'events';
    sh.querySelectorAll('[data-act=log-tab]').forEach((b) => b.classList.toggle('alt', b.dataset.tab !== tab));
    fill(list, tab === 'signals' ? signalLines(s) : eventLines(s), true);
  } else list.innerHTML = menuHtml(s);
  if (builtFor === 'fresh') builtFor = kind;
}

// ---- popups and banners ---------------------------------------------------------------------------------------

export function popup(html, cls = '') {
  const box = $('popups');
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.innerHTML = html;
  box.append(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => el.remove(), 3600);
}

export function banner(html, ms = 2800) {
  const el = $('banner');
  el.innerHTML = html;
  el.hidden = false;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, ms);
}

export { esc };
