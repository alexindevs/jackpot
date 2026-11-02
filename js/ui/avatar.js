import { esc } from './dom.js';
import { nameOf, isBot } from '../store.js';

const ok = (c, fallback) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : fallback);

// Small character drawn from a start.ng style object (skinColor, primaryColor, hairColor, hair, hat).
export function avatar(style, size = 40) {
  const s = style || {};
  const skin = ok(s.skinColor, '#c9a27e');
  const shirt = ok(s.primaryColor, '#556070');
  const hair = ok(s.hairColor, '#241c18');
  const bald = s.hair === 'none' || s.hair === 'bald';
  const hat = s.hat && s.hat !== 'none';
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${esc(s.body || 'player')}">
    <rect width="40" height="40" rx="8" fill="#0b0d11"/>
    <rect x="8" y="27" width="24" height="13" rx="6" fill="${shirt}"/>
    <circle cx="20" cy="18" r="9" fill="${skin}"/>
    ${bald ? '' : `<path d="M11 17a9 9 0 0 1 18 0c-3-3-6-4-9-4s-6 1-9 4z" fill="${hair}"/>`}
    ${hat ? `<rect x="10" y="8" width="20" height="6" rx="3" fill="${shirt}"/>` : ''}
  </svg>`;
}

// A player's face with a ring in their team's colour. team: 0 to 4, or undefined for someone with no team yet.
export function face(style, size = 36, team) {
  return `<span class="av${team === undefined || team === null ? '' : ' t' + (team % 5)}" style="--s:${size}px">${avatar(style, size)}</span>`;
}

// The signed-in player's own chip: start.ng's face image when there is one.
export function profileCard(me) {
  if (!me) return '';
  const pic = me.face ? `<span class="av" style="--s:36px"><img class="avatar" width="36" height="36" src="${esc(me.face)}" alt=""></span>` : face(me.style, 36);
  return `<div class="chip">${pic}<div class="who-text"><div>${esc(me.name || 'Guest')}</div>${me.account ? `<div class="mute sm">@${esc(me.account)}</div>` : ''}</div></div>`;
}

// Name with face, for lists. team is optional.
export function person(s, id, { size = 32, team, tags = '' } = {}) {
  const bot = isBot(s, id) ? '<span class="tag bot">bot</span>' : '';
  return `<span class="who">${face((s.profiles[id] || {}).style, size, team)}<span class="nm">${esc(nameOf(s, id))}</span>${bot}${tags}</span>`;
}
