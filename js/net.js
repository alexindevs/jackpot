// One WebSocket to the game server: auth first, request ids, idempotency keys, heartbeat watchdog,
// reconnect with backoff and jitter.
const NO_KEY = new Set(['ping', 'list_rooms', 'resume']);
const WATCHDOG_MS = 50000;   // the server sends a heartbeat every 20s
const STABLE_MS = 30000;     // a connection this old resets the backoff

const randomKey = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export class Net extends EventTarget {
  // beforeConnect: optional async hook run before every (re)connect, e.g. to refresh the sign-in session.
  constructor({ url, getToken, beforeConnect, label = '' }) {
    super();
    this.url = url;
    this.getToken = getToken;
    this.beforeConnect = beforeConnect;
    this.label = label;
    this.status = 'closed';
    this.nextId = 1;
    this.pending = new Map();   // id -> { type, fields, key, resolve, reject, timer, sent }
    this.retries = 0;
    this.stopped = false;
    this.lastRx = 0;
    this.helloAt = 0;
    this.watchdog = null;
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  setStatus(status, extra) {
    this.status = status;
    this.emit('status', { status, ...extra });
  }

  async connect() {
    this.stopped = false;
    clearTimeout(this.timer);
    this.setStatus('connecting');
    if (this.beforeConnect) { try { await this.beforeConnect(); } catch { /* connect anyway */ } }
    if (this.stopped) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.lastRx = Date.now();
      ws.send(JSON.stringify({ type: 'auth', token: this.getToken() }));
      this.setStatus('open');
      clearInterval(this.watchdog);
      // no message of any kind for ~50s: the connection is dead, even if the browser has not noticed
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastRx > WATCHDOG_MS && this.ws === ws) ws.close(4000, 'watchdog');
      }, 5000);
    };
    ws.onmessage = (e) => {
      this.lastRx = Date.now();
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'hello') this.helloAt = Date.now();
      if (msg.id !== undefined && ['ok', 'error', 'rooms', 'room_created', 'pong'].includes(msg.t)) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.t === 'error') p.reject(Object.assign(new Error(msg.d.message), { code: msg.d.code }));
          else p.resolve(msg);
        }
      }
      this.emit('message', msg);
    };
    ws.onclose = (e) => {
      clearInterval(this.watchdog);
      if (this.ws !== ws) return;
      // keyed actions that were not answered stay queued: they are resent with the same key after reconnecting
      for (const [id, p] of this.pending) {
        if (!p.key || this.stopped || e.code === 4401 || e.code === 4409) { this.pending.delete(id); clearTimeout(p.timer); p.reject(Object.assign(new Error('socket closed'), { code: 'closed' })); }
      }
      const stable = this.helloAt && Date.now() - this.helloAt >= STABLE_MS;
      if (stable) this.retries = 0;
      this.helloAt = 0;
      this.setStatus('closed', { code: e.code });
      if (this.stopped) return;
      // 4409: another tab took over. 4401: needs a new sign-in. Neither retries blindly.
      if (e.code === 4409 || e.code === 4401) { this.stopped = true; return; }
      const base = Math.min(30000, 1000 * 2 ** this.retries++);
      const delay = Math.round(base * (0.5 + Math.random() * 0.5));
      this.setStatus('waiting', { retryIn: delay });
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  // Called when the tab becomes visible again or the network comes back. A sleeping tab or phone can lose the socket
  // without the page noticing, and its timers run late, so do not wait for the watchdog or a long backoff.
  checkNow() {
    if (this.stopped) return;
    if (this.status === 'waiting') { clearTimeout(this.timer); this.retries = 0; this.connect(); return; }
    if (this.open && Date.now() - this.lastRx > 30000) this.ws.close(4000, 'stale'); // the server speaks at least every 20s
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.watchdog);
    if (this.ws) this.ws.close(1000);
  }

  get open() { return !!this.ws && this.ws.readyState === WebSocket.OPEN; }

  // Resolves with the server's reply, rejects with an Error that has .code
  request(type, fields = {}) {
    return new Promise((resolve, reject) => {
      if (!this.open) return reject(Object.assign(new Error('not connected'), { code: 'closed' }));
      const id = this.nextId++;
      const key = NO_KEY.has(type) ? undefined : randomKey();
      // a keyed action may wait out a reconnect; the others fail fast
      const ms = key ? 120000 : 8000;
      const timer = setTimeout(() => { this.pending.delete(id); reject(Object.assign(new Error('no reply'), { code: 'timeout' })); }, ms);
      this.pending.set(id, { type, fields, key, resolve, reject, timer });
      this.ws.send(JSON.stringify({ type, id, ...(key ? { key } : {}), ...fields }));
    });
  }

  // After a reconnect and catch-up: send every unanswered keyed action again with its original key.
  resendPending() {
    for (const [id, p] of this.pending) {
      if (p.key && this.open) this.ws.send(JSON.stringify({ type: p.type, id, key: p.key, ...p.fields }));
    }
  }

  sendRaw(text) { this.ws.send(text); }
}
