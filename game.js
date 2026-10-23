/* Los Becerros de Marto */
(() => {
'use strict';

/* =========================================================
   Constantes y utilidades
   ========================================================= */
const W = 640, H = 360, HUD_H = 26;
const F = { x0: 22, y0: 36, x1: 618, y1: 348 };          // campo jugable
const CORRAL = { x0: 22, y0: 256, x1: 136, y1: 348 };    // zona segura
const GATE = { x0: 62, x1: 102 };                         // tranquera del corral (lado de arriba)
const BARN = { x: 284, y: 22, door: { x: 307, y: 86 } };
const SPACING = 17;
const MARTO_SPEED = 118;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const CFG = window.BECERROS_CONFIG || {};
const $ = s => document.querySelector(s);

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin storage */ } },
};
function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }

function fit() {
  const u = Math.min(innerWidth / W, innerHeight / H);
  document.documentElement.style.setProperty('--u', u + 'px');
}
addEventListener('resize', fit);
fit();

/* =========================================================
   Assets: sprites recortados + sprites hechos en código
   ========================================================= */
const IMG = {};
const ASSETS = ['marto_front', 'marto_side', 'marto_back', 'clown_front', 'clown_side', 'clown_back',
  'marto_head_front', 'marto_head_side', 'clown_head_front', 'clown_head_side'];
function loadAssets() {
  return Promise.all(ASSETS.map(n => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { IMG[n] = i; res(); };
    i.onerror = () => rej(new Error('No cargó ' + n));
    i.src = `assets/${n}.png`;
  })));
}

// Dibuja con rectángulos y le agrega un contorno oscuro de 1px
function makeSprite(w, h, draw) {
  const [c, g] = mkCanvas(w + 2, h + 2);
  const p = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x + 1, y + 1, ww, hh); };
  draw(p, g);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data, out = new Uint8ClampedArray(a);
  const op = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && a[(y * c.width + x) * 4 + 3] > 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (a[i + 3]) continue;
    if (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1)) { out[i] = 34; out[i + 1] = 22; out[i + 2] = 16; out[i + 3] = 255; }
  }
  g.putImageData(new ImageData(out, c.width, c.height), 0, 0);
  return c;
}

const CALF_TYPES = {
  pinto:  { value: 10, speed: 34, flee: 1.45, fleeR: 48, body: '#f4efe4', spot: '#2b2522', blaze: null },
  marron: { value: 20, speed: 40, flee: 1.5,  fleeR: 54, body: '#9a5a2e', spot: '#6e3c1c', blaze: '#f4efe4' },
  dorado: { value: 50, speed: 58, flee: 1.65, fleeR: 76, body: '#e8b923', spot: '#f8df74', blaze: '#fff3b8' },
};
const SPR = {};
function buildSprites() {
  for (const [k, t] of Object.entries(CALF_TYPES)) {
    SPR['calf_' + k] = [0, 1].map(f => makeSprite(25, 16, p => {
      const B = t.body, S = t.spot, N = '#e9a3a0', K = '#3a2a20', o = f ? 1 : 0;
      [[5 + o], [9 - o], [15 + o], [18 - o]].forEach(([x]) => { p(x, 12, 2, 4, B); p(x, 15, 2, 1, K); });
      p(3, 6, 1, 4, B); p(2, 9, 2, 2, K);                 // cola
      p(4, 6, 16, 7, B); p(5, 5, 13, 1, B);               // cuerpo
      p(7, 7, 4, 3, S); p(13, 6, 3, 2, S); p(10, 10, 2, 2, S);
      p(18, 1, 5, 7, B);                                  // cabeza
      if (k === 'pinto') p(18, 1, 2, 3, S);
      if (t.blaze) p(20, 1, 2, 4, t.blaze);
      p(15, 2, 3, 2, B); p(16, 2, 1, 1, N);               // oreja
      p(21, 5, 4, 3, N); p(24, 6, 1, 1, '#8a4a4a');       // hocico
      p(21, 3, 1, 1, '#1a1010');                          // ojo
    }));
  }
  SPR.dog = [0, 1, 2, 3].map(f => makeSprite(27, 15, p => {
    const D = '#7a4a24', K = '#3b2616', L = '#e8d5b0', o = f % 2 ? 1 : 0;
    [[5 + o], [9 - o], [15 + o], [18 - o]].forEach(([x]) => p(x, 10, 2, 5, D));
    p(2, 2, 2, 2, D); p(3, 4, 2, 3, D);                   // cola
    p(4, 6, 16, 5, D); p(5, 5, 11, 2, K);                 // cuerpo y lomo
    p(18, 2, 6, 6, D); p(23, 4, 3, 3, D); p(26, 4, 1, 1, '#111');
    p(18, 0, 2, 3, K); p(21, 0, 2, 2, K);                 // orejas
    p(21, 3, 1, 1, '#111');
    p(18, 8, 3, 3, L); p(19, 7, 3, 1, '#b8322a');         // pecho y collar
    if (f >= 2) p(24, 7, 1, 3, '#e05a6a');                // lengua afuera
  }));
  SPR.bale = makeSprite(30, 20, p => {
    const r = mulberry(7);
    p(0, 0, 30, 7, '#ecd47a'); p(0, 7, 30, 13, '#d1a843'); p(0, 7, 30, 1, '#b48d34');
    for (let i = 0; i < 40; i++) p(Math.floor(r() * 29), Math.floor(r() * 19), 1 + Math.floor(r() * 2), 1, r() < .5 ? '#f6e39a' : '#b08a35');
    p(8, 0, 2, 20, '#8a6528'); p(20, 0, 2, 20, '#8a6528');
  });
  SPR.barn = makeSprite(70, 56, p => {
    const R = '#b8322a', R2 = '#8c2620', R3 = '#d4473c', DK = '#3b2414';
    p(54, 0, 1, 10, DK); p(55, 0, 7, 4, '#2f5fa8'); p(55, 4, 4, 1, '#2f5fa8');        // banderín
    for (let k = 0; k <= 13; k++) { const h = Math.round(k * 12 / 13); p(54 - h, 9 + k, h * 2 + 1, 1, k < 2 ? R3 : R2); }
    p(44, 22, 21, 33, R); p(44, 22, 2, 33, R3);                                      // torre
    for (let k = 0; k <= 13; k++) { const h = Math.round(k * 22 / 13); p(22 - h, 16 + k, h * 2 + 1, 1, k < 2 ? R3 : R2); }
    p(1, 30, 42, 25, R); p(1, 30, 42, 2, R2);                                         // casa
    for (let x = 5; x < 42; x += 5) p(x, 32, 1, 23, R2);
    for (let x = 48; x < 64; x += 5) p(x, 24, 1, 31, R2);
    p(15, 38, 14, 17, DK); p(16, 37, 12, 1, DK); p(17, 36, 10, 1, DK);               // puerta
    p(21, 38, 1, 17, '#5b3a1c'); p(16, 46, 12, 1, '#5b3a1c');
    p(5, 36, 6, 6, '#f3d27a'); p(7, 36, 1, 6, DK); p(5, 38, 6, 1, DK);               // ventana
    p(51, 30, 6, 8, DK); p(52, 29, 4, 1, DK); p(51, 30, 6, 2, '#f3d27a');
    p(0, 54, 70, 2, '#5b3a1c');
  });
  SPR.well = makeSprite(24, 26, p => {
    p(2, 2, 20, 3, '#7a4f26'); p(0, 4, 24, 2, '#5b3a1c'); p(4, 0, 16, 2, '#9a6a36');  // techito
    p(3, 6, 2, 10, '#7a4f26'); p(19, 6, 2, 10, '#7a4f26');
    p(9, 8, 1, 6, '#c9b48a'); p(8, 13, 3, 3, '#7a4f26');                             // soga y balde
    p(1, 15, 22, 11, '#8d8a82'); p(1, 15, 22, 3, '#2a4a66');
    for (let i = 0; i < 5; i++) p(1 + i * 5, 19, 4, 3, i % 2 ? '#a8a49a' : '#77746c');
    p(1, 23, 22, 3, '#6a675f');
  });
  SPR.heart = makeSprite(7, 6, p => { p(0, 0, 3, 3, '#e0445a'); p(4, 0, 3, 3, '#e0445a'); p(0, 1, 7, 3, '#e0445a'); p(1, 4, 5, 1, '#e0445a'); p(2, 5, 3, 1, '#e0445a'); p(1, 1, 1, 1, '#ff9aa8'); });

  // íconos para HTML
  const icon = (spr, s) => { const [c, g] = mkCanvas(spr.width * s, spr.height * s); g.drawImage(spr, 0, 0, c.width, c.height); return c.toDataURL(); };
  const ICON = { pinto: icon(SPR.calf_pinto[0], 3), marron: icon(SPR.calf_marron[0], 3), dorado: icon(SPR.calf_dorado[0], 3), dog: icon(SPR.dog[0], 3), heart: icon(SPR.heart, 3) };
  document.querySelectorAll('img[data-icon]').forEach(i => { i.src = ICON[i.dataset.icon]; });
  SPR.icons = ICON;
}

/* =========================================================
   Tablero estilo Catán (fondo pre-renderizado)
   ========================================================= */
