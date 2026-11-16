// Hand-drawn junk for the clear-out stage: trash bags, box stacks, a ruined armchair and
// so on. Each piece is described in its own tile space (front toward +y) and turned into
// view space, so a pile keeps its shape as the camera turns.
import type { Placed } from '../state';
import { hexRgb, rng, type Rand } from './noise';

type Pt = [number, number];

// The few renderer primitives a prop needs.
export interface Kit {
  ctx: CanvasRenderingContext2D;
  iso: (x: number, y: number, z?: number) => Pt;
}

export const rgb = (hex: string, k = 1, a = 1) => {
  const [r, g, b] = hexRgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1)))));
  return `rgba(${r},${g},${b},${a})`;
};

export const tint = (hex: string, k: number) => {
  const [r, g, b] = hexRgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1)))));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

// Screen radii of a floor circle of radius r (in tiles).
export const RX = 50.9;
export const RY = 25.45;
export const ZS = 40;

// Tile space (0..1, front toward +y) to view space, for a piece turned to `rot`.
export function tileSpace(p: { x: number; y: number; rot: number }, w = 1, d = 1) {
  return (lx: number, ly: number): Pt => {
    const cx = lx - 0.5;
    const cy = ly - 0.5;
    const [rx, ry] = p.rot === 0 ? [cx, cy] : p.rot === 1 ? [cy, -cx] : p.rot === 2 ? [-cx, -cy] : [-cy, cx];
    return [p.x + w / 2 + rx, p.y + d / 2 + ry];
  };
}

export type L = (lx: number, ly: number) => Pt;

export interface Part {
  key: number; // draw order, back to front
  draw: () => void;
}

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string | CanvasGradient, stroke?: string, lw = 1) {
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

export function stroke(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// A soft shadow pooled on the floor under something.
export function floorShadow(k: Kit, vx: number, vy: number, r: number, a = 0.42) {
  const [bx, by] = k.iso(vx, vy, 0);
  const { ctx } = k;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, r * RX * 0.3, 0, 0, r * RX * 1.25);
  g.addColorStop(0, `rgba(24,14,8,${a})`);
  g.addColorStop(1, 'rgba(24,14,8,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * RX * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface BoxLook {
  color: string;
  // Called after the box is drawn, with helpers for points on its top.
  after?: (b: { x: number; y: number; w: number; d: number; z1: number }) => void;
}

// A box given in tile space. Faces get a little gradient so they do not read as flat.
export function lbox(k: Kit, l: L, lx: number, ly: number, lw: number, ld: number, z: number, h: number, look: BoxLook): Part {
  const [ax, ay] = l(lx, ly);
  const [bx, by] = l(lx + lw, ly + ld);
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const d = Math.abs(by - ay);
  const z1 = z + h;
  return {
    key: x + y + (w + d) / 2 + z * 0.01,
    draw: () => {
      const { ctx, iso } = k;
      const face = (pts: Pt[], light: number, dark: number) => {
        const g = ctx.createLinearGradient(0, pts[2][1], 0, pts[0][1]);
        g.addColorStop(0, rgb(look.color, light));
        g.addColorStop(1, rgb(look.color, dark));
        poly(ctx, pts, g, 'rgba(0,0,0,0.18)', 0.8);
      };
      face([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x, y + d, z1)], 0.95, 0.78);
      face([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z1), iso(x + w, y, z1)], 0.74, 0.58);
      poly(ctx, [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + d, z1), iso(x, y + d, z1)], rgb(look.color, 1.12), 'rgba(0,0,0,0.15)', 0.8);
      look.after?.({ x, y, w, d, z1 });
    },
  };
}

export function run(parts: Part[]) {
  parts.sort((a, b) => a.key - b.key);
  for (const p of parts) p.draw();
}

// ---- Lumpy things: bags and heaps ----

