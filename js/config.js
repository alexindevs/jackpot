// Where the game server lives. Override per page load with ?server=wss://host/ws
export const DEFAULT_SERVER = 'wss://jackpot-backend-wkt0.onrender.com/ws';

export const HIDDEN = 255;
export const CARDS = [
  { name: 'circle', glyph: '●' },
  { name: 'triangle', glyph: '▲' },
  { name: 'cross', glyph: '✚' },
  { name: 'square', glyph: '■' },
];
export const LETTERS = 'JACKPOT';

export function serverUrl() {
  const s = new URLSearchParams(location.search).get('server');
  if (s) return s;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://127.0.0.1:8080/ws';
  return DEFAULT_SERVER;
}

// ?dev=alice signs in as "dev:alice" (the backend only accepts this in dev mode)
export function devName() {
  return new URLSearchParams(location.search).get('dev');
}
