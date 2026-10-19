import { esc } from './dom.js';

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

// The signed-in player's own card: start.ng's face image when there is one.
export function profileCard(me) {
  if (!me) return '';
  const face = me.face ? `<img class="avatar" width="48" height="48" src="${esc(me.face)}" alt="">` : avatar(me.style, 48);
  return `<div class="profile">${face}<div><div>${esc(me.name || 'Guest')}</div><div class="mute">${me.account ? '@' + esc(me.account) : ''}</div></div></div>`;
}
