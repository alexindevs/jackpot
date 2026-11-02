// Inline SVG icons and the four card shapes. Icons take their colour from the text (currentColor).
const ic = (inner, size = 22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icon = {
  back: (s) => ic('<path d="M15 5l-7 7 7 7"/>', s),
  door: (s) => ic('<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18"/><circle cx="14.5" cy="12.5" r="1.1" fill="currentColor" stroke="none"/>', s),
  help: (s) => ic('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 17.2h.01"/>', s),
  refresh: (s) => ic('<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>', s),
  close: (s) => ic('<path d="M6 6l12 12M18 6L6 18"/>', s),
  menu: (s) => ic('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>', s),
  userPlus: (s) => ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M19 8v6M16 11h6"/>', s),
  copy: (s) => ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>', s),
  clock: (s) => ic('<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5.5l3.5 2"/>', s),
  plus: (s) => ic('<path d="M12 4v16M4 12h16"/>', s),
  chat: (s) => ic('<path d="M4 5h16v11H9l-5 4z"/>', s),
  lock: (s) => ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', s),
  signal: (s) => ic('<path d="M4 10v4h3l5 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', s),
  log: (s) => ic('<path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h6"/>', s),
  speaker: (s) => ic('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', s),
  muted: (s) => ic('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6"/>', s),
  heart: (s) => `<svg class="ic" width="${s || 14}" height="${s || 14}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.2C1.2 8.6 3 5 6.4 5c2 0 3.6 1.1 5.6 3.3C14 6.1 15.6 5 17.6 5 21 5 22.8 8.6 21.3 11.8 19 16.4 12 21 12 21z" fill="currentColor"/></svg>`,
  trophy: (s) => `<svg class="ic" width="${s || 80}" height="${s || 80}" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="currentColor"/><path d="M18 12H8v4a10 10 0 0 0 10 10M46 12h10v4a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="28" y="36" width="8" height="10" fill="currentColor"/><rect x="20" y="46" width="24" height="7" rx="2" fill="currentColor"/></svg>`,
  flag: (s) => `<svg class="ic" width="${s || 80}" height="${s || 80}" viewBox="0 0 64 64" aria-hidden="true"><path d="M16 6v52" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M19 9h30l-8 12 8 12H19z" fill="currentColor"/></svg>`,
  equal: (s) => `<svg class="ic" width="${s || 80}" height="${s || 80}" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="20" width="48" height="9" rx="4.5" fill="currentColor"/><rect x="8" y="36" width="48" height="9" rx="4.5" fill="currentColor"/></svg>`,
};

// The four card types, in the server's order. The shapes are drawn, not text glyphs, so every font and device shows them the same.
export const SHAPES = ['circle', 'triangle', 'cross', 'square'];
const SHAPE_PATH = {
  circle: '<circle cx="32" cy="32" r="29"/>',
  triangle: '<path d="M32 4L61 58H3Z"/>',
  cross: '<path d="M23 4h18v19h19v18H41v19H23V41H4V23h19z"/>',
  square: '<rect x="6" y="6" width="52" height="52" rx="2"/>',
};
export const shape = (type, size = 16) => `<svg class="shape" width="${size}" height="${size}" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${SHAPE_PATH[SHAPES[type]]}</svg>`;
