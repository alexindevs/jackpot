// The room behind every screen: a warm room with lamps, benches and stools, drawn as SVG and used as the page background.
// Two crops, one for desktop and one for phones, so nothing important is lost when the window is narrow.
const stool = (cx, cy, s) => {
  const sy = cy - 120 * s;
  return `
 <ellipse cx="${cx}" cy="${cy}" rx="${88 * s}" ry="${16 * s}" fill="#000" fill-opacity=".32"/>
 <line x1="${cx - 24 * s}" y1="${sy + 20 * s}" x2="${cx - 38 * s}" y2="${cy - 10 * s}" stroke="#2a140a" stroke-width="${8 * s}" stroke-linecap="round"/>
 <line x1="${cx + 24 * s}" y1="${sy + 20 * s}" x2="${cx + 38 * s}" y2="${cy - 10 * s}" stroke="#2a140a" stroke-width="${8 * s}" stroke-linecap="round"/>
 <ellipse cx="${cx}" cy="${cy - 46 * s}" rx="${58 * s}" ry="${11 * s}" fill="none" stroke="#2a140a" stroke-width="${6 * s}"/>
 <line x1="${cx - 54 * s}" y1="${sy + 22 * s}" x2="${cx - 76 * s}" y2="${cy}" stroke="#4a2815" stroke-width="${11 * s}" stroke-linecap="round"/>
 <line x1="${cx + 54 * s}" y1="${sy + 22 * s}" x2="${cx + 76 * s}" y2="${cy}" stroke="#4a2815" stroke-width="${11 * s}" stroke-linecap="round"/>
 <ellipse cx="${cx}" cy="${sy + 28 * s}" rx="${72 * s}" ry="${16 * s}" fill="url(#side)"/>
 <rect x="${cx - 72 * s}" y="${sy}" width="${144 * s}" height="${28 * s}" fill="url(#side)"/>
 <ellipse cx="${cx}" cy="${sy}" rx="${72 * s}" ry="${17 * s}" fill="url(#cream)" stroke="#e8742a" stroke-width="${5 * s}"/>
 <ellipse cx="${cx}" cy="${sy - 2 * s}" rx="${44 * s}" ry="${8 * s}" fill="#fff" fill-opacity=".35"/>`;
};
const bench = (x, fy, w) => {
  const ty = fy - 86;
  return `
 <ellipse cx="${x + w / 2}" cy="${fy + 4}" rx="${w * 0.56}" ry="14" fill="#000" fill-opacity=".32"/>
 <line x1="${x + 34}" y1="${ty + 36}" x2="${x + 40}" y2="${fy - 10}" stroke="#2a140a" stroke-width="9" stroke-linecap="round"/>
 <line x1="${x + w - 34}" y1="${ty + 36}" x2="${x + w - 40}" y2="${fy - 10}" stroke="#2a140a" stroke-width="9" stroke-linecap="round"/>
 <rect x="${x + 12}" y="${ty + 56}" width="15" height="${fy - ty - 56}" rx="3" fill="#4a2815"/>
 <rect x="${x + w - 27}" y="${ty + 56}" width="15" height="${fy - ty - 56}" rx="3" fill="#4a2815"/>
 <rect x="${x}" y="${ty + 34}" width="${w}" height="24" rx="4" fill="url(#wain)"/>
 <polygon points="${x + 22},${ty} ${x + w - 22},${ty} ${x + w},${ty + 34} ${x},${ty + 34}" fill="url(#orange)" stroke="#8a3f1a" stroke-width="3" stroke-linejoin="round"/>
 <polygon points="${x + 40},${ty + 6} ${x + w - 40},${ty + 6} ${x + w - 30},${ty + 14} ${x + 30},${ty + 14}" fill="#fff" fill-opacity=".25"/>`;
};
const lamp = (x, cord, spread, floor) => `
 <polygon points="${x - 34},${cord + 38} ${x + 34},${cord + 38} ${x + spread},${floor} ${x - spread},${floor}" fill="url(#cone)"/>
 <line x1="${x}" y1="0" x2="${x}" y2="${cord}" stroke="#1a0b05" stroke-width="3"/>
 <path d="M${x - 48},${cord + 40} L${x - 18},${cord} L${x + 18},${cord} L${x + 48},${cord + 40} Z" fill="url(#gold)" stroke="#2a140a" stroke-width="3" stroke-linejoin="round"/>
 <ellipse cx="${x}" cy="${cord + 44}" rx="70" ry="26" fill="url(#glow)"/>`;
