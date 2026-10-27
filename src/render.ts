// Isometric canvas renderer for one cutaway room.
import { ROOM_D, ROOM_W, finishById, itemById, issueById, type Finish } from './data';
import { footprint, type Design, type GameState, type Placed } from './state';

export const TW = 72; // tile width on screen
export const TH = 36; // tile height on screen
export const ZS = 40; // pixels per world unit of height
export const WALL_H = 3;
const MARGIN = 24;

export const CANVAS_W = (ROOM_W + ROOM_D) * (TW / 2) + MARGIN * 2;
export const CANVAS_H = (ROOM_W + ROOM_D) * (TH / 2) + WALL_H * ZS + MARGIN * 2 + 12;
const OX = ROOM_D * (TW / 2) + MARGIN;
const OY = WALL_H * ZS + MARGIN + 6;

type Pt = [number, number];

export const iso = (x: number, y: number, z = 0): Pt => [OX + (x - y) * (TW / 2), OY + (x + y) * (TH / 2) - z * ZS];

// Screen point to floor tile.
export function pickTile(sx: number, sy: number): { x: number; y: number } | undefined {
  const a = (sx - OX) / (TW / 2);
  const b = (sy - OY) / (TH / 2);
  const x = Math.floor((a + b) / 2);
  const y = Math.floor((b - a) / 2);
  if (x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_D) return undefined;
  return { x, y };
}

// Screen point to a window slot on one of the two walls.
export function pickWall(sx: number, sy: number): { wall: 'back' | 'left'; slot: number } | undefined {
  const bx = (sx - OX) / (TW / 2);
  const bz = (bx * (TH / 2) - (sy - OY)) / ZS;
  if (bx > 0 && bx < ROOM_W && bz > 0 && bz < WALL_H) return { wall: 'back', slot: Math.floor(bx) };
  const ly = -(sx - OX) / (TW / 2);
  const lz = (ly * (TH / 2) - (sy - OY)) / ZS;
  if (ly > 0 && ly < ROOM_D && lz > 0 && lz < WALL_H) return { wall: 'left', slot: Math.floor(ly) };
  return undefined;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawFloor(ctx: CanvasRenderingContext2D, f: Finish) {
  for (let x = 0; x < ROOM_W; x++) {
    for (let y = 0; y < ROOM_D; y++) {
      let c = f.color;
      if (f.pattern === 'checker' && (x + y) % 2) c = f.accent ?? c;
      else if (f.pattern === 'tile' && (x * 7 + y * 3) % 5 === 0) c = shade(f.color, -0.05);
      poly(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], c, f.pattern === 'planks' ? undefined : shade(f.color, -0.12), 0.8);
      if (f.pattern === 'planks') {
        for (let k = 1; k < 3; k++) line(ctx, iso(x, y + k / 3), iso(x + 1, y + k / 3), f.accent ?? shade(c, -0.15), 0.7);
        const off = (y % 2) * 0.5;
        line(ctx, iso(x + off, y), iso(x + off, y + 1 / 3), f.accent ?? c, 0.6);
      }
      if (f.pattern === 'speckle') {
        ctx.fillStyle = f.accent ?? shade(c, -0.2);
        for (let k = 0; k < 4; k++) {
          const [px, py] = iso(x + ((k * 37 + x * 13) % 10) / 10, y + ((k * 53 + y * 7) % 10) / 10);
          ctx.fillRect(px, py, 2, 1.5);
        }
      }
    }
  }
}

function wallPt(wall: 'back' | 'left', u: number, z: number): Pt {
  return wall === 'back' ? iso(u, 0, z) : iso(0, u, z);
}

