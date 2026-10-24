// Multi-seat test harness: one tab drives 2 to 10 dev players against one server.
import { Net } from '../js/net.js';
import { initial, reduce, nameOf } from '../js/store.js';
import { serverUrl, CARDS, LETTERS, HIDDEN } from '../js/config.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const seats = [];
$('server').value = serverUrl();
$('count').value = new URLSearchParams(location.search).get('n') || 4;

function addLog(seat, text) {
  seat.log.push(text);
  if (seat.log.length > 300) seat.log.shift();
  const pre = seat.el.querySelector('pre.log');
  pre.textContent = seat.log.join('\n');
  pre.scrollTop = pre.scrollHeight;
}

function act(seat, type, fields) {
  return seat.net.request(type, fields).catch((e) => { addLog(seat, '! ' + type + ': ' + e.code + ' ' + e.message); seat.errors.push(e.code); });
}

function makeSeat(i) {
  const name = 'p' + (i + 1);
  const el = document.createElement('div');
  el.className = 'seat';
  el.innerHTML = `<h3>${name} <span class="st mute"></span></h3>
    <div class="view"></div>
    <label class="row"><input type="checkbox" class="auto"> auto (pass, answer prompts)</label>
    <pre class="log"></pre>
    <textarea class="raw" placeholder='{"type":"ping"}'></textarea>
    <div class="row"><button class="sendraw alt">Send raw JSON</button></div>`;
  $('seats').append(el);
  const seat = { name, el, state: initial(), log: [], errors: [], auto: false, acted: '' };
  seat.net = new Net({ url: $('server').value, getToken: () => 'dev:' + name, label: name });
  seat.net.addEventListener('status', (e) => {
    seat.el.querySelector('.st').textContent = e.detail.status + (e.detail.code ? ' ' + e.detail.code : '');
  });
  seat.net.addEventListener('message', (e) => {
    const msg = e.detail;
    addLog(seat, '< ' + JSON.stringify(msg).slice(0, 240));
    seat.state = reduce(seat.state, msg);
    if (msg.t === 'game_event' && msg.kind === 'passed') seat.acted = ''; // the game moved on; the same hand may come round again
    if (!seat.el.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') render(seat);
    if (seat.auto) autoStep(seat);
    checkProclaims();
  });
  el.querySelector('.auto').onchange = (e) => { seat.auto = e.target.checked; if (seat.auto) autoStep(seat); };
  el.querySelector('.sendraw').onclick = () => {
    const t = el.querySelector('.raw').value.trim();
    if (!t) return;
    addLog(seat, '> ' + t);
    try { seat.net.sendRaw(t); } catch (err) { addLog(seat, '! ' + err.message); }
  };
  return seat;
}

const total = (h) => h.reduce((a, b) => a + b, 0);

function autoStep(seat) {
  const s = seat.state, g = s.room && s.room.game;
  if (!g || g.phase !== 'playing') return;
  const me = s.me;
  let plan = null;
  if (g.forcedPass === me || (g.holder === me && total(g.hand) === 5)) {
    // keep the type we hold most; pass the one we hold least (but at least one)
    const held = g.hand.map((c, t) => (c > 0 ? t : -1)).filter((t) => t >= 0);
    let best = -1;
    g.hand.forEach((c, t) => { if (c > 0 && (best < 0 || c < g.hand[best])) best = t; });
    // mostly pass the least-held type, sometimes a random one, so hands can drift towards four of a kind
    if (Math.random() < 0.3) best = held[Math.floor(Math.random() * held.length)];
    plan = ['pass', { card: best }];
  } else if (g.reveal) {
    if (seat.revealSent) return; // answered; wait for suspicion_freed or suspicion_failed
    seat.revealSent = true;
    addLog(seat, '> auto reveal');
    act(seat, 'reveal', { types: g.reveal.options.slice(0, g.reveal.required) });
    return;
  }
  if (!g.reveal) seat.revealSent = false;
  if (!plan) return;
  // one action per distinct game state: replies and unrelated messages must not trigger a repeat
  const key = JSON.stringify([plan, g.round, g.holder, g.hand, g.forcedPass, g.reveal]);
  if (seat.acted === key) return;
  seat.acted = key;
  addLog(seat, '> auto ' + JSON.stringify(plan));
  act(seat, plan[0], plan[1]);
}

// Test helper: this tab sees every seat's hand, so it can have the partner proclaim for a player holding four of a kind.
let autoProclaim = false;
let proclaimed = '';
function checkProclaims() {
  if (!autoProclaim) return;
  for (const seat of seats) {
    const g = seat.state.room && seat.state.room.game;
    if (!g || g.phase !== 'playing' || !g.hand.some((c) => c === 4)) continue;
    const partner = seats.find((x) => x.state.me === seat.state.room.players[seat.state.me].partner);
    const key = seat.name + JSON.stringify(g.hand) + g.round;
    if (!partner || proclaimed === key) continue;
    proclaimed = key;
    addLog(partner, '> auto proclaim for ' + seat.name);
    act(partner, 'proclaim');
  }
}

function cardsHtml(hand, passable, handler) {
  return hand.map((c, t) => c ? `<span class="card" title="${CARDS[t].name}">${CARDS[t].glyph}<small>${c}</small></span>` : '').join('');
}

function render(seat) {
  const s = seat.state, r = s.room, v = seat.el.querySelector('.view');
  const me = s.me;
  let h = '';
  if (!me) { v.innerHTML = '<span class="mute">not signed in</span>'; return; }
  if (!r) {
    h += `<div class="row"><b>${esc(me)}</b> ${s.closed ? '<span class="warn">room closed: ' + esc(s.closed) + '</span>' : ''}
      <button data-a="create">Create room</button><button data-a="rooms" class="alt">List rooms</button></div>
      <div class="mute">${s.rooms.map((x) => esc(x.id) + ' ' + x.phase + ' ' + x.players + 'p').join(' | ')}</div>`;
    v.innerHTML = h;
    v.querySelector('[data-a=create]').onclick = () => act(seat, 'create_room');
    v.querySelector('[data-a=rooms]').onclick = () => seat.net.request('list_rooms').then((m) => { seat.state = reduce(seat.state, m); render(seat); }).catch((e) => addLog(seat, '! ' + e.message));
    return;
  }
  const g = r.game;
  h += `<div><b>${esc(me)}</b> in <b>${esc(r.id)}</b> (${r.phase})${r.creator === me ? ' creator' : ''}
    <button data-a="leave" class="alt">Leave</button></div>`;
  h += '<div class="mute">' + r.order.map((id) => {
    const p = r.players[id];
    return esc(nameOf(s, id)) + (p.partner ? '&' + esc(p.partner) : '') + (p.removed ? '(out)' : '') + (p.connected ? '' : '(offline)') + (p.ready ? '✓' : '');
  }).join(', ') + '</div>';
  const timers = r.timers.map((t) => t.kind + (t.player ? ':' + t.player : '') + ' ' + Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) + 's');
  if (timers.length) h += '<div class="warn">' + esc(timers.join(' | ')) + '</div>';
  if (s.invites.partner.length) h += '<div>' + s.invites.partner.filter((i) => i.to === me).map((i) => `<button data-a="acc" data-f="${esc(i.from)}">Accept ${esc(i.from)}</button>`).join('') + '</div>';
  if (r.phase === 'lobby') {
    h += '<div class="row"><button data-a="start">start_now</button></div>';
  }
  if (g) {
    const letters = Object.entries(g.wins).map(([t, w]) => 'team' + t + ' ' + LETTERS.slice(0, w).padEnd(g.winsToFinish || 7, '·')).join('  ');
    h += `<div>Round ${g.round} <i>${g.phase}</i> holder <b>${esc(g.holder || '-')}</b> | ${letters}</div>`;
    h += '<div>' + cardsHtml(g.hand) + '</div>';
    h += '<div class="row">' + g.hand.map((c, t) => c && g.phase === 'playing' ? `<button class="alt" data-a="pass" data-c="${t}">pass ${CARDS[t].glyph}</button>` : '').join('') + '</div>';
    const ring = g.seats.length ? g.seats : r.order;
    h += '<div class="row">' + ring.filter((id) => id !== me).map((id) =>
      `<button class="alt" data-a="susp" data-t="${esc(id)}">suspect ${esc(id)} (${g.points[id] ?? '?'})</button>`).join('') + '</div>';
    h += '<div class="row"><button data-a="proc">Jackpot!</button><button class="alt" data-a="vend">vote end</button></div>';
    if (g.reveal) h += `<div class="warn">Reveal ${g.reveal.required} of: ${g.reveal.options.map((t) => `<button data-a="reveal" data-t="${t}">${CARDS[t].glyph}</button>`).join('')} <button data-a="revgo">send chosen</button></div>`;
  }
  if (r.phase === 'playing' && g && g.phase === 'waiting') {
    h += '<div class="row"><button data-a="ready">Ready</button><input class="chat" placeholder="team chat"><button data-a="chat" class="alt">Send</button></div>';
    h += '<div class="mute">' + r.chat.slice(-4).map((m) => esc(m.from) + ': ' + esc(m.text)).join(' / ') + '</div>';
  }
  v.innerHTML = h;
  const on = (sel, fn) => v.querySelectorAll(sel).forEach((b) => (b.onclick = () => fn(b)));
  on('[data-a=leave]', () => act(seat, 'leave'));
  on('[data-a=start]', () => act(seat, 'start_now'));
  on('[data-a=acc]', (b) => act(seat, 'accept_partner', { from: b.dataset.f }));
  on('[data-a=pass]', (b) => act(seat, 'pass', { card: +b.dataset.c }));
  on('[data-a=susp]', (b) => act(seat, 'suspect', { target: b.dataset.t }));
  on('[data-a=proc]', () => act(seat, 'proclaim'));
  on('[data-a=vend]', () => act(seat, 'vote_end', { agree: true }));
  on('[data-a=ready]', () => act(seat, 'ready', { ready: true }));
  on('[data-a=chat]', () => { const i = v.querySelector('.chat'); act(seat, 'team_chat', { text: i.value }); i.value = ''; });
  const chosen = (seat.chosen = seat.chosen || new Set());
  on('[data-a=reveal]', (b) => { chosen.has(+b.dataset.t) ? chosen.delete(+b.dataset.t) : chosen.add(+b.dataset.t); b.style.outline = chosen.has(+b.dataset.t) ? '2px solid #fbbf24' : ''; });
  v.querySelectorAll('[data-a=reveal]').forEach((b) => { if (chosen.has(+b.dataset.t)) b.style.outline = '2px solid #fbbf24'; });
  on('[data-a=revgo]', () => act(seat, 'reveal', { types: [...chosen] }));
}

