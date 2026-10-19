// Pure state reducer: reduce(state, serverMessage) -> new state. No DOM, no sockets.
import { LETTERS } from './config.js';

export const initial = () => ({
  me: null, offset: 0, profiles: {}, rooms: [], room: null, closed: null,
  invites: { partner: [], room: [] },
});

const clone = (o) => JSON.parse(JSON.stringify(o));
const LOG_MAX = 200;

// server time (ISO string) -> client epoch ms, corrected for clock skew
const when = (s, iso) => Date.parse(iso) - s.offset;

function say(s, text) {
  if (!s.room) return;
  s.room.log.push({ text });
  if (s.room.log.length > LOG_MAX) s.room.log.shift();
}

export const nameOf = (s, id) => (s.profiles[id] && s.profiles[id].name) || id;

function newRoom(id) {
  return {
    id, creator: null, phase: 'lobby', players: {}, order: [], spectators: 0,
    timers: [], countdownEndsAt: null, chat: [], pub: [], lastPubId: 0, log: [], game: null,
  };
}

function newGame() {
  return {
    round: 0, phase: 'waiting', holder: '', seats: [], wins: {}, points: {}, suspicionPoints: 3, winsToFinish: 7,
    hand: [0, 0, 0, 0], hands: {}, pendingReveals: [], forcedPass: '',
    reveal: null, result: null, votes: {}, proclaimRevoked: {}, lastReveal: null,
  };
}

function setTimer(room, t) {
  room.timers = room.timers.filter((x) => !(x.kind === t.kind && (t.kind === 'reconnect' ? x.player === t.player : true)));
  room.timers.push(t);
}
const dropTimers = (room, kind, player) =>
  (room.timers = room.timers.filter((x) => !(x.kind === kind && (player === undefined || x.player === player))));

function fromSnapshot(s, d) {
  const r = newRoom(d.room);
  r.creator = d.creator;
  r.phase = d.phase;
  r.spectators = d.spectators;
  for (const p of d.players) { r.players[p.id] = p; r.order.push(p.id); }
  r.pub = (d.chat || []).map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at }));
  r.lastPubId = r.pub.reduce((a, m) => Math.max(a, m.id), 0);
  r.timers = d.timers.map((t) => ({ kind: t.kind, player: t.player, endsAt: when(s, t.endsAt) }));
  const cd = r.timers.find((t) => t.kind === 'countdown');
  if (cd) r.countdownEndsAt = cd.endsAt;
  if (d.game) {
    const g = d.game;
    r.game = {
      ...newGame(), round: g.round, phase: g.phase, holder: g.holder, seats: g.seats,
      wins: g.wins, points: g.points, hand: g.yourHand || [0, 0, 0, 0], hands: g.hands || {},
      pendingReveals: g.pendingReveals, forcedPass: g.forcedPass || '',
    };
  }
  return r;
}

function addPublic(r, m) {
  if (m.id <= r.lastPubId) return; // already seen (live line vs. polled line)
  r.pub.push({ id: m.id, from: m.from, text: m.text, at: m.at });
  r.lastPubId = m.id;
  if (r.pub.length > 300) r.pub.shift();
}

export function reduce(prev, msg) {
  const s = clone(prev);
  const d = msg.d || {};
  switch (msg.t) {
    case 'hello':
      s.me = d.you.id;
      s.profiles[d.you.id] = d.you;
      s.offset = Date.parse(d.serverTime) - Date.now();
      s.closed = null;
      break;
    case 'profile': s.profiles[d.id] = d; break;
    case 'rooms': s.rooms = d; break;
    case 'snapshot':
      s.room = fromSnapshot(s, d);
      s.closed = null;
      say(s, 'joined room ' + d.room);
      break;
    case 'room_closed':
      s.closed = d.reason;
      s.room = null;
      s.invites = { partner: [], room: [] };
      break;
    case '_chat_poll': // lines from the REST fallback: {id, text, at, player:{id,name,style}}
      if (s.room) for (const l of d.lines) { s.profiles[l.player.id] = l.player; addPublic(s.room, { id: l.id, from: l.player.id, text: l.text, at: l.at }); }
      break;
    case 'room_invite': s.invites.room.push(d); break;
    case 'partner_invite': s.invites.partner.push(d); break;
    case 'game_event': return reduceEvent(s, msg.kind, d);
    default:
      if (s.room) reduceRoom(s, msg.t, d);
  }
  return s;
}

