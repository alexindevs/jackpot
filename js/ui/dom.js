export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "m:ss" for a time remaining in ms, or "Xh YYm" when it is an hour or more
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return Math.floor(s / 3600) + 'h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + 'm';
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Brings `from` in line with `to` without replacing nodes that already match, so a text field being typed in keeps its
// focus, caret and any half-composed text (replacing it hides the phone keyboard). Only the field's attributes are synced.
export function morph(from, to) {
  const old = [...from.childNodes], next = [...to.childNodes];
  next.forEach((y, i) => {
    const x = old[i];
    if (!x) { from.appendChild(y); return; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { from.replaceChild(y, x); return; }
    if (x.nodeType !== 1) { if (x.data !== y.data) x.data = y.data; return; }
    if (x.isEqualNode(y)) return;
    for (const a of [...x.attributes]) if (!y.hasAttribute(a.name)) x.removeAttribute(a.name);
    for (const a of y.attributes) if (x.getAttribute(a.name) !== a.value) x.setAttribute(a.name, a.value);
    if (x.nodeName !== 'INPUT' && x.nodeName !== 'TEXTAREA') morph(x, y);
  });
  old.slice(next.length).forEach((x) => x.remove());
}
