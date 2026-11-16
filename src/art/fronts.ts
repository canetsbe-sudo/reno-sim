// Fronts and tops for cabinets and appliances, drawn flat in the face's own pixel space
// (x along the face, y down from its top edge, PX pixels per tile). The renderer maps
// each onto the isometric face, so doors, handles and dials turn with the piece.
import { PX } from './surfaces';

type Ctx = CanvasRenderingContext2D;

const DARK = (a: number) => `rgba(20,12,6,${a})`;
const LIGHT = (a: number) => `rgba(255,255,255,${a})`;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// A panel standing a hair proud of the carcass: dark gap all round, lit top edge.
function panel(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = DARK(0.5);
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = LIGHT(0.22);
  ctx.fillRect(x + 1.4, y + 1.4, w - 2.8, 1.6);
  ctx.fillStyle = DARK(0.14);
  ctx.fillRect(x + 1.4, y + h - 3, w - 2.8, 1.6);
}

// The recessed middle of a shaker door.
function recess(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = DARK(0.07);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = DARK(0.34);
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y, 2.6, h);
  ctx.fillStyle = LIGHT(0.34);
  ctx.fillRect(x, y + h - 2.2, w, 2.2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function metalGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, metal: string) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, metal);
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  return g;
}

function knob(ctx: Ctx, x: number, y: number, metal: string, r = 5) {
  ctx.fillStyle = DARK(0.4);
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y + 3.5, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metalGrad(ctx, x - r, y - r, x + r, y + r * 1.6, metal);
  ctx.globalAlpha *= 0.55;
  ctx.fill();
  ctx.globalAlpha /= 0.55;
  ctx.fillStyle = LIGHT(0.8);
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// A bar pull between two points (either upright or level).
function bar(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, metal: string, t = 5) {
  const up = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = DARK(0.4);
  ctx.lineWidth = t;
  ctx.beginPath();
  ctx.moveTo(x0 + 2, y0 + 3.5);
  ctx.lineTo(x1 + 2, y1 + 3.5);
  ctx.stroke();
  ctx.strokeStyle = metal;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = LIGHT(0.65);
  ctx.lineWidth = t * 0.3;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x0 - t * 0.2, y0);
    ctx.lineTo(x1 - t * 0.2, y1);
  } else {
    ctx.moveTo(x0, y0 - t * 0.2);
    ctx.lineTo(x1, y1 - t * 0.2);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// ---- Cabinets ----

export interface CabLook {
  door: 'shaker' | 'flat';
  pull: 'knob' | 'bar';
  metal: string;
  wood: boolean;
}

export function cabLook(id: string): CabLook {
  switch (id) {
    case 'cab-shaker-white':
      return { door: 'shaker', pull: 'knob', metal: '#2b2b2e', wood: false };
    case 'cab-shaker-green':
      return { door: 'shaker', pull: 'knob', metal: '#c9a45a', wood: false };
    case 'cab-navy':
      return { door: 'flat', pull: 'bar', metal: '#c9a45a', wood: false };
    case 'cab-teak':
      return { door: 'flat', pull: 'bar', metal: '#2b2b2e', wood: true };
    case 'cab-oak':
      return { door: 'shaker', pull: 'bar', metal: '#2b2b2e', wood: true };
    default:
      return { door: 'flat', pull: 'knob', metal: '#a9a290', wood: false };
  }
}

function door(ctx: Ctx, look: CabLook, x: number, y: number, w: number, h: number, hinge: 'left' | 'right', pullAt: 'top' | 'bottom') {
  panel(ctx, x, y, w, h);
  const rail = Math.min(11, w * 0.24);
  if (look.door === 'shaker') recess(ctx, x + rail, y + rail, w - rail * 2, h - rail * 2);
  const px = hinge === 'left' ? x + w - rail * 0.5 - 1 : x + rail * 0.5 + 1;
  const py = pullAt === 'top' ? y + rail + 12 : y + h - rail - 12;
  if (look.pull === 'knob') knob(ctx, px, py, look.metal);
  else bar(ctx, px, py - 9, px, py + 11, look.metal);
}

function drawer(ctx: Ctx, look: CabLook, x: number, y: number, w: number, h: number) {
  panel(ctx, x, y, w, h);
  if (look.door === 'shaker' && h > 30) recess(ctx, x + 9, y + 7, w - 18, h - 14);
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (look.pull === 'knob') knob(ctx, cx, cy, look.metal);
  else bar(ctx, cx - 13, cy, cx + 13, cy, look.metal);
}

// A run of base cabinets: one drawer over one door for every tile of width.
export function baseFront(ctx: Ctx, W: number, H: number, look: CabLook, units: number) {
  const U = W / units;
  const g = 3.5;
  const split = Math.round(H * 0.26);
  for (let i = 0; i < units; i++) {
    const x = i * U + g;
    drawer(ctx, look, x, g + 1, U - g * 2, split - g - 1);
    door(ctx, look, x, split + g, U - g * 2, H - split - g * 2, i % 2 ? 'right' : 'left', 'top');
  }
}

// Tall pantry: a pair of long doors with a pair of short ones above.
export function pantryFront(ctx: Ctx, W: number, H: number, look: CabLook) {
  const g = 3.5;
  const split = Math.round(H * 0.3);
  const half = W / 2;
  for (const i of [0, 1]) {
    const x = i * half + g * (i ? 0.5 : 1);
    const w = half - g * 1.5;
    door(ctx, look, x, g + 1, w, split - g - 1, i ? 'right' : 'left', 'bottom');
    door(ctx, look, x, split + g, w, H - split - g * 2, i ? 'right' : 'left', 'top');
  }
}

// Plain side of a cabinet: just the faintest end-panel edge.
export function cabinetSide(ctx: Ctx, W: number, H: number) {
  ctx.strokeStyle = DARK(0.16);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(2, 2, W - 4, H - 4);
}

// ---- Appliances ----

// Doors curve away at the edges, so they darken there.
function curve(ctx: Ctx, x: number, y: number, w: number, h: number, a = 0.22) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, DARK(a));
  g.addColorStop(0.14, DARK(0));
  g.addColorStop(0.86, DARK(0));
  g.addColorStop(1, DARK(a));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function seam(ctx: Ctx, x0: number, y: number, x1: number) {
  ctx.fillStyle = DARK(0.6);
  ctx.fillRect(x0, y - 1.6, x1 - x0, 3.2);
  ctx.fillStyle = LIGHT(0.4);
  ctx.fillRect(x0, y + 1.6, x1 - x0, 1.4);
}

