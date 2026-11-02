// "Create room" opens this: pick the game length, and the room is created. The letters say what each length means.
import { icon } from './icons.js';
import { letters } from './parts.js';

let overlay = null, lastFocus = null;

function close() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener('keydown', onKey, true);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); close(); }
  if (e.key === 'Tab' && overlay) { // keep keyboard focus inside the dialog
    const f = [...overlay.querySelectorAll('button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

export function openNewRoom(onPick) {
  if (overlay) return;
  lastFocus = document.activeElement;
  overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<div class="modal small" role="dialog" aria-modal="true" aria-labelledby="newroom-title">
    <div class="modal-head"><h2 class="display" id="newroom-title">Session length</h2><button class="round" data-close aria-label="Close">${icon.close()}</button></div>
    <div class="modal-body choices">
      <button class="choice sel" data-short="0"><b>Long</b>${letters(7, 7)}</button>
      <button class="choice" data-short="1"><b>Short</b>${letters(4, 4)}</button>
    </div>
  </div>`;
  overlay.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-short]');
    if (pick) { close(); onPick(pick.dataset.short === '1'); }
    else if (e.target === overlay || e.target.closest('[data-close]')) close();
  });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  overlay.querySelector('[data-short]').focus();
}
