// The mute button and volume slider. Mounted once into a permanent element, so game redraws never interrupt a drag.
import { isMuted, getVolume, setMuted, setVolume, play } from '../sound.js';
import { icon } from './icons.js';

export function mountSoundBar(el) {
  el.innerHTML = '<button class="round sm" aria-label="Mute"></button><input type="range" min="0" max="100" step="5" aria-label="Volume">';
  const btn = el.querySelector('button'), vol = el.querySelector('input');
  const sync = () => { const off = isMuted() || getVolume() === 0; btn.innerHTML = off ? icon.muted(18) : icon.speaker(18); btn.setAttribute('aria-pressed', off); vol.value = Math.round(getVolume() * 100); };
  btn.addEventListener('click', () => { setMuted(!isMuted()); sync(); });
  vol.addEventListener('input', () => { setVolume(vol.value / 100); if (isMuted() && vol.value > 0) setMuted(false); sync(); });
  vol.addEventListener('change', () => play('chatPublic')); // let go of the slider: hear the new level
  sync();
}
