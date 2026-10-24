// "Create room" opens this: pick the game length, and the room is created. The letters say what each length means.
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
    <div class="modal-head"><h2 id="newroom-title">Session Length</h2><button class="alt" data-close aria-label="Close">✕</button></div>
    <div class="modal-body choices">
      <button class="choice" data-short="0">Long<span>JACKPOT</span></button>
      <button class="choice alt" data-short="1">Short<span>JACK</span></button>
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
