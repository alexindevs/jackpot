// The signal list: a searchable, grouped set of gestures. The vocabulary comes from the server, nothing is hard-coded.
import { esc } from './dom.js';

export function gestureListHtml(gestures, q) {
  const needle = (q || '').trim().toLowerCase();
  const groups = new Map();
  for (const g of gestures) {
    if (needle && !(g.label.toLowerCase().includes(needle) || g.seen.toLowerCase().includes(needle) || g.group.toLowerCase().includes(needle))) continue;
    if (!groups.has(g.group)) groups.set(g.group, []);
    groups.get(g.group).push(g);
  }
  if (!gestures.length) return '<p class="mute">The signal list has not arrived yet. Close this and try again in a moment.</p>';
  if (!groups.size) return '<p class="mute">Nothing matches. Try another word.</p>';
  return [...groups].map(([name, items]) => `<h3>${esc(name)}</h3><div class="gestures">${
    items.map((g) => `<button class="alt" data-act="send-signal" data-gesture="${esc(g.id)}" title="${esc(g.seen)}">${esc(g.label)}</button>`).join('')}</div>`).join('');
}