let BG, FG;
const OBST = [];
const BALES = [[168, 132], [446, 126], [300, 206], [500, 268], [214, 290]];
function hexPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}
function fenceH(g, x0, x1, y) {
  g.fillStyle = '#5b3a1c'; g.fillRect(x0, y - 7, x1 - x0, 3); g.fillRect(x0, y - 3, x1 - x0, 3);
  g.fillStyle = '#a8763f'; g.fillRect(x0, y - 7, x1 - x0, 1); g.fillRect(x0, y - 3, x1 - x0, 1);
  for (let x = x0; x <= x1; x += 16) { const px = Math.min(x, x1 - 3); g.fillStyle = '#2b1a0d'; g.fillRect(px - 1, y - 11, 5, 12); g.fillStyle = '#7a4f26'; g.fillRect(px, y - 10, 3, 10); g.fillStyle = '#b5834a'; g.fillRect(px, y - 10, 3, 2); }
}
function fenceV(g, x, y0, y1) {
  g.fillStyle = '#2b1a0d'; g.fillRect(x - 2, y0, 5, y1 - y0);
  g.fillStyle = '#9a6a36'; g.fillRect(x - 1, y0, 3, y1 - y0);
  g.fillStyle = '#b5834a'; g.fillRect(x - 1, y0, 1, y1 - y0);
  for (let y = y0; y <= y1; y += 16) { g.fillStyle = '#2b1a0d'; g.fillRect(x - 3, y - 2, 7, 7); g.fillStyle = '#7a4f26'; g.fillRect(x - 2, y - 1, 5, 5); g.fillStyle = '#b5834a'; g.fillRect(x - 2, y - 1, 5, 1); }
}
function buildBoard() {
  const r = mulberry(1247);
  const [c, g] = mkCanvas(W, H);
  // mar
  g.fillStyle = '#2f6b99'; g.fillRect(0, 0, W, H);
  const R = 19, hw = Math.sqrt(3) * R;
  for (let row = -1; row * R * 1.5 < H + R; row++) for (let col = -1; col * hw < W + hw; col++) {
    const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * R * 1.5;
    hexPath(g, cx, cy, R - 1); g.fillStyle = r() < .5 ? '#3878aa' : '#3473a4'; g.fill();
    g.fillStyle = 'rgba(220,240,255,.55)'; const wx = Math.round(cx + rand(-6, 4)), wy = Math.round(cy + rand(-5, 5)); g.fillRect(wx, wy, 3, 1); g.fillRect(wx + 3, wy - 1, 2, 1);
  }
  // marco de madera del tablero
  g.fillStyle = '#2b1a0d'; g.fillRect(F.x0 - 8, F.y0 - 8, F.x1 - F.x0 + 16, F.y1 - F.y0 + 16);
  g.fillStyle = '#c9a25a'; g.fillRect(F.x0 - 6, F.y0 - 6, F.x1 - F.x0 + 12, F.y1 - F.y0 + 12);
  g.fillStyle = '#e2c27a'; g.fillRect(F.x0 - 6, F.y0 - 6, F.x1 - F.x0 + 12, 2);
  // hexágonos del campo
  g.save(); g.beginPath(); g.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0); g.clip();
  g.fillStyle = '#56682a'; g.fillRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
  const TILES = [
    { w: .38, fill: '#8fb84c', a: '#6f9a34', b: '#b4d46e', kind: 'grass' },
    { w: .26, fill: '#7eaa40', a: '#5f8a2c', b: '#a3c95e', kind: 'grass' },
    { w: .22, fill: '#e0bf55', a: '#b89234', b: '#f2d97a', kind: 'wheat' },
    { w: .14, fill: '#d2ad5e', a: '#a9853c', b: '#ecd08a', kind: 'wheat' },
  ];
  for (let row = 0; F.y0 + (row - 1) * R * 1.5 < F.y1 + R; row++) for (let col = -1; F.x0 + col * hw < F.x1 + hw; col++) {
    const cx = F.x0 + col * hw + (row % 2 ? hw / 2 : 0), cy = F.y0 + row * R * 1.5;
    let x = r(), t = TILES[0];
    for (const tt of TILES) { if (x < tt.w) { t = tt; break; } x -= tt.w; }
    hexPath(g, cx, cy, R - 1); g.fillStyle = t.fill; g.fill();
    hexPath(g, cx, cy - 1, R - 3); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.stroke();
    for (let k = 0; k < 9; k++) {
      const px = Math.round(cx + (r() - .5) * R * 1.3), py = Math.round(cy + (r() - .5) * R * 1.3);
      if (t.kind === 'grass') { g.fillStyle = t.a; g.fillRect(px, py, 1, 2); g.fillRect(px + 2, py, 1, 2); g.fillStyle = t.b; g.fillRect(px + 1, py - 1, 1, 1); }
      else { g.fillStyle = t.a; g.fillRect(px, py, 1, 3); g.fillStyle = t.b; g.fillRect(px, py - 1, 1, 1); g.fillRect(px - 1, py, 1, 1); }
    }
  }
  // corral: piso de paja
  g.fillStyle = '#c99d55'; g.fillRect(CORRAL.x0, CORRAL.y0, CORRAL.x1 - CORRAL.x0, CORRAL.y1 - CORRAL.y0);
  for (let k = 0; k < 260; k++) { g.fillStyle = r() < .5 ? '#e2bf73' : '#a77f3d'; g.fillRect(CORRAL.x0 + Math.floor(r() * (CORRAL.x1 - CORRAL.x0)), CORRAL.y0 + Math.floor(r() * (CORRAL.y1 - CORRAL.y0)), 2, 1); }
  g.fillStyle = 'rgba(80,50,20,.25)'; g.fillRect(CORRAL.x0, CORRAL.y0, CORRAL.x1 - CORRAL.x0, 3);
  // bebedero del corral
  g.fillStyle = '#2b1a0d'; g.fillRect(30, 334, 40, 10); g.fillStyle = '#7a4f26'; g.fillRect(31, 335, 38, 8); g.fillStyle = '#4b8ec4'; g.fillRect(33, 336, 34, 3);
  g.restore();
  // cercos
  fenceH(g, F.x0, F.x1, F.y0 + 1);
  fenceV(g, F.x0, F.y0, F.y1);
  fenceV(g, F.x1, F.y0, F.y1);
  fenceH(g, CORRAL.x0, GATE.x0, CORRAL.y0 + 1);
  fenceH(g, GATE.x1, CORRAL.x1, CORRAL.y0 + 1);
  fenceV(g, CORRAL.x1, CORRAL.y0 - 8, CORRAL.y1);
  // postes de la tranquera
  for (const gx of [GATE.x0 - 2, GATE.x1 - 2]) { g.fillStyle = '#2b1a0d'; g.fillRect(gx - 1, CORRAL.y0 - 15, 7, 17); g.fillStyle = '#7a4f26'; g.fillRect(gx, CORRAL.y0 - 14, 5, 15); g.fillStyle = '#e6b83c'; g.fillRect(gx, CORRAL.y0 - 14, 5, 2); }
  BG = c;

  const [fc, fg] = mkCanvas(W, H);
  fenceH(fg, F.x0, F.x1, F.y1 + 3);
  FG = fc;

  OBST.length = 0;
  OBST.push({ x: 286, y: 60, w: 68, h: 20, kind: 'barn' });
  OBST.push({ x: 550, y: 72, w: 22, h: 12, kind: 'well' });
  for (const [x, y] of BALES) OBST.push({ x, y, w: 30, h: 12, kind: 'bale' });
  OBST.push({ x: CORRAL.x0, y: CORRAL.y0 - 3, w: GATE.x0 - CORRAL.x0, h: 5, kind: 'fence' });
  OBST.push({ x: GATE.x1, y: CORRAL.y0 - 3, w: CORRAL.x1 - GATE.x1 + 2, h: 5, kind: 'fence' });
  OBST.push({ x: CORRAL.x1 - 2, y: CORRAL.y0 - 3, w: 5, h: CORRAL.y1 - CORRAL.y0 + 3, kind: 'fence' });
}

/* =========================================================
   Audio chiptune (WebAudio)
   ========================================================= */
const NOTE = n => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (base + (Number(m[3]) - 4) * 12) / 12);
};
const semi = (f, s) => f * Math.pow(2, s / 12);
function seq(str) {
  const out = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(':'); const len = Number(l) || 1; if (n !== 'r') out.push([step, NOTE(n), len]); step += len; }
  return out;
}
function buildTracks() {
  const game = { bpm: 150, len: 128, ev: [] };
  const lead = seq(`D5:2 A4:2 D5:2 F5:2 E5:2 D5:2 C5:2 A4:2  G4:2 A4:2 C5:2 D5:2 E5:4 C5:4
    D5:2 F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 C5:2  A4:2 C5:2 E5:2 C5:2 D5:8
    F5:2 G5:2 A5:4 G5:2 F5:2 E5:4  D5:2 E5:2 F5:4 E5:2 D5:2 C5:4
    Bb4:2 C5:2 D5:2 E5:2 F5:2 E5:2 D5:2 C5:2  A4:4 E5:4 D5:8`);
  lead.forEach(([s, f, l]) => game.ev.push({ s, v: 'lead', f, l }));
  const roots = ['D3', 'C3', 'D3', 'A2', 'F2', 'D3', 'Bb2', 'A2'];
  const chords = [[3, 7], [4, 7], [3, 7], [3, 7], [4, 7], [3, 7], [4, 7], [4, 7]];
  roots.forEach((rn, bar) => {
    const f = NOTE(rn);
    [0, 0, 7, 0, 12, 0, 7, 0].forEach((o, i) => game.ev.push({ s: bar * 16 + i * 2, v: 'bass', f: semi(f, o), l: 2 }));
    [2, 6, 10, 14].forEach(st => chords[bar].forEach(o => game.ev.push({ s: bar * 16 + st, v: 'stab', f: semi(f, 24 + o), l: 1 })));
    for (let i = 0; i < 16; i++) {
      if (i % 8 === 0) game.ev.push({ s: bar * 16 + i, v: 'kick' });
      if (i % 8 === 4) game.ev.push({ s: bar * 16 + i, v: 'snare' });
      if (i % 2 === 1) game.ev.push({ s: bar * 16 + i, v: 'hat' });
    }
  });

  const intro = { bpm: 96, len: 64, ev: [] };
  const iroots = ['D3', 'Bb2', 'C3', 'A2'];
  const ich = [[0, 3, 7, 12, 15], [0, 4, 7, 12, 16], [0, 4, 7, 12, 16], [0, 4, 7, 12, 16]];
  const arp = [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 3, 2, 1, 2, 1];
  iroots.forEach((rn, bar) => {
    const f = NOTE(rn);
    arp.forEach((ix, i) => intro.ev.push({ s: bar * 16 + i, v: 'arp', f: semi(f, 12 + ich[bar][ix]), l: 1 }));
    intro.ev.push({ s: bar * 16, v: 'pad', f, l: 16 });
    intro.ev.push({ s: bar * 16, v: 'kick' });
    intro.ev.push({ s: bar * 16 + 8, v: 'kick' });
  });
  seq('A4:8 F4:8 F4:8 D4:8 E4:8 G4:8 A4:12 C#5:4').forEach(([s, f, l]) => intro.ev.push({ s, v: 'lead', f, l }));
  [game, intro].forEach(t => { t.steps = Array.from({ length: t.len }, () => []); t.ev.forEach(e => t.steps[e.s].push(e)); });
  return { game, intro };
}