function drawWall(ctx: CanvasRenderingContext2D, wall: 'back' | 'left', f: Finish) {
  const len = wall === 'back' ? ROOM_W : ROOM_D;
  const base = wall === 'back' ? shade(f.color, -0.04) : shade(f.color, -0.14);
  poly(ctx, [wallPt(wall, 0, 0), wallPt(wall, len, 0), wallPt(wall, len, WALL_H), wallPt(wall, 0, WALL_H)], base);
  const accent = f.accent ?? shade(f.color, -0.2);
  if (f.pattern === 'stripes') {
    for (let u = 0.25; u < len; u += 0.5) line(ctx, wallPt(wall, u, 0), wallPt(wall, u, WALL_H), accent, 3);
  } else if (f.pattern === 'planks') {
    for (let z = 0.3; z < WALL_H; z += 0.3) line(ctx, wallPt(wall, 0, z), wallPt(wall, len, z), accent, 1);
  } else if (f.pattern === 'floral') {
    ctx.fillStyle = accent;
    for (let u = 0.3; u < len; u += 0.6) {
      for (let z = 0.3; z < WALL_H; z += 0.5) {
        const [px, py] = wallPt(wall, u + ((z * 10) % 2) * 0.15, z);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Baseboard and top edge.
  poly(ctx, [wallPt(wall, 0, 0), wallPt(wall, len, 0), wallPt(wall, len, 0.12), wallPt(wall, 0, 0.12)], shade(f.color, -0.3));
  line(ctx, wallPt(wall, 0, WALL_H), wallPt(wall, len, WALL_H), shade(f.color, -0.35), 2);
}

function drawWindow(ctx: CanvasRenderingContext2D, wall: 'back' | 'left', slot: number, f: Finish, light: string) {
  const big = f.id === 'win-picture';
  const door = f.id === 'win-french';
  const u0 = slot + (big ? 0.06 : 0.18);
  const u1 = slot + (big ? 0.94 : 0.82);
  const z0 = door ? 0.12 : big ? 0.8 : 1.15;
  const z1 = door ? 2.35 : 2.45;
  const frame = f.color;
  poly(ctx, [wallPt(wall, u0 - 0.05, z0 - 0.08), wallPt(wall, u1 + 0.05, z0 - 0.08), wallPt(wall, u1 + 0.05, z1 + 0.08), wallPt(wall, u0 - 0.05, z1 + 0.08)], frame);
  const glass = f.old ? '#b9c8cf' : '#bfe0f2';
  poly(ctx, [wallPt(wall, u0, z0), wallPt(wall, u1, z0), wallPt(wall, u1, z1), wallPt(wall, u0, z1)], glass);
  // Sky glint, tinted by the room's light.
  poly(ctx, [wallPt(wall, u0 + 0.08, z1 - 0.1), wallPt(wall, u0 + 0.3, z1 - 0.1), wallPt(wall, u0 + 0.12, z0 + 0.2), wallPt(wall, u0 + 0.06, z0 + 0.2)], shade(light, 0.6));
  const um = (u0 + u1) / 2;
  const zm = (z0 + z1) / 2;
  line(ctx, wallPt(wall, um, z0), wallPt(wall, um, z1), frame, 2);
  if (!door) line(ctx, wallPt(wall, u0, zm), wallPt(wall, u1, zm), frame, 2);
  if (f.id === 'win-shutter') {
    for (const [a, b] of [[u0 - 0.28, u0 - 0.06], [u1 + 0.06, u1 + 0.28]]) {
      poly(ctx, [wallPt(wall, a, z0), wallPt(wall, b, z0), wallPt(wall, b, z1), wallPt(wall, a, z1)], frame, shade(frame, -0.3));
    }
  }
  if (!door) poly(ctx, [wallPt(wall, u0 - 0.08, z0 - 0.08), wallPt(wall, u1 + 0.08, z0 - 0.08), wallPt(wall, u1 + 0.08, z0 - 0.16), wallPt(wall, u0 - 0.08, z0 - 0.16)], shade(frame, -0.15));
}

interface BoxColors {
  top: string;
  left: string; // face toward +y
  right: string; // face toward +x
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, c: BoxColors) {
  const z1 = z + h;
  poly(ctx, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x, y + d, z1)], c.left, 'rgba(0,0,0,0.12)');
  poly(ctx, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x + w, y, z1)], c.right, 'rgba(0,0,0,0.12)');
  poly(ctx, [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + d, z1), iso(x, y + d, z1)], c.top, 'rgba(0,0,0,0.12)');
}

const tones = (base: string, top?: string): BoxColors => ({ top: top ?? shade(base, 0.15), left: base, right: shade(base, -0.18) });

// Map (u along the face, v up the face) to screen for the item's front face.
function frontPt(x: number, y: number, w: number, d: number, h: number, frontX: boolean, u: number, v: number): Pt {
  return frontX ? iso(x + w, y + u * d, v * h) : iso(x + u * w, y + d, v * h);
}

function inset(ctx: CanvasRenderingContext2D, fp: (u: number, v: number) => Pt, u0: number, u1: number, v0: number, v1: number, fill?: string, stroke?: string) {
  poly(ctx, [fp(u0, v0), fp(u1, v0), fp(u1, v1), fp(u0, v1)], fill, stroke, 1);
}

