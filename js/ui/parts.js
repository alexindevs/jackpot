// Small pieces several screens use: tags, round buttons, the J-A-C-K-P-O-T letters, hearts, cards.
import { LETTERS } from '../config.js';
import { icon, shape } from './icons.js';
import { esc } from './dom.js';

// A team keeps its colour for the whole room. Team ids are not 0 to 4 for ever (a late team gets the next number, and ids
// are never reused), so a colour slot is handed out the first time a team is seen.
let slots = new Map(), slotRoom = null;
export function teamSlot(s, team) {
  const id = s.room ? s.room.id : null;
  if (id !== slotRoom) { slotRoom = id; slots = new Map(); }
  if (!slots.has(team)) slots.set(team, slots.size % 5);
  return slots.get(team);
}

export const tag = (label, kind = '') => `<span class="tag ${kind}">${esc(label)}</span>`;

// An icon-only button. The label is for screen readers; it is the only text the button has.
export const roundBtn = (ic, label, attrs = '', cls = '') => `<button class="round ${cls}" aria-label="${esc(label)}" ${attrs}>${icon[ic]()}</button>`;

// The word being spelled, one tile per letter; the first `wins` are lit in the team's colour.
export function letters(wins, total = LETTERS.length, team = 0) {
  return `<span class="letters t${team % 5}">${[...LETTERS.slice(0, total)].map((l, i) => `<i class="${i < wins ? 'on' : ''}">${l}</i>`).join('')}</span>`;
}

export const hearts = (n, max = 3) => `<span class="hearts" aria-label="${n} of ${max} suspicion points">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">${icon.heart(14)}</i>`).join('')}</span>`;

// A playing card: cream, with its shape big in the middle and small in the corner. `data` goes on the element.
export const card = (type, { cls = '', data = '', tag: el = 'span' } = {}) =>
  `<${el} class="card ${cls}" ${data}><i class="corner">${shape(type, 14)}</i><b class="big">${shape(type, 56)}</b></${el}>`;

// A hand is [circles, triangles, crosses, squares]; show one card per copy.
export const handCards = (hand, cls = '') => hand.flatMap((c, t) => Array.from({ length: c }, () => card(t, { cls }))).join('');

// A chip that passes one card type. `data-act="pass"` is what app.js listens for.
export const passChip = (type, cls = '') => `<button class="passchip ${cls}" data-act="pass" data-card="${type}">${shape(type, 16)}<span>Pass</span></button>`;