function reduceRoom(s, t, d) {
  const r = s.room;
  switch (t) {
    case 'member_joined':
      if (!r.players[d.player]) { r.players[d.player] = { id: d.player, connected: true, partner: '', ready: false, removed: false, team: 0 }; r.order.push(d.player); }
      say(s, nameOf(s, d.player) + ' joined');
      break;
    case 'member_left':
      if (r.phase === 'lobby') { delete r.players[d.player]; r.order = r.order.filter((x) => x !== d.player); }
      else if (r.players[d.player]) r.players[d.player].removed = true;
      say(s, nameOf(s, d.player) + ' left (' + d.reason + ')');
      break;
    case 'partner_declined': say(s, nameOf(s, d.by) + ' declined your partner invite'); break;
    case 'team_formed':
      for (const [a, b] of [[d.a, d.b], [d.b, d.a]]) if (r.players[a]) r.players[a].partner = b;
      s.invites.partner = s.invites.partner.filter((i) => ![d.a, d.b].includes(i.from) && ![d.a, d.b].includes(i.to));
      say(s, nameOf(s, d.a) + ' and ' + nameOf(s, d.b) + ' are partners');
      break;
    case 'team_broken':
      for (const id of [d.a, d.b]) if (r.players[id]) r.players[id].partner = '';
      say(s, 'partnership broken');
      break;
    case 'countdown_started':
      r.countdownEndsAt = when(s, d.endsAt);
      setTimer(r, { kind: 'countdown', player: '', endsAt: r.countdownEndsAt });
      break;
    case 'countdown_cancelled': r.countdownEndsAt = null; dropTimers(r, 'countdown'); break;
    case 'game_starting': {
      r.phase = 'chat';
      r.countdownEndsAt = null;
      dropTimers(r, 'countdown');
      s.invites = { partner: [], room: [] };
      const g = newGame();
      d.teams.forEach((pair, i) => pair.forEach((id) => {
        if (r.players[id]) { r.players[id].team = i; r.players[id].partner = pair.find((x) => x !== id); }
        g.points[id] = d.suspicionPoints;
      }));
      g.seats = d.seats || [];
      g.suspicionPoints = d.suspicionPoints;
      g.winsToFinish = d.winsToFinish;
      d.teams.forEach((_, i) => (g.wins[i] = 0));
      d.demoted.forEach((id) => { if (r.players[id]) r.players[id].removed = true; });
      r.game = g;
      say(s, 'game starting');
      break;
    }
    case 'chat_started':
      dropTimers(r, 'hold'); dropTimers(r, 'chat');
      for (const p of Object.values(r.players)) p.ready = false;
      setTimer(r, { kind: 'chat', player: '', endsAt: when(s, d.endsAt) });
      r.phase = 'chat';
      if (r.game) { r.game.phase = 'waiting'; r.game.round = d.round; }
      say(s, 'team chat before round ' + d.round);
      break;
    case 'chat_message': addPublic(r, d); break;
    case 'ready_changed': if (r.players[d.player]) r.players[d.player].ready = d.ready; break;
    case 'team_chat_message': r.chat.push({ from: d.from, text: d.text }); break;
    case 'hand_update':
      if (!r.game) break;
      if (d.player === s.me) r.game.hand = d.hand;
      r.game.hands[d.player] = d.hand;
      break;
    case 'timer_started': setTimer(r, { kind: d.kind, player: d.player, endsAt: when(s, d.endsAt) }); break;
    case 'connection_changed':
      if (r.players[d.player]) r.players[d.player].connected = d.connected;
      dropTimers(r, 'reconnect', d.player);
      if (!d.connected && d.reconnectBy) setTimer(r, { kind: 'reconnect', player: d.player, endsAt: when(s, d.reconnectBy) });
      break;
  }
}

