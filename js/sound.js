// Game sounds, synthesised with the Web Audio API: kalimba and marimba plucks, a talking-drum glide, a shekere tick,
// all on a pentatonic scale with an 8-bit edge. No audio files. Mute and volume persist in localStorage.
const KEY = 'jackpot_sound';
const prefs = { muted: false, volume: 0.6 };
try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o) { prefs.muted = !!o.muted; if (typeof o.volume === 'number') prefs.volume = Math.min(1, Math.max(0, o.volume)); }
} catch { /* storage unavailable: defaults */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ } };

export const isMuted = () => prefs.muted;
export const getVolume = () => prefs.volume;
export function setMuted(v) { prefs.muted = !!v; applyGain(); save(); }
export function setVolume(v) { prefs.volume = Math.min(1, Math.max(0, +v || 0)); applyGain(); save(); }

let ac = null, master = null, noise = null, out = null; // out: where the cue being scheduled sends its voices

function engine() {
  if (ac) return ac;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ac = new C();
  // a compressor keeps stacked voices from clipping
  const comp = ac.createDynamicsCompressor();
  master = ac.createGain();
  master.connect(comp);
  comp.connect(ac.destination);
  noise = ac.createBuffer(1, ac.sampleRate >> 1, ac.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  applyGain();
  return ac;
}

function applyGain() { if (master) master.gain.value = prefs.muted ? 0 : prefs.volume ** 2; }

// Browsers keep audio locked until the first tap or key press.
function unlock() {
  const a = engine();
  if (!a) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  if (a.state === 'running') for (const ev of ['pointerdown', 'keydown', 'touchend']) removeEventListener(ev, unlock, true);
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, true);

// ---- voices ---------------------------------------------------------------------------------------------------

function osc(a, type, t, f, dur, peak, to, lp) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  let tail = g;
  if (lp) { tail = a.createBiquadFilter(); tail.type = 'lowpass'; tail.frequency.value = lp; g.connect(tail); }
  tail.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

// kalimba: a bright tine over a short metallic partial
const kalimba = (a, t, f, p = 0.2) => { osc(a, 'triangle', t, f, 0.45, p); osc(a, 'sine', t, f * 4.1, 0.09, p * 0.4); };
// marimba: a woody pluck, the 4th partial dies quickly. len lets the last note of a phrase ring; lp muffles it.
const marimba = (a, t, f, p = 0.22, len = 0.3, lp) => { osc(a, 'sine', t, f, len, p, 0, lp); osc(a, 'sine', t, f * 4, 0.07, p * 0.35, 0, lp); };
// 8-bit blip
const blip = (a, t, f, d = 0.09, p = 0.07) => osc(a, 'square', t, f, d, p);
// talking drum: a sine that bends in pitch, with a tiny skin click
function drum(a, t, from, to, d = 0.2, p = 0.45) {
  osc(a, 'sine', t, from, d, p, to);
  osc(a, 'triangle', t, from * 2, d * 0.4, p * 0.2, to * 2);
}
// noise through a band-pass: shekere (static, bright) or swish (the band sweeps up, like a hand moving)
function noiseBurst(a, t, d, p, from, to) {
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noise;
  f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(p, t + Math.min(0.006, d / 2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t); s.stop(t + d + 0.02);
}
const shaker = (a, t, d = 0.07, p = 0.16) => noiseBurst(a, t, d, p, 6500);
const swish = (a, t, d = 0.08, p = 0.3) => noiseBurst(a, t, d, p, 900, 5500);
// a short wooden knock
const knock = (a, t, f, p = 0.2) => { osc(a, 'triangle', t, f, 0.07, p); shaker(a, t, 0.02, 0.25); };

// C major pentatonic: degree 0 is C4, 5 is C5, 10 is C6. The same notes read as A minor when they land on A.
const SCALE = [0, 2, 4, 7, 9];
const hz = (d) => 261.63 * 2 ** ((SCALE[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5)) / 12);
const run = (a, t, degs, step, voice, p) => degs.forEach((d, i) => voice(a, t + i * step, hz(d), p));
// a drum roll that speeds up and swells into the next beat
const roll = (a, t, gaps, from, p0, p1) => gaps.forEach((g, i) => drum(a, t + g, from + i * 14, (from + i * 14) * 0.7, 0.14, p0 + (p1 - p0) * (i / (gaps.length - 1))));

// ---- cues -----------------------------------------------------------------------------------------------------
// Each one is built from what it means: rising lines greet and celebrate, falling lines sag, a rising unfinished
// phrase asks a question, a half-step clash warns, and repeated pings demand an answer.
// level scales the whole cue; the signal knock is quiet and the same for every gesture.

export const CUES = {
  // someone speaks to the room: a bright rise, open and friendly
  chatPublic: { label: 'Public chat message', play: (a, t) => { kalimba(a, t, hz(10), 0.14); kalimba(a, t + 0.08, hz(12), 0.16); shaker(a, t + 0.08, 0.04, 0.05); } },
  // private word from your partner: low, muffled and leaning in, a soft fall
  chatTeam: { label: 'Team chat message', play: (a, t) => { marimba(a, t, hz(7), 0.22, 0.28, 1800); marimba(a, t + 0.11, hz(5), 0.2, 0.34, 1800); } },
  // someone arrives: a fifth-to-tonic lift, like a door chime
  joined: { label: 'Someone joined the lobby', play: (a, t) => { marimba(a, t, hz(8), 0.22); marimba(a, t + 0.11, hz(10), 0.24, 0.4); } },
  // the call to attention: a drum roll that speeds up and swells, then a bright chord and sparkle on the downbeat
  gameStarting: { label: 'Game starting', play: (a, t) => {
    roll(a, t, [0, 0.22, 0.38, 0.5, 0.59, 0.66], 130, 0.2, 0.5);
    [5, 8, 10].forEach((d) => kalimba(a, t + 0.8, hz(d), 0.2));
    drum(a, t + 0.8, 120, 70, 0.4, 0.5);
    shaker(a, t + 0.8, 0.3, 0.3);
    kalimba(a, t + 1.0, hz(13), 0.13); kalimba(a, t + 1.12, hz(15), 0.12);
  } },
  // "go": two quick drum taps, then the high tonic lands
  roundStart: { label: 'Round start', play: (a, t) => { drum(a, t, 210, 150, 0.1, 0.35); drum(a, t + 0.1, 260, 180, 0.12, 0.4); marimba(a, t + 0.2, hz(10), 0.26, 0.4); kalimba(a, t + 0.2, hz(13), 0.1); } },
  // short-short-short-long up to the top, then glitter
  roundWon: { label: 'Round won', play: (a, t) => {
    run(a, t, [5, 7, 8], 0.075, marimba, 0.2);
    [10, 12, 13].forEach((d) => marimba(a, t + 0.3, hz(d), 0.2, 0.5));
    kalimba(a, t + 0.3, hz(15), 0.12);
    [0.3, 0.38, 0.46].forEach((d) => shaker(a, t + d, 0.06, 0.15));
  } },
  // sinking: three notes falling onto the minor tonic, with a drum bending down
  roundLost: { label: 'Round lost', play: (a, t) => {
    marimba(a, t, hz(9), 0.2, 0.3, 2200); marimba(a, t + 0.16, hz(7), 0.2, 0.3, 2200); marimba(a, t + 0.32, hz(4), 0.24, 0.6, 2200);
    drum(a, t + 0.32, 200, 90, 0.4, 0.3);
  } },
  // the biggest one: a swelling roll, a two-octave run, a ringing chord with echoes
  gameWon: { label: 'Game won', play: (a, t) => {
    roll(a, t, [0, 0.14, 0.26, 0.36, 0.44, 0.5], 140, 0.25, 0.5);
    run(a, t + 0.62, [5, 7, 8, 10, 12, 13, 15], 0.075, kalimba, 0.18);
    [10, 12, 15].forEach((d) => marimba(a, t + 1.2, hz(d), 0.22, 0.8));
    kalimba(a, t + 1.2, hz(17), 0.08);
    drum(a, t + 1.2, 110, 70, 0.5, 0.5);
    [0, 0.1, 0.2, 0.3].forEach((d) => shaker(a, t + 1.2 + d, 0.07, 0.15));
    kalimba(a, t + 1.5, hz(10), 0.09); kalimba(a, t + 1.7, hz(10), 0.05);
  } },
  // final: slow fall, the last note low and long, the drum sagging beneath it
  gameLost: { label: 'Game lost', play: (a, t) => {
    run(a, t, [9, 8, 7], 0.24, (x, tt, f, p) => marimba(x, tt, f, p, 0.34, 1800), 0.2);
    marimba(a, t + 0.72, hz(4), 0.26, 1.0, 1500);
    blip(a, t + 0.72, hz(-1), 0.6, 0.03);
    drum(a, t + 0.72, 160, 55, 0.7, 0.4);
  } },
  // neither: it goes up, comes back, and shrugs
  gameDraw: { label: 'Game drawn', play: (a, t) => { marimba(a, t, hz(8), 0.2); marimba(a, t + 0.2, hz(7), 0.2); marimba(a, t + 0.4, hz(8), 0.2, 0.5); } },
  // a secret nudge: two soft knocks
  signal: { label: 'Signal received', level: 0.9, play: (a, t) => { knock(a, t, hz(11)); knock(a, t + 0.085, hz(11), 0.16); } },
  // handed to you: a swish of the hand, then the catch lands on the tonic and calls up to the fifth ("your move")
  passed: { label: 'Card passed to you', play: (a, t) => { swish(a, t, 0.08, 0.3); kalimba(a, t + 0.08, hz(10), 0.2); kalimba(a, t + 0.18, hz(13), 0.15); } },
  // an accusation: two low hits a half-step apart, the second one falling
  suspicion: { label: 'Suspicion raised', play: (a, t) => {
    drum(a, t, 200, 150, 0.12, 0.45); blip(a, t, 330, 0.2, 0.08);
    drum(a, t + 0.2, 185, 120, 0.25, 0.5); blip(a, t + 0.2, 311, 0.35, 0.08);
  } },
  // a question put to you: two drum phrases that rise and do not resolve, then three urgent pings on the same note
  reveal: { label: 'Reveal asked of you', play: (a, t) => {
    drum(a, t, 150, 300, 0.18, 0.45); drum(a, t + 0.26, 180, 360, 0.18, 0.45);
    [0.6, 0.72, 0.84].forEach((d) => kalimba(a, t + d, hz(13), 0.15));
  } },
};

export function play(name) {
  const cue = CUES[name];
  if (!cue || prefs.muted || prefs.volume === 0) return;
  const a = engine();
  if (!a || a.state !== 'running') return;
  out = a.createGain();
  out.gain.value = cue.level || 1;
  out.connect(master);
  cue.play(a, a.currentTime + 0.02);
}

// For the test page, where the click that asks for the sound is itself the unlock.
export async function preview(name) {
  const a = engine();
  if (a && a.state !== 'running') await a.resume().catch(() => {});
  play(name);
}

// Which cue a server message calls for. c: { me, player, myTeam, lobby }. Spectators only get joins, chat,
// game start, game end and round results, never the per-card cues.
export function cueFor(m, c) {
  const d = m.d || {};
  switch (m.t) {
    case 'chat_message': return d.from !== c.me ? 'chatPublic' : null;
    case 'team_chat_message': return c.player && d.from !== c.me ? 'chatTeam' : null;
    case 'member_joined': return c.lobby && d.player !== c.me ? 'joined' : null;
    case 'game_starting': return 'gameStarting';
    case 'signal': return c.player && d.from !== c.me ? 'signal' : null;
    case 'game_event':
      switch (m.kind) {
        case 'round_started': return c.player ? 'roundStart' : null;
        case 'round_won': return c.player && c.myTeam !== d.team ? 'roundLost' : 'roundWon';
        case 'game_over':
          if (d.result && d.result.draw) return 'gameDraw';
          return c.player && c.myTeam !== d.result.winner ? 'gameLost' : 'gameWon';
        case 'passed': return c.player && d.to === c.me ? 'passed' : null;
        case 'suspicion_raised': return c.player && d.by !== c.me ? 'suspicion' : null;
        case 'reveal_requested': return c.player ? 'reveal' : null;
      }
  }
  return null;
}