const win = (x) => `<path d="M${x},340 V200 Q${x},130 ${x + 50},130 Q${x + 100},130 ${x + 100},200 V340 Z" fill="url(#win)" stroke="#5a3019" stroke-width="9"/><line x1="${x + 50}" y1="130" x2="${x + 50}" y2="340" stroke="#5a3019" stroke-width="5"/><line x1="${x}" y1="230" x2="${x + 100}" y2="230" stroke="#5a3019" stroke-width="5"/>`;

const DEFS = `<defs>
 <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0d06"/><stop offset="1" stop-color="#4a2916"/></linearGradient>
 <linearGradient id="back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8672a"/><stop offset="1" stop-color="#8a421a"/></linearGradient>
 <linearGradient id="wl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1f12"/><stop offset="1" stop-color="#7a4528"/></linearGradient>
 <linearGradient id="wr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4528"/><stop offset="1" stop-color="#3a1f12"/></linearGradient>
 <linearGradient id="wain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4528"/><stop offset="1" stop-color="#4a2815"/></linearGradient>
 <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98150"/><stop offset="1" stop-color="#5a3019"/></linearGradient>
 <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1f12"/><stop offset=".35" stop-color="#8a5230"/><stop offset="1" stop-color="#2e180d"/></linearGradient>
 <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ecd3"/><stop offset="1" stop-color="#e6cfa4"/></linearGradient>
 <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f58f45"/><stop offset="1" stop-color="#d0621e"/></linearGradient>
 <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8d676"/><stop offset="1" stop-color="#d79a2b"/></linearGradient>
 <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#f0a94a"/></linearGradient>
 <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a1" stop-opacity=".34"/><stop offset="1" stop-color="#ffe3a1" stop-opacity="0"/></linearGradient>
 <radialGradient id="glow"><stop offset="0" stop-color="#ffe3a1" stop-opacity=".9"/><stop offset="1" stop-color="#ffe3a1" stop-opacity="0"/></radialGradient>
 <radialGradient id="pool"><stop offset="0" stop-color="#f4e6cc" stop-opacity=".45"/><stop offset="1" stop-color="#f4e6cc" stop-opacity="0"/></radialGradient>
 <radialGradient id="wallglow"><stop offset="0" stop-color="#f08a3c" stop-opacity=".55"/><stop offset="1" stop-color="#f08a3c" stop-opacity="0"/></radialGradient>
 <radialGradient id="vig" cx=".5" cy=".45" r=".8"><stop offset=".5" stop-color="#1a0b05" stop-opacity="0"/><stop offset="1" stop-color="#1a0b05" stop-opacity=".7"/></radialGradient>
</defs>`;