function reduceEvent(s, kind, d) {
  const r = s.room;
  if (!r) return s;
  if (!r.game) r.game = newGame();
  const g = r.game;
  const n = (id) => nameOf(s, id);
  switch (kind) {
    case 'seats_reshuffled': g.seats = d.seats; say(s, 'seats reshuffled'); break;
    case 'round_started':
      g.round = d.round; g.holder = d.holder; g.phase = 'playing'; g.reveal = null; g.forcedPass = '';
      g.pendingReveals = []; g.proclaimRevoked = {};
      for (const id of Object.keys(g.points)) g.points[id] = g.suspicionPoints;
      r.phase = 'playing';
      dropTimers(r, 'chat');
      say(s, 'round ' + d.round + ' started, ' + n(d.holder) + ' holds the passing card');
      break;
    case 'passed':
      g.holder = d.to;
      dropTimers(r, 'hold');
      say(s, n(d.from) + ' passed to ' + n(d.to) + (d.auto ? ' (auto)' : ''));
      break;
    case 'suspicion_raised':
      g.points[d.by] = d.pointsLeft;
      if (!g.pendingReveals.includes(d.target)) g.pendingReveals.push(d.target);
      say(s, n(d.by) + ' suspects ' + n(d.target) + ' (needs ' + d.required + ' types)');
      break;
    case 'reveal_requested':
      if (d.target === s.me) g.reveal = { required: d.required, options: d.options };
      break;
    case 'suspicion_freed':
      g.pendingReveals = g.pendingReveals.filter((x) => x !== d.target);
      if (d.target === s.me) g.reveal = null;
      dropTimers(r, 'reveal', d.target);
      g.lastReveal = { target: d.target, types: d.revealed };
      say(s, n(d.target) + ' was cleared, showing types ' + d.revealed.join(','));
      break;
    case 'suspicion_failed':
      g.pendingReveals = g.pendingReveals.filter((x) => x !== d.target);
      if (d.target === s.me) g.reveal = null;
      dropTimers(r, 'reveal', d.target);
      g.hands[d.target] = d.hand;
      say(s, n(d.target) + ' was CAUGHT with ' + d.hand.join('/'));
      break;
    case 'forced_pass_requested':
      g.forcedPass = d.player;
      say(s, n(d.player) + ' must pass a card');
      break;
    case 'player_reset':
      if (g.forcedPass === d.player) g.forcedPass = '';
      dropTimers(r, 'forced', d.player);
      say(s, n(d.player) + ' was reset');
      break;
    case 'false_proclaim':
      g.points[d.by] = d.pointsLeft;
      if (d.revoked) g.proclaimRevoked[d.by] = true;
      say(s, n(d.by) + ' proclaimed falsely' + (d.revoked ? ' and loses the right to proclaim' : ''));
      break;
    case 'round_won':
      g.wins[d.team] = d.wins; g.phase = 'waiting'; g.holder = ''; // d.wins is the winning team's new total
      for (const k of ['hold', 'reveal', 'forced']) dropTimers(r, k);
      g.pendingReveals = []; g.reveal = null; g.forcedPass = '';
      say(s, 'team ' + d.team + ' wins the round (' + (d.letter || LETTERS[d.wins - 1]) + '), proclaimed by ' + n(d.proclaimer));
      break;
    case 'team_removed':
      for (const id of d.members) if (r.players[id]) r.players[id].removed = true;
      say(s, 'team ' + d.team + ' removed');
      break;
    case 'vote_changed': g.votes[d.player] = d.agree; say(s, n(d.player) + ' votes ' + (d.agree ? 'to end' : 'to continue')); break;
    case 'game_over':
      g.phase = 'over'; g.result = d.result; r.phase = 'over';
      r.timers = [];
      say(s, 'game over: ' + (d.result.draw ? 'draw' : 'winner team ' + d.result.winner) + ' (' + d.result.reason + ')');
      break;
  }
  return s;
}