export interface ItemOpts {
  ghost?: boolean;
  valid?: boolean;
  selected?: boolean;
}

export function drawItem(ctx: CanvasRenderingContext2D, p: Placed, d: Design, opts: ItemOpts = {}) {
  const def = itemById(p.id);
  const { w, d: dep } = footprint(p);
  const { x, y } = p;
  const h = def.h;
  const frontX = p.rot % 2 === 1;
  const fp = (u: number, v: number) => frontPt(x, y, w, dep, h, frontX, u, v);
  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.6;

  const cab = finishById(d.cabinet);
  const ctr = finishById(d.counter);
  const sideBase = def.usesCabinet ? cab.color : def.side;

  if (def.kind === 'plant') {
    const potH = def.id === 'herbs' ? 0.35 : 0.45;
    const m = 0.22;
    box(ctx, x + m, y + m, 0, w - 2 * m, dep - 2 * m, potH, tones(def.side));
    const [cx, cy] = iso(x + 0.5, y + 0.5, potH + (h - potH) / 2);
    const r = def.id === 'herbs' ? 14 : 22;
    ctx.fillStyle = shade(def.top, -0.1);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.top;
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 4, r * 0.7, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.kind === 'lamp') {
    const [bx, by] = iso(x + 0.5, y + 0.5, 0);
    const [tx, ty] = iso(x + 0.5, y + 0.5, h - 0.35);
    ctx.fillStyle = def.side;
    ctx.beginPath();
    ctx.ellipse(bx, by, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, [bx, by], [tx, ty], def.side, 3);
    const m = 0.25;
    box(ctx, x + m, y + m, h - 0.45, w - 2 * m, dep - 2 * m, 0.45, tones(def.top, '#fff6dc'));
    const g = ctx.createRadialGradient(tx, ty, 2, tx, ty, 70);
    g.addColorStop(0, 'rgba(255,220,150,0.35)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(tx - 70, ty - 70, 140, 140);
  } else if (def.id === 'chair' || def.id === 'stool') {
    const m = 0.2;
    box(ctx, x + m, y + m, def.id === 'stool' ? 0.1 : 0.05, w - 2 * m, dep - 2 * m, h - 0.1, tones(def.side, def.top));
    if (def.id === 'chair') {
      // The back sits opposite the way the chair faces.
      const t = 0.1;
      if (p.rot === 0) box(ctx, x + m, y + m, h, w - 2 * m, t, 0.5, tones(def.side));
      else if (p.rot === 1) box(ctx, x + m, y + m, h, t, dep - 2 * m, 0.5, tones(def.side));
      else if (p.rot === 2) box(ctx, x + m, y + dep - m - t, h, w - 2 * m, t, 0.5, tones(def.side));
      else box(ctx, x + w - m - t, y + m, h, t, dep - 2 * m, 0.5, tones(def.side));
    }
  } else if (def.kind === 'table') {
    const legH = h - 0.08;
    const m = 0.12;
    for (const [lx, ly] of [[x + m, y + m], [x + w - m - 0.08, y + m], [x + m, y + dep - m - 0.08], [x + w - m - 0.08, y + dep - m - 0.08]]) {
      box(ctx, lx, ly, 0, 0.08, 0.08, legH, tones(def.side));
    }
    box(ctx, x + 0.05, y + 0.05, legH, w - 0.1, dep - 0.1, 0.08, tones(def.side, def.top));
  } else if (def.id === 'rug') {
    poly(ctx, [iso(x + 0.1, y + 0.1, 0.01), iso(x + w - 0.1, y + 0.1, 0.01), iso(x + w - 0.1, y + dep - 0.1, 0.01), iso(x + 0.1, y + dep - 0.1, 0.01)], def.top, shade(def.top, -0.25), 2);
    poly(ctx, [iso(x + 0.35, y + 0.35, 0.01), iso(x + w - 0.35, y + 0.35, 0.01), iso(x + w - 0.35, y + dep - 0.35, 0.01), iso(x + 0.35, y + dep - 0.35, 0.01)], undefined, '#f1e3cf', 2);
  } else {
    const counterTop = def.usesCounter ? ctr.color : def.top;
    const bodyH = def.usesCounter ? h - 0.08 : h;
    const toeKick = def.usesCabinet ? 0.08 : 0;
    if (toeKick) box(ctx, x + 0.04, y + 0.04, 0, w - 0.08, dep - 0.08, toeKick, tones(shade(sideBase, -0.4)));
    box(ctx, x, y, toeKick, w, dep, bodyH - toeKick, tones(sideBase, def.usesCounter ? shade(sideBase, 0.1) : def.top));
    if (def.usesCounter) box(ctx, x - 0.03, y - 0.03, bodyH, w + 0.06, dep + 0.06, 0.08, tones(shade(counterTop, -0.05), counterTop));

    const door = shade(sideBase, -0.12);
    if (def.usesCabinet && def.id !== 'tall-pantry') {
      const n = Math.max(1, Math.round(frontX ? dep : w));
      for (let i = 0; i < n; i++) {
        const a = i / n + 0.06 / n;
        const b = (i + 1) / n - 0.06 / n;
        inset(ctx, fp, a, b, 0.2, 0.72, undefined, door);
        line(ctx, fp(a + (b - a) * 0.15, 0.82), fp(b - (b - a) * 0.15, 0.82), door, 2);
      }
    } else if (def.id === 'tall-pantry') {
      inset(ctx, fp, 0.08, 0.92, 0.06, 0.62, undefined, door);
      inset(ctx, fp, 0.08, 0.92, 0.66, 0.96, undefined, door);
    } else if (def.essential === 'fridge') {
      inset(ctx, fp, 0.06, 0.94, 0.04, 0.6, undefined, shade(def.side, -0.15));
      inset(ctx, fp, 0.06, 0.94, 0.63, 0.97, undefined, shade(def.side, -0.15));
      line(ctx, fp(0.82, 0.68), fp(0.82, 0.88), '#777', 2.5);
      line(ctx, fp(0.82, 0.35), fp(0.82, 0.55), '#777', 2.5);
    } else if (def.essential === 'stove') {
      inset(ctx, fp, 0.1, 0.9, 0.12, 0.65, '#30343a', '#555');
      for (let i = 0; i < (w > 1 || dep > 1 ? 6 : 4); i++) {
        const k = w > 1 || dep > 1 ? 3 : 2;
        const cu = ((i % k) + 0.5) / k;
        const cv = (Math.floor(i / k) + 0.5) / 2;
        const [cx, cy] = frontX ? iso(x + cv * w, y + cu * dep, h) : iso(x + cu * w, y + cv * dep, h);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (def.id === 'dishwasher' || def.id === 'wine-fridge') {
      inset(ctx, fp, 0.08, 0.92, 0.12, 0.85, def.id === 'wine-fridge' ? '#5a3a4a' : undefined, '#888');
    } else if (def.id === 'coffee-bar') {
      for (const v of [0.45, 0.7, 0.92]) line(ctx, fp(0.04, v), fp(0.96, v), shade(def.side, 0.3), 3);
      inset(ctx, fp, 0.15, 0.45, 0.47, 0.66, '#c0c4c8', '#888');
    } else if (def.id === 'fireplace') {
      inset(ctx, fp, 0.2, 0.8, 0.15, 0.55, '#1d1d1f');
      const [fx, fy] = fp(0.5, 0.28);
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.id === 'bench') {
      inset(ctx, fp, 0.05, 0.95, 0.15, 0.85, undefined, shade(def.side, -0.2));
    }
    if (def.essential === 'sink') {
      const [a, b, c2, e] = frontX
        ? [iso(x + 0.25, y + 0.2, h + 0.001), iso(x + 0.25, y + 0.8, h + 0.001), iso(x + 0.75, y + 0.8, h + 0.001), iso(x + 0.75, y + 0.2, h + 0.001)]
        : [iso(x + 0.2, y + 0.25, h + 0.001), iso(x + 0.8, y + 0.25, h + 0.001), iso(x + 0.8, y + 0.75, h + 0.001), iso(x + 0.2, y + 0.75, h + 0.001)];
      poly(ctx, [a, b, c2, e], '#9aa4ab', '#7d868c');
      const [tx, ty] = iso(x + (frontX ? 0.15 : 0.5), y + (frontX ? 0.5 : 0.15), h);
      line(ctx, [tx, ty], [tx, ty - 14], '#9aa0a6', 3);
    }
  }

  if (opts.ghost || opts.selected) {
    const col = opts.ghost ? (opts.valid ? 'rgba(80,170,110,0.9)' : 'rgba(210,80,70,0.9)') : 'rgba(255,190,70,0.95)';
    poly(ctx, [iso(x, y), iso(x + w, y), iso(x + w, y + dep), iso(x, y + dep)], opts.ghost ? col.replace('0.9', '0.25') : undefined, col, 2.5);
  }
  ctx.restore();
}

export interface SceneOpts {
  ghost?: { p: Placed; valid: boolean };
  selectedUid?: number;
  hoverWall?: { wall: 'back' | 'left'; slot: number };
  hoverTile?: { x: number; y: number };
  // Junk that is being hauled away fades out.
  fading?: Map<number, number>;
}

const depth = (p: Placed) => {
  const f = footprint(p);
  return p.x + p.y + (f.w + f.d) / 2 + (itemById(p.id).h < 0.1 ? -10 : 0);
};

export function drawScene(ctx: CanvasRenderingContext2D, s: GameState, o: SceneOpts = {}) {
  const d = s.design;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Soft shadow under the room.
  ctx.fillStyle = 'rgba(70,50,30,0.12)';
  poly(ctx, [iso(-0.3, -0.3), iso(ROOM_W + 0.4, -0.3), iso(ROOM_W + 0.4, ROOM_D + 0.4), iso(-0.3, ROOM_D + 0.4)], 'rgba(70,50,30,0.12)');

  const wallF = finishById(d.wall);
  const light = finishById(d.lighting);
  drawWall(ctx, 'back', wallF);
  drawWall(ctx, 'left', wallF);
  for (const w of d.windows) drawWindow(ctx, w.wall, w.slot, finishById(w.finish), light.color);
  if (o.hoverWall) {
    const { wall, slot } = o.hoverWall;
    poly(ctx, [wallPt(wall, slot + 0.05, 0.2), wallPt(wall, slot + 0.95, 0.2), wallPt(wall, slot + 0.95, WALL_H - 0.15), wallPt(wall, slot + 0.05, WALL_H - 0.15)], 'rgba(255,200,90,0.18)', 'rgba(230,160,50,0.9)', 2);
  }

  // Hints of trouble before it is found.
  for (const i of s.issues) {
    if (i.status !== 'hidden') continue;
    if (i.id === 'water-damage' || i.id === 'mold') {
      const [cx, cy] = wallPt(i.id === 'mold' ? 'left' : 'back', i.id === 'mold' ? 1.2 : 5.5, 2.2);
      ctx.fillStyle = i.id === 'mold' ? 'rgba(40,50,35,0.25)' : 'rgba(120,80,30,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 22, 14, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFloor(ctx, finishById(d.floor));
  if (o.hoverTile) {
    const { x, y } = o.hoverTile;
    poly(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], 'rgba(255,255,255,0.25)', 'rgba(230,160,50,0.8)', 1.5);
  }
  for (const i of s.issues) {
    if (i.status === 'found' && (i.id === 'dry-rot' || i.id === 'termites')) {
      const at = i.id === 'dry-rot' ? [2.3, 1.2] : [5.5, 3.6];
      poly(ctx, [iso(at[0], at[1]), iso(at[0] + 1.4, at[1]), iso(at[0] + 1.4, at[1] + 1), iso(at[0], at[1] + 1)], 'rgba(60,40,20,0.45)', 'rgba(60,40,20,0.7)');
    }
  }

  const all: { p: Placed; opts: ItemOpts; alpha?: number }[] = [
    ...d.items.map((p) => ({ p, opts: { selected: p.uid === o.selectedUid } })),
    ...s.junk.map((p) => ({ p, opts: {}, alpha: o.fading?.get(p.uid) })),
  ];
  if (o.ghost) all.push({ p: o.ghost.p, opts: { ghost: true, valid: o.ghost.valid } });
  all.sort((a, b) => depth(a.p) - depth(b.p));
  for (const it of all) {
    ctx.save();
    if (it.alpha !== undefined) ctx.globalAlpha = it.alpha;
    drawItem(ctx, it.p, d, it.opts);
    ctx.restore();
  }

  // Room lighting mood.
  if (light.id !== 'light-daylight') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = light.old ? 0.12 : 0.1;
    ctx.fillStyle = light.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}

// Draw a snapshot of the room to an image URL, for the before/after reveal.
export function snapshot(s: GameState, scale = 2): string {
  const c = document.createElement('canvas');
  c.width = CANVAS_W * scale;
  c.height = CANVAS_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawScene(ctx, s);
  return c.toDataURL('image/png');
}

export const issueName = (id: string) => issueById(id).name;
