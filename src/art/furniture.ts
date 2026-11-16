// Furniture and decor with real shapes: legs, seats, cushions, leaves and lampshades
// rather than boxes. Like the junk, each piece is laid out in its own space (front toward
// +y) so it keeps its shape as the camera turns.
import type { Placed } from '../state';
import { woodGrain } from './materials';
import { clamp01, hexRgb, noise2, rng } from './noise';
import { RX, RY, ZS, floorShadow, lbox, poly, rgb, run, stroke, tileSpace, tint, type Kit, type L, type Part } from './props';
import { onPlane, texture } from './scene';
import { PX, pixels } from './surfaces';

type Pt = [number, number];

interface Def {
  id: string;
  w: number;
  d: number;
  h: number;
  top: string;
  side: string;
}

// A cylinder or cone standing at a view-space point. r0 is the bottom radius, r1 the top.
function cyl(k: Kit, vx: number, vy: number, z0: number, z1: number, r0: number, r1: number, color: string, topColor?: string, key = vx + vy): Part {
  return {
    key: key + z0 * 0.01,
    draw: () => {
      const { ctx } = k;
      const [bx, by] = k.iso(vx, vy, z0);
      const [tx, ty] = k.iso(vx, vy, z1);
      const R = Math.max(r0, r1) * RX;
      const g = ctx.createLinearGradient(bx - R, 0, bx + R, 0);
      g.addColorStop(0, rgb(color, 0.86));
      g.addColorStop(0.28, rgb(color, 1.1));
      g.addColorStop(1, rgb(color, 0.56));
      ctx.beginPath();
      ctx.moveTo(bx - r0 * RX, by);
      ctx.ellipse(bx, by, r0 * RX, r0 * RY, 0, Math.PI, 0, true);
      ctx.lineTo(tx + r1 * RX, ty);
      ctx.ellipse(tx, ty, r1 * RX, r1 * RY, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx, ty, r1 * RX, r1 * RY, 0, 0, Math.PI * 2);
      ctx.fillStyle = topColor ?? rgb(color, 1.16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    },
  };
}

// Lay a texture on a level rectangle given in the piece's own space.
function layFlat(k: Kit, l: L, lx: number, ly: number, lw: number, ld: number, z: number, tex: HTMLCanvasElement, alpha = 1) {
  const { ctx, iso } = k;
  onPlane(ctx, iso(...l(lx, ly), z), iso(...l(lx + 1, ly), z), iso(...l(lx, ly + 1), z), () => {
    ctx.globalAlpha *= alpha;
    ctx.drawImage(tex, 0, 0, lw * PX, ld * PX, 0, 0, lw * PX, ld * PX);
  });
}

const grain = (light: string, seed: number) => texture(`grain:${light}:${seed}`, () => woodGrain(2.2, 1.2, tint(light, 1.12), tint(light, 0.62), seed));

function legs(k: Kit, l: L, x0: number, y0: number, x1: number, y1: number, t: number, z: number, h: number, color: string): Part[] {
  return [[x0, y0], [x1 - t, y0], [x0, y1 - t], [x1 - t, y1 - t]].map(([x, y]) => lbox(k, l, x, y, t, t, z, h, { color }));
}

function drawTable(k: Kit, p: Placed, l: L, def: Def) {
  const W = def.w;
  floorShadow(k, ...mid(l, W / 2, 0.5), 0.5, 0.25);
  const parts = legs(k, l, 0.12, 0.14, W - 0.12, 0.86, 0.08, 0, 0.66, def.side);
  parts.push(lbox(k, l, 0.16, 0.18, W - 0.32, 0.64, 0.58, 0.08, { color: def.side }));
  run(parts);
  run([
    lbox(k, l, 0.04, 0.06, W - 0.08, 0.88, 0.66, 0.07, {
      color: def.top,
      after: () => {
        // Boards run the length of the table.
        layFlat(k, l, 0.04, 0.06, W - 0.08, 0.88, 0.73, grainAlong(def.top, p.uid % 3), 0.85);
      },
    }),
  ]);
}

// Grain running along x rather than up the face.
const grainAlong = (light: string, seed: number) =>
  texture(`grainx:${light}:${seed}`, () => {
    const src = woodGrain(1.2, 2.2, tint(light, 1.14), tint(light, 0.66), seed + 20);
    const c = document.createElement('canvas');
    c.width = src.height;
    c.height = src.width;
    const g = c.getContext('2d')!;
    g.translate(c.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(src, 0, 0);
    // Board joints.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(40,22,10,0.4)';
    for (let y = 0.22 * PX; y < c.height; y += 0.22 * PX) g.fillRect(0, y, c.width, 1.4);
    return c;
  });

const mid = (l: L, lx: number, ly: number): Pt => l(lx, ly);

function drawRoundTable(k: Kit, l: L, def: Def) {
  const [cx, cy] = l(0.5, 0.5);
  floorShadow(k, cx, cy, 0.42, 0.3);
  run([
    cyl(k, cx, cy, 0, 0.04, 0.24, 0.22, '#2f3135'),
    cyl(k, cx, cy, 0.04, 0.7, 0.045, 0.045, '#2f3135'),
    cyl(k, cx, cy, 0.7, 0.75, 0.46, 0.46, def.side, def.top),
  ]);
  // Soft sheen on the marble top.
  const { ctx } = k;
  const [tx, ty] = k.iso(cx, cy, 0.75);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(tx, ty, 0.46 * RX, 0.46 * RY, 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(tx - 24, ty - 10, tx + 20, ty + 12);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(90,80,70,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(tx - 30, ty - 16, 60, 32);
  ctx.strokeStyle = 'rgba(150,150,158,0.5)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(tx - 18, ty + 2);
  ctx.bezierCurveTo(tx - 6, ty - 5, tx + 4, ty + 6, tx + 20, ty - 2);
  ctx.stroke();
  ctx.restore();
}

function drawChair(k: Kit, l: L, def: Def) {
  const c = def.side;
  floorShadow(k, ...l(0.5, 0.52), 0.3, 0.3);
  const parts = legs(k, l, 0.26, 0.26, 0.74, 0.74, 0.055, 0, 0.44, c);
  parts.push(lbox(k, l, 0.24, 0.24, 0.52, 0.52, 0.44, 0.05, { color: def.top }));
  // Back posts, a top rail and two slats.
  parts.push(lbox(k, l, 0.26, 0.26, 0.055, 0.055, 0.49, 0.52, { color: c }));
  parts.push(lbox(k, l, 0.685, 0.26, 0.055, 0.055, 0.49, 0.52, { color: c }));
  parts.push(lbox(k, l, 0.26, 0.265, 0.48, 0.045, 0.93, 0.1, { color: def.top }));
  parts.push(lbox(k, l, 0.3, 0.27, 0.4, 0.035, 0.7, 0.07, { color: def.top }));
  run(parts);
}

function drawStool(k: Kit, l: L, def: Def) {
  const { ctx, iso } = k;
  const [cx, cy] = l(0.5, 0.5);
  floorShadow(k, cx, cy, 0.24, 0.3);
  const feet: Pt[] = [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]];
  feet.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  feet.forEach(([dx, dy], i) => {
    const a = iso(cx + dx * 0.6, cy + dy * 0.6, 0.6);
    const b = iso(cx + dx, cy + dy, 0);
    stroke(ctx, [a, b], i < 2 ? '#26282c' : '#45484e', 3);
    if (i === 1) {
      // Foot ring, drawn between the back and front legs.
      const [rx, ry] = iso(cx, cy, 0.22);
      ctx.beginPath();
      ctx.ellipse(rx, ry, 0.23 * RX, 0.23 * RY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#3a3d42';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  run([cyl(k, cx, cy, 0.6, 0.66, 0.2, 0.21, '#8a603b', '#a7774c')]);
  // Seat dished in the middle.
  const [tx, ty] = iso(cx, cy, 0.66);
  const g = ctx.createRadialGradient(tx + 2, ty + 1, 1, tx, ty, 0.2 * RX);
  g.addColorStop(0, 'rgba(60,30,10,0.25)');
  g.addColorStop(1, 'rgba(60,30,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(tx, ty, 0.2 * RX, 0.2 * RY, 0, 0, Math.PI * 2);
  ctx.fill();
  void def;
}

function drawBench(k: Kit, p: Placed, l: L, def: Def) {
  const { ctx, iso } = k;
  floorShadow(k, ...l(1, 0.52), 0.5, 0.25);
  run([
    lbox(k, l, 0.06, 0.14, 1.88, 0.72, 0, 0.36, { color: def.side }),
    lbox(k, l, 0.04, 0.12, 1.92, 0.76, 0.36, 0.035, { color: def.top }),
    lbox(k, l, 0.09, 0.16, 1.82, 0.68, 0.395, 0.08, { color: '#e4d9c3' }),
  ]);
  // Cushion seam and two scatter pillows.
  const a = iso(...l(1, 0.16), 0.475);
  const b = iso(...l(1, 0.84), 0.475);
  stroke(ctx, [a, b], 'rgba(120,100,70,0.5)', 1);
  const R = rng(p.uid * 13 + 5);
  for (const [lx, col] of [[0.34, '#c2683f'], [1.62, '#6f8f84']] as const) {
    const [vx, vy] = l(lx, 0.36);
    const [sx, sy] = iso(vx, vy, 0.475);
    ctx.save();
    ctx.translate(sx, sy - 9);
    ctx.rotate((R() - 0.5) * 0.5);
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 5);
    const g = ctx.createLinearGradient(-11, -9, 11, 9);
    g.addColorStop(0, rgb(col, 1.2));
    g.addColorStop(1, rgb(col, 0.7));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCart(k: Kit, l: L, def: Def) {
  const { ctx, iso } = k;
  floorShadow(k, ...l(0.5, 0.52), 0.34, 0.3);
  // Castors.
  for (const [x, y] of [[0.24, 0.24], [0.76, 0.24], [0.24, 0.76], [0.76, 0.76]]) {
    const [sx, sy] = iso(...l(x, y), 0.04);
    ctx.fillStyle = '#1e1f22';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 3.2, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const steel = def.side;
  const parts = legs(k, l, 0.2, 0.2, 0.8, 0.8, 0.04, 0.08, 0.76, steel);
  parts.push(lbox(k, l, 0.2, 0.2, 0.6, 0.6, 0.2, 0.03, { color: steel }));
  parts.push(lbox(k, l, 0.2, 0.2, 0.6, 0.6, 0.5, 0.03, { color: steel }));
  const [bx, by] = l(0.4, 0.5);
  parts.push(cyl(k, bx, by, 0.53, 0.63, 0.1, 0.15, '#e8e0d0', '#f5efe2', bx + by + 0.2));
  const [jx, jy] = l(0.62, 0.42);
  parts.push(cyl(k, jx, jy, 0.23, 0.4, 0.07, 0.07, '#8fa58a', undefined, jx + jy + 0.1));
  const [px, py] = l(0.4, 0.6);
  parts.push(cyl(k, px, py, 0.23, 0.34, 0.09, 0.1, '#c2683f', undefined, px + py + 0.1));
  run(parts);
  run([
    lbox(k, l, 0.14, 0.14, 0.72, 0.72, 0.84, 0.06, {
      color: def.top,
      after: () => layFlat(k, l, 0.14, 0.14, 0.72, 0.72, 0.9, grainAlong(def.top, 1), 0.7),
    }),
  ]);
  // Push handle.
  const h0 = iso(...l(0.14, 0.2), 0.86);
  const h1 = iso(...l(0.06, 0.2), 0.86);
  const h2 = iso(...l(0.06, 0.8), 0.86);
  const h3 = iso(...l(0.14, 0.8), 0.86);
  stroke(ctx, [h0, h1, h2, h3], '#3a3d42', 2.2);
}

function rugTexture(w: number, d: number, color: string, accent: string): HTMLCanvasElement {
  const C = hexRgb(color);
  const A = hexRgb(accent);
  const cream = [241, 227, 207];
  const deep = C.map((v) => v * 0.55);
  return pixels(w, d, (x, y, out) => {
    const u = x / PX;
    const v = y / PX;
    const e = Math.min(u, w - u, v, d - v);
    let c: number[] = C;
    // Borders, then a field of stepped diamonds.
    if (e < 0.05) c = deep;
    else if (e < 0.11) c = cream;
    else if (e < 0.15) c = A;
    else if (e < 0.18) c = deep;
    else {
      const s = 0.36;
      const du = Math.abs(((u + s / 2) % s) - s / 2) / s;
      const dv = Math.abs(((v + s / 2) % s) - s / 2) / s;
      const m = Math.floor((du + dv) * 9);
      if (m === 0) c = deep;
      else if (m === 1 || m === 4) c = cream;
      else if (m === 2) c = A;
    }
    // The weave: rows of knots, a little uneven in dye.
    const knot = 0.9 + ((x % 3 === 0 ? 0.05 : 0) + (y % 3 === 0 ? -0.07 : 0)) + noise2(x / 1.4, y / 1.4, 3) * 0.12;
    const dye = 0.94 + noise2(u * 1.5, v * 9, 5) * 0.1;
    out[0] = clamp01((c[0] * knot * dye) / 255) * 255;
    out[1] = clamp01((c[1] * knot * dye) / 255) * 255;
    out[2] = clamp01((c[2] * knot * dye) / 255) * 255;
  });
}

function drawRug(k: Kit, p: Placed, l: L, def: Def) {
  const { ctx, iso } = k;
  const m = 0.1;
  const w = def.w - m * 2;
  const d = def.d - m * 2;
  // Fringe on the two short ends.
  const R = rng(p.uid * 7 + 1);
  for (const ly of [m, def.d - m]) {
    const out = ly === m ? -0.07 : 0.07;
    for (let i = 0; i <= 44; i++) {
      const lx = m + (i / 44) * w;
      stroke(ctx, [iso(...l(lx, ly), 0.01), iso(...l(lx + (R() - 0.5) * 0.03, ly + out * (0.7 + R() * 0.5)), 0.005)], 'rgba(236,222,198,0.95)', 1);
    }
  }
  // A thin dark edge gives the pile some thickness.
  poly(ctx, [iso(...l(m, m), 0), iso(...l(m + w, m), 0), iso(...l(m + w, m + d), 0), iso(...l(m, m + d), 0)], 'rgba(40,24,12,0.5)');
  const tex = texture(`rug:${def.top}:${def.w}x${def.d}`, () => rugTexture(w, d, def.top, def.side));
  layFlat(k, l, m, m, w, d, 0.03, tex);
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, ang: number, color: string, shade: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid, len * 0.8, -wid * 0.9, len, 0);
  ctx.bezierCurveTo(len * 0.8, wid * 0.9, len * 0.25, wid, 0, 0);
  const g = ctx.createLinearGradient(0, -wid, 0, wid);
  g.addColorStop(0, rgb(color, shade * 1.22));
  g.addColorStop(1, rgb(color, shade * 0.7));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgb(color, shade * 1.45, 0.7);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(len * 0.92, 0);
  ctx.stroke();
  ctx.restore();
}

function pot(k: Kit, cx: number, cy: number, h: number, r: number, color: string) {
  run([cyl(k, cx, cy, 0, h, r * 0.74, r, color, '#3a2a1e'), cyl(k, cx, cy, h - 0.05, h, r * 1.06, r * 1.06, tint(color, 1.08), '#3a2a1e')]);
}

function drawFig(k: Kit, p: Placed, l: L, def: Def) {
  const { ctx, iso } = k;
  const [cx, cy] = l(0.5, 0.5);
  floorShadow(k, cx, cy, 0.36, 0.34);
  pot(k, cx, cy, 0.42, 0.22, def.side);
  const R = rng(p.uid * 31 + 7);
  // A slender trunk with a kink in it.
  const base = iso(cx, cy, 0.4);
  const top = iso(cx, cy, 1.25);
  const bendX = (R() - 0.5) * 8;
  ctx.strokeStyle = '#6b4a33';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(base[0], base[1]);
  ctx.quadraticCurveTo(base[0] + bendX, (base[1] + top[1]) / 2, top[0], top[1]);
  ctx.stroke();
  // Big fiddle leaves, lower ones darker and drooping, upper ones catching the light.
  const leaves: { x: number; y: number; a: number; len: number; s: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const y = base[1] - 18 - t * (base[1] - top[1] - 4);
    const side = i % 2 ? 1 : -1;
    const a = side > 0 ? -0.55 + t * -0.5 + R() * 0.5 : Math.PI + 0.55 + t * 0.5 - R() * 0.5;
    leaves.push({ x: base[0] + bendX * 0.5 * Math.sin(t * Math.PI) + side * R() * 3, y, a: t > 0.9 ? -Math.PI / 2 + (R() - 0.5) * 0.9 : a, len: 17 + R() * 8 - t * 4, s: 0.72 + t * 0.4 + R() * 0.1 });
  }
  for (const f of leaves) leaf(ctx, f.x, f.y, f.len, f.len * 0.36, f.a, def.top, f.s);
}

function drawHerbs(k: Kit, p: Placed, l: L, def: Def) {
  const { ctx, iso } = k;
  floorShadow(k, ...l(0.5, 0.52), 0.34, 0.3);
  run([
    lbox(k, l, 0.14, 0.3, 0.72, 0.4, 0, 0.3, {
      color: def.side,
      after: (b) => poly(ctx, [iso(b.x + 0.03, b.y + 0.03, b.z1), iso(b.x + b.w - 0.03, b.y + 0.03, b.z1), iso(b.x + b.w - 0.03, b.y + b.d - 0.03, b.z1), iso(b.x + 0.03, b.y + b.d - 0.03, b.z1)], '#3a2a1e'),
    }),
  ]);
  const R = rng(p.uid * 17 + 3);
  const clumps = [0.27, 0.5, 0.73].map((lx, i) => ({ at: l(lx, 0.5), kind: i }));
  clumps.sort((a, b) => a.at[0] + a.at[1] - b.at[0] - b.at[1]);
  for (const c of clumps) {
    const [sx, sy] = iso(c.at[0], c.at[1], 0.3);
    if (c.kind === 0) {
      // Basil: broad bright leaves.
      for (let i = 0; i < 12; i++) leaf(ctx, sx + (R() - 0.5) * 8, sy - 2 - R() * 10, 7 + R() * 3, 3.4, -Math.PI / 2 + (R() - 0.5) * 2.6, '#6fae4f', 0.8 + R() * 0.4);
    } else if (c.kind === 1) {
      // Rosemary: upright needles.
      for (let i = 0; i < 9; i++) {
        const x = sx + (R() - 0.5) * 9;
        const top = sy - 12 - R() * 10;
        stroke(ctx, [[x, sy], [x + (R() - 0.5) * 4, top]], '#4f7350', 1.2);
        for (let j = 0; j < 5; j++) {
          const yy = sy - 3 - j * ((sy - top) / 6);
          stroke(ctx, [[x - 2.4, yy - 1.5], [x, yy], [x + 2.4, yy - 1.5]], '#6d9468', 0.8);
        }
      }
    } else {
      // Thyme: a low spilling mound.
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rgb('#8fb86a', 0.7 + R() * 0.5);
        ctx.beginPath();
        ctx.arc(sx + (R() - 0.5) * 14, sy - R() * 7 + 1, 1.5 + R(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawLamp(k: Kit, l: L, def: Def) {
  const { ctx, iso } = k;
  const [cx, cy] = l(0.5, 0.5);
  floorShadow(k, cx, cy, 0.2, 0.3);
  run([cyl(k, cx, cy, 0, 0.035, 0.17, 0.16, def.side), cyl(k, cx, cy, 0.035, 1.3, 0.014, 0.014, def.side)]);
  // Linen shade, lit from inside: brightest low down where the bulb sits.
  const [bx, by] = iso(cx, cy, 1.24);
  const [tx, ty] = iso(cx, cy, 1.68);
  const r0 = 0.22 * RX;
  const r1 = 0.14 * RX;
  ctx.beginPath();
  ctx.moveTo(bx - r0, by);
  ctx.ellipse(bx, by, r0, r0 / 2, 0, Math.PI, 0, true);
  ctx.lineTo(tx + r1, ty);
  ctx.ellipse(tx, ty, r1, r1 / 2, 0, 0, Math.PI, true);
  ctx.closePath();
  const g = ctx.createRadialGradient(bx, by - 4, 2, bx, by - 6, r0 * 1.5);
  g.addColorStop(0, '#fffbe8');
  g.addColorStop(0.5, def.top);
  g.addColorStop(1, rgb(def.top, 0.78));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,30,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(tx, ty, r1, r1 / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6dc';
  ctx.fill();
  // Fine vertical weave.
  ctx.strokeStyle = 'rgba(150,110,50,0.14)';
  ctx.lineWidth = 0.6;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + (i / 4) * r0, by + 4 - Math.abs(i));
    ctx.lineTo(tx + (i / 4) * r1, ty + 2);
    ctx.stroke();
  }
}

function drawWoodStove(k: Kit, p: Placed, l: L, def: Def) {
  const { ctx, iso } = k;
  const [cx, cy] = l(0.5, 0.5);
  floorShadow(k, cx, cy, 0.42, 0.4);
  // A stone hearth pad.
  poly(ctx, [iso(...l(0.04, 0.04), 0.012), iso(...l(0.96, 0.04), 0.012), iso(...l(0.96, 0.96), 0.012), iso(...l(0.04, 0.96), 0.012)], '#6c6a68', 'rgba(0,0,0,0.3)', 1);
  const iron = def.side;
  const parts = legs(k, l, 0.2, 0.22, 0.8, 0.8, 0.07, 0.012, 0.13, '#1c1c1e');
  const z0 = 0.14;
  const z1 = 0.98;
  parts.push(
    lbox(k, l, 0.17, 0.2, 0.66, 0.6, z0, z1 - z0, {
      color: iron,
      after: (b) => {
        if (p.rot > 1) return;
        const fx = p.rot === 1;
        const H = (z1 - z0) * PX;
        const W = (fx ? b.d : b.w) * PX;
        const o = fx ? iso(b.x + b.w, b.y + b.d, z1) : iso(b.x, b.y + b.d, z1);
        const ax = fx ? iso(b.x + b.w, b.y + b.d - 1, z1) : iso(b.x + 1, b.y + b.d, z1);
        const ay = fx ? iso(b.x + b.w, b.y + b.d, z1 - 1) : iso(b.x, b.y + b.d, z1 - 1);
        onPlane(ctx, o, ax, ay, () => {
          // Door with a window onto the fire.
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(6, 8, W - 12, H - 22);
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1;
          ctx.strokeRect(8, 10, W - 16, H - 26);
          const gx = 12;
          const gy = 16;
          const gw = W - 24;
          const gh = H - 46;
          ctx.beginPath();
          ctx.roundRect(gx, gy, gw, gh, [10, 10, 2, 2]);
          const g = ctx.createRadialGradient(gx + gw / 2, gy + gh, 2, gx + gw / 2, gy + gh * 0.8, gw * 0.75);
          g.addColorStop(0, '#fff3b0');
          g.addColorStop(0.3, '#ffb347');
          g.addColorStop(0.7, '#d9541e');
          g.addColorStop(1, '#3a1208');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.save();
          ctx.clip();
          const R = rng(p.uid * 5 + 2);
          for (let i = 0; i < 6; i++) {
            const fxp = gx + ((i + 0.5) / 6) * gw;
            const fh = gh * (0.35 + R() * 0.45);
            ctx.beginPath();
            ctx.moveTo(fxp - 5, gy + gh);
            ctx.quadraticCurveTo(fxp - 6, gy + gh - fh * 0.5, fxp + (R() - 0.5) * 6, gy + gh - fh);
            ctx.quadraticCurveTo(fxp + 6, gy + gh - fh * 0.5, fxp + 5, gy + gh);
            ctx.fillStyle = i % 2 ? 'rgba(255,236,150,0.85)' : 'rgba(255,170,60,0.85)';
            ctx.fill();
          }
          // Logs.
          ctx.fillStyle = '#2a1408';
          ctx.fillRect(gx + 4, gy + gh - 6, gw - 8, 6);
          ctx.restore();
          ctx.strokeStyle = '#0c0c0d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(gx, gy, gw, gh, [10, 10, 2, 2]);
          ctx.stroke();
          // Latch and air vent.
          ctx.fillStyle = '#8d8f94';
          ctx.fillRect(W - 11, gy + gh / 2 - 6, 4, 12);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = '#0c0c0d';
            ctx.fillRect(W / 2 - 17 + i * 7.5, H - 22, 4, 7);
          }
        });
      },
    }),
  );
  parts.push(lbox(k, l, 0.14, 0.17, 0.72, 0.66, z1, 0.045, { color: tint(iron, 1.15) }));
  run(parts);
  // Flue pipe up through the ceiling line, with a collar.
  const [fx, fy] = l(0.5, 0.36);
  run([cyl(k, fx, fy, z1 + 0.045, 2.86, 0.1, 0.1, '#2a2a2c', '#111'), cyl(k, fx, fy, 1.7, 1.75, 0.112, 0.112, '#3a3a3d', '#3a3a3d', fx + fy + 0.5)]);
  // Firelight spilling out of the door onto the hearth.
  if (p.rot < 2) {
    const [gx, gy] = iso(...l(0.5, 1.1), 0.3);
    const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 46);
    g.addColorStop(0, 'rgba(255,170,80,0.34)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 46, gy - 46, 92, 92);
  }
  void ZS;
  void RY;
  void grain;
}

// Draw a piece of furniture or decor. Returns false if this is not one of ours.
export function drawFurniture(k: Kit, p: Placed, def: Def, view: { w: number; d: number }): boolean {
  const base = tileSpace(p, view.w, view.d);
  // The piece's own space runs 0..w across and 0..d back to front.
  const l: L = (lx, ly) => base(lx + 0.5 - def.w / 2, ly + 0.5 - def.d / 2);
  switch (def.id) {
    case 'table':
      drawTable(k, p, l, def);
      return true;
    case 'table-round':
      drawRoundTable(k, l, def);
      return true;
    case 'chair':
      drawChair(k, l, def);
      return true;
    case 'stool':
      drawStool(k, l, def);
      return true;
    case 'bench':
      drawBench(k, p, l, def);
      return true;
    case 'cart':
      drawCart(k, l, def);
      return true;
    case 'rug':
      drawRug(k, p, l, def);
      return true;
    case 'plant':
      drawFig(k, p, l, def);
      return true;
    case 'herbs':
      drawHerbs(k, p, l, def);
      return true;
    case 'lamp':
      drawLamp(k, l, def);
      return true;
    case 'fireplace':
      drawWoodStove(k, p, l, def);
      return true;
  }
  return false;
}