const A = {
  ctx: null, muted: store.get('bdm_muted', false), track: null, step: 0, nextT: 0, timer: null, tracks: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : 0.55; this.out.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = 0.42; this.mus.connect(this.out);
    this.fx = c.createGain(); this.fx.gain.value = 0.8; this.fx.connect(this.out);
    this.wave = {};
    for (const d of [0.125, 0.25, 0.5]) {
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = 2 * Math.sin(Math.PI * k * d) / (Math.PI * k);
      this.wave[d] = c.createPeriodicWave(re, im);
    }
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.tracks = buildTracks();
    this.timer = setInterval(() => this.pump(), 25);
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  },
  setMuted(m) {
    this.muted = m; store.set('bdm_muted', m);
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  },
  tone(f, t, dur, { duty = 0.5, type = null, vol = 0.15, dest = this.fx, slide = 0, vib = 0 } = {}) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    if (type) o.type = type; else o.setPeriodicWave(this.wave[duty]);
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 9; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(t, dur, { vol = 0.15, hp = 800, lp = 12000, dest = this.fx } = {}) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(h).connect(l).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.track === name) return;
    this.track = name; this.step = 0; this.nextT = this.ctx.currentTime + 0.06;
  },
  stop() { this.track = null; this.pending = null; },
  pump() {
    if (!this.ctx || !this.track) return;
    const t = this.tracks[this.track], sd = 60 / t.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.12) {
      for (const e of t.steps[this.step]) this.voice(e, this.nextT, sd);
      this.nextT += sd; this.step = (this.step + 1) % t.len;
    }
  },
  voice(e, t, sd) {
    const m = this.mus;
    switch (e.v) {
      case 'lead': this.tone(e.f, t, e.l * sd * 0.92, { duty: 0.25, vol: 0.11, dest: m, vib: e.l >= 4 ? 4 : 0 }); break;
      case 'bass': this.tone(e.f, t, e.l * sd * 0.85, { type: 'triangle', vol: 0.32, dest: m }); break;
      case 'stab': this.tone(e.f, t, sd * 0.7, { duty: 0.125, vol: 0.035, dest: m }); break;
      case 'arp': this.tone(e.f, t, sd * 0.9, { duty: 0.125, vol: 0.05, dest: m }); break;
      case 'pad': this.tone(e.f, t, e.l * sd, { type: 'triangle', vol: 0.28, dest: m }); break;
      case 'kick': this.tone(150, t, 0.12, { type: 'sine', vol: 0.5, dest: m, slide: 40 }); break;
      case 'snare': this.noise(t, 0.12, { vol: 0.12, hp: 1200, dest: m }); break;
      case 'hat': this.noise(t, 0.03, { vol: 0.05, hp: 7000, dest: m }); break;
    }
  },
  sfx(name, arg) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + 0.01;
    switch (name) {
      case 'pick': { const b = { pinto: 660, marron: 784, dorado: 988 }[arg] || 660; this.tone(b, t, 0.07, { duty: 0.25, vol: 0.13 }); this.tone(b * 1.5, t + 0.06, 0.1, { duty: 0.25, vol: 0.13 }); if (arg === 'dorado') this.tone(b * 2, t + 0.12, 0.14, { duty: 0.125, vol: 0.1 }); break; }
      case 'deposit': { const n = Math.min(arg || 1, 8); [523, 659, 784, 1047, 1319, 1568, 2093, 2637].slice(0, Math.max(3, n)).forEach((f, i) => this.tone(f, t + i * 0.06, 0.12, { duty: 0.25, vol: 0.12 })); break; }
      case 'hit': this.tone(700, t, 0.45, { duty: 0.5, vol: 0.18, slide: 70 }); this.noise(t, 0.3, { vol: 0.25, hp: 200, lp: 3000 }); break;
      case 'bark': [0, 0.13].forEach(d => { this.noise(t + d, 0.07, { vol: 0.22, hp: 500, lp: 2200 }); this.tone(320, t + d, 0.07, { duty: 0.5, vol: 0.08, slide: 180 }); }); break;
      case 'laugh': [0, 0.14, 0.28, 0.42].forEach((d, i) => this.tone(520 - i * 50, t + d, 0.11, { duty: 0.25, vol: 0.13, vib: 30 })); break;
      case 'jingle': for (let i = 0; i < 6; i++) this.tone(rand(2100, 2900), t + i * 0.05, 0.12, { type: 'triangle', vol: 0.07 }); break;
      case 'dash': this.noise(t, 0.35, { vol: 0.16, hp: 300, lp: 1800 }); break;
      case 'bonk': this.tone(180, t, 0.2, { type: 'square', vol: 0.18, slide: 60 }); this.noise(t, 0.12, { vol: 0.2, hp: 100, lp: 900 }); for (let i = 0; i < 3; i++) this.tone(1500 + i * 300, t + 0.15 + i * 0.07, 0.08, { type: 'triangle', vol: 0.06 }); break;
      case 'ball': this.tone(900, t, 0.05, { type: 'triangle', vol: 0.06, slide: 600 }); break;
      case 'level': ['D5', 'F5', 'A5', 'D6', 'r', 'A5', 'D6'].forEach((n, i) => { if (n !== 'r') this.tone(NOTE(n), t + i * 0.11, 0.16, { duty: 0.25, vol: 0.13 }); }); break;
      case 'over': ['A4', 'F4', 'D4', 'A3'].forEach((n, i) => this.tone(NOTE(n), t + i * 0.22, 0.3, { duty: 0.5, vol: 0.13, vib: 5 })); break;
      case 'blip': this.tone(1200, t, 0.02, { duty: 0.125, vol: 0.025 }); break;
      case 'whoosh': this.noise(t, 0.4, { vol: 0.18, hp: 900, lp: 5000 }); break;
      case 'thunder': this.noise(t, 1.2, { vol: 0.45, hp: 40, lp: 900 }); this.noise(t + 0.05, 0.25, { vol: 0.25, hp: 2000 }); break;
      case 'vs': this.tone(110, t, 0.5, { duty: 0.5, vol: 0.2, slide: 55 }); this.noise(t, 0.5, { vol: 0.2, hp: 100, lp: 2000 }); this.tone(NOTE('D5'), t + 0.1, 0.4, { duty: 0.25, vol: 0.12 }); this.tone(NOTE('A5'), t + 0.1, 0.4, { duty: 0.25, vol: 0.08 }); break;
      case 'start': ['D5', 'D5', 'A5'].forEach((n, i) => this.tone(NOTE(n), t + i * 0.1, i === 2 ? 0.3 : 0.08, { duty: 0.25, vol: 0.13 })); break;
    }
  },
};

/* =========================================================
   Entrada: teclado + joystick táctil
   ========================================================= */
const keys = new Set();
const input = { x: 0, y: 0 };
const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  A.init();
  if (e.target.tagName === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) return;
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.code === 'KeyM') toggleMute();
  if ((e.code === 'KeyP' || e.code === 'Escape') && (state === 'play' || state === 'paused')) togglePause();
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'intro') { e.preventDefault(); introAdvance(); }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
addEventListener('blur', () => { keys.clear(); if (state === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

const stage = $('#stage');
function stagePt(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
stage.addEventListener('pointerdown', e => {
  A.init();
  if (e.pointerType === 'mouse' || state !== 'play' || touch.id !== null) return;
  if (e.target.closest('button')) return;
  const p = stagePt(e);
  Object.assign(touch, { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y });
  const st = $('#stick'); st.hidden = false; st.style.left = `calc(${p.x} * var(--u))`; st.style.top = `calc(${p.y} * var(--u))`;
  $('#knob').style.transform = '';
});
stage.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.id) return;
  const p = stagePt(e); touch.x = p.x; touch.y = p.y;
  let dx = p.x - touch.ox, dy = p.y - touch.oy; const d = Math.hypot(dx, dy), max = 24;
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  $('#knob').style.transform = `translate(calc(${dx} * var(--u)), calc(${dy} * var(--u)))`;
});
const endTouch = e => { if (e.pointerId !== touch.id) return; touch.id = null; $('#stick').hidden = true; };
stage.addEventListener('pointerup', endTouch);
stage.addEventListener('pointercancel', endTouch);

function readInput() {
  let x = 0, y = 0;
  if (keys.has('l')) x -= 1; if (keys.has('r')) x += 1;
  if (keys.has('u')) y -= 1; if (keys.has('d')) y += 1;
  if (touch.id !== null) {
    const dx = touch.x - touch.ox, dy = touch.y - touch.oy, d = Math.hypot(dx, dy);
    if (d > 4) { const k = Math.min(1, d / 24); x = dx / d * k; y = dy / d * k; }
  }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.x = x; input.y = y;
}

/* =========================================================
   Mundo: movimiento y colisiones
   ========================================================= */
function inCorral(e) { return e.x < CORRAL.x1 - 2 && e.y > CORRAL.y0 + 3; }
function resolveRect(e, r, rc) {
  const cx = clamp(e.x, rc.x, rc.x + rc.w), cy = clamp(e.y, rc.y, rc.y + rc.h);
  const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 === 0) {
    const l = e.x - rc.x, rr = rc.x + rc.w - e.x, t = e.y - rc.y, b = rc.y + rc.h - e.y, mn = Math.min(l, rr, t, b);
    if (mn === l) e.x = rc.x - r; else if (mn === rr) e.x = rc.x + rc.w + r; else if (mn === t) e.y = rc.y - r; else e.y = rc.y + rc.h + r;
    return true;
  }
  const d = Math.sqrt(d2); e.x = cx + dx / d * r; e.y = cy + dy / d * r;
  return true;
}
const CORRAL_BLOCK = { x: CORRAL.x0 - 4, y: CORRAL.y0 - 6, w: CORRAL.x1 - CORRAL.x0 + 8, h: CORRAL.y1 - CORRAL.y0 + 10 };
// mueve una entidad con radio r; devuelve qué la frenó
function move(e, dx, dy, r, opts = {}) {
  e.x += dx; e.y += dy;
  let hit = null;
  for (const o of OBST) if (resolveRect(e, r, o)) hit = hit || o;
  if (opts.avoidCorral && resolveRect(e, r + 2, CORRAL_BLOCK)) hit = hit || CORRAL_BLOCK;
  const minY = Math.max(F.y0 + 8, HUD_H + (e.h || 16) - 2);
  const x0 = F.x0 + r + 2, x1 = F.x1 - r - 2, y1 = F.y1 - 4;
  if (e.x < x0 || e.x > x1 || e.y < minY || e.y > y1) hit = hit || 'wall';
  e.x = clamp(e.x, x0, x1); e.y = clamp(e.y, minY, y1);
  if (opts.inside) { e.x = clamp(e.x, CORRAL.x0 + 10, CORRAL.x1 - 10); e.y = clamp(e.y, CORRAL.y0 + 14, CORRAL.y1 - 6); }
  return hit;
}
function randomFieldPoint() {
  for (let i = 0; i < 40; i++) {
    const p = { x: rand(F.x0 + 20, F.x1 - 20), y: rand(F.y0 + 30, F.y1 - 12) };
    if (p.x < CORRAL.x1 + 14 && p.y > CORRAL.y0 - 16) continue;
    if (OBST.some(o => p.x > o.x - 12 && p.x < o.x + o.w + 12 && p.y > o.y - 12 && p.y < o.y + o.h + 12)) continue;
    return p;
  }
  return { x: 380, y: 170 };
}