async function connectAll() {
  disconnectAll();
  const n = Math.min(10, Math.max(2, +$('count').value || 4));
  for (let i = 0; i < n; i++) {
    const seat = makeSeat(i);
    seat.net.url = $('server').value;
    seat.net.connect();
    seats.push(seat);
  }
  await sleep(400);
  $('top').textContent = n + ' seats';
}

function disconnectAll() {
  for (const s of seats) { s.net.close(); s.el.remove(); }
  seats.length = 0;
}

// seat 1 creates a room, the rest join, pairs 1-2, 3-4, ..., seat 1 starts, everyone readies.
// An odd seat out stays out of the room.
async function scenario() {
  const n = seats.length - (seats.length % 2);
  const room = (await seats[0].net.request('create_room')).d.room;
  for (let i = 1; i < n; i++) await act(seats[i], 'join', { room });
  for (let i = 0; i < n; i += 2) {
    await act(seats[i], 'invite_partner', { to: seats[i + 1].name });
    await sleep(60);
    await act(seats[i + 1], 'accept_partner', { from: seats[i].name });
  }
  await sleep(150);
  await act(seats[0], 'start_now');
  await sleep(250);
  for (let i = 0; i < n; i++) await act(seats[i], 'ready', { ready: true });
  return room;
}

$('connect').onclick = connectAll;
$('disconnect').onclick = disconnectAll;
$('autoproc').onchange = (e) => { autoProclaim = e.target.checked; };
$('scenario').onclick = () => scenario().catch((e) => ($('top').textContent = 'scenario failed: ' + e.message));
// refresh countdowns, but never wipe a seat the user is typing in
setInterval(() => seats.forEach((s) => { if (!s.el.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') render(s); }), 1000);

// handy for console and headless tests
window.harness = { setAuto: (v) => seats.forEach((s) => { s.auto = v; if (v) autoStep(s); }), setAutoProclaim: (v) => { autoProclaim = v; }, seats, connectAll, scenario, disconnectAll, act };