// c: the room's geometry. The back wall is a rectangle, the floor and walls are drawn in perspective around it.
function room(c) {
  const { W, H, vx, vy, bx0, bx1, by0, by1 } = c;
  const sideY = (yb) => ((yb - by0) / (by1 - by0)) * H;
  let planks = '';
  const n = c.planks;
  for (let i = 0; i <= n; i++) {
    const b = bx0 + (i * (bx1 - bx0)) / n, f = vx + ((b - vx) * (H - vy)) / (by1 - vy);
    planks += `<line x1="${b}" y1="${by1}" x2="${f}" y2="${H}" stroke="#2a140a" stroke-opacity=".4" stroke-width="2"/>`;
  }
  for (const y of c.seams) {
    const d = (bx0 * (y - by1)) / (H - by1);
    planks += `<line x1="${bx0 - d}" y1="${y}" x2="${bx1 + d}" y2="${y}" stroke="#2a140a" stroke-opacity=".25" stroke-width="2"/>`;
  }
  const s0 = c.stripe, w0 = c.wain;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">${DEFS}
<polygon points="0,0 ${W},0 ${bx1},${by0} ${bx0},${by0}" fill="url(#ceil)"/>
<rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" fill="url(#back)"/>
<ellipse cx="${W / 2}" cy="${c.glowY}" rx="${(bx1 - bx0) / 2}" ry="${c.glowR}" fill="url(#wallglow)"/>
${(c.windows || []).map(win).join('')}
<rect x="${bx0}" y="${s0}" width="${bx1 - bx0}" height="12" fill="#e8742a"/><rect x="${bx0}" y="${s0 + 12}" width="${bx1 - bx0}" height="3" fill="#f2b84b"/>
<rect x="${bx0}" y="${w0}" width="${bx1 - bx0}" height="${by1 - w0}" fill="url(#wain)"/>
${Array.from({ length: Math.ceil((bx1 - bx0) / c.panel) }, (_, i) => `<rect x="${bx0 + i * c.panel}" y="${w0}" width="2" height="${by1 - w0}" fill="#1a0b05" fill-opacity=".35"/>`).join('')}
<rect x="${bx0}" y="${by1 - 6}" width="${bx1 - bx0}" height="8" fill="#2a140a"/>
<polygon points="0,0 ${bx0},${by0} ${bx0},${by1} 0,${H}" fill="url(#wl)"/>
<polygon points="${W},0 ${bx1},${by0} ${bx1},${by1} ${W},${H}" fill="url(#wr)"/>
<polygon points="${bx0},${s0} ${bx0},${s0 + 12} 0,${sideY(s0 + 12)} 0,${sideY(s0)}" fill="#e8742a"/>
<polygon points="${bx1},${s0} ${bx1},${s0 + 12} ${W},${sideY(s0 + 12)} ${W},${sideY(s0)}" fill="#e8742a"/>
<polygon points="${bx0},${w0} ${bx0},${by1} 0,${H} 0,${sideY(w0)}" fill="#1a0b05" fill-opacity=".35"/>
<polygon points="${bx1},${w0} ${bx1},${by1} ${W},${H} ${W},${sideY(w0)}" fill="#1a0b05" fill-opacity=".35"/>
<polygon points="0,${H} ${W},${H} ${bx1},${by1} ${bx0},${by1}" fill="url(#floor)"/>
${planks}
<ellipse cx="${W / 2}" cy="${c.poolY}" rx="${c.poolR}" ry="${c.poolR * 0.28}" fill="url(#pool)"/>
${c.lamps.map((x) => lamp(x, c.cord, c.spread, by1)).join('')}
${c.benches.map((b) => bench(...b)).join('')}
${c.stools.map((s) => stool(...s)).join('')}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

const DESKTOP = {
  W: 1440, H: 900, vx: 720, vy: 300, bx0: 300, bx1: 1140, by0: 90, by1: 540, stripe: 372, wain: 400, panel: 84, planks: 8,
  seams: [560, 590, 630, 685, 760, 860], glowY: 330, glowR: 240, poolY: 690, poolR: 470, cord: 152, spread: 170,
  windows: [350, 990], lamps: [520, 720, 920], benches: [[330, 568, 300], [810, 568, 300]],
  stools: [[420, 700, 0.95], [1020, 690, 0.9], [170, 830, 1.5], [1290, 850, 1.65]],
};
const PHONE = {
  W: 375, H: 812, vx: 187.5, vy: 300, bx0: 50, bx1: 325, by0: 130, by1: 470, stripe: 340, wain: 366, panel: 55, planks: 5,
  seams: [490, 520, 560, 620, 700, 780], glowY: 260, glowR: 170, poolY: 640, poolR: 230, cord: 124, spread: 120,
  windows: [], lamps: [120, 255], benches: [[25, 560, 200]], stools: [[205, 665, 0.7], [90, 775, 1.2]],
};

const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// Sets two CSS variables; the stylesheet picks one by screen width.
export function mountScenery() {
  const root = document.documentElement.style;
  root.setProperty('--room-wide', uri(room(DESKTOP)));
  root.setProperty('--room-tall', uri(room(PHONE)));
}