/* =========================================================
   Estado del juego
   ========================================================= */
let state = 'boot';
let G = null;

function levelCfg(n) {
  return {
    goal: 5 + n * 2, maxField: Math.min(3 + n, 8), dogs: Math.min(n, 5),
    dogSpeed: 64 + n * 4, clownWalk: 34 + n * 6, clownDash: 225 + n * 15,
    windup: Math.max(0.45, 0.85 - n * 0.06), balls: n >= 3, gold: Math.min(0.08 + n * 0.015, 0.2),
  };
}
const LEVEL_LINES = ['', 'Atrapá los becerros y llevalos al corral', 'Clown se puso nervioso', 'Clown empezó a hacer malabares', 'Llegaron más perros', 'Clown no duerme más', 'Esto ya es personal'];

function newWorld(demo) {
  return {
    demo, level: 1, cfg: levelCfg(1), score: 0, lives: 3, total: 0, levelDep: 0, time: 0, spawnT: 0.3,
    marto: { x: 79, y: 306, vx: 0, vy: 0, h: 54, dir: 'front', walk: 0, moving: false, state: 'ok', fallT: 0, fallDir: 1, inv: 0, trail: [{ x: 79, y: 306 }], followers: [], dustT: 0 },
    calves: [], dogs: [], clown: null, balls: [], parts: [], texts: [], shake: 0, flash: 0,
  };
}
function spawnCalf(fromBarn) {
  const cfg = G.cfg, x = Math.random();
  const type = x < cfg.gold ? 'dorado' : x < cfg.gold + 0.3 ? 'marron' : 'pinto';
  const c = { type, x: 0, y: 0, h: 18, vx: 0, vy: 0, state: 'wander', t: 0, tx: 0, ty: 0, face: 1, anim: 0, idle: 0, moving: false };
  if (fromBarn) { c.x = BARN.door.x; c.y = BARN.door.y; c.state = 'spawn'; const p = randomFieldPoint(); c.tx = p.x; c.ty = Math.max(p.y, 120); }
  else { const p = randomFieldPoint(); c.x = p.x; c.y = p.y; const q = randomFieldPoint(); c.tx = q.x; c.ty = q.y; }
  G.calves.push(c);
  return c;
}
function setupLevel(n) {
  G.level = n; G.cfg = levelCfg(n); G.levelDep = 0;
  G.balls = [];
  const m = G.marto;
  G.dogs = [];
  const spots = [[600, 60], [600, 330], [420, 60], [230, 60], [600, 200]];
  for (let i = 0; i < G.cfg.dogs; i++) {
    const [x, y] = spots[i % spots.length];
    G.dogs.push({ x, y, h: 16, state: 'patrol', t: rand(1, 3), tx: x, ty: y, face: -1, anim: 0, vx: 0, vy: 0 });
  }
  G.clown = { x: 520, y: 170, h: 60, vx: 0, vy: 0, state: 'stroll', t: 3, face: 'front', walk: 0, after: [], afterT: 0, dx: 0, dy: 0 };
  m.inv = Math.max(m.inv, 1.2);
  const field = G.calves.filter(c => c.state !== 'corral').length;
  for (let i = field; i < 3; i++) spawnCalf(false);
}

/* =========================================================
   Partículas y textos
   ========================================================= */
function puff(x, y, n = 3, col = '#e8d7a8') {
  for (let i = 0; i < n; i++) G.parts.push({ k: 'dust', x: x + rand(-4, 4), y: y + rand(-2, 1), vx: rand(-14, 14), vy: rand(-18, -4), life: rand(0.3, 0.55), max: 0.55, s: rand(2, 4), col });
}
function hearts(x, y) { for (let i = 0; i < 2; i++) G.parts.push({ k: 'heart', x: x + rand(-6, 6), y: y - 16, vx: rand(-8, 8), vy: rand(-34, -22), life: 0.8, max: 0.8 }); }
function sparkle(x, y) { G.parts.push({ k: 'spark', x: x + rand(-9, 9), y: y + rand(-16, 0), vx: 0, vy: -10, life: 0.5, max: 0.5 }); }
function floatText(x, y, txt, col = '#fff4d6', big = false) { G.texts.push({ x, y, txt, col, big, life: 1.2 }); }

/* =========================================================
   Update: Marto
   ========================================================= */
function trailPoint(d) {
  const m = G.marto, t = m.trail;
  let acc = 0, prev = { x: m.x, y: m.y };
  for (let i = t.length - 1; i >= 0; i--) {
    const p = t[i], seg = Math.hypot(prev.x - p.x, prev.y - p.y);
    if (acc + seg >= d) { const k = (d - acc) / (seg || 1); return { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k }; }
    acc += seg; prev = p;
  }
  return { x: prev.x, y: prev.y };
}
function updateMarto(dt) {
  const m = G.marto;
  if (m.inv > 0) m.inv -= dt;
  if (m.state === 'fallen') {
    m.fallT -= dt;
    if (m.fallT <= 0) { if (G.lives <= 0) return gameOver(); m.state = 'ok'; m.inv = 1.8; }
    return;
  }
  const k = Math.min(1, dt * 14);
  m.vx += (input.x * MARTO_SPEED - m.vx) * k;
  m.vy += (input.y * MARTO_SPEED - m.vy) * k;
  move(m, m.vx * dt, m.vy * dt, 8);
  m.moving = Math.hypot(m.vx, m.vy) > 14;
  if (m.moving) {
    m.walk += dt * 12;
    const ax = Math.abs(m.vx), ay = Math.abs(m.vy);
    m.dir = ax > ay * 1.05 ? (m.vx > 0 ? 'right' : 'left') : (m.vy > 0 ? 'front' : 'back');
    m.dustT -= dt;
    if (m.dustT <= 0) { puff(m.x, m.y, 1); m.dustT = 0.16; }
  }
  const last = m.trail[m.trail.length - 1];
  if (Math.hypot(m.x - last.x, m.y - last.y) >= 2) m.trail.push({ x: m.x, y: m.y });
  // recorta la estela a lo que necesita la fila
  const need = (m.followers.length + 2) * SPACING + 10;
  let acc = 0;
  for (let i = m.trail.length - 1; i > 0; i--) {
    acc += Math.hypot(m.trail[i].x - m.trail[i - 1].x, m.trail[i].y - m.trail[i - 1].y);
    if (acc > need) { m.trail.splice(0, i - 1); break; }
  }
  m.followers.forEach((c, i) => {
    const p = trailPoint((i + 1) * SPACING);
    const dx = p.x - c.x, dy = p.y - c.y;
    c.moving = Math.hypot(dx, dy) > 0.4;
    if (Math.abs(dx) > 0.3) c.face = dx > 0 ? 1 : -1;
    c.x += dx * Math.min(1, dt * 14); c.y += dy * Math.min(1, dt * 14);
    if (c.moving) c.anim += dt * 10;
    if (c.type === 'dorado' && Math.random() < dt * 4) sparkle(c.x, c.y);
  });
  if (inCorral(m) && m.followers.length) deposit();
  for (const c of G.calves) {
    if (c.state === 'wander' && Math.hypot(c.x - m.x, c.y - m.y) < 17) catchCalf(c);
  }
}
function catchCalf(c) {
  const m = G.marto;
  c.state = 'follow';
  m.followers.push(c);
  hearts(c.x, c.y);
  A.sfx('pick', c.type);
  if (c.type === 'dorado') floatText(c.x, c.y - 22, '¡Dorado!', '#ffe27a');
  hud();
}
function deposit() {
  const m = G.marto, n = m.followers.length;
  const base = m.followers.reduce((s, c) => s + CALF_TYPES[c.type].value, 0);
  const mult = Math.min(3, 1 + 0.25 * (n - 1));
  const pts = Math.round(base * mult);
  G.score += pts; G.levelDep += n; G.total += n;
  m.followers.forEach(c => { c.state = 'corral'; c.t = rand(0.5, 2); c.tx = rand(CORRAL.x0 + 12, CORRAL.x1 - 12); c.ty = rand(CORRAL.y0 + 16, CORRAL.y1 - 8); });
  m.followers = [];
  m.trail = [{ x: m.x, y: m.y }];
  floatText(m.x, m.y - 62, `+${pts}`, '#ffe27a', true);
  if (mult > 1) floatText(m.x, m.y - 48, `combo x${mult.toFixed(2).replace(/\.?0+$/, '')}`, '#fff4d6');
  A.sfx('deposit', n);
  // el corral muestra los últimos 12
  const inC = G.calves.filter(c => c.state === 'corral');
  for (let i = 0; i < inC.length - 12; i++) G.calves.splice(G.calves.indexOf(inC[i]), 1);
  hud();
  if (G.levelDep >= G.cfg.goal) levelClear();
}
function hitMarto(src) {
  const m = G.marto;
  if (m.state !== 'ok') return;
  m.state = 'fallen';
  // los enemigos festejan y le dan aire para levantarse
  for (const d of G.dogs) { d.state = 'rest'; d.t = 2.4; }
  if (G.clown) { G.clown.state = 'laugh'; G.clown.t = 2.2; G.clown.after = []; floatText(G.clown.x, G.clown.y - 68, '¡JA JA!', '#e6b83c'); } m.fallT = 1.45; m.fallDir = src.x < m.x ? 1 : -1;
  G.lives--; G.shake = 0.35; G.flash = 0.12;
  A.sfx('hit');
  if (src === G.clown) setTimeout(() => A.sfx('laugh'), 250);
  puff(m.x, m.y, 8);
  if (m.followers.length) floatText(m.x, m.y - 60, `-${m.followers.length} becerro${m.followers.length > 1 ? 's' : ''}`, '#ff8a7a', true);
  m.followers.forEach(c => {
    const a = Math.atan2(c.y - m.y, c.x - m.x) + rand(-0.7, 0.7), s = rand(110, 170);
    c.state = 'scared'; c.t = 1.1; c.vx = Math.cos(a) * s; c.vy = Math.sin(a) * s;
  });
  m.followers = []; m.trail = [{ x: m.x, y: m.y }];
  m.vx = m.fallDir * 60; m.vy = 0;
  hud();
}

