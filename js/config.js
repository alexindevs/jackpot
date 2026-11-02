// Where the game server lives. On a local page, override per load with ?server=wss://host/ws
export const DEFAULT_SERVER = 'wss://jackpot-backend-wkt0.onrender.com/ws';

export const HIDDEN = 255;
export const CARDS = [
  { name: 'circle', glyph: '●' },
  { name: 'triangle', glyph: '▲' },
  { name: 'cross', glyph: '✚' },
  { name: 'square', glyph: '■' },
];
export const LETTERS = 'JACKPOT';

// The socket lives at exactly /ws. A bare host, or a trailing slash, gets a 404 that the browser only reports as a failed
// connection, so fix those up instead of letting them fail quietly.
export function normalizeServerUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.pathname === '' || u.pathname === '/' || u.pathname === '/ws/') u.pathname = '/ws';
    return u.toString();
  } catch { return raw; }
}

// ?server= and ?dev= change where the session goes and who we sign in as, so only a page served from this machine may
// use them. On a public host a crafted link could otherwise send the player's session to someone else's server.
export function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

// The ?server= override, or null when it is absent, not ws(s)://, or the page is not local.
export function serverOverride(loc = location) {
  if (!isLocalHost(loc.hostname)) return null;
  const s = new URLSearchParams(loc.search).get('server');
  return s && /^wss?:\/\//i.test(s) ? s : null;
}

export function serverUrl(loc = location) {
  const s = serverOverride(loc);
  if (s) return normalizeServerUrl(s);
  if (isLocalHost(loc.hostname)) return 'ws://127.0.0.1:8080/ws';
  return normalizeServerUrl(DEFAULT_SERVER);
}

// ?dev=alice signs in as "dev:alice" (the backend only accepts this in dev mode)
export function devName(loc = location) {
  return isLocalHost(loc.hostname) ? new URLSearchParams(loc.search).get('dev') : null;
}
