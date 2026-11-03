// Motion. #app is rebuilt from scratch on every state change, so a CSS animation on a rebuilt element would replay on each
// redraw. `snap` notes the DOM before a redraw and `animate` plays only what is new after it. Things that are built once
// (the panel, popups, the banner, the end-of-game overlay) use plain CSS in app.css. Both honour reduced motion.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const EASE = 'cubic-bezier(.2, .8, .2, 1)';

function go(el, frames, opts = {}) {
  if (el && !calm.matches && el.animate) el.animate(frames, { duration: 260, easing: EASE, ...opts });
}

const counts = (root, sel, on) => [...root.querySelectorAll(sel)].map((n) => n.querySelectorAll(on).length);

export function snap(root) {
  const holder = root.querySelector('.seat.holder .nm');
  return {
    modal: !!root.querySelector('.modal-backdrop'),
    letters: counts(root, '.letters', '.on'),
    hearts: counts(root, '.hearts', '.on'),
    cards: [...root.querySelectorAll('.hand > .card')].map((c) => ({ html: c.outerHTML, rect: c.getBoundingClientRect() })),
    holder: holder ? holder.textContent : '',
  };
}

// A dialog rising in. Also used by the dialogs that are built once (guide, new room).
export function appear(backdrop) {
  go(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
  go(backdrop.firstElementChild, [{ opacity: 0, translate: '0 18px', scale: '.96' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 300 });
}

// A new screen: fade the page in and let its blocks rise one after another.
function enter(root) {
  go(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  const blocks = [...root.querySelectorAll('.col > *, .stage > *, .center-page > *, .resultbox > *')]
    .filter((el) => getComputedStyle(el).position !== 'fixed'); // a transformed parent would drag a fixed child along
  blocks.slice(0, 10).forEach((el, i) => go(el, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { delay: i * 45, duration: 340, fill: 'backwards' }));
  // the home title and its line drop in from above
  root.querySelectorAll('.hero > *').forEach((el, i) => go(el, [{ opacity: 0, translate: '0 -36px' }, { opacity: 1, translate: '0 0' }], { delay: 80 + i * 140, duration: 700, fill: 'backwards' }));
}

// Tiles that changed between `was` and now, so a letter won or a heart lost pulses.
function pulse(root, sel, was, tile, frames) {
  const now = root.querySelectorAll(sel);
  if (now.length !== was.length) return;
  now.forEach((box, k) => {
    const [lo, hi] = [Math.min(was[k], box.querySelectorAll('.on').length), Math.max(was[k], box.querySelectorAll('.on').length)];
    for (let i = lo; i < hi; i++) go(box.querySelectorAll(tile)[i], frames, { duration: 520 });
  });
}

export function animate(root, was, screenChanged) {
  if (screenChanged) return enter(root);
  const now = snap(root);
  if (now.modal && !was.modal) appear(root.querySelector('.modal-backdrop'));
  pulse(root, '.letters', was.letters, 'i', [{ scale: '.6' }, { scale: '1.35', offset: .5 }, { scale: '1' }]);
  pulse(root, '.hearts', was.hearts, 'i', [{ scale: '1.6', opacity: .3 }, { scale: '.85', offset: .55 }, { scale: '1', opacity: 1 }]);
  // cards dealt to the hand slide in from the right; a card passed on leaves to the left
  const hand = [...root.querySelectorAll('.hand > .card')];
  if (was.cards.length && hand.length > was.cards.length) hand.slice(was.cards.length).forEach((c, i) => go(c, [{ opacity: 0, translate: '90px 0', rotate: '8deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }], { delay: i * 70, duration: 380, fill: 'backwards' }));
  else if (hand.length < was.cards.length) {
    let i = hand.findIndex((c, k) => c.outerHTML !== was.cards[k].html);
    if (i < 0) i = hand.length;
    const { rect, html } = was.cards[i];
    const ghost = document.createElement('div');
    ghost.innerHTML = html;
    const el = ghost.firstElementChild;
    el.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;--cw:${rect.width}px;margin:0;z-index:45;pointer-events:none`;
    document.body.append(el);
    if (calm.matches || !el.animate) el.remove();
    else el.animate([{ opacity: 1, translate: '0 0', rotate: '0deg' }, { opacity: 0, translate: '-110px -20px', rotate: '-14deg' }], { duration: 380, easing: 'cubic-bezier(.5, 0, .9, .5)' }).onfinish = () => el.remove();
  }
  // the passing card moves on: its new holder's seat swells
  if (now.holder && now.holder !== was.holder) go(root.querySelector('.seat.holder'), [{ scale: '1.14' }, { scale: '1' }], { duration: 420 });
}