/* =========================================================
   Update: becerros, perros, Clown, pelotas
   ========================================================= */
function updateCalves(dt) {
  const m = G.marto;
  for (const c of G.calves) {
    const T = CALF_TYPES[c.type];
    if (c.state === 'follow') continue;
    c.t -= dt;
    let vx = 0, vy = 0, sp = T.speed;
    if (c.state === 'spawn') {
      const d = Math.hypot(c.tx - c.x, c.ty - c.y);
      if (d < 6 || c.t < -4) { c.state = 'wander'; c.t = 0; }
      else { vx = (c.tx - c.x) / d; vy = (c.ty - c.y) / d; sp *= 1.5; }
      c.x += vx * sp * dt; c.y += vy * sp * dt;
      if (c.y > OBST[0].y + OBST[0].h + 4) move(c, 0, 0, 6, { avoidCorral: true });
    } else if (c.state === 'scared') {
      c.vx *= Math.pow(0.12, dt); c.vy *= Math.pow(0.12, dt);
      const hit = move(c, c.vx * dt, c.vy * dt, 6, { avoidCorral: true });
      if (hit) { c.vx *= -0.5; c.vy *= -0.5; }
      vx = c.vx; vy = c.vy; sp = 1;
      if (c.t <= 0) { c.state = 'wander'; c.t = 0; }
    } else if (c.state === 'wander') {
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (!G.demo && m.state === 'ok' && d < T.fleeR && d > 0) {
        vx = (c.x - m.x) / d; vy = (c.y - m.y) / d; sp *= T.flee; c.idle = 0;
      } else if (c.idle > 0) {
        c.idle -= dt;
      } else {
        const dd = Math.hypot(c.tx - c.x, c.ty - c.y);
        if (dd < 5 || c.t <= 0) { const p = randomFieldPoint(); c.tx = p.x; c.ty = p.y; c.t = rand(3, 6); c.idle = rand(0.4, 2.2); }
        else { vx = (c.tx - c.x) / dd; vy = (c.ty - c.y) / dd; }
      }
      if (vx || vy) { const hit = move(c, vx * sp * dt, vy * sp * dt, 6, { avoidCorral: true }); if (hit && c.idle <= 0 && Math.random() < 0.05) c.t = 0; }
    } else if (c.state === 'corral') {
      if (c.idle > 0) c.idle -= dt;
      else {
        const dd = Math.hypot(c.tx - c.x, c.ty - c.y);
        if (dd < 3 || c.t <= 0) { c.tx = rand(CORRAL.x0 + 12, CORRAL.x1 - 12); c.ty = rand(CORRAL.y0 + 16, CORRAL.y1 - 8); c.t = rand(2, 4); c.idle = rand(1, 4); }
        else { vx = (c.tx - c.x) / dd; vy = (c.ty - c.y) / dd; sp = 18; c.x += vx * sp * dt; c.y += vy * sp * dt; }
      }
    }
    c.moving = Math.abs(vx) + Math.abs(vy) > 0.01 && sp > 0;
    if (c.moving) { c.anim += dt * (c.state === 'scared' ? 16 : 9); if (Math.abs(vx) > 0.05) c.face = vx > 0 ? 1 : -1; }
    if (c.type === 'dorado' && Math.random() < dt * 3) sparkle(c.x, c.y);
  }
}
function martoTargetable() { const m = G.marto; return !G.demo && m.state === 'ok' && m.inv <= 0 && !inCorral(m) && m.y > 0; }
function updateDogs(dt) {
  const m = G.marto, cfg = G.cfg, tg = martoTargetable();
  for (const d of G.dogs) {
    d.t -= dt;
    let vx = 0, vy = 0, sp = 0;
    const dm = Math.hypot(m.x - d.x, m.y - d.y);
    if (d.state === 'patrol') {
      const dd = Math.hypot(d.tx - d.x, d.ty - d.y);
      if (dd < 5 || d.t <= 0) { const p = randomFieldPoint(); d.tx = p.x; d.ty = p.y; d.t = rand(2, 4); }
      else { vx = (d.tx - d.x) / dd; vy = (d.ty - d.y) / dd; sp = 40; }
      if (tg && dm < 115) { d.state = 'alert'; d.t = 0.4; A.sfx('bark'); }
    } else if (d.state === 'alert') {
      if (d.t <= 0) { d.state = 'chase'; d.t = 3.2; }
      if (Math.abs(m.x - d.x) > 2) d.face = m.x > d.x ? 1 : -1;
    } else if (d.state === 'chase') {
      if (dm > 0) { vx = (m.x - d.x) / dm; vy = (m.y - d.y) / dm; sp = cfg.dogSpeed; }
      if (d.t <= 0 || !tg) { d.state = 'rest'; d.t = 1.6; }
    } else if (d.state === 'rest') {
      if (d.t <= 0) { d.state = 'patrol'; d.t = 0; }
    }
    for (const o of G.dogs) if (o !== d) { const dx = d.x - o.x, dy = d.y - o.y, dd = Math.hypot(dx, dy); if (dd > 0 && dd < 16) { d.x += dx / dd * 20 * dt; d.y += dy / dd * 20 * dt; } }
    if (sp) move(d, vx * sp * dt, vy * sp * dt, 7, { avoidCorral: true });
    d.moving = sp > 0;
    if (d.moving) { d.anim += dt * (d.state === 'chase' ? 16 : 9); if (Math.abs(vx) > 0.1) d.face = vx > 0 ? 1 : -1; }
    if (tg && m.state === 'ok' && dm < 13) hitMarto(d);
  }
}
function faceFrom(vx, vy) { return Math.abs(vx) > Math.abs(vy) * 1.05 ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'front' : 'back'); }
function updateClown(dt) {
  const c = G.clown, m = G.marto, cfg = G.cfg, tg = martoTargetable();
  if (!c) return;
  c.t -= dt;
  const dm = Math.hypot(m.x - c.x, m.y - c.y);
  let sp = 0, vx = 0, vy = 0;
  switch (c.state) {
    case 'stroll': {
      const target = tg ? m : { x: 380, y: 190 };
      const d = Math.hypot(target.x - c.x, target.y - c.y);
      if (d > 20) { vx = (target.x - c.x) / d; vy = (target.y - c.y) / d; sp = cfg.clownWalk; }
      if (c.t <= 0 && tg && dm < 280) {
        if (cfg.balls && Math.random() < 0.4) { c.state = 'juggle'; c.t = 0.8; c.thrown = 0; }
        else { c.state = 'windup'; c.t = cfg.windup; A.sfx('jingle'); }
      }
      break;
    }
    case 'windup':
      if (c.t <= 0) {
        const d = Math.max(1, dm);
        c.dx = (m.x - c.x) / d; c.dy = (m.y - c.y) / d;
        c.state = 'dash'; c.t = 0.8; A.sfx('dash');
      }
      if (Math.abs(m.x - c.x) > 3) c.face = m.x > c.x ? 'right' : 'left';
      break;
    case 'dash': {
      const hit = move(c, c.dx * cfg.clownDash * dt, c.dy * cfg.clownDash * dt, 9, { avoidCorral: true });
      c.walk += dt * 24;
      c.afterT -= dt;
      if (c.afterT <= 0) { c.after.push({ x: c.x, y: c.y, face: c.face, life: 0.3 }); c.afterT = 0.035; }
      if (Math.random() < dt * 30) puff(c.x, c.y, 1, '#d9c79a');
      if (hit && hit !== 'wall' && hit !== CORRAL_BLOCK) {
        c.state = 'dizzy'; c.t = 2.3; G.shake = 0.25; A.sfx('bonk'); puff(c.x, c.y, 10);
        floatText(c.x, c.y - 66, '¡Mareado!', '#ffe27a');
      } else if (hit || c.t <= 0) { c.state = 'tired'; c.t = 0.9; }
      break;
    }
    case 'tired': if (c.t <= 0) { c.state = 'stroll'; c.t = rand(2, 3.4); } break;
    case 'laugh': {
      const d = Math.max(1, dm);
      if (d < 90) { vx = (c.x - m.x) / d; vy = (c.y - m.y) / d; sp = 30; }
      if (c.t <= 0) { c.state = 'stroll'; c.t = rand(2.6, 3.6); }
      break;
    }
    case 'dizzy': if (c.t <= 0) { c.state = 'stroll'; c.t = rand(2.4, 3.6); } break;
    case 'juggle':
      if (c.thrown < 3 && c.t < 0.6 - c.thrown * 0.18) {
        const a = Math.atan2(m.y - c.y, m.x - c.x) + (c.thrown - 1) * 0.35, s = 130;
        G.balls.push({ x: c.x, y: c.y, z: 34, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 60, life: 3, col: ['#b8322a', '#2f5fa8', '#e6b83c'][c.thrown] });
        c.thrown++; A.sfx('ball');
      }
      if (c.t <= 0) { c.state = 'stroll'; c.t = rand(2.2, 3.4); }
      break;
  }
  if (sp) { move(c, vx * sp * dt, vy * sp * dt, 9, { avoidCorral: true }); c.walk += dt * 9; }
  if (c.state === 'stroll' || c.state === 'dash') { const fx = sp ? vx : c.dx, fy = sp ? vy : c.dy; if (fx || fy) c.face = faceFrom(fx, fy); }
  c.moving = sp > 0 || c.state === 'dash';
  c.after = c.after.filter(a => (a.life -= dt) > 0);
  if (c.state === 'laugh') c.face = 'front';
  if (tg && m.state === 'ok' && c.state !== 'dizzy' && c.state !== 'laugh' && dm < 15) hitMarto(c);
}
function updateBalls(dt) {
  const m = G.marto, tg = martoTargetable();
  for (const b of G.balls) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 380 * dt; b.life -= dt;
    if (b.z < 0) { b.z = 0; b.vz = Math.abs(b.vz) * 0.62 + 40; }
    if (b.x < F.x0 + 4 || b.x > F.x1 - 4) b.vx *= -1;
    if (b.y < F.y0 + 10 || b.y > F.y1 - 4) b.vy *= -1;
    if (inCorral(b)) b.life = 0;
    if (tg && m.state === 'ok' && b.z < 12 && Math.hypot(b.x - m.x, b.y - m.y) < 10) { b.life = 0; hitMarto(b); }
  }
  G.balls = G.balls.filter(b => b.life > 0);
}
function updateParts(dt) {
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.y -= 18 * dt; t.life -= dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  if (G.shake > 0) G.shake -= dt;
  if (G.flash > 0) G.flash -= dt;
}