function glass(ctx: Ctx, x: number, y: number, w: number, h: number, tint = '#15181c') {
  rr(ctx, x, y, w, h, 3);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint);
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // A streak of reflected window.
  ctx.fillStyle = LIGHT(0.16);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, y);
  ctx.lineTo(x + w * 0.36, y);
  ctx.lineTo(x + w * 0.16, y + h);
  ctx.lineTo(x - w * 0.08, y + h);
  ctx.fill();
  ctx.fillStyle = LIGHT(0.08);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.44, y);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.lineTo(x + w * 0.24, y + h);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = DARK(0.7);
  ctx.lineWidth = 1.6;
  rr(ctx, x, y, w, h, 3);
  ctx.stroke();
}

function dial(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = DARK(0.45);
  ctx.beginPath();
  ctx.arc(x + 1, y + 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LIGHT(0.5);
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LIGHT(0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - r);
  ctx.stroke();
}

const STEEL = '#aeb4ba';

function fridgeFront(ctx: Ctx, W: number, H: number, retro: boolean) {
  const split = H * (retro ? 0.3 : 0.34);
  curve(ctx, 0, 0, W, H, retro ? 0.3 : 0.2);
  seam(ctx, 0, split, W);
  ctx.strokeStyle = DARK(0.4);
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  if (retro) {
    // Rounded enamel shoulders, a chrome band and a big pull-latch.
    const g = ctx.createLinearGradient(0, 0, 0, 26);
    g.addColorStop(0, LIGHT(0.4));
    g.addColorStop(1, LIGHT(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = metalGrad(ctx, 0, split - 6, 0, split + 4, '#d8dde2');
    ctx.fillRect(3, split - 6, W - 6, 5);
    bar(ctx, 17, split - 34, 17, split - 12, '#e2e6ea', 6.5);
    bar(ctx, 17, split + 14, 17, split + 52, '#e2e6ea', 6.5);
    rr(ctx, W - 40, 12, 28, 10, 5);
    ctx.fillStyle = '#e6eaee';
    ctx.fill();
    ctx.strokeStyle = DARK(0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    // A long highlight down the enamel.
    const s = ctx.createLinearGradient(W * 0.55, 0, W * 0.8, 0);
    s.addColorStop(0, LIGHT(0));
    s.addColorStop(0.5, LIGHT(0.3));
    s.addColorStop(1, LIGHT(0));
    ctx.fillStyle = s;
    ctx.fillRect(W * 0.55, 8, W * 0.25, H - 16);
  } else {
    bar(ctx, 15, split - 46, 15, split - 10, STEEL, 5.5);
    bar(ctx, 15, split + 12, 15, split + 84, STEEL, 5.5);
    ctx.fillStyle = DARK(0.5);
    ctx.fillRect(W - 30, 10, 18, 4);
  }
  // Feet and the shadow gap at the floor.
  ctx.fillStyle = DARK(0.75);
  ctx.fillRect(0, H - 5, W, 5);
}

function stoveFront(ctx: Ctx, W: number, H: number, pro: boolean) {
  // Control panel.
  ctx.fillStyle = pro ? '#2a2c30' : DARK(0.22);
  ctx.fillRect(0, 0, W, 17);
  seam(ctx, 0, 17, W);
  const n = pro ? 7 : 5;
  for (let i = 0; i < n; i++) dial(ctx, ((i + 0.5) / n) * W, 8.5, 5.2, pro ? '#b3312a' : '#26282c');
  const ovens = pro ? 2 : 1;
  const ow = W / ovens;
  for (let i = 0; i < ovens; i++) {
    const x = i * ow;
    panel(ctx, x + 3, 21, ow - 6, H - 21 - 15);
    glass(ctx, x + 14, 37, ow - 28, H - 37 - 26);
    bar(ctx, x + 12, 28.5, x + ow - 12, 28.5, pro ? '#d5d9dd' : STEEL, 5);
  }
  // Warming drawer and the gap at the floor.
  seam(ctx, 0, H - 14, W);
  ctx.fillStyle = DARK(0.75);
  ctx.fillRect(0, H - 4, W, 4);
}

function dishwasherFront(ctx: Ctx, W: number, H: number) {
  curve(ctx, 0, 0, W, H, 0.12);
  ctx.fillStyle = '#23262a';
  ctx.fillRect(3, 3, W - 6, 11);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === 1 ? '#7fe0a0' : '#566';
    ctx.fillRect(W - 14 - i * 8, 7, 4, 3);
  }
  panel(ctx, 3, 3, W - 6, H - 14);
  bar(ctx, 14, 23, W - 14, 23, STEEL, 5);
  ctx.fillStyle = DARK(0.8);
  ctx.fillRect(0, H - 9, W, 9);
}

function wineFront(ctx: Ctx, W: number, H: number) {
  panel(ctx, 3, 3, W - 6, H - 12);
  const x = 11;
  const y = 10;
  const w = W - 22 - 9;
  const h = H - 28;
  glass(ctx, x, y, w, h, '#2a1a22');
  // Racks of bottles seen end-on, lit softly from above.
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const ry = y + ((r + 0.9) / rows) * h - 4;
    ctx.fillStyle = 'rgba(190,150,110,0.55)';
    ctx.fillRect(x + 2, ry + 5, w - 4, 1.6);
    for (let i = 0; i < 4; i++) {
      const bx = x + ((i + 0.5) / 4) * w;
      ctx.fillStyle = (r + i) % 3 === 0 ? '#3c5a3a' : '#5c1f2c';
      ctx.beginPath();
      ctx.arc(bx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (r + i) % 2 ? '#c9a45a' : '#8a1f2a';
      ctx.beginPath();
      ctx.arc(bx, ry, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,214,150,0.2)');
  g.addColorStop(0.5, 'rgba(255,214,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  bar(ctx, W - 12, 16, W - 12, H - 26, STEEL, 4.5);
  ctx.fillStyle = DARK(0.8);
  ctx.fillRect(0, H - 8, W, 8);
}

function mug(ctx: Ctx, x: number, y: number, color: string, hang = false) {
  ctx.fillStyle = color;
  rr(ctx, x - 5, y - 11, 10, 11, 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 6, y - 6, 3.2, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = LIGHT(0.3);
  ctx.fillRect(x - 4, y - 10, 2, 9);
  if (hang) {
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y - 15);
    ctx.stroke();
  }
}

function coffeeFront(ctx: Ctx, W: number, H: number, look: CabLook) {
  const ctrY = H - 0.9 * PX; // the working top
  // The open niche: a darker back wall, lit from a strip under the top shelf.
  const nx = 7;
  const ny = 7;
  const nw = W - 14;
  const nh = ctrY - ny;
  ctx.fillStyle = '#3b2a1e';
  ctx.fillRect(nx, ny, nw, nh);
  const g = ctx.createLinearGradient(0, ny + 46, 0, ctrY);
  g.addColorStop(0, 'rgba(255,214,150,0.5)');
  g.addColorStop(1, 'rgba(255,214,150,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(nx, ny + 46, nw, nh - 46);
  // Inner shadows of the recess.
  ctx.fillStyle = DARK(0.5);
  ctx.fillRect(nx, ny, nw, 4);
  ctx.fillRect(nx, ny, 4, nh);
  // Shelf with jars and stacked cups.
  const sy = ny + 42;
  ctx.fillStyle = '#8a5f3e';
  ctx.fillRect(nx, sy, nw, 5);
  ctx.fillStyle = LIGHT(0.3);
  ctx.fillRect(nx, sy, nw, 1.2);
  const cols = ['#e8e0d0', '#c2683f', '#8fa58a', '#e8e0d0', '#3f5d68', '#d9a441'];
  for (let i = 0; i < 6; i++) mug(ctx, nx + 18 + i * 20, sy, cols[i]);
  for (const [jx, jc] of [[nw - 34, '#6b4a33'], [nw - 16, '#d8c7a0']] as const) {
    rr(ctx, nx + jx - 6, sy - 22, 12, 22, 2);
    ctx.fillStyle = 'rgba(220,235,235,0.5)';
    ctx.fill();
    ctx.fillStyle = jc;
    ctx.fillRect(nx + jx - 5, sy - 15, 10, 14);
    ctx.fillStyle = '#b08a4f';
    ctx.fillRect(nx + jx - 6, sy - 24, 12, 3);
  }
  // Mugs on hooks under the shelf.
  for (let i = 0; i < 4; i++) mug(ctx, nx + nw - 26 - i * 17, sy + 21, cols[(i + 2) % 6], true);
  // The espresso machine.
  const mx = nx + 16;
  const mw = 62;
  const mh = 44;
  const my = ctrY - mh;
  rr(ctx, mx, my, mw, mh, 3);
  ctx.fillStyle = metalGrad(ctx, mx, my, mx + mw, my + mh * 2.4, '#c5cacf');
  ctx.fill();
  // Drip bay with one group head and a cup under it.
  ctx.fillStyle = '#1b1c1f';
  ctx.fillRect(mx + 5, my + 16, mw - 10, mh - 20);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(mx + mw / 2 - 9, my + 16, 18, 5);
  ctx.fillStyle = '#2a2a2c';
  ctx.fillRect(mx + mw / 2 - 14, my + 21, 22, 3);
  dial(ctx, mx + 11, my + 8, 3.6, '#26282c');
  dial(ctx, mx + mw - 11, my + 8, 3.6, '#26282c');
  ctx.fillStyle = '#ff8a4a';
  ctx.fillRect(mx + mw / 2 - 2, my + 6, 4, 3);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(mx + mw / 2 - 5, my + mh - 12, 10, 8);
  // Steam wand.
  ctx.strokeStyle = '#c5cacf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx + mw - 10, my + 16);
  ctx.lineTo(mx + mw - 13, my + mh - 8);
  ctx.stroke();
  // Grinder beside it.
  ctx.fillStyle = '#2a2a2c';
  ctx.fillRect(mx + mw + 10, ctrY - 30, 16, 30);
  ctx.fillStyle = 'rgba(190,150,110,0.8)';
  ctx.beginPath();
  ctx.moveTo(mx + mw + 8, ctrY - 46);
  ctx.lineTo(mx + mw + 28, ctrY - 46);
  ctx.lineTo(mx + mw + 24, ctrY - 30);
  ctx.lineTo(mx + mw + 12, ctrY - 30);
  ctx.fill();
  // The top itself, catching the light.
  ctx.fillStyle = '#d9c7a8';
  ctx.fillRect(0, ctrY, W, 6);
  ctx.fillStyle = LIGHT(0.5);
  ctx.fillRect(0, ctrY, W, 1.5);
  ctx.fillStyle = DARK(0.4);
  ctx.fillRect(0, ctrY + 6, W, 2.5);
  // Doors below.
  ctx.save();
  ctx.translate(0, ctrY + 8);
  const bh = H - ctrY - 8 - 7;
  for (let i = 0; i < 4; i++) door(ctx, look, i * (W / 4) + 3, 2, W / 4 - 6, bh - 2, i % 2 ? 'right' : 'left', 'top');
  ctx.restore();
  ctx.fillStyle = DARK(0.7);
  ctx.fillRect(0, H - 7, W, 7);
}

// Paint the front of an appliance. Returns false if this piece has no special front.
export function applianceFront(ctx: Ctx, id: string, W: number, H: number): boolean {
  switch (id) {
    case 'fridge':
      fridgeFront(ctx, W, H, false);
      return true;
    case 'fridge-retro':
      fridgeFront(ctx, W, H, true);
      return true;
    case 'stove':
      stoveFront(ctx, W, H, false);
      return true;
    case 'stove-pro':
      stoveFront(ctx, W, H, true);
      return true;
    case 'dishwasher':
      dishwasherFront(ctx, W, H);
      return true;
    case 'wine-fridge':
      wineFront(ctx, W, H);
      return true;
    case 'coffee-bar':
      coffeeFront(ctx, W, H, { door: 'flat', pull: 'bar', metal: '#c9a45a', wood: true });
      return true;
  }
  return false;
}

// Plain side or back of an appliance.
export function applianceSide(ctx: Ctx, W: number, H: number) {
  curve(ctx, 0, 0, W, H, 0.1);
  ctx.fillStyle = DARK(0.7);
  ctx.fillRect(0, H - 4, W, 4);
}

// ---- Tops (x across the piece, y from its back to its front) ----

// Cooktop: black enamel, cast-iron grates and brass-capped burners.
export function cooktop(ctx: Ctx, W: number, D: number) {
  rr(ctx, 5, 5, W - 10, D - 10, 4);
  ctx.fillStyle = '#17181b';
  ctx.fill();
  const cols = Math.round(W / PX) * 2 + (W > PX * 1.5 ? -1 : 0);
  const sheen = ctx.createLinearGradient(0, 0, W, D);
  sheen.addColorStop(0, LIGHT(0.16));
  sheen.addColorStop(0.5, LIGHT(0));
  ctx.fillStyle = sheen;
  ctx.fill();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const cx = ((i + 0.5) / cols) * (W - 16) + 8;
      const cy = ((j + 0.5) / 2) * (D - 16) + 8;
      const r = Math.min((W - 16) / cols, (D - 16) / 2) * 0.36;
      ctx.strokeStyle = '#4a4c52';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#b08a4f';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#26272b';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Grate fingers.
      ctx.strokeStyle = '#6a6d74';
      ctx.lineWidth = 3;
      for (const a of [0, 1, 2, 3]) {
        const dx = Math.cos((a * Math.PI) / 2 + Math.PI / 4);
        const dy = Math.sin((a * Math.PI) / 2 + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(cx + dx * r * 0.36, cy + dy * r * 0.36);
        ctx.lineTo(cx + dx * r * 1.25, cy + dy * r * 1.25);
        ctx.stroke();
      }
    }
  }
}

// An undermount steel sink: the bowl falls away into shadow toward the back.
export function sinkBowl(ctx: Ctx, W: number, D: number) {
  const x = W * 0.17;
  const y = D * 0.26;
  const w = W * 0.66;
  const h = D * 0.52;
  rr(ctx, x - 3, y - 3, w + 6, h + 6, 9);
  ctx.fillStyle = '#d3d8dc';
  ctx.fill();
  rr(ctx, x, y, w, h, 7);
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, '#565d63');
  g.addColorStop(0.45, '#8b949b');
  g.addColorStop(1, '#b7bfc5');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Near wall of the bowl is hidden by the rim; the far walls show as a darker band.
  ctx.fillStyle = DARK(0.35);
  ctx.fillRect(x, y, w, h * 0.3);
  ctx.fillRect(x, y, w * 0.14, h);
  ctx.restore();
  ctx.fillStyle = '#3c4146';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9ced3';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}
