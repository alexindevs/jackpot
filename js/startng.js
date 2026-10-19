// start.ng helpers: connect-page identity, session from the URL hash, sign-in link.
const ORIGIN = 'https://start.ng';
const KEY = 'startng_session';

export function readSession() {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const fresh = h.get('startng_session');
    if (fresh) {
      sessionStorage.setItem(KEY, fresh);
      sessionStorage.setItem(KEY + '_exp', String(Date.now() + (+h.get('expires_in') || 7200) * 1000));
      history.replaceState(null, '', location.pathname + location.search);
    }
    return sessionStorage.getItem(KEY);
  } catch { return null; }
}

export function clearSession() {
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY + '_exp'); } catch { /* storage unavailable */ }
}

export function sessionExpiresAt() {
  try { return +sessionStorage.getItem(KEY + '_exp') || 0; } catch { return 0; }
}

// start.ng has no silent refresh, so a new session means a round trip through sign-in. Tried at most once per
// 10 minutes so a refusal can never become a redirect loop. Resolves false when it did not redirect.
export function refreshSession() {
  try {
    const last = +sessionStorage.getItem(KEY + '_refresh') || 0;
    if (Date.now() - last < 10 * 60 * 1000) return Promise.resolve(false);
    sessionStorage.setItem(KEY + '_refresh', String(Date.now()));
  } catch { return Promise.resolve(false); }
  location.href = signInUrl();
  return new Promise(() => {}); // the page is leaving
}

export function signInUrl() {
  return ORIGIN + '/?return_to=' + encodeURIComponent(location.origin + location.pathname);
}

// Hidden connect iframe; replies are only trusted from start.ng and from our own iframe.
export function connectPage() {
  const frame = document.createElement('iframe');
  frame.src = ORIGIN + '/connect';
  frame.hidden = true;
  document.body.append(frame);
  const pending = new Map();
  let n = 0;
  const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
  window.addEventListener('message', (e) => {
    if (e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
    const cb = pending.get((e.data || {}).requestId);
    if (cb) { pending.delete(e.data.requestId); cb(e.data); }
  });
  async function ask(msg, replyType, ms = 6000) {
    await loaded;
    return new Promise((resolve, reject) => {
      const id = 'r' + ++n;
      const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, ms);
      pending.set(id, (d) => { clearTimeout(t); d.type === replyType ? resolve(d) : reject(new Error('unexpected ' + d.type)); });
      frame.contentWindow.postMessage({ requestId: id, ...msg }, ORIGIN);
    });
  }
  return { whoami: () => ask({ type: 'startng:whoami' }, 'startng:user') };
}