function updatePlay(dt) {
  G.time += dt;
  readInput();
  updateMarto(dt);
  if (state !== 'play') return;
  updateCalves(dt);
  updateDogs(dt);
  updateClown(dt);
  updateBalls(dt);
  updateParts(dt);
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    const onField = G.calves.filter(c => c.state !== 'corral').length;
    const left = G.cfg.goal - G.levelDep;
    if (onField < G.cfg.maxField && onField < left + 2) spawnCalf(Math.random() < 0.55);
    G.spawnT = rand(1.4, 2.6);
  }
}
function updateDemo(dt) {
  G.time += dt;
  updateCalves(dt);
  updateDogs(dt);
  updateParts(dt);
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.calves.length < 7) { spawnCalf(Math.random() < 0.5); G.spawnT = 2; }
}

/* =========================================================
   Render del mundo
   ========================================================= */
function shadow(x, y, rx) { ctx.fillStyle = 'rgba(40,28,10,.3)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y) + 1, rx, 3, 0, 0, Math.PI * 2); ctx.fill(); }
function drawFeet(img, x, y, flip, dy = 0) {
  const w = img.width, h = img.height;
  const px = Math.round(x - w / 2), py = Math.round(y - h + 2 + dy);
  if (flip) { ctx.save(); ctx.translate(px + w, py); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
  else ctx.drawImage(img, px, py);
}
function bang(x, y, col = '#b8322a') {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2b1a0d'; ctx.fillRect(x - 4, y - 11, 9, 12);
  ctx.fillStyle = '#fff8e4'; ctx.fillRect(x - 3, y - 10, 7, 10);
  ctx.fillStyle = col; ctx.fillRect(x, y - 9, 1, 5); ctx.fillRect(x, y - 3, 1, 1);
  ctx.fillStyle = '#2b1a0d'; ctx.fillRect(x - 1, y + 1, 3, 1);
}
function stars(cx, cy, t, n = 3, rx = 10) {
  for (let i = 0; i < n; i++) {
    const a = t * 6 + i * Math.PI * 2 / n, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * rx * 0.35);
    ctx.fillStyle = '#2b1a0d'; ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
  }
}
function drawCalf(c) {
  const fr = SPR['calf_' + c.type][c.moving ? Math.floor(c.anim) % 2 : 0];
  const bob = c.state === 'follow' && c.moving ? -Math.abs(Math.sin(c.anim * 1.6)) * 1.5 : 0;
  drawFeet(fr, c.x, c.y, c.face < 0, bob);
  if (c.state === 'scared') bang(c.x + c.face * 4, c.y - 22, '#2f5fa8');
}
function drawDog(d) {
  const tongue = d.state === 'chase' || d.state === 'rest' ? 2 : 0;
  const fr = SPR.dog[(d.moving ? Math.floor(d.anim) % 2 : 0) + tongue];
  drawFeet(fr, d.x, d.y, d.face < 0, d.state === 'rest' ? Math.round(Math.sin(G.time * 12)) * 0.5 : 0);
  if (d.state === 'alert') bang(d.x + d.face * 6, d.y - 20);
}
function martoImg(dir) { return dir === 'front' ? IMG.marto_front : dir === 'back' ? IMG.marto_back : IMG.marto_side; }
function drawMarto(m) {
  if (m.state === 'fallen') {
    const img = IMG.marto_front, k = ease((1.45 - m.fallT) / 0.22);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y - 2)); ctx.rotate(m.fallDir * k * Math.PI / 2);
    ctx.drawImage(img, -Math.round(img.width / 2), -img.height + 4); ctx.restore();
    if (k >= 1) stars(m.x + m.fallDir * (img.height - 14), m.y - 10, G.time, 3, 9);
    return;
  }
  if (m.inv > 0 && Math.floor(m.inv * 12) % 2) return;
  const img = martoImg(m.dir);
  const bob = m.moving ? -Math.round(Math.abs(Math.sin(m.walk)) * 2) : (Math.sin(G.time * 2.4) > 0.6 ? -1 : 0);
  drawFeet(img, m.x, m.y, m.dir === 'right', bob);
}
function clownImg(f) { return f === 'front' ? IMG.clown_front : f === 'back' ? IMG.clown_back : IMG.clown_side; }
function drawClown(c) {
  for (const a of c.after) { ctx.globalAlpha = a.life * 1.2; drawFeet(clownImg(a.face), a.x, a.y, a.face === 'left'); }
  ctx.globalAlpha = 1;
  let ox = 0, dy = 0;
  if (c.state === 'windup') { ox = Math.round(rand(-1.5, 1.5)); ctx.fillStyle = `rgba(184,50,42,${0.25 + 0.2 * Math.sin(G.time * 30)})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 16, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  if (c.moving) dy = -Math.round(Math.abs(Math.sin(c.walk)) * 2);
  if (c.state === 'dizzy') ox = Math.round(Math.sin(G.time * 8) * 1.5);
  if (c.state === 'laugh') dy = Math.sin(G.time * 22) > 0 ? -2 : 0;
  drawFeet(clownImg(c.face), c.x + ox, c.y, c.face === 'left', dy);
  if (c.state === 'windup') bang(c.x, c.y - 66);
  if (c.state === 'dizzy') stars(c.x, c.y - 58, G.time, 3, 11);
  if (c.state === 'juggle') {
    for (let i = 0; i < 3; i++) { const a = G.time * 9 + i * 2.1; ctx.fillStyle = ['#b8322a', '#2f5fa8', '#e6b83c'][i]; ctx.fillRect(Math.round(c.x + Math.cos(a) * 9) - 2, Math.round(c.y - 64 + Math.sin(a) * 6) - 2, 4, 4); }
  }
}
function drawBall(b) {
  const x = Math.round(b.x), y = Math.round(b.y - b.z);
  ctx.fillStyle = '#2b1a0d'; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
  ctx.fillStyle = b.col; ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 1, y - 1, 1, 1);
}
function drawParts() {
  for (const p of G.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'dust') { ctx.globalAlpha = a * 0.8; ctx.fillStyle = p.col; const s = Math.round(p.s * (1.4 - a * 0.4)); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
    else if (p.k === 'heart') { ctx.globalAlpha = a; ctx.drawImage(SPR.heart, Math.round(p.x - 4), Math.round(p.y - 4)); }
    else if (p.k === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = '#fff3b8'; const x = Math.round(p.x), y = Math.round(p.y); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.texts) {
    ctx.globalAlpha = clamp(t.life * 2, 0, 1);
    ctx.font = `700 ${t.big ? 14 : 10}px "Pixelify Sans", monospace`;
    ctx.lineWidth = 3; ctx.strokeStyle = '#2b1a0d'; ctx.strokeText(t.txt, Math.round(t.x), Math.round(t.y));
    ctx.fillStyle = t.col; ctx.fillText(t.txt, Math.round(t.x), Math.round(t.y));
  }
  ctx.globalAlpha = 1;
}
function renderWorld() {
  ctx.save();
  if (G.shake > 0) ctx.translate(Math.round(rand(-3, 3)), Math.round(rand(-2, 2)));
  ctx.drawImage(BG, 0, 0);
  const m = G.marto;
  // pista: flecha a la tranquera cuando hay fila
  if (!G.demo && m.followers.length) {
    const y = CORRAL.y0 - 26 + Math.round(Math.sin(G.time * 6) * 3), x = (GATE.x0 + GATE.x1) / 2;
    ctx.fillStyle = '#2b1a0d'; ctx.fillRect(x - 5, y - 1, 11, 6); ctx.fillRect(x - 8, y + 4, 17, 3); ctx.fillRect(x - 6, y + 7, 13, 2); ctx.fillRect(x - 4, y + 9, 9, 2); ctx.fillRect(x - 2, y + 11, 5, 2);
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 4, y, 9, 5); ctx.fillRect(x - 7, y + 5, 15, 1); ctx.fillRect(x - 5, y + 6, 11, 2); ctx.fillRect(x - 3, y + 8, 7, 2); ctx.fillRect(x - 1, y + 10, 3, 2);
  }
  const list = [];
  for (const o of OBST) {
    if (o.kind === 'bale') list.push({ y: o.y + o.h, d: () => ctx.drawImage(SPR.bale, o.x - 1, o.y + o.h - SPR.bale.height + 1) });
    else if (o.kind === 'barn') list.push({ y: o.y + o.h, d: () => ctx.drawImage(SPR.barn, BARN.x, BARN.y) });
    else if (o.kind === 'well') list.push({ y: o.y + o.h, d: () => ctx.drawImage(SPR.well, o.x - 2, o.y + o.h - SPR.well.height + 2) });
  }
  for (const c of G.calves) { shadow(c.x, c.y, 8); list.push({ y: c.y, d: () => drawCalf(c) }); }
  for (const d of G.dogs) { shadow(d.x, d.y, 9); list.push({ y: d.y, d: () => drawDog(d) }); }
  if (!G.demo) {
    if (G.clown) { shadow(G.clown.x, G.clown.y, 11); list.push({ y: G.clown.y, d: () => drawClown(G.clown) }); }
    if (m.state !== 'fallen') shadow(m.x, m.y, 10);
    list.push({ y: m.y, d: () => drawMarto(m) });
    for (const b of G.balls) { shadow(b.x, b.y, 3); list.push({ y: b.y, d: () => drawBall(b) }); }
  }
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  ctx.drawImage(FG, 0, 0);
  drawParts();
  drawTexts();
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 4})`; ctx.fillRect(0, 0, W, H); }
}

