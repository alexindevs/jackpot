// Signal palette: a searchable, grouped list of gestures. The vocabulary comes from the server, nothing is hard-coded.
import { esc } from './dom.js';

let overlay = null, lastFocus = null;

export function closePalette() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', onKey, true);
  const back = document.contains(lastFocus) ? lastFocus : document.querySelector('[data-act="signal-palette"]');
  if (back) back.focus();
}

function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closePalette(); }
}

function list(gestures, q) {
  const needle = q.trim().toLowerCase();
  const groups = new Map();
  for (const g of gestures) {
    if (needle && !(g.label.toLowerCase().includes(needle) || g.seen.toLowerCase().includes(needle) || g.group.toLowerCase().includes(needle))) continue;
    if (!groups.has(g.group)) groups.set(g.group, []);
    groups.get(g.group).push(g);
  }
  if (!groups.size) return '<p class="mute">Nothing matches. Try another word.</p>';
  return [...groups].map(([name, items]) => `<h3>${esc(name)}</h3><div class="gestures">${
    items.map((g) => `<button class="alt" data-gesture="${esc(g.id)}" title="${esc(g.seen)}">${esc(g.label)}</button>`).join('')}</div>`).join('');
}

export function openPalette(gestures, onPick) {
  if (overlay) return;
  lastFocus = document.activeElement;
  overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="sig-title">
    <div class="modal-head"><h2 id="sig-title">Send a signal</h2><button class="alt" data-close aria-label="Close">✕</button></div>
    <div class="modal-body">
      <p class="mute sm">Your partner always sees it. Most signals are seen by the whole table too. You won't be told who saw yours.</p>
      <input id="sig-search" type="search" placeholder="Search ${gestures.length} signals" autocomplete="off" style="width:100%">
      <div id="sig-list">${gestures.length ? list(gestures, '') : '<p class="mute">The signal list has not arrived yet. Close this and try again in a moment.</p>'}</div>
    </div>
  </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) return closePalette();
    const b = e.target.closest('[data-gesture]');
    if (b) { const id = b.dataset.gesture; closePalette(); onPick(id); }
  });
  overlay.querySelector('#sig-search').addEventListener('input', (e) => { overlay.querySelector('#sig-list').innerHTML = list(gestures, e.target.value); });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  overlay.querySelector('#sig-search').focus();
}
