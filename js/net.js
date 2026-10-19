// One WebSocket to the game server: auth first, request ids, reconnect with backoff.
export class Net extends EventTarget {
  constructor({ url, getToken, label = '' }) {
    super();
    this.url = url;
    this.getToken = getToken;
    this.label = label;
    this.status = 'closed';
    this.nextId = 1;
    this.waiting = new Map();
    this.retries = 0;
    this.stopped = false;
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  setStatus(status, extra) {
    this.status = status;
    this.emit('status', { status, ...extra });
  }

  connect() {
    this.stopped = false;
    clearTimeout(this.timer);
    this.setStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: this.getToken() }));
      this.setStatus('open');
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'hello') this.retries = 0;
      if ((msg.t === 'ok' || msg.t === 'error' || msg.t === 'rooms' || msg.t === 'room_created' || msg.t === 'pong') && msg.id !== undefined) {
        const w = this.waiting.get(msg.id);
        if (w) {
          this.waiting.delete(msg.id);
          if (msg.t === 'error') w.reject(Object.assign(new Error(msg.d.message), { code: msg.d.code }));
          else w.resolve(msg);
        }
      }
      this.emit('message', msg);
    };
    ws.onclose = (e) => {
      for (const w of this.waiting.values()) w.reject(Object.assign(new Error('socket closed'), { code: 'closed' }));
      this.waiting.clear();
      this.setStatus('closed', { code: e.code });
      if (this.ws !== ws || this.stopped) return;
      // 4409: another tab took over. 4401: needs a new sign-in. Neither retries blindly.
      if (e.code === 4409 || e.code === 4401) { this.stopped = true; return; }
      const delay = Math.min(15000, 500 * 2 ** this.retries++) + Math.random() * 300;
      this.setStatus('waiting', { retryIn: Math.round(delay) });
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.ws) this.ws.close(1000);
  }

  // Resolves with the server's reply, rejects with an Error that has .code
  request(type, fields = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(Object.assign(new Error('not connected'), { code: 'closed' }));
      const id = this.nextId++;
      const timeout = setTimeout(() => { this.waiting.delete(id); reject(Object.assign(new Error('no reply'), { code: 'timeout' })); }, 8000);
      this.waiting.set(id, {
        resolve: (m) => { clearTimeout(timeout); resolve(m); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      this.ws.send(JSON.stringify({ type, id, ...fields }));
    });
  }

  sendRaw(text) { this.ws.send(text); }
}