/* =========================================================
   HUD y pantallas
   ========================================================= */
const hudCache = {};
function setHtml(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function hud() {
  if (!G || G.demo) return;
  setHtml('#hLevel', `Nivel ${G.level}`);
  setHtml('#hLives', [0, 1, 2].map(i => `<img class="px${i < G.lives ? '' : ' off'}" src="${SPR.icons.heart}" alt="">`).join(''));
  setHtml('#hGoal', `Corral ${Math.min(G.levelDep, G.cfg.goal)}/${G.cfg.goal}`);
  setHtml('#hScore', String(G.score).padStart(5, '0'));
  const n = G.marto.followers.length;
  setHtml('#hTrail', `<img class="px" src="${SPR.icons.pinto}" alt=""><span>x${n}</span>`);
  $('#hTrail').classList.toggle('hot', n >= 3);
}
let bannerTimer = null;
function banner(title, sub, ms = 2200) {
  const b = $('#banner');
  b.querySelector('.bt').textContent = title;
  b.querySelector('.bs').textContent = sub || '';
  b.hidden = false;
  const el = b.querySelector('.bt'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, ms);
}
function show(id) { ['#title', '#intro', '#pause', '#over', '#rank'].forEach(s => { $(s).hidden = s !== id; }); }

function goTitle() {
  state = 'title';
  G = newWorld(true);
  for (let i = 0; i < 5; i++) spawnCalf(false);
  G.dogs = [{ x: 560, y: 300, h: 16, state: 'patrol', t: 1, tx: 560, ty: 300, face: -1, anim: 0 }];
  show('#title');
  $('#hud').hidden = true; $('#banner').hidden = true;
  const best = store.get('bdm_best', 0);
  $('#tBest').hidden = !best; $('#tBest').textContent = `Tu mejor puntaje: ${best}`;
  $('#bIntro').hidden = !store.get('bdm_seen', false);
  A.play('intro');
}
function startGame() {
  A.init();
  G = newWorld(false);
  setupLevel(1);
  state = 'play';
  show(null);
  $('#hud').hidden = false;
  for (const k in hudCache) delete hudCache[k];
  hud();
  A.play('game');
  A.sfx('start');
  banner('Nivel 1', `Llevá ${G.cfg.goal} becerros al corral`);
}
function togglePause() {
  if (state === 'play') { state = 'paused'; show('#pause'); keys.clear(); }
  else if (state === 'paused') { state = 'play'; show(null); }
}
function levelClear() {
  state = 'levelclear';
  const bonus = 100 * G.level + 25 * G.lives;
  G.score += bonus;
  hud();
  A.sfx('level');
  banner(`¡Nivel ${G.level} superado!`, `+${bonus} de bonus`, 2400);
  G.clearT = 2.6;
}
function updateLevelClear(dt) {
  G.time += dt;
  updateParts(dt);
  for (const c of G.calves) if (c.state === 'corral') { /* se quedan quietos mientras dura el cartel */ }
  G.clearT -= dt;
  if (G.clearT <= 0) {
    setupLevel(G.level + 1);
    state = 'play';
    hud();
    banner(`Nivel ${G.level}`, `${LEVEL_LINES[Math.min(G.level, LEVEL_LINES.length - 1)]} · meta ${G.cfg.goal} becerros`);
  }
}
function gameOver() {
  state = 'over';
  A.stop();
  A.sfx('over');
  const best = Math.max(store.get('bdm_best', 0), G.score);
  store.set('bdm_best', best);
  $('#oTitle').textContent = 'Fin del juego';
  $('#oScore').textContent = G.score;
  $('#oStats').textContent = `${G.total} becerro${G.total === 1 ? '' : 's'} al corral · llegaste al nivel ${G.level}`;
  $('#oName').value = store.get('bdm_name', '');
  $('#oSave').disabled = false; $('#oName').disabled = false;
  $('#oMsg').textContent = LB.online ? '' : 'El ranking online todavía no está conectado: se guarda en este navegador';
  G.saved = false;
  $('#hud').hidden = true;
  setTimeout(() => { if (state === 'over') { show('#over'); if (!matchMedia('(pointer: coarse)').matches) $('#oName').focus(); } }, 700);
  renderBoard('#oBoard', '#oNote');
}

/* =========================================================
   Ranking (Supabase REST, con respaldo local)
   ========================================================= */
const LB = {
  url: (CFG.supabaseUrl || '').replace(/\/$/, ''),
  key: CFG.supabaseAnonKey || '',
  table: CFG.table || 'becerros_scores',
  get online() { return Boolean(this.url && this.key); },
  headers(extra = {}) {
    const h = { apikey: this.key, 'Content-Type': 'application/json', ...extra };
    if (this.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + this.key;
    return h;
  },
  local() { return store.get('bdm_scores', []); },
  dedupe(rows) {
    const seen = new Set();
    return rows.filter(r => { const k = String(r.player_name).trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  },
  async top(n = 10) {
    const localRows = () => this.dedupe(this.local().sort((a, b) => b.score - a.score)).slice(0, n);
    if (!this.online) return { rows: localRows(), local: true };
    try {
      const r = await fetch(`${this.url}/rest/v1/${this.table}?select=player_name,score,calves,level&order=score.desc&limit=80`, { headers: this.headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { rows: this.dedupe(await r.json()).slice(0, n), local: false };
    } catch (e) {
      console.warn('ranking:', e);
      return { rows: localRows(), local: true, error: true };
    }
  },
  async submit(entry) {
    const l = this.local(); l.push(entry); store.set('bdm_scores', l.sort((a, b) => b.score - a.score).slice(0, 50));
    if (!this.online) return { ok: false, local: true };
    try {
      const r = await fetch(`${this.url}/rest/v1/${this.table}`, { method: 'POST', headers: this.headers({ Prefer: 'return=minimal' }), body: JSON.stringify(entry) });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      return { ok: true };
    } catch (e) {
      console.warn('ranking:', e);
      return { ok: false, error: true };
    }
  },
};
async function renderBoard(listSel, noteSel, me) {
  const ol = $(listSel), note = $(noteSel);
  ol.innerHTML = '<span class="empty">Cargando…</span>';
  const { rows, local, error } = await LB.top(10);
  ol.innerHTML = '';
  if (!rows.length) { ol.innerHTML = '<span class="empty">Todavía no hay puntajes. ¡Sé el primero!</span>'; }
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const isMe = me && r.player_name.trim().toLowerCase() === me.name.toLowerCase() && r.score === me.score;
    if (isMe) li.className = 'me';
    [['r', i + 1], ['nm', r.player_name], ['sc', r.score]].forEach(([c, v]) => { const s = document.createElement('span'); s.className = c; s.textContent = v; li.appendChild(s); });
    ol.appendChild(li);
  });
  note.textContent = error ? 'No pude leer el ranking online, te muestro el de este navegador' : local ? 'Ranking de este navegador' : 'Mejor puntaje de cada jugador';
}

/* =========================================================
   Intro tipo anime
   ========================================================= */
const intro = { i: 0, t: 0, cap: '', shown: 0, runners: [] };
const SCENES = [
  { d: 4.6, cap: 'En el valle de Martonia, los becerros vivían tranquilos', draw: sceneValley },
  { d: 4.2, cap: 'Marto los cuidaba como a nadie', draw: sceneMarto, card: ['MARTO', 'el pastor del valle', 'left'], enter: () => A.sfx('whoosh') },
  { d: 0.9, cap: '', draw: sceneFlash, enter: () => A.sfx('thunder') },
  { d: 4.4, cap: 'Hasta que una noche llegó Clown y abrió el corral', draw: sceneClown, card: ['CLOWN', 'el bufón del caos', 'right'], enter: () => { A.sfx('laugh'); setTimeout(() => A.sfx('laugh'), 900); } },
  { d: 4.0, cap: 'Los becerros se escaparon y los perros de Clown andan sueltos', draw: sceneChaos, enter: () => { A.sfx('bark'); setTimeout(() => A.sfx('bark'), 1300); } },
  { d: 3.6, cap: 'Marto no se la iba a dejar pasar', draw: sceneVs, enter: () => A.sfx('vs') },
  { d: Infinity, cap: '', draw: sceneMission, mission: true },
];
function startIntro() {
  A.init();
  store.set('bdm_seen', true);
  state = 'intro';
  G = newWorld(true);
  for (let i = 0; i < 7; i++) spawnCalf(false);
  show('#intro');
  $('#mission').hidden = true;
  $('#skip').hidden = false;
  A.play('intro');
  enterScene(0);
}
function enterScene(i) {
  intro.i = i; intro.t = 0; intro.shown = 0;
  const s = SCENES[i];
  intro.cap = s.cap; $('#cap').textContent = '';
  const nc = $('#namecard');
  nc.className = '';
  if (s.card) {
    nc.querySelector('.n').textContent = s.card[0]; nc.querySelector('.s').textContent = s.card[1];
    nc.className = s.card[2];
    setTimeout(() => { if (intro.i === i && state === 'intro') nc.classList.add('on'); }, 350);
  }
  if (s.mission) { $('#mission').hidden = false; $('#skip').hidden = true; setTimeout(() => $('#mGo').focus(), 50); }
  if (i === 4) intro.runners = Array.from({ length: 11 }, (_, k) => ({ type: k % 5 === 0 ? 'dorado' : k % 3 === 0 ? 'marron' : 'pinto', x: -40 - k * 46 - rand(0, 30), y: rand(150, 320), sp: rand(150, 210), dog: false }))
    .concat([0, 1, 2].map(k => ({ type: 'dog', x: -380 - k * 90, y: rand(170, 300), sp: 200, dog: true })));
  if (s.enter) s.enter();
}
function introAdvance() {
  if (SCENES[intro.i].mission) { startGame(); return; }
  enterScene(SCENES.length - 1);
}
function updateIntro(dt) {
  intro.t += dt;
  const s = SCENES[intro.i];
  const n = Math.min(intro.cap.length, Math.floor(intro.t * 34));
  if (n !== intro.shown) { intro.shown = n; $('#cap').textContent = intro.cap.slice(0, n); if (n % 3 === 0) A.sfx('blip'); }
  ctx.save();
  s.draw(intro.t, s.d, dt);
  ctx.restore();
  if (!s.mission) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 26); ctx.fillRect(0, H - 26, W, 26); }
  if (intro.t >= s.d) enterScene(intro.i + 1);
}
function speedLines(cx, cy, c1, c2, t, n = 36) {
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c2;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + t * 0.25, w = 0.05;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - w) * 800, cy + Math.sin(a - w) * 800); ctx.lineTo(cx + Math.cos(a + w) * 800, cy + Math.sin(a + w) * 800); ctx.fill();
  }
}
function hLines(t, col, dir = -1) {
  ctx.fillStyle = col;
  for (let i = 0; i < 14; i++) { const y = (i * 53) % H, len = 60 + (i * 37) % 120, x = ((i * 97 + t * 900 * -dir) % (W + 200)) - 100; ctx.fillRect(dir < 0 ? W - x : x, y, len, 1); }
}
function sceneValley(t, d, dt) {
  updateDemo(dt);
  const s = 1.3 - 0.18 * ease(t / d);
  ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2 + 40 * (1 - t / d), -H / 2 + 10);
  renderWorld();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,140,60,.38)'); g.addColorStop(0.6, 'rgba(255,190,120,.08)'); g.addColorStop(1, 'rgba(60,20,60,.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(0,0,0,${1 - ease(t / 0.8)})`; ctx.fillRect(0, 0, W, H);
}
function sceneMarto(t) {
  speedLines(470, 200, '#2f5fa8', '#3d72c2', t);
  hLines(t, 'rgba(255,255,255,.35)');
  const img = IMG.marto_head_front, x = Math.round(-240 + (W - img.width - 70 + 240) * ease(t / 0.45)), y = H - 26 - img.height;
  ctx.drawImage(img, x, y);
  if (t > 1.1 && t < 1.9) {
    const k = Math.sin((t - 1.1) / 0.8 * Math.PI), sx = Math.round(x + img.width * 0.5), sy = Math.round(y + img.height * 0.62), r = Math.round(10 * k);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx - r, sy, r * 2 + 1, 1); ctx.fillRect(sx, sy - r, 1, r * 2 + 1); ctx.fillRect(sx - 1, sy - 1, 3, 3);
  }
  ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - t * 4)})`; ctx.fillRect(0, 0, W, H);
}
function sceneFlash(t) {
  ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
  if ((t > 0.08 && t < 0.2) || (t > 0.38 && t < 0.46)) {
    ctx.fillStyle = '#eef3ff'; ctx.fillRect(0, 0, W, H);
  } else if (t > 0.2 && t < 0.6) {
    ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 3; ctx.beginPath();
    let x = 380, y = 26; ctx.moveTo(x, y);
    const r = mulberry(5); while (y < H - 26) { x += (r() - 0.5) * 60; y += 20 + r() * 20; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}
function sceneClown(t) {
  speedLines(200, 190, '#3a0d10', '#6b1a1e', -t * 3);
  hLines(t, 'rgba(255,120,100,.3)', 1);
  const img = IMG.clown_head_front;
  const shake = (t < 0.6 || (t > 1.6 && t < 2.4)) ? 3 : 0;
  const x = Math.round(W + 40 - (W + 40 - 80) * ease(t / 0.45) + rand(-shake, shake)), y = Math.round(H - 26 - img.height + rand(-shake, shake));
  ctx.drawImage(img, x, y);
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.1, bx = Math.round(x + img.width / 2 + Math.cos(a) * 120), by = Math.round(y + 40 + Math.sin(a) * 30);
    ctx.fillStyle = '#2b1a0d'; ctx.fillRect(bx - 6, by - 6, 13, 13); ctx.fillStyle = ['#b8322a', '#2f5fa8', '#e6b83c'][i]; ctx.fillRect(bx - 5, by - 5, 11, 11); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(bx - 3, by - 3, 3, 3);
  }
  ctx.font = '400 40px "Jacquard 24", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [[1.0, 330, 90, -0.2], [1.35, 420, 140, 0.15], [1.7, 300, 175, -0.1]].forEach(([at, jx, jy, rot]) => {
    if (t < at) return;
    const k = ease((t - at) / 0.15);
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(rot); ctx.scale(k, k);
    ctx.lineWidth = 6; ctx.strokeStyle = '#2b1a0d'; ctx.strokeText('JA', 0, 0); ctx.fillStyle = '#e6b83c'; ctx.fillText('JA', 0, 0);
    ctx.restore();
  });
  ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - t * 5)})`; ctx.fillRect(0, 0, W, H);
}
function sceneChaos(t, d, dt) {
  const ox = Math.round(rand(-1.5, 1.5));
  ctx.drawImage(BG, ox, 0);
  ctx.drawImage(SPR.barn, BARN.x + ox, BARN.y);
  ctx.fillStyle = 'rgba(12,20,60,.58)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f6eed0'; ctx.beginPath(); ctx.arc(560, 70, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(12,20,60,.9)'; ctx.beginPath(); ctx.arc(568, 64, 16, 0, Math.PI * 2); ctx.fill();
  const rs = intro.runners.slice().sort((a, b) => a.y - b.y);
  for (const r of rs) {
    r.x += r.sp * dt;
    const fr = r.dog ? SPR.dog[(Math.floor(t * 16) % 2) + 2] : SPR['calf_' + r.type][Math.floor(t * 14 + r.y) % 2];
    const w = fr.width * 2, h = fr.height * 2, x = Math.round(r.x), y = Math.round(r.y - h - Math.abs(Math.sin(t * 14 + r.y)) * 3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + w / 2, r.y, w * 0.4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(fr, x, y, w, h);
    if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(230,215,170,.5)'; ctx.fillRect(x - rand(4, 14), r.y - rand(2, 8), 4, 4); }
  }
}
function sceneVs(t) {
  ctx.fillStyle = '#2f5fa8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.moveTo(350, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(290, H); ctx.fill();
  hLines(t, 'rgba(255,255,255,.25)');
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.moveTo(344, 0); ctx.lineTo(356, 0); ctx.lineTo(296, H); ctx.lineTo(284, H); ctx.fill();
  const ml = IMG.marto_head_side, cl = IMG.clown_head_side, k = ease(t / 0.4);
  const mx = Math.round(-ml.width + (40 + ml.width) * k), cx = Math.round(W - (40 + cl.width) * k), y = H - 26 - ml.height;
  ctx.save(); ctx.translate(mx + ml.width, y); ctx.scale(-1, 1); ctx.drawImage(ml, 0, 0); ctx.restore();
  ctx.save(); ctx.translate(cx + cl.width, y); ctx.scale(-1, 1); ctx.drawImage(cl, 0, 0); ctx.restore();
  if (t > 0.45) {
    const s = 1 + Math.max(0, 0.6 - (t - 0.45) * 3), sh = t < 0.8 ? 3 : 0;
    ctx.save(); ctx.translate(320 + rand(-sh, sh), 150 + rand(-sh, sh)); ctx.scale(s, s);
    ctx.font = '400 92px "Jacquard 24", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#2b1a0d'; ctx.strokeText('VS', 0, 0); ctx.fillStyle = '#e6b83c'; ctx.fillText('VS', 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - t * 4)})`; ctx.fillRect(0, 0, W, H);
}
function sceneMission(t, d, dt) {
  updateDemo(dt);
  renderWorld();
}

