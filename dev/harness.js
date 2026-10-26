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

// Restart test: a game (p1 locked out of calling Jackpot) and a lobby are set up, then you stop and start the server (started
// with DATABASE_URL). Every fake player reconnects, asks for my_games and resumes; the checks say whether each one lands in a
// paused room and then a resumed one.
async function restartTest() {
  const out = $('rt-log'), lines = [];
  $('rt').hidden = false;
  const show = () => { out.textContent = lines.join('\n'); };
  const note = (mark, text) => { lines.push(mark + ' ' + text); show(); return mark === '✓'; };
  const check = (ok, text) => note(ok ? '✓' : '✗', text);
  const waitFor = async (cond, ms, label) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (cond()) return true; await sleep(100); }
    note('✗', 'timed out: ' + label);
    return false;
  };
  const room = (name) => seats.find((s) => s.name === name).state.room;
  try {
    $('count').value = 6;
    await connectAll();
    await sleep(1200);
    const [p1, p2, p3, p4, p5, p6] = seats;
    for (const s of seats) { s.resumed = 0; s.net.addEventListener('message', (e) => { if (e.detail.t === 'resumed') s.resumed++; }); }

    // the game: p1+p2 against p3+p4
    const game = (await p1.net.request('create_room')).d.room;
    for (const s of [p2, p3, p4]) await s.net.request('join', { room: game });
    for (const [a, b] of [[p1, p2], [p3, p4]]) { await a.net.request('invite_partner', { to: b.name }); await sleep(60); await b.net.request('accept_partner', { from: a.name }); }
    await sleep(150);
    await p1.net.request('start_now'); await sleep(250);
    for (const s of [p1, p2, p3, p4]) await s.net.request('ready', { ready: true });
    await waitFor(() => room('p1') && room('p1').game && room('p1').game.phase === 'playing', 10000, 'the game to start');
    // p1 gets locked out: p2 must not hold the passing card, then p1 calls Jackpot falsely until the lockout starts
    for (let i = 0; i < 6 && room('p1').game.holder === 'p2'; i++) {
      const g = room('p2').game; await p2.net.request('pass', { card: g.hand.findIndex((c) => c > 0) }); await sleep(300);
    }
    for (let i = 0; i < 4 && !room('p1').timers.some((t) => t.kind === 'proclaim'); i++) { await p1.net.request('proclaim').catch(() => {}); await sleep(500); }
    check(room('p1').timers.some((t) => t.kind === 'proclaim'), 'game ' + game + ' running, p1 locked out of calling Jackpot');

    // the lobby: p5+p6
    const lobby = (await p5.net.request('create_room')).d.room;
    await p6.net.request('join', { room: lobby });
    await p5.net.request('invite_partner', { to: p6.name }); await sleep(60); await p6.net.request('accept_partner', { from: p5.name });
    await sleep(200);
    check(!!room('p5') && room('p5').phase === 'lobby', 'lobby ' + lobby + ' open with p5 and p6 paired');

    note('…', 'NOW stop the server and start it again (with DATABASE_URL). Waiting for the connections to drop.');
    await waitFor(() => seats.every((s) => s.net.status !== 'open'), 600000, 'the server to stop');
    for (const s of seats) { s.state.room = null; s.state.myGames = []; s.auto = false; } // what the page would forget
    check(true, 'all 6 sockets dropped');
    const t0 = Date.now();
    note('…', 'waiting for the players to reconnect (they retry with backoff, up to 30s apart)');
    if (!await waitFor(() => seats.every((s) => s.net.status === 'open' && s.state.me), 120000, 'every player to reconnect')) return;
    check(true, 'all 6 reconnected after ' + Math.round((Date.now() - t0) / 1000) + 's');
    check(seats.every((s) => !s.state.room), 'nobody is put back into a room on their own');

    // my_games
    for (const s of seats) await s.net.request('my_games').catch((e) => note('✗', s.name + ' my_games: ' + e.code));
    const listed = (s, kind, id) => s.state.myGames.length === 1 && s.state.myGames[0].kind === kind && s.state.myGames[0].room === id;
    check([p1, p2, p3, p4].every((s) => listed(s, 'game', game)), 'p1 to p4 each list the paused game');
    check([p5, p6].every((s) => listed(s, 'lobby', lobby)), 'p5 and p6 each list the paused lobby');

    // resume the game, three players first: it must stay paused until the fourth is back
    for (const s of [p1, p2, p3]) await s.net.request('resume_game', { room: game }).catch((e) => note('✗', s.name + ' resume_game: ' + e.code));
    await waitFor(() => [p1, p2, p3].every((s) => room(s.name)), 5000, 'p1 to p3 to be in the game');
    check([p1, p2, p3].every((s) => room(s.name) && room(s.name).paused), 'p1 to p3 are in the game and it is paused');
    await p4.net.request('resume_game', { room: game }).catch((e) => note('✗', 'p4 resume_game: ' + e.code));
    await waitFor(() => [p1, p2, p3, p4].every((s) => s.resumed > 0), 8000, 'everyone to get "resumed"');
    check([p1, p2, p3, p4].every((s) => room(s.name) && !room(s.name).paused && room(s.name).game.phase), 'the game resumed for all four');
    await sleep(500);
    const lock = room('p1').timers.find((t) => t.kind === 'proclaim');
    check(!!lock && room('p1').game.proclaimRevoked.p1 === true, 'p1 is still locked out, ' + (lock ? Math.round((lock.endsAt - Date.now()) / 1000) + 's left' : 'no timer'));

    // resume the lobby
    await p5.net.request('resume_game', { room: lobby }).catch((e) => note('✗', 'p5 resume_game: ' + e.code));
    await waitFor(() => room('p5'), 5000, 'p5 to be in the lobby');
    check(!!room('p5') && !!room('p5').paused, 'p5 is in the lobby and it is paused');
    await p6.net.request('resume_game', { room: lobby }).catch((e) => note('✗', 'p6 resume_game: ' + e.code));
    await waitFor(() => p5.resumed > 0 && p6.resumed > 0, 8000, 'the lobby to resume');
    check([p5, p6].every((s) => room(s.name) && !room(s.name).paused && room(s.name).phase === 'lobby'), 'the lobby resumed for both');
    check(room('p5').players.p5.partner === 'p6' && room('p5').players.p6.partner === 'p5', 'p5 and p6 are still partners');

    const bad = lines.filter((l) => l.startsWith('✗')).length;
    note(bad ? '✗' : '✓', bad ? bad + ' check(s) failed' : 'ALL CHECKS PASSED');
  } catch (e) {
    note('✗', 'the test stopped: ' + (e.message || e));
  }
}
$('restart').onclick = restartTest;

// handy for console and headless tests
window.harness = { setAuto: (v) => seats.forEach((s) => { s.auto = v; if (v) autoStep(s); }), setAutoProclaim: (v) => { autoProclaim = v; }, seats, connectAll, scenario, disconnectAll, act, restartTest };