// Outline of a sack sitting on the floor. Leaves the path open on the context.
function sackPath(k: Kit, vx: number, vy: number, r: number, h: number, R: Rand): { bx: number; by: number; top: Pt } {
  const { ctx } = k;
  const [bx, by] = k.iso(vx, vy, 0);
  const hw = r * RX;
  const hh = r * RY;
  const H = h * ZS;
  const j = () => (R() - 0.5) * hw * 0.25;
  const top: Pt = [bx + j() * 0.6, by - H];
  ctx.beginPath();
  ctx.ellipse(bx, by, hw, hh, 0, Math.PI, 0, true);
  ctx.bezierCurveTo(bx + hw * 1.12 + j(), by - H * 0.45, bx + hw * 0.5 + j(), by - H * 0.92, top[0] + hw * 0.12, top[1]);
  ctx.lineTo(top[0] - hw * 0.12, top[1]);
  ctx.bezierCurveTo(bx - hw * 0.5 + j(), by - H * 0.92, bx - hw * 1.12 + j(), by - H * 0.45, bx - hw, by);
  ctx.closePath();
  return { bx, by, top };
}

function trashBag(k: Kit, vx: number, vy: number, r: number, h: number, seed: number): Part {
  return {
    key: vx + vy,
    draw: () => {
      const { ctx } = k;
      const R = rng(seed);
      floorShadow(k, vx, vy, r);
      const { bx, by, top } = sackPath(k, vx, vy, r, h, R);
      const hw = r * RX;
      const H = h * ZS;
      const g = ctx.createRadialGradient(bx - hw * 0.35, by - H * 0.7, 2, bx, by - H * 0.4, hw * 1.5);
      g.addColorStop(0, '#565a63');
      g.addColorStop(0.35, '#2c2e34');
      g.addColorStop(1, '#0d0e10');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // Creases fanning down from the tied neck, each with a dark side and a glossy side.
      for (let i = 0; i < 7; i++) {
        const t = (i + R() * 0.6) / 7;
        const ex = bx - hw + t * hw * 2;
        const ey = by + (R() - 0.3) * r * RY;
        const mx = top[0] + (ex - top[0]) * 0.55 + (R() - 0.5) * hw * 0.5;
        const my = top[1] + (ey - top[1]) * 0.45;
        for (const [off, col, lw] of [[0, 'rgba(0,0,0,0.45)', 1.6], [-1.3, `rgba(255,255,255,${0.1 + R() * 0.16})`, 1]] as const) {
          ctx.beginPath();
          ctx.moveTo(top[0], top[1] + 2);
          ctx.quadraticCurveTo(mx + off, my, ex + off, ey);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
      // Stretched-plastic sheen where the light catches it.
      for (let i = 0; i < 3; i++) {
        const sx = bx - hw * (0.55 - i * 0.28) + (R() - 0.5) * 4;
        const sy = by - H * (0.5 + R() * 0.25);
        ctx.beginPath();
        ctx.ellipse(sx, sy, hw * 0.07, H * (0.1 + R() * 0.08), 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(235,240,255,0.22)';
        ctx.fill();
      }
      ctx.restore();
      // The tied-off neck: a gathered tuft and a drawstring.
      const [tx, ty] = top;
      ctx.fillStyle = '#1b1c20';
      for (const dx of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(tx - 3, ty + 2);
        ctx.quadraticCurveTo(tx + dx * 5, ty - 2, tx + dx * 5 + (R() - 0.5) * 2, ty - 4.5 - R() * 2);
        ctx.quadraticCurveTo(tx + dx * 2, ty - 1, tx + 3, ty + 2);
        ctx.fill();
      }
      stroke(ctx, [[tx - 4, ty + 1.5], [tx + 4, ty + 1.5]], '#c9a43a', 1.6);
      stroke(ctx, [[tx + 3, ty + 1.5], [tx + 7, ty + 6]], '#c9a43a', 1.1);
    },
  };
}

function drawBags(k: Kit, p: Placed, l: L) {
  const s = p.uid * 97;
  const at = (lx: number, ly: number) => l(lx, ly);
  const spots: [number, number, number, number][] = [
    [0.36, 0.34, 0.3, 0.6],
    [0.7, 0.42, 0.25, 0.48],
    [0.42, 0.72, 0.23, 0.38],
  ];
  const parts = spots.map(([lx, ly, r, h], i) => trashBag(k, ...at(lx, ly), r, h, s + i));
  // A little spilled rubbish beside the pile.
  const [cx, cy] = at(0.78, 0.78);
  parts.push({
    key: cx + cy,
    draw: () => {
      const R = rng(s + 9);
      const { ctx, iso } = k;
      const [tx, ty] = iso(cx, cy, 0);
      // A crushed can and a scrap of paper.
      ctx.save();
      ctx.translate(tx, ty - 2);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#b9413a';
      ctx.fillRect(-5, -2.5, 10, 5);
      ctx.fillStyle = '#d9dcdf';
      ctx.fillRect(-5, -2.5, 2, 5);
      ctx.fillRect(3.5, -2.5, 1.5, 5);
      ctx.restore();
      poly(ctx, [[tx - 14, ty + 3], [tx - 7, ty + 1 + R() * 2], [tx - 5, ty + 6], [tx - 12, ty + 7]], '#e9e3d2', 'rgba(0,0,0,0.25)', 0.6);
    },
  });
  run(parts);
}

// ---- Cardboard boxes ----

function drawBoxes(k: Kit, l: L) {
  const { ctx, iso } = k;
  const card = '#c49a63';
  const tape = 'rgba(226,205,160,0.9)';
  // A strip of packing tape along the middle of a box top, running along view x.
  const taped = (b: { x: number; y: number; w: number; d: number; z1: number }) => {
    const m = b.y + b.d / 2;
    poly(ctx, [iso(b.x, m - 0.035, b.z1), iso(b.x + b.w, m - 0.035, b.z1), iso(b.x + b.w, m + 0.035, b.z1), iso(b.x, m + 0.035, b.z1)], tape);
    // The tape folds down over the near edge.
    poly(ctx, [iso(b.x + b.w, m - 0.035, b.z1), iso(b.x + b.w, m + 0.035, b.z1), iso(b.x + b.w, m + 0.035, b.z1 - 0.09), iso(b.x + b.w, m - 0.035, b.z1 - 0.09)], 'rgba(200,180,138,0.9)');
  };
  // A damp, sagging stain on the lower part of the left face.
  const stained = (b: { x: number; y: number; w: number; d: number; z1: number }, h: number) => {
    const z0 = b.z1 - h;
    ctx.fillStyle = 'rgba(70,45,20,0.28)';
    ctx.beginPath();
    const a = iso(b.x, b.y + b.d, z0);
    const c = iso(b.x + b.w * 0.7, b.y + b.d, z0);
    const top = iso(b.x + b.w * 0.3, b.y + b.d, z0 + h * 0.55);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(top[0] - 6, top[1], top[0], top[1]);
    ctx.quadraticCurveTo(top[0] + 12, top[1] + 4, c[0], c[1]);
    ctx.closePath();
    ctx.fill();
  };
  const open = (b: { x: number; y: number; w: number; d: number; z1: number }) => {
    // Dark inside, then four flaps standing every which way.
    poly(ctx, [iso(b.x + 0.03, b.y + 0.03, b.z1), iso(b.x + b.w - 0.03, b.y + 0.03, b.z1), iso(b.x + b.w - 0.03, b.y + b.d - 0.03, b.z1), iso(b.x + 0.03, b.y + b.d - 0.03, b.z1)], '#4a3520');
    const flap = (a: Pt, c: Pt, ox: number, oy: number, up: number, tone: number) => {
      poly(ctx, [iso(a[0], a[1], b.z1), iso(c[0], c[1], b.z1), iso(c[0] + ox, c[1] + oy, b.z1 + up), iso(a[0] + ox, a[1] + oy, b.z1 + up)], rgb(card, tone), 'rgba(0,0,0,0.25)', 0.8);
    };
    flap([b.x, b.y], [b.x + b.w, b.y], 0, -0.06, 0.2, 0.88);
    flap([b.x, b.y], [b.x, b.y + b.d], -0.05, 0, 0.2, 1.02);
    flap([b.x + b.w, b.y], [b.x + b.w, b.y + b.d], 0.16, 0, 0.06, 1.18);
    flap([b.x, b.y + b.d], [b.x + b.w, b.y + b.d], 0, 0.15, 0.03, 1.1);
    // Something poking out: a rolled newspaper.
    const n0 = iso(b.x + b.w * 0.4, b.y + b.d * 0.5, b.z1 - 0.02);
    const n1 = iso(b.x + b.w * 0.62, b.y + b.d * 0.35, b.z1 + 0.3);
    stroke(ctx, [n0, n1], '#8d8676', 6);
    stroke(ctx, [n0, n1], '#e6e0cf', 4.2);
  };
  const [sx, sy] = l(0.5, 0.5);
  floorShadow(k, sx, sy, 0.5, 0.36);
  run([
    lbox(k, l, 0.06, 0.2, 0.62, 0.66, 0, 0.42, { color: card, after: (b) => (taped(b), stained(b, 0.42)) }),
    lbox(k, l, 0.14, 0.28, 0.44, 0.46, 0.42, 0.34, { color: '#cfa672', after: open }),
    lbox(k, l, 0.64, 0.08, 0.32, 0.4, 0, 0.26, { color: '#b58c58', after: taped }),
  ]);
}

// ---- Armchair ----

function drawArmchair(k: Kit, p: Placed, l: L, fabric: string) {
  const { ctx, iso } = k;
  const R = rng(p.uid * 131);
  const wood = '#4b3424';
  // Stuffing bursting through a tear on a top surface.
  const tear = (b: { x: number; y: number; w: number; d: number; z1: number }, fx: number, fy: number, size: number) => {
    const [tx, ty] = iso(b.x + b.w * fx, b.y + b.d * fy, b.z1);
    ctx.fillStyle = 'rgba(40,20,18,0.65)';
    ctx.beginPath();
    ctx.ellipse(tx, ty, size * 1.25, size * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#efe7d6' : '#d9cfb8';
      ctx.beginPath();
      ctx.arc(tx + (R() - 0.5) * size * 1.6, ty - R() * size * 0.9, size * (0.35 + R() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const moth = (b: { x: number; y: number; w: number; d: number; z1: number }, n: number) => {
    ctx.fillStyle = 'rgba(35,18,16,0.6)';
    for (let i = 0; i < n; i++) {
      const [mx, my] = iso(b.x + b.w * (0.1 + R() * 0.8), b.y + b.d * (0.1 + R() * 0.8), b.z1);
      ctx.beginPath();
      ctx.ellipse(mx, my, 1 + R() * 1.4, 0.6 + R() * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const [sx, sy] = l(0.5, 0.5);
  floorShadow(k, sx, sy, 0.48, 0.4);
  const parts: Part[] = [];
  // Three good legs. The fourth gave out long ago and lies beside the chair.
  for (const [lx, ly] of [[0.12, 0.16], [0.8, 0.16], [0.12, 0.8]]) parts.push(lbox(k, l, lx, ly, 0.08, 0.08, 0, 0.1, { color: wood }));
  parts.push(lbox(k, l, 0.1, 0.14, 0.8, 0.76, 0.1, 0.28, { color: fabric }));
  parts.push(
    lbox(k, l, 0.25, 0.3, 0.5, 0.58, 0.38, 0.1, {
      color: tint(fabric, 1.16),
      after: (b) => {
        moth(b, 5);
        tear(b, 0.55, 0.5, 5);
        // A spring that has worked its way out.
        const [qx, qy] = iso(b.x + b.w * 0.3, b.y + b.d * 0.6, b.z1);
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.04) {
          const a = t * Math.PI * 7;
          const px = qx + Math.cos(a) * 3.2 + t * 3;
          const py = qy - t * 13 + Math.sin(a) * 1.5;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#6f6a62';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      },
    }),
  );
  for (const lx of [0.1, 0.76]) parts.push(lbox(k, l, lx, 0.14, 0.14, 0.76, 0.38, 0.24, { color: fabric, after: (b) => (moth(b, 3), lx < 0.5 && tear(b, 0.5, 0.7, 3.2)) }));
  parts.push(lbox(k, l, 0.1, 0.1, 0.8, 0.2, 0.38, 0.52, { color: fabric, after: (b) => moth(b, 4) }));
  // The snapped leg on the floor.
  const [bx, by] = l(0.93, 0.93);
  parts.push({
    key: bx + by + 0.2,
    draw: () => {
      const a = iso(bx - 0.1, by - 0.02, 0.02);
      const c = iso(bx + 0.03, by + 0.02, 0.02);
      stroke(ctx, [a, c], '#2e1f15', 5);
      stroke(ctx, [a, c], '#5c4130', 3);
    },
  });
  run(parts);
}

// ---- Tube TV ----

function drawTv(k: Kit, p: Placed, l: L) {
  const { ctx, iso } = k;
  const [sx, sy] = l(0.5, 0.5);
  floorShadow(k, sx, sy, 0.46, 0.4);
  const body = lbox(k, l, 0.1, 0.2, 0.8, 0.6, 0, 0.62, {
    color: '#6b4a30',
    after: (b) => {
      // Wood-grain veneer on the top.
      for (let i = 1; i < 7; i++) {
        const t = b.y + (b.d * i) / 7;
        stroke(ctx, [iso(b.x + 0.02, t, b.z1), iso(b.x + b.w * 0.5, t + (i % 2 ? 0.012 : -0.012), b.z1), iso(b.x + b.w - 0.02, t, b.z1)], 'rgba(40,24,12,0.3)', 0.7);
      }
      // The front faces +y when rot is 0 and +x when rot is 1; otherwise we see the back.
      const front = p.rot < 2;
      // u runs left to right on screen across the face, v runs up.
      const fy = (u: number, v: number): Pt => iso(b.x + u * b.w, b.y + b.d, v * b.z1);
      const fx = (u: number, v: number): Pt => iso(b.x + b.w, b.y + b.d - u * b.d, v * b.z1);
      const f = p.rot % 2 === 0 ? fy : fx;
      const q = (u0: number, u1: number, v0: number, v1: number): Pt[] => [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)];
      if (front) {
        poly(ctx, q(0.05, 0.95, 0.08, 0.94), '#2a2420', 'rgba(0,0,0,0.5)', 1);
        // The tube: grey-green glass, brighter in the middle, with dust and a crack.
        const a = f(0.1, 0.9);
        const c = f(0.7, 0.14);
        const g = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
        g.addColorStop(0, '#77857c');
        g.addColorStop(0.45, '#4a564f');
        g.addColorStop(1, '#262d2a');
        poly(ctx, q(0.1, 0.7, 0.14, 0.88), g, '#15110e', 1.2);
        poly(ctx, [f(0.14, 0.82), f(0.3, 0.84), f(0.2, 0.5), f(0.14, 0.55)], 'rgba(255,255,255,0.14)');
        stroke(ctx, [f(0.52, 0.86), f(0.47, 0.62), f(0.56, 0.5), f(0.5, 0.3)], 'rgba(235,240,235,0.75)', 0.9);
        stroke(ctx, [f(0.47, 0.62), f(0.36, 0.56)], 'rgba(235,240,235,0.6)', 0.7);
        stroke(ctx, [f(0.56, 0.5), f(0.64, 0.44)], 'rgba(235,240,235,0.6)', 0.7);
        // Channel knobs and a speaker grille.
        for (const v of [0.74, 0.54]) {
          const [kx, ky] = f(0.83, v);
          ctx.fillStyle = '#b9b2a2';
          ctx.beginPath();
          ctx.ellipse(kx, ky, 4, 4.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3c3630';
          ctx.lineWidth = 1;
          ctx.stroke();
          stroke(ctx, [[kx, ky], [kx + 1.5, ky - 3.2]], '#3c3630', 1.2);
        }
        for (let i = 0; i < 5; i++) stroke(ctx, [f(0.76, 0.16 + i * 0.05), f(0.9, 0.16 + i * 0.05)], '#0f0d0b', 1);
      } else {
        // The back: a pressed-board cover with vent slots and a dangling cord.
        poly(ctx, q(0.08, 0.92, 0.1, 0.9), '#3b2f26', 'rgba(0,0,0,0.4)', 1);
        for (let i = 0; i < 6; i++) stroke(ctx, [f(0.2, 0.3 + i * 0.09), f(0.8, 0.3 + i * 0.09)], '#16110d', 1.4);
        const c0 = f(0.3, 0.14);
        ctx.beginPath();
        ctx.moveTo(c0[0], c0[1]);
        ctx.bezierCurveTo(c0[0] - 4, c0[1] + 16, c0[0] + 14, c0[1] + 10, c0[0] + 10, c0[1] + 22);
        ctx.strokeStyle = '#1d1a18';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      // Bent rabbit-ear antenna.
      const base = iso(b.x + b.w / 2, b.y + b.d / 2, b.z1);
      ctx.fillStyle = '#2b2725';
      ctx.beginPath();
      ctx.ellipse(base[0], base[1], 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      stroke(ctx, [base, [base[0] - 15, base[1] - 22]], '#a9adb0', 1.3);
      stroke(ctx, [base, [base[0] + 11, base[1] - 15], [base[0] + 19, base[1] - 13]], '#a9adb0', 1.3);
    },
  });
  run([body]);
}

// ---- Paint cans ----

function can(k: Kit, vx: number, vy: number, z: number, r: number, h: number, paint: string, open: boolean, seed: number): Part {
  return {
    key: vx + vy + z * 0.01,
    draw: () => {
      const { ctx } = k;
      const R = rng(seed);
      const [bx, by] = k.iso(vx, vy, z);
      const hw = r * RX;
      const hh = r * RY;
      const H = h * ZS;
      const side = () => {
        ctx.beginPath();
        ctx.moveTo(bx - hw, by - H);
        ctx.lineTo(bx - hw, by);
        ctx.ellipse(bx, by, hw, hh, 0, Math.PI, 0, true);
        ctx.lineTo(bx + hw, by - H);
        ctx.ellipse(bx, by - H, hw, hh, 0, 0, Math.PI, false);
        ctx.closePath();
      };
      const g = ctx.createLinearGradient(bx - hw, 0, bx + hw, 0);
      g.addColorStop(0, '#8d949a');
      g.addColorStop(0.3, '#dfe4e8');
      g.addColorStop(0.55, '#a3aab0');
      g.addColorStop(1, '#5f666c');
      side();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      side();
      ctx.clip();
      // Paper label, then rust creeping up from the base and paint run down from the rim.
      ctx.fillStyle = 'rgba(236,228,205,0.9)';
      ctx.fillRect(bx - hw, by - H * 0.72 + hh * 0.5, hw * 2, H * 0.42);
      ctx.fillStyle = rgb(paint, 1, 0.85);
      ctx.fillRect(bx - hw, by - H * 0.58 + hh * 0.5, hw * 2, H * 0.12);
      const rust = ctx.createLinearGradient(0, by + hh, 0, by - H * 0.45);
      rust.addColorStop(0, 'rgba(120,58,22,0.85)');
      rust.addColorStop(1, 'rgba(120,58,22,0)');
      ctx.fillStyle = rust;
      ctx.fillRect(bx - hw, by - H, hw * 2, H + hh);
      ctx.fillStyle = paint;
      for (let i = 0; i < 4; i++) {
        const dx = bx - hw * 0.8 + R() * hw * 1.6;
        const len = H * (0.25 + R() * 0.55);
        const yTop = by - H + Math.sqrt(Math.max(0, 1 - ((dx - bx) / hw) ** 2)) * hh;
        ctx.beginPath();
        ctx.roundRect(dx - 1.6, yTop - 2, 3.2, len, 1.6);
        ctx.fill();
      }
      ctx.restore();
      // Rim and lid, or the dried skin of paint inside.
      ctx.beginPath();
      ctx.ellipse(bx, by - H, hw, hh, 0, 0, Math.PI * 2);
      ctx.fillStyle = open ? '#6d747a' : '#c3c9ce';
      ctx.fill();
      ctx.strokeStyle = '#4f565c';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(bx, by - H + (open ? 1.5 : 0), hw * 0.78, hh * 0.78, 0, 0, Math.PI * 2);
      ctx.fillStyle = open ? rgb(paint, 0.8) : '#aab1b7';
      ctx.fill();
      if (open) {
        // Cracked, dried-out surface.
        ctx.strokeStyle = rgb(paint, 0.5);
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 4; i++) {
          const a = R() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(bx, by - H + 1.5);
          ctx.lineTo(bx + Math.cos(a) * hw * 0.7, by - H + 1.5 + Math.sin(a) * hh * 0.7);
          ctx.stroke();
        }
      }
      // Wire handle flopped to one side.
      ctx.beginPath();
      ctx.moveTo(bx - hw, by - H * 0.85);
      ctx.quadraticCurveTo(bx - hw * 0.2, by - H * 0.5 + hh, bx + hw, by - H * 0.85);
      ctx.strokeStyle = 'rgba(60,62,66,0.8)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    },
  };
}

function drawPaint(k: Kit, p: Placed, l: L) {
  const { ctx, iso } = k;
  const s = p.uid * 53;
  const [sx, sy] = l(0.45, 0.45);
  floorShadow(k, sx, sy, 0.4, 0.34);
  // A dried spill from the can that tipped.
  const [px, py] = l(0.68, 0.72);
  const R = rng(s);
  const [cx, cy] = iso(px, py, 0);
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = 0.2 * (0.75 + R() * 0.5);
    const x = cx + Math.cos(a) * rr * RX;
    const y = cy + Math.sin(a) * rr * RY;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#6f93a8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,75,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - 1.5, 5, 1.8, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  const parts = [
    can(k, ...l(0.3, 0.3), 0, 0.17, 0.36, '#c9c2a8', false, s + 1),
    can(k, ...l(0.3, 0.3), 0.36, 0.12, 0.2, '#a8553c', false, s + 2),
    can(k, ...l(0.68, 0.34), 0, 0.15, 0.32, '#6f93a8', true, s + 3),
    can(k, ...l(0.32, 0.72), 0, 0.13, 0.26, '#d9b85a', true, s + 4),
  ];
  // A lid and a stiff old brush on the floor.
  const [lx, ly] = l(0.82, 0.55);
  parts.push({
    key: lx + ly,
    draw: () => {
      const [ex, ey] = iso(lx, ly, 0.01);
      ctx.beginPath();
      ctx.ellipse(ex, ey, 0.13 * RX, 0.13 * RY, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b5bcc2';
      ctx.fill();
      ctx.strokeStyle = '#5c6369';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ex, ey, 0.08 * RX, 0.08 * RY, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#6f93a8';
      ctx.fill();
    },
  });
  run(parts);
}

// ---- Fishing net ----

function drawNet(k: Kit, p: Placed, l: L, color: string) {
  const { ctx, iso } = k;
  const R = rng(p.uid * 71);
  const [vx, vy] = l(0.48, 0.5);
  floorShadow(k, vx, vy, 0.46, 0.36);
  // Rope trailing off across the floor.
  const rope: Pt[] = [l(0.5, 0.6), l(0.8, 0.86), l(0.95, 0.7), l(0.9, 0.95)].map(([x, y]) => iso(x, y, 0.01));
  for (const [col, lw] of [['#6d5a3c', 3.4], ['#c9b185', 2]] as const) {
    ctx.beginPath();
    ctx.moveTo(rope[0][0], rope[0][1]);
    ctx.bezierCurveTo(rope[1][0], rope[1][1], rope[2][0], rope[2][1], rope[3][0], rope[3][1]);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  const { bx, by } = sackPath(k, vx, vy, 0.4, 0.42, R);
  const hw = 0.4 * RX;
  const g = ctx.createRadialGradient(bx - hw * 0.3, by - 14, 2, bx, by - 6, hw * 1.4);
  g.addColorStop(0, rgb(color, 1.1));
  g.addColorStop(0.5, rgb(color, 0.72));
  g.addColorStop(1, rgb(color, 0.38));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Knotted mesh, bunched and folded over itself.
  for (const dir of [1, -1]) {
    for (let i = -8; i < 14; i++) {
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.1) {
        const x = bx - hw + i * 7 + dir * t * 46 + Math.sin(t * 9 + i) * 3;
        const y = by + 14 - t * 44 + Math.cos(t * 7 + i * 1.7) * 2.5;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = dir > 0 ? 'rgba(22,52,50,0.6)' : 'rgba(215,240,232,0.35)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
  // Deep folds.
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(bx - hw * (0.6 - i * 0.5), by - 22 + i * 3);
    ctx.quadraticCurveTo(bx - hw * (0.3 - i * 0.5), by - 4, bx - hw * (0.7 - i * 0.55), by + 8);
    ctx.strokeStyle = 'rgba(10,30,30,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  // Floats caught in the tangle.
  for (const [fx, fy, fz, col] of [[0.3, 0.62, 0.12, '#d8623a'], [0.62, 0.42, 0.3, '#ece6d6'], [0.7, 0.7, 0.06, '#d8623a']] as const) {
    const [vx2, vy2] = l(fx, fy);
    const [x, y] = iso(vx2, vy2, fz);
    const fg = ctx.createRadialGradient(x - 2, y - 2.5, 0.5, x, y, 6.5);
    fg.addColorStop(0, rgb(col, 1.35));
    fg.addColorStop(0.6, col);
    fg.addColorStop(1, rgb(col, 0.55));
    ctx.beginPath();
    ctx.ellipse(x, y, 6.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();
    stroke(ctx, [[x - 6.5, y], [x + 6.5, y]], 'rgba(20,45,45,0.6)', 0.9);
  }
}

// ---- Driftwood ----

function drawDriftwood(k: Kit, p: Placed, l: L, color: string) {
  const { ctx, iso } = k;
  const R = rng(p.uid * 37);
  const [sx, sy] = l(0.5, 0.5);
  floorShadow(k, sx, sy, 0.46, 0.3);
  // Each log: two ends in tile space with heights, a thickness, and a gentle bow.
  const logs: [number, number, number, number, number, number, number][] = [
    [0.08, 0.3, 0.05, 0.92, 0.5, 0.07, 10],
    [0.2, 0.85, 0.05, 0.75, 0.15, 0.3, 7.5],
    [0.5, 0.92, 0.04, 0.95, 0.72, 0.16, 5.5],
    [0.3, 0.5, 0.2, 0.42, 0.2, 0.62, 3.6],
  ];
  const parts: Part[] = logs.map(([x0, y0, z0, x1, y1, z1, th], i) => {
    const a = l(x0, y0);
    const b = l(x1, y1);
    return {
      key: (a[0] + a[1] + b[0] + b[1]) / 2 + Math.max(z0, z1) * 0.5,
      draw: () => {
        const A = iso(a[0], a[1], z0);
        const B = iso(b[0], b[1], z1);
        const bow = (R() - 0.5) * 10;
        const M: Pt = [(A[0] + B[0]) / 2 + bow * 0.3, (A[1] + B[1]) / 2 + bow];
        const curve = (dy: number, col: string, lw: number) => {
          ctx.beginPath();
          ctx.moveTo(A[0], A[1] + dy);
          ctx.quadraticCurveTo(M[0], M[1] + dy, B[0], B[1] + dy);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.lineCap = 'round';
          ctx.stroke();
        };
        curve(th * 0.28, rgb(color, 0.5), th);
        curve(0, rgb(color, 0.9), th * 0.86);
        curve(-th * 0.2, rgb(color, 1.3), th * 0.36);
        // Weathered cracks along the grain.
        ctx.setLineDash([5 + i * 2, 7, 11, 5]);
        curve(th * 0.08, 'rgba(70,58,44,0.55)', 0.7);
        curve(-th * 0.06, 'rgba(70,58,44,0.35)', 0.6);
        ctx.setLineDash([]);
        // A knot, and the pale broken end with its rings.
        const kn: Pt = [A[0] + (B[0] - A[0]) * 0.36 + bow * 0.2, A[1] + (B[1] - A[1]) * 0.36 + bow * 0.6];
        ctx.beginPath();
        ctx.ellipse(kn[0], kn[1], th * 0.2, th * 0.14, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80,64,46,0.7)';
        ctx.fill();
        const end = A[1] > B[1] ? A : B;
        ctx.beginPath();
        ctx.ellipse(end[0], end[1], th * 0.4, th * 0.46, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgb(color, 1.25);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,74,54,0.7)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(end[0], end[1], th * 0.18, th * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      },
    };
  });
  run(parts);
  // A few barnacle-pale flecks and a strand of dried kelp.
  const [kx, ky] = iso(...l(0.62, 0.62), 0.12);
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.bezierCurveTo(kx + 6, ky + 8, kx - 4, ky + 12, kx + 4, ky + 20);
  ctx.strokeStyle = '#4f5a34';
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

const JUNK_SCALE = 1.3;

// Draws a piece of junk. Returns false for anything it does not know, so the caller can
// fall back to a plain box.
export function drawJunk(k: Kit, p: Placed, colors: { top: string; side: string }): boolean {
  const l = tileSpace(p);
  // Pieces are modelled a little small so their parts stay inside the tile; draw them
  // larger so a pile fills its square the way the old boxes did.
  const [ox, oy] = k.iso(p.x + 0.5, p.y + 0.5, 0);
  k.ctx.translate(ox, oy);
  k.ctx.scale(JUNK_SCALE, JUNK_SCALE);
  k.ctx.translate(-ox, -oy);
  switch (p.id) {
    case 'junk-bags':
      drawBags(k, p, l);
      return true;
    case 'junk-boxes':
      drawBoxes(k, l);
      return true;
    case 'junk-armchair':
      drawArmchair(k, p, l, colors.top);
      return true;
    case 'junk-tv':
      drawTv(k, p, l);
      return true;
    case 'junk-paint':
      drawPaint(k, p, l);
      return true;
    case 'junk-net':
      drawNet(k, p, l, colors.top);
      return true;
    case 'junk-driftwood':
      drawDriftwood(k, p, l, colors.top);
      return true;
  }
  return false;
}
