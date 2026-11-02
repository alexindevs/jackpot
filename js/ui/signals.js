// The signal list: a searchable, grouped set of gestures. The vocabulary comes from the server, nothing is hard-coded.
import { esc } from './dom.js';

// A standby set for the pre-round chat: twenty signals spread across the groups, so a new player sees what kinds exist.
// Read-only. The text comes from the server's own list; an id the server doesn't have is skipped.
export const IDEAS = ['blink_once', 'blink_twice', 'wink_left', 'raise_eyebrow', 'look_left', 'sneeze', 'rub_nose', 'cough', 'clear_throat', 'yawn',
  'tap_table', 'crack_knuckles', 'nod', 'scratch_head', 'tap_foot', 'shake_leg', 'hum_anthem', 'say_oya', 'say_abeg', 'mention_jollof'];

export function ideasHtml(gestures) {
  if (!gestures.length) return '<p class="mute">The signal list has not arrived yet. Close this and try again in a moment.</p>';
  const byId = new Map(gestures.map((g) => [g.id, g]));
  return '<div class="ideas">' + IDEAS.filter((id) => byId.has(id)).map((id) => {
    const g = byId.get(id);
    return `<div class="idea"><b>${esc(g.label)}</b><small>${esc(g.seen)}</small></div>`;
  }).join('') + '</div>';
}

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
  return [...groups].map(([name, items]) => `<h4>${esc(name)}</h4><div class="gestures">${
    items.map((g) => `<button class="gesture" data-act="send-signal" data-gesture="${esc(g.id)}" title="${esc(g.seen)}">${esc(g.label)}</button>`).join('')}</div>`).join('');
}