/* =========================================================
   Botones
   ========================================================= */
function toggleMute() {
  A.init(); A.setMuted(!A.muted);
  $('#mute').textContent = A.muted ? '♪ off' : '♪ on';
}
$('#mute').textContent = A.muted ? '♪ off' : '♪ on';
$('#mute').addEventListener('click', e => { e.stopPropagation(); toggleMute(); e.currentTarget.blur(); });
$('#bPlay').addEventListener('click', () => { A.init(); store.get('bdm_seen', false) ? startGame() : startIntro(); });
$('#bIntro').addEventListener('click', startIntro);
$('#bRank').addEventListener('click', () => { A.init(); show('#rank'); renderBoard('#rBoard', '#rNote'); });
$('#rBack').addEventListener('click', () => show('#title'));
$('#skip').addEventListener('click', introAdvance);
$('#mGo').addEventListener('click', startGame);
$('#bPause').addEventListener('click', e => { togglePause(); e.currentTarget.blur(); });
$('#pResume').addEventListener('click', togglePause);
$('#pQuit').addEventListener('click', goTitle);
$('#oAgain').addEventListener('click', startGame);
$('#oHome').addEventListener('click', goTitle);
$('#oForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (G.saved) return;
  const name = $('#oName').value.trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return;
  G.saved = true;
  store.set('bdm_name', name);
  $('#oSave').disabled = true; $('#oName').disabled = true;
  $('#oMsg').textContent = 'Guardando…';
  const entry = { player_name: name, score: G.score, calves: G.total, level: G.level };
  const res = await LB.submit(entry);
  $('#oMsg').textContent = res.ok ? '¡Listo, quedaste en el ranking!' : res.local ? 'Guardado en este navegador' : 'No pude guardarlo online, quedó en este navegador';
  renderBoard('#oBoard', '#oNote', { name, score: G.score });
});

/* =========================================================
   Loop
   ========================================================= */
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  try {
    switch (state) {
      case 'title': updateDemo(dt); renderWorld(); break;
      case 'intro': updateIntro(dt); break;
      case 'play': updatePlay(dt); renderWorld(); break;
      case 'levelclear': updateLevelClear(dt); renderWorld(); break;
      case 'paused': case 'over': renderWorld(); break;
    }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

Promise.all([loadAssets(), document.fonts ? document.fonts.load('40px "Jacquard 24"').catch(() => {}) : null, document.fonts ? document.fonts.load('700 10px "Pixelify Sans"').catch(() => {}) : null])
  .then(() => {
    buildSprites();
    buildBoard();
    $('#loading').hidden = true;
    goTitle();
    requestAnimationFrame(frame);
  })
  .catch(err => { $('#loading').textContent = 'No pude cargar el juego: ' + err.message; });

window.__bdm = { get G() { return G; }, get state() { return state; }, startGame, startIntro, togglePause };
})();
